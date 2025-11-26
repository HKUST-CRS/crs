import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { DbConn } from "../db";
import { courses, instructors, students, tas } from "./testData";

export class TestConn extends DbConn {
  private memoryServer: MongoMemoryServer;

  constructor(client: MongoClient, mserver: MongoMemoryServer) {
    super(client);
    this.memoryServer = mserver;
  }

  override async close() {
    // wait for pending operations
    await this.db.admin().ping();
    await this.db.dropDatabase();
    await this.memoryServer.stop();
    await super.close();
  }

  static async create(): Promise<TestConn> {
    const memoryServer = await MongoMemoryServer.create();
    const client = new MongoClient(memoryServer.getUri());
    await client.connect();
    const conn = new TestConn(client, memoryServer);
    await conn.collections.users.insertMany([
      ...students,
      ...tas,
      ...instructors,
    ]);
    await conn.collections.courses.insertMany(courses);
    return conn;
  }
}
