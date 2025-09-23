import { z } from 'zod'

export * from './type'
export * from './base'

export * from './SwapSection'
export * from './DeadlineExtension'

import { SwapSectionRequest } from './SwapSection'
import { DeadlineExtensionRequest } from './DeadlineExtension'

export const Requests = [SwapSectionRequest, DeadlineExtensionRequest] as const

export const Request = z.discriminatedUnion('type', Requests)
export type Request = z.infer<typeof Request>
export type NoId<T> = Omit<T, 'id'>
