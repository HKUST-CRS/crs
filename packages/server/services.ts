import { CourseService, RequestService, UserService } from "service/lib";
import { db } from "./db";

export const services = {
  course: new CourseService(db.collections),
  user: new UserService(db.collections),
  request: new RequestService(db.collections),
};
