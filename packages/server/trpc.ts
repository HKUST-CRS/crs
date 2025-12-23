import { initTRPC } from "@trpc/server";
import type { Context } from "./auth";
import { services } from "./services";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const procedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;

  // verify user exists
  await services.user.auth(ctx.user.email).getCurrentUser();
  // update user name
  await services.user.auth(ctx.user.email).updateUserName(ctx.user.name);

  const result = await opts.next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });

  const meta = {
    path: opts.path,
    type: opts.type,
    user: ctx.user,
    ok: result.ok,
  };
  console.info(
    `[TRPC] ${meta.ok ? "OK" : "NG"} - ${meta.type} ${meta.path} (${meta.user.name} <${meta.user.email}>)`,
  );

  return result;
});
