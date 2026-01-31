import * as dotenv from "dotenv";
import { type ClientSession, type Collection, MongoClient } from "mongodb";
import type { Course, Request, User } from "../models";

export interface Collections {
  withTransaction: <T>(
    fn: (session: ClientSession) => Promise<T>,
  ) => Promise<T>;
  users: Collection<User>;
  courses: Collection<Course>;
  requests: Collection<Request>;
}

async function createIndexes(collections: Collections): Promise<void> {
  await Promise.all([
    collections.users.createIndex({ email: 1 }, { unique: true }),
    collections.courses.createIndex({ code: 1, term: 1 }, { unique: true }),
    collections.requests.createIndex({ timestamp: -1 }),
  ]);
}

export class DbConn {
  private client: MongoClient;
  collections!: Collections;

  private constructor(uri: string) {
    this.client = new MongoClient(uri);
  }

  private async init(): Promise<void> {
    await this.client.connect();
    const db = this.client.db();
    this.collections = {
      withTransaction: async <T>(
        fn: (session: ClientSession) => Promise<T>,
      ): Promise<T> => {
        const session = this.client.startSession();
        try {
          return await session.withTransaction(fn);
        } finally {
          await session.endSession();
        }
      },
      users: db.collection<User>("users"),
      courses: db.collection<Course>("courses"),
      requests: db.collection<Request>("requests"),
    };
    await createIndexes(this.collections);
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  static async create(uri: string): Promise<DbConn> {
    const conn = new DbConn(uri);
    await conn.init();
    return conn;
  }

  static async createFromEnv(envPath?: string): Promise<DbConn> {
    if (envPath) {
      dotenv.config({ path: envPath });
    }
    const dbConnString = Bun.env.MONGO_URI;
    if (!dbConnString) {
      throw new Error("Missing MONGO_URI environment variable");
    }
    return DbConn.create(dbConnString);
  }
}
