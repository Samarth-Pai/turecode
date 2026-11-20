# TureCode

A competitive programming and technical assessment platform built with **Next.js 16**, **Drizzle ORM + PostgreSQL**, **CodeMirror 6**, **KaTeX**, and a **Rootless Linux Landlock C Fork-Server Sandbox**.

## Features

- **Coding Arena**: Multi-language CodeMirror 6 editor (`C`, `C++`, `Java`, `Python`) with HackerRank-style DSL code stubs, multiple split/stack/focus layouts, collapsible problem sidebar, sample test runner, and hidden test case verdict redaction.
- **Sectioned MCQ Rounds with LaTeX**: Title-free MCQ questions grouped into sections, rendered with KaTeX (`$inline$` and `$$display$$`), question palette, and negative-marking support.
- **Solve-Time Tiebreaker & Leaderboard**: Tracks per-question solve times and ranks participants by total score with lowest cumulative solve time as the tiebreaker.
- **Moderator Studio**:
  - Manage contest schedules, strict proctoring mode (fullscreen + tab-switch violation tracking with penalty reset), and round score overrides.
  - **Coding Question Bank**: Author reusable coding problems with DSL-generated `C/C++/Java/Python` stubs and search/add them directly from any contest's Coding Round.
  - **On-the-Spot Sectioned MCQs**: Create MCQ sets directly inside each contest round's sections.
  - **Code Submissions Inspector**: Inspect every participant's submitted source code, compiler output, solve time, runtime, and per-test-case verdicts.
- **Rootless Sandbox (`sandbox/daemon.c`)**: Compiles and executes untrusted code concurrently over `/tmp/sandbox.sock` using Linux Landlock LSM + `rlimit` isolation.

---

## Prerequisites

- [Bun](https://bun.sh/) (`>= 1.4`)
- PostgreSQL (`pg_ctl`, `initdb`, `psql` in `PATH`) or an external `DATABASE_URL`
- Linux with `gcc` (to compile `sandbox/daemon.c`), `g++`, `javac`/`java`, and `python3`

---

## Quick Start: Running the Entire Project

### 1. Install Dependencies

```bash
bun install
```

### 2. Build & Start the Rootless Sandbox Daemon

Compile the C fork-server sandbox binary and start it in the background (listens on `/tmp/sandbox.sock`):

```bash
bun run sandbox:build
./sandbox/daemon &
```

> **Note:** You can verify sandbox health anytime at `/sandbox-status` once the web server is running.

### 3. Start & Seed the PostgreSQL Database

Start the local PostgreSQL 18 cluster (`.pgdata/` on `127.0.0.1:5433`, database `turecode`), push the Drizzle schema (`lib/schema.ts`), and seed initial demo contests, questions, and accounts:

```bash
bun run db:push
bun run db:seed
```

*(If you want to start PostgreSQL and seed in one step, `bun run db:start` automatically initializes `.pgdata/` if missing, starts PostgreSQL on port `5433`, ensures tables exist, and seeds demo data. You can also set `DATABASE_URL` in `.env` to use an external Postgres instance.)*

### 4. Run the Next.js Application

**Development mode:**

```bash
bun run dev
```

**Production build & start:**

```bash
bun run build
bun run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## All `bun` Commands

### App & Quality Checks

| Command | Description |
| :--- | :--- |
| `bun run dev` | Start Next.js development server on port `3000` |
| `bun run build` | Build optimized production bundle |
| `bun run start` | Start production server |
| `bun run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `bun run lint` | Run ESLint across the codebase |
| `bun run sandbox:build` | Compile `sandbox/daemon.c` into `sandbox/daemon` |

### Database & Drizzle ORM Commands

| Command | Description |
| :--- | :--- |
| `bun run db:start` | Start local PostgreSQL cluster (`.pgdata`, port `5433`) and seed if empty |
| `bun run db:stop` | Stop the local PostgreSQL cluster cleanly |
| `bun run db:seed` | Run `lib/seed-cli.ts` to initialize/seed the database |
| `bun run db:push` | Push Drizzle schema (`lib/schema.ts`) directly to PostgreSQL |
| `bun run db:generate` | Generate SQL migration files into `./drizzle` |
| `bun run db:migrate` | Apply generated Drizzle migrations |
| `bun run db:studio` | Launch Drizzle Studio visual database browser |
| `bun run db:psql` | Open an interactive `psql` shell to `turecode` on port `5433` |

---

## Demo Accounts & Join Codes

- **Participant**: `priya@turecode.dev` / `password123`
- **Moderator**: Quick sign-in available on `/login` (password `password123`)
- **Demo Contest Join Codes**: `ALGO-2026`, `BLITZ-14`
