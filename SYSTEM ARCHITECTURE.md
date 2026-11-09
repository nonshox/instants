# Project Master Specification --- Temporary Photo-Sharing Social Network

This document is the consolidated source of truth for an AI coding
agent. Treat all requirements below as binding. Do not invent features,
tables, fields, or behavior. Preserve concise readable names. If a
technical limitation prevents a requirement, explain it and propose the
smallest safe alternative before changing the design.

**Status:** Appwrite database and Storage foundation are created and
schema-checked. Application implementation is in progress and is not
production-ready.

## 1. Product

Build a web-only, minimalist photo-sharing social network for authentic
everyday photos shared with linked accounts. Priorities:
privacy, simplicity, meaningful connections, temporary shared content,
calm visual design. Avoid popularity mechanics, engagement bait,
endless-scroll patterns, autoplay, slideshows, forced loops, clutter,
comments, replies, and unrequested features.

Accounts/profiles are permanent. Photo posts are called **Instants** and
are temporary.

## 2. Product rules

### Profiles and privacy

-   Public account: anyone can view profile details and currently living
    Instants.
-   Private account: only linked accounts can view profile content and
    living Instants.
-   Every link request requires acceptance; pending requests grant no
    access.
-   Links are mutual: one canonical row per pair, no matter who asked.
-   All authorization is server-side; never trust browser-side
    visibility checks.
-   Profiles may carry one avatar photo. Avatars are square-cropped,
    re-encoded server-side (WebP), stored privately in Storage, and
    served only through an authorized Next.js route. The `users.avatar`
    column holds the Appwrite file ID.
-   Avatar replacement and removal are immediate; the previous file is
    deleted after the profile row is updated.

### Instants and feed

-   Photos only in v1.
-   Caption optional, one line, maximum 60 characters. Enforce in API.
-   Create is a single-square "beauty frame" composer: the camera
    starts automatically on open; choose, drag, paste, or capture a
    photo, crop it to 1:1, archive it locally first, then share. The
    caption is a short one-line field in a curved pill overlapping the
    frame's bottom border. Failed shares can be retried inline from
    the archived copy.
-   Owner can manually delete any Instant at any time.
-   Daily automatic cleanup deletes shared Appwrite image and post
    record only once at least 36 hours old. Since cleanup is daily, a
    post may remain visible longer than 36 hours until the next run. Do
    not impose an exact 36-hour visibility cutoff unless the owner
    changes this rule.
-   Main feed shows currently living Instants from accounts the user is
    linked with.
-   The user's own Instants do **not** appear in their main feed.
-   Newest first; natural manual scrolling; no autoplay, slideshow, or
    forced looping.

### Local personal gallery

-   Keep the owner's complete local copy of every Instant in IndexedDB:
    photo/blob, original date, likes, caption, and associated
    information.
-   After cloud expiry, the owner's personal gallery still shows the
    local copy.
-   Automatic expiry removes only the shared Appwrite image and post
    record; it must retain the IndexedDB copy.
-   Manual deletion is different: remove both Appwrite image/post and
    the corresponding IndexedDB copy permanently.
-   Personal gallery is a compact grid of small square thumbnails with
    no like cards, filters, search, or sorting. Shared status is shown
    as a subtle badge on the thumbnail only.
-   Opening a photo, in one click, shows a detail view with the photo,
    its caption (inline edit, one line, at most 60 characters), sync
    status, original date, file size, format, retry for failed shares,
    and delete with an inline confirmation.
-   Caption edits on a shared photo are stored server-side in
    `instants.cap` through an owner-only endpoint and mirrored to the
    IndexedDB archive; edits on local-only photos update only the local
    archive.
-   Personal gallery is private to its owner.

### Social interactions

-   Likes only. No comments/replies in v1.
-   Prevent duplicate likes per user/Instant; maintain counts
    server-side.
-   Link lifecycle: send request, accept or decline, then both accounts
    are linked. Either side can unlink; a sender can cancel a pending
    request. Sending a request to someone who already requested you
    accepts their request immediately instead of creating a duplicate.
-   Every link request requires acceptance, regardless of account
    privacy.
-   Connections is one simple vertical view: incoming requests appear
    first with accept/decline, then your links, then sent requests only
    while they are pending. There are no nested tabs. Links support
    unlink and block, and search is available at the top of the view.
-   Public user profiles support link/request, cancel request, accept
    link, unlink, and block actions. Profile links are available from
    link lists and notifications.
-   Privacy settings control public/private account visibility and provide
    a paginated blocked-account list. Unblocking does not recreate removed
    links or requests.
-   Blocking removes the single mutual link row, removes pending requests
    both directions, prevents profile/content access and interactions,
    and prevents notifications between the two users.

### Notifications and Telegram

-   All relevant notification types must be available in-app and sent
    through connected Telegram: link requests, link acceptances, likes,
    etc.
-   The in-app notifications page is a full page, not a card: header
    with unread count and a mark-all-read action, filter chips
    (All/Unread/Likes/Links), day grouping (Today/Earlier), relative
    timestamps, per-item mark read, and paginated older entries.
-   Never send notifications across a block relationship.
-   `notifications` stores in-app notifications; `tg` stores persistent
    Telegram mapping.
-   Secure Telegram linking flow:
    1.  Signed-in user requests connection.
    2.  Server generates cryptographically random one-time token.
    3.  Store only token hash in `tg_tokens` with app user ID, expiry,
        and unused flag.
    4.  Open bot `/start` with raw token.
    5.  Webhook validates hash, unused status, and expiry.
    6.  Mark token used and store Telegram user ID/chat ID in `tg`.
    7.  Use stored chat ID for notifications.
-   Telegram ID alone is not proof of account ownership. Prevent replay;
    never expose raw token/hash or bot secrets.
-   Use Appwrite Auth native session APIs for listing active sessions,
    revoking an individual session, and logout. Do not create a sessions
    table.

## 3. Design

High-quality, calm, minimalist, photography-first UI; elegant clean
typography; generous whitespace; intuitive navigation; no clutter or
engagement bait. Use shadcn/ui extensively and Lucide icons. Responsive
web app. Disable buttons when required inputs are empty/invalid.

-   Small screens get a compact full-width bottom bar (Links, Create,
    Feed, Profile) that hides at the `md` breakpoint and respects the
    safe-area inset: icon-only items, muted inactive glyphs, a tiny dot
    under the active destination, and a subtle top elevation shadow so
    it separates cleanly from content. Notifications lives in the top
    navbar (a bell with an unread badge) on every screen size, next to
    the avatar menu, which contains only Profile, Settings, and sign
    out. A back control is available in the navbar on all screen sizes.
-   Tapping a feed photo opens the same light, full-screen Instant
    viewer used everywhere: a soft ambient backdrop tinted by the
    photo, author and date up top, a close button, the square photo,
    caption, and a like action. Double-tapping the photo (in feed or
    viewer) likes it.
-   The profile photo gallery uses the same full-screen viewer with an
    archive-focused footer: status pill (Shared/Sharing/On this
    device/Not shared), inline caption editing, a compact meta strip
    (date · size · format), share retry for failed uploads, and delete
    with inline two-step confirmation.
-   Desktop shows a sticky, blurred top bar with a centered pill of
    text links (Links, Create, Feed) mirroring the mobile bar's order
    and destinations; active links are highlighted, and the bar stays
    pinned with a subtle backdrop blur while scrolling.
-   The app is responsive end to end (fluid grids, flexible media,
    `dvh`/`svh` layouts, safe-area insets). The viewport is configured
    with `interactive-widget=resizes-content` so the layout shrinks
    when the on-screen keyboard opens; text inputs render at 16px on
    small screens so iOS does not auto-zoom on focus.

## 4. Technology stack

-   Latest stable Next.js + TypeScript
-   shadcn/ui, Lucide icons
-   Axios
-   Zustand
-   IndexedDB
-   Appwrite Auth, TablesDB, Storage
-   Vercel hosting and Vercel Cron
-   Web application only; no native mobile app.

## 5. Architecture and trust boundaries

-   Appwrite Auth is the source of truth for identity, email
    authentication, and sessions.
-   `users.email` mirrors Auth email; it is not a separate identity
    source.
-   All application data operations go through Next.js
    `/api/.../route.ts` endpoints, including every table operation and
    image upload/deletion.
-   Browser never receives Appwrite server API key. No direct client
    TablesDB permissions.
-   Tables have row security enabled and table-level permissions empty.
    This is intentional for server-mediated access.
-   Storage has file security enabled. No public permanent image URLs.
-   All ownership, link, privacy, block, expiry, and authorization
    checks happen server-side.
-   Deliver private images through an authorized Next.js server route
    keyed by the canonical file ID in `instants.image`. Recheck
    ownership, link, privacy, block, and expiry rules before returning
    image bytes. Never expose a public permanent Storage URL.
-   Avatars are delivered through an authorized route keyed by the
    target user ID; the server resolves `users.avatar` internally and
    applies the same self/link/block/privacy checks before returning
    bytes.
-   Validate all input and IDs; never trust client-provided user IDs or
    ownership claims.
-   Suggested route capabilities: auth/profile sync; profile
    lookup/update; avatar upload/removal/delivery; link/request/accept/
    decline/cancel; feed; Instant upload/retrieval/manual
    delete/caption update; like/unlike; notifications/read
    state; block/unblock; Telegram link/webhook; session management;
    cron cleanup.
-   Keep route handlers thin and business logic in server-side service
    modules.

## 6. Existing Appwrite project

Project: - Name: `app` - Project ID: `6aea15b40039e4912cb4` - Database
name: `Production TablesDB` - Database ID: `6aea258f001dcc22a0c5`

Ten current tables were listed and verified as enabled; row security
enabled; configured columns/indexes showed `available`. This is the
intended table set. Do not add more tables without explicit approval.
`views` was added with explicit product approval alongside the reaction
row — it powers the owner-facing seen-by list. (An earlier design used
the same rows to filter seen Instants out of the viewer's feed; that was
removed by product decision — Instants appear until the 36h expiry
deletes them, seen or not.)

### `users`

Profile table; Appwrite Auth user ID is the row ID; no redundant
`userId` field. - `username`: varchar(30), required, unique. - `name`:
varchar(50), optional. - `bio`: text, optional. - `avatar`: varchar(36),
optional, default `""`; Appwrite file ID. - `private`: boolean, default
`true`. - `links`: integer, default `0`; mutual link count. -
`followers`/`following`: legacy integer counters retained for
compatibility and mirrored to `links`; application logic uses `links`.
- `likes`: integer, default `0`. - `email`: email type,
required, unique; mirror of Auth email. Indexes: `username_uq`
unique(`username`); `email_uq` unique(`email`). Counters are cached and
maintained only by trusted server-side operations.

### `follows`

-   One canonical mutual link per pair.
-   `follower`: varchar(36), required; the lexicographically smaller user
    ID.
-   `following`: varchar(36), required; the lexicographically larger user
    ID. Indexes: `follower_following_uq` unique(`follower`,`following`);
    `following_idx` on `following`. Because each pair is stored once,
    the same row serves both users.

### `requests`

-   `requester`: varchar(36), required.
-   `target`: varchar(36), required. Indexes: `request_target_uq`
    unique(`requester`,`target`); `target_idx` on `target`. Pending
    link requests never grant access. Accepting creates the mutual link
    row and deletes the request; declining deletes only the request.

### `instants`

-   `user`: varchar(36), required; owner ID.
-   `image`: varchar(36), required; canonical Appwrite file ID.
-   `expires`: datetime, required.
-   `likes`: integer, default `0`.
-   `cap`: varchar(100), optional, default `""`; API enforces one line
    and max 60 characters. Indexes: `user_expires_idx`
    composite(`user`,`expires`); `expires_idx` on `expires`.

### `likes`

-   `instant`: varchar(36), required.
-   `user`: varchar(36), required. Indexes: `instant_user_uq`
    unique(`instant`,`user`); `user_idx` on `user`.
-   `emoji`: varchar(8), optional in the database (Application: always
    written), whitelist-checked by the server; stores the viewer's chosen
    reaction emoji. Rows predating the column were backfilled to `❤️`.
    Reaction semantics unchanged: one reaction per viewer per Instant;
    switching emoji rewrites the same row and does not touch counters.
    `instants.likes` / `users.likes` remain the total reaction counters. Allowed values: `❤️ 🔥 😍 👏 🙌 🤩 😄 🎉 💪 🥹 ✨`
    (positive reactions only). Appwrite refused a default on a required
    column, so requiredness is enforced at the application layer.
-   Per-viewer mute state (`mono.muted`) and seen Instant ids
    (`mono.seen`) are deliberately kept in **localStorage** on the device
    that created them, not in Appwrite tables. Promoting them requires a
    table proposal — `views` is the only new table that has been approved.

### `views`

One row per viewer per Instant; records that they have dealt or reacted
to it. Powers the owner's seen-by list. (Rows do NOT filter the feed —
that behaviour was removed by product decision.)

-   `instant`: varchar(36), required; the Instant row ID.
-   `user`: varchar(36), required; the viewer's Appwrite user ID.
-   `seen`: datetime, required; first sighting (writes are idempotent on
    `instant_user_uq`). Indexes: `instant_user_uq`
    unique(`instant`,`user`); `instant_idx` on `instant` (desc).
-   Visibility matches Instant viewing exactly; an owner may only read
    the seen-by list of their own Instants. Rows are purged by the daily
    cleanup together with the Instant and its `likes` rows.

### `notifications`

-   `recipient`: varchar(36), required.
-   `actor`: varchar(36), required.
-   `type`: varchar(24), required.
-   `instant`: varchar(36), optional.
-   `read`: boolean, default `false`. Index: `recipient_read_idx`
    composite(`recipient`,`read`). Application types are
    `link_request`, `link_accepted`, and `like`; legacy
    `follow_request`, `follow_approved`, and `new_follower` rows remain
    renderable. The only `like` row created today is a reaction ping
    (any emoji, not only ❤️); reaction semantics stay: one reaction per
    viewer per Instant (switching emoji rewrites the same row).
-   **Reaction pings are digest-gated to one per Instant per 24h** per
    viewer — after the first reaction of that window the in-app
    notification and the Telegram ping are both suppressed. Switched
    reactions (same viewer, different emoji on an existing row) never
    generate a notification.
    renderable.

### `blocks`

-   `blocker`: varchar(36), required.
-   `blocked`: varchar(36), required.
-   `created`: datetime, required. Indexes: `blocker_blocked_uq`
    unique(`blocker`,`blocked`); `blocked_idx` on `blocked`.

### `tg`

Persistent Telegram mapping: - `user`: varchar(36), required. - `tid`:
varchar(32), required; Telegram user ID. - `chat`: varchar(32),
required; Telegram chat ID. - `created`: datetime, required. Indexes:
`user_uq` unique(`user`); `tid_uq` unique(`tid`).

### `tg_tokens`

Temporary one-time linking tokens: - `user`: varchar(36), required. -
`hash`: varchar(64), required; hash only, never raw token. - `expires`:
datetime, required. - `used`: boolean, default `false`. Indexes:
`hash_uq` unique(`hash`); `expires_idx` on `expires`. Server-only. Clean
expired/used rows safely.

### Schema history / naming constraints

-   `instants.caption` was renamed to `cap`.
-   `blocks.createdAt` was renamed to `created`.
-   Canonical Instant image field is `image`; do not recreate
    `imageFileId`.
-   Avatar field is `avatar`; do not recreate `avatarFileId`.
-   `avatar` and `image` were expanded to varchar(36) for Appwrite file
    IDs.
-   Long Telegram table names were replaced with `tg` and `tg_tokens`.
-   Current verified inventory is exactly: `users`, `follows`,
    `requests`, `instants`, `likes`, `views`, `notifications`, `blocks`,
    `tg`, `tg_tokens`.
-   The social model was rebuilt as mutual links on the existing
    `follows`/`requests` tables. `follows` stores one canonical row per
    pair with sorted user IDs; `users.links` is the canonical counter.
    `followers`/`following` are legacy mirrors.
-   Do not create a separate profiles table, reports/settings/devices
    tables, or sessions table. Do not rename all fields into cryptic
    abbreviations.

## 7. Existing Appwrite Storage bucket

-   Bucket ID: `bucket`
-   Name: `Instant Photos`
-   Enabled.
-   File security enabled.
-   Max size: `10,000,000` bytes (10 MB).
-   Verified extensions: `jpg`, `jpeg`, `png`, `webp`.
-   Encryption, antivirus, and transformations enabled.
-   Compression: none.
-   Recommended practical upload target discussed: about 1--5 MB; hard
    limit remains 10 MB.
-   Validate actual content type, size, and image format server-side; do
    not trust filename/browser MIME alone.
-   Consider stripping GPS/EXIF metadata.
-   HEIC/HEIF/AVIF support was discussed but not applied or verified. Do
    not assume enabled.
-   Avoid orphan files/rows; make failed deletions retryable.
-   Keep files private; authorize before serving.

## 8. Authentication

-   Email-only native Appwrite Email OTP sign-in. The owner approved the
    native six-digit code instead of a custom four-digit flow.
-   The current Appwrite SDK documents six-digit codes with a
    15-minute validity period; verify actual project behavior during
    end-to-end testing.
-   Include expiry, rate limiting, attempt limits, and abuse protection.
-   The server stores Appwrite session secrets only in HttpOnly cookies.
-   Synchronize Auth email into `users.email`.
-   Use native Appwrite sessions; no sessions table.

## 9. IndexedDB and sync

-   Persist owner's photo/blob and full Instant metadata in IndexedDB.
-   Local archive is private and user-specific.
-   It remains available after cloud expiry.
-   Automatic cleanup never deletes local archive.
-   Manual deletion deletes cloud and local copies.
-   Handle upload/local-save failure explicitly; do not claim archive
    success if local save failed.
-   Define stable local IDs and a reliable sync strategy.
-   Expired local Instants belong in personal gallery, not shared feeds.

## 10. Daily expiration cleanup

-   Vercel Cron runs daily.
-   Find Instants at least 36 hours old according to the agreed expiry
    policy.
-   Delete Appwrite Storage image, then delete corresponding `instants`
    row, then cascade-purge its `likes`, `views`, and `notifications`
    rows pointing at it.

### Owner engagement archival (before the cascade)

-   On archive open and manual refresh, the client snapshots the owner's
    live Instants with full engagement via `/api/instants/mine` —
    caption, totals, emoji breakdown, and per-viewer
    `{ userId, seenAt, reaction }` — and merges it into the owner's local
    IndexedDB archive record for that Instant. This is the owner's only
    record once expiry purges the server rows.
-   Engagement viewer ids are resolved to CURRENT public identities at
    render time via `/api/auth/resolve-profiles` — the requester may
    resolve their own id or any id they are currently linked with;
    anything else resolves to a privacy blank ("Someone you don't
    know"). Profiles are never duplicated into the IndexedDB snapshot.
-   The archive viewer renders the reaction breakdown (emoji + count,
    sorted) and an expandable seen-by list — works offline for the
    snapshot itself; identity resolution degrades to blanks offline.

-   Also purge already-read `notifications` on each run (unread rows are
    never touched). The retention window is configured in
    `src/features/cron/cleanup.ts` via `READ_NOTIFICATIONS_RETENTION_DAYS`
    (0 = delete all read rows daily; e.g. 7 keeps a week of read history).
-   Never delete IndexedDB copy during automatic expiry.
-   Make job idempotent, batch-based, retry-safe.
-   If file deletion fails, retain row/reference and retry later.
-   Protect cron endpoint with a secret.
-   Log counts and failures without secrets or private image data.
-   Cron schedule/timezone and final query implementation remain to be
    configured.

## 11. Security checklist

Mandatory: - Server-side authorization for every protected operation. -
Appwrite API key only in server environment variables. - No direct
client TablesDB permissions under this architecture. - Private Storage;
no public permanent image URLs. - Validate all input, IDs, captions,
file sizes, actual file content, and allowed operations. - Enforce
public/private profile rules, linked-account access, block rules,
ownership, and expiry on server. - Apply block checks to profile views,
feeds, likes, link operations, and notifications. - Enforce expiry
before returning feed records or image bytes. - Rate-limit email code
requests/attempts, link requests, likes, Telegram linking, and
abuse-prone routes. - One-time expiring hashed Telegram tokens; protect
webhook. - CSRF/origin protections appropriate to session/cookie
design. - Secure HttpOnly SameSite cookies where applicable. - Avoid
leaking whether private users/content exist through errors. - Never
expose secrets, token hashes, or sensitive server errors.

## 12. Deployment and environment

Deploy Next.js to Vercel. Configure Vercel Cron for daily cleanup and
configure Telegram webhook after deployment.

Expected server environment configuration includes: - Appwrite
endpoint. - Appwrite project ID. - Appwrite database ID. - Appwrite
server API key. - Appwrite Storage bucket ID. - App/session settings
required by chosen SDK. - Telegram bot token. - Telegram webhook
secret. - Application base URL. - Cron secret. - Email provider settings
only if a custom code flow is required.

Use real values from the project in local/server environment only. Never
hardcode secrets or commit `.env`.

## 13. Implementation quality

-   TypeScript types for rows, API inputs/outputs, and domain entities.
-   Centralized validation.
-   Axios for API calls; Zustand for appropriate client state.
-   shadcn/ui and Lucide icons.
-   Database access only in server-side modules.
-   Consistent API error shape and HTTP status codes.
-   Pagination for feed, notifications, and large lists.
-   Use existing indexes; add an index only when a real query needs it
    and owner approves schema change.
-   Maintain counters safely on server; support reconciliation if
    needed.
-   Make link/request/like/block/delete operations idempotent or
    race-safe.
-   Test authorization and lifecycle rules, not only UI happy paths.

## 14. Minimum test plan

Authentication/profile: - Valid, invalid, expired code; rate limits and
excessive attempts. - Profile creation and email synchronization. -
Unique username/email constraints. - Session listing, revocation,
logout. - Avatar upload/replacement/removal; avatar bytes are authorized for
    the owner, linked accounts of private accounts, and signed-in viewers
    of public accounts. Private avatars stay hidden from non-linked
    viewers and from blocked accounts in both directions.

Privacy/relationships: - Private profile inaccessible to
non-linked accounts. - Pending request grants no access. - Acceptance
grants access. - Unlink removes private access. - Block removes links
and prevents access/interactions both ways.

Feed/Instants: - Feed only contains living Instants from linked
accounts. - Own Instants excluded from own main feed. - Newest-first
order. - Expiry behavior matches daily cleanup policy. - Caption
optional, one line, max 60 characters. - Unauthorized users cannot retrieve
private image bytes.

Likes/notifications: - Duplicate like rejected. - Counts accurate. -
Correct in-app notification. - Telegram notification only for linked
account. - No notifications across block relationship.

Local archive/deletion: - Upload saves cloud and local copies. -
Automatic expiry removes cloud copy and preserves IndexedDB. - Personal
gallery retains expired local Instant and metadata. - Manual deletion
removes cloud and local copies. - Failed cloud deletion remains
retryable and does not silently orphan file.

Telegram: - Valid token links correct account. -
Invalid/expired/used/replayed tokens rejected. - Unique Telegram mapping
enforced. - Correct chat ID used. - No token/secret leakage.

Cron: - Cron secret required. - Idempotent cleanup. - Failed file
deletion retains row for retry. - Batch processing and safe logs.

## 15. Completion status

### Completed / verified foundation

-   Appwrite project created.
-   Appwrite database created.
-   Nine tables created; row security enabled.
-   Configured columns and indexes listed and showed `available`.
-   Storage bucket `bucket` created and enabled.
-   File security, encryption, antivirus, transformations, max size, and
    allowed extensions verified.

### Implemented application foundation

-   Responsive sign-in UI for native Appwrite six-digit Email OTP.
-   Server-side OTP verification and HttpOnly Appwrite session cookie.
-   Native Appwrite session listing, individual revocation, and logout.
-   Authenticated profile onboarding and editing through the existing
    `users` table, with server-side identity and row ownership.
-   Avatar upload/removal through `/api/profile/avatar` (square-cropped
    WebP stored privately in Storage; `users.avatar` holds the file ID)
    and authorized delivery through `/api/avatars/[userId]`, enforced for
    the owner, linked accounts of private accounts, signed-in viewers of
    public accounts, and both block directions. Avatars render across the
    workspace: header menu, profile, public profiles, links, search,
    blocked-account list, feed, and notifications.
-   Personal photo library rebuilt as a compact square grid with no like
    cards, filters, search, or sorting; one click opens a detail view
    with inline caption editing (`PATCH /api/instants/[instantId]`),
    sync status, original date, size, format, retry, and delete with
    inline confirmation.
-   Username lookup and transactional mutual-link requests,
    acceptance/decline/cancellation, bidirectional block cleanup, and
    transactional counter updates.
-   Links feed, privacy- and block-checked image delivery, validated
    and re-encoded uploads, owner-only IndexedDB archive, and manual
    cloud/local deletion.
-   Idempotent like/unlike operations, transactional like counters, and
    in-app like notification records.
-   Paginated in-app notification listing/read state, and notifications
    for likes, link requests, and link acceptances. Blocked users are
    filtered from notification views and Telegram delivery.
-   Hashed, expiring, one-time Telegram linking tokens; authenticated
    connect/disconnect endpoints; secret-verified private-chat webhook;
    Telegram delivery with bounded transient retries.
-   Tailwind/shadcn UI migration and protected daily Vercel cleanup for
    expired Instants and Telegram linking tokens.
-   Auth/profile/social/Instant input and policy tests, lint, typecheck,
    and production build pass.
-   Live Appwrite email delivery and session behavior are not yet
    end-to-end verified. Live social, Storage, and transaction
    operations, Telegram webhook setup, and Vercel Cron are also not yet
    verified.

### Not yet built or verified

-   Production-grade distributed rate limiting and security testing.
-   Live production configuration/verification for Telegram webhook and
    Vercel Cron.
-   Durable retry queue for Telegram delivery; the existing schema has
    no delivery-state field or queue table, so failed outbound delivery
    is logged and the in-app notification remains available.

## 16. Non-negotiable constraints for the coding agent

1.  Do not add unnecessary tables or duplicate columns.
2.  `users` is the profile table; no separate profiles table.
3.  Use Appwrite Auth sessions; no sessions table.
4.  No reports/settings/devices tables in v1.
5.  No comments or replies in v1.
6.  Do not show own Instants in own main feed.
7.  Automatic expiry must preserve IndexedDB archive.
8.  Manual deletion must remove both cloud and local copies.
9.  Pending link requests never grant private access.
10. Never trust browser-side authorization.
11. Never expose Appwrite server key or Telegram secrets.
12. Never make private images publicly accessible.
13. Use the approved native six-digit Appwrite Email OTP flow; do not
    silently replace it with custom authentication.
14. Verified bucket formats are JPG/JPEG/PNG/WebP only; do not assume
    HEIC/HEIF/AVIF.
15. Preserve concise, readable schema names.
16. If a requirement conflicts with actual API/framework capability,
    explain and ask before changing product behavior.

**End of master specification.**
