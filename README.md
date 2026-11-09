# Instant

Instant is a privacy-first photo-sharing web app for sharing everyday
photos with linked accounts. Its product requirements and
Appwrite schema are defined in [SYSTEM ARCHITECTURE.md](./SYSTEM%20ARCHITECTURE.md).

## Current implementation

The current application foundation includes:

- Native Appwrite six-digit Email OTP sign-in (15-minute code validity).
- Server-side code verification and HttpOnly session cookies.
- Active-session listing, individual revocation, and logout using
  Appwrite Auth sessions.
- A private-by-default `users` row created at first successful sign-in,
  with an editable generated username and profile settings.
- Username lookup, privacy-aware profile details, mutual link requests,
  acceptance/decline/cancellation, and blocking. Link/block changes and
  cached counters use Appwrite transactions.
- A links feed with server-side visibility and block filtering,
  private server-mediated image delivery, and manual Instant deletion.
- JPEG, PNG, and WebP validation/re-encoding for uploads, with private
  Appwrite Storage files and a complete owner-only IndexedDB archive.
- Idempotent like/unlike actions with server-side counters and in-app
  notifications.
- Paginated notification inbox, read state, and filtering of blocked users.
- Typed per-viewer reactions (emoji persisted per Instant), seen-aware
  feed filtering (dealt or reacted Instants leave your feed), and an
  owner-facing seen-by list on own Instants. Owner engagement
  (reactions, viewers) is snapshotted into the local IndexedDB archive,
  with ids resolved to current identities at render time (linked
  accounts only); identities never leave the server with cached names.
  Daily cleanup purges reactions, views, and instant-linked
  notifications together with expired Instants, and also purges
  already-read notifications on every run (unread rows are kept).
- Paginated link lists, received and sent link requests,
  public user profiles, and privacy controls for blocked accounts.
- One-time hashed Telegram linking, webhook verification, disconnect, and
  message delivery for likes, link requests, and link acceptances.
- A protected daily Vercel Cron for expired Instants and Telegram tokens.
- Tailwind CSS and shadcn/ui components for the application interface.
- Feature-scoped Zustand stores for shared Instant and notification UI
  state, with a centralized Axios client and feature API modules. Form
  state remains local; authentication and authorization stay server-side.
- A dedicated `/auth` route and protected workspace routes for `/create`,
  `/connections`, `/u/[username]`, `/profile`, `/notifications`, and `/settings`. The root
  route opens the Instants feed for signed-in users. The Proxy redirects
  requests without a session cookie, and the workspace server layout
  validates the Appwrite session before rendering protected pages. API
  handlers continue to validate the session and authorize each operation.

The app is not production-ready: Appwrite email delivery, session
behavior, social, Storage, transactions, Telegram webhook setup, and
Vercel Cron operation still need live end-to-end verification.

## Local development

Requirements: Node.js 20.9 or newer and npm.

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Set these server-side values in `.env.local` or the deployment environment:

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_STORAGE_BUCKET_ID` (private bucket used for Instant images)
- `APPWRITE_API_KEY` (server only; never use a `NEXT_PUBLIC_` prefix)
- `TELEGRAM_BOT_USERNAME` (without a leading `@`)
- `TELEGRAM_BOT_TOKEN` (server only)
- `TELEGRAM_WEBHOOK_SECRET` (set the same secret when registering the Telegram webhook)
- `CRON_SECRET` (Vercel Cron bearer secret)

After deploying, set Telegram's webhook URL to
`https://<your-domain>/api/telegram/webhook` and configure its secret
token to match `TELEGRAM_WEBHOOK_SECRET`. Configure the same deployment
with `CRON_SECRET` for the daily `/api/cron/cleanup` job in `vercel.json`.
Environment files are ignored by Git. Never commit credentials.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Email token requests use Appwrite's unauthenticated Auth endpoint so
Appwrite's native rate limits remain enabled. Server-originated Auth
requests share the server's IP for provider rate limiting; a distributed
per-user/IP limiter for authentication, social actions, and Telegram link
requests is still needed before public production use. Telegram delivery
retries transient errors, but remains best-effort if Telegram is
unavailable; in-app notifications are stored independently.
