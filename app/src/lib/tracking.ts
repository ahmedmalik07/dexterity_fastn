import { PLATFORMS, type Platform } from "./schemas";

/** Always attach attribution, including when an editor removes the placeholder. */
export function withTrackedLinks(variants: Record<Platform, string>, base: string) {
  const result = {} as Record<Platform, string>;
  for (const platform of PLATFORMS) {
    const link = `${base}?src=${platform}`;
    const body = variants[platform].replaceAll("{{APPLY_LINK}}", "").trim();
    // Count Unicode code points and reserve room for the actual URL.
    const budget = 280 - Array.from(link).length - 2;
    result[platform] = platform === "x" && Array.from(body).length > budget
      ? `${Array.from(body).slice(0, Math.max(0, budget - 1)).join("").trimEnd()}…\n\n${link}`
      : `${body}\n\n${link}`;
  }
  return result;
}
