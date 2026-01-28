/**
 * API client for LTIP backend
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

async function fetcher<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

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
