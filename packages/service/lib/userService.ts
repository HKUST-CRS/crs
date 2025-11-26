import type { Collections } from "../db";
import {
  type Class,
  type CourseId,
  type Enrollment,
  Request,
  type Role,
  type User,
  type UserId,
} from "../models";
import { UserNotFoundError } from "./error";

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

  async getUsersFromCourse(courseId: CourseId): Promise<User[]> {
    return this.collections.users
      .find({
        enrollment: {
          $elemMatch: {
            "course.code": courseId.code,
            "course.term": courseId.term,
          },
        },
      })
      .toArray();
  }

  /**
   * Create a role for the user in a section of a course.
   */
  async createEnrollment(uid: UserId, enrollment: Enrollment): Promise<void> {
    // If the user does not exist, this implicitly creates the user.
    const user = await this.collections.users.findOne({ email: uid });
    if (!user) {
      await this.collections.users.insertOne({
        email: uid,
        name: "",
        enrollment: [],
      });
    }

    await this.collections.users.updateOne(
      { email: uid },
      { $push: { enrollment } },
    );
  }

  /**
   * Delete a role for the user in a section of a course.
   */
  async deleteEnrollment(uid: UserId, enrollment: Enrollment): Promise<void> {
    await this.collections.users.updateOne(
      { email: uid },
      { $pull: { enrollment } },
    );
  }

  async getUserRequests(userId: UserId): Promise<Request[]> {
    const result = await this.collections.requests
      .find({ from: userId })
      .toArray();
    return result.map((req) =>
      Request.parse({ ...req, id: req._id.toHexString() }),
    );
  }
}
