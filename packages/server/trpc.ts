import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./auth";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const procedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

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
  console.log("TRPC", {
    meta,
    ...(result.ok ? {} : { error: result.error }),
  });

  return result;
});
