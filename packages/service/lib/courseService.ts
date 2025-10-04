import type { Collections } from "../db";
import { type Course, type CourseId, Request, type UserId } from "../models";
import { CourseNotFoundError, UserNotFoundError } from "./error";

export class CourseService {
  private collections: Collections;
  constructor(collection: Collections) {
    this.collections = collection;
  }

  async createCourse(data: Course): Promise<void> {
    const result = await this.collections.courses.insertOne(data);
    if (!result.acknowledged) {
      throw new Error(
        `Failed to create course with data: ${JSON.stringify(data)}`,
      );
    }
  }

  async getCourses(): Promise<Course[]> {
    return this.collections.courses.find().toArray();
  }

  async getCourse(courseId: CourseId): Promise<Course> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw new CourseNotFoundError(courseId);
    return course;
  }

  async getCoursesFromEnrollment(userId: UserId): Promise<Course[]> {
    const user = await this.collections.users.findOne({ email: userId });
    if (!user) throw new UserNotFoundError(userId);

    const enrollment = (
      await Promise.all(
        user.enrollment.map(async (e) => {
          const course = await this.collections.courses.findOne({
            code: e.course.code,
            term: e.course.term,
          });
          return course;
        }),
      )
    ).filter((c) => c !== null);
    return enrollment;
  }

  async updateSections(
    courseId: CourseId,
    sections: Course["sections"],
  ): Promise<void> {
    const result = await this.collections.courses.updateOne(courseId, {
      $set: { sections },
    });
    if (result.modifiedCount === 0) {
      throw new Error(
        `Failed to update sections for course ${courseId.code} (${courseId.term})`,
      );
    }
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
