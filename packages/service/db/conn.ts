import * as dotenv from "dotenv";
import { type Collection, MongoClient } from "mongodb";
import type { Course, Request, User } from "../models";

export interface Collections {
  users: Collection<User>;
  courses: Collection<Course>;
  requests: Collection<Request>;
}

export interface DbConn {
  collections: Collections;
  close(): Promise<void>;
}

class DbConnection implements DbConn {
  private client: MongoClient;
  collections: Collections;

  constructor(client: MongoClient, collections: Collections) {
    this.client = client;
    this.collections = collections;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

async function createIndexes(collections: Collections): Promise<void> {
  await Promise.all([
    collections.users.createIndex({ email: 1 }, { unique: true }),
    collections.courses.createIndex({ code: 1, term: 1 }, { unique: true }),
    collections.requests.createIndex({ createdAt: -1 }),
  ]);
}

export async function createDbConn(uri: string): Promise<DbConn> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collections = {
    users: db.collection<User>("users"),
    courses: db.collection<Course>("courses"),
    requests: db.collection<Request>("requests"),
  };
  await createIndexes(collections);
  return new DbConnection(client, collections);
}

export async function createDbConnFromEnv(envPath?: string): Promise<DbConn> {
  if (envPath) {
    dotenv.config({ path: envPath });
  }
  const dbConnString = Bun.env.MONGO_URI;
  if (!dbConnString) {
    throw new Error("Missing MONGO_URI environment variable");
  }
  return createDbConn(dbConnString);
}
