import type { Collections } from "../db";
import type { Course, CourseId, User } from "../models";
import { CourseNotFoundError } from "./error";

export class CourseRepo {
  constructor(protected collections: Collections) {}

  async requireCourse(courseId: CourseId): Promise<Course> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw new CourseNotFoundError(courseId);
    return course;
  }

  async getCoursesFromEnrollment(user: User): Promise<Course[]> {
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
    courseId: CourseId,
    sections: Course["sections"],
  ): Promise<void> {
    await this.collections.courses.updateOne(
      // cannot use courseId directly, in case of extra fields
      { code: courseId.code, term: courseId.term },
      {
        $set: { sections },
      },
    );
  }

  async setEffectiveRequestTypes(
    courseId: CourseId,
    effectiveRequestTypes: Course["effectiveRequestTypes"],
  ): Promise<void> {
    await this.collections.courses.updateOne(
      // cannot use courseId directly, in case of extra fields
      { code: courseId.code, term: courseId.term },
      {
        $set: { effectiveRequestTypes },
      },
    );
  }

  async updateAssignments(
    courseId: CourseId,
    assignments: Course["assignments"],
  ): Promise<void> {
    await this.collections.courses.updateOne(courseId, {
      $set: { assignments },
    });
  }
}
