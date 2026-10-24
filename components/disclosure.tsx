// A section that starts collapsed: the summary line says what's inside, a click opens the rest.
// Native <details>, so it works without JS and the open state survives auto-refreshes.
export function Disclosure({ id, title, meta, open, children, className = "" }: {
  id?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details id={id} open={open} className={`disclosure scroll-mt-4 ${className}`}>
      <summary className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="chevron grid size-6 shrink-0 place-items-center rounded-lg border border-line bg-white text-[10px] font-bold">▶</span>
        {/* The title keeps at least ~10rem; when the meta doesn't fit beside it, the meta wraps below. */}
        <span className="min-w-0 grow basis-40 break-words">{title}</span>
        {meta && <span className="ml-auto">{meta}</span>}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
