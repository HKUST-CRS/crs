import type {
  Class,
  CourseId,
  Enrollment,
  Role,
  User,
  UserId,
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
    const _user = await this.repos.user.getUser(this.user);
    await this.repos.user.createUser(this.user);
    await this.repos.user.updateUserName(this.user, name);
  }

  async getCurrentUser(this: UserService<UserId>): Promise<User> {
    return this.repos.user.requireUser(this.user);
  }

  async getUsersFromCourse(
    this: UserService<UserId>,
    courseId: CourseId,
  ): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseId,
      ["instructor"],
      `viewing users in course ${courseId.code} (${courseId.term})`,
    );
    return this.repos.user.getUsersFromCourse(courseId);
  }

  async getUsersFromClass(
    this: UserService<UserId>,
    clazz: Class,
    role: Role,
  ): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.user);
    switch (role) {
      case "student":
        // only instructors and TAs in the class can view the students
        assertClassRole(
          user,
          clazz,
          ["instructor", "ta"],
          `viewing students in class ${clazz.course.code} (${clazz.course.term})`,
        );
        break;
      case "instructor":
      case "ta":
        // only people in the class can view the instructors/TAs
        assertClassRole(
          user,
          clazz,
          ["student", "instructor", "ta"],
          `viewing instructors/TAs in class ${clazz.course.code} (${clazz.course.term})`,
        );
        break;
    }
    return this.repos.user.getUsersFromClass(clazz, role);
  }

  /**
   * Create a role for the user in a section of a course.
   *
   * If the user does not exist, it creates the user record.
   */
  async createEnrollmentForUser(
    this: UserService<UserId>,
    uid: UserId,
    enrollment: Enrollment,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      enrollment.course,
      ["instructor"],
      `creating enrollment for user ${uid} in course ${enrollment.course.code} (${enrollment.course.term})`,
    );

    await this.repos.user.createUser(uid);
    await this.repos.user.createEnrollmentForUser(uid, enrollment);
  }

  /**
   * Delete a role for the user in a section of a course.
   */
  async deleteEnrollmentForUser(
    this: UserService<UserId>,
    uid: UserId,
    enrollment: Enrollment,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      enrollment.course,
      ["instructor"],
      `deleting enrollment for user ${uid} in course ${enrollment.course.code} (${enrollment.course.term})`,
    );

    await this.repos.user.deleteEnrollmentForUser(uid, enrollment);
  }
}
