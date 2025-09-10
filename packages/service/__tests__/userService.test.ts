import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test'
import { getTestConn, TestConn } from './testDb'
import { UserService } from '../lib/userService'

describe('UserService', () => {
  let testConn: TestConn
  let userService: UserService

  beforeAll(async () => {
    testConn = await getTestConn()
    const collections = await testConn.getCollections()
    userService = new UserService(collections)
  })

  afterAll(async () => {
    await testConn.close()
  })

  beforeEach(async () => {
    await testConn.clear()
  })

  test.todo('should create a user', async () => {})

  test.todo('should find user by email', async () => {})

  test.todo('should get courses by user', async () => {})

  test.todo('should get requests by user', async () => {})
})
