import { RequestID, ResponseInit } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

/**
 * Compatibility alias for the old `response.create` procedure, kept during the
 * thread-style rollout so that an old frontend build (which still calls
 * `response.create`) keeps working against this new backend.
 *
 * It forwards to the new {@link RequestService.respond} path and notifies via
 * {@link NotificationService.notifyRequestUpdate}, exactly like
 * `routerRequest.respond`. Remove this router once the frontend is confirmed
 * to be on `request.respond`.
 */
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
      const entry = await services.request
        .auth(ctx.user.email)
        .respond(input.id, input.init);
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await services.notification.notifyRequestUpdate(request, entry);
    }),
});
