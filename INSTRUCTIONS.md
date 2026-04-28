# Quantum AI – Build Specification (Hackathon Edition)

> **Event:** Cursor Hackathon · **Duration:** ~5 hours · **Product:** Quantum AI – Cloud-based AI Test Engineering Platform · **Version:** 2.1 (decisions locked)

This document is the **complete build specification**. Anything not described here is **not part of this build**. To add anything new: edit this document first, get sign-off, then code.

---

## 0. Scope Lock (READ FIRST)

**Rule:** If a feature, page, route, field, library, env var, folder, or service is not described in this document, it must not be built. No exceptions during the build window.

This applies equally to all owners (FE, AI, CE — see §2).

| Item not in this doc | Action |
|---|---|
| New page | Don't build it. |
| New API endpoint | Don't build it. |
| New DB field | Don't add it. |
| New library / framework / language | Don't install it. |
| New env var / secret | Don't introduce it. |
| New folder / service | Don't create it. |
| UX polish, animations, dark mode, charts | Defer. |

**To add anything new:**
1. Stop coding.
2. Edit this document with the addition (correct section, correct format).
3. Post in chat, wait for sign-off from the other two owners.
4. Then code.

**Pre-flight checklist** (run mentally before each task or Cursor prompt):

- [ ] Working inside an owned folder (§2)?
- [ ] API route + signature matches §6?
- [ ] Request/response JSON matches §5 (no renamed/extra fields)?
- [ ] Tech stack is from §3?
- [ ] Env vars are from §10?
- [ ] Branch name follows §9?
- [ ] If a dependency isn't ready, am I consuming the mock (§11)?

> **Mantra:** Doc → Mock → Code → Integrate.

---

## 1. Project Snapshot

**One-liner:** Quantum AI ingests requirements (Jira / Confluence / free text), generates ISTQB-grade test cases via LLM, crawls the AUT to extract a Page Object Model, maps test steps to real UI elements, generates Playwright scripts, pushes to Git, and executes on BrowserStack — all from a single web UI.

**In Scope (MVP):**
1. Login → Feature → Test Suite → Test Case hierarchy
2. Requirement intake (Jira ID **or** Confluence link **or** raw text)
3. AI test case generation (LLM-backed, mockable)
4. Review / edit / approve / reject → save to DB
5. Page crawl + element store
6. Test-step ↔ element mapping → Playwright script generation
7. Push generated script to Git
8. Trigger run on BrowserStack and show live status
9. Dashboard with coverage + traceability metrics

**Out of Scope:** multi-tenant orgs, RBAC, SSO, real-time collaboration, self-hosted LLM, fine-tuning, mobile / API / performance test types, production observability.

---

## 2. Ownership

Three role codes — **FE / AI / CE** — used throughout this document. Each role owns specific folders. No cross-folder writes without owner approval.

| Code | Role | Folders Owned | Primary Deliverables |
|------|------|---------------|----------------------|
| **FE** | Frontend / UX | `apps/web/**` | All pages in §4, Tailwind UI, Axios client, auth screen |
| **AI** | AI + Integrations | `services/ai-engine/**`, `services/gateway/integrations/**` | LLM prompts, Jira/Confluence readers, Git push, test-case generator, mapping logic |
| **CE** | Crawler + Execution | `services/crawler/**`, `services/executor/**` | Playwright crawler, POM extractor, BrowserStack runner, status streaming |

**Shared:** `services/gateway/**` — owned by **AI**, route changes reviewed by **FE** and **CE**.
**Cadence:** stand-up every 60 min (5 min cap). Status = Done / Doing / Blocked. Blocked > 15 min → escalate.

---

## 3. Architecture (Locked)

```
[Next.js Web]  ──►  [Node Gateway (TS)]  ──┬──►  [AI Engine (Python/FastAPI)]
                                            ├──►  [Crawler (Node/Playwright)]
                                            ├──►  [Executor (Node/Playwright + BrowserStack)]
                                            └──►  [MongoDB]

External: Jira REST · Confluence REST · OpenAI · GitHub REST · BrowserStack Automate
```

- Gateway is the only service the frontend talks to.
- Inter-service calls are **HTTP + JSON** only.

| Service | Port | Lang |
|--------|------|------|
| web | 3000 | Next.js / TS |
| gateway | 4000 | Node / TS / Express |
| ai-engine | 5000 | Python / FastAPI |
| crawler | 6000 | Node / Playwright |
| executor | 7000 | Node / Playwright |
| mongodb | 27017 | — |

---

## 3.5 Application Under Test – AUT (LOCKED)

**AUT = [SauceDemo / Swag Labs](https://www.saucedemo.com/)**

### SauceDemo — Short Description

SauceDemo is a sample e-commerce website created for practicing and demonstrating software test automation. It provides a simple online store experience where users can log in, browse products, add items to a cart, and complete checkout.

It is specifically designed for tools like Playwright, Selenium, and Cypress, making it ideal for testing login flows, UI interactions, and end-to-end scenarios in a stable and controlled environment.

| Item | Value |
|------|-------|
| Base URL | `https://www.saucedemo.com/` |
| Auth | Form username/password, no captcha, no 2FA |
| Password (all users) | `secret_sauce` |

**Seed users:**

| Username | Use |
|----------|-----|
| `standard_user` | Happy path / golden flow |
| `locked_out_user` | Negative test (account locked) |
| `problem_user` | Visual / broken-image scenario |
| `performance_glitch_user` | Slow-login scenario |
| `error_user` | Form error scenarios |
| `visual_user` | Visual regression scenario |

**Crawler must support these pages (priority order):**
1. `/` (Login) → 2. `/inventory.html` → 3. `/inventory-item.html?id=<n>` → 4. `/cart.html` → 5. `/checkout-step-one.html` → 6. `/checkout-step-two.html` → 7. `/checkout-complete.html`

**Golden Flow (the demo path — must automate end-to-end):**
1. Open `https://www.saucedemo.com/`
2. Login as `standard_user` / `secret_sauce`
3. Add **"Sauce Labs Backpack"** to cart
4. Open cart → Checkout
5. Enter First name `Quantum`, Last name `AI`, Postal code `560001`
6. Continue → Finish
7. Assert "Thank you for your order!" is visible
8. Logout via burger menu

**Seed Feature/Suite layout (AI to seed):**
- Feature `F001 – E-Commerce Checkout`
  - Suite `S001 – Authentication` (login positive + negative + locked-out)
  - Suite `S002 – Cart Management` (add, remove, badge count)
  - Suite `S003 – Checkout Flow` (golden flow + missing-field negatives)

---

## 4. Application Pages

| # | Page | Route | Acceptance Criteria |
|---|------|-------|---------------------|
| 1 | Login | `/login` | Username + password. **Accepts the SauceDemo seed users from §3.5** (e.g. `standard_user` / `secret_sauce`). No signup, no DB user table, no password hashing. JWT in httpOnly cookie. |
| 2 | Dashboard | `/` | List Features; create Feature (name + description) |
| 3 | Feature Detail | `/features/[id]` | List Test Suites under feature; create suite |
| 4 | Suite Detail | `/suites/[id]` | List Test Cases; create / open test case |
| 5 | Settings – Integrations | `/settings` | Forms for Jira, Confluence, LLM, Git, BrowserStack → save to DB |
| 6 | Requirement Intake | `/generate` | 3 inputs: Jira ID, Confluence URL, free-text → calls AI engine |
| 7 | Review Generated TCs | `/review/[batchId]` | Table of TCs; inline edit, Approve/Reject, "Save Approved" |
| 8 | Traceability | `/traceability` | Matrix: Requirement → TC → Status (covered / gap) |
| 9 | Page Crawl | `/crawler` | URL + optional creds → crawl → element list → save to DB |
| 10 | Mapping & Script Gen | `/mapping/[suiteId]` | TC steps ↔ elements → "Generate Script" → "Push to Git" |
| 11 | Execution | `/runs` | Pick suite → "Run on BrowserStack" → live status + result link |
| 12 | Metrics | `/metrics` | Cards: # TCs, % approved, % automated, % passing, coverage % |

> Pages 2–4 may be a single page with tabs if time runs short.

---

## 5. Data Contracts (Strict)

### 5.1 Feature
```json
{ "id": "F001", "name": "Authentication", "description": "...", "createdAt": "ISO", "createdBy": "user@x" }
```

### 5.2 Test Suite
```json
{ "id": "S001", "featureId": "F001", "name": "Login Suite", "description": "..." }
```

### 5.3 Test Case (frozen contract)
```json
{
  "id": "TC001",
  "suiteId": "S001",
  "title": "Login with valid credentials",
  "description": "Verify user can login with valid username and password",
  "steps": [
    { "step": "Enter username", "expected": "Username is accepted" },
    { "step": "Enter password", "expected": "Password is accepted" },
    { "step": "Click login",   "expected": "User navigates to dashboard" }
  ],
  "tags": ["smoke", "login"],
  "comments": "Generated by AI",
  "automationScript": "",
  "status": "pending",
  "requirementRef": { "source": "jira|confluence|text", "key": "PROJ-123" },
  "createdBy": "ai|user@x",
  "createdAt": "ISO"
}
```
Allowed `status`: `pending | approved | rejected | automated | passed | failed`.

### 5.4 Page Element
```json
{
  "id": "EL001",
  "pageUrl": "https://www.saucedemo.com/",
  "name": "username_input",
  "selector": "#user-name",
  "selectorType": "css",
  "tag": "input",
  "attributes": { "type": "text", "placeholder": "Username", "data-test": "username" }
}
```

### 5.5 Mapping
```json
{ "testCaseId": "TC001", "stepIndex": 0, "elementId": "EL001", "action": "fill", "value": "${username}" }
```

---

## 6. API Contracts (Gateway — `/api/v1/...`)

| Method | Path | Owner | Purpose |
|-------|------|-------|---------|
| POST | `/auth/login` | FE | Returns JWT |
| GET/POST | `/features` | FE | CRUD features |
| GET/POST | `/suites` | FE | CRUD suites |
| POST | `/generate/testcases` | AI | `{ source, payload }` → `{ batchId, testCases[] }` |
| POST | `/testcases/bulk-save` | AI | Save approved TCs |
| GET | `/traceability` | AI | Returns matrix |
| POST | `/crawler/crawl` | CE | `{ url, auth? }` → `{ elements[] }` |
| POST | `/scripts/generate` | AI | `{ suiteId, mappings[] }` → `{ script, language }` |
| POST | `/git/push` | AI | `{ repo, path, content, message }` |
| POST | `/runs/start` | CE | `{ suiteId, browser }` → `{ runId }` |
| GET | `/runs/:id/status` | CE | Returns status + logs URL |
| GET | `/metrics` | FE | Aggregated counts |

**All responses:** `{ ok: boolean, data?: any, error?: { code, message } }`

---

## 7. Repo Layout (Monorepo)

```
quantum-ai/
├── apps/
│   └── web/                  # Next.js (FE)
├── services/
│   ├── gateway/              # Node/TS Express (AI owns, shared)
│   ├── ai-engine/            # Python FastAPI (AI)
│   ├── crawler/              # Playwright (CE)
│   └── executor/             # Playwright + BrowserStack (CE)
├── packages/
│   └── contracts/            # Shared TS types for §5 contracts
├── docs/
│   └── INSTRUCTIONS.md       # this file
├── .env.example
├── docker-compose.yml        # mongo only is fine
└── README.md
```

---

## 8. Coding Standards

- **TypeScript:** strict mode, no `any` in shared contracts, async/await only, named exports.
- **Python:** 3.11+, pydantic models for every request/response, Black formatter.
- **Naming:** files `kebab-case.ts`, components `PascalCase.tsx`, vars `camelCase`, constants `UPPER_SNAKE`.
- **DB IDs:** prefixed — `F001`, `S001`, `TC001`, `EL001`, `RUN001`.
- **Comments:** explain *why*, never *what*. No narration comments.

---

## 9. Git Workflow

- Default branch: `main` (PR + 1 review).
- Branch naming: `feat/<role>-<short>` e.g. `feat/ai-llm-generator`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`.
- Squash-merge only. No force push to shared branches.

---

## 10. Environment & Secrets

**Repo (locked):** `https://github.com/AruljothySundaramoorthy/hackathon`
**Database (locked):** MongoDB — local for dev, **MongoDB Atlas free tier (M0)** for the deployed demo.
**LLM (locked):** OpenAI (real key available).
**Cloud execution (locked):** BrowserStack Automate (real account available).

`.env.example` (committed, no real values) — real `.env` is **git-ignored**:

```
MONGO_URI=mongodb://localhost:27017/quantum
JWT_SECRET=changeme
OPENAI_API_KEY=sk-...
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_TOKEN=
CONFLUENCE_BASE_URL=
CONFLUENCE_TOKEN=
GITHUB_TOKEN=
GITHUB_DEFAULT_REPO=https://github.com/AruljothySundaramoorthy/hackathon
BROWSERSTACK_USER=
BROWSERSTACK_KEY=
```

**Credentials handling (mandatory):**
- Real values for `OPENAI_API_KEY`, `BROWSERSTACK_USER`, `BROWSERSTACK_KEY`, `GITHUB_TOKEN` are **shared via private team channel only**, never in this document and never in any committed file.
- `.env`, `.env.local`, `*.key`, `*.pem` are listed in `.gitignore` before any code is committed.
- Any accidental commit of a secret → rotate the key immediately, do not rely on history rewrite.

---

## 11. Mocking Rule

Real keys are available for OpenAI, BrowserStack, GitHub. **Mocks are the fallback path, not the primary path** — they exist so the demo can survive a single failed dependency without crashing.

If a key is missing or an external dep is unreachable, the corresponding service must return a **deterministic fake payload**, never crash. Each service must expose a `?mock=true` query flag (or `MOCK_MODE=true` env) that forces the fake path for demo rehearsals.

---

## 12. Definition of Done

- Endpoint or screen reachable end-to-end (real or mocked).
- Happy-path manually verified in browser.
- No console errors.
- Merged to `main` via PR.

---

## 13. Hackathon Timeline (5 Hours)

| Hour | Focus | FE | AI | CE |
|------|-------|----|----|-----|
| **H0 (0:00–0:30)** | Bootstrap | Scaffold Next.js + Tailwind + login page | Scaffold Gateway + Mongo + FastAPI skeleton | Scaffold crawler + executor; install Playwright |
| **H1 (0:30–1:30)** | Core CRUD + Mocks | Dashboard, Feature, Suite, TC pages with mock data | `/generate/testcases` returning mock TCs | Crawler returns mock elements for SauceDemo login |
| **H2 (1:30–2:30)** | Real Integrations | Settings page + Review page (edit/approve/reject) | Wire OpenAI; Jira & Confluence fetchers | Real crawl + element extraction; persist to Mongo |
| **H3 (2:30–3:30)** | Mapping + Scripts | Mapping UI + Metrics cards | Script generator (Playwright); Git push API | Executor calls BrowserStack Automate; returns runId |
| **H4 (3:30–4:30)** | E2E + Polish | Traceability page; loading/empty states; toasts | Wire Approve → Save → Map → Generate flow | Status polling endpoint; surface BrowserStack URL |
| **H5 (4:30–5:00)** | Freeze + Rehearsal | All hands: bug bash + demo run-through | | |

**Hard rule:** at **H4:00**, code freeze on new features. Bug fixes only after.

---

## 14. Demo Script (5–7 min)

1. Login to Quantum AI → Dashboard.
2. Create Feature **"E-Commerce Checkout"** → Suite **"Checkout Flow"**.
3. Open **Generate** page. Paste:
   > *"As a registered Swag Labs user, I should be able to log in, add the Sauce Labs Backpack to my cart, complete checkout with valid details, and see an order confirmation."*
   Click **Generate**.
4. **Review** screen — confirm positive + negative + boundary cases. Tweak one step. Approve all.
5. Open **Crawler** → enter `https://www.saucedemo.com/` → optional `standard_user` / `secret_sauce` → Crawl. Show extracted elements (`#user-name`, `#password`, `#login-button`, `.shopping_cart_link`, `[data-test=checkout]`).
6. **Mapping** screen → auto-suggest binds steps to elements → Generate Playwright Script → Push to Git (open GitHub link).
7. **Runs** page → Run on BrowserStack (Chrome/Win11) → show live BrowserStack session URL.
8. **Metrics + Traceability** → coverage 0% → 100%, # automated, # passing.

**Fallbacks (keep ready in tabs):**
- Pre-recorded video of step 7.
- Pre-cached `services/crawler/fixtures/saucedemo.json`.
- Pre-pushed Git commit for step 6.

---

## 15. Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| OpenAI rate-limit / no key | M | Mock generator with 3 canned TC templates |
| Jira/Confluence creds unavailable | H | Free-text input is the primary demo path |
| BrowserStack quota exhausted | M | Pre-record demo run; local Playwright fallback |
| Crawler blocked by auth | L | AUT is public SauceDemo |
| SauceDemo down during demo | L | Pre-cached element JSON fixture |
| Merge conflicts in gateway | M | One owner (AI); contracts package shared |
| Time overrun on UI polish | H | Tailwind defaults only; no custom CSS until H4 |

---

## 16. ISTQB Alignment

- **Test Levels:** System / E2E only.
- **Test Design Techniques (in LLM prompt):** Equivalence Partitioning, Boundary Value Analysis, Decision Table, Error Guessing — produces positive + negative + boundary cases per requirement.
- **Traceability:** every TC carries `requirementRef` → drives `/traceability`.

---

## 17. Locked Decisions

| # | Item | Decision |
|---|------|----------|
| 1 | Database | **MongoDB** (local for dev, Atlas M0 for deployed demo) |
| 2 | LLM | **OpenAI** (real key, shared via private channel) |
| 3 | BrowserStack | **Available** (real account, creds in private channel) |
| 4 | Git target | **`https://github.com/AruljothySundaramoorthy/hackathon`** (default branch `main`) |
| 5 | Quantum AI auth | **SauceDemo seed users** (`standard_user` / `secret_sauce`, etc.) — no DB user table |
| 6 | Hosting | **Render** (see §18) |
| 7 | Repo style | **Monorepo** (single repo, layout per §7) |
| 8 | Brand / UX | **AI-generated**, constrained by the brief in §19 |

---

## 18. Deployment (Render)

**Realistic 5-hour plan** — not all 5 services need to be deployed for the demo. The frontend is the only thing judges click; everything else can run locally during the demo as long as the public frontend can reach a public gateway.

| Service | Render type | Notes |
|---------|-------------|-------|
| `web` (Next.js) | **Web Service** (Node) | Public URL — this is the demo URL judges open |
| `gateway` | **Web Service** (Node) | Public URL — frontend talks to this |
| `ai-engine` | **Web Service** (Python) | Internal; gateway calls it |
| `crawler` | **Web Service** (Docker, Playwright base image) | Heavier; may stay local for demo if Render build is slow |
| `executor` | **Web Service** (Docker, Playwright base image) | Same as crawler |
| MongoDB | **MongoDB Atlas M0** | Render no longer offers managed Mongo — Atlas free tier is the path |

**Order of deployment (priority, do in spare cycles):**
1. Atlas cluster + connection string into both local and Render envs.
2. `web` to Render (so there's a public URL early).
3. `gateway` to Render (so `web` works end-to-end against a public backend).
4. `ai-engine` to Render.
5. Crawler + Executor — deploy if H4 buffer allows; otherwise run locally and tunnel via the gateway during the live demo.

**Render env vars:** mirror §10 exactly. Set `MOCK_MODE=false` on production.

---

## 19. Brand Brief (input for AI-generated UX)

Frontend owner uses this as the prompt anchor when asking Cursor / image-gen tools to produce the look-and-feel. Locked constraints below; everything else is the AI's call.

| Field | Value |
|-------|-------|
| Product name | **Quantum AI** |
| Tagline | **"From Requirement to Run."** |
| Voice | Confident, technical, calm — for QA leads, not consumers |
| Primary color | Deep indigo (`#4F46E5`) — `Tailwind indigo-600` |
| Neutral | Slate (`Tailwind slate-50` to `slate-900`) |
| Status colors | `green-500` passed/automated · `amber-500` pending · `red-500` failed/rejected · `blue-500` in-progress |
| Font | **Inter** (Google Fonts, free) — both UI and headings |
| Logo placeholder | A `Q` glyph with a small node/circuit accent. While AI-generated logo is being produced, use a Heroicon (`SparklesIcon` or `BeakerIcon`) + the wordmark *Quantum AI* in `Inter Bold` |
| Layout system | Tailwind defaults, no custom CSS until H4 |
| Component kit | shadcn/ui or Headless UI — pick one and stick to it |
| Density | Comfortable (default), not compact |
| Iconography | **Heroicons** (only) — no mixed icon sets |
| Empty states | Always include: icon + 1-line message + 1 CTA button |

---

**End of Specification v2.1**
