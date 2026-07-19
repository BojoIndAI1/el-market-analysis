export const PAGE_ACCESS_KEYS = [
  { key: "ranking", label: "Ranking" },
  { key: "data", label: "Data" },
  { key: "evaluation", label: "Evaluation" },
  { key: "generator-economics", label: "Generator Economics" },
  { key: "methodology", label: "Methodology" },
] as const;

export type PageAccessKey = (typeof PAGE_ACCESS_KEYS)[number]["key"];
