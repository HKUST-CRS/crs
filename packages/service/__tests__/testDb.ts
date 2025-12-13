import { MongoMemoryServer } from "mongodb-memory-server";
import { createDbConn, type DbConn } from "../db";
import { courses, instructors, students, tas } from "./testData";

class TestDb implements DbConn {
  private memoryServer: MongoMemoryServer;
  private conn: DbConn;

  constructor(memoryServer: MongoMemoryServer, conn: DbConn) {
    this.memoryServer = memoryServer;
    this.conn = conn;
  }

  async close() {
    await this.conn.close();
    await this.memoryServer.stop();
  }

  get collections() {
    return this.conn.collections;
  }
}

export async function createTestConn(): Promise<DbConn> {
  const memoryServer = await MongoMemoryServer.create();
  const conn = await createDbConn(memoryServer.getUri());
  await conn.collections.users.insertMany([
    ...students,
    ...tas,
    ...instructors,
  ]);
  await conn.collections.courses.insertMany(courses);
  return new TestDb(memoryServer, conn);
}
