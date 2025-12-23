import type { Collections } from "../db";
import { CourseRepo } from "./courseRepo";
import { RequestRepo } from "./requestRepo";
import { UserRepo } from "./userRepo";

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
