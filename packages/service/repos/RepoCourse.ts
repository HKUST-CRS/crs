import type { Collections } from "../db";
import {
  Course,
  type CourseID,
  type Role,
  type User,
  type UserID,
} from "../models";
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
    return Course.parse(course);
  }

  async getCourses(): Promise<Course[]> {
    const courses = await this.collections.courses
      .find()
      .sort({ code: "ascending", term: "ascending" })
      .collation({ locale: "en", numericOrdering: true })
      .toArray();
    return courses.map((course) => Course.parse(course));
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
    const courses = await this.collections.courses
      .find({
        // TODO: This $or query is unsafe. This silently fails if a course is
        // not found in the database instead of throwing an error. We should
        // verify that all courseIDs exist.
        $or: courseIDs.map((id) => ({ code: id.code, term: id.term })),
      })
      .sort({ code: "ascending", term: "ascending" })
      .collation({ locale: "en", numericOrdering: true })
      .toArray();
    return courses.map((course) => Course.parse(course));
  }

  async getCoursesWithExaminationTA(email: UserID): Promise<Course[]> {
    // ponytail: exam codes are dynamic keys, so this scans course catalogs;
    // add a derived indexed TA list only if catalog volume warrants it.
    const courses = await this.collections.courses
      .aggregate<Course>([
        {
          $addFields: {
            examinationEntries: {
              $objectToArray: { $ifNull: ["$examinations", {}] },
            },
          },
        },
        { $match: { "examinationEntries.v.questions.taId": email } },
        { $project: { examinationEntries: 0 } },
      ])
      .toArray();
    return courses.map((course) => Course.parse(course));
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

  async updateExaminations(
    courseID: CourseID,
    examinations: Course["examinations"],
  ): Promise<void> {
    await this.collections.courses.updateOne(
      { code: courseID.code, term: courseID.term },
      { $set: { examinations: sortRecord(examinations) } },
    );
  }
}
