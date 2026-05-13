# Postmark — Email Campaign Platform

A full-featured email campaign platform built with React, Vite, Supabase, and AWS SES.

## Live Demo
https://email-platform.tarun-dangeti03.workers.dev

## Tech Stack
- **Frontend**: React 18, Vite, React Router v6, Recharts, GrapeJS
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **Email**: AWS SES
- **Hosting**: Netlify / Vercel (frontend SPA)

## Features (9 Modules)
1. **M1 — Login & User Management**: Email/password auth, 3 roles (Super Admin, Campaign Manager, Viewer)
2. **M2 — Contact Management**: Add/import/export contacts, CSV import, list management
3. **M3 — Email Template Builder**: GrapeJS drag-and-drop editor, 5 starter templates, merge tags
4. **M4 — Campaign Management**: 4-step wizard (details, audience, design, review)
5. **M5 — Scheduling & Sending**: Send now or schedule, AWS SES integration
6. **M6 — Open & Click Tracking**: Pixel tracking, click tracking, per-contact events
7. **M7 — Bounce & Complaint Handling**: Auto-suppression via AWS SNS/SES webhooks
8. **M8 — Unsubscribe Management**: One-click unsubscribe, re-subscribe option
9. **M9 — Analytics & Reports**: Dashboard KPIs, charts, per-campaign reports, CSV export

## Local Development

```bash
npm install
cp .env.example .env   # fill in your Supabase keys
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |

## Deploy to Netlify

1. Push to GitHub
2. Connect repo on [netlify.com](https://netlify.com)
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables in Netlify dashboard

## Deploy to Vercel

```bash
npx vercel --prod
```

## AWS SES Setup

1. Go to [AWS Console → SES](https://console.aws.amazon.com/ses)
2. Verify your sending email/domain
3. Create a Configuration Set named `email-platform-events`
4. Add SNS event destination for: Send, Delivery, Open, Click, Bounce, Complaint
5. Set backend env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `SES_FROM_EMAIL`

## Architecture

```
Browser (React SPA)
    ↓ HTTPS
Netlify/Vercel (static hosting + CDN)
    ↓ API calls
Supabase (PostgreSQL + Auth + RLS)
    ↓ email events
AWS SES → SNS → Webhook → Supabase
```

## Database Schema

Key tables: `contacts`, `contact_lists`, `list_memberships`, `segments`, `templates`, `campaigns`, `campaign_lists`, `campaign_sends`, `email_events`, `suppression_list`, `user_roles`

## API Routes (Cloudflare Workers backend)

- `POST /api/public/campaigns/send` — queue campaign send
- `POST /api/public/campaigns/test-send` — send test email
- `GET /track/open` — record open event
- `GET /track/click` — record click, redirect
- `POST /api/public/ses/webhook` — handle SES bounces/complaints
- `POST /unsubscribe` — process unsubscribe
