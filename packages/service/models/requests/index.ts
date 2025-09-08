// Request types and utilities
export * from "./types";
export * from "./base";

// Specific request types
export * from "./swapSection";
export * from "./deadlineExtension";

// Union of all concrete request types
import { SwapSectionRequest } from "./swapSection";
import { DeadlineExtensionRequest } from "./deadlineExtension";

export const ConcreteRequest = SwapSectionRequest.or(DeadlineExtensionRequest);
