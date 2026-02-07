import { RequestID } from "service/models";
import { ResponseInit } from "service/models/request/Response";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerResponse = router({
  create: procedure
    .input(
      z.object({
        id: RequestID,
        init: ResponseInit,
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await services.request
        .auth(ctx.user.email)
        .createResponse(input.id, input.init);
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await services.notification.notifyNewResponse(request);
    }),
});
