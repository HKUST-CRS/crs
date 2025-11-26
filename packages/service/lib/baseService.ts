import type { Collections } from "../db";
import type {
  Course,
  CourseId,
  Request,
  RequestId,
  User,
  UserId,
} from "../models";
import {
  CourseNotFoundError,
  RequestNotFoundError,
  UserNotFoundError,
} from "./error";

export abstract class BaseService {
  protected collections: Collections;

  constructor(collection: Collections) {
    this.collections = collection;
  }

  async requireCourse(courseId: CourseId): Promise<Course> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw new CourseNotFoundError(courseId);
    return course;
  }

  async requireUser(userId: UserId): Promise<User> {
    const user = await this.collections.users.findOne({ email: userId });
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }

  async requireRequest(requestId: RequestId): Promise<Request> {
    const request = await this.collections.requests.findOne({ id: requestId });
    if (!request) throw new RequestNotFoundError(requestId);
    return request;
  }
}

export function assertAck(result: { acknowledged: boolean }, op: string): void {
  if (!result.acknowledged) {
    throw new Error(`Operation ${op} not acknowledged`);
  }
}
