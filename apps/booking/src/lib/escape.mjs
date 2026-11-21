// Pure helpers for building email HTML from booker-supplied text.
// Plain .mjs so the test in scripts/ runs on any Node with no build step.

/** HTML-escape text for use in element content or a quoted attribute. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Subject line: no CR/LF or other control characters, no angle brackets, capped. */
export function safeSubject(value) {
  return String(value ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

/** Only an absolute http(s) URL may become an href; anything else becomes ''. */
export function safeHref(url) {
  return /^https?:\/\//i.test(String(url ?? '')) ? String(url) : '';
}
