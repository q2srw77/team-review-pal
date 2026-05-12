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
import { template as reviewAllComplete } from './review-all-complete.tsx'
import { template as reviewReminder } from './review-reminder.tsx'
import { template as passwordReset } from './password-reset.tsx'
import { template as reviewResubmitted } from './review-resubmitted.tsx'
import { template as reviewFinalized } from './review-finalized.tsx'
import { template as reviewAutoAdvanced } from './review-auto-advanced-to-correction.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-review-request': newReviewRequest,
  'review-completed': reviewCompleted,
  'review-all-complete': reviewAllComplete,
  'review-reminder': reviewReminder,
  'password-reset': passwordReset,
  'review-resubmitted': reviewResubmitted,
  'review-finalized': reviewFinalized,
  'review-auto-advanced-to-correction': reviewAutoAdvanced,
}
