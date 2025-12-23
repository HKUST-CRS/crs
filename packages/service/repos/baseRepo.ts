import type { Collections } from "../db/conn";
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

export abstract class BaseRepo {
  protected collections: Collections;

  constructor(collections: Collections) {
    this.collections = collections;
  }

  async requireUser(userId: UserId): Promise<User> {
    const user = await this.collections.users.findOne({ email: userId });
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }

  async requireCourse(courseId: CourseId): Promise<Course> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw new CourseNotFoundError(courseId);
    return course;
  }

  async requireRequest(requestId: RequestId): Promise<Request> {
    const request = await this.collections.requests.findOne({ id: requestId });
    if (!request) throw new RequestNotFoundError(requestId);
    return request;
  }
}
