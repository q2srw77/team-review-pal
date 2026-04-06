import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Review Hub"

interface NewReviewRequestProps {
  title?: string
  platform?: string
  teamName?: string
  submitterName?: string
  completeBy?: string
  appUrl?: string
}

const NewReviewRequestEmail = ({
  title,
  platform,
  teamName,
  submitterName,
  completeBy,
  appUrl,
}: NewReviewRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New review request: {title || 'Untitled'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Review Request</Heading>
        <Text style={text}>
          {submitterName || 'A team member'} has submitted a new review request
          {teamName ? ` for ${teamName}` : ''}.
        </Text>
        <Section style={detailsBox}>
          <Text style={detailLabel}>Title</Text>
          <Text style={detailValue}>{title || 'Untitled'}</Text>
          <Text style={detailLabel}>Platform</Text>
          <Text style={detailValue}>{platform || 'N/A'}</Text>
          {teamName && (
            <>
              <Text style={detailLabel}>Team</Text>
              <Text style={detailValue}>{teamName}</Text>
            </>
          )}
          {completeBy && (
            <>
              <Text style={detailLabel}>Complete By</Text>
              <Text style={detailValue}>{completeBy}</Text>
            </>
          )}
        </Section>
        {appUrl && (
          <Button style={button} href={appUrl}>
            View Request
          </Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>
          You received this because you are a member of {teamName || 'the team'} on {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewReviewRequestEmail,
  subject: (data: Record<string, any>) =>
    `New review request: ${data.title || 'Untitled'}`,
  displayName: 'New review request notification',
  previewData: {
    title: 'Website Redesign Review',
    platform: 'Storylane',
    teamName: 'Design Team',
    submitterName: 'Jane Doe',
    completeBy: 'January 15, 2025',
    appUrl: 'https://example.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1a1a2e', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#444654', lineHeight: '1.6', margin: '0 0 20px' }
const detailsBox = { backgroundColor: '#f5f7fa', borderRadius: '8px', padding: '16px 20px', margin: '0 0 24px' }
const detailLabel = { fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '12px 0 2px', fontWeight: '600' as const }
const detailValue = { fontSize: '15px', color: '#1a1a2e', margin: '0 0 4px' }
const button = { backgroundColor: '#2563eb', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', margin: '0 0 24px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '0' }
