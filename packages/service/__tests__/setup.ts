import { beforeAll } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";

beforeAll(
  async () => {
    const server = await MongoMemoryServer.create();
    await server.stop();
  },
  {
    timeout: 10 * 60 * 1000,
  },
);
