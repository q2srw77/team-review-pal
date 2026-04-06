/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Review Hub"

interface ReviewCompletedProps {
  title?: string
  platform?: string
  teamName?: string
  downloadUrl?: string
}

const ReviewCompletedEmail = ({ title, platform, teamName, downloadUrl }: ReviewCompletedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Review completed: {title ?? 'your request'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Review Completed</Heading>
        <Text style={text}>
          The review for <strong>{title ?? 'your request'}</strong> has been completed by all reviewers.
        </Text>

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
          A full report with reviewer comments is available for download.
        </Text>

        {downloadUrl && (
          <Button href={downloadUrl} style={button}>
            Download Report (PDF)
          </Button>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReviewCompletedEmail,
  subject: (data: Record<string, any>) =>
    `Review completed: ${data?.title ?? 'your request'}`,
  displayName: 'Review completed notification',
  previewData: {
    title: 'Homepage Redesign',
    platform: 'Storylane',
    teamName: 'Design Team',
    downloadUrl: 'https://example.com/report.pdf',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const detailText = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 6px' }
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
