// Seeds 2 fictional demo colleges. Idempotent: deletes demo colleges + demo users, then recreates.
// Run: npm run seed
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const DEMO_PASSWORD = "CampusOS-demo-2026";

const day = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * day);
const dateIn = (n: number) => inDays(n).toISOString().slice(0, 10);

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  return data!;
}

const users = [
  { key: "mehta", email: "prof.mehta@northfield.demo", name: "Dr. Kavita Mehta", role: "professor", college: "A" },
  { key: "aarav", email: "aarav@northfield.demo", name: "Aarav Shah", role: "student", college: "A" },
  { key: "diya", email: "diya@northfield.demo", name: "Diya Nair", role: "student", college: "A" },
  { key: "adminA", email: "admin@northfield.demo", name: "Rohan Iyer", role: "admin", college: "A" },
  { key: "taylor", email: "prof.taylor@lakeside.demo", name: "Prof. Sam Taylor", role: "professor", college: "B" },
  { key: "jordan", email: "jordan@lakeside.demo", name: "Jordan Lee", role: "student", college: "B" },
] as const;

async function wipe() {
  await must(db.from("institutions").delete().in("slug", ["northfield", "lakeside"]));
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const demoEmails = new Set<string>(users.map((u) => u.email));
  for (const u of data.users) if (u.email && demoEmails.has(u.email)) await db.auth.admin.deleteUser(u.id);
}

async function main() {
  await wipe();

  const [A, B] = await must(
    db
      .from("institutions")
      .insert([
        { name: "Northfield Institute of Technology", slug: "northfield", currency: "INR", term_type: "semester", grading_scale: "cgpa10", current_term: "2026 Odd Semester" },
        { name: "Lakeside College", slug: "lakeside", currency: "USD", term_type: "quarter", grading_scale: "gpa4", current_term: "Fall 2026" },
      ])
      .select()
  );
  const inst = { A, B };

  const id: Record<string, string> = {};
  for (const u of users) {
    const { data, error } = await db.auth.admin.createUser({ email: u.email, password: DEMO_PASSWORD, email_confirm: true });
    if (error) throw error;
    id[u.key] = data.user.id;
    await must(db.from("profiles").insert({ id: data.user.id, institution_id: inst[u.college].id, role: u.role, full_name: u.name, email: u.email }));
  }

  const [dbms, os, cs110] = await must(
    db
      .from("courses")
      .insert([
        { institution_id: A.id, code: "CS301", name: "Database Management Systems", professor_id: id.mehta, term: A.current_term },
        { institution_id: A.id, code: "CS302", name: "Operating Systems", professor_id: id.mehta, term: A.current_term },
        { institution_id: B.id, code: "CS110", name: "Intro to Programming", professor_id: id.taylor, term: B.current_term },
      ])
      .select()
  );

  // Aarav: DBMS + OS. Diya: OS only (so she must never see DBMS material). Jordan: college B.
  await must(
    db.from("enrollments").insert([
      { institution_id: A.id, course_id: dbms.id, student_id: id.aarav },
      { institution_id: A.id, course_id: os.id, student_id: id.aarav },
      { institution_id: A.id, course_id: os.id, student_id: id.diya },
      { institution_id: B.id, course_id: cs110.id, student_id: id.jordan },
    ])
  );

  await must(
    db.from("assignments").insert([
      {
        institution_id: A.id, course_id: dbms.id, created_by: id.mehta, due_at: inDays(2).toISOString(),
        title: "Normalization Case Study",
        instructions: "Take the provided library-management table and normalize it to 3NF. Explain each step and justify your decomposition.",
        rubric: ["Identifies all functional dependencies", "Correct 1NF and 2NF decomposition", "Correct 3NF decomposition with justification", "Includes a worked normalization example"],
      },
      {
        institution_id: A.id, course_id: os.id, created_by: id.mehta, due_at: inDays(5).toISOString(),
        title: "CPU Scheduling Report",
        instructions: "Compare FCFS, SJF and Round Robin on the given process set. Show Gantt charts and average waiting time.",
        rubric: ["Gantt chart for each algorithm", "Correct average waiting times", "Comparison and recommendation"],
      },
      {
        institution_id: B.id, course_id: cs110.id, created_by: id.taylor, due_at: inDays(4).toISOString(),
        title: "Loops Lab",
        instructions: "Write a program that prints the first 20 Fibonacci numbers and explain your loop invariant.",
        rubric: ["Program runs correctly", "Explains loop invariant", "Clean, commented code"],
      },
    ])
  );

  await must(
    db.from("fee_records").insert([
      { institution_id: A.id, student_id: id.aarav, description: "Tuition fee", term: A.current_term, amount_due: 85000, amount_paid: 0, due_date: dateIn(6) },
      { institution_id: A.id, student_id: id.aarav, description: "Library fee", term: A.current_term, amount_due: 2500, amount_paid: 2500, due_date: dateIn(-20) },
      { institution_id: A.id, student_id: id.diya, description: "Tuition fee", term: A.current_term, amount_due: 85000, amount_paid: 40000, due_date: dateIn(6) },
      { institution_id: B.id, student_id: id.jordan, description: "Fall tuition", term: B.current_term, amount_due: 4200, amount_paid: 0, due_date: dateIn(10) },
    ])
  );

  await must(
    db.from("announcements").insert({
      institution_id: A.id, author_id: id.adminA, title: "Welcome to the odd semester",
      body: "Classes begin this week. Check CampusOS for deadlines, materials and fees.",
    })
  );

  console.log(`Seeded 2 colleges, ${users.length} users. Password for all: ${DEMO_PASSWORD}`);
  for (const u of users) console.log(`  ${u.role.padEnd(9)} ${u.email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
