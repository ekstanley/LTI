/**
 * Legislators API Load Test
 *
 * Tests the following endpoints:
 * - GET /api/v1/legislators - List legislators with filtering
 * - GET /api/v1/legislators/:id - Single legislator details
 * - GET /api/v1/legislators/:id/committees - Legislator committees
 *
 * Load Profiles:
 * - light: 10 VUs for 1 minute
 * - medium: 50 VUs for 2 minutes
 * - heavy: 100 VUs for 3 minutes
 *
 * Usage:
 *   k6 run legislators.js                    # Default (medium)
 *   k6 run -e PROFILE=light legislators.js   # Light load
 *   k6 run -e PROFILE=heavy legislators.js   # Heavy load
 *   k6 run -e BASE_URL=http://localhost:4000 legislators.js  # Custom URL
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
    'list_legislators_duration': ['p(95)<600'],
    'get_legislator_duration': ['p(95)<300'],
    'get_committees_duration': ['p(95)<400'],
  },
};

// ===== Custom Metrics =====

const listLegislatorsDuration = new Trend('list_legislators_duration');
const getLegislatorDuration = new Trend('get_legislator_duration');
const getCommitteesDuration = new Trend('get_committees_duration');

const errorRate = new Rate('errors');
const successRate = new Rate('successes');
const requestCounter = new Counter('total_requests');

// ===== Test Data =====

// Sample legislator IDs (bioguide format: 1 uppercase letter + 6 digits)
const SAMPLE_LEGISLATOR_IDS = [
  'A000001',
  'B000002',
  'C000003',
  'D000004',
  'E000005',
  'F000006',
  'G000007',
  'H000008',
];

// Filter combinations for list endpoint
const FILTER_SETS = [
  {},
  { chamber: 'house' },
  { chamber: 'senate' },
  { party: 'D' },
  { party: 'R' },
  { state: 'CA' },
  { state: 'TX' },
  { state: 'NY' },
  { inOffice: true },
  { search: 'smith' },
  { limit: 20, offset: 0 },
  { limit: 50, offset: 50 },
  { chamber: 'house', party: 'D' },
  { chamber: 'senate', party: 'R' },
];

// ===== Helper Functions =====

/**
 * Get a random legislator ID from sample data
 */
function getRandomLegislatorId() {
  return SAMPLE_LEGISLATOR_IDS[Math.floor(Math.random() * SAMPLE_LEGISLATOR_IDS.length)];
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
 */
function checkSuccess(res, endpoint) {
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 2s': (r) => r.timings.duration < 2000,
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

// ===== Test Scenarios =====

export default function () {
  // Scenario 1: List legislators (60% of traffic)
  if (Math.random() < 0.6) {
    group('List Legislators', () => {
      const filters = getRandomFilters();
      const queryString = buildQueryString(filters);
      const url = `${BASE_URL}/api/v1/legislators${queryString}`;

      const res = http.get(url);
      listLegislatorsDuration.add(res.timings.duration);
      checkSuccess(res, 'list_legislators');
    });
  }

  // Scenario 2: Get single legislator details (30% of traffic)
  if (Math.random() < 0.3) {
    group('Get Legislator Details', () => {
      const legislatorId = getRandomLegislatorId();
      const url = `${BASE_URL}/api/v1/legislators/${legislatorId}`;

      const res = http.get(url);
      getLegislatorDuration.add(res.timings.duration);
      checkSuccess(res, 'get_legislator');
    });
  }

  // Scenario 3: Get legislator committees (10% of traffic)
  if (Math.random() < 0.1) {
    group('Get Legislator Committees', () => {
      const legislatorId = getRandomLegislatorId();
      const url = `${BASE_URL}/api/v1/legislators/${legislatorId}/committees`;

      const res = http.get(url);
      getCommitteesDuration.add(res.timings.duration);
      checkSuccess(res, 'get_committees');
    });
  }

  // Think time: simulate user reading/processing
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ===== Lifecycle Hooks =====

export function setup() {
  console.log(`Starting Legislators API load test with profile: ${PROFILE}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Stages: ${JSON.stringify(profiles[PROFILE].stages)}`);

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
    'legislators-summary.json': JSON.stringify(data, null, 2),
  };
}
