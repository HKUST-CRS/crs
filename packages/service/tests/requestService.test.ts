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
import type { Course, Request, RequestInit, User } from "../models";
import { createRepos } from "../repos";
import { RequestNotFoundError, StatusConflictError } from "../repos/error";
import { RequestService } from "../services";
import { ClassPermissionError, PermissionError } from "../services/error";
import { clearData, insertData } from "./tests";

const baseCourse: Course = {
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

function makeUser(
  email: string,
  role: "student" | "instructor" | "observer",
  section = "L1",
): User {
  return {
    email,
    name: email.split("@")[0] ?? email,
    enrollment: [
      {
        role,
        course: { code: baseCourse.code, term: baseCourse.term },
        section,
      },
    ],
    sudoer: false,
  };
}

function makeSwapInit(section = "L1"): RequestInit {
  return {
    type: "Swap Section",
    class: {
      course: { code: baseCourse.code, term: baseCourse.term },
      section,
    },
    details: { reason: ">.<", proof: [] },
    metadata: {
      fromSection: "L1",
      fromDate: "2025-11-25",
      toSection: "L2",
      toDate: "2025-11-26",
    },
  };
}
const sampleProof = [
  {
    name: "note.txt",
    size: 2,
    content: Buffer.from("hi").toString("base64"),
  },
];

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

  describe("addComment", () => {
    test("student can comment on an open request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService
        .auth(student.email)
        .addComment(id, { text: "more info" });
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.updates).toHaveLength(1);
      expect(r.updates.at(0)?.kind).toBe("comment");
      expect(r.status).toBe("open");
    });

    test("instructor can comment on an open request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService
        .auth(instructor.email)
        .addComment(id, { text: "noted" });
      const r = await requestService.auth(instructor.email).getRequest(id);
      expect(r.updates.at(0)?.kind).toBe("comment");
    });

    test("observer can comment", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const observer = makeUser("o1@ust.hk", "observer");
      await insertData(testConn, {
        users: [student, observer],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService
        .auth(observer.email)
        .addComment(id, { text: "observing" });
      const r = await requestService.auth(observer.email).getRequest(id);
      expect(r.updates.at(0)?.kind).toBe("comment");
    });

    test("comment can be added to a resolved request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).respond(id, {
        decision: "Reject",
        remarks: "no",
      });
      await requestService
        .auth(student.email)
        .addComment(id, { text: "please reconsider" });
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.status).toBe("resolved");
      expect(r.updates.at(-1)?.kind).toBe("comment");
    });

    test("non-participant cannot comment", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const other = makeUser("s2@connect.ust.hk", "student", "L2");
      await insertData(testConn, {
        users: [student, other],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(other.email).addComment(id, { text: "hi" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("comment on a cancelled request throws", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).cancelRequest(id);
      try {
        await requestService.auth(student.email).addComment(id, { text: "hi" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
    });
    test("comment proof round-trips through getRequest", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).addComment(id, {
        text: "see attached",
        proof: sampleProof,
      });
      const r = await requestService.auth(student.email).getRequest(id);
      const entry = r.updates.at(-1);
      expect(entry?.kind).toBe("comment");
      if (entry?.kind === "comment") expect(entry.proof).toEqual(sampleProof);
    });
  });

  describe("respond", () => {
    test("instructor can respond to an open request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).respond(id, {
        decision: "Approve",
        remarks: "ok",
      });
      const r = await requestService.auth(instructor.email).getRequest(id);
      expect(r.status).toBe("resolved");
      expect(r.response?.decision).toBe("Approve");
      expect(r.updates.at(-1)?.kind).toBe("response");
    });

    test("student cannot respond", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(student.email).respond(id, {
          decision: "Approve",
          remarks: "",
        });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("observer cannot respond", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const observer = makeUser("o1@ust.hk", "observer");
      await insertData(testConn, {
        users: [student, observer],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(observer.email).respond(id, {
          decision: "Approve",
          remarks: "",
        });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("respond on a resolved request throws", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).respond(id, {
        decision: "Approve",
        remarks: "",
      });
      try {
        await requestService.auth(instructor.email).respond(id, {
          decision: "Reject",
          remarks: "",
        });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
    });

    test("respond on a cancelled request throws", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).cancelRequest(id);
      try {
        await requestService.auth(instructor.email).respond(id, {
          decision: "Approve",
          remarks: "",
        });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
    });

    test("admins should not be able to respond", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [
          {
            role: "admin",
            course: { code: baseCourse.code, term: baseCourse.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, {
        users: [student, admin],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(admin.email).respond(id, {
          decision: "Approve",
          remarks: "^^",
        });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("a conflicting respond preserves the original response", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).respond(id, {
        decision: "Approve",
        remarks: "first",
      });
      try {
        await requestService.auth(instructor.email).respond(id, {
          decision: "Reject",
          remarks: "second",
        });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
      const r = await requestService.auth(instructor.email).getRequest(id);
      expect(r.response?.decision).toBe("Approve");
      expect(r.response?.remarks).toBe("first");
      expect(r.status).toBe("resolved");
    });
  });

  describe("cancelRequest", () => {
    test("student can cancel an open request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).cancelRequest(id, "done");
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.status).toBe("cancelled");
      expect(r.updates.at(-1)?.kind).toBe("cancel");
    });

    test("instructor cannot cancel", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(instructor.email).cancelRequest(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
      }
    });

    test("cancel on a resolved request throws", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).respond(id, {
        decision: "Approve",
        remarks: "",
      });
      try {
        await requestService.auth(student.email).cancelRequest(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
    });
  });

  describe("appealRequest", () => {
    test("student can appeal a resolved request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).respond(id, {
        decision: "Reject",
        remarks: "no",
      });
      await requestService
        .auth(student.email)
        .appealRequest(id, { text: "please reconsider" });
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.status).toBe("open");
      expect(r.updates.at(-1)?.kind).toBe("appeal");
    });

    test("instructor cannot appeal", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).respond(id, {
        decision: "Reject",
        remarks: "no",
      });
      try {
        await requestService
          .auth(instructor.email)
          .appealRequest(id, { text: "no" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
      }
    });

    test("appeal on an open request throws", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService
          .auth(student.email)
          .appealRequest(id, { text: "no" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
    });
    test("appeal proof round-trips through getRequest", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).respond(id, {
        decision: "Reject",
        remarks: "no",
      });
      await requestService
        .auth(student.email)
        .appealRequest(id, { text: "please reconsider", proof: sampleProof });
      const r = await requestService.auth(student.email).getRequest(id);
      const entry = r.updates.at(-1);
      expect(entry?.kind).toBe("appeal");
      if (entry?.kind === "appeal") expect(entry.proof).toEqual(sampleProof);
    });
  });

  describe("appeal cycle", () => {
    test("respond, appeal, respond again updates the latest response", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());

      await requestService.auth(instructor.email).respond(id, {
        decision: "Reject",
        remarks: "first",
      });
      await requestService
        .auth(student.email)
        .appealRequest(id, { text: "reconsider" });
      await requestService.auth(instructor.email).respond(id, {
        decision: "Approve",
        remarks: "second",
      });

      const r = await requestService.auth(instructor.email).getRequest(id);
      expect(r.status).toBe("resolved");
      expect(r.response?.decision).toBe("Approve");
      expect(r.response?.remarks).toBe("second");
      const kinds = r.updates.map((u) => u.kind);
      expect(kinds).toEqual(["response", "appeal", "response"]);
    });
  });

  describe("immutability", () => {
    test("thread actions never mutate the request body", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      const original = await requestService.auth(student.email).getRequest(id);

      await requestService.auth(student.email).addComment(id, { text: "c" });
      await requestService.auth(instructor.email).respond(id, {
        decision: "Reject",
        remarks: "r",
      });
      await requestService.auth(student.email).appealRequest(id, { text: "a" });
      await requestService.auth(student.email).cancelRequest(id);

      const after = await requestService.auth(student.email).getRequest(id);
      expect(after.from).toBe(original.from);
      expect(after.class).toEqual(original.class);
      expect(after.type).toBe(original.type);
      expect(after.metadata).toEqual(original.metadata);
      expect(after.details).toEqual(original.details);
      expect(after.timestamp).toBe(original.timestamp);
    });
  });

  describe("legacy document tolerance", () => {
    test("legacy doc without status/updates is normalized on read", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const legacyOpen: Request[] = [
        {
          id: "legacy-open",
          from: student.email,
          class: {
            course: { code: baseCourse.code, term: baseCourse.term },
            section: "L1",
          },
          type: "Swap Section",
          metadata: {
            fromSection: "L1",
            fromDate: "2025-11-25",
            toSection: "L2",
            toDate: "2025-11-26",
          },
          details: { reason: "legacy", proof: [] },
          timestamp: "2025-01-01T00:00:00+08:00",
          response: null,
        } as unknown as Request,
      ];
      await insertData(testConn, { requests: legacyOpen });

      const r = await requestService
        .auth(student.email)
        .getRequest("legacy-open");
      expect(r.status).toBe("open");
      expect(r.updates).toEqual([]);
    });

    test("legacy doc with a response is inferred as resolved", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const legacyResolved: Request[] = [
        {
          id: "legacy-resolved",
          from: student.email,
          class: {
            course: { code: baseCourse.code, term: baseCourse.term },
            section: "L1",
          },
          type: "Swap Section",
          metadata: {
            fromSection: "L1",
            fromDate: "2025-11-25",
            toSection: "L2",
            toDate: "2025-11-26",
          },
          details: { reason: "legacy", proof: [] },
          timestamp: "2025-01-01T00:00:00+08:00",
          response: {
            from: "i1@ust.hk",
            timestamp: "2025-01-02T00:00:00+08:00",
            remarks: "ok",
            decision: "Approve",
          },
        } as unknown as Request,
      ];
      await insertData(testConn, { requests: legacyResolved });

      const r = await requestService
        .auth(student.email)
        .getRequest("legacy-resolved");
      expect(r.status).toBe("resolved");
      expect(r.updates).toEqual([]);
    });

    test("legacy request heads are normalized", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const legacyHead: Request[] = [
        {
          id: "legacy-head",
          from: student.email,
          class: {
            course: { code: baseCourse.code, term: baseCourse.term },
            section: "L1",
          },
          type: "Swap Section",
          metadata: {
            fromSection: "L1",
            fromDate: "2025-11-25",
            toSection: "L2",
            toDate: "2025-11-26",
          },
          details: { reason: "legacy", proof: [] },
          timestamp: "2025-01-01T00:00:00+08:00",
          response: null,
        } as unknown as Request,
      ];
      await insertData(testConn, { requests: legacyHead });

      const heads = await requestService
        .auth(student.email)
        .getRequestHeadsAs(["student"]);
      expect(heads).toHaveLength(1);
      expect(heads.at(0)?.status).toBe("open");
      expect(heads.at(0)).not.toHaveProperty("updates");
    });

    test("an un-backfilled open request can be responded to", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      await insertData(testConn, {
        requests: [
          {
            id: "legacy-respond",
            from: student.email,
            class: {
              course: { code: baseCourse.code, term: baseCourse.term },
              section: "L1",
            },
            type: "Swap Section",
            metadata: {
              fromSection: "L1",
              fromDate: "2025-11-25",
              toSection: "L2",
              toDate: "2025-11-26",
            },
            details: { reason: "legacy", proof: [] },
            timestamp: "2025-01-01T00:00:00+08:00",
            response: null,
          } as unknown as Request,
        ],
      });

      await requestService.auth(instructor.email).respond("legacy-respond", {
        decision: "Approve",
        remarks: "ok",
      });
      const r = await requestService
        .auth(instructor.email)
        .getRequest("legacy-respond");
      expect(r.status).toBe("resolved");
      expect(r.response?.decision).toBe("Approve");
      expect(r.updates.at(0)?.kind).toBe("response");
    });

    test("an un-backfilled resolved request can be appealed", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      await insertData(testConn, {
        requests: [
          {
            id: "legacy-appeal",
            from: student.email,
            class: {
              course: { code: baseCourse.code, term: baseCourse.term },
              section: "L1",
            },
            type: "Swap Section",
            metadata: {
              fromSection: "L1",
              fromDate: "2025-11-25",
              toSection: "L2",
              toDate: "2025-11-26",
            },
            details: { reason: "legacy", proof: [] },
            timestamp: "2025-01-01T00:00:00+08:00",
            response: {
              from: "i1@ust.hk",
              timestamp: "2025-01-02T00:00:00+08:00",
              remarks: "no",
              decision: "Reject",
            },
          } as unknown as Request,
        ],
      });

      await requestService
        .auth(student.email)
        .appealRequest("legacy-appeal", { text: "reconsider" });
      const r = await requestService
        .auth(student.email)
        .getRequest("legacy-appeal");
      expect(r.status).toBe("open");
      expect(r.updates.at(0)?.kind).toBe("appeal");
    });
  });
});
