import { MongoMemoryServer } from "mongodb-memory-server";
import { DbConn } from "../db";

export class TestConn extends DbConn {
  private _memoryServer: MongoMemoryServer;

  constructor(memoryServer: MongoMemoryServer) {
    super(memoryServer.getUri(), "__test__");
    this._memoryServer = memoryServer;
  }

  async clear() {
    if (this._db) {
      await this._db.dropDatabase();
    }
  }

  override async close() {
    await this.clear();
    await super.close();
    await this._memoryServer.stop();
  }
}

export async function getTestConn(): Promise<TestConn> {
  return new TestConn(await MongoMemoryServer.create());
}
