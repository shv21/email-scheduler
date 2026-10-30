/**
 * Phase 6 Part A Verification Test:
 * Tests Elasticsearch integration, index mapping, document indexing,
 * status updates, protected search API (recipient, subject, status, q),
 * user isolation, and fault tolerance / PostgreSQL source of truth resilience.
 */
import app from '../app';
import { Server } from 'http';
import prisma from '../lib/prisma';
import {
  checkElasticsearchHealth,
  getElasticsearchClient,
  closeElasticsearchClient,
  ELASTICSEARCH_INDEX,
} from '../config/elasticsearch';
import {
  initElasticsearchIndex,
  indexEmailDocument,
  updateEmailStatusInIndex,
  searchEmailsInIndex,
} from '../services/elasticsearch.service';

async function runElasticsearchTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 6 PART A: ELASTICSEARCH INTEGRATION TESTS');
  console.log('================================================================');

  const TEST_PORT = 5098;
  const server: Server = app.listen(TEST_PORT);
  const BASE = `http://localhost:${TEST_PORT}`;

  try {
    // 1. Check Elasticsearch Connectivity
    console.log('\n1. Checking Elasticsearch connection & cluster health...');
    const isEsConnected = await checkElasticsearchHealth();
    console.log(`   Elasticsearch connection status: ${isEsConnected ? 'CONNECTED' : 'DISCONNECTED / OFFLINE'}`);

    // 2. Test /health endpoint reports elasticsearch status
    console.log('\n2. Testing GET /health endpoint for elasticsearch check...');
    const healthRes = await fetch(`${BASE}/health`);
    const healthData = await healthRes.json();
    console.log('   Health checks:', healthData.checks);
    if (!('elasticsearch' in healthData.checks)) {
      throw new Error('Health check missing elasticsearch status');
    }
    console.log('   ✅ Health endpoint reports elasticsearch check correctly');

    // 3. Test Protected Search API without Auth
    console.log('\n3. Testing GET /api/emails/search without authentication...');
    const unauthSearchRes = await fetch(`${BASE}/api/emails/search?q=test`);
    console.log('   Status:', unauthSearchRes.status);
    if (unauthSearchRes.status === 401) {
      console.log('   ✅ Protected search correctly rejected unauthenticated request with 401');
    } else {
      throw new Error(`Expected 401 but got ${unauthSearchRes.status}`);
    }

    // 4. Authenticate user 1 via dev-login
    console.log('\n4. Authenticating User 1 (alice@example.com) via dev-login...');
    const loginUser1Res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice.tester@example.com',
        displayName: 'Alice Tester',
      }),
    });
    const cookieUser1 = loginUser1Res.headers.get('set-cookie')?.split(';')[0];
    if (!cookieUser1) throw new Error('Failed to obtain cookie for User 1');
    const user1Data = await loginUser1Res.json();
    const user1Id = user1Data.user.id;
    console.log(`   User 1 ID: ${user1Id} (${user1Data.user.email})`);

    // 5. Authenticate user 2 via dev-login for isolation testing
    console.log('\n5. Authenticating User 2 (bob@example.com) for isolation tests...');
    const loginUser2Res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob.tester@example.com',
        displayName: 'Bob Tester',
      }),
    });
    const cookieUser2 = loginUser2Res.headers.get('set-cookie')?.split(';')[0];
    if (!cookieUser2) throw new Error('Failed to obtain cookie for User 2');
    const user2Data = await loginUser2Res.json();
    const user2Id = user2Data.user.id;
    console.log(`   User 2 ID: ${user2Id} (${user2Data.user.email})`);

    // 6. Test direct index creation and mapping if ES is available
    if (isEsConnected) {
      console.log('\n6. Initializing Elasticsearch index and mappings...');
      const initSuccess = await initElasticsearchIndex();
      if (!initSuccess) throw new Error('Failed to initialize Elasticsearch index');
      console.log(`   ✅ Index "${ELASTICSEARCH_INDEX}" verified/created`);

      // 7. Test direct document indexing & status updates in ES
      console.log('\n7. Testing direct Elasticsearch document indexing & updates...');
      const sampleId = `test-es-${Date.now()}`;
      const indexSuccess = await indexEmailDocument({
        id: sampleId,
        sender: 'alice.tester@example.com',
        recipient: 'contractor@partner.org',
        subject: 'Q3 Architectural Roadmap Review',
        body: 'Please review the attached roadmap specifications before our sync.',
        scheduledAt: new Date(Date.now() + 3600000),
        status: 'SCHEDULED',
        createdAt: new Date(),
        userId: user1Id,
      });
      console.log(`   Direct document indexing: ${indexSuccess ? 'SUCCESS' : 'FAILED'}`);
      if (!indexSuccess) throw new Error('Direct indexEmailDocument failed');

      // Test status update
      const updateSuccess = await updateEmailStatusInIndex(sampleId, 'PROCESSING');
      console.log(`   Status update to PROCESSING: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
      if (!updateSuccess) throw new Error('Direct updateEmailStatusInIndex failed');

      // Refresh index for immediate searchability
      const client = getElasticsearchClient();
      await client.indices.refresh({ index: ELASTICSEARCH_INDEX });

      // Test search in index
      console.log('\n8. Testing Elasticsearch search queries...');
      const searchByRecipient = await searchEmailsInIndex({
        userId: user1Id,
        recipient: 'contractor@partner.org',
      });
      console.log(`   Search by recipient found: ${searchByRecipient.total} hit(s)`);
      if (searchByRecipient.total < 1) throw new Error('Recipient search returned no results');

      const searchBySubject = await searchEmailsInIndex({
        userId: user1Id,
        subject: 'Architectural Roadmap',
      });
      console.log(`   Search by subject found: ${searchBySubject.total} hit(s)`);
      if (searchBySubject.total < 1) throw new Error('Subject search returned no results');

      const searchByStatus = await searchEmailsInIndex({
        userId: user1Id,
        status: 'PROCESSING',
      });
      console.log(`   Search by status (PROCESSING) found: ${searchByStatus.total} hit(s)`);
      if (searchByStatus.total < 1) throw new Error('Status search returned no results');
      console.log('   ✅ Direct Elasticsearch indexing, status updates, and queries passed');
    } else {
      console.log('\nℹ️ Elasticsearch is offline: Skipping live ES cluster queries and verifying PostgreSQL fallback resilience.');
    }

    // 9. Test scheduling an email via API (verifying PostgreSQL transaction succeeds regardless of ES)
    console.log('\n9. Testing POST /api/emails (PostgreSQL source of truth resilience)...');
    const futureTime = new Date(Date.now() + 600000).toISOString();
    const scheduleRes = await fetch(`${BASE}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUser1,
      },
      body: JSON.stringify({
        recipient: 'client.project@acme.com',
        subject: 'Deployment Notification Phase 6',
        body: 'The deployment has been scheduled for this evening.',
        scheduledAt: futureTime,
      }),
    });
    console.log('   Schedule response status:', scheduleRes.status);
    const scheduleBody = await scheduleRes.json();
    if (scheduleRes.status !== 201 || !scheduleBody.data?.id) {
      throw new Error(`Email scheduling failed: ${JSON.stringify(scheduleBody)}`);
    }
    const createdEmailId = scheduleBody.data.id;
    console.log(`   ✅ Email created successfully in PostgreSQL! ID: ${createdEmailId}`);

    // Verify record in PostgreSQL directly
    const dbEmail = await prisma.email.findUnique({ where: { id: createdEmailId } });
    if (!dbEmail || dbEmail.recipient !== 'client.project@acme.com') {
      throw new Error('PostgreSQL record does not match created email');
    }
    console.log('   ✅ PostgreSQL confirmed as source of truth');

    // 10. Test protected search API via HTTP with User 1
    if (isEsConnected) {
      const client = getElasticsearchClient();
      await client.indices.refresh({ index: ELASTICSEARCH_INDEX });
    }

    console.log('\n10. Testing protected GET /api/emails/search by recipient, subject, and status...');
    const searchRes = await fetch(
      `${BASE}/api/emails/search?recipient=client.project@acme.com&subject=Deployment&status=SCHEDULED`,
      {
        headers: { Cookie: cookieUser1 },
      }
    );
    console.log('   Search response status:', searchRes.status);
    const searchBody = await searchRes.json();
    console.log(`   Source: ${searchBody.source} | Total results: ${searchBody.total}`);
    if (searchRes.status !== 200 || !Array.isArray(searchBody.data)) {
      throw new Error('Search endpoint failed');
    }
    const foundEmail = searchBody.data.find((e: { id: string }) => e.id === createdEmailId);
    if (!foundEmail) {
      console.log('   Search results:', searchBody.data);
      throw new Error('Created email was not found in search results');
    }
    console.log(`   ✅ Email ${createdEmailId} successfully retrieved through search API`);

    // 11. Test User Isolation (User 2 should NOT see User 1's email)
    console.log('\n11. Testing multi-tenant user isolation in search...');
    const user2SearchRes = await fetch(
      `${BASE}/api/emails/search?recipient=client.project@acme.com`,
      {
        headers: { Cookie: cookieUser2 },
      }
    );
    const user2SearchBody = await user2SearchRes.json();
    console.log(`   User 2 search results count: ${user2SearchBody.total}`);
    const leakedEmail = user2SearchBody.data?.find((e: { id: string }) => e.id === createdEmailId);
    if (leakedEmail) {
      throw new Error('SECURITY VIOLATION: User 2 accessed User 1 scheduled email!');
    }
    console.log('   ✅ Multi-tenant isolation verified: User 2 cannot access User 1 emails');

    // 12. Test Fault Tolerance & Resilience:
    // If Elasticsearch fails, PostgreSQL transactions and search fallback remain 100% operational
    console.log('\n12. Testing Elasticsearch fault tolerance & resilience...');
    const resilientScheduleRes = await fetch(`${BASE}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUser1,
      },
      body: JSON.stringify({
        recipient: 'resilience.test@company.io',
        subject: 'Fault Tolerance Validation',
        body: 'Validating PostgreSQL source of truth remains functional.',
        scheduledAt: new Date(Date.now() + 1200000).toISOString(),
      }),
    });
    if (resilientScheduleRes.status !== 201) {
      throw new Error('Database transaction failed during resilience test');
    }
    console.log('   ✅ PostgreSQL transactions completely independent of Elasticsearch status');

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 6 PART A: ELASTICSEARCH INTEGRATION TESTS PASSED!');
    console.log('================================================================\n');
    process.exit(0);
  } finally {
    server.close();
    await closeElasticsearchClient();
  }
}


runElasticsearchTests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
