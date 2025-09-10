import { z } from "zod";

// Request types and utilities
export * from "./base";

// Specific request types
export * from "./swapSection";
export * from "./deadlineExtension";

// Union of all request types
import { SwapSectionRequest } from "./swapSection";
import { DeadlineExtensionRequest } from "./deadlineExtension";

export const Request = z.union([SwapSectionRequest, DeadlineExtensionRequest]);
