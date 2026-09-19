/** jobId = short slug of the title + city + 3 random chars, e.g. jr-react-isb-7k2 */

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "for", "of", "to", "in", "at", "developer"]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((word) => word && !STOP_WORDS.has(word));
}

function shortCity(location: string): string {
  const city = words(location)[0] ?? "";
  const known: Record<string, string> = {
    islamabad: "isb",
    karachi: "khi",
    lahore: "lhe",
    rawalpindi: "rwp",
    peshawar: "psh",
    faisalabad: "fsd",
    remote: "rem",
  };
  return known[city] ?? city.slice(0, 3);
}

export function slugify(titleText: string, location = ""): string {
  const titleParts = words(titleText).slice(0, 3);
  const city = shortCity(location);
  const random = Math.random().toString(36).slice(2, 5);
  return [...titleParts, city, random].filter(Boolean).join("-").slice(0, 60);
}
