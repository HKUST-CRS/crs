import * as mongoDB from "mongodb";
import * as dotenv from "dotenv";
import type { User, Course, Request } from "../models";

export interface Collections {
  users: mongoDB.Collection<User>;
  courses: mongoDB.Collection<Course>;
  requests: mongoDB.Collection<Request>;
}

export class DbConn {
  private _dbConnString: string;
  private _dbName: string;
  protected _client: mongoDB.MongoClient | null = null;
  protected _db: mongoDB.Db | null = null;
  protected _collections: Collections | null = null;

  constructor(dbConnString: string, dbName: string) {
    this._dbConnString = dbConnString;
    this._dbName = dbName;
  }

  private async _connect(): Promise<void> {
    if (!this._client || !this._db) {
      this._client = new mongoDB.MongoClient(this._dbConnString);
      await this._client.connect();
      this._db = this._client.db(this._dbName);
    }
  }

  async getCollections(): Promise<Readonly<Collections>> {
    if (!this._db) {
      await this._connect();
    }
    this._db = this._db as mongoDB.Db; // ensured by _connect()
    return {
      users: this._db.collection<User>("users"),
      courses: this._db.collection<Course>("courses"),
      requests: this._db.collection<Request>("requests"),
    };
  }

  async close(): Promise<void> {
    this._collections = null;
    this._db = null;
    if (this._client) {
      await this._client.close();
      this._client = null;
    }
  }

  static fromEnv(envPath?: string): DbConn {
    dotenv.config({ path: envPath });

    const dbConnString = Bun.env.DB_CONN_STRING;
    if (!dbConnString) {
      throw new Error("Missing DB_CONN_STRING environment variable");
    }

    const dbName = Bun.env.DB_NAME;
    if (!dbName) {
      throw new Error("Missing DB_NAME environment variable");
    }

    return new DbConn(dbConnString, dbName);
  }
}
