export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">{children}</main>
  );
}
