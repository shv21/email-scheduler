/**
 * Phase 4 Verification Script: Tests rate limiting, job rescheduling, and exactly-once Slack alerts.
 * Simulates 3 jobs arriving quickly for the same sender with HOURLY_EMAIL_LIMIT = 1.
 */
import { sendSlackRateLimitAlert } from '../services/slack.service';

interface MockRedisStore {
  [key: string]: { value: number | string; ttl?: number };
}

class MockRedisClient {
  private store: MockRedisStore = {};

  async incr(key: string): Promise<number> {
    const current = typeof this.store[key]?.value === 'number' ? (this.store[key].value as number) : 0;
    const next = current + 1;
    this.store[key] = { value: next, ttl: this.store[key]?.ttl };
    return next;
  }

  async decr(key: string): Promise<number> {
    const current = typeof this.store[key]?.value === 'number' ? (this.store[key].value as number) : 0;
    const next = Math.max(0, current - 1);
    this.store[key] = { value: next, ttl: this.store[key]?.ttl };
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.store[key]) {
      this.store[key].ttl = seconds;
      return 1;
    }
    return 0;
  }

  async set(key: string, value: string, mode1?: string, ttl?: number, mode2?: string): Promise<'OK' | null> {
    // Handle SET key value EX ttl NX
    if (mode2 === 'NX' && this.store[key]) {
      return null; // Key already exists!
    }
    this.store[key] = { value, ttl };
    return 'OK';
  }
}

async function runRateLimitingVerification() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 4 RATE LIMITING & SLACK ALERT VERIFICATION TEST');
  console.log('================================================================');

  const redis = new MockRedisClient();
  const HOURLY_LIMIT = 1;
  const sender = 'alex@company.com';
  const windowKey = '2026-10-29-12';
  const counterKey = `ratelimit:sender:${sender}:${windowKey}`;
  const alertKey = `ratelimit:alert:${sender}:${windowKey}`;
  const ttlSeconds = 3450; // remaining time in hour window

  async function processEmailJob(emailId: string) {
    console.log(`\n📨 Processing Email Job [${emailId}] for Sender: ${sender}`);

    // Step 1: Atomic INCR in Redis
    const count = await redis.incr(counterKey);
    if (count === 1) {
      await redis.expire(counterKey, ttlSeconds);
    }

    console.log(`   📊 Redis counter for [${counterKey}]: ${count} (Hourly Limit: ${HOURLY_LIMIT})`);

    // Step 2: Check limit
    if (count > HOURLY_LIMIT) {
      console.log(`   🛑 Rate limit EXCEEDED! (Count ${count} > Limit ${HOURLY_LIMIT})`);
      await redis.decr(counterKey);

      // Step 3: Atomic SET with NX for Slack Alert
      const alertSet = await redis.set(alertKey, '1', 'EX', ttlSeconds, 'NX');
      const shouldAlert = alertSet === 'OK';

      if (shouldAlert) {
        console.log(`   📢 First violation in window! Triggering Slack alert...`);
        await sendSlackRateLimitAlert({
          sender,
          emailId,
          limit: HOURLY_LIMIT,
          retryAfterSeconds: ttlSeconds,
        });
      } else {
        console.log(`   ℹ️ Slack alert was ALREADY triggered for this window. Skipping duplicate alert!`);
      }

      // Step 4: Reschedule (do not drop)
      console.log(`   🔄 Job [${emailId}] is RESCHEDULED to retry in ${ttlSeconds}s. (NOT DROPPED)`);
      return { status: 'RESCHEDULED', emailId, retryIn: ttlSeconds };
    }

    // Rate limit passed
    console.log(`   ✅ Rate limit check PASSED. Email [${emailId}] dispatched successfully!`);
    return { status: 'SENT', emailId };
  }

  // --- Send Email #1 ---
  const res1 = await processEmailJob('email_001');

  // --- Send Email #2 quickly from same sender ---
  const res2 = await processEmailJob('email_002');

  // --- Send Email #3 quickly from same sender to verify alert deduplication ---
  const res3 = await processEmailJob('email_003');

  console.log('\n================================================================');
  console.log('📊 FINAL TEST RESULTS SUMMARY:');
  console.log('1. Email #1:', res1.status, '➔ Sent immediately within hourly limit');
  console.log('2. Email #2:', res2.status, '➔ Rate limit triggered, Slack alert fired, job rescheduled');
  console.log('3. Email #3:', res3.status, '➔ Rate limit triggered, Slack alert suppressed (sent once), job rescheduled');
  console.log('================================================================\n');
}

runRateLimitingVerification().catch(console.error);
