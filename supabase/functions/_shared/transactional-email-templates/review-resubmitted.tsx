/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Review Hub"

interface ReviewResubmittedProps {
  title?: string
  round?: number
  requestUrl?: string
  reviewerName?: string
  completeBy?: string
}

const ReviewResubmittedEmail = ({ title, round, requestUrl, reviewerName, completeBy }: ReviewResubmittedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title ?? 'A review request'} — round {round ?? 2} ready for review</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Review Round Started</Heading>
        <Text style={text}>
          {reviewerName ? `Hi ${reviewerName},` : 'Hello,'}
        </Text>
        <Text style={text}>
          The submitter has reviewed your previous comments on <strong>{title ?? 'a review request'}</strong> and started a new review round (round {round ?? 2}). Your previous round is archived for reference.
        </Text>
        {completeBy && (
          <Text style={text}>
            <strong>Complete by:</strong> {completeBy}
          </Text>
        )}
        <Text style={text}>
          Please review the latest version and submit your updated comments before the deadline.
        </Text>

        {requestUrl && (
          <Button href={requestUrl} style={button}>
            Open Review Request
          </Button>
        )}

        <Hr style={hr} />
        <Text style={footer}>{SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReviewResubmittedEmail,
  subject: (data: Record<string, any>) =>
    `${data?.title ?? 'Review request'} — round ${data?.round ?? 2} review requested`,
  displayName: 'Review resubmitted (new round)',
  previewData: {
    title: 'Homepage Redesign',
    round: 2,
    requestUrl: 'https://example.com/dashboard',
    reviewerName: 'Jane',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const button = {
  backgroundColor: '#1570cd',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  padding: '10px 20px',
  display: 'inline-block' as const,
  margin: '8px 0 24px',
}
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
