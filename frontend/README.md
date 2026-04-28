# Hackathon Frontend

Angular 21 + NG-ZORRO console for the Hackathon NestJS backend.

## Stack

- Angular 21 (standalone components, signals, new control-flow syntax)
- TypeScript 5.9 (`strict: true`)
- NG-ZORRO 21 (UI library, no Tailwind / no Bootstrap)
- RxJS 7
- Angular Router (lazy routes + functional guards)
- Reactive Forms
- Functional HTTP interceptors (auth + error handling)

## Project Structure

```
src/app/
  core/
    auth/
      auth.service.ts        # login / logout / refresh / me + reactive user state
      auth.guard.ts          # blocks unauthenticated users
      guest.guard.ts         # keeps signed-in users out of /login
      token.service.ts       # only place that touches localStorage
      auth.interceptor.ts    # attaches Bearer + handles 401 -> refresh -> retry
      auth.models.ts         # LoginRequest / LoginResponse / AuthUser ...
    interceptors/
      error.interceptor.ts   # surfaces backend errors via NzMessageService
    services/
      api.service.ts         # thin HttpClient wrapper around environment.apiBaseUrl
  layout/
    dashboard-layout.component.{ts,html,scss}
    sidebar.component.{ts,html,scss}
    header.component.{ts,html,scss}
  pages/
    login/
    dashboard/
    users/
    settings/
  app.routes.ts
  app.config.ts
  app.component.ts
src/environments/
  environment.ts             # apiBaseUrl: http://localhost:3000/api (dev)
  environment.prod.ts        # apiBaseUrl: /api (prod, behind reverse proxy)
```

## Prerequisites

- Node.js 20.19+ (or 22.12+)
- npm 10+

## Setup

```bash
cd frontend
npm install
```

## Run the dev server

The backend must be running on `http://localhost:3000` (default).

```bash
npm start
```

The app is served on `http://localhost:4200`.

> **CORS:** the backend has CORS enabled for `http://localhost:4200` by default
> via `CORS_ORIGINS` (comma-separated) in `backend/.env`. Update that value if
> you serve the frontend from a different origin.

## Production build

```bash
npm run build:prod
```

The compiled artefacts land in `dist/hackathon-frontend/`.

## Authentication flow

1. `LoginComponent` posts `{ email, password }` to `POST /api/auth/login` via
   `AuthService.login()`.
2. `TokenService` persists `accessToken`, `refreshToken`, and the user profile
   to `localStorage` (single source of truth, swappable).
3. `authInterceptor` attaches `Authorization: Bearer <accessToken>` on every
   API call.
4. On `401`, the interceptor calls `POST /api/auth/refresh` with the stored
   refresh token, swaps the new access token in, and retries the original
   request **once**. Concurrent in-flight requests queue behind a single
   `BehaviorSubject` so only one refresh fires at a time.
5. If refresh fails, tokens are cleared and the user is redirected to
   `/login`.

## Routes

| Path         | Component             | Guard         |
| ------------ | --------------------- | ------------- |
| `/login`     | `LoginComponent`      | `guestGuard`  |
| `/dashboard` | `DashboardComponent`  | `authGuard`   |
| `/users`     | `UsersComponent`      | `authGuard`   |
| `/settings`  | `SettingsComponent`   | `authGuard`   |
| `**`         | redirect to dashboard | -             |

The default route resolves to `/dashboard` if logged in, otherwise the auth
guard sends the user to `/login` (with `?redirect=` preserved).

## Backend response shapes

The `AuthService` is written against the actual NestJS controller responses:

```jsonc
// POST /api/auth/login
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user":   { "_id": "...", "email": "..." },
    "tokens": { "accessToken": "...", "refreshToken": "...", ... }
  }
}

// POST /api/auth/refresh -> same shape
// GET  /api/auth/me      -> { success, data: { _id, email, ... } }
```

If the refresh endpoint is later flattened to
`{ data: { accessToken, refreshToken? } }`, `AuthService.refreshAccessToken()`
already handles both shapes.
