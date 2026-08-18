import type {
  CommentEntry,
  ProofUpload,
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  RequestStatus,
  Role,
  ThreadEntry,
  UserID,
} from "../models";
import type { Repos } from "../repos";
import { ProofNotFoundError } from "../repos/error";
import { PermissionError } from "./error";
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
      assertClassRole(
        user,
        request.class,
        ["instructor", "observer"],
        `getting request ${requestID}`,
      );
    }
    return request;
  }

  /**
   * Get all request heads of a user, as specific roles.
   *
   * If the role is "student", this returns request heads for all requests made by the user.
   *
   * If the role is "instructor" or "observer", this returns request heads for all requests for
   * classes that the user is an instructor or observer of. Enrollments with section "*" include
   * all sections in the course.
   *
   * If the role is "admin", this returns no request heads.
   *
   * @param roles The roles to fetch request heads as.
   * @returns The list of request heads visible to the user for the specified roles.
   */
  async getRequestHeadsAs(
    this: RequestService<UserID>,
    roles: Role[],
  ): Promise<RequestHead[]> {
    const user = await this.repos.user.requireUser(this.user);
    const requests: RequestHead[] = [];
    if (roles.includes("student")) {
      const studentRequests = await this.repos.request.getRequestHeadsFromUser(
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
        ...(await this.repos.request.getRequestHeadsInClasses(enrollments)),
      );
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
        assertClassRole(
          user,
          request.class,
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
   * The opening reason + proof are recorded as the first comment in the thread.
   *
   * @param data The request data.
   * @returns The ID of the created request.
   */
  async createRequest(
    this: RequestService<UserID>,
    data: RequestInit,
  ): Promise<string> {
    const user = await this.repos.user.requireUser(this.user);
    // only students in the class can create requests
    assertClassRole(user, data.class, ["student"], "creating request");
    return this.repos.request.createRequest(this.user, data);
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
  async addComment(
    this: RequestService<UserID>,
    requestID: RequestID,
    payload: { text: string; proof?: ProofUpload },
  ): Promise<CommentEntry> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      assertClassRole(
        user,
        request.class,
        ["instructor"],
        `commenting on request ${requestID}`,
      );
    }
    return this.repos.request.appendComment(this.user, requestID, payload);
  }

  /**
   * Approves the request. Only an instructor of the class may approve, and the
   * request must be in a state open to a decision (open, appealed, or already
   * decided — re-decisions are allowed). An optional remark is recorded as a
   * comment preceding the status change.
   *
   * @returns The created thread entries (remark comment, if any, then the status change).
   */
  async approve(
    this: RequestService<UserID>,
    requestID: RequestID,
    remark?: { text: string; proof?: ProofUpload },
  ): Promise<ThreadEntry[]> {
    return this.decide(requestID, "approved", remark);
  }

  /**
   * Rejects the request. See {@link approve} for authorization and remarks.
   */
  async reject(
    this: RequestService<UserID>,
    requestID: RequestID,
    remark?: { text: string; proof?: ProofUpload },
  ): Promise<ThreadEntry[]> {
    return this.decide(requestID, "rejected", remark);
  }

  private async decide(
    this: RequestService<UserID>,
    requestID: RequestID,
    status: "approved" | "rejected",
    remark?: { text: string; proof?: ProofUpload },
  ): Promise<ThreadEntry[]> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    assertClassRole(
      user,
      request.class,
      ["instructor"],
      `${status === "approved" ? "approving" : "rejecting"} request ${requestID}`,
    );
    return this.repos.request.appendStatusChange(
      this.user,
      requestID,
      status,
      DECISION_FROM,
      status === "approved" ? "approve" : "reject",
      remark,
    );
  }

  /**
   * Cancels the request. Only the requester may cancel, and only from a
   * non-cancelled state; cancellation is terminal for status changes (though
   * comments may still follow). An optional remark is recorded as a comment
   * preceding the status change.
   *
   * @returns The created thread entries (remark comment, if any, then the status change).
   */
  async cancel(
    this: RequestService<UserID>,
    requestID: RequestID,
    remark?: { text: string; proof?: ProofUpload },
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
      "cancelled",
      DECISION_FROM,
      "cancel",
      remark,
    );
  }

  /**
   * Appeals a decision, flagging the request for re-review. Only the requester
   * may appeal, and only from a decided state (approved or rejected). The
   * justification (text + proof) is recorded as a comment preceding the status
   * change, so an appeal always carries a remark.
   *
   * @returns The created thread entries (justification comment, then the status change).
   */
  async appeal(
    this: RequestService<UserID>,
    requestID: RequestID,
    payload: { text: string; proof?: ProofUpload },
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
      "appealed",
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
  async readProof(
    this: RequestService<UserID>,
    attachmentId: string,
  ): Promise<{ content: string }> {
    const user = await this.repos.user.requireUser(this.user);
    const request =
      await this.repos.request.findRequestByAttachmentId(attachmentId);
    if (!request) throw new ProofNotFoundError(attachmentId);
    if (this.user !== request.from) {
      assertClassRole(
        user,
        request.class,
        ["instructor", "observer"],
        `downloading proof ${attachmentId}`,
      );
    }
    const content = await this.repos.request.readProof(attachmentId);
    return { content };
  }
}
