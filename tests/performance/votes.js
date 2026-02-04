/**
 * Votes API Load Test
 *
 * Tests the following endpoints:
 * - GET /api/v1/votes - List votes with filtering
 * - GET /api/v1/votes/:id - Single vote details
 * - GET /api/v1/votes/:id/breakdown - Individual legislator votes
 *
 * Load Profiles:
 * - light: 10 VUs for 1 minute
 * - medium: 50 VUs for 2 minutes
 * - heavy: 100 VUs for 3 minutes
 *
 * Usage:
 *   k6 run votes.js                    # Default (medium)
 *   k6 run -e PROFILE=light votes.js   # Light load
 *   k6 run -e PROFILE=heavy votes.js   # Heavy load
 *   k6 run -e BASE_URL=http://localhost:4000 votes.js  # Custom URL
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
    'list_votes_duration': ['p(95)<700'],
    'get_vote_duration': ['p(95)<300'],
    'get_breakdown_duration': ['p(95)<600'],
  },
};

// ===== Custom Metrics =====

const listVotesDuration = new Trend('list_votes_duration');
const getVoteDuration = new Trend('get_vote_duration');
const getBreakdownDuration = new Trend('get_breakdown_duration');

const errorRate = new Rate('errors');
const successRate = new Rate('successes');
const requestCounter = new Counter('total_requests');

// ===== Test Data =====

// Sample vote IDs (format varies by chamber and vote type)
const SAMPLE_VOTE_IDS = [
  'h118-2023-1',
  'h118-2023-2',
  'h118-2023-3',
  's118-2023-1',
  's118-2023-2',
  's118-2023-3',
  'h117-2022-100',
  's117-2022-100',
];

// Filter combinations for list endpoint
const FILTER_SETS = [
  {},
  { chamber: 'house' },
  { chamber: 'senate' },
  { congressNumber: 118 },
  { congressNumber: 117 },
  { session: 1 },
  { session: 2 },
  { result: 'Passed' },
  { result: 'Failed' },
  { billId: '118-hr-1' },
  { limit: 20, offset: 0 },
  { limit: 50, offset: 50 },
  { chamber: 'house', result: 'Passed' },
  { chamber: 'senate', congressNumber: 118 },
];

// ===== Helper Functions =====

/**
 * Get a random vote ID from sample data
 */
function getRandomVoteId() {
  return SAMPLE_VOTE_IDS[Math.floor(Math.random() * SAMPLE_VOTE_IDS.length)];
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
  // Scenario 1: List votes (60% of traffic)
  if (Math.random() < 0.6) {
    group('List Votes', () => {
      const filters = getRandomFilters();
      const queryString = buildQueryString(filters);
      const url = `${BASE_URL}/api/v1/votes${queryString}`;

      const res = http.get(url);
      listVotesDuration.add(res.timings.duration);
      checkSuccess(res, 'list_votes');
    });
  }

  // Scenario 2: Get single vote details (30% of traffic)
  if (Math.random() < 0.3) {
    group('Get Vote Details', () => {
      const voteId = getRandomVoteId();
      const url = `${BASE_URL}/api/v1/votes/${voteId}`;

      const res = http.get(url);
      getVoteDuration.add(res.timings.duration);
      checkSuccess(res, 'get_vote');
    });
  }

  // Scenario 3: Get vote breakdown (10% of traffic)
  if (Math.random() < 0.1) {
    group('Get Vote Breakdown', () => {
      const voteId = getRandomVoteId();
      const url = `${BASE_URL}/api/v1/votes/${voteId}/breakdown`;

      const res = http.get(url);
      getBreakdownDuration.add(res.timings.duration);
      checkSuccess(res, 'get_breakdown');
    });
  }

  // Think time: simulate user reading/processing
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ===== Lifecycle Hooks =====

export function setup() {
  console.log(`Starting Votes API load test with profile: ${PROFILE}`);
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
    'votes-summary.json': JSON.stringify(data, null, 2),
  };
}
