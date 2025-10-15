import type { Collections } from "../db";
import {
  type Class,
  type CourseId,
  Request,
  type Role,
  type User,
  type UserId,
  Users,
} from "../models";
import {
  ClassPermissionError,
  CoursePermissionError,
  UserNotFoundError,
} from "./error";

export class UserService {
  private collections: Collections;
  constructor(collection: Collections) {
    this.collections = collection;
  }

  async createUser(data: User): Promise<void> {
    const result = await this.collections.users.insertOne(data);
    if (!result.acknowledged) throw new Error("Failed to create user");
  }

  async getUser(userId: UserId): Promise<User> {
    const user = await this.collections.users.findOne({ email: userId });
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }

  async updateUserName(uid: UserId, name: string): Promise<void> {
    await this.collections.users.updateOne({ email: uid }, { $set: { name } });
  }

  async getUsersFromClass(clazz: Class, role: Role): Promise<User[]> {
    const users = await this.collections.users
      .find({
        enrollment: {
          $elemMatch: {
            ...clazz,
            role,
          },
        },
      })
      .toArray();
    return users;
  }

  async getUserRequests(userId: UserId): Promise<Request[]> {
    const result = await this.collections.requests
      .find({ from: userId })
      .toArray();
    return result.map((req) =>
      Request.parse({ ...req, id: req._id.toHexString() }),
    );
  }

  async assertInCourse(userId: UserId, courseId: CourseId): Promise<void> {
    const user = await this.collections.users.findOne({ email: userId });
    if (!user) throw new UserNotFoundError(userId);
    if (!Users.inCourse(user, courseId)) {
      throw new CoursePermissionError(userId, courseId, "accessing course");
    }
  }

  async assertClassRole(
    userId: UserId,
    clazz: Class,
    roles: Role[],
    operation: string,
  ): Promise<void> {
    const user = await this.collections.users.findOne({ email: userId });
    if (!user) throw new UserNotFoundError(userId);
    if (!Users.hasRole(user, clazz, roles)) {
      throw new ClassPermissionError(userId, roles, clazz, operation);
    }
  }
}
