type AlertProps = {
  tone?: 'error' | 'success' | 'info';
  children: React.ReactNode;
};

const TONE_CLASSES: Record<NonNullable<AlertProps['tone']>, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
};

export function Alert({ tone = 'info', children }: AlertProps) {
  return (
    <div role="alert" className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASSES[tone]}`}>
      {children}
    </div>
  );
}
