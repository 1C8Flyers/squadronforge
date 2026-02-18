# CAP Chat Compliance Roadmap (Saved Plan)

Status: Draft for later implementation
Owner: SquadronForge
Last updated: 2026-02-18

## 1) Objective
Design and implement a chat system for SquadronForge that aligns with Civil Air Patrol Cadet Protection expectations (including two-deep visibility, auditability, and moderation controls).

## 2) Compliance-first assumptions
- No unmonitored adult-to-cadet 1:1 communications.
- Cadet-visible communications must have supervisory visibility by policy.
- Messages and moderation events must be auditable and non-repudiable.
- Role-aware controls must enforce cadet vs senior permissions.

## 3) Policy requirements to confirm before coding
1. Exact CAPR 60-2 and local supplement language in scope.
2. Definition of approved communication patterns:
   - Allowed: unit channels, flight channels, event channels.
   - Disallowed or restricted: adult↔cadet direct messages.
3. Required observer models:
   - minimum number/type of senior observers
   - parent visibility requirements
4. Data retention period, legal hold, and export obligations.
5. Who can review reports and incident evidence.

## 4) Product requirements (MVP)
### 4.1 Access model
- Identity roles: cadet, senior, parent-observer, admin, compliance-officer.
- Policy engine: `canCreateThread`, `canPostMessage`, `canDM`, `canAttachFile`, `canDeleteMessage`, `canViewAudit`.

### 4.2 Safe communication model
- Group channels only for cadet communications in MVP.
- 1:1 adult↔cadet DM blocked by policy.
- Channel membership validation requires supervision conditions.

### 4.3 Audit and moderation
- Immutable message log with append-only audit events.
- Every moderation action creates an audit record.
- In-app report flow with severity, assignee, and SLA timestamps.

### 4.4 Transparency and controls
- Message history visible to authorized supervision roles.
- Read receipts optional; moderation and incident visibility mandatory.
- Attachment scanning and extension allowlist.

## 5) Technical architecture proposal (for current stack)
### 5.1 Backend (API)
- New modules:
  - `chat` (channels, memberships, messages)
  - `chatPolicy` (enforcement)
  - `moderation` (reports, cases)
  - `audit` (immutable event stream)
- Real-time transport: WebSocket gateway with server-side authorization on every event.

### 5.2 Database (Prisma/Postgres)
Proposed models:
- `ChatChannel`
- `ChatChannelMember`
- `ChatMessage`
- `ChatMessageEdit`
- `ChatAttachment`
- `ChatReport`
- `ChatModerationCase`
- `ChatAuditEvent`

Required properties:
- Message timestamps, actor IDs, policy decision reasons.
- Soft-delete flags for UI only; original content retained for audit.

### 5.3 Worker
- Async tasks for:
  - attachment scanning
  - policy backfill checks
  - moderation notification workflows
  - retention and legal hold processing

### 5.4 Frontend (web)
- Views:
  - channel list
  - channel thread
  - report modal
  - moderation queue
  - compliance dashboard
- Policy-aware UI states that hide blocked actions and explain why.

## 6) Delivery phases
### Phase 0: Policy lock (required)
- Finalize approved interaction matrix and retention rules.
- Produce sign-off checklist.

### Phase 1: MVP safe channels
- Group channels, posting, read history.
- Policy engine blocks forbidden patterns.
- Immutable audit records and report button.

### Phase 2: Moderation and compliance operations
- Case management workflow.
- Officer dashboards and exports.
- Supervisor visibility tooling.

### Phase 3: Advanced controls
- Automated content risk triage.
- Parent observer options (if required by policy).
- Compliance analytics and periodic attestation reports.

## 7) Acceptance criteria
- No policy-violating thread can be created.
- Every message action is traceable in audit logs.
- Reported content can be triaged end-to-end with timestamps.
- Retention/export works for compliance review.
- Pen test and authorization test suite pass.

## 8) Risks and mitigations
- Risk: policy ambiguity across wings/squadrons.
  - Mitigation: configuration-driven policy profile with explicit defaults.
- Risk: overblocking useful communication.
  - Mitigation: role-based exceptions only with audit trail.
- Risk: privacy/security incidents.
  - Mitigation: least privilege, encryption in transit/at rest, access audits.

## 9) Implementation backlog starter
1. Define policy matrix document (`who can message whom`).
2. Add Prisma schema draft for chat + audit entities.
3. Build policy engine with unit tests first.
4. Implement channel + message APIs with policy checks.
5. Add web channel UI and report flow.
6. Add moderation case dashboard.
7. Add retention/export jobs and compliance report endpoint.

## 10) Decision log placeholders
- [ ] DM policy finalized
- [ ] Parent observer scope finalized
- [ ] Retention duration finalized
- [ ] Incident escalation chain finalized
- [ ] Legal/privacy review complete
