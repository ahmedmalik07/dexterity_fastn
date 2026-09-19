"use client";

import { useState } from "react";

export default function ApplyForm({ jobId, src }: { jobId: string; src: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [emailOk, setEmailOk] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("sending");

    const form = new FormData(event.currentTarget);
    form.set("jobId", jobId);
    form.set("src", src);

    try {
      const response = await fetch("/api/apply", { method: "POST", body: form });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error ?? "Something went wrong");
      setEmailOk(Boolean(payload.data?.emailOk));
      setState("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <section className="rise mt-8 rounded-xl border border-good-600/20 bg-good-50 p-7 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-good-600">
          <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
            <path
              d="M5 10.5l3.2 3.2L15 7"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-ink-900">Application received</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
          Your application and CV are saved for the hiring team to review.
          {emailOk ? " A confirmation email is on its way." : " Your application is received even if a confirmation email does not arrive."}
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8">
      <h2 className="text-xl font-semibold">Apply</h2>
      <p className="mt-1 text-sm text-ink-500">Takes under a minute.</p>

      <div className="mt-5 space-y-4">
        <Field label="Full name" name="name" autoComplete="name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Phone" name="phone" type="tel" autoComplete="tel" required />
        <Field
          label="LinkedIn profile"
          name="linkedin"
          type="url"
          optional
          placeholder="https://linkedin.com/in/…"
        />

        <div>
          <label htmlFor="cv" className="block text-sm font-medium text-ink-800">
            Your CV <span className="font-normal text-ink-400">· PDF, up to 5 MB</span>
          </label>
          <label
            htmlFor="cv"
            className="mt-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-ink-300 bg-ink-50 px-4 py-4 text-sm hover:border-accent-500"
          >
            <span className={fileName ? "truncate font-medium text-ink-900" : "text-ink-500"}>
              {fileName || "Choose a PDF file"}
            </span>
            <span className="btn btn-quiet !px-3 !py-1.5 !text-xs">Browse</span>
          </label>
          <input
            id="cv"
            name="cv"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="sr-only"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-ink-700">
          <input type="checkbox" name="consent" value="true" required className="mt-0.5 h-4 w-4 accent-[var(--color-accent-600)]" />
          <span>I agree that my CV is processed for this application.</span>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-bad-700/20 bg-bad-50 p-3 text-sm text-bad-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={state === "sending"} className="btn btn-accent mt-6 w-full !py-3.5 !text-base">
        {state === "sending" ? "Reviewing your CV…" : "Submit application"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  optional,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-ink-800">
        {label}
        {optional && <span className="font-normal text-ink-400"> · optional</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="field mt-1.5 !text-base"
      />
    </div>
  );
}
