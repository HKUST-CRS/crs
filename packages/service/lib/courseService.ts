import { ALL_ROLES, type Course, type CourseId, type UserId } from "../models";
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

  async getCourse(
    this: CourseService<UserId>,
    courseId: CourseId,
  ): Promise<Course> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(user, courseId, ALL_ROLES, "accessing course information");
    return this.repos.course.requireCourse(courseId);
  }

  async getCoursesFromEnrollment(
    this: CourseService<UserId>,
  ): Promise<Course[]> {
    const user = await this.repos.user.requireUser(this.user);
    return this.repos.course.getCoursesFromEnrollment(user);
  }

  async updateSections(
    this: CourseService<UserId>,
    courseId: CourseId,
    sections: Course["sections"],
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseId,
      ["instructor"],
      "updating course sections",
    );
    await this.repos.course.updateSections(courseId, sections);
  }

  async setEffectiveRequestTypes(
    this: CourseService<UserId>,
    courseId: CourseId,
    effectiveRequestTypes: Course["effectiveRequestTypes"],
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(
      user,
      courseId,
      ["instructor"],
      "updating effective request types",
    );
    await this.repos.course.setEffectiveRequestTypes(
      courseId,
      effectiveRequestTypes,
    );
  }
}
