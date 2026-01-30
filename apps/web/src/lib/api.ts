/**
 * API client for LTIP backend with CSRF protection
 */

import type {
  Bill,
  Legislator,
  Vote,
  BillAnalysis,
  ConflictOfInterest,
  PaginatedResponse,
} from '@ltip/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ============================================================================
// CSRF Token Management
// ============================================================================

/**
 * In-memory CSRF token storage
 * Token is automatically rotated on each protected request
 */
let csrfToken: string | null = null;

/**
 * HTTP methods that require CSRF protection
 */
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Fetch CSRF token from server
 * Should be called after authentication
 */
export async function fetchCsrfToken(): Promise<string> {
  const url = `${API_BASE_URL}/api/v1/auth/csrf-token`;

  const response = await fetch(url, {
    credentials: 'include', // Include cookies for session
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const data = await response.json();
  if (!data.csrfToken || typeof data.csrfToken !== 'string') {
    throw new Error('Invalid CSRF token response');
  }

  csrfToken = data.csrfToken;
  return data.csrfToken;
}

/**
 * Get current CSRF token
 * Returns null if not yet fetched
 */
export function getCsrfToken(): string | null {
  return csrfToken;
}

/**
 * Clear CSRF token (on logout)
 */
export function clearCsrfToken(): void {
  csrfToken = null;
}

// ============================================================================
// API Error Handling
// ============================================================================

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================================
// HTTP Client with CSRF Protection
// ============================================================================

async function fetcher<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = options?.method?.toUpperCase() ?? 'GET';

  // Build headers with CSRF token for protected methods
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add CSRF token header for state-changing requests
  if (CSRF_PROTECTED_METHODS.has(method) && csrfToken) {
    (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies for session
    headers,
  });

  // Extract and store new CSRF token from response header (automatic rotation)
  const newCsrfToken = response.headers.get('X-CSRF-Token');
  if (newCsrfToken) {
    csrfToken = newCsrfToken;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.code ?? 'UNKNOWN_ERROR',
      error.message ?? 'An unexpected error occurred'
    );
  }

  return response.json();
}

// ============================================================================
// Bills API
// ============================================================================

export interface BillsQueryParams {
  congressNumber?: number;
  billType?: string;
  status?: string;
  chamber?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getBills(
  params: BillsQueryParams = {}
): Promise<PaginatedResponse<Bill>> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Bill>>(
    `/api/v1/bills${query ? `?${query}` : ''}`
  );
}

export async function getBill(id: string): Promise<Bill> {
  return fetcher<Bill>(`/api/v1/bills/${id}`);
}

export async function getBillAnalysis(billId: string): Promise<BillAnalysis> {
  return fetcher<BillAnalysis>(`/api/v1/analysis/${billId}`);
}

// ============================================================================
// Legislators API
// ============================================================================

export interface LegislatorsQueryParams {
  chamber?: string;
  party?: string;
  state?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getLegislators(
  params: LegislatorsQueryParams = {}
): Promise<PaginatedResponse<Legislator>> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Legislator>>(
    `/api/v1/legislators${query ? `?${query}` : ''}`
  );
}

export async function getLegislator(id: string): Promise<Legislator> {
  return fetcher<Legislator>(`/api/v1/legislators/${id}`);
}

// ============================================================================
// Votes API
// ============================================================================

export interface VotesQueryParams {
  chamber?: string;
  billId?: string;
  result?: string;
  limit?: number;
  offset?: number;
}

export async function getVotes(
  params: VotesQueryParams = {}
): Promise<PaginatedResponse<Vote>> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Vote>>(
    `/api/v1/votes${query ? `?${query}` : ''}`
  );
}

export async function getVote(id: string): Promise<Vote> {
  return fetcher<Vote>(`/api/v1/votes/${id}`);
}

// ============================================================================
// Conflicts of Interest API
// ============================================================================

export async function getConflicts(
  legislatorId: string
): Promise<ConflictOfInterest[]> {
  const response = await fetcher<{ data: ConflictOfInterest[] }>(
    `/api/v1/conflicts?legislatorId=${legislatorId}`
  );
  return response.data;
}

export async function getBillConflicts(
  billId: string
): Promise<ConflictOfInterest[]> {
  const response = await fetcher<{ data: ConflictOfInterest[] }>(
    `/api/v1/conflicts?billId=${billId}`
  );
  return response.data;
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkHealth(): Promise<{ status: string }> {
  return fetcher<{ status: string }>('/api/health');
}
