import { z } from 'zod'
import { CourseId } from './course'

const Role = z.enum(['student', 'instructor', 'ta'])
export type Role = z.infer<typeof Role>

export const User = z.object({
  email: z.email()
    .meta({ description: 'The user\'s email address, used as the unique identifier.' }),
  name: z.string()
    .meta({ description: 'The full name of the user.' }),
  enrollment: z.array(
    z.object({
      ...CourseId.shape,
      role: Role,
      sections: z.array(
        z.string()
          .meta({
            description: 'The section code the user is enrolled in.',
            examples: ['L1', 'L01', 'T1', 'LA1'],
          }),
      ),
    }),
  ),
})
export type User = z.infer<typeof User>

export const UserId = User.pick({ email: true })
export type UserId = z.infer<typeof UserId>
