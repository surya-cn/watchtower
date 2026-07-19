# WatchTower - Backend API

Multi-tenant backend API for an anticheat social-listening dashboard. This phase delivers the data layer (PostgreSQL + Prisma) and REST API (Next.js App Router) — no frontend, no AI, no real data ingestion.

## Prerequisites

- **Node.js** ≥ 18
- **Docker** (for PostgreSQL)
- **npm**

## Quick Start

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

This launches PostgreSQL 16 on port 5432 with:
- User: `postgres`
- Password: `postgres`
- Database: `anticheat_dashboard`

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

A `.env` file is already provided. If needed, copy from the example:

```bash
cp .env.example .env
```

Default connection string:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anticheat_dashboard
```

### 4. Run Migrations

```bash
npx prisma migrate dev --name init
```

This creates all tables based on the Prisma schema.

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Seed the Database

```bash
npx prisma db seed
```

Creates two projects (`javelin` and `demo-title`) with issue clusters, raw posts, and status history — including deliberately overlapping category/severity data for tenant-isolation testing.

### 7. Start the Dev Server

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

## API Endpoints

All tenant-scoped endpoints require the `X-Project-Id` header.

| Method | Path | Scoped | Description |
|--------|------|--------|-------------|
| GET | `/api/projects` | No | List all projects |
| POST | `/api/projects` | No | Create a project |
| GET | `/api/projects/:id/config` | No | Get project config |
| PUT | `/api/projects/:id/config` | No | Update project config |
| GET | `/api/issues` | Yes | List issues (paginated, filtered) |
| GET | `/api/issues/:id` | Yes | Issue detail with posts + history |
| PATCH | `/api/issues/:id/status` | Yes | Update status (transactional) |
| GET | `/api/metrics/summary` | Yes | Dashboard summary metrics |

### Example Requests

```bash
# List javelin issues
curl http://localhost:3000/api/issues -H "X-Project-Id: javelin"

# Filter by severity and category
curl "http://localhost:3000/api/issues?severity=high&category=aimbot" -H "X-Project-Id: javelin"

# Paginate
curl "http://localhost:3000/api/issues?page=2&page_size=2" -H "X-Project-Id: javelin"

# Get issue detail
curl http://localhost:3000/api/issues/<issue-id> -H "X-Project-Id: javelin"

# Update status
curl -X PATCH http://localhost:3000/api/issues/<issue-id>/status \
  -H "X-Project-Id: javelin" \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "note": "Investigating"}'

# Dashboard metrics
curl http://localhost:3000/api/metrics/summary -H "X-Project-Id: javelin"
```

## Running Tests

Tests are split into two categories:

### Unit Tests (middleware enforcement)

These test the Prisma `$extends` multi-tenancy middleware directly. They require a running database with seed data:

## Testing

This project uses `vitest` for testing. The API integration tests (`issues.test.ts`, `projects.test.ts`) make live HTTP requests (`fetch`) to the Next.js dev server to properly exercise the authentication middleware and route handlers.

> [!WARNING]
> **Dev Server Requirement:** `npm run test` now requires `npm run dev` to be running in a separate terminal first. If you try to run the tests in a clean CI environment without starting the dev server, the API integration tests will fail with connection refused or 404/401 errors.

To run the tests:

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Run Unit Tests
npm test -- __tests__/middleware.test.ts

# Terminal 2: Run Integration Tests
npm test
```

### Run All Tests

```bash
npm test
```

## Phase 2: Data Ingestion

The orchestrator pulls real posts from external sources into `raw_posts` using standard connector interfaces.

### Configuration
- **Global Credentials (Environment Variables)**: Reddit API credentials must be configured in your `.env` file. These are team-level credentials, not per-project.
  *(Note: The Reddit connector is currently BLOCKED pending manual approval under Reddit's Responsible Builder Policy. It will gracefully skip ingestion if credentials are not provided.)*
  ```env
  REDDIT_CLIENT_ID="your_client_id"
  REDDIT_CLIENT_SECRET="your_client_secret"
  ```
- **Per-Project Configuration**: The sources to track (e.g., specific subreddits or EA forum feed URLs) are configured inside each project's `config.sources` JSON column in the database (this was seeded during `npm run db:seed`).

### Running the Orchestrator
Run the ingestion pipeline for all projects (to be wired to a scheduler/cron in production):
```bash
npm run ingest
```

Run the pipeline for a specific project manually:
```bash
npm run ingest:project -- javelin
```

## Phase 3: AI Clustering Engine

The clustering engine takes unclustered `raw_posts` and groups them into `issue_clusters` using NVIDIA's Nemotron 3 Ultra 550B model. It evaluates whether a new post matches an existing issue (including closed ones) or constitutes a new issue, automatically categorizing it and generating cluster summaries.

### Configuration
- **NVIDIA API Credentials (Environment Variables)**: You must provide an NVIDIA API key in your `.env` file to enable the AI features. You can get one at [build.nvidia.com](https://build.nvidia.com).
  ```env
  NVIDIA_API_KEY="your_api_key_here"
  ```
  *Note: The system uses the OpenAI-compatible client, so swapping to another provider later requires changing only the `baseURL` and model string in `src/lib/llm.ts`.*
- **Severity Logic**: Severity is calculated deterministically via code (not by the LLM). It dynamically re-evaluates based on the total number of posts added to a cluster in the last 7 days, cross-referenced against the `severity_thresholds` defined in the project's config.

### Running the Clustering Engine
Run the clustering pipeline for all projects (typically runs after ingestion):
```bash
npm run cluster
```

Run the pipeline for a specific project manually:
```bash
npm run cluster:project -- javelin
```

## Project Structure

```
anticheat-dashboard/
├── docker-compose.yml          # PostgreSQL 16
├── prisma/
│   ├── schema.prisma           # 6 tables, 4 enums
│   └── seed.ts                 # 2 projects with realistic data
├── src/
│   ├── app/api/                # Next.js API routes
│   │   ├── projects/
│   │   │   ├── route.ts        # GET/POST /api/projects
│   │   │   └── [id]/config/
│   │   │       └── route.ts    # GET/PUT config
│   │   ├── issues/
│   │   │   ├── route.ts        # GET /api/issues (paginated)
│   │   │   └── [id]/
│   │   │       ├── route.ts    # GET /api/issues/:id
│   │   │       └── status/
│   │   │           └── route.ts # PATCH status
│   │   └── metrics/summary/
│   │       └── route.ts        # GET /api/metrics/summary
│   └── lib/
│       ├── prisma.ts           # Singleton client + multi-tenancy middleware
│       ├── schemas.ts          # Zod validation schemas
│       └── errors.ts           # Centralized error helpers
├── __tests__/
│   ├── middleware.test.ts       # Multi-tenancy enforcement tests
│   └── api/
│       ├── issues.test.ts       # Pagination, filtering, tenant isolation
│       └── projects.test.ts     # Config validation, duplicate creation
└── vitest.config.ts
```

## Multi-Tenancy Enforcement

Every query on `raw_posts`, `issue_clusters`, and `status_history` is intercepted by a Prisma `$extends` middleware that throws if `project_id` is missing from the query. This is not just application-level discipline — it's enforced at the ORM layer.

- **Reads/updates/deletes**: must include `project_id` in `where`
- **Creates**: must include `project_id` in `data`
- **Nested writes**: bypass the interceptor (documented limitation; safety comes from parent interceptor + required field + FK constraints)

## Phase 6: AI Chat & Search Assistant

The dashboard features an AI-powered chat/search bar that translates natural language queries into specific dashboard actions. It acts as an assistant to filter issues, summarize data, and navigate directly to issue details. 

### Architecture & Security
- **Strict Tool Calling Enforced:** The LLM (Nemotron 3 Ultra) is restricted to exactly four tools (`filter_issues`, `summarize_issues`, `get_issue_detail`, and `get_project_metrics`).
- **Data Isolation:** Every request is strictly scoped to the active project (`X-Project-Id`), which is injected at the backend level. The LLM cannot access or query data outside the currently selected project, even if explicitly instructed to do so by a user.
- **No General Knowledge:** The backend drops any free-form responses that do not invoke a tool, replacing them with a strict fallback message. The assistant will refuse to engage in general chatting, coding, or unrelated queries.
- **Conversation State:** The chat context strictly tracks the last 6 messages, providing conversational awareness for follow-ups (e.g., "now show me only the high severity ones"). The context is immediately cleared when switching projects.

## Phase 7: Authentication & Deployment Preparation

### Authentication
The dashboard currently uses a simple session-based authentication system intended for testing and initial rollout.
- Credentials are checked against environment variables (`ADMIN_USERNAME` and `ADMIN_PASSWORD`).
- A signed, HTTP-only cookie is set using `iron-session`.
- All routes (except `/login`, `/api/health`, and static assets) are protected by Next.js Middleware.
- **IMPORTANT**: This is a placeholder auth system. It must be replaced with real per-user authentication (e.g. company SSO) before this tool is used with real production data beyond testing.

### Deployment (Vercel)
This Next.js App Router project deploys natively to Vercel without requiring a `vercel.json` or custom `next.config.ts`.
The Neon PostgreSQL connection works natively in Vercel's serverless environment.

To deploy, set the following Environment Variables in the Vercel dashboard:
- `DATABASE_URL`: Connection string to your Neon Postgres database.
- `OPENROUTER_API_KEY`: API key for LLM integration.
- `ADMIN_USERNAME`: Username for the test admin account.
- `ADMIN_PASSWORD`: Password for the test admin account.
- `SESSION_SECRET`: A secure random string (at least 32 characters) used to sign the session cookies.

A health check endpoint is available at `GET /api/health` to confirm the database connection is alive after deployment.

### Automated Scheduling (GitHub Actions)
The ingestion and clustering pipeline can be automated via a secure webhook triggered by GitHub Actions.

**Pre-Deploy Checklist for Vercel Hobby Tier:**
> [!IMPORTANT]
> The sync endpoint uses `export const maxDuration = 300` to allow enough time for LLM calls. On the Vercel Hobby plan, you **must** manually enable Fluid Compute in your Vercel project settings (Settings -> Functions -> Fluid Compute toggle) *before* deploying. If you do not enable this, the deployment will fail with an invalid maxDuration error.

*(Note: Even with Fluid Compute disabled, the code has a 45-second safe early-exit threshold as a fallback, but the deploy will still fail if `maxDuration = 300` is deployed to a Hobby account without Fluid Compute toggled.)*

> [!NOTE]
> Vercel Hobby plans include a 4-hours/month limit for "Active CPU time" across all function invocations. Running this sync every 10 minutes is typically fine, since most wall-clock time is spent waiting on external LLM and DB requests (which don't count as active CPU). However, monitor your usage in the Vercel dashboard after a week to ensure heavy tasks (like HTML parsing) don't exceed this budget.

**Post-Deploy Setup:**
1. Generate a secure secret string for your webhook auth.
2. In Vercel, set the `CRON_SECRET` environment variable to this string.
3. In your GitHub repository, go to Settings -> Secrets and variables -> Actions, and add:
   - `WATCHTOWER_APP_URL`: Your live Vercel deployment URL (e.g., `https://my-app.vercel.app`)
   - `WATCHTOWER_CRON_SECRET`: The exact same secret string you put in Vercel.

The scheduled sync will then run automatically every 10 minutes.

## Known Issues

- **pg SSL Deprecation Warning**: During testing or running the server connected to Neon (or services requiring SSL), you may see a warning: `SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'`. This is a known issue with the `pg-connection-string` parsing `sslmode=require`. If `pg` issues a major version bump in the future that enforces standard libpq semantics, we may need to update connection strings to explicitly pass `uselibpqcompat=true&sslmode=require` or migrate to `sslmode=verify-full`.
