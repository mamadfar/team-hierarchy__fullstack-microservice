import { z } from 'zod';

/** Hue on the oklch wheel, 0–360. Rendered as oklch(55% 0.17 h) solid / oklch(60% 0.14 h / a) tint. */
export const HueSchema = z.number().int().min(0).max(360);

/** Unique ticket-queue key across ALL companies, e.g. "PAY-CHK". */
export const QueueKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]*-[A-Z0-9]+$/, 'queue key must look like "PAY-CHK"');

export const LocaleSchema = z.enum(['en', 'hu', 'fr', 'nl']);
export type Locale = z.infer<typeof LocaleSchema>;

export const GroupSchema = z.object({
  name: z.string().min(1),
  icon: z.string().min(1),
  hue: HueSchema,
});
export type Group = z.infer<typeof GroupSchema>;

export const CompanySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  hue: HueSchema,
  description: z.string().default(''),
  confluencePageId: z.string().min(1),
  position: z.number().int().nonnegative(),
  teamCount: z.number().int().nonnegative(),
});
export type Company = z.infer<typeof CompanySchema>;

export const DomainSchema = z.object({
  slug: z.string().min(1),
  companySlug: z.string().min(1),
  name: z.string().min(1),
  hue: HueSchema,
  description: z.string().default(''),
  position: z.number().int().nonnegative(),
});
export type Domain = z.infer<typeof DomainSchema>;

export const TribeSchema = z.object({
  slug: z.string().min(1),
  domainSlug: z.string().min(1),
  name: z.string().min(1),
  position: z.number().int().nonnegative(),
});
export type Tribe = z.infer<typeof TribeSchema>;

export const TeamSchema = z.object({
  queueKey: QueueKeySchema,
  name: z.string().min(1),
  tribeSlug: z.string().min(1),
  description: z.string().default(''),
  icon: z.string().min(1),
  /** null = fall back to the domain hue. */
  hue: HueSchema.nullable(),
  apps: z.array(z.string()),
  keywords: z.array(z.string()),
  channel: z.string().nullable(),
  lead: z.string().nullable(),
  oncall: z.string().nullable(),
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamLinkSchema = z.object({
  source: QueueKeySchema,
  target: QueueKeySchema,
  reason: z.string(),
});
export type TeamLink = z.infer<typeof TeamLinkSchema>;

/** Full assembled registry served by GET /registry (Redis-cached). */
export const RegistrySnapshotSchema = z.object({
  group: GroupSchema,
  companies: z.array(CompanySchema),
  domains: z.array(DomainSchema),
  tribes: z.array(TribeSchema),
  teams: z.array(TeamSchema),
  links: z.array(TeamLinkSchema),
  /** ISO timestamp of the last successful sync, null before the first one. */
  lastSync: z.string().nullable(),
});
export type RegistrySnapshot = z.infer<typeof RegistrySnapshotSchema>;

export const SyncRunStatusSchema = z.enum(['running', 'success', 'failed']);
export const SyncRunSchema = z.object({
  id: z.number().int(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: SyncRunStatusSchema,
  stats: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
});
export type SyncRun = z.infer<typeof SyncRunSchema>;

// ---- assistant-service ----

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(20),
  lang: LocaleSchema.default('en'),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatTeamRefSchema = z.object({
  queueKey: QueueKeySchema,
  name: z.string(),
  confidence: z.number().min(0).max(1),
});
export type ChatTeamRef = z.infer<typeof ChatTeamRefSchema>;

/** answer is PLAIN TEXT (no markdown) — rendered verbatim in chat bubbles. */
export const ChatResponseSchema = z.object({
  answer: z.string(),
  teams: z.array(ChatTeamRefSchema).max(3),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ---- seed fixture shape (infra/db/seed/registry.json) ----

export const SeedCompanySchema = CompanySchema.omit({ teamCount: true }).extend({
  domains: z.array(DomainSchema.omit({ companySlug: true })),
  tribes: z.array(TribeSchema),
  teams: z.array(TeamSchema),
});
export const SeedFileSchema = z.object({
  group: GroupSchema,
  companies: z.array(SeedCompanySchema),
  links: z.array(TeamLinkSchema),
});
export type SeedFile = z.infer<typeof SeedFileSchema>;
