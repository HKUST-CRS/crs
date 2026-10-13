import {
  type Class,
  type Comment,
  type CommentInit,
  type Course,
  ExaminationAppealBatch,
  type Request,
  type RequestID,
  type RequestInit,
  type RequestStatus,
  type Role,
  type ThreadEntry,
  type User,
  type UserID,
} from "../models";
import { validateAbsentFromSection } from "../models/request/AbsentFromSection";
import { validateDeadlineExtension } from "../models/request/DeadlineExtension";
import { validateSwapSection } from "../models/request/SwapSection";
import type { Repos } from "../repos";
import { ProofNotFoundError } from "../repos/error";
import {
  DeadlineExtensionNotAllowedError,
  InvalidRequestError,
  PermissionError,
  RequestTypeNotEffectiveError,
} from "./error";
import { assertClassRole, hasClassRole } from "./permission";

// Statuses from which each status change is admissible. The lifecycle is
// intentionally permissive: an instructor may re-decide (approve/reject from a
// decided or appealed state), a requester may cancel from any non-cancelled
// state, and a requester may appeal a decision to flag it for re-review.
// "cancelled" is terminal for status changes, but authorized participants may
// still comment.
const DECISION_FROM: RequestStatus[] = [
  "open",
  "appealed",
  "approved",
  "rejected",
];
const APPEAL_FROM: RequestStatus[] = ["approved", "rejected"];

/** Resolve responsibility for this exact examination question from the current catalog. */
export async function resolveExaminationTA(
  repos: Repos,
  request: Request,
): Promise<UserID | null> {
  if (request.type !== "Examination Appeal") return null;
  const course = await repos.course.requireCourse(request.class.course);
  return (
    course.examinations[request.metadata.examCode]?.questions.find(
      (question) => question.questionNumber === request.metadata.questionNumber,
    )?.taId ?? null
  );
}

function validateExaminationTarget(
  course: Course,
  clazz: Class,
  examCode: string,
  questionNumber: string,
): void {
  if (!course.effectiveRequestTypes["Examination Appeal"]) {
    throw new RequestTypeNotEffectiveError(clazz.course, "Examination Appeal");
  }
  if (
    !Object.hasOwn(course.sections, clazz.section) ||
    !Object.hasOwn(course.examinations, examCode) ||
    !course.examinations[examCode]?.questions.some(
      (question) => question.questionNumber === questionNumber,
    )
  ) {
    throw new InvalidRequestError(clazz.course, "Examination Appeal");
  }
}

export class RequestService<TUser extends UserID | null = null> {
  public user: TUser;

  constructor(repos: Repos);
  constructor(repos: Repos, user: TUser);
  constructor(
    private repos: Repos,
    user?: TUser,
  ) {
    this.user = (user ?? null) as TUser;
  }

  auth(this: RequestService<null>, user: string): RequestService<string> {
    return new RequestService(this.repos, user);
  }

  private async assertRequestAccess(
    user: User,
    request: Request,
    roles: Role[],
    operation: string,
  ): Promise<void> {
    if (hasClassRole(user, request.class, roles)) return;
    if ((await resolveExaminationTA(this.repos, request)) === user.email)
      return;
    assertClassRole(user, request.class, roles, operation);
  }

  /**
   * Gets a specific request.
   *
   * If the user has a role of student in the course, they can only view their own requests. If the
   * user has a role of instructor or observer in the class, they can view all requests for that
   * class. The assigned TA can also view appeals for their exact examination question.
   */
  async getRequest(
    this: RequestService<UserID>,
    requestID: RequestID,
  ): Promise<Request> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      await this.assertRequestAccess(
        user,
        request,
        ["instructor", "observer"],
        `getting request ${requestID}`,
      );
    }
    return request;
  }

  /**
   * Get all requests visible to a user, as specific roles.
   *
   * If the role is "student", this returns all requests made by the user.
   *
   * If the role is "instructor" or "observer", this returns all requests for
   * classes that the user is an instructor or observer of. Enrollments with section "*" include
   * all sections in the course.
   *
   * If the role is "admin", this returns no requests.
   *
   * @param roles The roles to fetch requests as.
   * @returns The requests visible to the user for the specified roles.
   */
  async getRequestsAs(
    this: RequestService<UserID>,
    roles: Role[],
  ): Promise<Request[]> {
    const user = await this.repos.user.requireUser(this.user);
    const requests: Request[] = [];
    if (roles.includes("student")) {
      const studentRequests = await this.repos.request.getRequestsFromUser(
        this.user,
      );
      requests.push(...studentRequests);
    }
    if (roles.includes("instructor") || roles.includes("observer")) {
      const enrollments = user.enrollment.filter(
        (clazz) =>
          (clazz.role === "instructor" || clazz.role === "observer") &&
          roles.includes(clazz.role),
      );
      requests.push(
        ...(await this.repos.request.getRequestsInClasses(enrollments)),
      );
    }
    return requests;
  }

  async getAssignedExaminationAppeals(
    this: RequestService<UserID>,
  ): Promise<Request[]> {
    await this.repos.user.requireUser(this.user);
    const courses = await this.repos.course.getCoursesWithExaminationTA(
      this.user,
    );
    const targets = courses.flatMap((course) =>
      Object.entries(course.examinations).flatMap(([examCode, exam]) =>
        exam.questions
          .filter((question) => question.taId === this.user)
          .map((question) => ({
            course: { code: course.code, term: course.term },
            examCode,
            questionNumber: question.questionNumber,
          })),
      ),
    );
    return this.repos.request.getExaminationAppealsForTargets(targets);
  }

  async getContext(this: RequestService<UserID>, requestID: RequestID) {
    const request = await this.getRequest(requestID);
    const user = await this.repos.user.requireUser(this.user);
    const course = await this.repos.course.requireCourse(request.class.course);
    const assignedEmail = await resolveExaminationTA(this.repos, request);
    const authors = [...new Set(request.thread.map((entry) => entry.from))];
    const profiles = await Promise.all(
      [...new Set([...authors, ...(assignedEmail ? [assignedEmail] : [])])].map(
        (email) => this.repos.user.getUser(email),
      ),
    );
    const displayName = (email: string) =>
      profiles.find((profile) => profile?.email === email)?.name || email;
    const staff =
      hasClassRole(user, request.class, ["instructor"]) ||
      assignedEmail === this.user;
    return {
      courseTitle: course.title,
      assignedTA: assignedEmail
        ? { email: assignedEmail, name: displayName(assignedEmail) }
        : null,
      authors: authors.map((email) => ({ email, name: displayName(email) })),
      canComment: this.user === request.from || staff,
      canDecide:
        staff &&
        (request.type !== "Examination Appeal" || this.user !== request.from) &&
        DECISION_FROM.includes(request.status),
      canAppeal:
        this.user === request.from && APPEAL_FROM.includes(request.status),
    };
  }

  /**
   * Gets specific requests by their IDs.
   *
   * The current user can access a request if they are the requester, or if they have the
   * instructor or observer role in the request's class, or are the exact question's TA.
   *
   * Missing request IDs are ignored.
   *
   * @param requestIDs The request IDs to fetch.
   * @returns The matching requests in the same order as the input IDs.
   */
  async getRequestsByID(
    this: RequestService<UserID>,
    requestIDs: RequestID[],
  ): Promise<Request[]> {
    const user = await this.repos.user.requireUser(this.user);
    const requests = await this.repos.request.getRequestsByID(requestIDs);

    for (const request of requests) {
      if (this.user !== request.from) {
        await this.assertRequestAccess(
          user,
          request,
          ["instructor", "observer"],
          `getting request ${request.id}`,
        );
      }
    }

    return requests;
  }

  /**
   * Creates a request.
   *
   * The user must be a student in the class that the request is for in order to create the request.
   * The opening reason + proofs are recorded as the first comment in the thread.
   *
   * @param request The request data.
   * @param comment The opening comment.
   * @returns The ID of the created request.
   */
  async createRequest(
    this: RequestService<UserID>,
    request: RequestInit,
    comment: CommentInit,
  ): Promise<string> {
    const user = await this.repos.user.requireUser(this.user);
    // Examination appeals use the atomic, replay-safe batch endpoint even for one question.
    if (request.type === "Examination Appeal") {
      throw new InvalidRequestError(request.class.course, request.type);
    }
    // only students in the class can create requests
    assertClassRole(user, request.class, ["student"], "creating request");
    const course = await this.repos.course.requireCourse(request.class.course);
    if (!course.effectiveRequestTypes[request.type]) {
      throw new RequestTypeNotEffectiveError(
        request.class.course,
        request.type,
      );
    }
    switch (request.type) {
      case "Swap Section":
        if (!validateSwapSection(course, request.metadata)) {
          throw new InvalidRequestError(request.class.course, request.type);
        }
        break;
      case "Absent from Section":
        if (!validateAbsentFromSection(course, request.metadata)) {
          throw new InvalidRequestError(request.class.course, request.type);
        }
        break;
      case "Deadline Extension":
        if (!validateDeadlineExtension(course, request.metadata)) {
          throw new DeadlineExtensionNotAllowedError(
            request.class.course,
            request.metadata.assignment,
          );
        }
        break;
    }
    return this.repos.request.createRequest(this.user, request, comment);
  }

  async createExaminationAppeals(
    this: RequestService<UserID>,
    input: ExaminationAppealBatch,
  ): Promise<{ ids: string[]; created: boolean }> {
    const batch = ExaminationAppealBatch.parse(input);
    const user = await this.repos.user.requireUser(this.user);
    const existing = await this.repos.request.getExaminationAppealSubmission(
      this.user,
      batch,
    );
    if (existing) return existing;
    assertClassRole(
      user,
      batch.class,
      ["student"],
      "creating examination appeals",
    );
    const course = await this.repos.course.requireCourse(batch.class.course);
    for (const appeal of batch.appeals) {
      validateExaminationTarget(
        course,
        batch.class,
        appeal.examCode,
        appeal.questionNumber,
      );
    }
    return this.repos.request.createExaminationAppeals(this.user, batch);
  }

  /**
   * Adds a comment (optionally with supporting documents) to the request thread.
   *
   * The requester, class instructor or exact question's TA may comment at any point —
   * including after the request is cancelled — to provide more information.
   * Observers have read-only access to the thread. The request body itself is
   * never edited; clarification is given via comments.
   *
   * @returns The created comment entry.
   */
  async comment(
    this: RequestService<UserID>,
    requestID: RequestID,
    payload: CommentInit,
  ): Promise<Comment> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      await this.assertRequestAccess(
        user,
        request,
        ["instructor"],
        `commenting on request ${requestID}`,
      );
    }
    return this.repos.request.appendComment(this.user, requestID, payload);
  }

  /**
   * Approves the request. A class instructor or exact question's TA may approve, and the
   * request must be in a state open to a decision (open, appealed, or already
   * decided — re-decisions are allowed). An optional comment is recorded
   * immediately before the status change.
   *
   * @returns The created thread entries (comment, if any, then the status change).
   */
  async approve(
    this: RequestService<UserID>,
    requestID: RequestID,
    comment?: CommentInit,
  ): Promise<ThreadEntry[]> {
    return this.decide(requestID, "approved", comment);
  }

  /**
   * Rejects the request. See {@link approve} for authorization and comments.
   */
  async reject(
    this: RequestService<UserID>,
    requestID: RequestID,
    comment?: CommentInit,
  ): Promise<ThreadEntry[]> {
    return this.decide(requestID, "rejected", comment);
  }

  private async decide(
    this: RequestService<UserID>,
    requestID: RequestID,
    status: "approved" | "rejected",
    comment?: CommentInit,
  ): Promise<ThreadEntry[]> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (request.type === "Examination Appeal" && this.user === request.from) {
      throw new PermissionError(
        this.user,
        [],
        `deciding own examination appeal ${requestID}`,
      );
    }
    await this.assertRequestAccess(
      user,
      request,
      ["instructor"],
      `${status === "approved" ? "approving" : "rejecting"} request ${requestID}`,
    );
    return this.repos.request.appendStatusChange(
      this.user,
      requestID,
      { status },
      DECISION_FROM,
      status === "approved" ? "approve" : "reject",
      comment,
    );
  }

  /**
   * Cancels the request. Only the requester may cancel, and only from a
   * non-cancelled state; cancellation is terminal for status changes (though
   * comments may still follow). An optional comment is recorded immediately
   * before the status change.
   *
   * @returns The created thread entries (comment, if any, then the status change).
   */
  async cancel(
    this: RequestService<UserID>,
    requestID: RequestID,
    comment?: CommentInit,
  ): Promise<ThreadEntry[]> {
    await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      throw new PermissionError(
        this.user,
        [],
        `cancelling request ${requestID}`,
      );
    }
    return this.repos.request.appendStatusChange(
      this.user,
      requestID,
      { status: "cancelled" },
      DECISION_FROM,
      "cancel",
      comment,
    );
  }

  /**
   * Appeals a decision, flagging the request for re-review. Only the requester
   * may appeal, and only from a decided state (approved or rejected). The
   * justification (text + proofs) is recorded as a comment preceding the status
   * change.
   *
   * @returns The created thread entries (justification comment, then the status change).
   */
  async appeal(
    this: RequestService<UserID>,
    requestID: RequestID,
    payload: CommentInit,
  ): Promise<ThreadEntry[]> {
    await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      throw new PermissionError(
        this.user,
        [],
        `appealing request ${requestID}`,
      );
    }
    return this.repos.request.appendStatusChange(
      this.user,
      requestID,
      { status: "appealed" },
      APPEAL_FROM,
      "appeal",
      payload,
    );
  }

  /**
   * Reads the bytes of a stored proof file. Only a participant of the request
   * that owns the file (the requester, class instructor/observer, or exact question's TA)
   * may download it; the file must belong to a visible request's thread.
   *
   * @returns The file content as base64.
   */
  async fetchProof(
    this: RequestService<UserID>,
    proofID: string,
  ): Promise<{ content: string }> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.getRequestByProof(proofID);
    if (!request) throw new ProofNotFoundError(proofID);
    if (this.user !== request.from) {
      await this.assertRequestAccess(
        user,
        request,
        ["instructor", "observer"],
        `downloading proof ${proofID}`,
      );
    }
    const content = await this.repos.request.fetchProof(proofID);
    return { content };
  }
}
