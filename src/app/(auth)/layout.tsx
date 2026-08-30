/*
 * The auth pages own their own width. Login runs a two-column split at desktop
 * size, signup stays a single centred card, so constraining both to one measure
 * here would cap the wider of the two.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">{children}</main>;
}
