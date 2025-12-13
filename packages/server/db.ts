import { createDbConnFromEnv } from "service/db";

export const db = await createDbConnFromEnv();
