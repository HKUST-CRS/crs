import { z } from 'zod'
import { createRequestType } from './base'

export const DeadlineExtensionMeta = z.object({
  assignmentName: z.string()
    .meta({ description: 'The name of the assignment.' }),
  requestedDeadline: z.iso
    .datetime()
    .meta({ description: 'The proposed and requested new deadline.' }),
})
export type DeadlineExtensionMeta = z.infer<typeof DeadlineExtensionMeta>

export const DeadlineExtensionRequest = createRequestType(
  'Deadline Extension',
  DeadlineExtensionMeta,
).meta({
  title: 'Deadline Extension',
  description: 'Request for extension of assignment deadlines',
})
export type DeadlineExtensionRequest = z.infer<typeof DeadlineExtensionRequest>
