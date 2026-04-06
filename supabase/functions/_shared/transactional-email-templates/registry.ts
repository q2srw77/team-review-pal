/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as newReviewRequest } from './new-review-request.tsx'
import { template as reviewCompleted } from './review-completed.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-review-request': newReviewRequest,
  'review-completed': reviewCompleted,
}
