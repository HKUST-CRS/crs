import type {
  Comment,
  CommentInit,
  Request,
  RequestID,
  RequestInit,
  RequestStatus,
  Role,
  ThreadEntry,
  User,
  UserID,
} from "../models";
import type { Repos } from "../repos";
import { ProofNotFoundError } from "../repos/error";
import {
  AssignmentNotFoundError,
  AssignmentNotGradedError,
  PermissionError,
  RequestParticipantError,
} from "./error";
import { assertClassRole } from "./permission";

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

/**
 * The users allowed to participate in an "Assignment Appeal": the appealing
 * student, the instructor(s) of the request's section, and the TA(s) of the
 * appealed assignment. Frozen at creation time.
 */
function resolveAppealParticipants(
  student: UserID,
  instructors: UserID[],
  tas: UserID[],
): UserID[] {
  return [...new Set([student, ...instructors, ...tas])];
}

/**
 * For testing purpose. Whether the user has an admin role in the request's course.
 * Admins may view and decide every appeal in the courses they administer,
 * even those they are not a participant of.
 */
function isCourseAdmin(user: User, request: Request): boolean {
  return user.enrollment.some(
    (e) =>
      e.role === "admin" &&
      e.course.code === request.class.course.code &&
      e.course.term === request.class.course.term,
  );
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

  /**
   * Checks that the user may access a request. Appeal requests (those with a
   * participant list) are visible to their participants and to admins of the
   * request's course; every other request uses the usual class-role rule.
   */
  private assertRequestAccess(
    user: User,
    request: Request,
    roles: Role[],
    op: string,
  ): void {
    if (request.participants) {
      if (
        request.participants.includes(user.email) ||
        isCourseAdmin(user, request)
      ) {
        return;
      }
      throw new RequestParticipantError(user.email, request.id);
    }
    assertClassRole(user, request.class, roles, op);
  }

  /**
   * Gets a specific request.
   *
   * If the user has a role of student in the course, they can only view their own requests. If the
   * user has a role of instructor or observer in the class, they can view all requests for that
   * class.
   */
  async getRequest(
    this: RequestService<UserID>,
    requestID: RequestID,
  ): Promise<Request> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      // only the requester or instructors/observers in the class can view the request
      this.assertRequestAccess(
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
   * Admins additionally see every appeal request in the courses they
   * administer, even those they are not a participant of.
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
    const seen = new Set<string>();
    const push = (request: Request) => {
      if (seen.has(request.id)) return;
      seen.add(request.id);
      requests.push(request);
    };
    if (roles.includes("student")) {
      for (const request of await this.repos.request.getRequestsFromUser(
        this.user,
      )) {
        push(request);
      }
    }
    if (roles.includes("instructor") || roles.includes("observer")) {
      const enrollments = user.enrollment.filter(
        (clazz) =>
          (clazz.role === "instructor" || clazz.role === "observer") &&
          roles.includes(clazz.role),
      );
      for (const request of await this.repos.request.getRequestsInClasses(
        enrollments,
      )) {
        // Appeal requests are visible only to their participants: an observer
        // or an instructor who is not the section's lecturer / the
        // assignment's TA must not see the appeal.
        if (request.participants && !request.participants.includes(this.user)) {
          continue;
        }
        push(request);
      }
      // Admins can see every appeal in the courses they administer, even those
      // they are not a participant of.
      const adminEnrollments = user.enrollment.filter(
        (clazz) => clazz.role === "admin",
      );
      for (const request of await this.repos.request.getRequestsInClasses(
        adminEnrollments,
      )) {
        if (request.participants) push(request);
      }
    }
    // Appeals are also visible to every participant regardless of enrollment —
    // e.g. a TA responsible for the assignment but with no instructor/observer
    // role in the course. Deduplicated against the lists above.
    for (const request of await this.repos.request.getRequestsAsParticipant(
      this.user,
    )) {
      push(request);
    }
    return requests;
  }

  /**
   * Gets specific requests by their IDs.
   *
   * The current user can access a request if they are the requester, or if they have the
   * instructor or observer role in the request's class.
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
        this.assertRequestAccess(
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
    // only students in the class can create requests
    assertClassRole(user, request.class, ["student"], "creating request");

    let participants: UserID[] | undefined;
    if (request.type === "Assignment Appeal") {
      const course = await this.repos.course.requireCourse(
        request.class.course,
      );
      const assignment = course.assignments[request.metadata.assignment];
      if (!assignment) {
        throw new AssignmentNotFoundError(
          request.class.course,
          request.metadata.assignment,
        );
      }
      if (assignment.state !== "graded") {
        throw new AssignmentNotGradedError(
          request.class.course,
          request.metadata.assignment,
        );
      }
      participants = resolveAppealParticipants(
        user.email,
        // The lecturers of the section are the course instructors enrolled in
        // it (or enrolled course-wide via section "*") — the same roster shown
        // on the request header. Not stored on the course.
        (
          await this.repos.user.getUsersInClass(request.class, "instructor")
        ).map((instructor) => instructor.email),
        assignment.tas ?? [],
      );
    }

    return this.repos.request.createRequest(
      this.user,
      request,
      comment,
      participants,
    );
  }

  /**
   * Adds a comment (optionally with supporting documents) to the request thread.
   *
   * The requester or an instructor in the class may comment at any point —
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
      this.assertRequestAccess(
        user,
        request,
        ["instructor"],
        `commenting on request ${requestID}`,
      );
    }
    return this.repos.request.appendComment(this.user, requestID, payload);
  }

  /**
   * Approves the request. Only an instructor of the class may approve, and the
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
    if (request.participants) {
      // An appeal is decided by a participant who is not the appealing student
      // — i.e. a responsible lecturer or TA — or by an admin of the course.
      if (
        !request.participants.includes(user.email) &&
        !isCourseAdmin(user, request)
      ) {
        throw new RequestParticipantError(user.email, requestID);
      }
      // The appealing student cannot decide their own appeal — unless they are
      // an admin of the course, who may decide any appeal in it.
      if (user.email === request.from && !isCourseAdmin(user, request)) {
        throw new PermissionError(
          this.user,
          [],
          `${status === "approved" ? "approving" : "rejecting"} request ${requestID}`,
        );
      }
    } else {
      assertClassRole(
        user,
        request.class,
        ["instructor"],
        `${status === "approved" ? "approving" : "rejecting"} request ${requestID}`,
      );
    }
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
    if (request.participants) {
      // There is no higher instance to re-appeal an assignment appeal to.
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
   * that owns the file (the requester or an instructor/observer in the class)
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
      this.assertRequestAccess(
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
