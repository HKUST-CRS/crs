import { Request, RequestId, RequestInit, Role } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerRequest = router({
  get: procedure
    .input(RequestId)
    .output(Request)
    .query(({ input, ctx }) => {
      return services.request.auth(ctx.user.email).getRequest(input);
    }),
  getAll: procedure
    .input(Role)
    .output(z.array(Request))
    .query(({ input: role, ctx }) => {
      return services.request.auth(ctx.user.email).getRequestsAs(role);
    }),
  create: procedure
    .input(RequestInit)
    .output(RequestId)
    .mutation(async ({ input, ctx }) => {
      const rid = await services.request
        .auth(ctx.user.email)
        .createRequest(input);
      const r = await services.request.auth(ctx.user.email).getRequest(rid);
      await services.notification.notifyNewRequest(r);
      return rid;
    }),
});
