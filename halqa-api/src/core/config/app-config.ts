import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  PROVIDER_BASE_URL: z.string().default(''),
  PROVIDER_API_KEY: z.string().default(''),
  COMPACT_MODEL: z.string().default(''),
  LARGER_MODEL: z.string().default(''),
  QUOTA_C: z.coerce.number().int().min(1).default(20),
  QUOTA_L: z.coerce.number().int().min(0).default(5),
  /**
   * Per-circle daily model-call ceiling (§9.3). The per-session quota bounds one
   * conversation; this bounds a class, because a single circle can open many
   * sessions in a day and the per-session cap then multiplies instead of limiting.
   * Ten squads of four against the session caps is already ~200 calls a day, so
   * the default sits above normal classroom use and below a runaway loop.
   */
  CIRCLE_DAILY_CALLS: z.coerce.number().int().min(1).default(400),
  WINDOW_S: z.coerce.number().int().min(30).max(90).default(45),
  CHAOS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  TOKEN_SECRET: z.string().min(1, 'TOKEN_SECRET is required'),
  /** The previous secret, accepted during a rotation window so rotating does not
   *  sign every learner out at once (§3.9). Drop it one release later. */
  TOKEN_SECRET_PREVIOUS: z.string().default(''),
  CORS_ORIGINS: z.string().default(''),
});

export type AppConfig = z.infer<typeof EnvSchema> & {
  corsOrigins: string[];
  isProd: boolean;
  chaosEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${details}`);
  }
  const v = parsed.data;
  return {
    ...v,
    corsOrigins: v.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    isProd: v.NODE_ENV === 'production',
    chaosEnabled: v.CHAOS_ENABLED === true,
  };
}

export const configFactory = () => loadConfig();
