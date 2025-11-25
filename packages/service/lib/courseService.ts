import { type Course, type CourseId, Request, type UserId } from "../models";
import { assertAck, BaseService } from "./baseService";

export class CourseService extends BaseService {
  async createCourse(data: Course): Promise<void> {
    const result = await this.collections.courses.insertOne(data);
    assertAck(result, `create course with data: ${JSON.stringify(data)}`);
  }

  async getCourse(courseId: CourseId): Promise<Course> {
    return this.requrieCourse(courseId);
  }

  async getCourses(): Promise<Course[]> {
    return this.collections.courses.find().toArray();
  }

  async getCoursesFromEnrollment(userId: UserId): Promise<Course[]> {
    const user = await this.requireUser(userId);
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
    courseId: CourseId,
    sections: Course["sections"],
  ): Promise<void> {
    await this.requrieCourse(courseId);
    const result = await this.collections.courses.updateOne(courseId, {
      $set: { sections },
    });
    assertAck(result, `update course ${courseId}`);
  }

  async setEffectiveRequestTypes(
    courseId: CourseId,
    effectiveRequestTypes: Course["effectiveRequestTypes"],
  ): Promise<void> {
    const result = await this.collections.courses.updateOne(courseId, {
      $set: { effectiveRequestTypes },
    });
    if (result.modifiedCount === 0) {
      throw new Error(
        `Failed to update request types for course ${courseId.code} (${courseId.term})`,
      );
    }
  }

  async getCourseRequests(courseId: CourseId): Promise<Request[]> {
    const result = await this.collections.requests
      .find({
        "course.code": courseId.code,
        "course.term": courseId.term,
      })
      .toArray();
    return result.map((req) =>
      Request.parse({ ...req, id: req._id.toHexString() }),
    );
  }
}
