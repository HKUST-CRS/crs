import type { WithId, InsertOneResult, UpdateResult } from 'mongodb'
import type { Collections } from '../db'
import type { User, UserId, Request } from '../models'

export class UserService {
  private collections: Collections
  constructor(collection: Collections) {
    this.collections = collection
  }

  async createUser(data: User): Promise<InsertOneResult<User>> {
    return await this.collections.users.insertOne(data)
  }

  async getUser(userId: UserId): Promise<WithId<User>> {
    const user = await this.collections.users.findOne(userId)
    if (!user) throw new Error(`User ${userId.email} not found`)
    return user
  }

  async updateEnrollment(userId: UserId, enrollment: User['enrollment']): Promise<UpdateResult<User>> {
    return await this.collections.users.updateOne(
      userId,
      { $set: { enrollment } },
    )
  }

  async getUserRequests(
    userId: UserId,
  ): Promise<WithId<Request>[] | null> {
    return await this.collections.requests
      .find({ from: userId })
      .toArray()
  }
}
