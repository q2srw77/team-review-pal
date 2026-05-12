/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Review Hub"

interface Props {
  title?: string
  platform?: string
  teamName?: string
  completedCount?: number
  totalCount?: number
  completeBy?: string
}

const ReviewAutoAdvancedEmail = ({ title, platform, teamName, completedCount, totalCount, completeBy }: Props) => {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Deadline reached — your turn to review comments on {title ?? 'your request'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Review Past Deadline — Your Turn</Heading>

          <Text style={text}>
            The completion date{completeBy ? <> (<strong>{completeBy}</strong>)</> : null} for <strong>{title ?? 'your request'}</strong> has passed.
            Any incomplete reviewers were automatically marked complete, and the request has been moved to <strong>Correction</strong> so you can take action.
          </Text>

          {typeof completedCount === 'number' && typeof totalCount === 'number' && (
            <Text style={detailText}>
              <strong>Reviewer progress at deadline:</strong> {completedCount} of {totalCount} completed on their own.
            </Text>
          )}
          {platform && (
            <Text style={detailText}><strong>Platform:</strong> {platform}</Text>
          )}
          {teamName && (
            <Text style={detailText}><strong>Team:</strong> {teamName}</Text>
          )}

          <Text style={text}>
            Open the request to accept or reject each comment. From there you can either re-submit for another round of review or mark the request complete.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>{SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewAutoAdvancedEmail,
  subject: (data: Record<string, any>) =>
    `Review past deadline — your turn to review comments: ${data?.title ?? 'your request'}`,
  displayName: 'Review auto-advanced to correction',
  previewData: {
    title: 'Homepage Redesign',
    platform: 'Storylane',
    teamName: 'Design Team',
    completedCount: 2,
    totalCount: 3,
    completeBy: '2026-05-10',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const detailText = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
