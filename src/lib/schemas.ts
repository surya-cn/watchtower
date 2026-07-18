import { z } from "zod";

// ─── Project Config Schema ───────────────────────────────────────

export const ProjectConfigSchema = z.object({
  sources: z.object({
    reddit: z
      .object({ subreddits: z.array(z.string()) })
      .nullable(),
    twitter: z
      .object({ search_terms: z.array(z.string()) })
      .nullable(),
    ea_forum: z
      .object({ urls: z.array(z.string()) })
      .nullable(),
    discord: z
      .object({ server_ids: z.array(z.string()) })
      .nullable(),
  }),
  keywords: z.object({
    include: z.array(z.string()),
    exclude: z.array(z.string()),
  }),
  classification: z.object({
    categories: z.array(z.string()),
    severity_thresholds: z.object({
      high: z.number(),
      medium: z.number(),
    }),
  }),
  integrations: z.object({
    bug_tracker: z.string().nullable(),
    bug_tracker_project_key: z.string().nullable(),
    webhook_url: z.string().nullable(),
  }),
  team_contacts: z.array(z.string()),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// ─── Create Project Schema ───────────────────────────────────────

export const CreateProjectSchema = z.object({
  id: z
    .string()
    .min(1, "Project ID is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Project ID must be a slug (lowercase letters, numbers, hyphens)"),
  display_name: z.string().min(1, "Display name is required"),
  config: ProjectConfigSchema,
});

// ─── Update Status Schema ────────────────────────────────────────

export const StatusEnum = z.enum([
  "new",
  "active",
  "escalated",
  "fixed",
  "closed_false_positive",
  "resolved",
]);

export const UpdateStatusSchema = z.object({
  status: StatusEnum,
  note: z.string().optional(),
});

// ─── Issues Query Params Schema ──────────────────────────────────

export const SortBySchema = z
  .enum([
    "severity_desc",
    "post_count_desc",
    "last_reported_desc",
    "priority_score_desc",
  ])
  .default("last_reported_desc");

export const IssuesQuerySchema = z.object({
  status: z.string().optional(),       // comma-separated
  severity: z.string().optional(),     // comma-separated
  category: z.string().optional(),     // comma-separated
  search: z.string().optional(),
  sort_by: SortBySchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(10),
});
