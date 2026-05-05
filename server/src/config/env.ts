import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32).optional(),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  SERVER_URL: z.string().url().default('http://localhost:8080'),

  STRIPE_SECRET_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  MAILGUN_PRIVATE_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILCHIMP_API_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
