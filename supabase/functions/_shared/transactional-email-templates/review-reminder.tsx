import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Review Hub"

interface ReviewReminderProps {
  title?: string
  platform?: string
  teamName?: string | null
  daysRemaining?: number
  completeBy?: string
  submitterName?: string
}

const ReviewReminderEmail = ({
  title,
  platform,
  teamName,
  daysRemaining = 1,
  completeBy,
  submitterName,
}: ReviewReminderProps) => {
  const dayLabel = daysRemaining === 1 ? 'day' : 'days'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Reminder: review due in {daysRemaining} {dayLabel}{title ? ` — ${title}` : ''}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Review reminder</Heading>
          <Text style={text}>
            This is a friendly reminder that your review
            {title ? ` for "${title}"` : ''} is due in{' '}
            <strong>{daysRemaining} {dayLabel}</strong>
            {completeBy ? ` (by ${completeBy})` : ''}.
          </Text>

          <Section style={detailBox}>
            {title && (
              <Text style={detailRow}><strong>Request:</strong> {title}</Text>
            )}
            {platform && (
              <Text style={detailRow}><strong>Platform:</strong> {platform}</Text>
            )}
            {teamName && (
              <Text style={detailRow}><strong>Team:</strong> {teamName}</Text>
            )}
            {submitterName && (
              <Text style={detailRow}><strong>Submitted by:</strong> {submitterName}</Text>
            )}
            {completeBy && (
              <Text style={detailRow}><strong>Complete by:</strong> {completeBy}</Text>
            )}
          </Section>

          <Text style={text}>
            After the deadline passes, the request will be automatically closed
            and your status will be frozen as-is. Please log in to {SITE_NAME}
            to complete your review before then.
          </Text>

          <Text style={footer}>— The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewReminderEmail,
  subject: (data: Record<string, any>) => {
    const days = data?.daysRemaining ?? 1
    const dayLabel = days === 1 ? 'day' : 'days'
    const title = data?.title ? ` — ${data.title}` : ''
    return `Reminder: review due in ${days} ${dayLabel}${title}`
  },
  displayName: 'Review reminder (pre-deadline)',
  previewData: {
    title: 'Q4 Marketing Site Refresh',
    platform: 'Storylane',
    teamName: 'Brand Team',
    daysRemaining: 2,
    completeBy: '2026-04-20',
    submitterName: 'Jane Doe',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.55', margin: '0 0 18px' }
const detailBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '0 0 22px',
}
const detailRow = { fontSize: '13px', color: '#334155', margin: '0 0 6px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0' }
