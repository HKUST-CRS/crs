import { RequestInit } from "service/models";
import z from "zod";
import { services } from "../services";
import { publicProcedure, router } from "../trpc";

export const routerRequest = router({
  getAll: publicProcedure.query(() => {
    return services.request.getRequests();
  }),
  get: publicProcedure.input(z.string()).query(async ({ input }) => {
    return await services.request.getRequest(input);
  }),
  create: publicProcedure.input(RequestInit).mutation(async ({ input }) => {
    return await services.request.createRequest(input);
  }),
});
