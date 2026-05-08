import {
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  Role,
} from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerRequest = router({
  get: procedure
    .input(RequestID)
    .output(Request)
    .query(({ input, ctx }) => {
      return services.request.auth(ctx.user.email).getRequest(input);
    }),
  getAllByID: procedure
    .input(z.array(RequestID))
    .output(z.array(Request))
    .query(({ input, ctx }) => {
      return services.request.auth(ctx.user.email).getRequestsByID(input);
    }),
  getAllHeadsAs: procedure
    .input(z.array(Role))
    .output(z.array(RequestHead))
    .query(({ input: role, ctx }) => {
      return services.request.auth(ctx.user.email).getRequestHeadsAs(role);
    }),
  create: procedure
    .input(RequestInit)
    .output(RequestID)
    .mutation(async ({ input, ctx }) => {
      const rid = await services.request
        .auth(ctx.user.email)
        .createRequest(input);
      const r = await services.request.auth(ctx.user.email).getRequest(rid);
      await services.notification.notifyNewRequest(r);
      return rid;
    }),
});
