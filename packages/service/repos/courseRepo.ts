import type { Collections } from "../db";
import {
  type Course,
  type CourseId,
  Courses,
  type Role,
  type User,
} from "../models";
import { CourseNotFoundError } from "./error";

export class CourseRepo {
  constructor(protected collections: Collections) {}

  /**
   * Creates a new course.
   *
   * @param course The course to create.
   */
  async createCourse(course: Course): Promise<void> {
    await this.collections.courses.insertOne(course);
  }

  async requireCourse(courseId: CourseId): Promise<Course> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw new CourseNotFoundError(courseId);
    return course;
  }

  async getCourses(): Promise<Course[]> {
    const courses = await this.collections.courses.find({}).toArray();
    return courses.sort(Courses.compare);
  }

  async getCoursesFromEnrollment(user: User, roles: Role[]): Promise<Course[]> {
    const courseIds = user.enrollment
      .filter((e) => roles.includes(e.role))
      .map((e) => ({
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
      .toArray()
      .then((courses) => courses.sort(Courses.compare));
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

  async updateEffectiveRequestTypes(
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
    await this.collections.courses.updateOne(
      // cannot use courseId directly, in case of extra fields
      { code: courseId.code, term: courseId.term },
      {
        $set: { assignments },
      },
    );
  }
}
