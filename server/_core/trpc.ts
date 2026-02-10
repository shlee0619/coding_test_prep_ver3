import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ENV } from "./env.js";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // 프로덕션에서는 내부 에러 상세를 클라이언트에 노출하지 않음
    if (ENV.isProduction && error.code === "INTERNAL_SERVER_ERROR") {
      return {
        ...shape,
        message: "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
