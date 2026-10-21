# CampusOS

One web app where students, professors and college admins do everything, and AI agents do the busywork for all three. Agents act on events (a submission, an upload, a dashboard visit, a schedule), not just chat, and a human approves anything that is published or changes a record.

**Live:** https://campusai-ashy.vercel.app · Built for the WildCatter Ventures Phase I assignment.

## Demo accounts

All accounts use the password **`CampusOS-demo-2026`**. The login page has one-click buttons for each.

| Role | Email | College |
| --- | --- | --- |
| Student (A) | `aarav@northfield.demo` | Northfield Institute of Technology (₹, semesters, CGPA 10). Enrolled in DBMS and OS |
| Student (B) | `diya@northfield.demo` | Northfield. Enrolled in OS only, so she must never see DBMS material |
| Professor | `prof.mehta@northfield.demo` | Northfield. Teaches DBMS (CS301) and OS (CS302) |
| Admin | `admin@northfield.demo` | Northfield |
| Student | `jordan@lakeside.demo` | Lakeside College (US: $, quarters, GPA 4.0) |
| Professor | `prof.taylor@lakeside.demo` | Lakeside |

All data is fictional. `npm run seed` resets it and moves every deadline relative to today.

## What each role gets

| Student | Professor | Admin |
| --- | --- | --- |
| Dashboard: Planner agent's week plan, deadlines with status, fee balance, agent activity feed, announcements | Dashboard: courses, recent submissions | Dashboard: outstanding fees, students, late submissions |
| Courses & materials (enrolled only) | My courses & uploads (PDF/TXT → indexed → summarised) | Ops digest (weekly, or on demand) |
| Assignments: submit a file, get an instant rubric pre-check, then the professor's feedback | Assignments & submissions: create, review, see pre-checks | Fees overview (read-only) |
| Fees & payments: Stripe test checkout, history, receipts | Approval inbox: feedback and announcement drafts | Approval inbox: fee reminder batches |
| Assistant (side panel on every page) | Assistant · Announcements | Assistant · Announcements (college-wide) |

## The agents

All agents run on one runtime (`lib/agent.ts`). It logs every run to `agent_runs`, calls the model with a fixed output schema, and records failures so the UI shows "failed — retry" instead of pretending. Facts are loaded from the database by our code, never invented by the model.

| Agent | Trigger | What it does | Human step |
| --- | --- | --- | --- |
| **Submission** | Student submits | Reads the file and checks it against the brief and rubric (met / partial / missing per item). Shows the student a pre-check within seconds and drafts feedback plus an indicative grade in the college's own scale | Professor approves or edits the feedback. The final grade stays human |
| **Materials** | Professor uploads notes | After indexing, writes a summary and drafts a "new material" announcement | Professor approves before students see it |
| **Reminder** | Daily cron (08:00 IST) | Assignments due within 48 h with no submission, and unpaid fees due within 7 days, become reminders in the student's feed. Deduplicated per day. **Rule-based (no LLM), so it can never invent a deadline** | None (informational) |
| **Ops** | Weekly cron (Mon), or "Run digest now" | Outstanding fees and late/missing submissions. **Numbers come straight from SQL**; the model only writes the narrative. Prepares a fee-reminder batch | Admin approves before reminders are sent |
| **Planner** | Dashboard load (cached 12 h), refresh, or chat | Ranked weekly plan from real deadlines, submission status, fees and new materials. Any link not taken from the facts is dropped | None |
| **Campus Assistant** | Chat, any role | Answers from records and course documents with page sources. Read-only tools, scoped by RLS; admin-only digest tool | Refuses anything that would change a record |

## Architecture

```
Browser ──► Next.js on Vercel (App Router, Server Components, Server Actions, Route Handlers)
              │  every user query runs AS the user (Supabase session) → Postgres RLS decides what rows exist
              │
              ├─ after()  ─► event agents (submission, materials, feedback, planner) ─► agent_runs + approvals
              ├─ /api/chat ─► Campus Assistant (AI SDK streamText + typed Zod tools)
              ├─ /api/cron/daily · /api/cron/weekly ─► Reminder + Ops agents (Vercel Cron, Bearer CRON_SECRET)
              └─ /api/stripe/webhook ─► the ONLY writer of payments (verified signature, idempotent)

Supabase: Postgres + pgvector + RLS · Auth · private Storage buckets · Edge Function `embed` (gte-small)
AI: Groq (openai/gpt-oss-120b) behind lib/ai.ts, the one provider module
```

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Data | Supabase Postgres + pgvector, RLS on every table, migrations in `supabase/migrations` |
| Auth | Supabase Auth, role on `profiles` |
| Files | Private Storage buckets (`materials`, `submissions`). The browser uploads via one-time signed URLs (Vercel caps request bodies at 4.5 MB). The bucket enforces PDF/TXT and ≤ 10 MB. Downloads use 60-second signed URLs after an RLS check |
| AI | Vercel AI SDK v7 + Groq. Embeddings via Supabase's built-in `gte-small` in an Edge Function (Groq has no embeddings API) |
| Payments | Stripe Checkout (test mode) + webhook |
| Jobs | Next.js `after()` for event agents, Vercel Cron for scheduled agents |

**Key files:** `lib/agent.ts` (runtime) · `lib/agents.ts` (Submission, Materials, Feedback, Planner) · `lib/jobs.ts` (Reminder, Ops) · `lib/tools.ts` (assistant tools) · `lib/ingest.ts` + `lib/chunk.ts` (RAG ingestion) · `app/(app)/inbox/actions.ts` (approval effects) · `app/api/stripe/webhook/route.ts`.

**Tables:** `institutions` (each college's settings) → `profiles`, `courses`, `enrollments`, `assignments`, `submissions`, `documents`, `document_chunks`, `fee_records`, `payments`, `announcements`, `agent_runs`, `approvals`, `notifications`. Every table carries `institution_id`.

## Security model

- **Two guards.** Every RLS policy checks the institution first, then the role or ownership. Server code adds what RLS can't express (file type, deadline, path checks). Hiding a button is never the only guard.
- **Students** see only their own fees, payments, submissions and notifications, and only courses, materials, document chunks and announcements for courses they're enrolled in.
- **Professors** see only courses they teach and their students' submissions, never fees.
- **Agent tools** take the user from the session, never from the model. The assistant's tools are read-only, and RAG search (`match_chunks`) is `security invoker`, so chunk RLS limits it.
- **Money.** Only the Stripe webhook (verified signature, `app: campusos` tag, unique session id) can record a payment, through the atomic `record_payment()` function.
- **Writes the user shouldn't control** (submission rows, payments, feedback release, notifications) are done server-side after validation. Users have no RLS write policy on them.
- **Prompt injection.** Document and submission text is wrapped as untrusted content, and no tool can write.
- **Secrets** live only in server env vars (`.env.example` lists the names).

## Setup

Requires Node 20+, a Supabase project, a Stripe test account and a Groq API key.

```bash
npm install
cp .env.example .env.local            # fill in the values (see below)
npx supabase db push --db-url "$SUPABASE_DB_URL"
npx supabase login && npx supabase functions deploy embed --project-ref <project-ref>
npm run seed                          # 2 colleges, 6 demo users
npm run dev
```

**Stripe:** create a webhook destination for `checkout.session.completed` pointing to `https://<your-domain>/api/stripe/webhook`, then put its signing secret in `STRIPE_WEBHOOK_SECRET`.
**Vercel:** add the same env vars (except `SUPABASE_DB_URL`). The crons in `vercel.json` register on deploy.

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (public; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: webhook, cron, background agents |
| `SUPABASE_DB_URL` | Local only: migrations and type generation |
| `GROQ_API_KEY` | LLM for agents and the assistant |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout + webhook verification |
| `CRON_SECRET` | Authenticates Vercel Cron calls |
| `NEXT_PUBLIC_APP_URL` | Stripe success/cancel redirects |

## Tests

Small runnable checks, no framework. `test:chunk` and `test:access` run on their own; the others need the app running (`npm run dev`, or pass the live URL as an argument).

| Script | Proves |
| --- | --- |
| `npm run test:access` | Student B can't read Student A's fees or submissions. College B sees nothing of College A. RAG search, announcements, approvals and agent runs are scoped. Professors see no fees |
| `npm run test:assistant` | Through the assistant: Student B asking for Student A's fees or submissions, a student asking for the ops digest, "mark my fees paid", and College B asking about College A are all refused (checked on tool outputs) |
| `npm run test:webhook` | Forged signatures rejected, other apps' payments ignored, payments recorded once, replays not double-counted |
| `npm run test:cron` | Cron requires the secret, reminders match seeded deadlines, no duplicates, digest generated for both colleges |
| `npm run test:chunk` | RAG chunking keeps page numbers and overlap, and drops no words |

Run `npm run seed` again after `test:webhook` or `test:cron`.

## Demo script (≈ 5 min, on the live URL)

1. **Problem:** portals for deadlines, fees and notes that don't talk to each other; plain chatbots can't see records or act safely.
2. **Professor** uploads `demo/Unit 3 - Normalization.pdf` to DBMS → Processing → Ready → Materials agent summary → **Approval inbox** → edit and approve the announcement.
3. **Student (Aarav) dashboard:** Planner's week plan, deadlines, fee balance, agent activity, the new announcement.
4. **Assistant:** "Explain 3NF from our notes" → answer with *Unit 3 - Normalization.pdf, p. 3*.
5. "What should I focus on this week?" → ranked plan from real deadlines.
6. **Submit** the Normalization assignment → rubric pre-check in seconds → professor's inbox shows the feedback draft → approve → Aarav sees the feedback.
7. **Pay** tuition with test card `4242 4242 4242 4242` → status flips to Paid with a receipt.
8. **Admin:** Ops digest → run → approve the fee reminder batch → reminders appear in students' activity feeds.
9. **Security:** Diya asks for Aarav's fees → refused. Jordan logs in: same app, $ and GPA, none of Northfield's data.
10. **Close:** architecture (above) and what's next.

## Decisions and deviations from the PRD

- **Chunks are ~450 tokens, not ~800.** The free `gte-small` embedding model reads at most 512 tokens.
- **The Reminder agent is rule-based.** Comparing dates needs no LLM, and this removes any chance of invented deadlines.
- **Groq free tier.** Agent inputs are capped at ~14k characters. The model is one line in `lib/ai.ts`.
- **Professor ratings and the Feedback agent were removed** from this MVP by choice, to keep the scope on the student, professor and admin busywork flows. They are first on the next-steps list.

## Next steps

Anonymous professor ratings with an agent theme summary, agent-drafted assignments from uploaded notes (professor approves), student self-signup and CSV import, email/SMS notifications, OCR for scanned PDFs, gradebook, ERP integration.
