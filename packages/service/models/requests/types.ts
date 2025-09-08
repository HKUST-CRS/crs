/**
 * Request types registry
 * This file defines all available request types in the system
 * When adding new request types, add them to the REQUEST_TYPES object
 */

export const REQUEST_TYPES = {
  SWAP_SECTION: "Swap Section",
  DEADLINE_EXTENSION: "Deadline Extension",
} as const;

export type RequestTypeKey = keyof typeof REQUEST_TYPES;
export type RequestTypeValue = (typeof REQUEST_TYPES)[RequestTypeKey];

/**
 * Array of all available request type values
 */
export const ALL_REQUEST_TYPES = Object.values(
  REQUEST_TYPES
) as RequestTypeValue[];

/**
 * Check if a string is a valid request type
 */
export function isValidRequestType(type: string): type is RequestTypeValue {
  return ALL_REQUEST_TYPES.includes(type as RequestTypeValue);
}

/**
 * Get request type by key
 */
export function getRequestType(key: RequestTypeKey): RequestTypeValue {
  return REQUEST_TYPES[key];
}
