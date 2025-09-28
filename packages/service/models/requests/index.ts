import { z } from "zod";

export * from "./base";
export * from "./DeadlineExtension";

export * from "./SwapSection";
export * from "./type";

import { DeadlineExtensionRequest } from "./DeadlineExtension";
import { SwapSectionRequest } from "./SwapSection";

export const Requests = [SwapSectionRequest, DeadlineExtensionRequest] as const;

export const Request = z.discriminatedUnion("type", Requests);
export type Request = z.infer<typeof Request>;
export type NoId<T> = Omit<T, "id">;
