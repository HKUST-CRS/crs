import type { ObjectId, InsertOneResult, UpdateResult, WithId } from 'mongodb'
import type { Collections } from '../db'
import { Request, type Response } from '../models'
import { CourseNotFound, RequestNotFound, RequestHasResponse, UserNotFound } from './util'

export class RequestService {
  private collections: Collections
  constructor(collection: Collections) {
    this.collections = collection
  }

  async createRequest(data: Request): Promise<InsertOneResult<Request>> {
    const user = await this.collections.users.findOne({ email: data.from })
    if (!user) throw UserNotFound(data.from)
    const course = await this.collections.courses.findOne({
      code: data.course.code,
      term: data.course.term,
    })
    if (!course) throw CourseNotFound(data.course)
    return await this.collections.requests.insertOne(data)
  }

  async getRequest(requestId: ObjectId): Promise<WithId<Request>> {
    const request = await this.collections.requests.findOne({ _id: requestId })
    if (!request) throw RequestNotFound(requestId)
    return request
  }

  async addResponse(requestId: ObjectId, response: Response): Promise<UpdateResult<Request>> {
    const user = await this.collections.users.findOne({ email: response.from })
    if (!user) throw UserNotFound(response.from)
    const request = await this.collections.requests.findOne({ _id: requestId })
    if (!request) throw RequestNotFound(requestId)
    if (request.response) throw RequestHasResponse(requestId)
    return await this.collections.requests.updateOne(
      { _id: requestId },
      { $set: { response } },
    )
  }
}
