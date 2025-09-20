import type { User, UserId, Course, CourseId } from '../models'

export class MockDataGenerator {
  private courseCount = 0
  private userCount = 0

  makeNewUserId(): UserId {
    const newId = { email: `user${this.userCount.toString()}@test.com` }
    this.userCount += 1
    return newId
  }

  makeNewCourseId(): CourseId {
    const newId = { code: `COMP ${this.courseCount.toString()}`, term: '2510' }
    this.courseCount += 1
    return newId
  }

  makeNewUser(overrides?: Partial<User>): User {
    const userId = this.makeNewUserId()
    return {
      email: userId.email,
      name: `User ${userId.email}`,
      enrollment: [],
      ...overrides,
    }
  }

  makeNewCourse(overrides?: Partial<Course>): Course {
    const courseId = this.makeNewCourseId()
    return {
      code: courseId.code,
      term: courseId.term,
      title: `Course Title ${courseId.code}`,
      sections: ['L1', 'L2', 'T1', 'T2'],
      effectiveRequestTypes: {
        'Swap Section': true,
        'Deadline Extension': false,
      },
      ...overrides,
    }
  }
}
