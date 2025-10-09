import { Request, RequestId, RequestInit, Role } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerRequest = router({
  get: procedure
    .input(RequestId)
    .output(Request)
    .query(async ({ input }) => {
      return await services.request.getRequest(input);
    }),
  getAll: procedure
    .input(Role)
    .output(z.array(Request))
    .query(({ input: role, ctx }) => {
      return services.request.getRequestsAs(ctx.user.email, role);
    }),
  create: procedure
    .input(RequestInit)
    .output(RequestId)
    .mutation(async ({ input, ctx }) => {
      const rid = await services.request.createRequest(ctx.user.email, input);
      const r = await services.request.getRequest(rid);
      await services.notification.notifyNewRequest(r);
      return rid;
    }),
});
