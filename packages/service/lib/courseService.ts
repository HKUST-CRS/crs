import type { WithId } from "mongodb";
import type { Collections } from "../db";
import type { Course, CourseId, User, Request } from "../models";

export class CourseService {
  private collections: Collections;
  constructor(collection: Collections) {
    this.collections = collection;
  }

  async createCourse(data: Course): Promise<void> {
    await this.collections.courses.insertOne(data);
  }

  async getCourse(id: CourseId): Promise<Course | null> {
    return await this.collections.courses.findOne(id);
  }

  async addPeople(courseId: CourseId, people: Course["people"]): Promise<void> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw new Error("Course not found"); // TODO: 404?
    const updatedPeople = { ...course.people, ...people }; // TODO: verify people exist?
    await this.collections.courses.updateOne(courseId, {
      $set: { people: updatedPeople },
    });
  }

  async removePeople(
    courseId: CourseId,
    people: User["email"][]
  ): Promise<void> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw new Error("Course not found");
    const updatedPeople = { ...course.people };
    for (const email of people) {
      delete updatedPeople[email];
    }
    await this.collections.courses.updateOne(courseId, {
      $set: { people: updatedPeople },
    });
  }

  async checkAccess(
    courseId: CourseId,
    userEmail: User["email"],
    role: Course["people"][string]
  ): Promise<boolean> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) return false;
    const actualRole = course.people[userEmail];
    if (!actualRole) return false;
    return actualRole === role;
  }

  async setEnabledRequestTypes(
    courseId: CourseId,
    requestTypesEnabled: Partial<Course["requestTypesEnabled"]>
  ): Promise<void> {
    const course = await this.collections.courses.findOne(courseId);
    if (!course) throw new Error("Course not found");
    const updatedRequestTypesEnabled = {
      ...course.requestTypesEnabled,
      ...requestTypesEnabled,
    };
    await this.collections.courses.updateOne(courseId, {
      $set: { requestTypesEnabled: updatedRequestTypesEnabled },
    });
  }

  async getCourseRequests(courseId: CourseId): Promise<WithId<Request>[]> {
    return await this.collections.requests
      .find({
        "courseId.code": courseId.code,
        "courseId.semester": courseId.semester,
      })
      .toArray();
  }
}
