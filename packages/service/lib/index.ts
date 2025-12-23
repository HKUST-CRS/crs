import type { Repos } from "../repos";
import { CourseService } from "./courseService";
import { NotificationService } from "./notificationService";
import { RequestService } from "./requestService";
import { UserService } from "./userService";

export interface Services {
  user: UserService;
  course: CourseService;
  request: RequestService;
  notification: NotificationService;
}

export function createServices(repos: Repos): Services {
  return {
    user: new UserService(repos),
    course: new CourseService(repos),
    request: new RequestService(repos),
    notification: new NotificationService(repos),
  };
}

export { CourseService, UserService, RequestService, NotificationService };
