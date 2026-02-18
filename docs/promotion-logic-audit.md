# Cadet Promotion Logic Audit (2026-02-18)

## Current compute paths found

- Worker import compute (status + ready derivation at ingest):
  - apps/worker/src/index.ts
  - `parseCadetPromotionFile()`
  - helper functions: `derivePtStatus()`, `deriveLeadOrAeStatus()`, `computeReadyFromSheetLogic()`

- API display-time recompute/fallback (ready only):
  - apps/api/src/routes/tenant.ts
  - `deriveReadyStatus()` and `isReadyForUi()` inside `GET /:slug/cadet-promotions`

- Frontend recompute (ready + needs + completed):
  - apps/web/src/pages/CadetPromotionsPage.vue
  - local functions: `needsList()`, `isChecklistReady()`, `checkProgress()`, `readyDisplay()`

## Drift/mismatch vs spreadsheet logic

1. Logic duplicated in 3 places (worker/api/web), producing inconsistent outputs.
2. API and UI were deriving readiness from partial fields (`ptStatus` + `cdStatus`) instead of full required status set.
3. Frontend recomputed needs/readiness independently from backend.
4. CAPWATCH raw fields for strict spreadsheet-equivalent computation (`MoralDateP`, `WelcomeCourseDate`, `StaffServiceDate`, etc.) were not persisted, preventing a single authoritative backend recompute.
5. No unit tests existed to lock spreadsheet rule boundaries (especially PT 182-day boundary and WC override).

## Fix strategy implemented

- Added one authoritative pure compute function in backend:
  - apps/api/src/lib/promotion/computeCadetPromotion.ts
- API route now computes and returns statuses/readiness/needs/explain from that function.
- Frontend now renders backend outputs (`ready`, statuses, `needs`, `explain`) and does not recompute readiness/needs.
- Worker now persists CAPWATCH raw date fields + requirement flags used by backend compute.
- Unit tests added for spreadsheet rule cases.
