import { z } from 'zod'
import { createRequestType } from './base'

export const DeadlineExtensionMeta = z.object({
  assignment: z.string()
    .meta({
      description: 'The assignment code of the assignment to extend the deadline for. ',
    }),
  deadline: z.iso
    .datetime()
    .meta({ description: 'The new deadline for the assignment.' }),
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
