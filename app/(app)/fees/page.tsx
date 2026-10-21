import { createClient, getMe } from "@/lib/supabase";
import { money } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/submit-button";
import { startCheckout } from "./actions";

const statusStyle: Record<string, string> = {
  paid: "bg-mint text-ok-ink",
  partial: "bg-yellow text-warn-ink",
  unpaid: "bg-danger/40 text-danger-ink",
};

export default async function FeesPage(props: PageProps<"/fees">) {
  const { paid: justPaid } = await props.searchParams;
  const me = await getMe();
  const db = await createClient();
  const cur = me.institution.currency;
  // RLS: a student gets only their own rows; an admin gets the whole college (read-only).
  const [{ data: fees }, { data: payments }] = await Promise.all([
    db.from("fee_records").select("id, description, term, amount_due, amount_paid, due_date, status, student:profiles(full_name)").order("due_date"),
    db.from("payments").select("id, amount, currency, paid_at, receipt_url, fee:fee_records(description), student:profiles(full_name)").order("paid_at", { ascending: false }),
  ]);

  const due = (fees ?? []).reduce((s, f) => s + f.amount_due, 0);
  const paid = (fees ?? []).reduce((s, f) => s + f.amount_paid, 0);
  const isAdmin = me.role === "admin";
  const waiting = !!justPaid && !isAdmin && !payments?.length;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{isAdmin ? "Fees overview" : "Fees & payments"}</h1>
      {justPaid && !isAdmin && (
        <p role="status" className="rounded-lg bg-mint p-3 text-sm text-ok-ink">
          Payment submitted. Your fee updates as soon as Stripe confirms it (usually a few seconds).
          <AutoRefresh active={waiting} />
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[["Total due", due], ["Paid", paid], ["Balance", due - paid]].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-ink/70">{label}</p>
            <p className="text-lg font-semibold">{money(value as number, cur)}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="border-b border-ink p-4 font-medium">Fee records</h2>
        <ul className="divide-y divide-ink/15">
          {(fees ?? []).map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <p className="font-medium">{isAdmin && `${f.student?.full_name} · `}{f.description}</p>
                <p className="text-xs text-ink/70">{f.term} · due {f.due_date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span>{money(f.amount_paid, cur)} / {money(f.amount_due, cur)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusStyle[f.status ?? "unpaid"]}`}>{f.status}</span>
                {!isAdmin && f.status !== "paid" && (
                  <form action={startCheckout.bind(null, f.id)}>
                    <SubmitButton pending="Opening Stripe…" className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">Pay {money(f.amount_due - f.amount_paid, cur)}</SubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
          {!fees?.length && <li className="p-4 text-sm text-ink/70">No fee records.</li>}
        </ul>
      </section>

      <section className="card">
        <h2 className="border-b border-ink p-4 font-medium">Payment history</h2>
        <ul className="divide-y divide-ink/15">
          {(payments ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
              <span>{isAdmin && `${p.student?.full_name} · `}{p.fee?.description} · <LocalTime iso={p.paid_at} /></span>
              <span>
                {money(p.amount, p.currency)}
                {p.receipt_url && <a href={p.receipt_url} target="_blank" className="ml-2 underline">Receipt</a>}
              </span>
            </li>
          ))}
          {!payments?.length && <li className="p-4 text-sm text-ink/70">No payments yet.</li>}
        </ul>
      </section>
    </div>
  );
}
