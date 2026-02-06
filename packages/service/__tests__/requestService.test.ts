import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { DbConn } from "../db";
import { RequestService } from "../lib";
import { ClassPermissionError } from "../lib/error";
import type { Course, RequestInit, ResponseInit, User } from "../models";
import { createRepos } from "../repos";
import {
  RequestNotFoundError,
  ResponseAlreadyExistsError,
} from "../repos/error";
import { clearData, insertData } from "./tests";

describe("RequestService", () => {
  let testConn: DbConn;
  let memoryServer: MongoMemoryReplSet;
  let requestService: RequestService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { storageEngine: "wiredTiger" },
    });
    testConn = await DbConn.create(memoryServer.getUri());
    requestService = new RequestService(createRepos(testConn.collections));
  });

  afterAll(async () => {
    await testConn.close();
    await memoryServer.stop();
  });

  beforeEach(async () => {
    await clearData(testConn);
  });

  afterEach(async () => {
    await clearData(testConn);
  });

  describe("createRequest", () => {
    test("should create and get a request successfully", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };

      const id = await requestService
        .auth(student.email)
        .createRequest(request);
      const requestInDb = await requestService
        .auth(student.email)
        .getRequest(id);
      expect(requestInDb).toBeDefined();
    });

    test("should throw permission error when user is not in the class", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L2",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      try {
        await requestService.auth(student.email).createRequest(request);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("should throw permission error when user is instructor but not student", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [instructor] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };
      try {
        await requestService.auth(instructor.email).createRequest(request);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });

  describe("getRequest", () => {
    test("should allow requester to get their own request", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student] });

      const requestInit: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(student.email)
        .createRequest(requestInit);

      const requestResult = await requestService
        .auth(student.email)
        .getRequest(requestId);
      expect(requestResult).toBeDefined();
    });

    test("should allow observers to get requests in their class", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const observer: User = {
        email: "observer1@connect.ust.hk",
        name: "observer1",
        enrollment: [
          {
            role: "observer",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, observer] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(student.email)
        .createRequest(request);
      const requestResult = await requestService
        .auth(observer.email)
        .getRequest(requestId);
      expect(requestResult).toBeDefined();
    });

    test("should allow instructors to get requests in their class", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, instructor] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(student.email)
        .createRequest(request);
      const requestResult = await requestService
        .auth(instructor.email)
        .getRequest(requestId);
      expect(requestResult).toBeDefined();
    });

    test("admins should not be able to get requests in their class", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [
          {
            role: "admin",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, admin] });

      const requestInit: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(student.email)
        .createRequest(requestInit);

      try {
        await requestService.auth(admin.email).getRequest(requestId);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("should throw permission error when user is neither requester nor instructor/observer", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const requester: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const otherStudent: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L2",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [requester, otherStudent] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(requester.email)
        .createRequest(request);

      try {
        await requestService.auth(otherStudent.email).getRequest(requestId);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("should throw request not found when request does not exist", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student] });

      try {
        await requestService.auth(student.email).getRequest("REQ-NOT-FOUND");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(RequestNotFoundError);
      }
    });
  });

  describe("getRequestsAs", () => {
    test("should get requests as student", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      await requestService.auth(student.email).createRequest(request);

      const requests = await requestService
        .auth(student.email)
        .getRequestsAs(["student"]);
      expect(requests.length).toEqual(1);
    });

    test("should get requests as observer", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const observer: User = {
        email: "observer1@connect.ust.hk",
        name: "observer1",
        enrollment: [
          {
            role: "observer",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, observer] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      await requestService.auth(student.email).createRequest(request);

      const requests = await requestService
        .auth(observer.email)
        .getRequestsAs(["observer"]);
      expect(requests.length).toEqual(1);
    });

    test("should get requests as instructor", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, instructor] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      await requestService.auth(student.email).createRequest(request);

      const requests = await requestService
        .auth(instructor.email)
        .getRequestsAs(["instructor"]);
      expect(requests.length).toEqual(1);
    });

    test("students should not get other students' requests", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const requester: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const otherStudent: User = {
        email: "student3@connect.ust.hk",
        name: "student3",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [requester, otherStudent] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      await requestService.auth(requester.email).createRequest(request);

      const requests = await requestService
        .auth(otherStudent.email)
        .getRequestsAs(["student"]);
      expect(requests.length).toEqual(0);
    });

    test("observers should not get other classes' requests", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const requester: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const observer: User = {
        email: "observer2@connect.ust.hk",
        name: "observer2",
        enrollment: [
          {
            role: "observer",
            course: { code: course.code, term: course.term },
            section: "L2",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [requester, observer] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      await requestService.auth(requester.email).createRequest(request);

      const requests = await requestService
        .auth(observer.email)
        .getRequestsAs(["observer"]);
      expect(requests.length).toEqual(0);
    });

    test("instructors should not get other classes' requests", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const requester: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const instructor: User = {
        email: "instructor2@ust.hk",
        name: "instructor2",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L2",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [requester, instructor] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      await requestService.auth(requester.email).createRequest(request);

      const requests = await requestService
        .auth(instructor.email)
        .getRequestsAs(["instructor"]);
      expect(requests.length).toEqual(0);
    });

    test("admins should get no requests", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [
          {
            role: "admin",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, admin] });

      const requestInit: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };
      await requestService.auth(student.email).createRequest(requestInit);

      const requests = await requestService
        .auth(admin.email)
        .getRequestsAs(["admin"]);
      expect(requests.length).toEqual(0);
    });

    test("should return empty when no roles are provided", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student] });

      const requestInit: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };
      await requestService.auth(student.email).createRequest(requestInit);

      const requests = await requestService
        .auth(student.email)
        .getRequestsAs([]);
      expect(requests.length).toEqual(0);
    });

    test("should merge requests across student and instructor roles", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const dualRoleUser: User = {
        email: "dual@ust.hk",
        name: "dual",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L2",
          },
        ],
        sudoer: false,
      };
      const otherStudent: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L2",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [dualRoleUser, otherStudent] });

      const requestFromDual: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      const requestFromOther: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L2",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L2",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };

      await requestService
        .auth(dualRoleUser.email)
        .createRequest(requestFromDual);
      await requestService
        .auth(otherStudent.email)
        .createRequest(requestFromOther);

      const requests = await requestService
        .auth(dualRoleUser.email)
        .getRequestsAs(["student", "instructor"]);
      expect(requests.length).toEqual(2);
    });

    test("should get all requests in course if instructor section is *", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const instructor: User = {
        email: "instructor@ust.hk",
        name: "instructor",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "*",
          },
        ],
        sudoer: false,
      };
      const student1: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const student2: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L2",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [instructor, student1, student2] });

      const req1: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: "1", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };

      const req2: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L2",
        },
        details: { reason: "2", proof: [] },
        metadata: {
          fromSection: "L2",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };

      await requestService.auth(student1.email).createRequest(req1);
      await requestService.auth(student2.email).createRequest(req2);

      const requests = await requestService
        .auth(instructor.email)
        .getRequestsAs(["instructor"]);

      expect(requests.length).toEqual(2);
    });
  });

  describe("createResponse", () => {
    test("should add response to request successfully", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, instructor] });

      const requestInit: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(student.email)
        .createRequest(requestInit);

      const response: ResponseInit = { decision: "Approve", remarks: "^^" };
      await requestService
        .auth(instructor.email)
        .createResponse(requestId, response);
      const requestInDb = await requestService
        .auth(instructor.email)
        .getRequest(requestId);
      expect(requestInDb.response).toMatchObject(response);
    });

    test("should throw error and preserve original response if there is one", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, instructor] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(student.email)
        .createRequest(request);

      const response: ResponseInit = { decision: "Approve", remarks: "^^" };
      await requestService
        .auth(instructor.email)
        .createResponse(requestId, response);
      try {
        await requestService.auth(instructor.email).createResponse(requestId, {
          ...response,
          decision: "Reject",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ResponseAlreadyExistsError);
      }
      const requestInDb = await requestService
        .auth(instructor.email)
        .getRequest(requestId);
      expect(requestInDb.response).toMatchObject(response);
    });

    test("should throw permission error when responder is not instructor of the class", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, instructor] });

      const request: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(student.email)
        .createRequest(request);

      const response: ResponseInit = { decision: "Approve", remarks: "^^" };
      try {
        await requestService
          .auth(student.email)
          .createResponse(requestId, response);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("admins should not be able to create responses", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [
          {
            role: "admin",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, { users: [student, admin] });

      const requestInit: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: { reason: ">.<", proof: [] },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L1",
          toDate: "2025-11-26",
        },
      };
      const requestId = await requestService
        .auth(student.email)
        .createRequest(requestInit);

      const response: ResponseInit = { decision: "Approve", remarks: "^^" };
      try {
        await requestService
          .auth(admin.email)
          .createResponse(requestId, response);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });
});
