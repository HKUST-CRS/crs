import {
  type Course,
  type CourseId,
  Courses,
  type Role,
  Roles,
  type UserId,
} from "../models";
import type { Repos } from "../repos";
import { assertCourseRole } from "./permission";

export class CourseService<TUser extends UserId | null = null> {
  public user: TUser;

  constructor(repos: Repos);
  constructor(repos: Repos, user: TUser);
  constructor(
    private repos: Repos,
    user?: TUser,
  ) {
    this.user = (user ?? null) as TUser;
  }

  auth(this: CourseService<null>, user: string): CourseService<string> {
    return new CourseService(this.repos, user);
  }

  /**
   * Gets a course.
   *
   * The current user must have any role in the course.
   *
   * @param courseId The ID of the course to get.
   * @returns The course.
   */
  async getCourse(
    this: CourseService<UserId>,
    courseId: CourseId,
  ): Promise<Course> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseId,
      Roles,
      `accessing course ${Courses.formatID(courseId)}`,
    );
    return this.repos.course.requireCourse(courseId);
  }

  /**
   * Gets all courses such that the current user has enrollment with one of the given roles.
   *
   * @returns The list of courses.
   */
  async getCoursesFromEnrollment(
    this: CourseService<UserId>,
    roles: Role[],
  ): Promise<Course[]> {
    const user = await this.repos.user.requireUser(this.user);
    return this.repos.course.getCoursesFromEnrollment(user, roles);
  }

  /**
   * Updates the sections of a course.
   *
   * The current user must be an instructor or admin in the course.
   *
   * @param courseId The ID of the course to update.
   * @param sections The new sections of the course.
   */
  async updateSections(
    this: CourseService<UserId>,
    courseId: CourseId,
    sections: Course["sections"],
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseId,
      ["instructor", "admin"],
      `updating sections of course ${Courses.formatID(courseId)}`,
    );
    await this.repos.course.updateSections(courseId, sections);
  }

  /**
   * Updates the assignments of a course.
   *
   * The current user must be an instructor or admin in the course.
   *
   * @param courseId The ID of the course to update.
   * @param assignments The new assignments of the course.
   */
  async updateAssignments(
    this: CourseService<UserId>,
    courseId: CourseId,
    assignments: Course["assignments"],
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseId,
      ["instructor", "admin"],
      `updating assignments of course ${Courses.formatID(courseId)}`,
    );
    await this.repos.course.updateAssignments(courseId, assignments);
  }

  /**
   * Updates the effective request types of a course.
   *
   * @param courseId The ID of the course to update.
   * @param effectiveRequestTypes The new effective request types of the course.
   */
  async updateEffectiveRequestTypes(
    this: CourseService<UserId>,
    courseId: CourseId,
    effectiveRequestTypes: Course["effectiveRequestTypes"],
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseId,
      ["instructor", "admin"],
      `updating effective request types of course ${Courses.formatID(courseId)}`,
    );
    await this.repos.course.updateEffectiveRequestTypes(
      courseId,
      effectiveRequestTypes,
    );
  }
}
