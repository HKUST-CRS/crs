import type { Collections } from "../db";
import { CourseRepo } from "./RepoCourse";
import { RequestRepo } from "./RepoRequest";
import { UserRepo } from "./RepoUser";

export interface Repos {
  user: UserRepo;
  course: CourseRepo;
  request: RequestRepo;
}

export function createRepos(collections: Collections): Repos {
  return {
    user: new UserRepo(collections),
    course: new CourseRepo(collections),
    request: new RequestRepo(collections),
  };
}
