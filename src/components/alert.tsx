type AlertProps = {
  tone?: 'error' | 'success' | 'info';
  children: React.ReactNode;
};

const TONE: Record<NonNullable<AlertProps['tone']>, { classes: string; icon: string }> = {
  error: {
    classes: 'border-status-rejected/25 bg-status-rejected-tint text-status-rejected',
    icon: '✕',
  },
  success: {
    classes: 'border-status-shortlisted/25 bg-status-shortlisted-tint text-status-shortlisted',
    icon: '✓',
  },
  info: { classes: 'border-mist-300 bg-mist-100 text-ink-soft', icon: 'ℹ' },
};

/** Tone is carried by an icon as well as colour, so it reads without hue. */
export function Alert({ tone = 'info', children }: AlertProps) {
  const { classes, icon } = TONE[tone];

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm ${classes}`}
    >
      <span aria-hidden="true" className="mt-px shrink-0 font-semibold leading-5">
        {icon}
      </span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
