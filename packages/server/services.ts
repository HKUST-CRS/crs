import { createServices } from "service/lib";
import { createRepos } from "service/repos";
import { db } from "./db";

const repos = createRepos(db.collections);
export const services = createServices(repos);
