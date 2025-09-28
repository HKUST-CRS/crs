import type { Course, CourseId, User, UserId } from "../models";

export class MockDataGenerator {
  private courseCount = 0;
  private userCount = 0;

  makeNewUserId(): UserId {
    const newId = `user${this.userCount.toString()}@test.com`;
    this.userCount += 1;
    return newId;
  }

  makeNewCourseId(): CourseId {
    const newId = { code: `COMP ${this.courseCount.toString()}`, term: "2510" };
    this.courseCount += 1;
    return newId;
  }

  makeNewUser(overrides?: Partial<User>): User {
    const userId = this.makeNewUserId();
    return {
      email: userId,
      name: `User ${userId}`,
      enrollment: [],
      ...overrides,
    };
  }

  makeNewCourse(overrides?: Partial<Course>): Course {
    const courseId = this.makeNewCourseId();
    return {
      code: courseId.code,
      term: courseId.term,
      title: `Course Title ${courseId.code}`,
      sections: [
        { code: "L1", schedule: [{ day: 1, from: "10:30", to: "12:00" }] },
        { code: "L2", schedule: [{ day: 2, from: "10:30", to: "12:00" }] },
        { code: "T1", schedule: [{ day: 3, from: "14:00", to: "15:00" }] },
        { code: "T2", schedule: [{ day: 3, from: "14:00", to: "15:00" }] },
      ],
      effectiveRequestTypes: {
        "Swap Section": true,
        "Deadline Extension": false,
      },
      assignments: [],
      ...overrides,
    };
  }
}
