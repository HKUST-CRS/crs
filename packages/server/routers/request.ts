import {
  CommentInit,
  Request,
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
  getAllAs: procedure
    .input(z.array(Role))
    .output(z.array(Request))
    .query(({ input: role, ctx }) => {
      return services.request.auth(ctx.user.email).getRequestsAs(role);
    }),
  getContext: procedure
    .input(RequestID)
    .output(
      z.strictObject({
        courseTitle: z.string(),
        assignedGrader: z
          .strictObject({ email: z.email(), name: z.string() })
          .nullable(),
        authors: z.array(
          z.strictObject({ email: z.email(), name: z.string() }),
        ),
        canComment: z.boolean(),
        canDecide: z.boolean(),
        canAppeal: z.boolean(),
      }),
    )
    .query(({ input, ctx }) => {
      return services.request.auth(ctx.user.email).getContext(input);
    }),
  create: procedure
    .input(
      z.strictObject({
        request: RequestInit,
        comment: CommentInit,
      }),
    )
    .output(RequestID)
    .mutation(async ({ input, ctx }) => {
      const rid = await services.request
        .auth(ctx.user.email)
        .createRequest(input.request, input.comment);
      const r = await services.request.auth(ctx.user.email).getRequest(rid);
      await services.notification.notifyRequestUpdate(r);
      return rid;
    }),
  comment: procedure
    .input(
      z.strictObject({
        id: RequestID,
        ...CommentInit.shape,
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entry = await services.request
        .auth(ctx.user.email)
        .comment(input.id, { text: input.text, proofs: input.proofs });
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await services.notification.notifyRequestUpdate(request, [entry]);
    }),
  approve: procedure
    .input(
      z.strictObject({
        id: RequestID,
        comment: CommentInit.optional(),
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entries = await services.request
        .auth(ctx.user.email)
        .approve(input.id, input.comment);
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await services.notification.notifyRequestUpdate(request, entries);
    }),
  reject: procedure
    .input(
      z.strictObject({
        id: RequestID,
        comment: CommentInit.optional(),
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entries = await services.request
        .auth(ctx.user.email)
        .reject(input.id, input.comment);
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await services.notification.notifyRequestUpdate(request, entries);
    }),
  cancel: procedure
    .input(
      z.strictObject({
        id: RequestID,
        comment: CommentInit.optional(),
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entries = await services.request
        .auth(ctx.user.email)
        .cancel(input.id, input.comment);
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await services.notification.notifyRequestUpdate(request, entries);
    }),
  appeal: procedure
    .input(
      z.strictObject({
        id: RequestID,
        ...CommentInit.shape,
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entries = await services.request
        .auth(ctx.user.email)
        .appeal(input.id, { text: input.text, proofs: input.proofs });
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await services.notification.notifyRequestUpdate(request, entries);
    }),
  getProof: procedure
    .input(z.strictObject({ attachmentId: z.string() }))
    .output(z.strictObject({ content: z.string() }))
    .query(({ input, ctx }) => {
      return services.request
        .auth(ctx.user.email)
        .fetchProof(input.attachmentId);
    }),
});
