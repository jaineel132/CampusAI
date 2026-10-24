// Demo mode: reviewers pick a role instead of logging in. Each role is a seeded demo account,
// signed in server-side (app/demo/[role]/route.ts), so RLS still applies per role.
// ponytail: shared demo password on the server; a real deployment uses the college's SSO instead.
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "CampusAI-demo-2026";

// `assignment` links straight to that assignment's page; its id is looked up at render time (ids change on every reset).
type Look = { text: string; href?: string; assignment?: string };

export const DEMO_ROLES = {
  student: {
    label: "Student", email: "aarav@northfield.demo", who: "Aarav Shah · Northfield (India)",
    pitch: "The student dashboard: week plan, materials, assignments, fees and ratings in one place.",
    look: [
      { text: "Dashboard: the Planner agent's ranked plan for the week", href: "/dashboard" },
      { text: "Courses › DBMS › Materials: notes summarised by the Materials agent", href: "/courses" },
      { text: "Normalization Case Study: instant rubric pre-check, then the professor's feedback", assignment: "Normalization Case Study" },
      { text: "SQL Joins and Aggregation: created by the Assignment agent from the professor's PDF", assignment: "SQL Joins and Aggregation" },
      { text: "✦ Ask CampusAI (bottom right): try “Explain 3NF from our notes”" },
      { text: "Fees: pay tuition with Stripe's test card 4242 4242 4242 4242", href: "/fees" },
    ] as Look[],
  },
  professor: {
    label: "Professor", email: "prof.mehta@northfield.demo", who: "Dr. Kavita Mehta · teaches DBMS and OS",
    pitch: "Agents draft the busywork: announcements, assignments, feedback. The professor approves.",
    look: [
      { text: "CPU Scheduling Report: Diya's submission with the Submission agent's feedback draft to approve", assignment: "CPU Scheduling Report" },
      { text: "Approval inbox: every draft waiting for you in one place", href: "/inbox" },
      { text: "My courses › DBMS: uploaded notes, the agent's summary and the approved announcement", href: "/courses" },
      { text: "SQL Joins and Aggregation: drafted from a PDF by the Assignment agent, with the original attached", assignment: "SQL Joins and Aggregation" },
      { text: "Assignments: upload a PDF from the demo/ folder to watch the Assignment agent live", href: "/assignments" },
      { text: "Ratings & themes: anonymous averages and the Feedback agent's themes", href: "/ratings" },
    ] as Look[],
  },
  admin: {
    label: "Admin", email: "admin@northfield.demo", who: "Rohan Iyer · college admin",
    pitch: "The college view: a weekly report written by an agent, with figures straight from the database.",
    look: [
      { text: "Weekly report: the Report agent's summary of fees, late work and ratings", href: "/ops" },
      { text: "Approval inbox: a fee-reminder batch and a college announcement to approve", href: "/inbox" },
      { text: "Fees overview: every student's balance (read-only)", href: "/fees" },
      { text: "Ratings & themes: college-wide, anonymous", href: "/ratings" },
    ] as Look[],
  },
  "student-b": {
    label: "Student B", email: "diya@northfield.demo", who: "Diya Nair · enrolled in OS only",
    pitch: "Shows the access rules: a second student who must never see Aarav's data or DBMS material.",
    look: [
      { text: "Only OS appears: no DBMS course, notes or assignments", href: "/courses" },
      { text: "Ask the assistant “How much does Aarav Shah owe in fees?”: it is refused" },
      { text: "CPU Scheduling Report: her pre-check shows what is missing", assignment: "CPU Scheduling Report" },
    ] as Look[],
  },
  "other-college": {
    label: "Other college", email: "jordan@lakeside.demo", who: "Jordan Lee · Lakeside College (US)",
    pitch: "Multi-college: the same app with $, quarters and GPA 4.0, and none of Northfield's data.",
    look: [
      { text: "Fees in $ and the Fall quarter", href: "/fees" },
      { text: "A different course list: nothing from Northfield is visible", href: "/courses" },
      { text: "Loops Lab: Lakeside's own assignment, with its own deadline and rubric", assignment: "Loops Lab" },
    ] as Look[],
  },
} as const;

export type DemoRole = keyof typeof DEMO_ROLES;
export const demoRoleFor = (email: string) =>
  (Object.keys(DEMO_ROLES) as DemoRole[]).find((k) => DEMO_ROLES[k].email === email);
