import { notFound } from "next/navigation";
import { loadJob } from "@/lib/jobs";
import { Logo, Pill } from "@/components/Shell";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { jobId } = await params;
  const { src } = await searchParams;

  const job = await loadJob(jobId);
  if (!job) notFound();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-ink-200">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-5">
          <Logo className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-tight">HireLoop</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-16 pt-8">
        <h1 className="text-[28px] leading-tight font-semibold sm:text-4xl">{job.title}</h1>

        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>{job.location}</Pill>
          <Pill>{job.workMode}</Pill>
          <Pill tone="accent">{job.salaryRange}</Pill>
        </div>

        <p className="mt-5 text-[17px] leading-relaxed text-ink-700">{job.summary}</p>

        {job.mustHaves.length > 0 && (
          <section className="mt-7 rounded-xl border border-ink-200 bg-ink-50 p-5">
            <h2 className="eyebrow">What we need from you</h2>
            <ul className="mt-3 space-y-2">
              {job.mustHaves.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] text-ink-800">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        <details className="group mt-4 rounded-xl border border-ink-200 p-5">
          <summary className="cursor-pointer list-none text-sm font-medium text-ink-800">
            Read the full job description
            <span className="float-right text-ink-400 group-open:hidden">+</span>
            <span className="float-right hidden text-ink-400 group-open:inline">−</span>
          </summary>
          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700">
            {job.jdText}
          </p>
        </details>

        <ApplyForm jobId={jobId} src={src ?? "direct"} />

        <p className="mt-8 text-center text-xs text-ink-400">
          We reply to every applicant, either way.
        </p>
      </main>
    </div>
  );
}
