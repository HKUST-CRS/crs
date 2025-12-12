import type { Collections } from "../db";
import { CourseFunctions, RequestFunctions, UserFunctions } from "../functions";
import type { UserId } from "../models";

export interface Functions {
  user: UserFunctions;
  course: CourseFunctions;
  request: RequestFunctions;
}

export abstract class BaseService {
  protected functions: Functions;

  constructor(collections: Collections) {
    this.functions = {
      user: new UserFunctions(collections),
      course: new CourseFunctions(collections),
      request: new RequestFunctions(collections),
    };
  }
}

export abstract class AuthableService extends BaseService {
  abstract withAuth(userId: UserId): ServiceWithAuth;
}

export abstract class ServiceWithAuth {
  protected functions: Functions;
  protected userId: UserId;

  constructor(functions: Functions, userId: UserId) {
    this.functions = functions;
    this.userId = userId;
  }
}
