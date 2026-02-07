import { deepEquals } from "bun";
import {
  type Class,
  Classes,
  type CourseId,
  Courses,
  type Enrollment,
  type Role,
  Roles,
  type User,
  type UserId,
} from "../models";
import type { Repos } from "../repos";
import { CoursePermissionError } from "./error";
import { assertClassRole, assertCourseRole, assertSudoer } from "./permission";

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
   * It updates the user's name according to the latest info. It updates the sudoers' enrollment
   * invariant: all sudoers have the admin role in all courses.
   *
   * If the user does not exist, it creates the user record.
   */
  async sync(this: UserService<UserId>, name: string): Promise<void> {
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
   * If a course is provided, the current user must have the "instructor" or "admin" role in that
   * course. If no course is provided, the current user must have the "instructor" or "admin" role
   * in at least one course that the target user has an enrollment in. This is to prevent students
   * from suggesting names for other students in courses that they are not enrolled in.
   *
   * @param uid The user ID to suggest a name for.
   * @param name The name to suggest.
   * @param courseId Optional course context. If provided, authorization is checked only for this course.
   */
  async suggestUserName(
    this: UserService<UserId>,
    uid: UserId,
    name: string,
    courseId?: CourseId,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    const targetUser = await this.repos.user.requireUser(uid);

    if (courseId) {
      // If course context is provided, only check authorization for that specific course
      assertCourseRole(
        user,
        courseId,
        ["instructor", "admin"],
        `suggesting name for user ${uid} in course ${Courses.id2str(courseId)}`,
      );
    } else {
      // If no course context, check that the user has access to at least one course the target is enrolled in
      const targetEnrollments = targetUser.enrollment;

      if (targetEnrollments.length === 0) {
        throw new Error(
          "Insufficient permissions to suggest name for this user",
        );
      }

      let hasAccess = false;
      for (const enrollment of targetEnrollments) {
        try {
          assertCourseRole(
            user,
            enrollment.course,
            ["instructor", "admin"],
            `suggesting name for user ${uid}`,
          );
          hasAccess = true;
          break;
        } catch (error) {
          // Only catch CoursePermissionError, continue checking other enrollments
          if (!(error instanceof CoursePermissionError)) {
            throw error;
          }
        }
      }
      if (!hasAccess) {
        throw new Error(
          "Insufficient permissions to suggest name for this user",
        );
      }
    }

    await this.repos.user.suggestUserName(uid, name);
  }

  /**
   * Returns the current authenticated user.
   */
  async getCurrentUser(this: UserService<UserId>): Promise<User> {
    return this.repos.user.requireUser(this.user);
  }

  /**
   * Get all sudoers in the system.
   *
   * The current user must be a sudoer.
   *
   * @returns The list of sudoer users.
   */
  async getSudoers(this: UserService<UserId>): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.user);
    assertSudoer(user, "getting sudoers");
    return this.repos.user.getSudoers();
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
   * If a user has a role in the class for section *, then they are always in the result.
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
    this: UserService<UserId>,
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
