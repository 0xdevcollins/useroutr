import {
  EnvValidationError,
  isPlaceholder,
  validateEnvironmentConfig,
} from './env-validation';

describe('isPlaceholder', () => {
  it('flags .env.example template values', () => {
    expect(isPlaceholder('your-jwt-secret-here')).toBe(true);
    expect(isPlaceholder('YOUR-CIRCLE-API-KEY')).toBe(true);
    expect(isPlaceholder('placeholder')).toBe(true);
    expect(isPlaceholder('S...')).toBe(true);
    expect(isPlaceholder('G...')).toBe(true);
    expect(isPlaceholder('C...')).toBe(true);
    expect(isPlaceholder('0x...')).toBe(true);
  });

  it('accepts real-looking values', () => {
    expect(isPlaceholder('postgresql://user:pass@localhost:5432/db')).toBe(
      false,
    );
    expect(isPlaceholder('SDGKJH3H5K2J4H5K2J4H5K2J4H5K2J4H5K2J4H5K2J4H')).toBe(
      false,
    );
    expect(isPlaceholder('0xabc123def456')).toBe(false);
    expect(isPlaceholder(undefined)).toBe(false);
    expect(isPlaceholder('')).toBe(false);
  });
});

describe('validateEnvironmentConfig', () => {
  const validBase: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://useroutr:password@localhost:5434/useroutr',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'a'.repeat(64),
  };

  it('passes with a valid development configuration', () => {
    expect(() => validateEnvironmentConfig(validBase)).not.toThrow();
  });

  it('does not require chain hot-wallet keys outside production', () => {
    expect(() => validateEnvironmentConfig(validBase)).not.toThrow();
  });

  it('requires chain hot-wallet keys in production', () => {
    const env = { ...validBase, NODE_ENV: 'production' };
    expect(() => validateEnvironmentConfig(env)).toThrow(EnvValidationError);
    try {
      validateEnvironmentConfig(env);
      fail('expected EnvValidationError');
    } catch (err) {
      const problems = (err as EnvValidationError).problems.join('\n');
      expect(problems).toContain('STELLAR_RELAY_KEYPAIR_SECRET');
      expect(problems).toContain('EVM_RELAY_PRIVATE_KEY');
    }
  });

  it('rejects missing required variables', () => {
    const env = { ...validBase };
    delete env.DATABASE_URL;
    expect(() => validateEnvironmentConfig(env)).toThrow(/DATABASE_URL/);
  });

  it('rejects placeholder values even for optional variables', () => {
    const env = {
      ...validBase,
      BANK_WEBHOOK_SECRET: 'your-bank-webhook-secret-here',
    };
    expect(() => validateEnvironmentConfig(env)).toThrow(
      /BANK_WEBHOOK_SECRET.*placeholder/,
    );
  });

  it('rejects placeholder chain keys in any environment', () => {
    const env = { ...validBase, STELLAR_RELAY_KEYPAIR_SECRET: 'S...' };
    expect(() => validateEnvironmentConfig(env)).toThrow(
      /STELLAR_RELAY_KEYPAIR_SECRET.*placeholder/,
    );
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    const env = { ...validBase, JWT_SECRET: 'short-secret' };
    expect(() => validateEnvironmentConfig(env)).toThrow(
      /JWT_SECRET.*at least 32/,
    );
  });

  it('reports every problem at once', () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'development' };
    try {
      validateEnvironmentConfig(env);
      fail('expected EnvValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      expect(
        (err as EnvValidationError).problems.length,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
