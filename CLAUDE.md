# LTI Development Guide

**Version**: 1.1.0
**Last Updated**: 2026-02-01
**Purpose**: Development guidelines and best practices for the LTI (Legislative Transparency & Insight Platform) project

---

## Quick Reference

### Essential Commands

```bash
# Development
pnpm install                    # Install dependencies
pnpm dev                        # Start all services
pnpm --filter=@ltip/api dev     # Start API only
pnpm --filter=@ltip/web dev     # Start Web only

# Testing
pnpm test                       # Run all tests
pnpm --filter=@ltip/api test    # API tests only
pnpm --filter=@ltip/web test    # Web tests only
pnpm --filter=@ltip/shared test # Shared tests only

# Building
pnpm build                      # Build all packages
pnpm typecheck                  # TypeScript type checking

# Code Quality
pnpm lint                       # Run linters
pnpm format                     # Format code
```

### Project Structure

```
LTI/
├── apps/
│   ├── api/                    # Express API server
│   │   ├── src/
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── services/       # Business logic
│   │   │   ├── middleware/     # Request middleware
│   │   │   ├── utils/          # Utility functions
│   │   │   └── __tests__/      # API tests
│   │   └── package.json
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/            # Next.js app router pages
│       │   ├── components/     # React components
│       │   ├── hooks/          # Custom React hooks
│       │   ├── lib/            # API client, utilities
│       │   ├── config/         # Environment configuration
│       │   └── __tests__/      # Web tests
│       └── package.json
├── packages/
│   └── shared/                 # Shared code between API and Web
│       ├── src/
│       │   ├── types/          # TypeScript types
│       │   ├── validation/     # Zod schemas
│       │   └── __tests__/      # Shared tests
│       └── package.json
├── docs/                       # Documentation
│   ├── change-control/         # Change control records
│   └── screenshots/            # Visual documentation
└── .claude/                    # Claude Code configuration
    └── Agents.md               # Multi-agent workflow docs
```

---

## Development Workflow

### 1. Starting Work

**Pre-flight checklist**:
```bash
# 1. Sync with remote
git status
git pull origin master

# 2. Create feature branch
git checkout -b feature/description-issue-number

# 3. Install dependencies (if needed)
pnpm install

# 4. Start development environment
pnpm dev

# 5. Verify services running
curl http://localhost:4000/api/health  # API
open http://localhost:3000              # Web
```

### 2. During Development

#### Code Quality Standards

**TypeScript**:
- ✅ Strict mode enabled
- ✅ No `any` types (use type guards for runtime validation)
- ✅ No `@ts-ignore` (fix the type error properly)
- ✅ Exhaustive type checking with discriminated unions
- ✅ Runtime validation with Zod for external data

**Functions**:
- ✅ Keep under 50 lines
- ✅ Single responsibility principle
- ✅ Descriptive names (verb + noun for functions)
- ✅ JSDoc comments for public APIs
- ✅ Error handling with typed errors

**React Components**:
- ✅ Functional components with hooks
- ✅ Props interfaces defined
- ✅ Accessibility (ARIA labels, semantic HTML)
- ✅ Loading and error states
- ✅ Memoization only when measured (React.memo, useMemo, useCallback)

**Testing Requirements**:
- ✅ Unit tests for business logic
- ✅ Component tests for UI
- ✅ Integration tests for API endpoints
- ✅ Aim for 70%+ coverage on critical paths
- ✅ Both positive and negative test cases

#### Environment Configuration

**Never hardcode configuration values**. Use environment variables:

```typescript
// ❌ Bad
const API_URL = 'http://localhost:4000';

// ✅ Good
import { apiConfig } from '@/config/env';
const API_URL = apiConfig.baseUrl;
```

**Environment files**:
- `.env.local` - Your local overrides (gitignored)
- `.env.example` - Template with all variables documented

#### Validation

**Client-side validation with Zod**:

```typescript
import { z } from 'zod';

// Define schema
const billFilterSchema = z.object({
  search: z.string().min(1).max(500).optional(),
  chamber: z.enum(['house', 'senate']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).strict();

// Validate
const result = billFilterSchema.safeParse(filters);
if (!result.success) {
  // Handle validation errors
  console.error(result.error.errors);
}
```

**Runtime type guards for API data**:

```typescript
// apps/api/src/utils/type-guards.ts
export function hasSession(req: Request): req is Request & { session: SessionData } {
  return (
    isDefined(req.session) &&
    isPlainObject(req.session) &&
    isNonEmptyString(req.session.id)
  );
}

// Usage
if (!hasSession(req)) {
  throw ApiError.unauthorized('Session required');
}
// TypeScript now knows req.session exists and is typed
```

### 3. Completing Work

#### Pre-Commit Checklist

```bash
# 1. Run tests
pnpm test
# ✅ All tests passing

# 2. Build all packages
pnpm build
# ✅ All builds successful

# 3. Type check
pnpm typecheck
# ✅ Zero TypeScript errors

# 4. Lint (if configured)
pnpm lint
# ✅ No linting errors
```

#### Commit Guidelines

**Format**: `<type>(<scope>): <description>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions or fixes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Build process, dependencies

**Examples**:
```bash
git commit -m "feat(api): add bill search endpoint"
git commit -m "fix(web): resolve filter validation error"
git commit -m "docs(readme): update setup instructions"
git commit -m "test(shared): add validation schema tests"
```

#### Pull Request Process

1. **Push branch**:
```bash
git push -u origin feature/description-issue-number
```

2. **Create PR**:
```bash
gh pr create --title "Brief description" \
  --body "## Summary

  [What this PR does]

  ## Changes

  - Change 1
  - Change 2

  ## Testing

  - [ ] All tests passing
  - [ ] Manual testing completed
  - [ ] Screenshots attached (if UI changes)

  ## Related Issues

  Closes #123"
```

3. **Address review feedback**:
- Make requested changes
- Push additional commits
- Respond to review comments

4. **Merge**:
- Squash and merge (preferred)
- Delete branch after merge

---

## Code Patterns and Best Practices

### API Route Pattern (Express)

```typescript
// apps/api/src/routes/bills.ts
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error';
import { authenticate } from '../middleware/auth';

const router = Router();

// Request validation schema
const getBillSchema = z.object({
  id: z.string().regex(/^[A-Z]+-\d+-[a-z]+\d+$/),
});

router.get('/api/bills/:id', authenticate, async (req, res, next) => {
  try {
    // 1. Validate input
    const { id } = getBillSchema.parse(req.params);

    // 2. Check authorization (if needed)
    // if (!canAccessBill(req.user, id)) {
    //   throw ApiError.forbidden('Access denied');
    // }

    // 3. Business logic
    const bill = await billService.getById(id);
    if (!bill) {
      throw ApiError.notFound('Bill not found');
    }

    // 4. Response
    res.json(bill);
  } catch (error) {
    next(error); // Let error middleware handle it
  }
});

export default router;
```

### React Component Pattern

```typescript
// apps/web/src/components/BillFilters.tsx
import { useState } from 'react';
import { z } from 'zod';
import { billFilterSchema } from '@ltip/shared/validation';

interface BillFiltersProps {
  filters: BillFilters;
  onChange: (filters: BillFilters) => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function BillFilters({ filters, onChange, onClear, isLoading }: BillFiltersProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: unknown) => {
    const result = billFilterSchema.safeParse({ ...filters, [name]: value });
    if (!result.success) {
      const fieldError = result.error.errors.find(e => e.path[0] === name);
      if (fieldError) {
        setErrors(prev => ({ ...prev, [name]: fieldError.message }));
        return;
      }
    }
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleChange = (name: string, value: unknown) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
    onChange({ ...filters, [name]: value });
  };

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div>
        <label htmlFor="search" className="block text-sm font-medium">
          Search
        </label>
        <input
          id="search"
          type="text"
          value={filters.search || ''}
          onChange={(e) => handleChange('search', e.target.value)}
          disabled={isLoading}
          aria-invalid={touched.search && !!errors.search}
          aria-describedby={errors.search ? 'search-error' : undefined}
          className={cn(
            'mt-1 block w-full rounded-md border-gray-300',
            touched.search && errors.search && 'border-red-500'
          )}
        />
        {touched.search && errors.search && (
          <p id="search-error" className="mt-1 text-sm text-red-500" role="alert">
            {errors.search}
          </p>
        )}
      </div>

      {/* Clear button */}
      <button
        onClick={onClear}
        disabled={isLoading}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
      >
        Clear Filters
      </button>
    </div>
  );
}
```

### Authentication Pattern (AuthContext)

**Using authentication in components**:

```typescript
// apps/web/src/app/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

function Dashboard() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Welcome, {user?.name}!</h1>
      <p>Email: {user?.email}</p>
      <p>Role: {user?.role}</p>
      <button onClick={() => void logout()}>Logout</button>
    </div>
  );
}
```

**Login page example**:

```typescript
// apps/web/src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const { login, isLoading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login(email, password);

      // Redirect to return URL or dashboard
      const returnUrl = searchParams.get('return') || '/dashboard';
      router.push(returnUrl);
    } catch (err) {
      // Error is already set in auth state
      console.error('Login failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

**AuthProvider setup** (in app layout):

```typescript
// apps/web/src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Key features**:
- ✅ Session persistence in localStorage
- ✅ Automatic token refresh every 5 minutes
- ✅ CSRF token management
- ✅ Protected route wrapper component
- ✅ Loading and error states
- ✅ Type-safe with TypeScript

### Custom Hook Pattern

```typescript
// apps/web/src/hooks/useBills.ts
import useSWR from 'swr';
import { api } from '@/lib/api';
import { swrConfig } from '@/config/env';
import type { Bill, BillFilters } from '@ltip/shared/types';

export function useBills(filters: BillFilters) {
  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.chamber) queryParams.set('chamber', filters.chamber);
  if (filters.limit) queryParams.set('limit', String(filters.limit));

  const key = `/api/bills?${queryParams.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<Bill[]>(
    key,
    () => api.get(key),
    {
      dedupingInterval: swrConfig.dedupingInterval,
      revalidateOnFocus: swrConfig.revalidateOnFocus,
    }
  );

  return {
    bills: data,
    error,
    isLoading,
    mutate,
  };
}
```

---

## Recent Improvements (Quick Wins Sprint)

### Change Record: CR-2026-02-01-005

**Date**: 2026-02-01
**Status**: Completed

**Changes Implemented**:

1. **TypeScript Safety** (Issue #6)
   - Eliminated all `as any` and `@ts-ignore` casts
   - Created comprehensive type guard library (11 functions)
   - Improved runtime type safety with compile-time guarantees

2. **Client-Side Validation** (Issue #18)
   - Added Zod validation schemas for all filter types
   - Implemented real-time validation in filter components
   - Added accessibility-compliant error feedback
   - Created 62 new tests for validation logic

3. **Environment Configuration** (Issue #20)
   - Extracted all hardcoded values to environment variables
   - Created centralized configuration module
   - Provided `.env.example` template
   - Type-safe configuration access

**Test Results**:
```
✅ Shared:  79/79 tests passing (+35 new)
✅ API:    477/477 tests passing
✅ Web:    368/368 tests passing (+27 new)
✅ Total:  924/924 tests passing
```

**Documentation**:
- [Full Change Control Record](docs/change-control/2026-02-01-quick-wins-sprint.md)
- [Multi-Agent Workflow](.claude/Agents.md)

---

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :4000  # API
lsof -i :3000  # Web

# Kill process
kill -9 <PID>

# Restart
pnpm dev
```

#### Tests Failing After Changes
```bash
# Clear test cache
pnpm test --clearCache

# Run specific test file
pnpm --filter=@ltip/web test src/lib/__tests__/api.test.ts

# Run tests in watch mode
pnpm --filter=@ltip/web test --watch
```

#### TypeScript Errors
```bash
# Full type check across all packages
pnpm typecheck

# Check specific package
pnpm --filter=@ltip/api typecheck

# Restart TypeScript server in your editor
# VSCode: Cmd+Shift+P > "TypeScript: Restart TS Server"
```

#### Build Failures
```bash
# Clean build artifacts
pnpm clean  # (if script exists)
rm -rf apps/*/dist packages/*/dist

# Reinstall dependencies
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install

# Rebuild
pnpm build
```

---

## Testing Guidelines

### Unit Tests

**Test file naming**: `<module-name>.test.ts`

**Example**:
```typescript
// apps/api/src/utils/__tests__/type-guards.test.ts
import { describe, it, expect } from 'vitest';
import { isPositiveInteger, hasSession } from '../type-guards';

describe('type-guards', () => {
  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
    });

    it('should return false for non-positive integers', () => {
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
    });

    it('should return false for non-integers', () => {
      expect(isPositiveInteger(1.5)).toBe(false);
      expect(isPositiveInteger('1')).toBe(false);
      expect(isPositiveInteger(null)).toBe(false);
    });
  });
});
```

### Component Tests

```typescript
// apps/web/src/components/__tests__/BillFilters.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BillFilters } from '../BillFilters';

describe('BillFilters', () => {
  it('should render search input', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <BillFilters
        filters={{}}
        onChange={onChange}
        onClear={onClear}
      />
    );

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('should show validation error for invalid search length', async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <BillFilters
        filters={{}}
        onChange={onChange}
        onClear={onClear}
      />
    );

    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'a'.repeat(501) } });
    fireEvent.blur(input);

    expect(await screen.findByRole('alert')).toHaveTextContent(/too long/i);
  });
});
```

---

## Security Best Practices

### Input Validation

**Always validate external input**:
- API request parameters
- User form inputs
- Environment variables
- Database query results

**Use Zod for runtime validation**:
```typescript
const schema = z.object({
  id: z.string().regex(/^[A-Z]+-\d+-[a-z]+\d+$/),
  limit: z.number().int().min(1).max(100),
});

const validated = schema.parse(input); // Throws on invalid
// OR
const result = schema.safeParse(input); // Returns { success, data, error }
```

### Authentication & Authorization

**Check authentication on protected routes**:
```typescript
router.get('/api/protected', authenticate, async (req, res) => {
  // req.user is guaranteed to exist after authenticate middleware
});
```

**Check authorization for resource access**:
```typescript
if (!canAccessResource(req.user, resourceId)) {
  throw ApiError.forbidden('Access denied');
}
```

### Secrets Management

**Never commit secrets**:
- ❌ Hardcoded API keys
- ❌ Database passwords
- ❌ JWT secrets
- ❌ OAuth client secrets

**Use environment variables**:
```bash
# .env.local (gitignored)
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=your-secret-key
```

---

## Performance Optimization

### Database Queries

**Use indexes for frequently queried fields**:
```sql
CREATE INDEX idx_bills_chamber ON bills(chamber);
CREATE INDEX idx_bills_status ON bills(status);
```

**Avoid N+1 queries**:
```typescript
// ❌ Bad - N+1 queries
const bills = await Bill.findAll();
for (const bill of bills) {
  bill.votes = await Vote.findAll({ where: { billId: bill.id } });
}

// ✅ Good - Single query with join
const bills = await Bill.findAll({
  include: [{ model: Vote }]
});
```

### Frontend Performance

**Code splitting**:
```typescript
// apps/web/src/app/bills/[id]/page.tsx
import dynamic from 'next/dynamic';

const BillDetail = dynamic(() => import('@/components/BillDetail'), {
  loading: () => <BillDetailSkeleton />,
});
```

**Memoization (only when measured)**:
```typescript
// Only memoize expensive computations
const sortedBills = useMemo(() => {
  return bills.sort((a, b) => a.title.localeCompare(b.title));
}, [bills]);

// Don't memoize cheap operations
const count = bills.length; // No useMemo needed
```

---

## Resources

- [Project Repository](https://github.com/ekstanley/LTI)
- [GitHub Issues](https://github.com/ekstanley/LTI/issues)
- [Change Control Process](docs/change-control/CHANGE-CONTROL.md)
- [Multi-Agent Workflow](.claude/Agents.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [Zod Documentation](https://zod.dev)
- [Vitest Documentation](https://vitest.dev)

---

**Note**: This guide is a living document. Update it as the project evolves and new patterns emerge.
