import {
  ProofUpload,
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  Role,
} from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";
import { safeNotify } from "../utils/notify";

/**
 * Input for a status change that may carry an optional remark (approve/reject/
 * cancel). A bare status change (no text, no proof) is allowed, but a remark
 * with supporting documents must also carry text — otherwise the proof would be
 * silently dropped by {@link remarkFrom}. This rejects such input explicitly
 * rather than returning success without recording the files.
 */
const StatusActionInput = z
  .object({
    id: RequestID,
    text: z.string().optional(),
    proof: ProofUpload,
  })
  .refine((v) => !v.proof?.length || (v.text?.trim() ?? "").length > 0, {
    message: "A remark is required when attaching supporting documents.",
  });

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
  // The request body (class/type/metadata) is immutable after creation. All
  // content (the opening reason, follow-up comments) and every status change
  // are recorded as entries on the thread via these mutations. A status change
  // with a remark records a comment entry followed by the status-change entry.

  comment: procedure
    .input(
      z.object({
        id: RequestID,
        text: z.string().nonempty("A comment cannot be empty."),
        proof: ProofUpload,
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
        services.notification.notifyRequestUpdate(request, [entry]),
      );
    }),
  approve: procedure
    .input(StatusActionInput)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entries = await services.request
        .auth(ctx.user.email)
        .approve(input.id, remarkFrom(input));
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await safeNotify(() =>
        services.notification.notifyRequestUpdate(request, entries),
      );
    }),
  reject: procedure
    .input(StatusActionInput)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entries = await services.request
        .auth(ctx.user.email)
        .reject(input.id, remarkFrom(input));
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await safeNotify(() =>
        services.notification.notifyRequestUpdate(request, entries),
      );
    }),
  cancel: procedure
    .input(StatusActionInput)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entries = await services.request
        .auth(ctx.user.email)
        .cancel(input.id, remarkFrom(input));
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await safeNotify(() =>
        services.notification.notifyRequestUpdate(request, entries),
      );
    }),
  appeal: procedure
    .input(
      z.object({
        id: RequestID,
        text: z.string().nonempty("An appeal must include a justification."),
        proof: ProofUpload,
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const entries = await services.request
        .auth(ctx.user.email)
        .appeal(input.id, { text: input.text, proof: input.proof });
      const request = await services.request
        .auth(ctx.user.email)
        .getRequest(input.id);
      await safeNotify(() =>
        services.notification.notifyRequestUpdate(request, entries),
      );
    }),
  proofContent: procedure
    .input(z.object({ fileId: z.string() }))
    .output(z.object({ content: z.string() }))
    .query(({ input, ctx }) => {
      return services.request.auth(ctx.user.email).readProof(input.fileId);
    }),
});

/**
 * Builds the optional remark payload for a status change (approve/reject/cancel)
 * from the composer input: a remark is recorded only when there is non-empty
 * text, carrying any attached proof along with it. {@link StatusActionInput}
 * guarantees that proof is never present without text.
 */
function remarkFrom(input: { text?: string; proof?: ProofUpload }) {
  const text = input.text?.trim();
  return text ? { text, proof: input.proof } : undefined;
}
