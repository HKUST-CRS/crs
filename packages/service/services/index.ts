import type { Repos } from "../repos";
import { AppealService } from "./ServiceAppeal";
import { CourseService } from "./ServiceCourse";
import { NotificationService } from "./ServiceNotification";
import { RequestService } from "./ServiceRequest";
import { UserService } from "./ServiceUser";

export interface Services {
  appeal: AppealService;
  user: UserService;
  course: CourseService;
  request: RequestService;
  notification: NotificationService;
}

export function createServices(repos: Repos): Services {
  return {
    appeal: new AppealService(repos),
    user: new UserService(repos),
    course: new CourseService(repos),
    request: new RequestService(repos),
    notification: new NotificationService(repos),
  };
}

export {
  AppealService,
  CourseService,
  UserService,
  RequestService,
  NotificationService,
};
