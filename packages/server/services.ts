import {
  CourseService,
  NotificationService,
  RequestService,
  UserService,
} from "service/lib";
import { db } from "./db";

const course = new CourseService(db.collections);
const user = new UserService(db.collections);
const request = new RequestService(db.collections);
const notification = new NotificationService(db.collections);

export const services = {
  course,
  user,
  request,
  notification,
};
