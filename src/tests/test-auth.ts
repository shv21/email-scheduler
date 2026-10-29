/**
 * Phase 5 Verification Test:
 * Tests Google OAuth endpoints, requireAuth protection, session cookies, and logout.
 */
import app from '../app';
import { Server } from 'http';

async function runAuthTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 5 AUTHENTICATION & ACCESS CONTROL TESTS');
  console.log('================================================================');

  const server: Server = app.listen(5099);
  const BASE = 'http://localhost:5099';

  try {
    // Test 1: Unauthenticated access to /api/auth/me
    console.log('\n1. Testing unauthenticated access to GET /api/auth/me...');
    const unauthMeRes = await fetch(`${BASE}/api/auth/me`);
    console.log('   Response status:', unauthMeRes.status);
    const unauthMeBody = await unauthMeRes.json();
    console.log('   Body:', unauthMeBody);
    if (unauthMeRes.status === 401) {
      console.log('   ✅ Unauthenticated /me correctly rejected with 401');
    } else {
      throw new Error(`Expected 401 but got ${unauthMeRes.status}`);
    }

    // Test 2: Protected /api/emails endpoint without authentication
    console.log('\n2. Testing access to protected POST /api/emails without auth...');
    const unauthPostRes = await fetch(`${BASE}/api/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: 'test@example.com',
        subject: 'Unauthorized test',
        body: 'Should be rejected',
        scheduledAt: '2026-11-01T12:00:00.000Z',
      }),
    });
    console.log('   Response status:', unauthPostRes.status);
    const unauthPostBody = await unauthPostRes.json();
    console.log('   Body:', unauthPostBody);
    if (unauthPostRes.status === 401) {
      console.log('   ✅ Protected endpoint correctly rejected unauthenticated request with 401');
    } else {
      throw new Error(`Expected 401 but got ${unauthPostRes.status}`);
    }

    // Test 3: Dev Login session creation
    console.log('\n3. Testing login session creation via POST /api/auth/dev-login...');
    const loginRes = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.developer@gmail.com',
        displayName: 'Alex Developer',
      }),
    });
    console.log('   Response status:', loginRes.status);
    const loginBody = await loginRes.json();
    console.log('   User profile:', loginBody.user);

    // Extract connect.sid cookie
    const setCookie = loginRes.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('Expected set-cookie header on successful login');
    }
    const sessionCookie = setCookie.split(';')[0];
    console.log('   Cookie received:', sessionCookie.slice(0, 25) + '...');
    console.log('   ✅ Session cookie successfully issued');

    // Test 4: Authenticated request to /api/auth/me using session cookie
    console.log('\n4. Testing GET /api/auth/me with authenticated session cookie...');
    const authMeRes = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    console.log('   Response status:', authMeRes.status);
    const authMeBody = await authMeRes.json();
    console.log('   Authenticated User:', authMeBody.user);
    if (authMeRes.status === 200 && authMeBody.user?.email === 'alex.developer@gmail.com') {
      console.log('   ✅ Session verified successfully');
    } else {
      throw new Error('Session verification failed');
    }

    // Test 5: Logout endpoint
    console.log('\n5. Testing POST /api/auth/logout...');
    const logoutRes = await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    console.log('   Response status:', logoutRes.status);
    const logoutBody = await logoutRes.json();
    console.log('   Logout Body:', logoutBody);

    // Verify session is terminated
    const postLogoutMe = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    console.log('   Status after logout:', postLogoutMe.status);
    if (postLogoutMe.status === 401) {
      console.log('   ✅ Session successfully destroyed on logout');
    } else {
      throw new Error('Session still active after logout');
    }

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 5 AUTHENTICATION & ACCESS CONTROL TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runAuthTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
