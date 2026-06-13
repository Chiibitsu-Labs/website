# Chiibitsu Labs — Custom Booking Calendar

A branded, multi-project booking calendar that lives at **booking.chiibitsu.com**.

---

## What it does

- **Multiple booking projects** — each with its own branding, time slots, and form
- **Google Calendar integration** — checks your real calendar to block busy times
- **Confirmation emails** — sends to both the booker and you via Resend
- **Admin view** at `/admin` — see all upcoming bookings, password-protected
- **Fully configurable** — edit one file (`src/config/projects.ts`) to add/change projects

---

## Setup Guide

### Step 1: Google Cloud — create OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services → Library**, search for **Google Calendar API**, click **Enable**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
5. Application type: **Web application**
6. Add `http://localhost:3333/callback` to **Authorized redirect URIs**
7. Copy your **Client ID** and **Client Secret**

### Step 2: Get your refresh token (one-time, on a computer)

> You need to do this once on a computer (not a phone) to authorise access to your Google Calendar.

```bash
# Copy the example env file
cp .env.example .env

# Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then run:
node scripts/get-refresh-token.mjs
```

Follow the browser prompt. Paste the printed `GOOGLE_REFRESH_TOKEN` into your `.env`.

### Step 3: Resend — set up email

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain (or use Resend's shared domain for testing)
3. Create an API key and add it to `.env` as `RESEND_API_KEY`
4. Set `EMAIL_FROM` to a verified sender address (e.g. `booking@chiibitsu.com`)

### Step 4: Fill in the rest of `.env`

```
ADMIN_PASSWORD=choose-a-strong-password
NEXT_PUBLIC_BASE_URL=https://booking.chiibitsu.com
ADMIN_EMAIL=chii@chiibitsu.com
```

---

## Deploying to DigitalOcean App Platform

1. Push this repo to GitHub (it's already there on `chiibitsu-labs/website`)
2. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
3. Click **Create App → GitHub**
4. Select the `chiibitsu-labs/website` repository
5. DigitalOcean will auto-detect it as a Next.js app
6. Under **Environment Variables**, add all variables from your `.env` file
7. Deploy — it'll build and go live

**Add the subdomain:**
- In DigitalOcean App settings, add the domain `booking.chiibitsu.com`
- In your DNS (wherever chiibitsu.com is managed), add a CNAME record:
  `booking → <your-do-app-url>.ondigitalocean.app`

---

## Adding or editing a booking project

Edit **`src/config/projects.ts`** — this is the only file you need to touch.

Each project has:
- `slug` — URL-safe ID, e.g. `ai-at-work`
- `name` / `company` / `tagline` / `description`
- `durationMinutes` — session length
- `branding.primaryColor` — Tailwind color name: `violet`, `teal`, `indigo`, `blue`, `emerald`, `rose`, `amber`
- `timeSlots` — array of day + start time combos
- `customFields` — extra form fields (text, textarea, or select)
- `bookingWindowWeeks` — how far ahead someone can book
- `blockedDates` — array of `YYYY-MM-DD` dates to block out

After editing, commit and push — DigitalOcean will auto-deploy.

---

## Local development

```bash
cp .env.example .env
# Fill in all values in .env

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Tech stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS**
- **Google Calendar API** — availability + booking creation
- **Resend** — transactional email
- **DigitalOcean App Platform** — hosting
