import {
  type Class,
  type CourseId,
  Request,
  type Role,
  type User,
  type UserId,
  Users,
} from "../models";
import { assertAck, BaseService } from "./baseService";
import { ClassPermissionError, CoursePermissionError } from "./error";

export class UserService extends BaseService {
  async createUser(data: User): Promise<void> {
    const result = await this.collections.users.insertOne(data);
    assertAck(result, `create user ${JSON.stringify(data)}`);
  }

  async getUser(userId: UserId): Promise<User> {
    return this.requireUser(userId);
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
    const user = await this.requireUser(userId);
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
    const user = await this.requireUser(userId);
    if (!Users.hasRole(user, clazz, roles)) {
      throw new ClassPermissionError(userId, roles, clazz, operation);
    }
  }
}
