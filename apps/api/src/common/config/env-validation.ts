/**
 * Environment validation utilities
 * Ensures critical secrets are properly configured at startup
 */

/**
 * List of placeholder patterns that indicate a secret has not been properly configured
 */
const PLACEHOLDER_PATTERNS = [
  // Generic placeholders
  /^your-/i,
  /^placeholder/i,
  /^[sS]\.\.\.$/,
  /^[gG]\.\.\.$/,
  /^0x\.\.\.$/,
  /^[cC]\.\.\.$/,
  // Specific template values
  /^your-jwt-secret/i,
  /^your-api-key-salt/i,
  /^your-256-bit-secret/i,
  /^your-bank-session-encryption/i,
  /^your-bank-webhook-secret/i,
  /^your-circle-api-key/i,
  /^your-layerswap/i,
  /^your-cloud-name/i,
  /^your-cloudinary-api/i,
];

/**
 * Critical environment variables required for API operation
 * Organized by feature/component
 */
export const CRITICAL_ENV_VARS = {
  // Core infrastructure
  DATABASE_URL: {
    required: true,
    description: 'PostgreSQL connection string',
  },
  REDIS_URL: {
    required: true,
    description: 'Redis connection string for caching and queues',
  },
  // Authentication
  JWT_SECRET: {
    required: true,
    description: 'JWT signing secret (64 bytes base64)',
  },
  API_KEY_SALT: {
    required: true,
    description: 'Salt for API key hashing',
  },
  BANK_SESSION_ENCRYPTION_KEY: {
    required: false,
    description: 'AES-256 key for bank session encryption',
  },
  BANK_WEBHOOK_SECRET: {
    required: false,
    description: 'Secret for bank webhook verification',
  },
  // Stellar
  STELLAR_RELAY_KEYPAIR_SECRET: {
    required: true,
    description: 'Stellar relay keypair secret (starts with S)',
  },
  // EVM
  EVM_RELAY_PRIVATE_KEY: {
    required: true,
    description: 'EVM relay private key (0x-prefixed hex)',
  },
};

/**
 * Check if a value matches any placeholder pattern
 */
export function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Validate all critical environment variables at startup
 * Throws an error if any critical variable is missing or set to a placeholder
 */
export function validateEnvironmentConfig(): void {
  const errors: string[] = [];

  // Check each critical variable
  for (const [varName, config] of Object.entries(CRITICAL_ENV_VARS)) {
    const value = process.env[varName];

    // Check if required variable is missing
    if (config.required && !value) {
      errors.push(
        `STARTUP FAILED: ${varName} is missing. Set a valid value. (${config.description})`,
      );
      continue;
    }

    // Check if value is a placeholder
    if (value && isPlaceholder(value)) {
      errors.push(
        `STARTUP FAILED: ${varName} is a placeholder or missing. Set a valid value. (${config.description})`,
      );
    }
  }

  // Additional validations for specific variables
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push(
      `STARTUP FAILED: JWT_SECRET must be at least 32 characters (256 bits recommended)`,
    );
  }

  const apiKeySalt = process.env.API_KEY_SALT;
  if (apiKeySalt && apiKeySalt.length < 16) {
    errors.push(
      `STARTUP FAILED: API_KEY_SALT must be at least 16 characters`,
    );
  }

  // If there are errors, throw and halt startup
  if (errors.length > 0) {
    console.error('\n❌ Environment Configuration Errors:\n');
    errors.forEach((error) => console.error(error));
    console.error('\n📋 To generate secrets, run: ./scripts/generate-secrets.sh\n');
    process.exit(1);
  }

  console.log('✅ Environment configuration validated successfully');
}
