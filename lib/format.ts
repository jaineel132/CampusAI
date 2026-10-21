// Money in the college's own currency (institutions.currency).
export function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

// "in 2 days" / "3 hours ago"
export function relative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const hours = Math.round(diff / 3_600_000);
  return Math.abs(hours) < 48 ? rtf.format(hours, "hour") : rtf.format(Math.round(hours / 24), "day");
}

export const UPLOAD_TYPES = ["application/pdf", "text/plain"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Storage-safe file name
export const safeName = (name: string) => name.replace(/[^\w.-]+/g, "_").slice(-100);

export const isPast = (iso: string) => new Date(iso).getTime() < Date.now();
export const daysFromNow = (n: number) => new Date(Date.now() + n * 864e5).toISOString();
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
