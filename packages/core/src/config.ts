import "dotenv/config";
import { z } from "zod";

// Blank ".env" placeholders (e.g. "SENDGRID_API_KEY=") parse to "" rather than
// being absent, which would otherwise fail .email()/.url() checks on an
// intentionally-unset optional value. Normalize "" -> undefined first.
const optionalString = () =>
  z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
const optionalEmail = () =>
  z.preprocess((v) => (v === "" ? undefined : v), z.string().email().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  OVERPASS_API_URL: z.string().url().default("https://overpass-api.de/api/interpreter"),
  DRY_RUN_OUTREACH: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() !== "false"),
  DASHBOARD_BASE_URL: z.string().url().default("http://localhost:3000"),

  ANTHROPIC_API_KEY: optionalString(),

  VERCEL_API_TOKEN: optionalString(),
  VERCEL_TEAM_ID: optionalString(),
  VERCEL_PROJECT_ID: optionalString(),

  SENDGRID_API_KEY: optionalString(),
  SENDGRID_FROM_EMAIL: optionalEmail(),
  OUTREACH_PHYSICAL_ADDRESS: optionalString(),
});

export type Config = z.infer<typeof envSchema>;

let cached: Config | undefined;

export function loadConfig(): Config {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Stage modules call this for provider keys that are only required starting
 * at a later build phase (e.g. ANTHROPIC_API_KEY from Phase 4 onward).
 * Fails fast with a clear message instead of a confusing downstream error.
 */
export function requireConfigValue<K extends keyof Config>(key: K): NonNullable<Config[K]> {
  const config = loadConfig();
  const value = config[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing required config value "${String(key)}". Set it in your .env file (see .env.example).`
    );
  }
  return value as NonNullable<Config[K]>;
}
