import Link from "next/link";

/** Shared top bar so every screen looks like one product. */
export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">HireLoop</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-ink-600">{right}</div>
      </div>
    </header>
  );
}

export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="var(--color-ink-900)" />
      <path
        d="M7 16.5V7.5M7 12h5m0 0a3 3 0 1 0 3-3m-3 3a3 3 0 1 1 3 3"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Status pill used for channel results and verdicts. */
export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-700",
    good: "bg-good-50 text-good-600",
    warn: "bg-warn-50 text-warn-700",
    bad: "bg-bad-50 text-bad-700",
    accent: "bg-accent-50 text-accent-700",
  } as const;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
