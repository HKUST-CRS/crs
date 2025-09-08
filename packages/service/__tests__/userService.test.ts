import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { connectTestDB, closeTestDB, clearTestDB } from "../lib/testDb";
import { UserService } from "../lib/userService";

describe("UserService", () => {
  let userService: UserService;

  beforeAll(async () => {
    await connectTestDB();
    userService = new UserService();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  test("should create a user", async () => {
    const userData = {
      id: "test123",
      name: "Test User",
      email: "test@example.com",
    };

    const user = await userService.createUser(userData);

    expect(user.id).toBe(userData.id);
    expect(user.name).toBe(userData.name);
    expect(user.email).toBe(userData.email);
  });

  test("should find user by id", async () => {
    const userData = {
      id: "test123",
      name: "Test User",
      email: "test@example.com",
    };

    await userService.createUser(userData);
    const foundUser = await userService.findUserById("test123");

    expect(foundUser).toBeTruthy();
    expect(foundUser?.id).toBe("test123");
  });

  test("should find user by email", async () => {
    const userData = {
      id: "test123",
      name: "Test User",
      email: "test@example.com",
    };

    await userService.createUser(userData);
    const foundUser = await userService.findUserByEmail("test@example.com");

    expect(foundUser).toBeTruthy();
    expect(foundUser?.email).toBe("test@example.com");
  });

  test("should update user", async () => {
    const userData = {
      id: "test123",
      name: "Test User",
      email: "test@example.com",
    };

    await userService.createUser(userData);
    const updatedUser = await userService.updateUser("test123", {
      name: "Updated Name",
    });

    expect(updatedUser?.name).toBe("Updated Name");
    expect(updatedUser?.email).toBe("test@example.com");
  });

  test("should delete user", async () => {
    const userData = {
      id: "test123",
      name: "Test User",
      email: "test@example.com",
    };

    await userService.createUser(userData);
    const deleted = await userService.deleteUser("test123");

    expect(deleted).toBe(true);

    const foundUser = await userService.findUserById("test123");
    expect(foundUser).toBeNull();
  });

  test("should validate email format", async () => {
    const userData = {
      id: "test123",
      name: "Test User",
      email: "invalid-email",
    };

    await expect(userService.createUser(userData)).rejects.toThrow();
  });

  test("should validate name not empty", async () => {
    const userData = {
      id: "test123",
      name: "",
      email: "test@example.com",
    };

    await expect(userService.createUser(userData)).rejects.toThrow();
  });
});
