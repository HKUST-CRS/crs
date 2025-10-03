import { z } from "zod";
import { DeadlineExtensionRequest } from "./DeadlineExtension";
import { SwapSectionRequest } from "./SwapSection";

export const RequestInits = [
  DeadlineExtensionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    response: true,
  }),
  SwapSectionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    response: true,
  }),
] as const;
export const Requests = [SwapSectionRequest, DeadlineExtensionRequest] as const;

export const Request = z.discriminatedUnion("type", Requests);
export type Request = z.infer<typeof Request>;

export const RequestInit = z.discriminatedUnion("type", RequestInits);
export type RequestInit = z.infer<typeof RequestInit>;
