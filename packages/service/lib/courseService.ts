import type { Course, CourseId, UserId } from "../models";
import { assertAck, BaseService } from "./baseService";
import { assertCourseInstructor, assertInCourse } from "./permission";

export class CourseService extends BaseService {
  async createCourse(data: Course): Promise<void> {
    const result = await this.collections.courses.insertOne(data);
    assertAck(result, `create course with data: ${JSON.stringify(data)}`);
  }

  async getCourse(uid: UserId, courseId: CourseId): Promise<Course> {
    const user = await this.requireUser(uid);
    assertInCourse(user, courseId, "accessing course information");
    return this.requrieCourse(courseId);
  }

  async getCoursesFromEnrollment(uid: UserId): Promise<Course[]> {
    const user = await this.requireUser(uid);
    const courseIds = user.enrollment.map((e) => ({
      code: e.course.code,
      term: e.course.term,
    }));
    return await this.collections.courses
      .find({
        $or: courseIds,
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
    const result = await this.collections.courses.updateOne(courseId, {
      $set: { sections },
    });
    assertAck(result, `update course ${courseId}`);
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
    const result = await this.collections.courses.updateOne(courseId, {
      $set: { effectiveRequestTypes },
    });
    if (result.modifiedCount === 0) {
      throw new Error(
        `Failed to update request types for course ${courseId.code} (${courseId.term})`,
      );
    }
  }
}
