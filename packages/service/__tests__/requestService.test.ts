import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { DbConn } from "../db";
import { RequestService } from "../lib";
import { ClassPermissionError } from "../lib/error";
import { createRepos } from "../repos";
import { ResponseAlreadyExistsError } from "../repos/error";
import * as testData from "./testData";
import { clearData, insertTestData } from "./testUtils";

describe("RequestService", () => {
  let testConn: DbConn;
  let memoryServer: MongoMemoryServer;
  let requestService: RequestService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    testConn = await DbConn.create(memoryServer.getUri());
    requestService = new RequestService(createRepos(testConn.collections));
  });

  afterAll(async () => {
    await testConn.close();
  });

  beforeEach(async () => {
    await insertTestData(testConn);
  });

  afterEach(async () => {
    await clearData(testConn);
  });

  describe("createRequest", () => {
    test("should create and get a request successfully", async () => {
      const student = testData.students[0];
      const request = { ...testData.requestInit };
      const id = await requestService
        .auth(student.email)
        .createRequest(request);
      const requestInDb = await requestService
        .auth(student.email)
        .getRequest(id);
      expect(requestInDb).toBeDefined();
    });

    test("should throw permission error when user is not in the class", async () => {
      const student = testData.students[1];
      const request = { ...testData.requestInit };
      try {
        await requestService.auth(student.email).createRequest(request);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });

  describe("getRequest", () => {
    let requestId: string;

    beforeEach(async () => {
      const student = testData.students[0];
      const request = testData.requestInit;
      await testConn.collections.requests.drop();
      requestId = await requestService
        .auth(student.email)
        .createRequest(request);
    });

    test("should allow requester to get their own request", async () => {
      const student = testData.students[0];
      const request = await requestService
        .auth(student.email)
        .getRequest(requestId);
      expect(request).toBeDefined();
    });

    test("should allow observers to get requests in their class", async () => {
      const observer = testData.tas[0];
      const request = await requestService
        .auth(observer.email)
        .getRequest(requestId);
      expect(request).toBeDefined();
    });

    test("should allow instructors to get requests in their class", async () => {
      const instructor = testData.instructors[0];
      const request = await requestService
        .auth(instructor.email)
        .getRequest(requestId);
      expect(request).toBeDefined();
    });

    test("should throw permission error when user is neither requester nor instructor/observer", async () => {
      const student = testData.students[1];
      try {
        await requestService.auth(student.email).getRequest(requestId);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });

  describe("getRequestsAs", () => {
    beforeEach(async () => {
      const student = testData.students[0];
      const request = testData.requestInit;
      await testConn.collections.requests.drop();
      await requestService.auth(student.email).createRequest(request);
    });

    test("should get requests as student", async () => {
      const student = testData.students[0];
      const requests = await requestService
        .auth(student.email)
        .getRequestsAs(["student"]);
      expect(requests.length).toEqual(1);
    });

    test("should get requests as observer", async () => {
      const observer = testData.tas[0];
      const requests = await requestService
        .auth(observer.email)
        .getRequestsAs(["observer"]);
      expect(requests.length).toEqual(1);
    });

    test("should get requests as instructor", async () => {
      const instructor = testData.instructors[0];
      const requests = await requestService
        .auth(instructor.email)
        .getRequestsAs(["instructor"]);
      expect(requests.length).toEqual(1);
    });

    test("students should not get other students' requests", async () => {
      const student = testData.students[2];
      const requests = await requestService
        .auth(student.email)
        .getRequestsAs(["student"]);
      expect(requests.length).toEqual(0);
    });

    test("observers should not get other classes' requests", async () => {
      const observer = testData.tas[1];
      const requests = await requestService
        .auth(observer.email)
        .getRequestsAs(["observer"]);
      expect(requests.length).toEqual(0);
    });

    test("instructors should not get other classes' requests", async () => {
      const instructor = testData.instructors[1];
      const requests = await requestService
        .auth(instructor.email)
        .getRequestsAs(["instructor"]);
      expect(requests.length).toEqual(0);
    });
  });

  describe("createResponse", () => {
    let requestId: string;

    beforeEach(async () => {
      const student = testData.students[0];
      const request = testData.requestInit;
      await testConn.collections.requests.drop();
      requestId = await requestService
        .auth(student.email)
        .createRequest(request);
    });

    test("should add response to request successfully", async () => {
      const instructor = testData.instructors[0];
      const response = testData.responseInit;
      await requestService
        .auth(instructor.email)
        .createResponse(requestId, response);
      const requestInDb = await requestService
        .auth(instructor.email)
        .getRequest(requestId);
      expect(requestInDb.response).toMatchObject(response);
    });

    test("should throw error and preserve original response if there is one", async () => {
      const instructor = testData.instructors[0];
      const response = testData.responseInit;
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
      const request = await requestService
        .auth(instructor.email)
        .getRequest(requestId);
      expect(request.response).toMatchObject(response);
    });

    test("should throw permission error when responder is not instructor of the class", async () => {
      const student = testData.students[0];
      const response = { ...testData.responseInit };
      try {
        await requestService
          .auth(student.email)
          .createResponse(requestId, response);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });
});
