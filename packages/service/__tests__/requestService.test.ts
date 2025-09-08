import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { connectTestDB, closeTestDB, clearTestDB } from "../lib/testDb";
import { RequestService } from "../lib/requestService";
import { REQUEST_TYPES } from "../models/requests/types";

describe("RequestService", () => {
  let requestService: RequestService;

  beforeAll(async () => {
    await connectTestDB();
    requestService = new RequestService();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  test("should create swap section request", async () => {
    const requestData = {
      studentId: "student123",
      courseId: { code: "COMP1023", semester: "2510" },
      metadata: {
        fromSection: "LA1",
        fromDate: new Date("2025-09-10"),
        toSection: "LA2",
        toDate: new Date("2025-09-12"),
      },
      details: {
        reason: "Schedule conflict",
        proof: [],
      },
    };

    const request = await requestService.createSwapSectionRequest(requestData);

    expect(request.type).toBe(REQUEST_TYPES.SWAP_SECTION);
    expect(request.studentId).toBe("student123");
    expect(request.metadata.fromSection).toBe("LA1");
    expect(request.metadata.toSection).toBe("LA2");
  });

  test("should create deadline extension request", async () => {
    const requestData = {
      studentId: "student123",
      courseId: { code: "COMP1023", semester: "2510" },
      metadata: {
        assignmentName: "Assignment 1",
        requestedDeadline: new Date("2025-09-20"),
      },
      details: {
        reason: "Medical emergency",
        proof: [],
      },
    };

    const request = await requestService.createDeadlineExtensionRequest(
      requestData
    );

    expect(request.type).toBe(REQUEST_TYPES.DEADLINE_EXTENSION);
    expect(request.studentId).toBe("student123");
    expect(request.metadata.assignmentName).toBe("Assignment 1");
  });

  test("should find request by id", async () => {
    const requestData = {
      studentId: "student123",
      courseId: { code: "COMP1023", semester: "2510" },
      metadata: {
        fromSection: "LA1",
        fromDate: new Date("2025-09-10"),
        toSection: "LA2",
        toDate: new Date("2025-09-12"),
      },
      details: {
        reason: "Schedule conflict",
        proof: [],
      },
    };

    const request = await requestService.createSwapSectionRequest(requestData);
    const foundRequest = await requestService.findRequestById(
      (request as any)._id.toString()
    );

    expect(foundRequest).toBeTruthy();
    expect(foundRequest?.studentId).toBe("student123");
  });

  test("should get requests by student", async () => {
    const requestData1 = {
      studentId: "student123",
      courseId: { code: "COMP1023", semester: "2510" },
      metadata: {
        fromSection: "LA1",
        fromDate: new Date("2025-09-10"),
        toSection: "LA2",
        toDate: new Date("2025-09-12"),
      },
      details: {
        reason: "Schedule conflict",
        proof: [],
      },
    };

    const requestData2 = {
      studentId: "student123",
      courseId: { code: "COMP2021", semester: "2510" },
      metadata: {
        assignmentName: "Assignment 1",
        requestedDeadline: new Date("2025-09-20"),
      },
      details: {
        reason: "Medical emergency",
        proof: [],
      },
    };

    await requestService.createSwapSectionRequest(requestData1);
    await requestService.createDeadlineExtensionRequest(requestData2);

    const studentRequests = await requestService.getRequestsByStudent(
      "student123"
    );

    expect(studentRequests).toHaveLength(2);
  });

  test("should get pending requests", async () => {
    const requestData = {
      studentId: "student123",
      courseId: { code: "COMP1023", semester: "2510" },
      metadata: {
        fromSection: "LA1",
        fromDate: new Date("2025-09-10"),
        toSection: "LA2",
        toDate: new Date("2025-09-12"),
      },
      details: {
        reason: "Schedule conflict",
        proof: [],
      },
    };

    await requestService.createSwapSectionRequest(requestData);
    const pendingRequests = await requestService.getPendingRequests();

    expect(pendingRequests).toHaveLength(1);
    expect(pendingRequests[0]?.response).toBeNull();
  });

  test("should respond to request", async () => {
    const requestData = {
      studentId: "student123",
      courseId: { code: "COMP1023", semester: "2510" },
      metadata: {
        fromSection: "LA1",
        fromDate: new Date("2025-09-10"),
        toSection: "LA2",
        toDate: new Date("2025-09-12"),
      },
      details: {
        reason: "Schedule conflict",
        proof: [],
      },
    };

    const request = await requestService.createSwapSectionRequest(requestData);
    const respondedRequest = await requestService.respondToRequest(
      (request as any)._id.toString(),
      {
        instructorId: "instructor123",
        approved: true,
        remark: "Approved",
      }
    );

    expect(respondedRequest?.response).toBeTruthy();
    expect(respondedRequest?.response?.approved).toBe(true);
    expect(respondedRequest?.response?.instructorId).toBe("instructor123");
  });

  test("should get requests by type", async () => {
    const swapRequestData = {
      studentId: "student123",
      courseId: { code: "COMP1023", semester: "2510" },
      metadata: {
        fromSection: "LA1",
        fromDate: new Date("2025-09-10"),
        toSection: "LA2",
        toDate: new Date("2025-09-12"),
      },
      details: {
        reason: "Schedule conflict",
        proof: [],
      },
    };

    const extensionRequestData = {
      studentId: "student123",
      courseId: { code: "COMP2021", semester: "2510" },
      metadata: {
        assignmentName: "Assignment 1",
        requestedDeadline: new Date("2025-09-20"),
      },
      details: {
        reason: "Medical emergency",
        proof: [],
      },
    };

    await requestService.createSwapSectionRequest(swapRequestData);
    await requestService.createDeadlineExtensionRequest(extensionRequestData);

    const swapRequests = await requestService.getRequestsByType(
      REQUEST_TYPES.SWAP_SECTION
    );
    const extensionRequests = await requestService.getRequestsByType(
      REQUEST_TYPES.DEADLINE_EXTENSION
    );

    expect(swapRequests).toHaveLength(1);
    expect(extensionRequests).toHaveLength(1);
    expect(swapRequests[0]?.type).toBe(REQUEST_TYPES.SWAP_SECTION);
    expect(extensionRequests[0]?.type).toBe(REQUEST_TYPES.DEADLINE_EXTENSION);
  });
});
