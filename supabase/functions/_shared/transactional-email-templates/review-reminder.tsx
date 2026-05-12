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

function timingPhrase(days: number): string {
  if (days <= 0) return 'due today'
  if (days === 1) return 'due tomorrow'
  return `due in ${days} days`
}

const ReviewReminderEmail = ({
  title,
  platform,
  teamName,
  daysRemaining = 1,
  completeBy,
  submitterName,
}: ReviewReminderProps) => {
  const phrase = timingPhrase(daysRemaining)
  const isDueToday = daysRemaining <= 0
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isDueToday
          ? `Review due today${title ? ` — ${title}` : ''}`
          : `Reminder: review ${phrase}${title ? ` — ${title}` : ''}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isDueToday ? 'Your review is due today' : 'Review reminder'}
          </Heading>
          <Text style={text}>
            {isDueToday ? (
              <>
                Your review{title ? ` for "${title}"` : ''} is{' '}
                <strong>due today</strong>
                {completeBy ? ` (${completeBy})` : ''}. If it isn't completed,
                tonight's auto-advance will move the request to Correction.
              </>
            ) : (
              <>
                This is a friendly reminder that your review
                {title ? ` for "${title}"` : ''} is{' '}
                <strong>{phrase}</strong>
                {completeBy ? ` (by ${completeBy})` : ''}.
              </>
            )}
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
            {isDueToday
              ? `Please log in to ${SITE_NAME} and finish your review before the day ends to keep this request on track.`
              : `Please log in to ${SITE_NAME} to complete your review before the deadline. After the complete-by date, the request will auto-advance to Correction.`}
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
    const days = typeof data?.daysRemaining === 'number' ? data.daysRemaining : 1
    const title = data?.title ? ` — ${data.title}` : ''
    if (days <= 0) return `Review due today${title}`
    if (days === 1) return `Reminder: review due tomorrow${title}`
    return `Reminder: review due in ${days} days${title}`
  },
  displayName: 'Review reminder (pre-deadline)',
  previewData: {
    title: 'Q4 Marketing Site Refresh',
    platform: 'Storylane',
    teamName: 'Brand Team',
    daysRemaining: 1,
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
