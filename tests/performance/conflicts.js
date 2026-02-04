/**
 * Conflicts API Load Test
 *
 * Tests the following endpoints:
 * - GET /api/conflicts - List conflicts with filtering
 * - GET /api/conflicts/:id - Single conflict details
 *
 * NOTE: These endpoints currently return empty data (TODO in implementation).
 *       This script establishes baseline performance for when the feature is implemented.
 *
 * Load Profiles:
 * - light: 10 VUs for 1 minute
 * - medium: 50 VUs for 2 minutes
 * - heavy: 100 VUs for 3 minutes
 *
 * Usage:
 *   k6 run conflicts.js                    # Default (medium)
 *   k6 run -e PROFILE=light conflicts.js   # Light load
 *   k6 run -e PROFILE=heavy conflicts.js   # Heavy load
 *   k6 run -e BASE_URL=http://localhost:4000 conflicts.js  # Custom URL
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
      'http_req_duration': ['p(95)<500', 'p(99)<1000'],
      'http_req_failed': ['rate<0.01'],
    },
  },
  medium: {
    stages: [
      { duration: '20s', target: 20 },
      { duration: '1m', target: 50 },
      { duration: '20s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<800', 'p(99)<1500'],
      'http_req_failed': ['rate<0.01'],
    },
  },
  heavy: {
    stages: [
      { duration: '30s', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
      'http_req_failed': ['rate<0.02'],
    },
  },
};

// Apply selected profile
export const options = {
  stages: profiles[PROFILE].stages,
  thresholds: {
    ...profiles[PROFILE].thresholds,
    // Endpoint-specific thresholds
    'list_conflicts_duration': ['p(95)<500'],
    'get_conflict_duration': ['p(95)<300'],
  },
};

// ===== Custom Metrics =====

const listConflictsDuration = new Trend('list_conflicts_duration');
const getConflictDuration = new Trend('get_conflict_duration');

const errorRate = new Rate('errors');
const successRate = new Rate('successes');
const requestCounter = new Counter('total_requests');

// ===== Test Data =====

// Sample conflict IDs (placeholder for future implementation)
const SAMPLE_CONFLICT_IDS = [
  'conflict-001',
  'conflict-002',
  'conflict-003',
  'conflict-004',
  'conflict-005',
];

// Filter combinations for list endpoint
const FILTER_SETS = [
  {},
  { limit: 20, offset: 0 },
  { limit: 50, offset: 0 },
  { limit: 100, offset: 0 },
];

// ===== Helper Functions =====

/**
 * Get a random conflict ID from sample data
 */
function getRandomConflictId() {
  return SAMPLE_CONFLICT_IDS[Math.floor(Math.random() * SAMPLE_CONFLICT_IDS.length)];
}

/**
 * Get a random filter set
 */
function getRandomFilters() {
  return FILTER_SETS[Math.floor(Math.random() * FILTER_SETS.length)];
}

/**
 * Build query string from filters
 */
function buildQueryString(filters) {
  const params = new URLSearchParams(filters);
  return params.toString() ? `?${params.toString()}` : '';
}

/**
 * Check response is successful
 * Note: Currently expects 200 with empty data array
 */
function checkSuccess(res, endpoint) {
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 2s': (r) => r.timings.duration < 2000,
    'response is JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
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
 * Check 404 response for get conflict endpoint
 */
function check404(res, endpoint) {
  const success = check(res, {
    'status is 404': (r) => r.status === 404,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  requestCounter.add(1);
  if (success) {
    successRate.add(1);
  } else {
    errorRate.add(1);
    console.error(`[${endpoint}] Unexpected response: ${res.status}`);
  }

  return success;
}

// ===== Test Scenarios =====

export default function () {
  // Scenario 1: List conflicts (70% of traffic)
  if (Math.random() < 0.7) {
    group('List Conflicts', () => {
      const filters = getRandomFilters();
      const queryString = buildQueryString(filters);
      const url = `${BASE_URL}/api/conflicts${queryString}`;

      const res = http.get(url);
      listConflictsDuration.add(res.timings.duration);
      checkSuccess(res, 'list_conflicts');
    });
  }

  // Scenario 2: Get single conflict (30% of traffic)
  // Note: Currently returns 404 as feature is not implemented
  if (Math.random() < 0.3) {
    group('Get Conflict Details', () => {
      const conflictId = getRandomConflictId();
      const url = `${BASE_URL}/api/conflicts/${conflictId}`;

      const res = http.get(url);
      getConflictDuration.add(res.timings.duration);

      // Currently expect 404 as feature not implemented
      check404(res, 'get_conflict');
    });
  }

  // Think time: simulate user reading/processing
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ===== Lifecycle Hooks =====

export function setup() {
  console.log(`Starting Conflicts API load test with profile: ${PROFILE}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Stages: ${JSON.stringify(profiles[PROFILE].stages)}`);
  console.log('NOTE: Conflicts endpoints currently return empty data (feature not implemented)');

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
}

// ===== Summary Handler =====

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'conflicts-summary.json': JSON.stringify(data, null, 2),
  };
}
