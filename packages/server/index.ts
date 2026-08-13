import { routerAppeal } from "./routers/appeal";
import { routerCourse } from "./routers/course";
import { routerRequest } from "./routers/request";
import { routerResponse } from "./routers/response";
import { routerUser } from "./routers/user";
import { router } from "./trpc";

export const appRouter = router({
  appeal: routerAppeal,
  request: routerRequest,
  response: routerResponse,
  course: routerCourse,
  user: routerUser,
});

export type AppRouter = typeof appRouter;
