# Event Calendar / RSVP / Notifications Build Plan

Status: Draft implementation plan (no code changes yet)
Date: 2026-02-18
Owner: SquadronForge

## Goals

- Tenant-aware event calendar similar to Spond workflows.
- RSVP statuses: `yes`, `no`, `maybe`.
- Audience defaults to all members with filterable views.
- Notifications via email and web push.
- App-first source of truth.
- Optional Google Calendar sync (phase rollout, one-way first).

## Product Decisions (Locked)

- RSVP states: `yes`, `no`, `maybe`
- Notifications: email + push
- Source of truth: SquadronForge (authoritative)
- Attendance visibility: all + filter controls
- Tenant scoping: required on all event-related data

## Phase Plan

### Phase A — Core Events + RSVP (MVP)

Deliverables:
- Event CRUD for tenant admins.
- Tenant users can view events and submit/update RSVP.
- Event list/calendar view with filters.
- Basic attendance counters (yes/no/maybe/unknown).

Out of scope:
- Google Calendar sync
- Push notifications
- Recurrence engine

### Phase B — Notifications

Deliverables:
- Reminder scheduling (e.g., 24h and 2h before).
- Email notifications for event publish/update/reminder.
- Web push notifications for event publish/update/reminder.
- RSVP action links from notifications.

### Phase C — Google Calendar One-Way Sync

Deliverables:
- Tenant-level Google OAuth connect/disconnect.
- Push SquadronForge event creates/updates/deletes to Google Calendar.
- Store per-event Google IDs and sync status.

### Phase D — Hardening + Enhancements

Deliverables:
- Conflict/retry handling and observability.
- Optional recurrence support.
- ICS export and attendance export.
- Optional two-way sync (only after policy and conflict rules are approved).

## Data Model (Prisma Additions)

### Enums

- `EventVisibility`: `tenant`, `audience`
- `RsvpStatus`: `yes`, `no`, `maybe`
- `NotificationChannel`: `email`, `push`
- `NotificationType`: `publish`, `update`, `reminder`, `cancel`
- `NotificationStatus`: `queued`, `sent`, `failed`, `skipped`
- `GoogleSyncStatus`: `pending`, `synced`, `failed`

### Models

1. `Event`
- `id` (cuid)
- `tenantId` (FK)
- `title`
- `description` (nullable)
- `location` (nullable)
- `startsAt` (DateTime)
- `endsAt` (DateTime)
- `allDay` (boolean)
- `visibility` (`EventVisibility`)
- `createdByUserId` (FK User)
- `updatedByUserId` (FK User, nullable)
- `isCancelled` (boolean)
- `cancelReason` (nullable)
- `createdAt`, `updatedAt`

Indexes:
- `(tenantId, startsAt)`
- `(tenantId, isCancelled, startsAt)`

2. `EventAudienceRule`
- `id`
- `tenantId`
- `eventId` (FK)
- `memberType` (nullable: `CADET`/`SENIOR`)
- `unitCharter` (nullable)
- `expressionJson` (nullable for future advanced rules)

Indexes:
- `(tenantId, eventId)`

3. `EventRsvp`
- `id`
- `tenantId`
- `eventId` (FK)
- `userId` (FK User, nullable)
- `capid` (nullable for member-first mapping)
- `status` (`RsvpStatus`)
- `note` (nullable)
- `respondedAt`
- `source` (e.g., `web`, `email-link`, `push-link`)

Uniqueness:
- unique `(tenantId, eventId, userId)` when userId exists
- optional guard for capid path `(tenantId, eventId, capid)`

4. `EventNotification`
- `id`
- `tenantId`
- `eventId` (FK)
- `channel` (`NotificationChannel`)
- `type` (`NotificationType`)
- `scheduledAt`
- `sentAt` (nullable)
- `status` (`NotificationStatus`)
- `errorMessage` (nullable)
- `payloadJson`

Indexes:
- `(tenantId, status, scheduledAt)`
- `(tenantId, eventId, channel, type)`

5. `PushSubscription`
- `id`
- `tenantId`
- `userId`
- `endpoint`
- `p256dh`
- `auth`
- `expiresAt` (nullable)
- `lastSeenAt`
- `createdAt`

Uniqueness:
- unique `(tenantId, userId, endpoint)`

6. `GoogleCalendarConnection` (Phase C)
- `id`
- `tenantId` (unique)
- `googleCalendarId`
- `accessTokenEncrypted`
- `refreshTokenEncrypted`
- `tokenExpiresAt`
- `scopes`
- `createdAt`, `updatedAt`

7. `EventGoogleSync`
- `id`
- `tenantId`
- `eventId`
- `googleEventId`
- `status` (`GoogleSyncStatus`)
- `lastAttemptAt` (nullable)
- `lastError` (nullable)

Uniqueness:
- unique `(tenantId, eventId)`

## API Contract (Tenant Routes)

Base prefix: `/tenant/:slug`

### Events

- `GET /events`
  - Query: `from`, `to`, `q`, `memberType`, `unitCharter`, `status` (`active|cancelled`)
  - Returns paged list + counts

- `POST /events` (tenantAdmin)
  - Body: `{ title, description?, location?, startsAt, endsAt, allDay, visibility, audienceRules? }`

- `GET /events/:eventId`
- `PATCH /events/:eventId` (tenantAdmin)
- `DELETE /events/:eventId` (tenantAdmin, soft cancel preferred)

### RSVP

- `PUT /events/:eventId/rsvp`
  - Body: `{ status: 'yes'|'no'|'maybe', note? }`
  - Upserts caller RSVP

- `GET /events/:eventId/rsvps` (tenantAdmin or privileged view)
  - Query: optional filters for status/memberType

### Notifications

- `POST /events/:eventId/notify` (tenantAdmin)
  - Body: `{ type: 'publish'|'update'|'reminder', channels: ['email','push'], scheduledAt? }`

- `POST /notifications/push-subscriptions`
  - Body: web push subscription payload

- `DELETE /notifications/push-subscriptions`
  - Body: `{ endpoint }`

### Google Sync (Phase C)

- `GET /integrations/google-calendar/status`
- `POST /integrations/google-calendar/connect`
- `POST /integrations/google-calendar/disconnect`
- `POST /events/:eventId/google-sync`

## Authorization Rules

- `systemAdmin`: full cross-tenant access.
- `tenantAdmin`: full event management for assigned tenant.
- `tenantViewer`: read events + RSVP self.
- All endpoints enforce tenant access through existing tenant access helpers.

## Notification & RSVP Response Flow

1. Event created/updated.
2. Notification records created in `queued` state.
3. Worker processes due notifications:
   - send email (with signed action links)
   - send web push
4. RSVP action link endpoint verifies signature + expiry + tenant/event scope.
5. RSVP upsert stored with source channel (`email-link` or `push-link`).

## Signed RSVP Links

Use HMAC-signed short-lived token with payload:
- `tenantId`, `eventId`, `userId`, `targetStatus`, `exp`

Security controls:
- short TTL (e.g., 72h)
- one-click idempotent upsert
- optional nonce replay guard for stricter mode

## Worker Jobs

New queues/jobs:
- `event-notifications-dispatch`
- `event-reminder-scheduler`
- `event-google-sync` (Phase C)

Reliability:
- retry with exponential backoff
- dead-letter/fail status updates on terminal failure
- per-tenant rate controls where needed

## Web UI Plan

### Navigation
- New top-level page: `Events`

### Views

1. Event list/calendar view
- Month/week toggle (phase-based)
- Filters: date range, audience, RSVP status, member type, text search

2. Event detail drawer/page
- Metadata, attendee counts, RSVP controls
- Admin tools: edit/cancel/send notification

3. Create/edit modal
- title, date/time, location, visibility, audience rules

4. Tenant settings additions (later phase)
- reminder defaults
- Google Calendar connection status

## Push Notification Prereqs

- VAPID keys in environment
- Service worker action handling
- Per-user subscription lifecycle management

## Google Calendar Sync Policy (App-First)

- SquadronForge is canonical.
- Local create/update/delete triggers outbound sync.
- If Google update fails, local state remains; sync status marks failure and retries.
- No inbound overwrite in Phase C.

## Observability

Add metrics/logs:
- notifications queued/sent/failed by tenant/channel
- RSVP conversion rates by event
- Google sync success/failure counts
- queue latency and retry counts

## Acceptance Criteria (MVP A + B)

- Tenant admin can create/edit/cancel events.
- Tenant user can RSVP yes/no/maybe and update response.
- Event views are tenant-isolated and filterable.
- Email and push reminders send successfully.
- One-click RSVP links update RSVP reliably.
- Audit/log trail exists for send and response events.

## Suggested Build Order (Tasks)

1. Prisma schema + migration for Event/RSVP/Notification core
2. API routes for event CRUD + RSVP
3. Web pages/components for event list/detail/create/edit + RSVP
4. Worker notification scheduling/dispatch
5. Push subscription API + web client hookup
6. Signed RSVP action links + endpoint
7. Google Calendar one-way sync (Phase C)

## Risks / Notes

- Push support differs by browser/platform; keep graceful fallback to email.
- Two-way Google sync is complex; defer until one-way is stable.
- Member identity mapping (`userId` vs `capid`) should be finalized early to avoid rework.
