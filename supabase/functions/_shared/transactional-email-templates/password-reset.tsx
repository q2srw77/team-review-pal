/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Review Hub"

interface PasswordResetProps {
  resetUrl?: string
  code?: string
}

const PasswordResetEmail = ({ resetUrl, code }: PasswordResetProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {SITE_NAME} password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset the password for your {SITE_NAME} account.
          To continue, click the button below and enter the verification code shown.
        </Text>

        {resetUrl && (
          <Button href={resetUrl} style={button}>
            Reset Password
          </Button>
        )}

        <Text style={text}>Your verification code:</Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code ?? '000000'}</Text>
        </Section>

        <Text style={muted}>
          This link and code will expire in <strong>2 hours</strong>. You'll need both to complete the reset.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Didn't request this? You can safely ignore this email — your password will not change.
        </Text>
        <Text style={footer}>{SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PasswordResetEmail,
  subject: `Reset your ${SITE_NAME} password`,
  displayName: 'Password reset',
  previewData: {
    resetUrl: 'https://example.com/reset-password?token=abc123',
    code: '482917',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const muted = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '16px 0 0' }
const button = {
  backgroundColor: '#1570cd',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  padding: '12px 22px',
  display: 'inline-block' as const,
  margin: '8px 0 24px',
}
const codeBox = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  padding: '16px',
  textAlign: 'center' as const,
  margin: '0 0 8px',
}
const codeText = {
  fontSize: '28px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  color: '#0f172a',
  fontFamily: 'monospace',
  margin: '0',
}
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0 0 4px' }
