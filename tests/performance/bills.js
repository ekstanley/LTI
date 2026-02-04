/**
 * Bills API Load Test
 *
 * Tests the following endpoints:
 * - GET /api/v1/bills - List bills with filtering
 * - GET /api/v1/bills/:id - Single bill details
 * - GET /api/v1/bills/:id/sponsors - Bill sponsors
 * - GET /api/v1/bills/:id/cosponsors - Bill cosponsors
 * - GET /api/v1/bills/:id/actions - Bill action history
 * - GET /api/v1/bills/:id/text - Bill text versions
 * - GET /api/v1/bills/:id/related - Related bills
 *
 * Load Profiles:
 * - light: 10 VUs for 1 minute
 * - medium: 50 VUs for 2 minutes
 * - heavy: 100 VUs for 3 minutes
 *
 * Usage:
 *   k6 run bills.js                    # Default (medium)
 *   k6 run -e PROFILE=light bills.js   # Light load
 *   k6 run -e PROFILE=heavy bills.js   # Heavy load
 *   k6 run -e BASE_URL=http://localhost:4000 bills.js  # Custom URL
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
      { duration: '10s', target: 5 },   // Ramp up to 5 VUs
      { duration: '30s', target: 10 },  // Stay at 10 VUs
      { duration: '10s', target: 0 },   // Ramp down
    ],
    thresholds: {
      'http_req_duration': ['p(95)<500', 'p(99)<1000'],
      'http_req_failed': ['rate<0.01'],
    },
  },
  medium: {
    stages: [
      { duration: '20s', target: 20 },  // Ramp up
      { duration: '1m', target: 50 },   // Sustained load
      { duration: '20s', target: 0 },   // Ramp down
    ],
    thresholds: {
      'http_req_duration': ['p(95)<800', 'p(99)<1500'],
      'http_req_failed': ['rate<0.01'],
    },
  },
  heavy: {
    stages: [
      { duration: '30s', target: 50 },  // Ramp up
      { duration: '2m', target: 100 },  // Peak load
      { duration: '30s', target: 0 },   // Ramp down
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
    'list_bills_duration': ['p(95)<600'],
    'get_bill_duration': ['p(95)<300'],
    'get_sponsors_duration': ['p(95)<400'],
    'get_cosponsors_duration': ['p(95)<400'],
    'get_actions_duration': ['p(95)<500'],
    'get_text_duration': ['p(95)<500'],
    'get_related_duration': ['p(95)<600'],
  },
};

// ===== Custom Metrics =====

const listBillsDuration = new Trend('list_bills_duration');
const getBillDuration = new Trend('get_bill_duration');
const getSponsorsDuration = new Trend('get_sponsors_duration');
const getCosponsorsDuration = new Trend('get_cosponsors_duration');
const getActionsDuration = new Trend('get_actions_duration');
const getTextDuration = new Trend('get_text_duration');
const getRelatedDuration = new Trend('get_related_duration');

const errorRate = new Rate('errors');
const successRate = new Rate('successes');
const requestCounter = new Counter('total_requests');

// ===== Test Data =====

// Sample bill IDs for testing (these should be valid IDs in your database)
const SAMPLE_BILL_IDS = [
  '118-hr-1',
  '118-hr-2',
  '118-hr-3',
  '118-s-1',
  '118-s-2',
  '118-s-3',
  '117-hr-100',
  '117-s-100',
];

// Filter combinations for list endpoint
const FILTER_SETS = [
  {},
  { chamber: 'house' },
  { chamber: 'senate' },
  { congressNumber: 118 },
  { status: 'introduced' },
  { billType: 'hr' },
  { search: 'infrastructure' },
  { limit: 20, offset: 0 },
  { limit: 50, offset: 50 },
];

// ===== Helper Functions =====

/**
 * Get a random bill ID from sample data
 */
function getRandomBillId() {
  return SAMPLE_BILL_IDS[Math.floor(Math.random() * SAMPLE_BILL_IDS.length)];
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
  // Scenario 1: List bills (40% of traffic)
  if (Math.random() < 0.4) {
    group('List Bills', () => {
      const filters = getRandomFilters();
      const queryString = buildQueryString(filters);
      const url = `${BASE_URL}/api/v1/bills${queryString}`;

      const res = http.get(url);
      listBillsDuration.add(res.timings.duration);
      checkSuccess(res, 'list_bills');
    });
  }

  // Scenario 2: Get single bill details (30% of traffic)
  if (Math.random() < 0.3) {
    group('Get Bill Details', () => {
      const billId = getRandomBillId();
      const url = `${BASE_URL}/api/v1/bills/${billId}`;

      const res = http.get(url);
      getBillDuration.add(res.timings.duration);
      checkSuccess(res, 'get_bill');
    });
  }

  // Scenario 3: Get bill sponsors (10% of traffic)
  if (Math.random() < 0.1) {
    group('Get Bill Sponsors', () => {
      const billId = getRandomBillId();
      const url = `${BASE_URL}/api/v1/bills/${billId}/sponsors`;

      const res = http.get(url);
      getSponsorsDuration.add(res.timings.duration);
      checkSuccess(res, 'get_sponsors');
    });
  }

  // Scenario 4: Get bill cosponsors (10% of traffic)
  if (Math.random() < 0.1) {
    group('Get Bill Cosponsors', () => {
      const billId = getRandomBillId();
      const url = `${BASE_URL}/api/v1/bills/${billId}/cosponsors`;

      const res = http.get(url);
      getCosponsorsDuration.add(res.timings.duration);
      checkSuccess(res, 'get_cosponsors');
    });
  }

  // Scenario 5: Get bill actions (5% of traffic)
  if (Math.random() < 0.05) {
    group('Get Bill Actions', () => {
      const billId = getRandomBillId();
      const url = `${BASE_URL}/api/v1/bills/${billId}/actions`;

      const res = http.get(url);
      getActionsDuration.add(res.timings.duration);
      checkSuccess(res, 'get_actions');
    });
  }

  // Scenario 6: Get bill text versions (3% of traffic)
  if (Math.random() < 0.03) {
    group('Get Bill Text', () => {
      const billId = getRandomBillId();
      const url = `${BASE_URL}/api/v1/bills/${billId}/text`;

      const res = http.get(url);
      getTextDuration.add(res.timings.duration);
      checkSuccess(res, 'get_text');
    });
  }

  // Scenario 7: Get related bills (2% of traffic)
  if (Math.random() < 0.02) {
    group('Get Related Bills', () => {
      const billId = getRandomBillId();
      const url = `${BASE_URL}/api/v1/bills/${billId}/related?limit=5`;

      const res = http.get(url);
      getRelatedDuration.add(res.timings.duration);
      checkSuccess(res, 'get_related');
    });
  }

  // Think time: simulate user reading/processing
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ===== Lifecycle Hooks =====

export function setup() {
  console.log(`Starting Bills API load test with profile: ${PROFILE}`);
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
    'bills-summary.json': JSON.stringify(data, null, 2),
  };
}
