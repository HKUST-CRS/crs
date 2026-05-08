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
import type { Course, RequestInit, ResponseInit, User } from "../models";
import { createRepos } from "../repos";
import {
  RequestNotFoundError,
  ResponseAlreadyExistsError,
} from "../repos/error";
import { RequestService } from "../services";
import { ClassPermissionError } from "../services/error";
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(requestInit);

      const requestResult = await requestService
        .auth(student.email)
        .getRequest(requestID);
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(request);
      const requestResult = await requestService
        .auth(observer.email)
        .getRequest(requestID);
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(request);
      const requestResult = await requestService
        .auth(instructor.email)
        .getRequest(requestID);
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(requestInit);

      try {
        await requestService.auth(admin.email).getRequest(requestID);
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
      const requestID = await requestService
        .auth(requester.email)
        .createRequest(request);

      try {
        await requestService.auth(otherStudent.email).getRequest(requestID);
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

  describe("request list projections", () => {
    test("should get request heads as student", async () => {
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(request);

      const requestHeads = await requestService
        .auth(student.email)
        .getRequestHeadsAs(["student"]);

      expect(requestHeads).toHaveLength(1);
      expect(requestHeads.map((requestHead) => requestHead.id)).toEqual([
        requestID,
      ]);
    });

    test("should get request heads as observer", async () => {
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(request);

      const requestHeads = await requestService
        .auth(observer.email)
        .getRequestHeadsAs(["observer"]);

      expect(requestHeads).toHaveLength(1);
      expect(requestHeads.map((requestHead) => requestHead.id)).toEqual([
        requestID,
      ]);
    });

    test("should get request heads as instructor", async () => {
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(request);

      const requestHeads = await requestService
        .auth(instructor.email)
        .getRequestHeadsAs(["instructor"]);

      expect(requestHeads).toHaveLength(1);
      expect(requestHeads.map((requestHead) => requestHead.id)).toEqual([
        requestID,
      ]);
    });

    test("students should not get other students' request heads", async () => {
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

      const requestHeads = await requestService
        .auth(otherStudent.email)
        .getRequestHeadsAs(["student"]);

      expect(requestHeads).toHaveLength(0);
    });

    test("observers should not get other classes' request heads", async () => {
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

      const requestHeads = await requestService
        .auth(observer.email)
        .getRequestHeadsAs(["observer"]);

      expect(requestHeads).toHaveLength(0);
    });

    test("instructors should not get other classes' request heads", async () => {
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

      const requestHeads = await requestService
        .auth(instructor.email)
        .getRequestHeadsAs(["instructor"]);

      expect(requestHeads).toHaveLength(0);
    });

    test("admins should get no request heads", async () => {
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
      await requestService.auth(student.email).createRequest(request);

      const requestHeads = await requestService
        .auth(admin.email)
        .getRequestHeadsAs(["admin"]);

      expect(requestHeads).toHaveLength(0);
    });

    test("should return empty request heads when no roles are provided", async () => {
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
      await requestService.auth(student.email).createRequest(request);

      const requestHeads = await requestService
        .auth(student.email)
        .getRequestHeadsAs([]);

      expect(requestHeads).toHaveLength(0);
    });

    test("should merge request heads across student and instructor roles", async () => {
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

      const requestFromDualID = await requestService
        .auth(dualRoleUser.email)
        .createRequest(requestFromDual);
      const requestFromOtherID = await requestService
        .auth(otherStudent.email)
        .createRequest(requestFromOther);

      const requestHeads = await requestService
        .auth(dualRoleUser.email)
        .getRequestHeadsAs(["student", "instructor"]);

      expect(requestHeads).toHaveLength(2);
      expect(requestHeads.map((requestHead) => requestHead.id)).toEqual(
        expect.arrayContaining([requestFromDualID, requestFromOtherID]),
      );
    });

    test("should get all request heads in course if instructor section is *", async () => {
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

      const req1ID = await requestService
        .auth(student1.email)
        .createRequest(req1);
      const req2ID = await requestService
        .auth(student2.email)
        .createRequest(req2);

      const requestHeads = await requestService
        .auth(instructor.email)
        .getRequestHeadsAs(["instructor"]);

      expect(requestHeads).toHaveLength(2);
      expect(requestHeads.map((requestHead) => requestHead.id)).toEqual(
        expect.arrayContaining([req1ID, req2ID]),
      );
    });

    test("should omit details and metadata when getting request heads", async () => {
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
        email: "student-head@connect.ust.hk",
        name: "student-head",
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
        email: "instructor-head@ust.hk",
        name: "instructor-head",
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
        details: {
          reason: "Need to swap sections",
          proof: [
            {
              name: "proof.txt",
              size: 7,
              content: "cHJvb2YtMQ==",
            },
          ],
        },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };

      const requestID = await requestService
        .auth(student.email)
        .createRequest(request);

      const requestHeads = await requestService
        .auth(instructor.email)
        .getRequestHeadsAs(["instructor"]);

      expect(requestHeads).toHaveLength(1);
      expect(requestHeads[0]).toMatchObject({
        id: requestID,
        from: student.email,
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        type: "Swap Section",
        response: null,
      });
      expect(requestHeads[0]).not.toHaveProperty("details");
      expect(requestHeads[0]).not.toHaveProperty("metadata");
    });

    test("should return requests by ID in requested order with proof", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {
          A1: {
            name: "Assignment 1",
            due: "2025-11-28T23:59:00+08:00",
            maxExtension: "P7D",
          },
        },
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student-export@connect.ust.hk",
        name: "student-export",
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
        email: "instructor-export@ust.hk",
        name: "instructor-export",
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

      const swapRequest: RequestInit = {
        type: "Swap Section",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: {
          reason: "Need to swap sections",
          proof: [
            {
              name: "swap-proof.txt",
              size: 7,
              content: "cHJvb2YtMQ==",
            },
          ],
        },
        metadata: {
          fromSection: "L1",
          fromDate: "2025-11-25",
          toSection: "L2",
          toDate: "2025-11-26",
        },
      };
      const deadlineRequest: RequestInit = {
        type: "Deadline Extension",
        class: {
          course: { code: course.code, term: course.term },
          section: "L1",
        },
        details: {
          reason: "Need more time",
          proof: [
            {
              name: "deadline-proof.txt",
              size: 7,
              content: "cHJvb2YtMg==",
            },
          ],
        },
        metadata: {
          assignment: "A1",
          deadline: "2025-11-30T23:59:00+08:00",
        },
      };

      const swapRequestID = await requestService
        .auth(student.email)
        .createRequest(swapRequest);
      const deadlineRequestID = await requestService
        .auth(student.email)
        .createRequest(deadlineRequest);

      const requestsByID = await requestService
        .auth(instructor.email)
        .getRequestsByID([deadlineRequestID, swapRequestID]);
      const firstRequest = requestsByID[0];
      const secondRequest = requestsByID[1];
      if (firstRequest === undefined || secondRequest === undefined) {
        throw new Error("expected two requests");
      }

      expect(requestsByID.map((request) => request.id)).toEqual([
        deadlineRequestID,
        swapRequestID,
      ]);
      expect(firstRequest).toHaveProperty("metadata");
      expect(firstRequest.details).toEqual({
        reason: "Need more time",
        proof: [
          {
            name: "deadline-proof.txt",
            size: 7,
            content: "cHJvb2YtMg==",
          },
        ],
      });
      expect(secondRequest).toHaveProperty("metadata");
      expect(secondRequest.details).toEqual({
        reason: "Need to swap sections",
        proof: [
          {
            name: "swap-proof.txt",
            size: 7,
            content: "cHJvb2YtMQ==",
          },
        ],
      });
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(requestInit);

      const response: ResponseInit = { decision: "Approve", remarks: "^^" };
      await requestService
        .auth(instructor.email)
        .createResponse(requestID, response);
      const requestInDb = await requestService
        .auth(instructor.email)
        .getRequest(requestID);
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(request);

      const response: ResponseInit = { decision: "Approve", remarks: "^^" };
      await requestService
        .auth(instructor.email)
        .createResponse(requestID, response);
      try {
        await requestService.auth(instructor.email).createResponse(requestID, {
          ...response,
          decision: "Reject",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ResponseAlreadyExistsError);
      }
      const requestInDb = await requestService
        .auth(instructor.email)
        .getRequest(requestID);
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(request);

      const response: ResponseInit = { decision: "Approve", remarks: "^^" };
      try {
        await requestService
          .auth(student.email)
          .createResponse(requestID, response);
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
      const requestID = await requestService
        .auth(student.email)
        .createRequest(requestInit);

      const response: ResponseInit = { decision: "Approve", remarks: "^^" };
      try {
        await requestService
          .auth(admin.email)
          .createResponse(requestID, response);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });
});
