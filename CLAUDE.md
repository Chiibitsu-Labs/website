# Chiibitsu Labs — website

Static HTML site (index.html, /about, /angeline) deployed on Vercel. `main` is the canonical branch; www is the canonical host (apex 301/308-redirects to it).

## Review gate (applies to every repo, not just this one)

Before merging any PR: **two consecutive clean review passes required.**

- Normal path: the bound cross-vendor reviewer (`chatgpt-codex-connector[bot]`).
- **Reviewer-unavailable substitution**: if that reviewer is rate-limited, in an outage, or no second vendor is bound, a local Codex review substitutes — run `codex review --base main` in-session. The full output must be posted to the PR **verbatim** (never as your own summary), two consecutive clean passes still required. An outage relaxes *which* reviewer, never *how many* passes or *what* is reviewable.
- Full policy, rationale, and the unattended-self-merge conditions live in the vault: **`01_wiki/kb/decisions.md`** — the Aikiri Garden Obsidian vault, reached through its MCP tool, not a file in this git repo. Read it before any merge/review-gate decision; don't assume a summary here (including this one) is complete or current.
