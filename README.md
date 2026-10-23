# CampusAI

One web app where students, professors and college admins do everything, and AI agents do the busywork for all three. Agents act on events (a submission, an upload, a rating, a schedule), not just chat, and a human approves anything that is published or changes a record.

**Live:** https://campusai-ashy.vercel.app

## Demo accounts

All accounts use the password **`CampusAI-demo-2026`**. The login page has one-click buttons for each.

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
| Courses & materials (enrolled only) | My courses & uploads (PDF/TXT → indexed → summarised) | Weekly college report (every Monday, or on demand) |
| Assignments: open the brief (and the original PDF), submit a file, get an instant rubric pre-check, then the professor's feedback | Assignments & submissions: upload the assignment PDF (agent drafts it) or create by hand, review, see pre-checks | Fees overview (read-only) |
| Fees & payments: Stripe test checkout, history, receipts | Approval inbox: assignment, feedback and announcement drafts (each can also be approved right where it appears) | Approval inbox: fee reminder batches and college announcements |
| Rate professors (anonymous, one per course per term) | Ratings & themes (aggregates only) | Ratings & themes (college-wide) |
| Assistant (side panel on every page) | Assistant · Announcements | Assistant · Announcements (college-wide) |

## The agents

All agents run on one runtime (`lib/agent.ts`). It logs every run to `agent_runs`, calls the model with a fixed output schema, and records failures so the UI shows "failed — retry" instead of pretending. Facts are loaded from the database by our code, never invented by the model.

There are **8 agents**, grouped by who they work for. A human approves anything that is published, sent or changes a record.

### For students

| Agent | Trigger | What it does | Human step |
| --- | --- | --- | --- |
| **Planner** | Dashboard load (cached 12 h), refresh, or chat | Ranked weekly plan from real deadlines, submission status, fees and new materials. Any link not taken from the facts is dropped | None |
| **Submission** | Student submits | Reads the file and checks it against the brief and rubric (met / partial / missing per item). The student sees this pre-check within seconds. It also drafts feedback and an indicative grade for the professor (see below) | Professor approves or edits the feedback. The final grade stays human |
| **Reminder** | Daily cron (08:00 IST) | Assignments due within 48 h with no submission, and unpaid fees due within 7 days, become reminders in the student's feed. Deduplicated per day. **Rule-based (no LLM), so it can never invent a deadline** | None (informational) |

### For professors

| Agent | Trigger | What it does | Human step |
| --- | --- | --- | --- |
| **Assignment** | Professor uploads the assignment PDF | Drafts the title, full instructions, rubric (from the PDF's marking scheme, or derived from its requirements and flagged) and the deadline exactly as the PDF states it, quoting its wording. No deadline in the PDF → none invented | Professor approves or edits; the assignment is created with the original PDF attached |
| **Materials** | Professor uploads notes | After indexing, writes a summary and drafts a "new material" announcement | Professor approves before students see it |
| **Submission** (feedback side) | Student submits | The professor gets the rubric check, a feedback draft and an indicative grade in the college's own scale | Approve or edit, right under the submission or in the inbox |
| **Feedback** | New or edited rating | Groups anonymous comments into themes (paraphrased; it never receives student ids) | None (read-only) |

### For the college admin

| Agent | Trigger | What it does | Human step |
| --- | --- | --- | --- |
| **Report** | Weekly cron (Mon), or "Generate report now" | The weekly college report: outstanding fees, late/missing submissions and rating themes. **Numbers come straight from SQL**; the model only writes the summary. Prepares a fee-reminder batch and, when useful, a college announcement draft (facts from the figures only) | Admin approves both, right under the report or in the inbox |

### For everyone

| Agent | Trigger | What it does | Human step |
| --- | --- | --- | --- |
| **CampusAI Assistant** | Chat, any role (side panel on every page) | Answers from the user's own records and course documents, citing document and page. Read-only tools, scoped by RLS; the report tool is admin-only | Refuses anything that would change a record |

## Architecture

```
Browser ──► Next.js on Vercel (App Router, Server Components, Server Actions, Route Handlers)
              │  every user query runs AS the user (Supabase session) → Postgres RLS decides what rows exist
              │
              ├─ after()  ─► event agents (assignment, submission, materials, feedback, planner) ─► agent_runs + approvals
              ├─ /api/chat ─► CampusAI Assistant (AI SDK streamText + typed Zod tools)
              ├─ /api/cron/daily · /api/cron/weekly ─► Reminder + Report agents (Vercel Cron, Bearer CRON_SECRET)
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

**Key files:** `lib/agent.ts` (runtime) · `lib/agents.ts` (Assignment, Submission, Materials, Feedback, Planner) · `lib/jobs.ts` (Reminder, Report) · `lib/tools.ts` (assistant tools) · `lib/ingest.ts` + `lib/chunk.ts` (RAG ingestion) · `app/(app)/inbox/actions.ts` (approval effects) · `app/api/stripe/webhook/route.ts`.

**Tables:** `institutions` (each college's settings) → `profiles`, `courses`, `enrollments`, `assignments`, `submissions`, `documents`, `document_chunks`, `fee_records`, `payments`, `announcements`, `professor_ratings`, `rating_summaries`, `agent_runs`, `approvals`, `notifications`. Every table carries `institution_id`.

## Security model

- **Two guards.** Every RLS policy checks the institution first, then the role or ownership. Server code adds what RLS can't express (file type, deadline, path checks). Hiding a button is never the only guard.
- **Students** see only their own fees, payments, submissions, ratings and notifications, and only courses, materials, document chunks and announcements for courses they're enrolled in.
- **Professors** see only courses they teach, and see ratings only through the anonymous `rating_aggregates` view and agent themes.
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
| `npm run test:access` | Student B can't read Student A's fees or submissions. College B sees nothing of College A. RAG search, announcements, approvals and agent runs are scoped. Professors never see raw ratings. One rating per course per term. An assignment can only attach a PDF from its own course |
| `npm run test:assistant` | Through the assistant: Student B asking for Student A's fees or submissions, a student asking for the weekly college report, "mark my fees paid", and College B asking about College A are all refused (checked on tool outputs) |
| `npm run test:webhook` | Forged signatures rejected, other apps' payments ignored, payments recorded once, replays not double-counted |
| `npm run test:cron` | Cron requires the secret, reminders match seeded deadlines, no duplicates, weekly report generated for both colleges |
| `npm run test:chunk` | RAG chunking keeps page numbers and overlap, and drops no words |

Run `npm run seed` again after `test:webhook` or `test:cron`.

## Demo script (≈ 5 min, on the live URL)

Run `npm run seed` first so the data and deadlines are fresh. Each step is one role.

1. **Intro (30 s):** college portals don't talk to each other, and plain chatbots can't see records or act safely. CampusAI is one app for students, professors and admins, where agents do the busywork and humans approve.
2. **Professor, notes (40 s):** My courses → DBMS → Materials → upload `demo/Unit 3 - Normalization.pdf` → Processing → Ready → the Materials agent's summary → approve the announcement draft right under the file.
3. **Professor, assignment (40 s):** Assignments → New assignment → upload `demo/Assignment 2 - SQL Joins.pdf` → the Assignment agent drafts the title, questions, rubric and the 6 Nov deadline → approve.
4. **Student, Aarav (60 s):** the dashboard shows the Planner's week plan and the fee balance. Ask the assistant "Explain 3NF from our notes" (answer cites *Unit 3 - Normalization.pdf, p. 3*), then "What should I focus on this week?"
5. **Student submits (40 s):** Assignments → Normalization Case Study → submit any PDF → the rubric pre-check appears in seconds.
6. **Professor reviews (30 s):** open the assignment → the submission shows "draft to review" → edit if needed, approve → Aarav sees the feedback.
7. **Student pays and rates (30 s):** pay tuition with test card `4242 4242 4242 4242` → Paid with a receipt → rate the DBMS professor. The professor sees only the average and themes.
8. **Admin (30 s):** Weekly report → Generate report now → approve the fee reminder batch and the announcement → reminders appear in the students' activity feeds.
9. **Security (20 s):** as Diya, ask the assistant for Aarav's fees → refused. Log in as Jordan: same app, $ and GPA, none of Northfield's data.
10. **Close (20 s):** the architecture (above): one agent runtime, RLS on every table, the webhook is the only writer of payments. Then what's next.

## Design decisions

- **Chunks are ~450 tokens.** The free `gte-small` embedding model reads at most 512 tokens.
- **The Reminder agent is rule-based.** Comparing dates needs no LLM, and this removes any chance of invented deadlines.
- **Groq free tier.** Agent inputs are capped at ~14k characters. The model is one line in `lib/ai.ts`.
- **Ratings anonymity** is enforced structurally (no professor access to rows, themes paraphrased). A minimum-count threshold before showing themes is the next step for real classes.

## Next steps

Student self-signup and CSV import, email/SMS notifications, OCR for scanned PDFs, gradebook, ERP integration, batching the Feedback agent on a schedule.
