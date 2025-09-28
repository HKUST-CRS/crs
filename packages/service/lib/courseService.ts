import type { Collections } from "../db";
import { type Course, type CourseId, Request } from "../models";
import { CourseNotFound } from "./util";

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

  async getCourse(courseId: CourseId): Promise<Course> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw CourseNotFound(courseId);
    return course;
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
