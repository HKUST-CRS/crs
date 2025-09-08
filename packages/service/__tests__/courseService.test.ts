import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { connectTestDB, closeTestDB, clearTestDB } from "../lib/testDb";
import { CourseService } from "../lib/courseService";

describe("CourseService", () => {
  let courseService: CourseService;

  beforeAll(async () => {
    await connectTestDB();
    courseService = new CourseService();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  test("should create a course", async () => {
    const courseData = {
      code: "COMP1023",
      semester: "2510",
      title: "Introduction to Computer Science",
    };

    const course = await courseService.createCourse(courseData);

    expect(course.code).toBe(courseData.code);
    expect(course.semester).toBe(courseData.semester);
    expect(course.title).toBe(courseData.title);
  });

  test("should find course by id", async () => {
    const courseData = {
      code: "COMP1023",
      semester: "2510",
      title: "Introduction to Computer Science",
    };

    await courseService.createCourse(courseData);
    const foundCourse = await courseService.findCourseById("COMP1023", "2510");

    expect(foundCourse).toBeTruthy();
    expect(foundCourse?.code).toBe("COMP1023");
    expect(foundCourse?.semester).toBe("2510");
  });

  test("should add person to course", async () => {
    const courseData = {
      code: "COMP1023",
      semester: "2510",
      title: "Introduction to Computer Science",
    };

    await courseService.createCourse(courseData);
    const updatedCourse = await courseService.addPersonToCourse(
      "COMP1023",
      "2510",
      "student123",
      "student"
    );

    expect(updatedCourse?.people.get("student123")).toBe("student");
  });

  test("should remove person from course", async () => {
    const courseData = {
      code: "COMP1023",
      semester: "2510",
      title: "Introduction to Computer Science",
    };

    await courseService.createCourse(courseData);
    await courseService.addPersonToCourse(
      "COMP1023",
      "2510",
      "student123",
      "student"
    );
    const updatedCourse = await courseService.removePersonFromCourse(
      "COMP1023",
      "2510",
      "student123"
    );

    expect(updatedCourse?.people.has("student123")).toBe(false);
  });

  test("should enable request type", async () => {
    const courseData = {
      code: "COMP1023",
      semester: "2510",
      title: "Introduction to Computer Science",
    };

    await courseService.createCourse(courseData);
    const updatedCourse = await courseService.enableRequestType(
      "COMP1023",
      "2510",
      "Swap Section",
      true
    );

    expect(updatedCourse?.requestTypesEnabled.get("Swap Section")).toBe(true);
  });

  test("should get courses by user", async () => {
    const courseData1 = {
      code: "COMP1023",
      semester: "2510",
      title: "Introduction to Computer Science",
    };

    const courseData2 = {
      code: "COMP2021",
      semester: "2510",
      title: "Object-Oriented Programming",
    };

    await courseService.createCourse(courseData1);
    await courseService.createCourse(courseData2);
    await courseService.addPersonToCourse(
      "COMP1023",
      "2510",
      "student123",
      "student"
    );
    await courseService.addPersonToCourse(
      "COMP2021",
      "2510",
      "student123",
      "student"
    );

    const userCourses = await courseService.getCoursesByUser("student123");

    expect(userCourses).toHaveLength(2);
  });

  test("should enforce unique course per semester", async () => {
    const courseData = {
      code: "COMP1023",
      semester: "2510",
      title: "Introduction to Computer Science",
    };

    await courseService.createCourse(courseData);

    await expect(courseService.createCourse(courseData)).rejects.toThrow();
  });
});
