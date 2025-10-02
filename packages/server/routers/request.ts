import { RequestInit } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerRequest = router({
  getAll: procedure.query(() => {
    return services.request.getRequests();
  }),
  get: procedure.input(z.string()).query(async ({ input }) => {
    return await services.request.getRequest(input);
  }),
  create: procedure.input(RequestInit).mutation(async ({ input }) => {
    return await services.request.createRequest(input);
  }),
});
