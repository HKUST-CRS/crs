import { deepEquals } from "bun";
import {
  type Class,
  Classes,
  type CourseID,
  Courses,
  type Enrollment,
  type Role,
  Roles,
  type User,
  type UserID,
} from "../models";
import type { Repos } from "../repos";
import {
  assertClassRole,
  assertCourseRole,
  assertRole,
  assertSudoer,
} from "./permission";

export class UserService<TUser extends UserID | null = null> {
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
   * It updates the user's name according to the latest info. It updates the sudoers' enrollment
   * invariant: all sudoers have the admin role in all courses.
   *
   * If the user does not exist, it creates the user record.
   */
  async sync(this: UserService<UserID>, name: string): Promise<void> {
    await this.repos.user.createUser(this.user);
    await this.repos.user.updateUserName(this.user, name);

    const user = await this.getCurrentUser();
    if (user.sudoer) {
      for (const course of await this.repos.course.getCourses()) {
        const oldEnrollment = user.enrollment.find(
          (e) =>
            Courses.id2str(e.course) === Courses.id2str(course) &&
            e.role === "admin",
        );
        const newEnrollment = {
          role: "admin",
          course: Courses.toID(course),
          section: "(as system admin)",
        } satisfies Enrollment;
        if (!deepEquals(oldEnrollment, newEnrollment)) {
          if (oldEnrollment) {
            await this.repos.user.deleteEnrollment(this.user, oldEnrollment);
          }
          await this.repos.user.createEnrollment(this.user, newEnrollment);
        }
      }
    }
  }

  /**
   * Suggests a name for a user. The name is only updated if the current name does not exist.
   *
   * The current user must have the "instructor" or "admin" role in any course.
   *
   * @param uid The user ID to suggest a name for.
   * @param name The name to suggest.
   */
  async suggestUserName(
    this: UserService<UserID>,
    uid: UserID,
    name: string,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertRole(user, ["instructor", "admin"], "suggesting a user name");
    await this.repos.user.suggestUserName(uid, name);
  }

  /**
   * Gets a user by their user ID.
   *
   * The current user must have an instructor, observer, or admin role in one
   * course that the target user is in. Alternatively, the current user should
   * be the target user themselves.
   *
   * @param uid The user ID.
   * @return The user with the given user ID.
   */
  async getUser(this: UserService<UserID>, uid: UserID): Promise<User> {
    const user = await this.repos.user.requireUser(this.user);
    const target = await this.repos.user.requireUser(uid);

    if (user.email !== uid) {
      assertCourseRole(
        user,
        target.enrollment.map((e) => e.course),
        ["instructor", "observer", "admin"],
        `getting user ${uid}`,
      );
    }

    return target;
  }

  /**
   * Returns the current authenticated user.
   */
  async getCurrentUser(this: UserService<UserID>): Promise<User> {
    return this.repos.user.requireUser(this.user);
  }

  /**
   * Get all sudoers in the system.
   *
   * The current user must be a sudoer.
   *
   * @returns The list of sudoer users.
   */
  async getSudoers(this: UserService<UserID>): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.user);
    assertSudoer(user, "getting sudoers");
    return this.repos.user.getSudoers();
  }

  /**
   * Gets all users such that they have an enrollment in the given course.
   *
   * The current user must have the "instructor" role or the "admin" role in the course.
   *
   * @param courseID The course ID.
   * @returns The list of users in the course.
   */
  async getUsersInCourse(
    this: UserService<UserID>,
    courseID: CourseID,
  ): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseID,
      ["instructor", "admin"],
      `getting users in course ${courseID.code} (${courseID.term})`,
    );
    return this.repos.user.getUsersInCourse(courseID);
  }

  /**
   * Gets all users such that they have an enrollment in the given class with the specified role.
   *
   * If the target role is "student", the current user must have the "instructor" or "admin" role
   * in the class. If the target role is "instructor", "observer" or "admin", the current user must
   * have any role in the class.
   *
   * If a user has a role in the class for section *, then they are always in the result.
   *
   * @param clazz The class.
   * @param role The target role to filter by.
   * @returns The list of users in the class with the specified role.
   */
  async getUsersInClass(
    this: UserService<UserID>,
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
   * Gets all enrollments of the current user with specified roles.
   *
   * The enrollments of the section * is automatically flattened. That is, an enrollment in some
   * course with section * is flattened into multiple enrollments, one for each section in the
   * course with the specified roles. The sections in the course are obtained by looking at all
   * enrollments of all users in the course.
   *
   * @param roles The roles to filter by.
   */
  async getEnrollments(
    this: UserService<UserID>,
    roles: Role[],
  ): Promise<Enrollment[]> {
    const user = await this.repos.user.requireUser(this.user);
    const enrollments = user.enrollment;

    const flattenedEnrollments = (
      await Promise.all(
        enrollments.map(async (enrollment) => {
          if (!roles.includes(enrollment.role)) {
            return [];
          }
          if (enrollment.section !== "*") {
            return [enrollment];
          }
          const classes = await this.repos.user.getClasses(enrollment.course);
          return classes.map(
            (clazz) =>
              ({
                ...clazz,
                role: enrollment.role,
              }) satisfies Enrollment,
          );
        }),
      )
    ).flat();
    return flattenedEnrollments;
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
    this: UserService<UserID>,
    uid: UserID,
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
    this: UserService<UserID>,
    uid: UserID,
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
