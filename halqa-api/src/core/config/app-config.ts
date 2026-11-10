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
  WINDOW_S: z.coerce.number().int().min(30).max(90).default(45),
  CHAOS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  TOKEN_SECRET: z.string().min(1, 'TOKEN_SECRET is required'),
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
