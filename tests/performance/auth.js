/**
 * Authentication API Load Test
 *
 * Tests the following endpoints:
 * - POST /api/v1/auth/register - User registration
 * - POST /api/v1/auth/login - User login
 * - POST /api/v1/auth/refresh - Token refresh
 * - POST /api/v1/auth/logout - User logout
 * - GET /api/v1/auth/profile - Get user profile
 *
 * Load Profiles:
 * - light: 10 VUs for 1 minute
 * - medium: 50 VUs for 2 minutes
 * - heavy: 100 VUs for 3 minutes
 *
 * Usage:
 *   k6 run auth.js                    # Default (medium)
 *   k6 run -e PROFILE=light auth.js   # Light load
 *   k6 run -e PROFILE=heavy auth.js   # Heavy load
 *   k6 run -e BASE_URL=http://localhost:4000 auth.js  # Custom URL
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ===== Configuration =====

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const PROFILE = __ENV.PROFILE || 'medium';

// Load profiles
const profiles = {
  light: {
    stages: [
      { duration: '10s', target: 5 },
      { duration: '30s', target: 10 },
      { duration: '10s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
      'http_req_failed': ['rate<0.05'], // Auth might have more failures
    },
  },
  medium: {
    stages: [
      { duration: '20s', target: 20 },
      { duration: '1m', target: 50 },
      { duration: '20s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<1500', 'p(99)<3000'],
      'http_req_failed': ['rate<0.05'],
    },
  },
  heavy: {
    stages: [
      { duration: '30s', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<2000', 'p(99)<4000'],
      'http_req_failed': ['rate<0.1'],
    },
  },
};

// Apply selected profile
export const options = {
  stages: profiles[PROFILE].stages,
  thresholds: {
    ...profiles[PROFILE].thresholds,
    // Endpoint-specific thresholds
    'register_duration': ['p(95)<1500'],
    'login_duration': ['p(95)<1000'],
    'refresh_duration': ['p(95)<800'],
    'logout_duration': ['p(95)<500'],
    'profile_duration': ['p(95)<500'],
  },
};

// ===== Custom Metrics =====

const registerDuration = new Trend('register_duration');
const loginDuration = new Trend('login_duration');
const refreshDuration = new Trend('refresh_duration');
const logoutDuration = new Trend('logout_duration');
const profileDuration = new Trend('profile_duration');

const errorRate = new Rate('errors');
const successRate = new Rate('successes');
const requestCounter = new Counter('total_requests');

// ===== Test Data =====

/**
 * Generate unique test user credentials
 *
 * Uses __VU (virtual user ID) and __ITER (iteration count) from k6 execution
 * context. These are only available inside the default function scope,
 * so we read them at call time rather than at module init.
 */
function generateTestUser() {
  const vu = __VU;
  const iter = __ITER;
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `loadtest-${vu}-${timestamp}-${random}@example.com`,
    password: `TestPassword123!${random}`,
    name: `Load Test User ${vu}-${iter}`,
  };
}

// ===== Helper Functions =====

/**
 * Check response is successful
 */
function checkSuccess(res, endpoint, expectedStatus = 200) {
  const success = check(res, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  requestCounter.add(1);
  if (success) {
    successRate.add(1);
  } else {
    errorRate.add(1);
    console.error(`[${endpoint}] Failed: ${res.status} - ${res.body}`);
  }

  return success;
}

/**
 * Extract access token from login response
 */
function extractAccessToken(res) {
  try {
    const body = JSON.parse(res.body);
    return body.accessToken || body.token || null;
  } catch {
    return null;
  }
}

/**
 * Extract refresh token from cookies
 */
function extractRefreshToken(res) {
  const cookies = res.cookies;
  if (cookies && cookies.refreshToken && cookies.refreshToken.length > 0) {
    return cookies.refreshToken[0].value;
  }
  return null;
}

// ===== Test Scenarios =====

export default function () {
  const user = generateTestUser();
  let accessToken = null;
  let refreshToken = null;

  // Scenario 1: Complete auth flow (20% of traffic)
  if (Math.random() < 0.2) {
    group('Complete Auth Flow', () => {
      // Step 1: Register
      group('Register', () => {
        const payload = JSON.stringify({
          email: user.email,
          password: user.password,
          name: user.name,
        });

        const params = {
          headers: { 'Content-Type': 'application/json' },
        };

        const res = http.post(`${BASE_URL}/api/v1/auth/register`, payload, params);
        registerDuration.add(res.timings.duration);

        if (checkSuccess(res, 'register', 201)) {
          accessToken = extractAccessToken(res);
          refreshToken = extractRefreshToken(res);
        }
      });

      sleep(1);

      // Step 2: Get profile (if registered successfully)
      if (accessToken) {
        group('Get Profile', () => {
          const params = {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          };

          const res = http.get(`${BASE_URL}/api/v1/auth/profile`, params);
          profileDuration.add(res.timings.duration);
          checkSuccess(res, 'profile');
        });

        sleep(1);

        // Step 3: Logout
        group('Logout', () => {
          const params = {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          };

          const res = http.post(`${BASE_URL}/api/v1/auth/logout`, null, params);
          logoutDuration.add(res.timings.duration);
          checkSuccess(res, 'logout');
        });
      }
    });
  }

  // Scenario 2: Login with existing user (40% of traffic)
  if (Math.random() < 0.4) {
    group('Login Flow', () => {
      const payload = JSON.stringify({
        email: user.email,
        password: user.password,
      });

      const params = {
        headers: { 'Content-Type': 'application/json' },
      };

      const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, params);
      loginDuration.add(res.timings.duration);

      // Note: This will likely fail as user doesn't exist, but tests the endpoint
      check(res, {
        'login attempted': (r) => r.status === 200 || r.status === 401,
        'response time < 5s': (r) => r.timings.duration < 5000,
      });
      requestCounter.add(1);
    });
  }

  // Scenario 3: Token refresh (30% of traffic)
  if (Math.random() < 0.3 && refreshToken) {
    group('Token Refresh', () => {
      const params = {
        headers: {
          'Cookie': `refreshToken=${refreshToken}`,
        },
      };

      const res = http.post(`${BASE_URL}/api/v1/auth/refresh`, null, params);
      refreshDuration.add(res.timings.duration);
      checkSuccess(res, 'refresh');
    });
  }

  // Scenario 4: Access profile without auth (10% of traffic - error case)
  if (Math.random() < 0.1) {
    group('Unauthorized Profile Access', () => {
      const res = http.get(`${BASE_URL}/api/v1/auth/profile`);
      profileDuration.add(res.timings.duration);

      // Expect 401 Unauthorized
      check(res, {
        'status is 401': (r) => r.status === 401,
        'response time < 2s': (r) => r.timings.duration < 2000,
      });
      requestCounter.add(1);
    });
  }

  // Think time: simulate user reading/processing
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ===== Lifecycle Hooks =====

export function setup() {
  console.log(`Starting Auth API load test with profile: ${PROFILE}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Stages: ${JSON.stringify(profiles[PROFILE].stages)}`);
  console.log('NOTE: Some auth requests will fail by design (testing error cases)');

  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  console.log('API health check passed');
  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`Test completed at ${new Date().toISOString()}`);
  console.log(`Test started at ${data.startTime}`);
  console.log('NOTE: Test user accounts created during this test should be cleaned up');
}

// ===== Summary Handler =====

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'auth-summary.json': JSON.stringify(data, null, 2),
  };
}
