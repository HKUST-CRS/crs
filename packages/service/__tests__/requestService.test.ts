import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import {
  ClassPermissionError,
  RequestService,
  ResponseAlreadyExistsError,
} from "../lib";
import * as testData from "./testData";
import { TestConn } from "./testDb";

describe("RequestService", () => {
  let testConn: TestConn;
  let requestService: RequestService;

  beforeAll(async () => {
    testConn = await TestConn.create();
    requestService = new RequestService(testConn.collections);
  });

  afterAll(async () => {
    await testConn.close();
  });

  describe("createRequest", () => {
    test("should create and get a request successfully", async () => {
      const student = testData.students[0];
      const request = { ...testData.requestInit, from: student.email };
      const id = await requestService.createRequest(student.email, request);
      const requestInDb = await requestService.getRequest(student.email, id);
      expect(requestInDb).toBeDefined();
    });

    test("should throw permission error when user is not in the class", async () => {
      const student = testData.students[1];
      const request = { ...testData.requestInit, from: student.email };
      try {
        await requestService.createRequest(student.email, request);
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
      const request = { ...testData.requestInit, from: student.email };
      await testConn.collections.requests.drop();
      requestId = await requestService.createRequest(student.email, request);
    });

    test("should allow requester to get their own request", async () => {
      const student = testData.students[0];
      const request = await requestService.getRequest(student.email, requestId);
      expect(request).toBeDefined();
    });

    test("should allow TAs to get requests in their class", async () => {
      const ta = testData.tas[0];
      const request = await requestService.getRequest(ta.email, requestId);
      expect(request).toBeDefined();
    });

    test("should allow instructors to get requests in their class", async () => {
      const instructor = testData.instructors[0];
      const request = await requestService.getRequest(
        instructor.email,
        requestId,
      );
      expect(request).toBeDefined();
    });

    test("should throw permission error when user is neither requester nor instructor/TA", async () => {
      const student = testData.students[1];
      try {
        await requestService.getRequest(student.email, requestId);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });

  describe("getRequestsAs", () => {
    beforeEach(async () => {
      const student = testData.students[0];
      const request = { ...testData.requestInit, from: student.email };
      await testConn.collections.requests.drop();
      await requestService.createRequest(student.email, request);
    });

    test("should get requests as student", async () => {
      const student = testData.students[0];
      const requests = await requestService.getRequestsAs(
        student.email,
        "student",
      );
      expect(requests.length).toEqual(1);
    });

    test("should get requests as ta", async () => {
      const ta = testData.tas[0];
      const requests = await requestService.getRequestsAs(ta.email, "ta");
      expect(requests.length).toEqual(1);
    });

    test("should get requests as instructor", async () => {
      const instructor = testData.instructors[0];
      const requests = await requestService.getRequestsAs(
        instructor.email,
        "instructor",
      );
      expect(requests.length).toEqual(1);
    });

    test("should not get uninvolved requests", async () => {
      const student = testData.students[1];
      const requests = await requestService.getRequestsAs(
        student.email,
        "student",
      );
      expect(requests.length).toEqual(0);
    });
  });

  describe("createResponse", () => {
    let requestId: string;

    beforeEach(async () => {
      const student = testData.students[0];
      const request = { ...testData.requestInit, from: student.email };
      await testConn.collections.requests.drop();
      requestId = await requestService.createRequest(student.email, request);
    });

    test("should add response to request successfully", async () => {
      const instructor = testData.instructors[0];
      const response = { ...testData.responseInit, from: instructor.email };
      await requestService.createResponse(
        instructor.email,
        requestId,
        response,
      );
      const requestInDb = await requestService.getRequest(
        instructor.email,
        requestId,
      );
      expect(requestInDb.response).toMatchObject(response);
    });

    test("should throw error and preserve original response if there is one", async () => {
      const instructor = testData.instructors[0];
      const response = { ...testData.responseInit, from: instructor.email };
      await requestService.createResponse(
        instructor.email,
        requestId,
        response,
      );
      try {
        await requestService.createResponse(instructor.email, requestId, {
          ...response,
          decision: "Reject",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ResponseAlreadyExistsError);
      }
      const request = await requestService.getRequest(
        instructor.email,
        requestId,
      );
      expect(request.response).toMatchObject(response);
    });

    test("should throw permission error when responder is not instructor of the class", async () => {
      const student = testData.students[0];
      const response = { ...testData.responseInit, from: student.email };
      try {
        await requestService.createResponse(student.email, requestId, response);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });
});
