import { z } from "zod";

/** Prompt A output: a one-liner turned into a structured job post. */
export const JobSchema = z.object({
  title: z.string().min(2),
  location: z.string(),
  workMode: z.enum(["Onsite", "Hybrid", "Remote"]),
  salaryRange: z.string(),
  summary: z.string(),
  responsibilities: z.array(z.string()).min(3).max(8),
  mustHaves: z.array(z.string()).min(1).max(6),
  niceToHaves: z.array(z.string()).max(6),
  jdText: z.string().min(40),
});
export type Job = z.infer<typeof JobSchema>;

/** Prompt B output: one version of the post per platform. */
export const VariantsSchema = z.object({
  linkedin: z.string().min(20),
  x: z.string().min(10),
  facebook: z.string().min(20),
  whatsapp: z.string().min(10),
  discord: z.string().min(20),
});
export type Variants = z.infer<typeof VariantsSchema>;

export const PLATFORMS = ["linkedin", "x", "facebook", "whatsapp", "discord"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Prompt C output: the CV scored against the job. */
export const ScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.enum(["Strong", "Maybe", "Weak"]),
  mustHaveChecks: z
    .array(z.object({ skill: z.string(), met: z.boolean(), evidence: z.string() }))
    .default([]),
  strengths: z.string(),
  gaps: z.string(),
  summary: z.string(),
});
export type Score = z.infer<typeof ScoreSchema>;

/* ---------- request bodies ---------- */

export const GenerateBody = z.object({
  oneLiner: z.string().min(8, "Describe the role in a few more words").max(500),
});

export const PublishBody = z.object({
  jobId: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/),
  oneLiner: z.string().max(500).optional(),
  job: JobSchema,
  variants: VariantsSchema,
});

export const SOURCES = ["linkedin", "x", "facebook", "whatsapp", "discord", "slack", "direct"] as const;
export const SourceSchema = z.enum(SOURCES).catch("direct");

export const ApplyFields = z.object({
  jobId: z.string().min(3).max(60),
  name: z.string().min(2, "Please enter your full name").max(120),
  email: z.email("Please enter a valid email"),
  phone: z.string().min(6, "Please enter a valid phone number").max(40),
  linkedin: z.union([z.url(), z.literal("")]).optional().default(""),
  src: SourceSchema,
  consent: z.literal("true", { message: "Consent is required to process your CV" }),
});

/** Public job fields served to the apply page — never exposes scoring internals. */
export const PublicJobSchema = z.object({
  jobId: z.string(),
  title: z.string(),
  location: z.string(),
  workMode: z.string(),
  salaryRange: z.string(),
  summary: z.string(),
  jdText: z.string(),
  responsibilities: z.array(z.string()).default([]),
  mustHaves: z.array(z.string()).default([]),
  niceToHaves: z.array(z.string()).default([]),
});
export type PublicJob = z.infer<typeof PublicJobSchema>;
