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
}

const ReviewAllCompleteEmail = ({ title, platform, teamName }: ReviewAllCompleteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>All reviewers have completed: {title ?? 'your request'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>All Reviews Complete</Heading>
        <Text style={text}>
          Great news! All reviewers have completed their review for <strong>{title ?? 'your request'}</strong>.
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

export const template = {
  component: ReviewAllCompleteEmail,
  subject: (data: Record<string, any>) =>
    `All reviews complete: ${data?.title ?? 'your request'}`,
  displayName: 'All reviews complete notification',
  previewData: {
    title: 'Homepage Redesign',
    platform: 'Storylane',
    teamName: 'Design Team',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const detailText = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
