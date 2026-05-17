// Server-enforced WebAuthn relying-party configuration.
//
// rpID and expectedOrigin must NEVER be taken from the client — that would
// undermine the origin-binding guarantees of WebAuthn. We derive them from
// the APP_ORIGIN env var and allow a small allowlist of additional known
// origins (Lovable preview/published domains).

const DEFAULT_ALLOWED_ORIGINS = [
  'https://reviewhub.cyphersecurity.us',
  'https://team-review-pal.lovable.app',
  'https://id-preview--12ceecea-7754-4292-80f9-2a5ae25c91d0.lovable.app',
]


function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

export function getExpectedOrigins(): string[] {
  const origins = new Set<string>()
  const env = normalizeOrigin(Deno.env.get('APP_ORIGIN'))
  if (env) origins.add(env)
  for (const o of DEFAULT_ALLOWED_ORIGINS) {
    const n = normalizeOrigin(o)
    if (n) origins.add(n)
  }
  const extra = Deno.env.get('APP_ORIGIN_ALLOWLIST')
  if (extra) {
    for (const o of extra.split(',')) {
      const n = normalizeOrigin(o.trim())
      if (n) origins.add(n)
    }
  }
  return Array.from(origins)
}

export function getRpID(): string {
  const origins = getExpectedOrigins()
  // Primary rpID is derived from the first (canonical) origin.
  return new URL(origins[0]).hostname
}

export function getAllowedRpIDs(): string[] {
  return Array.from(new Set(getExpectedOrigins().map((o) => new URL(o).hostname)))
}

export const RP_NAME = 'Review Hub'
