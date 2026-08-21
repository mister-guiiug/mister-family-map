import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  it('autorise jusqu’à la limite puis bloque', () => {
    const now = 0;
    const limiter = createRateLimiter(2, 1000, () => now);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('libère après expiration de la fenêtre', () => {
    let now = 0;
    const limiter = createRateLimiter(1, 1000, () => now);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
    now = 1001;
    expect(limiter.tryAcquire()).toBe(true);
  });

  it('annonce le délai de réessai', () => {
    let now = 0;
    const limiter = createRateLimiter(1, 1000, () => now);
    limiter.tryAcquire();
    now = 400;
    expect(limiter.retryInMs()).toBe(600);
  });
});
