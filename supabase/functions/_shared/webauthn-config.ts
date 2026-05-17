// Server-enforced WebAuthn relying-party configuration.
//
// rpID and expectedOrigin must NEVER be taken from the client — that would
// undermine the origin-binding guarantees of WebAuthn. We derive them from
// the APP_ORIGIN env var and allow a small allowlist of additional known
// origins (Lovable preview/published domains).

const FALLBACK_ORIGIN = 'https://reviewhub.cyphersecurity.us'

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
  const env = normalizeOrigin(Deno.env.get('APP_ORIGIN')) ?? FALLBACK_ORIGIN
  origins.add(env)
  // Known Lovable hostnames for this project (preview / published).
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
