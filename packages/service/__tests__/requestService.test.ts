import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import type { DbConn } from "../db";
import { ResponseAlreadyExistsError } from "../functions/error";
import { RequestService } from "../lib";
import { ClassPermissionError } from "../lib/error";
import * as testData from "./testData";
import { createTestConn } from "./testDb";

describe("RequestService", () => {
  let testConn: DbConn;
  let requestService: RequestService;

  beforeAll(async () => {
    testConn = await createTestConn();
    requestService = new RequestService(testConn.collections);
  });

  afterAll(async () => {
    await testConn.close();
  });

  describe("createRequest", () => {
    test("should create and get a request successfully", async () => {
      const student = testData.students[0];
      const request = { ...testData.requestInit };
      const id = await requestService
        .withAuth(student.email)
        .createRequest(request);
      const requestInDb = await requestService
        .withAuth(student.email)
        .getRequest(id);
      expect(requestInDb).toBeDefined();
    });

    test("should throw permission error when user is not in the class", async () => {
      const student = testData.students[1];
      const request = { ...testData.requestInit };
      try {
        await requestService.withAuth(student.email).createRequest(request);
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
        .withAuth(student.email)
        .createRequest(request);
    });

    test("should allow requester to get their own request", async () => {
      const student = testData.students[0];
      const request = await requestService
        .withAuth(student.email)
        .getRequest(requestId);
      expect(request).toBeDefined();
    });

    test("should allow TAs to get requests in their class", async () => {
      const ta = testData.tas[0];
      const request = await requestService
        .withAuth(ta.email)
        .getRequest(requestId);
      expect(request).toBeDefined();
    });

    test("should allow instructors to get requests in their class", async () => {
      const instructor = testData.instructors[0];
      const request = await requestService
        .withAuth(instructor.email)
        .getRequest(requestId);
      expect(request).toBeDefined();
    });

    test("should throw permission error when user is neither requester nor instructor/TA", async () => {
      const student = testData.students[1];
      try {
        await requestService.withAuth(student.email).getRequest(requestId);
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
      await requestService.withAuth(student.email).createRequest(request);
    });

    test("should get requests as student", async () => {
      const student = testData.students[0];
      const requests = await requestService
        .withAuth(student.email)
        .getRequestsAs("student");
      expect(requests.length).toEqual(1);
    });

    test("should get requests as ta", async () => {
      const ta = testData.tas[0];
      const requests = await requestService
        .withAuth(ta.email)
        .getRequestsAs("ta");
      expect(requests.length).toEqual(1);
    });

    test("should get requests as instructor", async () => {
      const instructor = testData.instructors[0];
      const requests = await requestService
        .withAuth(instructor.email)
        .getRequestsAs("instructor");
      expect(requests.length).toEqual(1);
    });

    test("students should not get other students' requests", async () => {
      const student = testData.students[2];
      const requests = await requestService
        .withAuth(student.email)
        .getRequestsAs("student");
      expect(requests.length).toEqual(0);
    });

    test("TAs should not get other classes' requests", async () => {
      const ta = testData.tas[1];
      const requests = await requestService
        .withAuth(ta.email)
        .getRequestsAs("ta");
      expect(requests.length).toEqual(0);
    });

    test("instructors should not get other classes' requests", async () => {
      const instructor = testData.instructors[1];
      const requests = await requestService
        .withAuth(instructor.email)
        .getRequestsAs("instructor");
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
        .withAuth(student.email)
        .createRequest(request);
    });

    test("should add response to request successfully", async () => {
      const instructor = testData.instructors[0];
      const response = testData.responseInit;
      await requestService
        .withAuth(instructor.email)
        .createResponse(requestId, response);
      const requestInDb = await requestService
        .withAuth(instructor.email)
        .getRequest(requestId);
      expect(requestInDb.response).toMatchObject(response);
    });

    test("should throw error and preserve original response if there is one", async () => {
      const instructor = testData.instructors[0];
      const response = testData.responseInit;
      await requestService
        .withAuth(instructor.email)
        .createResponse(requestId, response);
      try {
        await requestService
          .withAuth(instructor.email)
          .createResponse(requestId, {
            ...response,
            decision: "Reject",
          });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ResponseAlreadyExistsError);
      }
      const request = await requestService
        .withAuth(instructor.email)
        .getRequest(requestId);
      expect(request.response).toMatchObject(response);
    });

    test("should throw permission error when responder is not instructor of the class", async () => {
      const student = testData.students[0];
      const response = { ...testData.responseInit };
      try {
        await requestService
          .withAuth(student.email)
          .createResponse(requestId, response);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });
});
