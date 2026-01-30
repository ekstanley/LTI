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

/**
 * HTTP API error with status code and error code
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Network-level error (connection failed, DNS resolution, etc.)
 */
export class NetworkError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Request cancellation error (via AbortController)
 */
export class AbortError extends Error {
  constructor(message: string = 'Request was cancelled') {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * CSRF token expiration error (requires token refresh)
 */
export class CsrfTokenError extends Error {
  constructor(message: string = 'CSRF token expired or invalid') {
    super(message);
    this.name = 'CsrfTokenError';
  }
}

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Check if error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Check if error is an abort error
 */
export function isAbortError(error: unknown): error is AbortError {
  return error instanceof AbortError;
}

/**
 * Check if error is a CSRF token error
 */
export function isCsrfTokenError(error: unknown): error is CsrfTokenError {
  return error instanceof CsrfTokenError;
}

/**
 * Get user-friendly error message based on error type
 */
export function getErrorMessage(error: unknown): string {
  if (isAbortError(error)) {
    return 'Request was cancelled';
  }

  if (isCsrfTokenError(error)) {
    return 'Your session has expired. Please refresh the page and try again.';
  }

  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }

  if (isApiError(error)) {
    // Provide specific messages for common HTTP status codes
    if (error.status === 401) {
      return 'You are not authorized. Please log in and try again.';
    }
    if (error.status === 403) {
      return 'You do not have permission to access this resource.';
    }
    if (error.status === 404) {
      return 'The requested resource was not found.';
    }
    if (error.status === 429) {
      return 'Too many requests. Please try again later.';
    }
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

/** Maximum number of retry attempts for transient failures */
const MAX_RETRIES = 3;

/** Initial backoff delay in milliseconds */
const INITIAL_BACKOFF_MS = 1000;

/** Maximum backoff delay in milliseconds (30 seconds) */
const MAX_BACKOFF_MS = 30000;

/** Maximum CSRF token refresh attempts to prevent infinite loops */
const MAX_CSRF_REFRESH_ATTEMPTS = 2;

/**
 * Check if error is retriable (transient failure)
 */
function isRetriableError(error: unknown): boolean {
  // Network errors are retriable
  if (isNetworkError(error)) {
    return true;
  }

  // Server errors (5xx) are retriable
  if (isApiError(error) && error.status >= 500) {
    return true;
  }

  // 429 (Too Many Requests) is retriable with backoff
  if (isApiError(error) && error.status === 429) {
    return true;
  }

  return false;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number): number {
  // Exponential backoff: 2^attempt * baseDelay
  const exponentialDelay = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(2, attempt),
    MAX_BACKOFF_MS
  );

  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// HTTP Client with CSRF Protection
// ============================================================================

/**
 * Core fetcher implementation without retry logic
 * @internal
 */
async function fetcherCore<T>(
  endpoint: string,
  options?: RequestInit & { signal?: AbortSignal }
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

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies for session
      headers,
      ...(options?.signal && { signal: options.signal }), // Support request cancellation
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
  } catch (error) {
    // Categorize error types for better handling
    if (error instanceof ApiError) {
      // Already an ApiError, rethrow as-is
      throw error;
    }

    // Check if request was aborted
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AbortError();
    }

    // Network-level errors (connection failed, DNS, timeout, etc.)
    if (error instanceof TypeError) {
      throw new NetworkError('Failed to connect to the server', error);
    }

    // Unknown error type - wrap in NetworkError
    throw new NetworkError(
      'An unexpected network error occurred',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * HTTP fetcher with automatic retry for transient failures and CSRF token refresh
 *
 * Implements exponential backoff with jitter for retriable errors (network failures, 5xx, 429).
 * Automatically refreshes CSRF token on expiration and retries the request.
 * Respects AbortSignal for request cancellation.
 */
async function fetcher<T>(
  endpoint: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  let lastError: unknown;
  let csrfRefreshCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Check if request was aborted before retry
      if (options?.signal?.aborted) {
        throw new AbortError();
      }

      return await fetcherCore<T>(endpoint, options);
    } catch (error) {
      lastError = error;

      // Don't retry if request was aborted
      if (isAbortError(error)) {
        throw error;
      }

      // Handle CSRF token expiration (403 with specific error code)
      if (
        isApiError(error) &&
        error.status === 403 &&
        error.code === 'CSRF_TOKEN_INVALID'
      ) {
        // Limit CSRF refresh attempts to prevent infinite loops (DoS protection)
        csrfRefreshCount++;
        if (csrfRefreshCount > MAX_CSRF_REFRESH_ATTEMPTS) {
          throw new CsrfTokenError(
            'CSRF token refresh limit exceeded. Please refresh the page.'
          );
        }

        try {
          // Refresh CSRF token and retry immediately (don't count as retry attempt)
          await fetchCsrfToken();
          continue;
        } catch (csrfError) {
          // Failed to refresh CSRF token - throw CSRF-specific error
          throw new CsrfTokenError(
            'Failed to refresh CSRF token. Please refresh the page.'
          );
        }
      }

      // Check if error is retriable
      if (!isRetriableError(error)) {
        // Non-retriable error - throw immediately
        throw error;
      }

      // Check if we have retries remaining
      if (attempt >= MAX_RETRIES) {
        // Exhausted all retries - throw last error
        throw error;
      }

      // Wait with exponential backoff before retry
      const backoffDelay = calculateBackoff(attempt);
      await sleep(backoffDelay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
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
  params: BillsQueryParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<Bill>> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Bill>>(
    `/api/v1/bills${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

export async function getBill(id: string, signal?: AbortSignal): Promise<Bill> {
  return fetcher<Bill>(`/api/v1/bills/${id}`, signal ? { signal } : undefined);
}

export async function getBillAnalysis(billId: string, signal?: AbortSignal): Promise<BillAnalysis> {
  return fetcher<BillAnalysis>(`/api/v1/analysis/${billId}`, signal ? { signal } : undefined);
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
  params: LegislatorsQueryParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<Legislator>> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Legislator>>(
    `/api/v1/legislators${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

export async function getLegislator(id: string, signal?: AbortSignal): Promise<Legislator> {
  return fetcher<Legislator>(`/api/v1/legislators/${id}`, signal ? { signal } : undefined);
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
  params: VotesQueryParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<Vote>> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Vote>>(
    `/api/v1/votes${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

export async function getVote(id: string, signal?: AbortSignal): Promise<Vote> {
  return fetcher<Vote>(`/api/v1/votes/${id}`, signal ? { signal } : undefined);
}

// ============================================================================
// Conflicts of Interest API
// ============================================================================

export async function getConflicts(
  legislatorId: string,
  signal?: AbortSignal
): Promise<ConflictOfInterest[]> {
  const response = await fetcher<{ data: ConflictOfInterest[] }>(
    `/api/v1/conflicts?legislatorId=${legislatorId}`,
    signal ? { signal } : undefined
  );
  return response.data;
}

export async function getBillConflicts(
  billId: string,
  signal?: AbortSignal
): Promise<ConflictOfInterest[]> {
  const response = await fetcher<{ data: ConflictOfInterest[] }>(
    `/api/v1/conflicts?billId=${billId}`,
    signal ? { signal } : undefined
  );
  return response.data;
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkHealth(): Promise<{ status: string }> {
  return fetcher<{ status: string }>('/api/health');
}
