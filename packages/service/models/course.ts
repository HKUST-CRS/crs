import { z } from 'zod'
import { User } from './user'
import { RequestType } from './requests'

const Role = z.enum(['student', 'instructor', 'ta'])
export type Role = z.infer<typeof Role>

export const Course = z.object({
  code: z.string().meta({ examples: ['COMP1023'] }),
  semester: z.string().meta({ examples: ['2510'] }),
  title: z.string(),
  people: z.record(User.shape.email, Role),
  requestTypesEnabled: z.record(RequestType, z.boolean()),
})

export type Course = z.infer<typeof Course>
export type CourseId = Pick<Course, 'code' | 'semester'>
