import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="text-sm font-bold tracking-tight text-blue-950">
            GGF <span className="font-medium text-slate-500">/ Security</span>
          </div>
          <Link
            className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </header>
      <section className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-16 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-800">
            Global Ground Force Security Agency Inc.
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
            Security Personnel
            <br />
            Assessment System
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600">
            A secure workspace for authorized HR staff, supervisors, and
            security personnel.
          </p>
          <Link
            className="mt-8 inline-flex rounded-lg bg-blue-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
            href="/login"
          >
            Continue to sign in
          </Link>
        </div>
      </section>
      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-slate-500 sm:px-8">
          Internal personnel system · Legazpi City, Albay
        </p>
      </footer>
    </main>
  );
}
