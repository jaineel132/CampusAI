// Demo mode: reviewers pick a role instead of logging in. Each role is a seeded demo account,
// signed in server-side (app/demo/[role]/route.ts), so RLS still applies per role.
// ponytail: shared demo password on the server; a real deployment uses the college's SSO instead.
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "CampusAI-demo-2026";

// One row of "What the AI agents did": which agent, what it already did, where to see it.
// `assignment` links straight to that assignment's page; its id is looked up at render time (ids change on every reset).
type Look = { agent: string; did: string; href?: string; assignment?: string };

export const DEMO_ROLES = {
  student: {
    label: "Student", name: "Aarav", as: "a student", email: "aarav@northfield.demo", who: "Aarav Shah · Northfield (India)",
    pitch: "The student dashboard: week plan, materials, assignments, fees and ratings in one place.",
    look: [
      { agent: "Planner agent", did: "Ranked his week from his real deadlines and fees", href: "/dashboard#plan" },
      { agent: "Submission agent", did: "Checked his Normalization answer against the rubric; the professor's feedback is released", assignment: "Normalization Case Study" },
    ] as Look[],
    ask: ["What's due this week?", "Explain 3NF from our notes", "How much do I owe in fees?"],
  },
  professor: {
    label: "Professor", name: "Dr. Mehta", as: "a professor", email: "prof.mehta@northfield.demo", who: "Dr. Kavita Mehta · teaches DBMS and OS",
    pitch: "Agents draft the busywork: announcements, assignments, feedback. The professor approves.",
    look: [
      { agent: "Submission agent", did: "Pre-checked Diya's CPU Scheduling report and drafted feedback and a grade, waiting for your approval", assignment: "CPU Scheduling Report" },
      { agent: "Assignment agent", did: "Drafted “Transactions and Concurrency Control” from your PDF: questions, rubric and deadline, waiting for your approval", href: "/assignments" },
      { agent: "Materials agent", did: "Summarised your new OS Unit 2 notes and drafted an announcement for students, waiting for your approval", href: "/courses" },
      { agent: "Feedback agent", did: "Turned anonymous student ratings into themes, with no names", href: "/ratings" },
    ] as Look[],
    ask: ["Which assignments are due soon?", "Summarise our Unit 3 notes"],
  },
  admin: {
    label: "Admin", name: "Rohan", as: "the college admin", email: "admin@northfield.demo", who: "Rohan Iyer · college admin",
    pitch: "The college view: a weekly report written by an agent, with figures straight from the database.",
    look: [
      { agent: "Report agent", did: "Wrote this week's college report, with every figure taken from the database", href: "/ops" },
      { agent: "Report agent", did: "Prepared a fee-reminder batch and a college announcement, waiting for your approval", href: "/ops" },
      { agent: "Feedback agent", did: "Summarised professor ratings across the college into anonymous themes", href: "/ratings" },
    ] as Look[],
    ask: ["Which fees are still unpaid?", "Summarise this week's report"],
  },
  "student-b": {
    label: "Student B", name: "Diya", as: "a second student", email: "diya@northfield.demo", who: "Diya Nair · enrolled in OS only",
    pitch: "Shows the access rules: a second student who must never see Aarav's data or DBMS material.",
    look: [
      { agent: "Submission agent", did: "Her CPU Scheduling pre-check shows exactly what is missing", assignment: "CPU Scheduling Report" },
      { agent: "Planner agent", did: "Built her own week plan, from only her course and fees", href: "/dashboard#plan" },
      { agent: "Privacy", did: "Only her OS course is visible: no DBMS notes, assignments or other students' records", href: "/courses" },
    ] as Look[],
    ask: ["How much does Aarav Shah owe in fees?"],
  },
  "other-college": {
    label: "Other college", name: "Jordan", as: "a student at another college", email: "jordan@lakeside.demo", who: "Jordan Lee · Lakeside College (US)",
    pitch: "Multi-college: the same app with $, quarters and GPA 4.0, and none of Northfield's data.",
    look: [
      { agent: "Planner agent", did: "Built Jordan's week plan in Lakeside's own terms", href: "/dashboard#plan" },
      { agent: "Multi-college", did: "Fees in $, quarters and GPA 4.0, and none of Northfield's data", href: "/fees" },
      { agent: "Assignment", did: "Lakeside's own “Loops Lab”, with its own deadline and rubric", assignment: "Loops Lab" },
    ] as Look[],
    ask: ["What do I owe in fees?"],
  },
} as const;

export type DemoRole = keyof typeof DEMO_ROLES;
export const demoRoleFor = (email: string) =>
  (Object.keys(DEMO_ROLES) as DemoRole[]).find((k) => DEMO_ROLES[k].email === email);
