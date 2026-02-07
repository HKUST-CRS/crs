import type { Repos } from "../repos";
import { CourseService } from "./ServiceCourse";
import { NotificationService } from "./ServiceNotification";
import { RequestService } from "./ServiceRequest";
import { UserService } from "./ServiceUser";

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
