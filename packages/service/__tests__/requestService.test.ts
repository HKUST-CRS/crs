import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test'
import { ObjectId } from 'mongodb'
import { MockDataGenerator } from './mockData'
import { getTestConn, TestConn } from './testDb'

import { type User, type Course, Request, type Response, type SwapSectionRequest, type NoId } from '../models'
import {
  UserService,
  CourseService,
  RequestService,
  UserNotFound,
  CourseNotFound,
  RequestNotFound,
  RequestHasResponse,
} from '../lib'

describe('RequestService', () => {
  let testConn: TestConn
  let mockDataGen: MockDataGenerator
  let userService: UserService
  let courseService: CourseService
  let requestService: RequestService

  let studentInDb: User
  let instructorInDb: User
  let courseInDb: Course
  let request: NoId<SwapSectionRequest>

  beforeAll(async () => {
    testConn = await getTestConn()
    mockDataGen = new MockDataGenerator()
    const collections = await testConn.getCollections()
    userService = new UserService(collections)
    courseService = new CourseService(collections)
    requestService = new RequestService(collections)
  })

  afterAll(async () => {
    await testConn.close()
  })

  beforeEach(async () => {
    await testConn.clear()
    // add a mock student to the db for request tests
    studentInDb = mockDataGen.makeNewUser()
    await userService.createUser(studentInDb)
    // add a mock instructor to the db for request tests
    instructorInDb = mockDataGen.makeNewUser()
    await userService.createUser(instructorInDb)
    // add a mock course to the db for request tests
    courseInDb = mockDataGen.makeNewCourse()
    await courseService.createCourse(courseInDb)
    // register the student and instructor to the course
    await userService.updateEnrollment(studentInDb.email, [{
      role: 'student',
      sections: ['L1', 'T1'],
      code: courseInDb.code,
      term: courseInDb.term,
    }])
    await userService.updateEnrollment(studentInDb.email, [{
      role: 'instructor',
      sections: ['L1', 'T1'],
      code: courseInDb.code,
      term: courseInDb.term,
    }])
    // initialize request data
    request = {
      type: 'Swap Section',
      from: studentInDb.email,
      course: { code: courseInDb.code, term: courseInDb.term },
      details: {
        reason: 'Schedule conflict with another course',
        proof: [],
      },
      metadata: {
        fromSection: 'T1',
        fromDate: '2025-09-20',
        toSection: 'T2',
        toDate: '2025-09-20',
      },
      timestamp: new Date().toISOString(),
      response: null,
    }
  })

  describe('createRequest', () => {
    test('should create a swap section request successfully', async () => {
      await requestService.createRequest(request)
    })

    test('should throw error when user not found', async () => {
      const invalidRequest = { ...request, from: 'dne@test.com' }
      try {
        await requestService.createRequest(invalidRequest)
        expect.unreachable('Should have thrown an error')
      }
      catch (error) {
        const errorMessage = UserNotFound(invalidRequest.from).message
        expect((error as Error).message).toBe(errorMessage)
      }
    })

    test('should throw error when course not found', async () => {
      const invalidRequest = {
        ...request,
        course: { code: 'DNE1010', term: '2025-2026 Term 1' },
      }
      try {
        await requestService.createRequest(invalidRequest)
        expect.unreachable('Should have thrown an error')
      }
      catch (error) {
        const errorMessage = CourseNotFound(invalidRequest.course).message
        expect((error as Error).message).toBe(errorMessage)
      }
    })
  })

  describe('getRequest', () => {
    test('should get request by id', async () => {
      const id = await requestService.createRequest(request)
      const foundRequest = await requestService.getRequest(id)
      expect(foundRequest).toEqual(Request.parse({ id, ...request }))
    })

    test('should throw error when request not found', async () => {
      const fakeId = new ObjectId()
      try {
        await requestService.getRequest(fakeId.toHexString())
        expect.unreachable('Should have thrown an error')
      }
      catch (error) {
        const errorMessage = RequestNotFound(fakeId).message
        expect((error as Error).message).toBe(errorMessage)
      }
    })
  })

  describe('addResponse', () => {
    let response: Response

    beforeEach(() => {
      response = {
        from: instructorInDb.email,
        timestamp: new Date().toISOString(),
        decision: 'Approve',
        remarks: 'Request approved',
      }
    })

    test('should add response to request successfully', async () => {
      const id = await requestService.createRequest(request)
      await requestService.addResponse(id, response)
    })

    test('should throw error when responder not found', async () => {
      const id = await requestService.createRequest(request)
      const invalidResponse = { ...response, from: 'dne@test.com' }
      try {
        await requestService.addResponse(id, invalidResponse)
        expect.unreachable('Should have thrown an error')
      }
      catch (error) {
        const errorMessage = UserNotFound(invalidResponse.from).message
        expect((error as Error).message).toBe(errorMessage)
      }
    })

    test('should throw error when request not found', async () => {
      const fakeId = new ObjectId()
      try {
        await requestService.addResponse(fakeId.toHexString(), response)
        expect.unreachable('Should have thrown an error')
      }
      catch (error) {
        expect((error as Error).message).toBe(RequestNotFound(fakeId).message)
      }
    })

    test('should throw error and preserve original response when request already has response', async () => {
      const id = await requestService.createRequest(request)
      await requestService.addResponse(id, response)
      const secondResponse: Response = {
        ...response,
        decision: 'Reject',
      }
      try {
        await requestService.addResponse(id, secondResponse)
        expect.unreachable('Should have thrown an error')
      }
      catch (error) {
        expect((error as Error).message).toBe(RequestHasResponse(new ObjectId(id)).message)
      }
      const requestInDb = await requestService.getRequest(id)
      expect(requestInDb.response).toEqual(response)
    })
  })
})
