# CRACKL

CRACKL is a riddle arena with solo modes, multiplayer rooms, Panic Mode timers, Blind Wager stakes, challenge links, an admin riddle studio, and a Supabase-backed Riddle Delivery Engine.

## Local Development

Backend:

```bash
cd CRACKL-backend
cp .env.example .env
npm install
npm start
```

Frontend:

```bash
cp .env.example .env
npm install
npm run web
```

## Production Verification

Run these before any deploy:

```bash
npm run verify
cd CRACKL-backend
npm run verify
```

Backend health endpoints:

```text
GET /health
GET /ready
```

Use `/health` for process liveness and `/ready` for database readiness.

## Required Production Environment

Frontend:

```text
EXPO_PUBLIC_BACKEND_URL=https://api.example.com
```

Backend:

```text
NODE_ENV=production
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
ADMIN_SECRET=
ALLOWED_ORIGINS=https://example.com,https://www.example.com
ALLOWED_MEDIA_ORIGINS=
GOOGLE_CLIENT_ID=
APPLE_CLIENT_ID=
EMAIL_USER=
EMAIL_PASS=
```

Never ship with a service-role key that has appeared in chat, logs, screenshots, commits, or a shared document. Rotate it before production.

## Backend Container

The backend includes a production Dockerfile:

```bash
cd CRACKL-backend
docker build -t crackl-backend .
docker run --env-file .env -p 3000:3000 crackl-backend
```

## Launch Gate

A launch candidate is not ready until:

- `npm run verify` passes at repo root.
- `npm run verify` passes in `CRACKL-backend`.
- Supabase service-role key has been rotated.
- Production `ALLOWED_ORIGINS` matches deployed frontend domains exactly.
- Production `ALLOWED_MEDIA_ORIGINS` includes only Supabase Storage/CDN origins used for riddle media.
- `/health` and `/ready` are monitored.
- A real browser/mobile click-through has passed for all modes and admin media preview.
