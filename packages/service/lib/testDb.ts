import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer;

export const connectTestDB = async (): Promise<void> => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
};

export const closeTestDB = async (): Promise<void> => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
};

export const clearTestDB = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    if (collection) {
      await collection.deleteMany({});
    }
  }
};
