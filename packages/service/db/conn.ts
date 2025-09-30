import * as dotenv from "dotenv";
import * as mongoDB from "mongodb";
import type { Course, Request, User } from "../models";

export interface Collections {
  users: mongoDB.Collection<User>;
  courses: mongoDB.Collection<Course>;
  requests: mongoDB.Collection<Request>;
}

export class DbConn {
  protected client: mongoDB.MongoClient;
  protected db: mongoDB.Db;

  collections: Collections;

  protected constructor(client: mongoDB.MongoClient) {
    this.client = client;
    this.db = client.db();
    this.collections = {
      users: this.db.collection<User>("users"),
      courses: this.db.collection<Course>("courses"),
      requests: this.db.collection<Request>("requests"),
    };

    this.collections.users.createIndex({ email: 1 }, { unique: true });
    this.collections.courses.createIndex(
      { code: 1, term: 1 },
      { unique: true },
    );
    this.collections.requests.createIndex({ createdAt: -1 });
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  static async fromEnv(envPath?: string): Promise<DbConn> {
    if (envPath) {
      dotenv.config({ path: envPath });
    }

    const dbConnString = Bun.env.MONGO_URI;
    if (!dbConnString) {
      throw new Error("Missing MONGO_URI environment variable");
    }

    const client = new mongoDB.MongoClient(dbConnString);
    await client.connect();

    return new DbConn(client);
  }
}
