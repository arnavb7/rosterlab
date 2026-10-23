import Link from "next/link";

const later = [
  ["Manager report", "Milestone 2"],
  ["Draft lab", "Milestone 2"],
  ["Waiver watch", "Milestone 3"],
  ["Trade finder", "Milestone 4"],
  ["Recommendations", "Milestone 5"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Tendencies
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted" aria-label="Primary">
            <Link href="/" className="text-foreground">
              Analyze
            </Link>
            <Link href="/data">Data</Link>
            {later.map(([label, when]) => (
              <span key={label} title={`${label} arrives in ${when}`}>
                {label}
                <span className="ml-1 text-xs uppercase tracking-wide text-amber">Later</span>
              </span>
            ))}
          </nav>
        </div>
      </header>
      <main id="content" className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
