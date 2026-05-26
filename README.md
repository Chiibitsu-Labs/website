# Chiibitsu Labs

Monorepo for all Chiibitsu Labs digital tools and properties.

## Apps

| App | Directory | URL | Status |
|-----|-----------|-----|--------|
| Booking | `apps/booking/` | booking.chiibitsu.com | In development |

## Adding a new app

Create a new directory under `apps/` (e.g. `apps/invoicing/`). Each app is an independent project with its own `package.json` and deployment config.

## Deployment

Each app deploys independently — connect the GitHub repo to your hosting platform (Vercel, DigitalOcean App Platform, etc.) and set the **root/source directory** to the app's subfolder (e.g. `apps/booking`).
