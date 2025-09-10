import * as mongoDB from "mongodb";
import * as dotenv from "dotenv";
import type { User, Course, Request } from "../models";

export interface Collections {
  users: mongoDB.Collection<User>;
  courses: mongoDB.Collection<Course>;
  requests: mongoDB.Collection<Request>;
}

let collections: Collections | null = null;

export async function getCollections(): Promise<Readonly<Collections>> {
  if (!collections) {
    dotenv.config();

    const DB_CONN_STRING = Bun.env.DB_CONN_STRING;
    if (!DB_CONN_STRING) {
      throw new Error("Missing DB_CONN_STRING environment variable");
    }
    const client = new mongoDB.MongoClient(DB_CONN_STRING);

    await client.connect();

    const DB_NAME = Bun.env.DB_NAME;
    if (!DB_NAME) {
      throw new Error("Missing DB_NAME environment variable");
    }
    const db = client.db(DB_NAME);

    collections = {
      users: db.collection<User>("users"),
      courses: db.collection<Course>("courses"),
      requests: db.collection<Request>("requests"),
    };
  }
  return collections;
}
