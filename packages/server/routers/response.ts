import { RequestId } from "service/models";
import { ResponseInit } from "service/models/request/Response";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerResponse = router({
  create: procedure
    .input(
      z.object({
        id: RequestId,
        init: ResponseInit,
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await services.request.createResponse(
        ctx.user.email,
        input.id,
        input.init,
      );
      const request = await services.request.getRequest(
        ctx.user.email,
        input.id,
      );
      await services.notification.notifyNewResponse(request);
    }),
});
