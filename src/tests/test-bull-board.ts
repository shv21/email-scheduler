/**
 * Phase 6 Part B Verification Test:
 * Tests BullMQ Dashboard (@bull-board/express & @bull-board/api) integration:
 * 1. Protection of /admin/queues via session authentication.
 * 2. Unauthenticated requests rejected with 401 (both JSON and HTML).
 * 3. Authenticated requests can access the dashboard UI.
 * 4. Verification that Bull Board connects directly to the existing email-delivery-queue.
 * 5. Verification that real queue data (waiting, active, delayed, completed, failed) is displayed.
 * 6. Live job tracking: scheduling a delayed email immediately reflects in delayed jobs.
 */
import app from '../app';
import { Server } from 'http';
import prisma from '../lib/prisma';
import { emailQueue, EMAIL_QUEUE_NAME } from '../queues/email.queue';
import { closeElasticsearchClient } from '../config/elasticsearch';

async function runBullBoardTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 6 PART B: BULLMQ DASHBOARD TESTS');
  console.log('================================================================');

  const TEST_PORT = 5097;
  const server: Server = app.listen(TEST_PORT);
  const BASE = `http://localhost:${TEST_PORT}`;

  try {
    // 1. Test unauthenticated request to /admin/queues (JSON client)
    console.log('\n1. Testing unauthenticated access to GET /admin/queues (Accept: application/json)...');
    const unauthJsonRes = await fetch(`${BASE}/admin/queues`, {
      headers: { Accept: 'application/json' },
    });
    console.log('   Response status:', unauthJsonRes.status);
    if (unauthJsonRes.status === 401) {
      const body = await unauthJsonRes.json();
      console.log('   Body:', body);
      console.log('   ✅ JSON request correctly rejected with 401 Unauthorized');
    } else {
      throw new Error(`Expected 401 but got ${unauthJsonRes.status}`);
    }

    // 2. Test unauthenticated request to /admin/queues (Browser client)
    console.log('\n2. Testing unauthenticated access to GET /admin/queues (Accept: text/html)...');
    const unauthHtmlRes = await fetch(`${BASE}/admin/queues`, {
      headers: { Accept: 'text/html' },
    });
    console.log('   Response status:', unauthHtmlRes.status);
    const htmlText = await unauthHtmlRes.text();
    if (unauthHtmlRes.status === 401 && htmlText.includes('401 Unauthorized')) {
      console.log('   ✅ Browser request correctly received 401 Unauthorized HTML page');
    } else {
      throw new Error(`Expected 401 HTML page but got status ${unauthHtmlRes.status}`);
    }

    // 3. Test unauthenticated request to internal Bull Board API
    console.log('\n3. Testing unauthenticated access to GET /admin/queues/api/queues...');
    const unauthApiRes = await fetch(`${BASE}/admin/queues/api/queues`, {
      headers: { Accept: 'application/json' },
    });
    console.log('   Response status:', unauthApiRes.status);
    if (unauthApiRes.status === 401) {
      console.log('   ✅ Internal Bull Board API protected from unauthenticated access');
    } else {
      throw new Error(`Expected 401 but got ${unauthApiRes.status}`);
    }

    // 4. Authenticate via dev-login to obtain session cookie
    console.log('\n4. Authenticating admin user via dev-login...');
    const loginRes = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.operator@example.com',
        displayName: 'Admin Operator',
      }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    if (!setCookie) throw new Error('Failed to obtain session cookie');
    const cookie = setCookie.split(';')[0];
    console.log('   Session cookie acquired:', cookie.slice(0, 30) + '...');

    // 5. Authenticated access to dashboard UI
    console.log('\n5. Accessing GET /admin/queues with authenticated session cookie...');
    const authDashboardRes = await fetch(`${BASE}/admin/queues/`, {
      headers: {
        Cookie: cookie,
        Accept: 'text/html',
      },
    });
    console.log('   Response status:', authDashboardRes.status);
    const dashboardHtml = await authDashboardRes.text();
    if (authDashboardRes.status === 200 && (dashboardHtml.includes('BullBoard') || dashboardHtml.includes('bull-board') || dashboardHtml.includes('<div id="root">'))) {
      console.log('   ✅ Dashboard HTML served successfully to authenticated user');
    } else {
      throw new Error(`Dashboard request failed or returned invalid HTML (status: ${authDashboardRes.status})`);
    }

    // 6. Verify Bull Board connected to existing email-delivery-queue
    console.log('\n6. Fetching queue metadata from Bull Board internal API (/admin/queues/api/queues)...');
    const queuesApiRes = await fetch(`${BASE}/admin/queues/api/queues`, {
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
      },
    });
    console.log('   Bull Board API response status:', queuesApiRes.status);
    if (queuesApiRes.status !== 200) {
      throw new Error(`Bull Board API returned status ${queuesApiRes.status}`);
    }

    const queuesData = await queuesApiRes.json();
    console.log(`   Queues registered in Bull Board: ${queuesData.queues?.map((q: { name: string }) => q.name).join(', ')}`);

    const targetQueue = queuesData.queues?.find((q: { name: string }) => q.name === EMAIL_QUEUE_NAME);
    if (!targetQueue) {
      throw new Error(`Expected queue "${EMAIL_QUEUE_NAME}" not found in Bull Board registered queues`);
    }

    console.log('   Target queue stats reported by dashboard:');
    console.log(`     - Waiting: ${targetQueue.counts.waiting}`);
    console.log(`     - Active: ${targetQueue.counts.active}`);
    console.log(`     - Delayed: ${targetQueue.counts.delayed}`);
    console.log(`     - Completed: ${targetQueue.counts.completed}`);
    console.log(`     - Failed: ${targetQueue.counts.failed}`);
    console.log('   ✅ Bull Board successfully connected to existing queue and exposes real counters');

    const initialDelayedCount = targetQueue.counts.delayed;

    // 7. Schedule a new email and verify real-time Bull Board reflection
    console.log('\n7. Scheduling a new delayed email to test real-time dashboard data...');
    const scheduleRes = await fetch(`${BASE}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        recipient: 'dashboard.verify@company.io',
        subject: 'Bull Board Real-Time Sync Verification',
        body: 'Verifying that BullMQ dashboard reflects this delayed job.',
        scheduledAt: new Date(Date.now() + 1800000).toISOString(), // 30 minutes in future
      }),
    });
    console.log('   Schedule email status:', scheduleRes.status);
    const scheduleData = await scheduleRes.json();
    if (scheduleRes.status !== 201 || !scheduleData.data?.job?.id) {
      throw new Error('Failed to schedule email for dashboard test');
    }
    const enqueuedJobId = scheduleData.data.job.id;
    console.log(`   ✅ Enqueued BullMQ job ID: ${enqueuedJobId}`);

    // Query Bull Board API again
    const updatedQueuesRes = await fetch(`${BASE}/admin/queues/api/queues`, {
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
      },
    });
    const updatedQueuesData = await updatedQueuesRes.json();
    const updatedQueue = updatedQueuesData.queues?.find((q: { name: string }) => q.name === EMAIL_QUEUE_NAME);
    console.log(`   Updated delayed jobs count: ${updatedQueue.counts.delayed} (was ${initialDelayedCount})`);

    if (updatedQueue.counts.delayed < initialDelayedCount + 1) {
      throw new Error(`Expected delayed count to increment, but got ${updatedQueue.counts.delayed}`);
    }
    console.log('   ✅ Real-time synchronization confirmed: Bull Board reflected new delayed job!');

    // 8. Verify delayed job details directly on the underlying emailQueue instance
    console.log('\n8. Verifying underlying BullMQ queue job data...');
    const queueJob = await emailQueue.getJob(enqueuedJobId);
    if (!queueJob) {
      throw new Error(`Job ${enqueuedJobId} not found in BullMQ emailQueue!`);
    }
    console.log(`   Found job in BullMQ: ID=${queueJob.id}, state=${await queueJob.getState()}, recipient=${queueJob.data.recipient}`);
    if (queueJob.data.recipient !== 'dashboard.verify@company.io') {
      throw new Error('Job recipient does not match scheduled payload');
    }
    console.log('   ✅ Exact job payload confirmed in BullMQ queue');



    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 6 PART B: BULLMQ DASHBOARD TESTS PASSED!');
    console.log('================================================================\n');
    process.exit(0);
  } finally {
    server.close();
    await closeElasticsearchClient();
  }
}

runBullBoardTests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
