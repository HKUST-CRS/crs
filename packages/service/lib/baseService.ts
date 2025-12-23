import type { UserId } from "../models";
import type { Repos } from "../repos";

export abstract class BaseService {
  constructor(protected repos: Repos) {}
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
