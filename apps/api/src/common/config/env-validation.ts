/**
 * Startup environment validation.
 *
 * Verifies that critical secrets are present and not left at the
 * `.env.example` placeholder values before the application boots.
 * Variables the app can run without in development (chain hot-wallet
 * keys) are only enforced in production, so a fresh checkout can start
 * the API without provisioning real wallets.
 */

/** Values copied verbatim from `.env.example` that must never be used. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^your-/i,
  /^placeholder/i,
  /^[sgc]\.\.\.$/i, // Stellar secret/public keys, Soroban contract ids
  /^0x\.\.\.$/,
];

/** When a variable must be set for the API to start. */
type Requirement = 'always' | 'production' | 'optional';

export interface CriticalEnvVar {
  requiredIn: Requirement;
  description: string;
}

export const CRITICAL_ENV_VARS: Record<string, CriticalEnvVar> = {
  // Core infrastructure — nothing works without these.
  DATABASE_URL: {
    requiredIn: 'always',
    description: 'PostgreSQL connection string',
  },
  REDIS_URL: {
    requiredIn: 'always',
    description: 'Redis connection string for caching and queues',
  },
  // Authentication.
  JWT_SECRET: {
    requiredIn: 'always',
    description:
      'JWT signing secret (generate via scripts/generate-secrets.sh)',
  },
  // Bank rails — feature-gated, but a placeholder is always an error.
  BANK_SESSION_ENCRYPTION_KEY: {
    requiredIn: 'optional',
    description: 'AES-256 key for bank session encryption',
  },
  BANK_WEBHOOK_SECRET: {
    requiredIn: 'optional',
    description: 'Secret for bank webhook verification',
  },
  // Chain hot wallets — only signing operations need these, so local
  // development can run without them. Production cannot.
  STELLAR_RELAY_KEYPAIR_SECRET: {
    requiredIn: 'production',
    description: 'Stellar relay keypair secret (starts with S)',
  },
  EVM_RELAY_PRIVATE_KEY: {
    requiredIn: 'production',
    description: 'EVM relay private key (0x-prefixed hex)',
  },
};

/** Minimum lengths for secrets where a short value defeats the purpose. */
const MIN_LENGTHS: Record<string, number> = {
  JWT_SECRET: 32,
};

export class EnvValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      [
        'Environment configuration is invalid:',
        ...problems.map((p) => `  - ${p}`),
        'Generate secrets with: ./scripts/generate-secrets.sh',
        'See the "Pre-Beta Environment Setup Guide" in README.md for details.',
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

/** True when a value is still one of the `.env.example` placeholders. */
export function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Validate critical environment variables. Throws {@link EnvValidationError}
 * listing every problem found — it never exits the process itself, so it
 * stays unit-testable and callers decide how to fail.
 */
export function validateEnvironmentConfig(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const problems: string[] = [];
  const isProduction = env.NODE_ENV === 'production';

  for (const [name, spec] of Object.entries(CRITICAL_ENV_VARS)) {
    const value = env[name];
    const required =
      spec.requiredIn === 'always' ||
      (spec.requiredIn === 'production' && isProduction);

    if (!value) {
      if (required) {
        problems.push(`${name} is not set. ${spec.description}.`);
      }
      continue;
    }

    if (isPlaceholder(value)) {
      problems.push(
        `${name} is still set to a placeholder value. ${spec.description}.`,
      );
      continue;
    }

    const minLength = MIN_LENGTHS[name];
    if (minLength && value.length < minLength) {
      problems.push(`${name} must be at least ${minLength} characters long.`);
    }
  }

  if (problems.length > 0) {
    throw new EnvValidationError(problems);
  }
}
