import type {
  AppealEntry,
  CancelEntry,
  CommentEntry,
  Proof,
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  ResponseEntry,
  ResponseInit,
  Role,
  UserID,
} from "../models";
import type { Repos } from "../repos";
import { PermissionError } from "./error";
import { assertClassRole } from "./permission";

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
   * The requester, or an instructor/observer in the class, may comment to provide
   * more information. The request body itself is never edited; clarification is
   * given via comments. Comments are allowed on open or resolved requests, but
   * not on cancelled ones.
   *
   * @returns The created thread entry.
   */
  async addComment(
    this: RequestService<UserID>,
    requestID: RequestID,
    payload: { text: string; proof?: Proof },
  ): Promise<CommentEntry> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      assertClassRole(
        user,
        request.class,
        ["instructor", "observer"],
        `commenting on request ${requestID}`,
      );
    }
    return this.repos.request.appendComment(this.user, requestID, payload);
  }

  /**
   * Responds to a request with a decision.
   *
   * The user must be an instructor of the class. A response is only allowed while
   * the request is open (including after an appeal reopened it); otherwise a
   * `StatusConflictError` is thrown. The top-level denormalized `response` is
   * updated to the latest response and the status becomes "resolved".
   *
   * @returns The created thread entry.
   */
  async respond(
    this: RequestService<UserID>,
    requestID: RequestID,
    response: ResponseInit,
  ): Promise<ResponseEntry> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    assertClassRole(
      user,
      request.class,
      ["instructor"],
      `responding to request ${requestID}`,
    );
    return this.repos.request.appendResponse(this.user, requestID, response);
  }

  /**
   * Cancels a request. Only the requester may cancel, and only while the request
   * is open; cancellation is terminal.
   *
   * @returns The created thread entry.
   */
  async cancelRequest(
    this: RequestService<UserID>,
    requestID: RequestID,
    text?: string,
  ): Promise<CancelEntry> {
    await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      throw new PermissionError(
        this.user,
        [],
        `cancelling request ${requestID}`,
      );
    }
    return this.repos.request.appendCancel(this.user, requestID, text);
  }

  /**
   * Appeals a resolved request, reopening it for another response. Only the
   * requester may appeal, and only while the request is resolved.
   *
   * @returns The created thread entry.
   */
  async appealRequest(
    this: RequestService<UserID>,
    requestID: RequestID,
    payload: { text: string; proof?: Proof },
  ): Promise<AppealEntry> {
    await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    if (this.user !== request.from) {
      throw new PermissionError(
        this.user,
        [],
        `appealing request ${requestID}`,
      );
    }
    return this.repos.request.appendAppeal(this.user, requestID, payload);
  }
}
