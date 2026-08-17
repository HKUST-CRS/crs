import {
  Appeal,
  AppealHead,
  AppealID,
  AppealInit,
  MessageInit,
  UserID,
} from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerAppeal = router({
  get: procedure
    .input(AppealID)
    .output(Appeal)
    .query(({ input, ctx }) => {
      return services.appeal.auth(ctx.user.email).getAppeal(input);
    }),
  list: procedure.output(z.array(AppealHead)).query(({ ctx }) => {
    return services.appeal.auth(ctx.user.email).getAppealHeads();
  }),
  create: procedure
    .input(
      z.object({
        init: AppealInit,
        message: MessageInit,
      }),
    )
    .output(AppealID)
    .mutation(async ({ input, ctx }) => {
      const appealID = await services.appeal
        .auth(ctx.user.email)
        .createAppeal(input.init, input.message);
      const appeal = await services.appeal
        .auth(ctx.user.email)
        .getAppeal(appealID);
      await services.notification.notifyNewAppeal(appeal);
      return appealID;
    }),
  post: procedure
    .input(
      z.object({
        appealID: AppealID,
        message: MessageInit,
      }),
    )
    .mutation(({ input, ctx }) => {
      return services.appeal
        .auth(ctx.user.email)
        .postMessage(input.appealID, input.message);
    }),
  invite: procedure
    .input(
      z.object({
        appealID: AppealID,
        invitee: UserID,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await services.appeal
        .auth(ctx.user.email)
        .inviteParticipant(input.appealID, input.invitee);
      const appeal = await services.appeal
        .auth(ctx.user.email)
        .getAppeal(input.appealID);
      await services.notification.notifyAppealInvite(appeal, input.invitee);
    }),
});
