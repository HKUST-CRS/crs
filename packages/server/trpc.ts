import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure.use(async (opts) => {
  const result = await opts.next();

  const meta = { path: opts.path, type: opts.type, ok: result.ok };
  console.log("TRPC", {
    meta,
    ...(result.ok ? {} : { error: result.error }),
  })

  return result;
});
