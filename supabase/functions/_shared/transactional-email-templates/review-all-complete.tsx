/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Review Hub"

interface ReviewAllCompleteProps {
  title?: string
  platform?: string
  teamName?: string
  closedReason?: 'all_reviewed' | 'deadline_reached'
  completedCount?: number
  totalCount?: number
}

const ReviewAllCompleteEmail = ({ title, platform, teamName, closedReason, completedCount, totalCount }: ReviewAllCompleteProps) => {
  const isDeadline = closedReason === 'deadline_reached'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isDeadline
          ? `Deadline reached — review closed: ${title ?? 'your request'}`
          : `All reviewers have completed: ${title ?? 'your request'}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{isDeadline ? 'Review Closed (Deadline Reached)' : 'All Reviews Complete'}</Heading>

          {isDeadline ? (
            <Text style={text}>
              The completion date for <strong>{title ?? 'your request'}</strong> has passed, so the review has been automatically closed.
              {typeof completedCount === 'number' && typeof totalCount === 'number' && (
                <> {completedCount} of {totalCount} reviewer{totalCount === 1 ? '' : 's'} completed their review.</>
              )}
            </Text>
          ) : (
            <Text style={text}>
              Great news! All reviewers have completed their review for <strong>{title ?? 'your request'}</strong>.
            </Text>
          )}

          {platform && (
            <Text style={detailText}>
              <strong>Platform:</strong> {platform}
            </Text>
          )}
          {teamName && (
            <Text style={detailText}>
              <strong>Team:</strong> {teamName}
            </Text>
          )}

          <Text style={text}>
            A full PDF report with reviewer comments is being generated and will be emailed to you shortly.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewAllCompleteEmail,
  subject: (data: Record<string, any>) =>
    data?.closedReason === 'deadline_reached'
      ? `Review closed (deadline reached): ${data?.title ?? 'your request'}`
      : `All reviews complete: ${data?.title ?? 'your request'}`,
  displayName: 'All reviews complete notification',
  previewData: {
    title: 'Homepage Redesign',
    platform: 'Storylane',
    teamName: 'Design Team',
    closedReason: 'deadline_reached',
    completedCount: 2,
    totalCount: 3,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const detailText = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
