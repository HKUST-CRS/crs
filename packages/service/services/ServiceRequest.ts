import type {
  Request,
  RequestID,
  RequestInit,
  ResponseInit,
  Role,
  UserID,
} from "../models";
import type { Repos } from "../repos";
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
   * Get all requests of a user, as a specific role.
   *
   * If the role is "student", this returns all requests made by the user.
   *
   * If the role is "instructor" or "observer", this returns all requests for classes that the user
   * is an instructor or observer of. Enrollments with section "*" include all sections in the
   * course.
   *
   * If the role is "admin", this returns no requests.
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
        (clazz) => clazz.role === "instructor" || clazz.role === "observer",
      );
      requests.push(
        ...(await this.repos.request.getRequestsInClasses(enrollments)),
      );
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
   * Creates a response to a request.
   *
   * The user must be an instructor of the class that the request is for in order to create a
   * response to the request.
   *
   * @param requestID The ID of the request to respond to.
   * @param response The response data.
   */
  async createResponse(
    this: RequestService<UserID>,
    requestID: RequestID,
    response: ResponseInit,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestID);
    // only instructors of the class can create responses
    assertClassRole(
      user,
      request.class,
      ["instructor"],
      `creating response to request ${requestID}`,
    );
    await this.repos.request.createResponse(this.user, requestID, response);
  }
}
