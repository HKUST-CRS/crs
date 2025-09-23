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
      await courseService.createCourse(course)
    })
  })

  describe('getCourse', () => {
    test('should get course by id', async () => {
      await courseService.createCourse(course)
      const foundCourse = await courseService.getCourse(courseId)
      expect(foundCourse).toEqual(course)
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
      const newSections = [
        { code: 'L1', schedule: [{ day: 1, from: '09:00', to: '10:30' }] },
        { code: 'LA1', schedule: [{ day: 4, from: '13:00', to: '15:00' }] },
      ]
      await courseService.updateSections(course, newSections)
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
      await courseService.setEffectiveRequestTypes(courseId, newRequestTypes)
      const updatedCourse = await courseService.getCourse(courseId)
      expect(updatedCourse.effectiveRequestTypes).toEqual(newRequestTypes)
    })
  })
})
