import { CourseModel } from "../db/schemas/course";
import type { ICourse } from "../db/schemas/course";

export class CourseService {
  /**
   * Create a new course
   */
  async createCourse(courseData: {
    code: string;
    semester: string;
    title: string;
    people?: Map<string, "student" | "instructor" | "ta">;
    requestTypesEnabled?: Map<string, boolean>;
  }): Promise<ICourse> {
    const course = new CourseModel(courseData);
    return await course.save();
  }

  /**
   * Find a course by code and semester
   */
  async findCourseById(
    code: string,
    semester: string
  ): Promise<ICourse | null> {
    return await CourseModel.findOne({ code, semester });
  }

  /**
   * Update course information
   */
  async updateCourse(
    code: string,
    semester: string,
    updates: Partial<{
      title: string;
      people: Map<string, "student" | "instructor" | "ta">;
      requestTypesEnabled: Map<string, boolean>;
    }>
  ): Promise<ICourse | null> {
    return await CourseModel.findOneAndUpdate({ code, semester }, updates, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete a course
   */
  async deleteCourse(code: string, semester: string): Promise<boolean> {
    const result = await CourseModel.deleteOne({ code, semester });
    return result.deletedCount > 0;
  }

  /**
   * Add a person to a course with specified role
   */
  async addPersonToCourse(
    code: string,
    semester: string,
    userId: string,
    role: "student" | "instructor" | "ta"
  ): Promise<ICourse | null> {
    return await CourseModel.findOneAndUpdate(
      { code, semester },
      { $set: { [`people.${userId}`]: role } },
      { new: true }
    );
  }

  /**
   * Remove a person from a course
   */
  async removePersonFromCourse(
    code: string,
    semester: string,
    userId: string
  ): Promise<ICourse | null> {
    return await CourseModel.findOneAndUpdate(
      { code, semester },
      { $unset: { [`people.${userId}`]: "" } },
      { new: true }
    );
  }

  /**
   * Enable or disable a request type for a course
   */
  async enableRequestType(
    code: string,
    semester: string,
    requestType: string,
    enabled: boolean = true
  ): Promise<ICourse | null> {
    return await CourseModel.findOneAndUpdate(
      { code, semester },
      { $set: { [`requestTypesEnabled.${requestType}`]: enabled } },
      { new: true }
    );
  }

  /**
   * Get all courses where a user is enrolled/teaching
   */
  async getCoursesByUser(userId: string): Promise<ICourse[]> {
    return await CourseModel.find({
      [`people.${userId}`]: { $exists: true },
    });
  }
}
