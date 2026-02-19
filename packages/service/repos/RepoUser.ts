import type { Collections } from "../db";
import {
  type Class,
  Classes,
  type CourseID,
  Courses,
  type Enrollment,
  Enrollments,
  type Role,
  type User,
  type UserID,
} from "../models";
import { UserNotFoundError } from "./error";

export class UserRepo {
  constructor(protected collections: Collections) {}

  async getUser(userID: UserID): Promise<User | null> {
    const user = await this.collections.users.findOne({ email: userID });
    return user;
  }

  async requireUser(userID: UserID): Promise<User> {
    const user = await this.getUser(userID);
    if (!user) throw new UserNotFoundError(userID);
    return user;
  }

  /**
   * Create a new user if not exists.
   *
   * The user's name is initialized as an empty string, and enrollment as an empty array.
   */
  async createUser(userID: UserID): Promise<void> {
    await this.collections.users.updateOne(
      {
        email: userID,
      },
      {
        $setOnInsert: {
          email: userID,
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

  /**
   * Update the user's name.
   */
  async updateUserName(userID: UserID, name: string): Promise<void> {
    await this.collections.users.updateOne(
      { email: userID },
      { $set: { name } },
    );
  }

  /**
   * Update the user's name if there is no current name.
   */
  async suggestUserName(uid: UserID, name: string): Promise<void> {
    await this.collections.users.updateOne(
      { email: uid, name: "" },
      { $set: { name } },
    );
  }

  /**
   * Gets all users that are sudoers.
   */
  async getSudoers(): Promise<User[]> {
    const users = await this.collections.users
      .find({ sudoer: true })
      .sort({ email: "ascending" })
      .collation({ locale: "en", numericOrdering: true })
      .toArray();
    return users;
  }

  /**
   * Get all users enrolled in the course.
   */
  async getUsersInCourse(courseID: CourseID): Promise<User[]> {
    const users = await this.collections.users
      .find({
        enrollment: {
          $elemMatch: {
            "course.code": courseID.code,
            "course.term": courseID.term,
          },
        },
      })
      .sort({ email: "ascending" })
      .collation({ locale: "en", numericOrdering: true })
      .toArray();
    return users;
  }

  /**
   * Get all users enrolled in the class with the specified role.
   *
   * Enrollments with section "*" are treated as belonging to every section in the course.
   */
  async getUsersInClass(clazz: Class, role: Role): Promise<User[]> {
    const users = await this.collections.users
      .find({
        enrollment: {
          $elemMatch: {
            "course.code": clazz.course.code,
            "course.term": clazz.course.term,
            section: { $in: [clazz.section, "*"] },
            role,
          },
        },
      })
      .sort({ email: "ascending" })
      .collation({ locale: "en", numericOrdering: true })
      .toArray();
    return users;
  }

  /**
   * Get all classes for a course.
   *
   * Special sections like * and parenthetical sections (e.g., "(...)") are excluded.
   */
  async getClasses(cid: CourseID): Promise<Class[]> {
    const users = await this.collections.users
      .find({
        enrollment: {
          $elemMatch: {
            "course.code": cid.code,
            "course.term": cid.term,
          },
        },
      })
      .toArray();
    const classes = Object.fromEntries(
      users.flatMap((user) =>
        user.enrollment
          .filter((e) => Courses.id2str(e.course) === Courses.id2str(cid))
          .filter((e) => e.section !== "*" && !e.section.match(/^\(.*\)$/))
          .map((e) => [
            Classes.id2str(e),
            {
              course: cid,
              section: e.section,
            } satisfies Class,
          ]),
      ),
    );
    return Object.values(classes).sort(Classes.compare);
  }

  /**
   * Create a role for the user in a class.
   */
  async createEnrollment(uid: UserID, enrollment: Enrollment): Promise<void> {
    await this.collections.withTransaction(async (session) => {
      await this.collections.users.updateOne(
        { email: uid },
        { $addToSet: { enrollment } },
        { session },
      );
      const user = await this.collections.users.findOne(
        { email: uid },
        { session },
      );
      if (!user) throw new UserNotFoundError(uid);
      user.enrollment.sort(Enrollments.compare);
      await this.collections.users.updateOne(
        { email: uid },
        { $set: { enrollment: user.enrollment } },
        { session },
      );
    });
  }

  /**
   * Delete a role for the user in a class.
   */
  async deleteEnrollment(uid: UserID, enrollment: Enrollment): Promise<void> {
    await this.collections.withTransaction(async (session) => {
      await this.collections.users.updateOne(
        { email: uid },
        { $pull: { enrollment } },
        { session },
      );
      const user = await this.collections.users.findOne(
        { email: uid },
        { session },
      );
      if (!user) throw new UserNotFoundError(uid);
      user.enrollment.sort(Enrollments.compare);
      await this.collections.users.updateOne(
        { email: uid },
        { $set: { enrollment: user.enrollment } },
        { session },
      );
    });
  }
}
