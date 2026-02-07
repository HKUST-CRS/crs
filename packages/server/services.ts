import { createRepos } from "service/repos";
import { createServices } from "service/services";
import { db } from "./db";

const repos = createRepos(db.collections);
export const services = createServices(repos);
