import type {
  Request,
  RequestId,
  RequestInit,
  ResponseInit,
  Role,
  UserId,
} from "../models";
import type { Repos } from "../repos";
import { assertClassRole } from "./permission";

export class RequestService<TUser extends UserId | null = null> {
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

  async createRequest(
    this: RequestService<UserId>,
    data: RequestInit,
  ): Promise<string> {
    const user = await this.repos.user.requireUser(this.user);
    // only students in the class can create requests
    assertClassRole(user, data.class, ["student"], "creating request");
    return this.repos.request.createRequest(this.user, data);
  }

  async getRequest(
    this: RequestService<UserId>,
    requestId: RequestId,
  ): Promise<Request> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestId);
    if (this.user !== request.from) {
      // only the requester or instructors/TAs in the class can view the request
      assertClassRole(
        user,
        request.class,
        ["instructor", "ta"],
        `viewing request ${requestId}`,
      );
    }
    return request;
  }

  /**
   * Get all requests of a user, as a specific role.
   *
   * If the role is "student", this returns all requests made by the user.
   *
   * If the role is "instructor" or "ta", this returns all requests for classes that the user
   * is an instructor or ta of.
   */
  async getRequestsAs(
    this: RequestService<UserId>,
    role: Role,
  ): Promise<Request[]> {
    const user = await this.repos.user.requireUser(this.user);
    // students can only get their own requests
    if (role === "student") {
      return this.repos.request.getRequestsMadeByUser(this.user);
    }
    // instructors and TAs can get requests for their classes
    const enrollments = user.enrollment.filter((clazz) => clazz.role === role);
    return this.repos.request.getRequestsInClasses(enrollments);
  }

  async createResponse(
    this: RequestService<UserId>,
    requestId: RequestId,
    response: ResponseInit,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    const request = await this.repos.request.requireRequest(requestId);
    // only instructors of the class can create responses
    assertClassRole(
      user,
      request.class,
      ["instructor"],
      `creating response for request ${requestId}`,
    );
    await this.repos.request.createResponse(this.user, requestId, response);
  }
}
