import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test'
import { MockDataGenerator } from './mockData'
import { getTestConn, TestConn } from './testDb'

import type { Course } from '../models'
import { CourseService, CourseNotFound } from '../lib'

describe('CourseService', () => {
  let testConn: TestConn
  let mockDataGen: MockDataGenerator
  let courseService: CourseService

  let course: Course
  let courseId: { code: Course['code'], term: Course['term'] }

  beforeAll(async () => {
    testConn = await getTestConn()
    mockDataGen = new MockDataGenerator()
    const collections = await testConn.getCollections()
    courseService = new CourseService(collections)
  })

  afterAll(async () => {
    await testConn.close()
  })

  beforeEach(async () => {
    await testConn.clear()
    course = mockDataGen.makeNewCourse()
    courseId = { code: course.code, term: course.term }
  })

  describe('createCourse', () => {
    test('should create a course successfully', async () => {
      const result = await courseService.createCourse(course)
      expect(result.acknowledged).toBe(true)
      expect(result.insertedId).toBeDefined()
    })
  })

  describe('getCourse', () => {
    test('should get course by id', async () => {
      await courseService.createCourse(course)
      const foundCourse = await courseService.getCourse(courseId)
      expect(foundCourse).toEqual({ _id: foundCourse._id, ...course })
    })

    test('should throw error when course not found', async () => {
      // course not created in the database
      try {
        await courseService.getCourse(courseId)
        expect.unreachable('Should have thrown an error')
      }
      catch (error) {
        const errorMessage = CourseNotFound(course).message
        expect((error as Error).message).toBe(errorMessage)
      }
    })
  })

  describe('updateSections', () => {
    test('should update course sections successfully', async () => {
      await courseService.createCourse(course)
      const newSections = ['L1', 'L2', 'L3', 'T1', 'T2', 'T3']
      const result = await courseService.updateSections(course, newSections)
      expect(result.acknowledged).toBe(true)
      expect(result.modifiedCount).toBe(1)
      const updatedCourse = await courseService.getCourse(courseId)
      expect(updatedCourse.sections).toEqual(newSections)
    })
  })

  describe('setEffectiveRequestTypes', () => {
    test('should update effective request types successfully', async () => {
      await courseService.createCourse(course)
      const newRequestTypes = {
        'Swap Section': false,
        'Deadline Extension': true,
      }
      const result = await courseService.setEffectiveRequestTypes(courseId, newRequestTypes)
      expect(result.acknowledged).toBe(true)
      expect(result.modifiedCount).toBe(1)
      const updatedCourse = await courseService.getCourse(courseId)
      expect(updatedCourse.effectiveRequestTypes).toEqual(newRequestTypes)
    })
  })
})
