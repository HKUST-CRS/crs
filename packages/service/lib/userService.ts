import {
  type Class,
  Classes,
  type CourseId,
  type Enrollment,
  type Role,
  Roles,
  type User,
  type UserId,
} from "../models";
import type { Repos } from "../repos";
import { assertClassRole, assertCourseRole } from "./permission";

export class UserService<TUser extends UserId | null = null> {
  public user: TUser;

  constructor(repos: Repos);
  constructor(repos: Repos, user: TUser);
  constructor(
    private repos: Repos,
    user?: TUser,
  ) {
    this.user = (user ?? null) as TUser;
  }

  auth(this: UserService<null>, user: string): UserService<string> {
    return new UserService(this.repos, user);
  }

  /**
   * Synchronize the current user.
   *
   * It updates the user's name according to the latest info.
   *
   * If the user does not exist, it creates the user record.
   */
  async sync(this: UserService<UserId>, name: string): Promise<void> {
    await this.repos.user.createUser(this.user);
    await this.repos.user.updateUserName(this.user, name);
  }

  /**
   * Returns the current authenticated user.
   */
  async getCurrentUser(this: UserService<UserId>): Promise<User> {
    return this.repos.user.requireUser(this.user);
  }

  /**
   * Gets all users such that they have an enrollment in the given course.
   *
   * The current user must have the "instructor" role or the "admin" role in the course.
   *
   * @param courseId The course ID.
   * @returns The list of users in the course.
   */
  async getUsersInCourse(
    this: UserService<UserId>,
    courseId: CourseId,
  ): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseId,
      ["instructor", "admin"],
      `getting users in course ${courseId.code} (${courseId.term})`,
    );
    return this.repos.user.getUsersInCourse(courseId);
  }

  /**
   * Gets all users such that they have an enrollment in the given class with the specified role.
   *
   * If the target role is "student", the current user must have the "instructor" or "admin" role
   * in the class. If the target role is "instructor", "observer" or "admin", the current user must
   * have any role in the class.
   *
   * @param clazz The class.
   * @param role The target role to filter by.
   * @returns The list of users in the class with the specified role.
   */
  async getUsersInClass(
    this: UserService<UserId>,
    clazz: Class,
    role: Role,
  ): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.user);
    switch (role) {
      case "student": {
        // only instructors and admins in the class can view the students
        assertClassRole(
          user,
          clazz,
          ["instructor", "admin"],
          `viewing students in class ${clazz.course.code} (${clazz.course.term})`,
        );
        return this.repos.user.getUsersInClass(clazz, role);
      }
      case "instructor":
      case "observer":
      case "admin": {
        // only users in the class can view the instructors/observers/admins
        assertClassRole(
          user,
          clazz,
          Roles,
          `viewing instructors/observers/admins in class ${clazz.course.code} (${clazz.course.term})`,
        );
        return this.repos.user.getUsersInClass(clazz, role);
      }
    }
  }

  /**
   * Create an enrollment for the user in a class (a section of a course) with a specific role.
   *
   * If the user does not exist, it creates the user record.
   *
   * The current user must have the "instructor" or "admin" role in the course.
   *
   * @param uid The user ID.
   * @param enrollment The enrollment to create.
   */
  async createEnrollment(
    this: UserService<UserId>,
    uid: UserId,
    enrollment: Enrollment,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      enrollment.course,
      ["instructor", "admin"],
      `creating enrollment for user ${uid} in class ${Classes.id2str(enrollment)}`,
    );

    await this.repos.user.createUser(uid);
    await this.repos.user.createEnrollment(uid, enrollment);
  }

  /**
   * Delete an enrollment for the user in a class (a section of a course).
   *
   * The current user must have the "instructor" or "admin" role in the course.
   *
   * @param uid The user ID.
   * @param enrollment The enrollment to delete.
   */
  async deleteEnrollment(
    this: UserService<UserId>,
    uid: UserId,
    enrollment: Enrollment,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      enrollment.course,
      ["instructor", "admin"],
      `deleting enrollment for user ${uid} in class ${Classes.id2str(enrollment)}`,
    );

    await this.repos.user.deleteEnrollment(uid, enrollment);
  }
}
