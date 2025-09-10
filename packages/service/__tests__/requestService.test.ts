import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { getTestConn, TestConn } from "./testDb";
import { RequestService } from "../lib/requestService";

describe("RequestService", () => {
  let testConn: TestConn;
  let requestService: RequestService;

  beforeAll(async () => {
    testConn = await getTestConn();
    const collections = await testConn.getCollections();
    requestService = new RequestService(collections);
  });

  afterAll(async () => {
    await testConn.close();
  });

  beforeEach(async () => {
    await testConn.clear();
  });

  test.todo("should create swap section request", async () => {});

  test.todo("should create deadline extension request", async () => {});

  test.todo("should add response", async () => {});
});
