import type { RequestStatus } from "service/models";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  open: "Open",
  approved: "Approved",
  rejected: "Rejected",
  appealed: "Appealed",
  cancelled: "Cancelled",
};
