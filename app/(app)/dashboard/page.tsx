import { getMe } from "@/lib/supabase";

export default async function Dashboard() {
  const me = await getMe();
  const { institution: i } = me;
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Welcome, {me.full_name.split(" ")[0]}</h1>
      <p className="text-sm text-gray-500">
        {i.name} · {i.current_term} · {i.currency} · {i.grading_scale.toUpperCase()}
      </p>
    </div>
  );
}
