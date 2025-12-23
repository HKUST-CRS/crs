import type { Collections } from "../db";
import type { UserId } from "../models";
import { CourseRepo, RequestRepo, UserRepo } from "../repos";

export interface Repos {
  user: UserRepo;
  course: CourseRepo;
  request: RequestRepo;
}

export abstract class BaseService {
  protected repos: Repos;

  constructor(collections: Collections) {
    this.repos = {
      user: new UserRepo(collections),
      course: new CourseRepo(collections),
      request: new RequestRepo(collections),
    };
  }
}

export abstract class AuthableService extends BaseService {
  abstract withAuth(userId: UserId): ServiceWithAuth;
}

export abstract class ServiceWithAuth {
  protected repos: Repos;
  protected userId: UserId;

  constructor(repos: Repos, userId: UserId) {
    this.repos = repos;
    this.userId = userId;
  }
}
