import type { Collections } from "../db";
import type { Course, CourseID, Role, User } from "../models";
import { sortRecord } from "../utils/comparison";
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

  async requireCourse(courseID: CourseID): Promise<Course> {
    const course = await this.collections.courses.findOne(courseID);
    if (!course) throw new CourseNotFoundError(courseID);
    return course;
  }

  async getCourses(): Promise<Course[]> {
    return await this.collections.courses
      .find()
      .sort({ code: "ascending", term: "ascending" })
      .collation({ locale: "en", numericOrdering: true })
      .toArray();
  }

  async getCoursesFromEnrollment(user: User, roles: Role[]): Promise<Course[]> {
    const courseIDs = user.enrollment
      .filter((e) => roles.includes(e.role))
      .map((e) => ({
        code: e.course.code,
        term: e.course.term,
      }));
    // MongoDB throws an error when $or receives an empty array
    if (courseIDs.length === 0) {
      return [];
    }
    return await this.collections.courses
      .find({
        // TODO: This $or query is unsafe. This silently fails if a course is
        // not found in the database instead of throwing an error. We should
        // verify that all courseIDs exist.
        $or: courseIDs.map((id) => ({ code: id.code, term: id.term })),
      })
      .sort({ code: "ascending", term: "ascending" })
      .collation({ locale: "en", numericOrdering: true })
      .toArray();
  }

  async updateSections(
    courseID: CourseID,
    sections: Course["sections"],
  ): Promise<void> {
    sections = sortRecord(sections);
    await this.collections.courses.updateOne(
      // cannot use courseID directly, in case of extra fields
      { code: courseID.code, term: courseID.term },
      {
        $set: { sections },
      },
    );
  }

  async updateAssignments(
    courseID: CourseID,
    assignments: Course["assignments"],
  ): Promise<void> {
    assignments = sortRecord(assignments);
    await this.collections.courses.updateOne(
      // cannot use courseID directly, in case of extra fields
      { code: courseID.code, term: courseID.term },
      {
        $set: { assignments },
      },
    );
  }

  async updateEffectiveRequestTypes(
    courseID: CourseID,
    effectiveRequestTypes: Course["effectiveRequestTypes"],
  ): Promise<void> {
    await this.collections.courses.updateOne(
      // cannot use courseID directly, in case of extra fields
      { code: courseID.code, term: courseID.term },
      {
        $set: { effectiveRequestTypes },
      },
    );
  }
}
