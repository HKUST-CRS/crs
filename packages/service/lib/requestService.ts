import type {
  Request,
  RequestId,
  RequestInit,
  ResponseInit,
  Role,
  UserId,
} from "../models";
import { AuthableService, ServiceWithAuth } from "./baseService";
import { assertClassRole } from "./permission";

export class RequestService extends AuthableService {
  withAuth(userId: UserId): RequestServiceWithAuth {
    return new RequestServiceWithAuth(this.repos, userId);
  }
}

class RequestServiceWithAuth extends ServiceWithAuth {
  async createRequest(data: RequestInit): Promise<string> {
    const user = await this.repos.user.requireUser(this.userId);
    // only students in the class can create requests
    assertClassRole(user, data.class, ["student"], "creating request");
    return this.repos.request.createRequest(this.userId, data);
  }

  async getRequest(requestId: RequestId): Promise<Request> {
    const user = await this.repos.user.requireUser(this.userId);
    const request = await this.repos.request.requireRequest(requestId);
    if (this.userId !== request.from) {
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
  async getRequestsAs(role: Role): Promise<Request[]> {
    const user = await this.repos.user.requireUser(this.userId);
    // students can only get their own requests
    if (role === "student") {
      return this.repos.request.getRequestsMadeByUser(this.userId);
    }
    // instructors and TAs can get requests for their classes
    const enrollments = user.enrollment.filter((clazz) => clazz.role === role);
    return this.repos.request.getRequestsInClasses(enrollments);
  }

  async createResponse(
    requestId: RequestId,
    response: ResponseInit,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.userId);
    const request = await this.repos.request.requireRequest(requestId);
    // only instructors of the class can create responses
    assertClassRole(
      user,
      request.class,
      ["instructor"],
      `creating response for request ${requestId}`,
    );
    await this.repos.request.createResponse(this.userId, requestId, response);
  }
}
