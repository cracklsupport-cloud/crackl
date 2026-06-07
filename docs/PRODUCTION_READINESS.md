# CRACKL Production Readiness Runbook

## 1. Secrets

- Rotate `SUPABASE_SERVICE_ROLE_KEY` before launch.
- Generate a fresh `JWT_SECRET` with at least 32 random characters.
- Replace the development `ADMIN_SECRET`.
- Keep backend `.env` out of Git, screenshots, logs, and client bundles.

## 2. Deploy Topology

Recommended split:

- Frontend: static Expo web export on a CDN host.
- Backend: Node/Express service with HTTPS, autoscaling, and `/health` + `/ready` probes.
- Database/media: Supabase Postgres + Supabase Storage.

Production frontend must set:

```text
EXPO_PUBLIC_BACKEND_URL=https://api.your-domain.com
```

Production backend must set:

```text
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
ALLOWED_MEDIA_ORIGINS=https://your-supabase-project.supabase.co
```

## 3. Mandatory Checks

Frontend:

```bash
npm run verify
```

Backend:

```bash
cd CRACKL-backend
npm run verify
```

Supabase:

- Confirm no public table grants for `anon` or `authenticated`.
- Confirm no public routine grants for `anon` or `authenticated`.
- Run security and performance advisors.
- Treat unused-index warnings as traffic-dependent; remove only after production query patterns are clear.

## 4. Mode QA Matrix

Run these with at least two real accounts:

- Standard Queue: fetch, answer wrong, answer correct, stats update.
- Brain Blast: typed answer, typo rejection, correct typed answer.
- Eclipse Level: ranked profile, rating delta, leaderboard.
- Cold Case: one-per-day lock, Panic Mode timer, resumed active riddle.
- Gauntlet: sequential progress, three-strike elimination, timer in Panic Mode.
- The Chain: next-node unlock, failure reset, timer in Panic Mode.
- Blind Wager solo: stake lock, win payout, loss penalty, refresh/back-button resistance.
- War Room Dead Heat: create, join, start, answer, next round.
- War Room Panic: timer visible for all players and survives refresh.
- War Room Blind Wager: same buy-in for all players, winner gets pot, no-winner refund.
- Allied Ops: no Blind Wager, shared solve, team result.
- Bounty Board: first attempt locks, second attempt denied, solved prize awarded.
- Challenge link: exact riddle opens, defender result settles once.

## 5. Admin QA Matrix

- Login with admin secret.
- Stats load.
- Maintenance toggle works.
- Panic timer saves and is reflected in user modes.
- Add text riddle.
- Add image + text riddle.
- Add image-only riddle.
- Add audio + text riddle.
- Add video + text riddle.
- Add interactive asset riddle.
- Drag/resize preview elements.
- Save and verify user-facing `RiddleContent` layout.
- Bulk upload rejects malformed JSON.
- Duplicate detection blocks near duplicates.
- Delete archives riddles with live history instead of breaking foreign keys.

## 6. Monitoring

Minimum alerts:

- `/health` fails.
- `/ready` fails.
- API 5xx rate spikes.
- `/answer`, `/room/answer`, `/wager/settle`, `/bounty/attempt` error rate spikes.
- Supabase database CPU/connection saturation.
- Supabase Storage upload failures.
- Admin route 403 spikes.
- Auth login/signup 401/500 spikes.

## 7. Release Rule

Do not release if any of these are true:

- Service-role key has not been rotated.
- Production env uses localhost.
- Frontend build or backend smoke test fails.
- Admin can upload an untrusted external media origin.
- Any mode can answer a riddle that was not served by the RDE.
- Any wager path can pay twice or lose escrow after refresh/restart.
