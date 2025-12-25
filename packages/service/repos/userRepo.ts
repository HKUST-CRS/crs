import type { Collections } from "../db";
import type {
  Class,
  CourseId,
  Enrollment,
  Role,
  User,
  UserId,
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
   * Get all users enrolled in the course.
   */
  async getUsersFromCourse(courseId: CourseId): Promise<User[]> {
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

  async getUsersFromClass(clazz: Class, role: Role): Promise<User[]> {
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
  async createEnrollmentForUser(
    uid: UserId,
    enrollment: Enrollment,
  ): Promise<void> {
    await this.collections.users.updateOne(
      { email: uid },
      { $push: { enrollment } },
    );
  }

  /**
   * Delete a role for the user in a class.
   */
  async deleteEnrollmentForUser(
    uid: UserId,
    enrollment: Enrollment,
  ): Promise<void> {
    await this.collections.users.updateOne(
      { email: uid },
      { $pull: { enrollment } },
    );
  }
}
