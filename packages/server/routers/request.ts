import {
  Proof,
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  ResponseDecision,
  Role,
} from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";
import { safeNotify } from "../utils/notify";

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
      await safeNotify(() => services.notification.notifyNewRequest(r));
      return rid;
    }),

  // ── Thread (append-only) ──────────────────────────────────────────────
  // The request body is immutable after creation. All follow-up activity is
  // recorded as entries on the thread via these mutations.

  comment: procedure
    .input(
      z.object({
        id: RequestID,
        text: z.string().nonempty("A comment cannot be empty."),
        proof: Proof,
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entry = await services.request
        .auth(ctx.user.email)
        .addComment(input.id, { text: input.text, proof: input.proof });
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await safeNotify(() =>
        services.notification.notifyRequestUpdate(request, entry),
      );
    }),
  respond: procedure
    .input(
      z.object({
        id: RequestID,
        remarks: z.string(),
        decision: ResponseDecision,
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entry = await services.request
        .auth(ctx.user.email)
        .respond(input.id, {
          remarks: input.remarks,
          decision: input.decision,
        });
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await safeNotify(() =>
        services.notification.notifyRequestUpdate(request, entry),
      );
    }),
  cancel: procedure
    .input(
      z.object({
        id: RequestID,
        text: z.string().optional(),
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entry = await services.request
        .auth(ctx.user.email)
        .cancelRequest(input.id, input.text);
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await safeNotify(() =>
        services.notification.notifyRequestUpdate(request, entry),
      );
    }),
  appeal: procedure
    .input(
      z.object({
        id: RequestID,
        text: z.string().nonempty("An appeal must include a justification."),
        proof: Proof,
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entry = await services.request
        .auth(ctx.user.email)
        .appealRequest(input.id, { text: input.text, proof: input.proof });
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await safeNotify(() =>
        services.notification.notifyRequestUpdate(request, entry),
      );
    }),
});
