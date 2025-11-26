import type { Course, CourseId, UserId } from "../models";
import { assertAck, BaseService } from "./baseService";
import { assertCourseInstructor, assertInCourse } from "./permission";

export class CourseService extends BaseService {
  async getCourse(uid: UserId, courseId: CourseId): Promise<Course> {
    const user = await this.requireUser(uid);
    assertInCourse(user, courseId, "accessing course information");
    return this.requireCourse(courseId);
  }

  async getCoursesFromEnrollment(uid: UserId): Promise<Course[]> {
    const user = await this.requireUser(uid);
    const courseIds = user.enrollment.map((e) => ({
      code: e.course.code,
      term: e.course.term,
    }));
    // MongoDB throws an error when $or receives an empty array
    if (courseIds.length === 0) {
      return [];
    }
    return await this.collections.courses
      .find({
        $or: courseIds.map((id) => ({ code: id.code, term: id.term })),
      })
      .toArray();
  }

  async updateSections(
    uid: UserId,
    courseId: CourseId,
    sections: Course["sections"],
  ): Promise<void> {
    assertCourseInstructor(
      await this.requireUser(uid),
      courseId,
      "updating course sections",
    );
    const result = await this.collections.courses.updateOne(
      // cannot use courseId directly, in case of extra fields
      { code: courseId.code, term: courseId.term },
      {
        $set: { sections },
      },
    );
    assertAck(result, `update course ${courseId.code} (${courseId.term})`);
  }

  async setEffectiveRequestTypes(
    uid: UserId,
    courseId: CourseId,
    effectiveRequestTypes: Course["effectiveRequestTypes"],
  ): Promise<void> {
    assertCourseInstructor(
      await this.requireUser(uid),
      courseId,
      "updating effective request types",
    );
    const result = await this.collections.courses.updateOne(
      // cannot use courseId directly, in case of extra fields
      { code: courseId.code, term: courseId.term },
      {
        $set: { effectiveRequestTypes },
      },
    );
    assertAck(
      result,
      `update request types for course ${courseId.code} (${courseId.term})`,
    );
  }
}
