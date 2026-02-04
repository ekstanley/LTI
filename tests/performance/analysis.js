/**
 * Analysis API Load Test
 *
 * Tests the following endpoints:
 * - GET /api/analysis/:billId - Get bill analysis
 * - POST /api/analysis/:billId/generate - Request new analysis
 *
 * NOTE: These endpoints currently return 404/placeholder responses (TODO in implementation).
 *       This script establishes baseline performance for when the feature is implemented.
 *
 * Load Profiles:
 * - light: 5 VUs for 1 minute (analysis is computationally expensive)
 * - medium: 20 VUs for 2 minutes
 * - heavy: 50 VUs for 3 minutes
 *
 * Usage:
 *   k6 run analysis.js                    # Default (medium)
 *   k6 run -e PROFILE=light analysis.js   # Light load
 *   k6 run -e PROFILE=heavy analysis.js   # Heavy load
 *   k6 run -e BASE_URL=http://localhost:4000 analysis.js  # Custom URL
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ===== Configuration =====

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const PROFILE = __ENV.PROFILE || 'medium';

// Load profiles (lighter than other endpoints - analysis is expensive)
const profiles = {
  light: {
    stages: [
      { duration: '10s', target: 3 },
      { duration: '30s', target: 5 },
      { duration: '10s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
      'http_req_failed': ['rate<0.1'],
    },
  },
  medium: {
    stages: [
      { duration: '20s', target: 10 },
      { duration: '1m', target: 20 },
      { duration: '20s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<3000', 'p(99)<10000'],
      'http_req_failed': ['rate<0.1'],
    },
  },
  heavy: {
    stages: [
      { duration: '30s', target: 25 },
      { duration: '2m', target: 50 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      'http_req_duration': ['p(95)<5000', 'p(99)<15000'],
      'http_req_failed': ['rate<0.15'],
    },
  },
};

// Apply selected profile
export const options = {
  stages: profiles[PROFILE].stages,
  thresholds: {
    ...profiles[PROFILE].thresholds,
    // Endpoint-specific thresholds
    'get_analysis_duration': ['p(95)<2000'],
    'generate_analysis_duration': ['p(95)<3000'],
  },
};

// ===== Custom Metrics =====

const getAnalysisDuration = new Trend('get_analysis_duration');
const generateAnalysisDuration = new Trend('generate_analysis_duration');

const errorRate = new Rate('errors');
const successRate = new Rate('successes');
const requestCounter = new Counter('total_requests');

// ===== Test Data =====

// Sample bill IDs for analysis testing
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

// ===== Helper Functions =====

/**
 * Get a random bill ID from sample data
 */
function getRandomBillId() {
  return SAMPLE_BILL_IDS[Math.floor(Math.random() * SAMPLE_BILL_IDS.length)];
}

/**
 * Check 404 response (current implementation)
 */
function check404(res, endpoint) {
  const success = check(res, {
    'status is 404': (r) => r.status === 404,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 5s': (r) => r.timings.duration < 5000,
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

/**
 * Check 202 Accepted response for generate endpoint
 */
function check202(res, endpoint) {
  const success = check(res, {
    'status is 202': (r) => r.status === 202,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 5s': (r) => r.timings.duration < 5000,
    'response has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'pending';
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

// ===== Test Scenarios =====

export default function () {
  // Scenario 1: Get existing analysis (70% of traffic)
  // Note: Currently returns 404 as feature not implemented
  if (Math.random() < 0.7) {
    group('Get Analysis', () => {
      const billId = getRandomBillId();
      const url = `${BASE_URL}/api/analysis/${billId}`;

      const res = http.get(url);
      getAnalysisDuration.add(res.timings.duration);

      // Currently expect 404 as feature not implemented
      check404(res, 'get_analysis');
    });
  }

  // Scenario 2: Request new analysis generation (30% of traffic)
  if (Math.random() < 0.3) {
    group('Generate Analysis', () => {
      const billId = getRandomBillId();
      const url = `${BASE_URL}/api/analysis/${billId}/generate`;

      const res = http.post(url);
      generateAnalysisDuration.add(res.timings.duration);

      // Expect 202 Accepted (queued for processing)
      check202(res, 'generate_analysis');
    });
  }

  // Think time: simulate user waiting for analysis
  sleep(Math.random() * 3 + 2); // 2-5 seconds (longer for analysis)
}

// ===== Lifecycle Hooks =====

export function setup() {
  console.log(`Starting Analysis API load test with profile: ${PROFILE}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Stages: ${JSON.stringify(profiles[PROFILE].stages)}`);
  console.log('NOTE: Analysis endpoints currently return placeholder responses');
  console.log('NOTE: Using lighter load as analysis is computationally expensive');

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
    'analysis-summary.json': JSON.stringify(data, null, 2),
  };
}
