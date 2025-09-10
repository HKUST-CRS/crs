import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { getTestConn, TestConn } from "./testDb";
import { CourseService } from "../lib/courseService";

describe("CourseService", () => {
  let testConn: TestConn;
  let courseService: CourseService;

  beforeAll(async () => {
    testConn = await getTestConn();
    const collections = await testConn.getCollections();
    courseService = new CourseService(collections);
  });

  afterAll(async () => {
    await testConn.close();
  });

  beforeEach(async () => {
    await testConn.clear();
  });

  const courseData = {
    code: "COMP1023",
    semester: "2510",
    title: "Introduction to Python Programming",
    people: {},
    requestTypesEnabled: {
      "Swap Section": false,
      "Deadline Extension": false,
    },
  };

  test("should create a course", async () => {
    await courseService.createCourse(courseData);
  });

  test("should get course by id", async () => {
    await courseService.createCourse(courseData);
    const foundCourse = await courseService.getCourse({
      code: "COMP1023",
      semester: "2510",
    });

    expect(foundCourse).toBeTruthy();
    expect(foundCourse?.code).toBe(courseData.code);
    expect(foundCourse?.semester).toBe(courseData.semester);
    expect(foundCourse?.title).toBe(courseData.title);
  });

  test.todo("should add person to course", async () => {});

  test.todo("should remove person from course", async () => {});

  test.todo("should check access of user", async () => {});

  test.todo("should enable request type", async () => {});

  test.todo("should enforce unique course per semester", async () => {});
});
