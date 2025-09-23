import type { WithId, InsertOneResult, UpdateResult } from 'mongodb'
import type { Collections } from '../db'
import type { User, UserId, Request } from '../models'
import { CourseNotFound, UserNotFound, SectionNotFound } from './util'

export class UserService {
  private collections: Collections
  constructor(collection: Collections) {
    this.collections = collection
  }

  async createUser(data: User): Promise<InsertOneResult<User>> {
    return await this.collections.users.insertOne(data)
  }

  async getUser(userId: UserId): Promise<WithId<User>> {
    const user = await this.collections.users.findOne({ email: userId })
    if (!user) throw UserNotFound(userId)
    return user
  }

  async updateEnrollment(userId: UserId, enrollment: User['enrollment']): Promise<UpdateResult<User>> {
    for (const inputCourse of enrollment) {
      const course = await this.collections.courses.findOne({
        code: inputCourse.code,
        term: inputCourse.term,
      })
      if (!course) throw CourseNotFound(inputCourse)
      for (const inputSection of inputCourse.sections) {
        if (!course.sections.map(course => course.code).includes(inputSection)) {
          throw SectionNotFound(inputCourse, inputSection)
        }
      }
    }
    return await this.collections.users.updateOne(
      { email: userId },
      { $set: { enrollment } },
    )
  }

  async getUserRequests(userId: UserId): Promise<WithId<Request>[]> {
    return await this.collections.requests
      .find({ from: userId })
      .toArray()
  }
}
