import Link from "next/link";
import { TopBar } from "@/components/Shell";

const STEPS = [
  {
    step: "01",
    title: "Post once",
    body: "Type the role in one line. Every channel gets a version written for it, each carrying the same apply link with its own source tag.",
  },
  {
    step: "02",
    title: "Collect everywhere",
    body: "CVs from LinkedIn, WhatsApp groups and Facebook comments land in one pipeline, each tagged with the channel it came from.",
  },
  {
    step: "03",
    title: "Answer everyone",
    body: "Every CV is read and scored against the role. Moving a card emails the candidate. Nobody waits in silence.",
  },
];

export default function Home() {
  return (
    <>
      <TopBar
        right={
          <Link href="/compose" className="btn btn-primary !px-4 !py-2 !text-[13px]">
            Post a job
          </Link>
        }
      />

      <main>
        <section className="border-b border-ink-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <p className="eyebrow">Hiring operations for Pakistani teams</p>

            <h1 className="mt-4 max-w-3xl text-4xl leading-[1.08] font-semibold sm:text-6xl">
              One job post.
              <br />
              Every channel.
              <span className="text-ink-400"> One pipeline.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
              Hiring here happens across LinkedIn, Facebook groups and WhatsApp. HireLoop writes
              the post for each one, tracks which channel produced which candidate, and makes sure
              every applicant hears back.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/compose" className="btn btn-primary">
                Write a job post
              </Link>
              <span className="text-sm text-ink-500">Takes about ten seconds.</span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-3">
            {STEPS.map((item) => (
              <div key={item.step} className="bg-white p-7">
                <span className="font-mono text-xs text-ink-400">{item.step}</span>
                <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-ink-200 bg-white p-7">
            <p className="eyebrow">Built on Fastn</p>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-600">
              Every outbound action — writing to the hiring board, emailing candidates, alerting the
              team — runs through Fastn connectors. Credentials live in Fastn, not in this app. For
              the channels that have no API at all, such as WhatsApp groups and Facebook groups,
              HireLoop reads the candidate straight off the recruiter&apos;s screen and pushes them
              into the same pipeline.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
