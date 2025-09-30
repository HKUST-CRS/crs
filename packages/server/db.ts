import { DbConn } from "service/db";

export const db = await DbConn.fromEnv();
