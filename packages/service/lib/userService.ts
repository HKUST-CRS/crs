import type { WithId } from 'mongodb'
import type { Collections } from '../db'
import type { Course, User, Request, Role } from '../models'

export class UserService {
  private collections: Collections
  constructor(collection: Collections) {
    this.collections = collection
  }

  async createUser(data: User): Promise<void> {
    await this.collections.users.insertOne(data)
  }

  async getUser(email: User['email']): Promise<User | null> {
    return await this.collections.users.findOne({ email })
  }

  async getUserCourses(email: User['email']): Promise<[Course, Role][]> {
    const courses = await this.collections.courses
      .find({ [`people.${email}`]: { $exists: true } })
      .toArray()
    return courses.map(course => [course, course.people[email]])
  }

  async getUserRequests(
    email: User['email'],
  ): Promise<WithId<Request>[] | null> {
    return await this.collections.requests
      .find({ studentEmail: email })
      .toArray()
  }
}
