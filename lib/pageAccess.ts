export const PAGE_ACCESS_KEYS = [
  { key: "ranking", label: "Overview" },
  { key: "scorecard", label: "Scorecard" },
  { key: "data", label: "Data" },
  { key: "zone-profile", label: "Zone Profile" },
  { key: "evaluation", label: "Evaluation" },
  { key: "generator-economics", label: "Generator Economics" },
  { key: "methodology", label: "Methodology" },
] as const;

export type PageAccessKey = (typeof PAGE_ACCESS_KEYS)[number]["key"];

export const PAGE_MIN_ROLE_OPTIONS = ["public", "user", "superuser", "admin"] as const;
export type PageMinRole = (typeof PAGE_MIN_ROLE_OPTIONS)[number];

// Hierarchy: a page's min_role is the lowest role that can view it; anyone at or
// above that level (by this ordering) is let through. "public" needs no login at all.
export const ROLE_LEVEL: Record<PageMinRole, number> = {
  public: 0,
  user: 1,
  superuser: 2,
  admin: 3,
};
