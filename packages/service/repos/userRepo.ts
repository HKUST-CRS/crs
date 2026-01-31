import type { Collections } from "../db";
import {
  type Class,
  type CourseId,
  Courses,
  type Enrollment,
  type Role,
  type User,
  type UserId,
} from "../models";
import { UserNotFoundError } from "./error";

export class UserRepo {
  constructor(protected collections: Collections) {}

  async getUser(userId: UserId): Promise<User | null> {
    const user = await this.collections.users.findOne({ email: userId });
    return user;
  }

  async requireUser(userId: UserId): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }

  /**
   * Create a new user if not exists.
   *
   * The user's name is initialized as an empty string, and enrollment as an empty array.
   */
  async createUser(userId: UserId): Promise<void> {
    await this.collections.users.updateOne(
      {
        email: userId,
      },
      {
        $setOnInsert: {
          email: userId,
          name: "",
          enrollment: [],
          sudoer: false,
        },
      },
      {
        upsert: true,
      },
    );
  }

  async updateUserName(userId: UserId, name: string): Promise<void> {
    await this.collections.users.updateOne(
      { email: userId },
      { $set: { name } },
    );
  }

  /**
   * Gets all users that are sudoers.
   */
  async getSudoers(): Promise<User[]> {
    const users = await this.collections.users.find({ sudoer: true }).toArray();
    return users;
  }

  /**
   * Get all users enrolled in the course.
   */
  async getUsersInCourse(courseId: CourseId): Promise<User[]> {
    const users = await this.collections.users
      .find({
        enrollment: {
          $elemMatch: {
            "course.code": courseId.code,
            "course.term": courseId.term,
          },
        },
      })
      .toArray();
    return users;
  }

  async getUsersInClass(clazz: Class, role: Role): Promise<User[]> {
    const users = await this.collections.users
      .find({
        enrollment: {
          $elemMatch: {
            "course.code": clazz.course.code,
            "course.term": clazz.course.term,
            section: clazz.section,
            role,
          },
        },
      })
      .toArray();
    return users;
  }

  /**
   * Create a role for the user in a class.
   */
  async createEnrollment(uid: UserId, enrollment: Enrollment): Promise<void> {
    await this.collections.users.updateOne(
      { email: uid },
      { $addToSet: { enrollment } },
    );
    const user = await this.requireUser(uid);
    user.enrollment.sort((a, b) => Courses.compare(a.course, b.course));
    await this.collections.users.updateOne(
      { email: uid },
      { $set: { enrollment: user.enrollment } },
    );
  }

  /**
   * Delete a role for the user in a class.
   */
  async deleteEnrollment(uid: UserId, enrollment: Enrollment): Promise<void> {
    await this.collections.users.updateOne(
      { email: uid },
      { $pull: { enrollment } },
    );
    const user = await this.requireUser(uid);
    user.enrollment.sort((a, b) => Courses.compare(a.course, b.course));
    await this.collections.users.updateOne(
      { email: uid },
      { $set: { enrollment: user.enrollment } },
    );
  }
}
