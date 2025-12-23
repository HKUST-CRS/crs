import { ALL_ROLES, type Course, type CourseId, type UserId } from "../models";
import { AuthableService, ServiceWithAuth } from "./baseService";
import { assertCourseRole } from "./permission";

export class CourseService extends AuthableService {
  withAuth(userId: UserId): CourseServiceWithAuth {
    return new CourseServiceWithAuth(this.repos, userId);
  }
}

class CourseServiceWithAuth extends ServiceWithAuth {
  async getCourse(courseId: CourseId): Promise<Course> {
    const user = await this.repos.user.requireUser(this.userId);
    assertCourseRole(user, courseId, ALL_ROLES, "accessing course information");
    return this.repos.course.requireCourse(courseId);
  }

  async getCoursesFromEnrollment(): Promise<Course[]> {
    const user = await this.repos.user.requireUser(this.userId);
    return this.repos.course.getCoursesFromEnrollment(user);
  }

  async updateSections(
    courseId: CourseId,
    sections: Course["sections"],
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.userId);
    assertCourseRole(
      user,
      courseId,
      ["instructor"],
      "updating course sections",
    );
    await this.repos.course.updateSections(courseId, sections);
  }

  async setEffectiveRequestTypes(
    courseId: CourseId,
    effectiveRequestTypes: Course["effectiveRequestTypes"],
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.userId);
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
