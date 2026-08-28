/**
 * The opening of every page.
 *
 * Existed only as a copy-pasted `page-title` + `page-lede` pair, which is why
 * the interior of the app felt plainer than its front door. Centralising it
 * gives every page the same rhythm — eyebrow, title, lede, optional action —
 * and the same entrance, so they read as one product.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
  className = '',
}: {
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`enter-1 mb-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title mt-2">{title}</h1>
          {lede ? <p className="page-lede">{lede}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

/**
 * A small run of facts about the page's subject — location, job type, dates.
 * Glyphs carry the category so each item is scannable without reading the
 * label, and the row wraps rather than truncating on narrow screens.
 */
export function MetaRow({
  items,
  className = '',
}: {
  items: Array<{ glyph: string; label: string }>;
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted ${className}`}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="text-petrol-500">
            {item.glyph}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
