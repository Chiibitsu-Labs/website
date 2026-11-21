// Plain node test (no framework): node scripts/test-email-escape.mjs
// 1) Injected HTML/script must come out as text. 2) Subjects carry no CR/LF/HTML.
// 3) Every ${...} in email.ts is escaped or on a known-safe list, so a new raw
//    interpolation of booker input fails CI.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esc, safeSubject, safeHref } from '../src/lib/escape.mjs';

const payloads = ['<a href="https://evil.example">x</a>', '<script>alert(1)</script>', `"><img src=x onerror=1>`];
for (const p of payloads) {
  const out = esc(p);
  assert.ok(!/[<>"]/.test(out), `raw markup survived: ${out}`);
  assert.ok(out.includes('&lt;') && out.includes('&gt;'));
}
assert.equal(esc('<a href="https://evil.example">x</a>'), '&lt;a href=&quot;https://evil.example&quot;&gt;x&lt;/a&gt;');

const subj = safeSubject('Hi\r\nBcc: evil@example.com <script>x</script>');
assert.ok(!/[\r\n<>]/.test(subj), `bad subject: ${subj}`);
assert.equal(safeHref('javascript:alert(1)'), '');
assert.equal(safeHref('https://calendar.google.com/x'), 'https://calendar.google.com/x');

// Source guard: any ${...} that touches booker/project input must be wrapped in
// esc()/safeSubject()/safeHref(), or be a plain condition/encoded value.
const src = readFileSync(new URL('../src/lib/email.ts', import.meta.url), 'utf8')
  .replace(/safeSubject\(`[^`]*`\)/g, '') // subjects: covered by safeSubject
  .replace(/function buildAddToCalendarUrl[\s\S]*?\n}\n/, ''); // encodeURIComponent'd, fixed host
const ALREADY_ESCAPED = new Set(['customFieldsHtml', 'fields', 'customFieldsText']); // built with esc() above
const INPUT = /booking\.|project\.|booker|customFields|eventLink|\bk\b|\bv\b|projectName|dateLabel|timeLabel/;
const bad = [...src.matchAll(/\$\{([^{}`]*)\}/g)].map((m) => m[1].trim()).filter(
  (e) => INPUT.test(e) && !ALREADY_ESCAPED.has(e) && !/^(esc|safeSubject|encodeURIComponent)\(/.test(e) && !/^[\w.]+ \?$/.test(e) && !/\?$/.test(e)
    && !/^safeHref\(eventLink\) \?/.test(e),
);
assert.deepEqual(bad, [], `raw interpolation in email.ts: ${bad.join(' | ')}`);
// No double-escaping: values already built with esc() must not be wrapped again.
assert.ok(!/esc\((customFieldsText|fields|customFieldsHtml)\)/.test(src), 'double escape in email.ts');
console.log('email escape tests passed');
