# Security Quick Reference - WP10

**For**: Developers implementing WP10 security fixes
**Last Updated**: 2026-01-31

---

## The Three Files You Need

```
1. SECURITY_AUDIT_REPORT_WP10.md        → Full technical audit (read first)
2. SECURITY_AUDIT_EXECUTIVE_SUMMARY.md  → Quick overview (5-min read)
3. WP10_SECURITY_CHECKLIST.md           → Step-by-step tasks (use during work)
```

---

## One-Page Implementation Guide

### Step 1: CSP Headers (30 min)

**File**: `/apps/web/next.config.js`

```javascript
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          process.env.NODE_ENV === 'production'
            ? "script-src 'self' 'strict-dynamic'"
            : "script-src 'self' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https://bioguide.congress.gov https://theunitedstates.io",
          `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}`,
          "frame-src 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
        ].filter(Boolean).join('; '),
      },
    ],
  }];
}
```

**Test**: `curl -I http://localhost:3000 | grep CSP`

---

### Step 2: Validation Utilities (20 min)

**File**: `/apps/web/src/lib/utils/validation.ts` (NEW FILE)

```typescript
export class ValidationError extends Error {
  constructor(message: string, public field: string, public value: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

const BILL_ID_PATTERN = /^[a-z]{2,7}-\d{1,5}-\d{3}$/;
const LEGISLATOR_ID_PATTERN = /^[A-Z]\d{6}$/;
const MAX_ID_LENGTH = 100;

export function validateBillId(id: string): string {
  if (id.length > MAX_ID_LENGTH) {
    throw new ValidationError('Bill ID too long', 'billId', id);
  }
  if (!BILL_ID_PATTERN.test(id)) {
    throw new ValidationError('Invalid bill ID format', 'billId', id);
  }
  return id;
}

export function validateLegislatorId(id: string): string {
  if (id.length > MAX_ID_LENGTH) {
    throw new ValidationError('Legislator ID too long', 'legislatorId', id);
  }
  if (!LEGISLATOR_ID_PATTERN.test(id)) {
    throw new ValidationError('Invalid legislator ID format', 'legislatorId', id);
  }
  return id;
}

export function sanitizeString(input: string): string {
  return input
    .replace(/[<>'"]/g, '')
    .trim()
    .slice(0, MAX_ID_LENGTH);
}

export function validatePaginationParams(params: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  if (limit < 1 || limit > 100) {
    throw new ValidationError('Invalid limit', 'limit', limit);
  }
  if (offset < 0) {
    throw new ValidationError('Invalid offset', 'offset', offset);
  }
  return { limit, offset };
}
```

---

### Step 3: Update Route Pages (15 min)

**File**: `/apps/web/src/app/bills/[id]/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { validateBillId, ValidationError } from '@/lib/utils/validation';

export default async function BillPage({ params }: BillPageProps) {
  const { id } = await params;

  try {
    validateBillId(id);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.warn(`Invalid bill ID: ${id}`);
      notFound();
    }
    throw error;
  }

  return <BillDetailClient billId={id} />;
}
```

**File**: `/apps/web/src/app/legislators/[id]/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { validateLegislatorId, ValidationError } from '@/lib/utils/validation';

export default async function LegislatorPage({ params }: LegislatorPageProps) {
  const { id } = await params;

  try {
    validateLegislatorId(id);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.warn(`Invalid legislator ID: ${id}`);
      notFound();
    }
    throw error;
  }

  return <LegislatorDetailClient legislatorId={id} />;
}
```

---

### Step 4: Update API Client (10 min)

**File**: `/apps/web/src/lib/api.ts`

```typescript
import { validateBillId, validateLegislatorId, sanitizeString, validatePaginationParams } from './utils/validation';

// Add validation to getBill
export async function getBill(id: string, signal?: AbortSignal): Promise<Bill> {
  const validId = validateBillId(id);
  return fetcher<Bill>(`/api/v1/bills/${validId}`, signal ? { signal } : undefined);
}

// Add validation to getLegislator
export async function getLegislator(id: string, signal?: AbortSignal): Promise<Legislator> {
  const validId = validateLegislatorId(id);
  return fetcher<Legislator>(`/api/v1/legislators/${validId}`, signal ? { signal } : undefined);
}

// Add sanitization to getBills
export async function getBills(params: BillsQueryParams = {}, signal?: AbortSignal) {
  const { limit, offset } = validatePaginationParams({ limit: params.limit, offset: params.offset });

  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', sanitizeString(params.search));
  if (params.billType) searchParams.set('billType', sanitizeString(params.billType));
  // ... etc
  searchParams.set('limit', String(limit));
  searchParams.set('offset', String(offset));

  return fetcher(`/api/v1/bills?${searchParams.toString()}`, signal ? { signal } : undefined);
}
```

---

### Step 5: Error Sanitization (20 min)

**File**: `/apps/web/src/lib/api.ts`

```typescript
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'UNAUTHORIZED': 'Authentication required. Please log in.',
  'FORBIDDEN': 'You do not have permission to access this resource.',
  'NOT_FOUND': 'The requested resource was not found.',
  'VALIDATION_ERROR': 'The provided data is invalid.',
  'INTERNAL_ERROR': 'An unexpected error occurred. Please try again later.',
  'DATABASE_ERROR': 'A database error occurred. Please try again later.',
  'CSRF_TOKEN_INVALID': 'Security token invalid. Please refresh the page.',
  'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later.',
  'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.',
};

async function fetcherCore<T>(endpoint: string, options?: RequestInit) {
  // ... existing code ...

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const safeMessage = SAFE_ERROR_MESSAGES[error.code] ?? SAFE_ERROR_MESSAGES.UNKNOWN_ERROR;

    // Log full error server-side only
    if (typeof window === 'undefined') {
      console.error('API Error:', { endpoint, status: response.status, code: error.code, originalMessage: error.message });
    }

    throw new ApiError(response.status, error.code ?? 'UNKNOWN_ERROR', safeMessage);
  }

  return response.json();
}
```

---

## Quick Test Commands

```bash
# CSP Headers
curl -I http://localhost:3000 | grep -i content-security

# Valid Routes
curl http://localhost:3000/bills/hr-1-119       # ✅ 200
curl http://localhost:3000/legislators/S000033  # ✅ 200

# Invalid Routes (should 404)
curl http://localhost:3000/bills/invalid        # ❌ 404
curl http://localhost:3000/bills/../etc/passwd  # ❌ 404
curl 'http://localhost:3000/bills/<script>'     # ❌ 404

# Search Sanitization
# In browser console:
fetch('/api/v1/bills?search=<script>alert(1)</script>')
# XSS chars should be removed
```

---

## Score Impact

```
Implementation    Time    Score   Status
──────────────────────────────────────────
CSP Headers       30m     +4      ⚠️ TODO
Route Validation  45m     +4      ⚠️ TODO
Input Sanitize    30m     +2      ⚠️ TODO
Error Sanitize    20m     +1      ⚠️ TODO
──────────────────────────────────────────
TOTAL            125m    +11      65→76/100
```

**Target**: 75/100
**Projected**: 76-78/100
**Status**: ✅ Will exceed target

---

## Common Pitfalls

❌ **Don't**: Copy-paste CSP without updating `NEXT_PUBLIC_API_URL`
✅ **Do**: Update CSP `connect-src` to match your API URL

❌ **Don't**: Validate only in route pages
✅ **Do**: Validate in BOTH route pages AND API client

❌ **Don't**: Use `console.log()` for invalid IDs
✅ **Do**: Use `console.warn()` to avoid production noise

❌ **Don't**: Forget to test production build
✅ **Do**: Test with `npm run build && npm start`

---

## Debugging Tips

**CSP violations in console?**
- Check `img-src` allows your image domains
- Ensure `connect-src` includes API URL
- Dev mode needs `'unsafe-eval'` for HMR

**Validation rejecting valid IDs?**
- Check regex pattern matches expected format
- Verify ID is lowercase (bills) or uppercase (legislators)
- Ensure no extra characters (trim input)

**404 on valid routes?**
- Check `validateBillId()` is called with correct pattern
- Verify `notFound()` is only called for `ValidationError`
- Check console warnings for validation failures

---

## Final Checklist

- [ ] CSP headers added to `next.config.js`
- [ ] Validation utilities created in `validation.ts`
- [ ] Route pages updated: `bills/[id]/page.tsx`, `legislators/[id]/page.tsx`
- [ ] API client updated: `api.ts`
- [ ] Error sanitization added: `SAFE_ERROR_MESSAGES`
- [ ] All tests pass: valid routes work, invalid routes 404
- [ ] Browser console clean: no CSP violations
- [ ] Production build successful: `npm run build`
- [ ] Documentation updated: `SECURITY.md` shows 78/100

---

## Need Help?

**Issue**: CSP blocking something → Check full audit report section "CSP Policy Breakdown"
**Issue**: Validation too strict → Review regex patterns in audit report
**Issue**: Tests failing → Use `WP10_SECURITY_CHECKLIST.md` verification steps

**Questions?** Read full audit: `SECURITY_AUDIT_REPORT_WP10.md`
**Quick check?** Read summary: `SECURITY_AUDIT_EXECUTIVE_SUMMARY.md`
**Implementing?** Follow: `WP10_SECURITY_CHECKLIST.md`

---

**Quick Reference Card** | **Version 1.0** | **2026-01-31**
