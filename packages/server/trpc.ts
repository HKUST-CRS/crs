import { initTRPC } from "@trpc/server";
import * as jose from "jose";
import { ZodError, z } from "zod";
import type { Context } from "./auth";
import { services } from "./services";

const t = initTRPC.context<Context>().create({
  errorFormatter(opts) {
    const { shape, error } = opts;
    const meta = {
      path: opts.path,
      type: opts.type,
      user: opts.ctx?.user,
    };
    console.info(
      `[TRPC] ERR - ${meta.type} ${meta.path} (${meta.user?.name} <${meta.user?.email}>)`,
    );
    console.error(`[TRPC] Error details:`, opts.error);
    if (error.cause instanceof ZodError) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zod: z.treeifyError(error.cause),
        },
      };
    }
    if (error.cause instanceof jose.errors.JOSEError) {
      return {
        ...shape,
        data: {
          ...shape.data,
          jose: error.cause,
        },
      };
    }
    return shape;
  },
});

export const router = t.router;
export const procedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;

  // synchronize user info
  await services.user.auth(ctx.user.email).sync(ctx.user.name);

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

  if (!result.ok) {
    console.warn(`[TRPC] Error details:`, result.error);
  }

  return result;
});
