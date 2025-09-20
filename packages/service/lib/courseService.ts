import type { WithId, InsertOneResult, UpdateResult } from 'mongodb'
import type { Collections } from '../db'
import type { Course, CourseId, Request } from '../models'

export class CourseService {
  private collections: Collections
  constructor(collection: Collections) {
    this.collections = collection
  }

  async createCourse(data: Course): Promise<InsertOneResult<Course>> {
    return await this.collections.courses.insertOne(data)
  }

  async getCourse(courseId: CourseId): Promise<WithId<Course>> {
    const course = await this.collections.courses.findOne(courseId)
    if (!course) throw new Error(`Course ${courseId.code} (${courseId.term}) not found`)
    return course
  }

  async updateSections(courseId: CourseId, sections: Course['sections']): Promise<UpdateResult<Course>> {
    return await this.collections.courses.updateOne(courseId, { $set: { sections } })
  }

  async setEffectiveRequestTypes(
    courseId: CourseId,
    effectiveRequestTypes: Course['effectiveRequestTypes'],
  ): Promise<UpdateResult<Course>> {
    return await this.collections.courses.updateOne(courseId, {
      $set: { effectiveRequestTypes },
    })
  }

  async getCourseRequests(courseId: CourseId): Promise<WithId<Request>[]> {
    return await this.collections.requests
      .find({
        'course.code': courseId.code,
        'course.term': courseId.term,
      })
      .toArray()
  }
}
