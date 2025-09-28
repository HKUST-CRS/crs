import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { CourseService, RequestService, UserService } from "../lib";
import { MockDataGenerator } from "./mockData";
import { getTestConn, type TestConn } from "./testDb";

describe("RequestQuery", () => {
  let testConn: TestConn;
  let mockDataGen: MockDataGenerator;
  let userService: UserService;
  let courseService: CourseService;
  let requestService: RequestService;

  beforeAll(async () => {
    testConn = await getTestConn();
    mockDataGen = new MockDataGenerator();
    const collections = await testConn.getCollections();
    userService = new UserService(collections);
    courseService = new CourseService(collections);
    requestService = new RequestService(collections);
  });

  afterAll(async () => {
    await testConn.close();
  });

  beforeEach(async () => {
    await testConn.clear();
    // add mock students to the db for request tests
    const studentsInDb = [
      mockDataGen.makeNewUser({ email: "student0@connect.ust.hk" }),
      mockDataGen.makeNewUser({ email: "student1@connect.ust.hk" }),
      mockDataGen.makeNewUser({ email: "student2@connect.ust.hk" }),
    ];
    for (const student of studentsInDb) {
      await userService.createUser(student);
    }
    // add a mock course to the db for request tests
    const coursesInDb = [
      mockDataGen.makeNewCourse({ code: "COMP 1023", term: "2510" }),
      mockDataGen.makeNewCourse({ code: "COMP 2011", term: "2510" }),
      mockDataGen.makeNewCourse({ code: "COMP 2012", term: "2510" }),
    ];
    for (const course of coursesInDb) {
      await courseService.createCourse(course);
    }
    // register the students and instructors to the course
    await userService.updateEnrollment("student0@connect.ust.hk", [
      {
        role: "student",
        sections: ["L1"],
        code: "COMP 1023",
        term: "2510",
      },
    ]);
    await userService.updateEnrollment("student1@connect.ust.hk", [
      {
        role: "student",
        sections: ["L2"],
        code: "COMP 2011",
        term: "2510",
      },
    ]);
    await userService.updateEnrollment("student2@connect.ust.hk", [
      {
        role: "student",
        sections: ["L1"],
        code: "COMP 2011",
        term: "2510",
      },
    ]);
    // initialize request data
    await requestService.createRequest({
      type: "Swap Section",
      from: "student0@connect.ust.hk",
      course: { code: "COMP 1023", term: "2510" },
      details: {
        reason: "Request 1",
        proof: [],
      },
      metadata: {
        fromSection: "L1",
        fromDate: "2025-09-20",
        toSection: "L2",
        toDate: "2025-09-20",
      },
      timestamp: new Date().toISOString(),
      response: null,
    });
    await requestService.createRequest({
      type: "Swap Section",
      from: "student1@connect.ust.hk",
      course: { code: "COMP 2011", term: "2510" },
      details: {
        reason: "Request 2",
        proof: [],
      },
      metadata: {
        fromSection: "L2",
        fromDate: "2025-09-20",
        toSection: "L1",
        toDate: "2025-09-20",
      },
      timestamp: new Date().toISOString(),
      response: null,
    });
  });

  describe("getCourseRequests", () => {
    test("should return correct course requests", async () => {
      const requests = await courseService.getCourseRequests({
        code: "COMP 1023",
        term: "2510",
      });
      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request).toBeDefined();
      if (request) {
        expect(request.details.reason).toBe("Request 1");
      }
    });

    test("should return empty array when no requests exist", async () => {
      const requests = await courseService.getCourseRequests({
        code: "COMP 2012",
        term: "2510",
      });
      expect(requests).toHaveLength(0);
    });
  });

  describe("getUserRequests", () => {
    test("should return correct user requests", async () => {
      const requests = await userService.getUserRequests(
        "student0@connect.ust.hk",
      );
      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request).toBeDefined();
      if (request) {
        expect(request.details.reason).toBe("Request 1");
      }
    });

    test("should return empty array when no requests exist", async () => {
      const requests = await userService.getUserRequests(
        "student2@connect.ust.hk",
      );
      expect(requests).toHaveLength(0);
    });
  });
});
