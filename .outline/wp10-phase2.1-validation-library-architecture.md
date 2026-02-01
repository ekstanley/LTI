# Phase 2.1: Shared Validation Library Architecture Design

**Work Package**: WP10 Security Hardening Remediation
**Phase**: 2.1 - Architecture Design
**Date**: 2026-01-31
**Status**: Design Complete - Ready for Implementation
**Estimated Implementation Time**: 6-8 hours (Phases 2.2-2.4)

---

## Executive Summary

This document provides a comprehensive architecture design for the `@ltip/shared/validation` package that will serve as the single source of truth for route parameter validation across the LTIP system. The design addresses two critical security vulnerabilities:

- **GAP-1: Validation Bypass** (CVSS 7.5 HIGH) - API layer lacks validation
- **GAP-2: ReDoS Vulnerability** (CVSS 5.3 MEDIUM) - No length guards before regex processing

### Design Philosophy

**Defense-in-Depth**: Validation occurs at multiple layers (frontend → API → backend)
**Single Source of Truth**: All validation logic centralized in shared package
**Type Safety First**: TypeScript types enforce correctness at compile time
**Performance Critical**: <1ms per validation, zero runtime dependencies
**Security by Default**: Length guards prevent ReDoS, format validation prevents injection

---

## Table of Contents

1. [Package Structure](#1-package-structure)
2. [API Specifications](#2-api-specifications)
3. [Security Architecture](#3-security-architecture)
4. [Integration Patterns](#4-integration-patterns)
5. [Architecture Diagrams](#5-architecture-diagrams)
6. [Implementation Specifications](#6-implementation-specifications)
7. [Migration Strategy](#7-migration-strategy)
8. [Performance Requirements](#8-performance-requirements)
9. [Testing Strategy](#9-testing-strategy)
10. [Acceptance Criteria](#10-acceptance-criteria)

---

## 1. Package Structure

### 1.1 Directory Layout

```
packages/shared/
├── src/
│   ├── validation/
│   │   ├── index.ts              # Public API exports
│   │   ├── bills.ts              # Bill ID validation
│   │   ├── legislators.ts        # Legislator ID validation
│   │   ├── types.ts              # Shared validation types
│   │   └── __tests__/            # Unit tests (Phase 3)
│   │       ├── bills.test.ts
│   │       └── legislators.test.ts
│   ├── types/                     # Existing shared types
│   │   └── index.ts
│   ├── utils/                     # Existing shared utilities
│   │   └── index.ts
│   ├── constants/                 # Existing constants
│   │   └── index.ts
│   └── index.ts                   # Root exports
├── package.json
├── tsconfig.json
└── README.md
```

### 1.2 Package Exports Configuration

**package.json updates**:
```json
{
  "name": "@ltip/shared",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./validation": {
      "types": "./dist/validation/index.d.ts",
      "import": "./dist/validation/index.js"
    },
    "./types": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/types/index.js"
    }
  }
}
```

**Rationale**:
- Subpath exports allow consumers to import only what they need
- `@ltip/shared/validation` provides clear namespace separation
- Tree-shaking optimized for minimal bundle size

### 1.3 File Responsibilities

| File | Purpose | Exports |
|------|---------|---------|
| `validation/index.ts` | Public API surface | All validators, types, constants |
| `validation/bills.ts` | Bill ID validation logic | Bill validators, constants, types |
| `validation/legislators.ts` | Legislator validation logic | Legislator validators, constants, types |
| `validation/types.ts` | Shared validation types | ValidationResult, ErrorCode types |

---

## 2. API Specifications

### 2.1 Core Types

**validation/types.ts**:
```typescript
/**
 * Result of a validation operation with detailed feedback
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;

  /** Error message if validation failed */
  error?: string;

  /** Error code for programmatic handling */
  code?: ValidationErrorCode;

  /** Additional context about the failure */
  context?: {
    received?: unknown;
    expected?: string;
    constraint?: string;
  };
}

/**
 * Standard validation error codes
 */
export enum ValidationErrorCode {
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_LENGTH = 'INVALID_LENGTH',
  INVALID_FORMAT = 'INVALID_FORMAT',
  EMPTY_VALUE = 'EMPTY_VALUE',
}

/**
 * Type guard for ValidationResult
 */
export function isValidationResult(value: unknown): value is ValidationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'valid' in value &&
    typeof (value as ValidationResult).valid === 'boolean'
  );
}
```

### 2.2 Bill Validation API

**validation/bills.ts**:
```typescript
/**
 * Maximum length for bill IDs (3x safety margin over realistic max of ~16 chars)
 *
 * Rationale:
 * - Longest realistic bill ID: "hjres-9999-999" = 16 chars
 * - 50 chars provides 3x safety margin
 * - Prevents ReDoS by limiting regex input size
 */
export const BILL_ID_MAX_LENGTH = 50;

/**
 * Bill ID format pattern
 *
 * Format: billType-billNumber-congressNumber
 * Examples: hr-1234-118, s-567-119, hjres-45-118
 *
 * Pattern breakdown:
 * - ^[a-z]+: Bill type (hr, s, hjres, sjres, etc.) - lowercase only
 * - (-[0-9]+){2}: Two groups of hyphen followed by digits
 * - $: End of string (prevents partial matches)
 */
export const BILL_ID_PATTERN = /^[a-z]+(-[0-9]+){2}$/;

/**
 * Quick boolean check for bill ID validity
 *
 * Use this when you only need to know if an ID is valid/invalid
 * and don't need detailed error feedback.
 *
 * @param id - Value to validate
 * @returns true if valid bill ID, false otherwise
 *
 * @example
 * ```typescript
 * if (!isValidBillId(params.id)) {
 *   notFound(); // Next.js 404
 * }
 * ```
 */
export function isValidBillId(id: unknown): boolean {
  // Defense Layer 1: Type guard
  if (typeof id !== 'string') {
    return false;
  }

  // Defense Layer 2: Length guard (prevents ReDoS)
  if (id.length === 0 || id.length > BILL_ID_MAX_LENGTH) {
    return false;
  }

  // Defense Layer 3: Format validation
  return BILL_ID_PATTERN.test(id);
}

/**
 * Detailed validation with error feedback
 *
 * Use this when you need to provide specific error messages
 * to users or for debugging purposes.
 *
 * @param id - Value to validate
 * @returns ValidationResult with detailed error information
 *
 * @example
 * ```typescript
 * const result = validateBillId(req.params.id);
 * if (!result.valid) {
 *   res.status(400).json({ error: result.error });
 *   return;
 * }
 * ```
 */
export function validateBillId(id: unknown): ValidationResult {
  // Type guard
  if (typeof id !== 'string') {
    return {
      valid: false,
      error: 'Bill ID must be a string',
      code: ValidationErrorCode.INVALID_TYPE,
      context: {
        received: typeof id,
        expected: 'string',
      },
    };
  }

  // Empty check
  if (id.length === 0) {
    return {
      valid: false,
      error: 'Bill ID cannot be empty',
      code: ValidationErrorCode.EMPTY_VALUE,
    };
  }

  // Length guard
  if (id.length > BILL_ID_MAX_LENGTH) {
    return {
      valid: false,
      error: `Bill ID exceeds maximum length of ${BILL_ID_MAX_LENGTH} characters`,
      code: ValidationErrorCode.INVALID_LENGTH,
      context: {
        received: id.length,
        constraint: `max ${BILL_ID_MAX_LENGTH}`,
      },
    };
  }

  // Format validation
  if (!BILL_ID_PATTERN.test(id)) {
    return {
      valid: false,
      error: 'Bill ID format must be: billType-billNumber-congressNumber (e.g., hr-1234-118)',
      code: ValidationErrorCode.INVALID_FORMAT,
      context: {
        received: id,
        expected: 'billType-billNumber-congressNumber',
      },
    };
  }

  return { valid: true };
}

/**
 * Type guard to assert value is a valid bill ID
 *
 * @param id - Value to check
 * @returns true if id is a valid bill ID string
 */
export function isBillId(id: unknown): id is string {
  return isValidBillId(id);
}
```

### 2.3 Legislator Validation API

**validation/legislators.ts**:
```typescript
/**
 * Maximum length for legislator IDs (3x safety margin over exact 7 chars)
 *
 * Rationale:
 * - Bioguide IDs are exactly 7 characters
 * - 20 chars provides ~3x safety margin
 * - Prevents ReDoS by limiting regex input size
 */
export const LEGISLATOR_ID_MAX_LENGTH = 20;

/**
 * Legislator ID format pattern (Bioguide ID)
 *
 * Format: One uppercase letter + 6 digits
 * Examples: A000360, S001198, M001111
 *
 * Pattern breakdown:
 * - ^[A-Z]: Starts with uppercase letter
 * - [0-9]{6}: Exactly 6 digits
 * - $: End of string
 */
export const LEGISLATOR_ID_PATTERN = /^[A-Z][0-9]{6}$/;

/**
 * Quick boolean check for legislator ID validity
 *
 * @param id - Value to validate
 * @returns true if valid legislator ID, false otherwise
 *
 * @example
 * ```typescript
 * if (!isValidLegislatorId(params.id)) {
 *   notFound(); // Next.js 404
 * }
 * ```
 */
export function isValidLegislatorId(id: unknown): boolean {
  // Defense Layer 1: Type guard
  if (typeof id !== 'string') {
    return false;
  }

  // Defense Layer 2: Length guard (prevents ReDoS)
  if (id.length === 0 || id.length > LEGISLATOR_ID_MAX_LENGTH) {
    return false;
  }

  // Defense Layer 3: Format validation
  return LEGISLATOR_ID_PATTERN.test(id);
}

/**
 * Detailed validation with error feedback
 *
 * @param id - Value to validate
 * @returns ValidationResult with detailed error information
 *
 * @example
 * ```typescript
 * const result = validateLegislatorId(req.params.id);
 * if (!result.valid) {
 *   res.status(400).json({ error: result.error });
 *   return;
 * }
 * ```
 */
export function validateLegislatorId(id: unknown): ValidationResult {
  // Type guard
  if (typeof id !== 'string') {
    return {
      valid: false,
      error: 'Legislator ID must be a string',
      code: ValidationErrorCode.INVALID_TYPE,
      context: {
        received: typeof id,
        expected: 'string',
      },
    };
  }

  // Empty check
  if (id.length === 0) {
    return {
      valid: false,
      error: 'Legislator ID cannot be empty',
      code: ValidationErrorCode.EMPTY_VALUE,
    };
  }

  // Length guard
  if (id.length > LEGISLATOR_ID_MAX_LENGTH) {
    return {
      valid: false,
      error: `Legislator ID exceeds maximum length of ${LEGISLATOR_ID_MAX_LENGTH} characters`,
      code: ValidationErrorCode.INVALID_LENGTH,
      context: {
        received: id.length,
        constraint: `max ${LEGISLATOR_ID_MAX_LENGTH}`,
      },
    };
  }

  // Format validation
  if (!LEGISLATOR_ID_PATTERN.test(id)) {
    return {
      valid: false,
      error: 'Legislator ID format must be: uppercase letter + 6 digits (e.g., A000360)',
      code: ValidationErrorCode.INVALID_FORMAT,
      context: {
        received: id,
        expected: '[A-Z][0-9]{6}',
      },
    };
  }

  return { valid: true };
}

/**
 * Type guard to assert value is a valid legislator ID
 *
 * @param id - Value to check
 * @returns true if id is a valid legislator ID string
 */
export function isLegislatorId(id: unknown): id is string {
  return isValidLegislatorId(id);
}
```

### 2.4 Public API (validation/index.ts)

```typescript
/**
 * @ltip/shared/validation
 *
 * Centralized validation library for LTIP route parameters.
 * Provides defense-in-depth validation with type safety.
 *
 * @module @ltip/shared/validation
 */

// Types
export type { ValidationResult } from './types.js';
export { ValidationErrorCode, isValidationResult } from './types.js';

// Bill validation
export {
  isValidBillId,
  validateBillId,
  isBillId,
  BILL_ID_MAX_LENGTH,
  BILL_ID_PATTERN,
} from './bills.js';

// Legislator validation
export {
  isValidLegislatorId,
  validateLegislatorId,
  isLegislatorId,
  LEGISLATOR_ID_MAX_LENGTH,
  LEGISLATOR_ID_PATTERN,
} from './legislators.js';
```

---

## 3. Security Architecture

### 3.1 Defense-in-Depth Layers

The validation system implements four layers of defense:

**Layer 1: Type Guard** (Prevents type confusion attacks)
```typescript
if (typeof id !== 'string') return false;
```
- **Purpose**: Ensure input is a string before processing
- **Prevents**: Type coercion attacks, object prototype pollution
- **Example Attack**: `{ toString: () => '../../../etc/passwd' }`

**Layer 2: Length Guard** (Prevents ReDoS - GAP-2 Mitigation)
```typescript
if (id.length === 0 || id.length > MAX_LENGTH) return false;
```
- **Purpose**: Limit regex processing to reasonable input sizes
- **Prevents**: Regular Expression Denial of Service (ReDoS)
- **Performance**: O(1) check before O(n) regex
- **Example Attack**: `'a'.repeat(100000) + '-1-118'`

**Layer 3: Format Validation** (Prevents injection - GAP-1 Mitigation)
```typescript
return PATTERN.test(id);
```
- **Purpose**: Ensure input matches expected format
- **Prevents**: Path traversal, SQL injection, command injection
- **Strict Matching**: Anchored patterns (^ and $) prevent partial matches
- **Example Attack**: `'../../etc/passwd'`, `'hr-1; DROP TABLE bills;'`

**Layer 4: Parameterized Queries** (Final protection at database)
```typescript
db.query('SELECT * FROM bills WHERE bill_id = $1', [id]);
```
- **Purpose**: Prevent SQL injection even if validation bypassed
- **Defense**: Never concatenate user input into SQL
- **Requirement**: All database queries MUST use parameterized statements

### 3.2 ReDoS Mitigation Strategy (GAP-2)

**Vulnerability Analysis**:
```typescript
// VULNERABLE CODE (current):
function isValidBillId(id: string): boolean {
  return /^[a-z]+(-[0-9]+){2}$/.test(id);  // No length check!
}

// Attack vector:
const malicious = 'a'.repeat(100000) + '-1-118';
isValidBillId(malicious);  // Processes 100KB+ string, high CPU usage
```

**Mitigation Implementation**:
```typescript
// SECURE CODE (new):
function isValidBillId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  if (id.length === 0 || id.length > BILL_ID_MAX_LENGTH) return false;  // ✅ Length guard
  return /^[a-z]+(-[0-9]+){2}$/.test(id);
}

// Attack blocked:
const malicious = 'a'.repeat(100000) + '-1-118';
isValidBillId(malicious);  // Returns false immediately (length > 50)
```

**Performance Characteristics**:
- Type guard: O(1) - instant
- Length check: O(1) - instant
- Regex validation: O(n) where n ≤ 50 (bounded)
- **Total worst case**: O(50) = O(1) effective

### 3.3 Validation Bypass Prevention (GAP-1)

**Current Vulnerability**:
```
Frontend Route:   ✅ Validates with /^[a-z]+(-[0-9]+){2}$/
API Endpoint:     ❌ Uses different pattern /^[a-zA-Z0-9_-]+$/
Backend Service:  ❌ No validation, trusts input
```

**Attack Scenario**:
```bash
# Frontend blocks this:
curl http://localhost:3000/bills/../../etc/passwd
# → 404 (blocked by route validation) ✅

# Direct API call has weaker validation:
curl http://localhost:4000/api/v1/bills/../../etc/passwd
# → May succeed if API pattern allows it ❌
```

**Solution - Shared Validation**:
```
Frontend Route:   ✅ import { isValidBillId } from '@ltip/shared/validation'
API Middleware:   ✅ import { isValidBillId } from '@ltip/shared/validation'
Backend Service:  ✅ import { isValidBillId } from '@ltip/shared/validation'
                     ↑ Same function, same pattern, consistent defense
```

### 3.4 Security Test Cases

**Edge Cases to Test** (Phase 3):

**Bill IDs**:
- ✅ Valid: `'hr-1234-118'`, `'s-567-119'`, `'hjres-45-118'`
- ❌ Empty: `''`
- ❌ Null/undefined: `null`, `undefined`
- ❌ Wrong type: `123`, `{}`, `[]`
- ❌ Too long: `'a'.repeat(100) + '-1-118'`
- ❌ Wrong format: `'HR-1234-118'` (uppercase)
- ❌ Path traversal: `'../../etc/passwd'`
- ❌ SQL injection: `'hr-1; DROP TABLE bills;'`
- ❌ Partial match: `'hr-1234-118; echo pwned'`

**Legislator IDs**:
- ✅ Valid: `'A000360'`, `'S001198'`, `'M001111'`
- ❌ Empty: `''`
- ❌ Null/undefined: `null`, `undefined`
- ❌ Wrong type: `123`, `{}`, `[]`
- ❌ Too long: `'A' + '0'.repeat(100)`
- ❌ Wrong format: `'a000360'` (lowercase), `'ABC1234'` (too many chars)
- ❌ Path traversal: `'../../etc/passwd'`
- ❌ SQL injection: `'A000360; DROP TABLE legislators;'`

---

## 4. Integration Patterns

### 4.1 Frontend Integration (Next.js Routes)

**Import Pattern**:
```typescript
// apps/web/src/app/bills/[id]/page.tsx
import { isValidBillId } from '@ltip/shared/validation';
```

**Usage in Page Component**:
```typescript
export default async function BillDetailPage({ params }: Props) {
  const { id } = await params;

  // Use shared validation (replaces inline function)
  if (!isValidBillId(id)) {
    notFound(); // Next.js 404
  }

  return <BillDetailClient billId={id} />;
}
```

**Usage in Metadata Generation**:
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // Use shared validation
  if (!isValidBillId(id)) {
    return {
      title: 'Bill Not Found | LTIP',
      description: 'The requested bill could not be found',
    };
  }

  return {
    title: `Bill ${id} | LTIP`,
    description: `Analysis and details for bill ${id}`,
  };
}
```

### 4.2 API Middleware Integration (Express)

**Create Validation Middleware**:
```typescript
// apps/api/src/middleware/routeValidation.ts
import type { Request, Response, NextFunction } from 'express';
import { isValidBillId, isValidLegislatorId, validateBillId, validateLegislatorId } from '@ltip/shared/validation';

/**
 * Middleware to validate bill ID route parameter
 *
 * Usage:
 * ```typescript
 * router.get('/bills/:id', validateBillIdParam, async (req, res) => {
 *   // req.params.id is guaranteed to be valid here
 * });
 * ```
 */
export function validateBillIdParam(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { id } = req.params;

  // Use rich validation for detailed error feedback
  const result = validateBillId(id);

  if (!result.valid) {
    res.status(400).json({
      error: result.error,
      code: result.code,
      details: result.context,
    });
    return;
  }

  next();
}

/**
 * Middleware to validate legislator ID route parameter
 *
 * Usage:
 * ```typescript
 * router.get('/legislators/:id', validateLegislatorIdParam, async (req, res) => {
 *   // req.params.id is guaranteed to be valid here
 * });
 * ```
 */
export function validateLegislatorIdParam(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { id } = req.params;

  const result = validateLegislatorId(id);

  if (!result.valid) {
    res.status(400).json({
      error: result.error,
      code: result.code,
      details: result.context,
    });
    return;
  }

  next();
}
```

**Apply to Routes**:
```typescript
// apps/api/src/routes/bills.ts
import { validateBillIdParam } from '../middleware/routeValidation.js';

// Before (uses Zod schema):
billsRouter.get('/:id', validate(getBillSchema, 'params'), async (req, res, next) => {
  // ...
});

// After (uses shared validation):
billsRouter.get('/:id', validateBillIdParam, async (req, res, next) => {
  const { id } = req.params; // Type-safe, guaranteed valid
  // ...
});
```

### 4.3 Backend Service Integration

**Import and Use**:
```typescript
// apps/api/src/services/bills.service.ts
import { isValidBillId } from '@ltip/shared/validation';

export class BillService {
  async getById(id: string): Promise<Bill | null> {
    // Defense-in-depth: validate even if middleware checked
    if (!isValidBillId(id)) {
      throw new Error('Invalid bill ID');
    }

    // Parameterized query (final protection layer)
    return this.repository.findById(id);
  }
}
```

### 4.4 Error Response Standardization

**Frontend (Next.js)**:
```typescript
if (!isValidBillId(id)) {
  notFound(); // Returns 404 page
}
```

**API (Express)**:
```json
{
  "error": "Bill ID format must be: billType-billNumber-congressNumber (e.g., hr-1234-118)",
  "code": "INVALID_FORMAT",
  "details": {
    "received": "HR-1234-118",
    "expected": "billType-billNumber-congressNumber"
  }
}
```

**HTTP Status Codes**:
- `400 Bad Request`: Invalid format, wrong type
- `404 Not Found`: Valid format but resource doesn't exist (frontend only)

---

## 5. Architecture Diagrams

### 5.1 Defense-in-Depth Architecture

```nomnoml
#title: Defense-in-Depth Validation Architecture
#direction: down
#arrowSize: 0.8
#lineWidth: 2
#fontSize: 14
#leading: 1.5

[<actor>Client Request]

[<frame>Layer 1: Frontend Route Validation|
  [<package>@ltip/shared/validation|
    isValidBillId()
    isValidLegislatorId()
  ]
  [<note>Defense: Block invalid IDs early
  Status: 404 Not Found
  Performance: <1ms]
]

[<frame>Layer 2: API Middleware Validation|
  [<package>@ltip/shared/validation|
    validateBillIdParam()
    validateLegislatorIdParam()
  ]
  [<note>Defense: Catch direct API calls
  Status: 400 Bad Request
  Performance: <1ms]
]

[<frame>Layer 3: Backend Service Validation|
  [<package>@ltip/shared/validation|
    isValidBillId()
    isValidLegislatorId()
  ]
  [<note>Defense: Final check before DB
  Throws: Error if invalid
  Performance: <1ms]
]

[<frame>Layer 4: Database Protection|
  [<database>PostgreSQL|
    Parameterized Queries ONLY
    No String Concatenation
  ]
  [<note>Defense: Prevent SQL injection
  Even if validation bypassed
  All queries use $1, $2, etc.]
]

[Client Request] -> [Layer 1: Frontend Route Validation]
[Layer 1: Frontend Route Validation] -> [Layer 2: API Middleware Validation]
[Layer 2: API Middleware Validation] -> [Layer 3: Backend Service Validation]
[Layer 3: Backend Service Validation] -> [Layer 4: Database Protection]

[<note>✅ ALL LAYERS USE SAME VALIDATION LOGIC
Single source of truth: @ltip/shared/validation
Consistent patterns across all layers
No validation bypass possible]
```

### 5.2 Data Flow Diagram

```nomnoml
#title: Request Validation Flow
#direction: down
#arrowSize: 0.8
#lineWidth: 2

[<actor>User Browser] - /bills/hr-1234-118 -> [<usecase>Next.js Frontend]

[<usecase>Next.js Frontend|
  [<state>params.id = "hr-1234-118"]
  [isValidBillId(id)?]
]

[<choice>Valid?]
[<usecase>Next.js Frontend] -> [Valid?]

[Valid?] invalid -> [<end>404 Page|
  notFound()
]

[Valid?] valid -> [<usecase>Render Page|
  <BillDetailClient billId={id} />
]

[<note>------- Direct API Call -------]

[<actor>API Client] - GET /api/v1/bills/hr-1234-118 -> [<usecase>Express API]

[<usecase>Express API|
  [<state>req.params.id = "hr-1234-118"]
  [validateBillIdParam middleware]
]

[<choice>Valid at API?]
[Express API] -> [Valid at API?]

[Valid at API?] invalid -> [<end>400 Bad Request|
  {
    "error": "Invalid format",
    "code": "INVALID_FORMAT"
  }
]

[Valid at API?] valid -> [<usecase>Bill Service|
  isValidBillId(id)?
  (defense-in-depth)
]

[<choice>Valid at Service?]
[Bill Service] -> [Valid at Service?]

[Valid at Service?] invalid -> [<end>500 Error|
  throw new Error()
]

[Valid at Service?] valid -> [<database>Database|
  SELECT * FROM bills
  WHERE bill_id = $1
]

[Database] -> [<end>200 OK Response|
  { "data": { bill data } }
]

[<note>All validation uses same shared library:
@ltip/shared/validation
Consistent behavior everywhere]
```

### 5.3 Package Dependency Diagram

```nomnoml
#title: Package Dependencies
#direction: right
#arrowSize: 1.0
#lineWidth: 2
#fontSize: 14

[<package>@ltip/shared|
  [<module>validation/|
    bills.ts
    legislators.ts
    types.ts
    index.ts
  ]
  [<module>types/|
    index.ts
  ]
  [<module>utils/|
    index.ts
  ]
]

[<package>apps/web|
  [<module>app/bills/[id]/page.tsx|
    import { isValidBillId }
    from '@ltip/shared/validation'
  ]
  [<module>app/legislators/[id]/page.tsx|
    import { isValidLegislatorId }
    from '@ltip/shared/validation'
  ]
]

[<package>apps/api|
  [<module>middleware/routeValidation.ts|
    import { validateBillId, validateLegislatorId }
    from '@ltip/shared/validation'
  ]
  [<module>routes/bills.ts|
    import { validateBillIdParam }
    from './middleware/routeValidation'
  ]
  [<module>routes/legislators.ts|
    import { validateLegislatorIdParam }
    from './middleware/routeValidation'
  ]
  [<module>services/bills.service.ts|
    import { isValidBillId }
    from '@ltip/shared/validation'
  ]
]

[@ltip/shared] <-- [apps/web]
[@ltip/shared] <-- [apps/api]

[<note>✅ No circular dependencies
✅ Single direction: apps → shared
✅ Shared package has ZERO dependencies
✅ Tree-shakeable exports]
```

### 5.4 Validation Sequence Diagram

```nomnoml
#title: Validation Sequence (ReDoS Prevention)
#direction: down
#arrowSize: 0.8

[<actor>Caller] -> [<usecase>isValidBillId(id)]

[<usecase>isValidBillId(id)|
  [<state>Step 1: Type Guard]
  [typeof id !== 'string'?]
  [<choice>Is string?]

  [Is string?] no -> [<end>return false|
    ⏱️ <0.001ms
    🛡️ Prevents type confusion
  ]

  [Is string?] yes -> [<state>Step 2: Length Guard]

  [<state>Step 2: Length Guard]
  [id.length === 0 || id.length > 50?]
  [<choice>Length OK?]

  [Length OK?] no -> [<end>return false|
    ⏱️ <0.001ms
    🛡️ Prevents ReDoS (GAP-2)
    🛡️ Blocks: 'a'.repeat(100000)
  ]

  [Length OK?] yes -> [<state>Step 3: Format Check]

  [<state>Step 3: Format Check]
  [PATTERN.test(id)]
  [<choice>Format matches?]

  [Format matches?] no -> [<end>return false|
    ⏱️ <1ms (max 50 chars)
    🛡️ Prevents injection (GAP-1)
    🛡️ Blocks: '../../etc/passwd'
  ]

  [Format matches?] yes -> [<end>return true|
    ⏱️ Total: <1ms
    ✅ All defenses passed
  ]
]

[<note>Performance Characteristics:
Type guard: O(1) - instant
Length check: O(1) - instant
Regex: O(n) where n ≤ 50
Total worst case: O(1) effective

Security: 3-layer defense
1. Type guard
2. Length guard (ReDoS)
3. Format validation (Injection)]
```

---

## 6. Implementation Specifications

### 6.1 Bills Validation Specification

**Constants**:
```typescript
BILL_ID_MAX_LENGTH = 50
BILL_ID_PATTERN = /^[a-z]+(-[0-9]+){2}$/
```

**Rationale**:
- **Max Length 50**: Longest realistic bill ID is ~16 chars (`"hjres-9999-999"`), 50 provides 3x safety margin
- **Pattern**: Matches Congress.gov format exactly
  - `^[a-z]+`: Bill type (hr, s, hjres, sjres, hconres, sconres, hres, sres) - lowercase only
  - `(-[0-9]+){2}`: Two groups of hyphen + digits (bill number, congress number)
  - `$`: Anchored end (prevents partial matches)

**Valid Examples**:
```typescript
'hr-1234-118'      // House Resolution
's-567-119'        // Senate Bill
'hjres-45-118'     // House Joint Resolution
'sjres-12-117'     // Senate Joint Resolution
'hconres-99-118'   // House Concurrent Resolution
'sconres-88-119'   // Senate Concurrent Resolution
'hres-777-118'     // House Simple Resolution
'sres-666-119'     // Senate Simple Resolution
```

**Invalid Examples**:
```typescript
''                          // Empty
'HR-1234-118'              // Uppercase (strict lowercase)
'hr-1234'                  // Missing congress number
'hr-1234-118-extra'        // Extra components
'../../etc/passwd'         // Path traversal
'hr-1; DROP TABLE bills;'  // SQL injection attempt
'a'.repeat(100) + '-1-118' // ReDoS attempt
123                         // Wrong type
null                        // Null
undefined                   // Undefined
```

**Edge Cases**:
1. **Empty string**: Rejected by length guard (length === 0)
2. **Single hyphen**: Rejected by pattern (requires two hyphen groups)
3. **Trailing hyphen**: `'hr-1234-118-'` rejected by pattern ($ anchor)
4. **Leading hyphen**: `'-hr-1234-118'` rejected by pattern (^ anchor)
5. **Mixed case**: `'Hr-1234-118'` rejected by pattern (lowercase only)
6. **Special characters**: `'hr@1234-118'` rejected by pattern (alphanumeric only)
7. **Unicode**: `'hr-١٢٣٤-118'` rejected by pattern ([0-9] ASCII only)
8. **Whitespace**: `'hr-1234-118 '` rejected by pattern ($ anchor)

**Performance**:
- Type guard: O(1) - instant
- Length check: O(1) - instant
- Regex: O(n) where n ≤ 50, effectively O(1)
- **Total**: <1ms guaranteed

### 6.2 Legislators Validation Specification

**Constants**:
```typescript
LEGISLATOR_ID_MAX_LENGTH = 20
LEGISLATOR_ID_PATTERN = /^[A-Z][0-9]{6}$/
```

**Rationale**:
- **Max Length 20**: Bioguide IDs are exactly 7 characters, 20 provides ~3x safety margin
- **Pattern**: Matches Bioguide ID format exactly
  - `^[A-Z]`: Starts with single uppercase letter (last name initial)
  - `[0-9]{6}`: Exactly 6 digits
  - `$`: Anchored end (no extra characters)

**Valid Examples**:
```typescript
'A000360'  // Lamar Alexander
'S001198'  // Dan Sullivan
'M001111'  // Jeff Merkley
'C000127'  // Maria Cantwell
'W000779'  // Ron Wyden
```

**Invalid Examples**:
```typescript
''                          // Empty
'a000360'                  // Lowercase (strict uppercase)
'A00036'                   // Too short (5 digits)
'A0003600'                 // Too long (7 digits)
'AA000360'                 // Two letters
'A000360B'                 // Letter at end
'../../etc/passwd'         // Path traversal
'A000360; DROP TABLE;'     // SQL injection attempt
'A' + '0'.repeat(100)      // ReDoS attempt
123                         // Wrong type
null                        // Null
undefined                   // Undefined
```

**Edge Cases**:
1. **Empty string**: Rejected by length guard (length === 0)
2. **Wrong length**: `'A00036'` (6 chars) rejected by pattern ({6} requires exactly 6 digits)
3. **Lowercase**: `'a000360'` rejected by pattern ([A-Z] uppercase only)
4. **Multiple letters**: `'AB00360'` rejected by pattern (single letter)
5. **Special characters**: `'A@00360'` rejected by pattern (alphanumeric only)
6. **Unicode**: `'A٠٠٠٣٦٠'` rejected by pattern ([0-9] ASCII only)
7. **Whitespace**: `'A000360 '` rejected by pattern ($ anchor)
8. **Hyphenated**: `'A-000360'` rejected by pattern (no hyphens)

**Performance**:
- Type guard: O(1) - instant
- Length check: O(1) - instant
- Regex: O(7) for exact match, effectively O(1)
- **Total**: <0.5ms guaranteed

### 6.3 Shared Types Implementation

**Complete types.ts**:
```typescript
/**
 * Validation types shared across all validators
 */

/**
 * Standard validation error codes
 */
export enum ValidationErrorCode {
  /** Value is not the expected type */
  INVALID_TYPE = 'INVALID_TYPE',

  /** Value length is out of acceptable range */
  INVALID_LENGTH = 'INVALID_LENGTH',

  /** Value doesn't match expected format pattern */
  INVALID_FORMAT = 'INVALID_FORMAT',

  /** Value is empty when non-empty required */
  EMPTY_VALUE = 'EMPTY_VALUE',
}

/**
 * Context information for validation failures
 */
export interface ValidationContext {
  /** The value that was received */
  received?: unknown;

  /** What was expected */
  expected?: string;

  /** The constraint that was violated */
  constraint?: string;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Error message if validation failed */
  error?: string;

  /** Error code for programmatic handling */
  code?: ValidationErrorCode;

  /** Additional context about the failure */
  context?: ValidationContext;
}

/**
 * Type guard for ValidationResult
 */
export function isValidationResult(value: unknown): value is ValidationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'valid' in value &&
    typeof (value as ValidationResult).valid === 'boolean'
  );
}
```

---

## 7. Migration Strategy

### 7.1 Migration Phases

**Phase 1: Create Shared Library** (Phase 2.2)
- Create `packages/shared/src/validation/` directory
- Implement `types.ts`, `bills.ts`, `legislators.ts`, `index.ts`
- Update `packages/shared/src/index.ts` to export validation
- Update `packages/shared/package.json` exports
- Build and verify TypeScript compilation
- **Duration**: 2 hours
- **Risk**: Low (additive change)

**Phase 2: Add API Middleware** (Phase 2.3)
- Create `apps/api/src/middleware/routeValidation.ts`
- Implement `validateBillIdParam`, `validateLegislatorIdParam`
- Update bills routes to use new middleware
- Update legislators routes to use new middleware
- **Duration**: 2 hours
- **Risk**: Medium (changes API behavior)
- **Rollback**: Keep old Zod schemas as fallback

**Phase 3: Update Frontend Routes** (Phase 2.4)
- Update `apps/web/src/app/bills/[id]/page.tsx`
- Update `apps/web/src/app/legislators/[id]/page.tsx`
- Remove inline validation functions
- Test all routes manually
- **Duration**: 1 hour
- **Risk**: Low (same validation logic)

**Phase 4: Remove Old Validation** (Phase 2.5 - Future)
- Remove Zod schemas from `apps/api/src/schemas/bills.schema.ts`
- Remove Zod validate middleware from affected routes
- Update tests to use new validation
- **Duration**: 1 hour
- **Risk**: Low (cleanup only)

### 7.2 Backward Compatibility

**During Migration**:
- API routes will have BOTH Zod schema AND new validation
- Frontend will use new validation immediately (drop-in replacement)
- Old schemas remain until all routes migrated

**Breaking Changes**: None
- New validation is stricter (good for security)
- All previously valid IDs remain valid
- Only invalid IDs now get caught earlier

### 7.3 Rollback Strategy

**If Issues Found in Phase 2 (API)**:
```typescript
// Rollback: comment out new middleware, keep Zod
// billsRouter.get('/:id', validateBillIdParam, async (req, res) => {
billsRouter.get('/:id', validate(getBillSchema, 'params'), async (req, res) => {
  // ...
});
```

**If Issues Found in Phase 3 (Frontend)**:
```typescript
// Rollback: restore inline function
function isValidBillId(id: string): boolean {
  return /^[a-z]+(-[0-9]+){2}$/.test(id);
}

// Instead of:
// import { isValidBillId } from '@ltip/shared/validation';
```

### 7.4 Testing During Migration

**Phase 1 (Shared Library)**:
- Unit tests for all validators
- Test all edge cases
- Verify exports work correctly

**Phase 2 (API Middleware)**:
- Manual testing with curl
- Test valid IDs return 200
- Test invalid IDs return 400
- Verify error response format

**Phase 3 (Frontend Routes)**:
- Navigate to valid bill/legislator pages
- Navigate to invalid pages (should 404)
- Test metadata generation
- Verify no console errors

**Acceptance Criteria**:
- All existing functionality works unchanged
- Invalid IDs now blocked at API layer (GAP-1 fixed)
- No ReDoS vulnerabilities (GAP-2 fixed)
- Error messages are helpful and consistent

---

## 8. Performance Requirements

### 8.1 Validation Performance

**Target**: <1ms per validation call

**Measured Performance** (expected):
```
isValidBillId('hr-1234-118'):         ~0.05ms  (type + length + regex)
validateBillId('hr-1234-118'):        ~0.10ms  (type + length + regex + object creation)
isValidLegislatorId('A000360'):       ~0.03ms  (type + length + regex)
validateLegislatorId('A000360'):      ~0.08ms  (type + length + regex + object creation)

Invalid (type guard fail):             ~0.001ms (instant)
Invalid (length guard fail):           ~0.002ms (instant)
Invalid (pattern fail):                ~0.05ms  (regex on valid length)
```

**Complexity Analysis**:
```
Type guard:    O(1) - typeof is constant time
Length check:  O(1) - string.length is constant time
Regex:         O(n) where n ≤ MAX_LENGTH
               - Bills: n ≤ 50, so O(50) = O(1) effective
               - Legislators: n = 7, so O(7) = O(1) effective

Total: O(1) effective for all cases
```

### 8.2 Bundle Size Impact

**Shared Package Size**:
```
validation/types.ts:        ~0.5 KB (compiled)
validation/bills.ts:        ~1.5 KB (compiled)
validation/legislators.ts:  ~1.5 KB (compiled)
validation/index.ts:        ~0.5 KB (compiled)
-------------------------------------------------
Total validation module:    ~4.0 KB (minified)
                           ~1.5 KB (gzipped)
```

**Tree-shaking**:
- Frontend imports only `isValidBillId`, `isValidLegislatorId`
- API imports all validators + middleware helpers
- Backend imports only boolean validators
- **Result**: Each consumer gets minimal bundle

### 8.3 Runtime Dependencies

**Zero Runtime Dependencies**:
- No external packages required
- Pure TypeScript/JavaScript
- Works in Node.js and browser
- No regex library dependencies (uses built-in)

---

## 9. Testing Strategy

### 9.1 Unit Tests (Phase 3)

**Test Files**:
```
packages/shared/src/validation/__tests__/
├── bills.test.ts
├── legislators.test.ts
└── types.test.ts
```

**Bills Test Coverage**:
```typescript
describe('isValidBillId', () => {
  it('accepts valid bill IDs', () => {
    expect(isValidBillId('hr-1234-118')).toBe(true);
    expect(isValidBillId('s-567-119')).toBe(true);
    expect(isValidBillId('hjres-45-118')).toBe(true);
  });

  it('rejects non-string types', () => {
    expect(isValidBillId(123)).toBe(false);
    expect(isValidBillId(null)).toBe(false);
    expect(isValidBillId(undefined)).toBe(false);
    expect(isValidBillId({})).toBe(false);
    expect(isValidBillId([])).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isValidBillId('')).toBe(false);
  });

  it('rejects excessively long strings (ReDoS protection)', () => {
    const long = 'a'.repeat(100) + '-1-118';
    expect(isValidBillId(long)).toBe(false);
  });

  it('rejects wrong format', () => {
    expect(isValidBillId('HR-1234-118')).toBe(false); // uppercase
    expect(isValidBillId('hr-1234')).toBe(false); // missing congress
    expect(isValidBillId('../../etc/passwd')).toBe(false); // path traversal
  });
});

describe('validateBillId', () => {
  it('returns detailed error for invalid type', () => {
    const result = validateBillId(123);
    expect(result.valid).toBe(false);
    expect(result.code).toBe(ValidationErrorCode.INVALID_TYPE);
    expect(result.error).toContain('must be a string');
  });

  it('returns detailed error for invalid length', () => {
    const long = 'a'.repeat(100);
    const result = validateBillId(long);
    expect(result.valid).toBe(false);
    expect(result.code).toBe(ValidationErrorCode.INVALID_LENGTH);
    expect(result.context?.constraint).toBe('max 50');
  });

  it('returns detailed error for invalid format', () => {
    const result = validateBillId('HR-1234-118');
    expect(result.valid).toBe(false);
    expect(result.code).toBe(ValidationErrorCode.INVALID_FORMAT);
    expect(result.error).toContain('billType-billNumber-congressNumber');
  });

  it('returns success for valid ID', () => {
    const result = validateBillId('hr-1234-118');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
```

**Legislators Test Coverage**:
```typescript
describe('isValidLegislatorId', () => {
  it('accepts valid legislator IDs', () => {
    expect(isValidLegislatorId('A000360')).toBe(true);
    expect(isValidLegislatorId('S001198')).toBe(true);
    expect(isValidLegislatorId('M001111')).toBe(true);
  });

  it('rejects non-string types', () => {
    expect(isValidLegislatorId(123)).toBe(false);
    expect(isValidLegislatorId(null)).toBe(false);
    expect(isValidLegislatorId(undefined)).toBe(false);
  });

  it('rejects wrong format', () => {
    expect(isValidLegislatorId('a000360')).toBe(false); // lowercase
    expect(isValidLegislatorId('A00036')).toBe(false); // too short
    expect(isValidLegislatorId('A0003600')).toBe(false); // too long
  });
});
```

**Target Coverage**: 100% line coverage, 100% branch coverage

### 9.2 Integration Tests (Phase 4)

**API Tests**:
```typescript
describe('GET /api/v1/bills/:id', () => {
  it('returns 400 for invalid bill ID', async () => {
    const res = await request(app).get('/api/v1/bills/invalid');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.code).toBe('INVALID_FORMAT');
  });

  it('returns 200 for valid bill ID', async () => {
    const res = await request(app).get('/api/v1/bills/hr-1234-118');
    expect(res.status).toBe(200);
  });
});
```

**Frontend E2E Tests**:
```typescript
describe('Bill Detail Page', () => {
  it('shows 404 for invalid bill ID', async () => {
    await page.goto('/bills/invalid');
    await expect(page.locator('h1')).toContainText('Not Found');
  });

  it('renders for valid bill ID', async () => {
    await page.goto('/bills/hr-1234-118');
    await expect(page.locator('h1')).not.toContainText('Not Found');
  });
});
```

---

## 10. Acceptance Criteria

### 10.1 Design Completion Criteria

- [x] Package structure documented
- [x] API specifications complete with JSDoc
- [x] Security architecture explained with defense layers
- [x] Integration patterns defined for frontend, API, backend
- [x] Architecture diagrams created (defense, data flow, dependencies, sequence)
- [x] Implementation specs complete for bills and legislators
- [x] Migration strategy defined with phases and rollback
- [x] Performance requirements specified
- [x] Testing strategy outlined

### 10.2 Implementation Acceptance (Phases 2.2-2.4)

**Phase 2.2 (Shared Library)**:
- [ ] `packages/shared/src/validation/` directory created
- [ ] All validation files implemented (types.ts, bills.ts, legislators.ts, index.ts)
- [ ] Package exports configured correctly
- [ ] TypeScript builds without errors
- [ ] All functions have JSDoc comments

**Phase 2.3 (API Middleware)**:
- [ ] `apps/api/src/middleware/routeValidation.ts` created
- [ ] Middleware applied to all bill routes
- [ ] Middleware applied to all legislator routes
- [ ] API returns 400 for invalid IDs with detailed error
- [ ] API returns 200 for valid IDs

**Phase 2.4 (Frontend Update)**:
- [ ] Frontend bill routes use shared validation
- [ ] Frontend legislator routes use shared validation
- [ ] Inline validation functions removed
- [ ] Frontend shows 404 for invalid IDs
- [ ] Frontend renders for valid IDs

### 10.3 Security Acceptance

**GAP-1 (Validation Bypass) - RESOLVED**:
- [ ] Frontend validates using shared library
- [ ] API validates using shared library
- [ ] Backend validates using shared library
- [ ] All layers use identical patterns
- [ ] Direct API calls blocked for invalid IDs

**GAP-2 (ReDoS) - RESOLVED**:
- [ ] Length guards present before all regex
- [ ] Max lengths documented with rationale
- [ ] Performance <1ms per validation
- [ ] 100KB+ strings rejected instantly

### 10.4 Quality Acceptance

- [ ] All functions type-safe (no `any` types)
- [ ] All functions have complete JSDoc
- [ ] All edge cases documented
- [ ] Error messages are user-friendly
- [ ] Code follows existing patterns
- [ ] No runtime dependencies added

---

## Appendix A: Quick Reference

### Import Patterns

```typescript
// Frontend (Next.js)
import { isValidBillId, isValidLegislatorId } from '@ltip/shared/validation';

// API Middleware
import { validateBillIdParam, validateLegislatorIdParam } from '../middleware/routeValidation';

// Backend Services
import { isValidBillId } from '@ltip/shared/validation';

// Detailed validation
import { validateBillId, ValidationErrorCode } from '@ltip/shared/validation';
```

### Validation Decision Tree

```
Need validation?
├─ Yes, just boolean check → Use isValidBillId() / isValidLegislatorId()
├─ Yes, need error details → Use validateBillId() / validateLegislatorId()
├─ Type guard needed? → Use isBillId() / isLegislatorId()
└─ Need constants? → Import BILL_ID_MAX_LENGTH, BILL_ID_PATTERN, etc.
```

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "INVALID_TYPE | INVALID_LENGTH | INVALID_FORMAT | EMPTY_VALUE",
  "details": {
    "received": "what was received",
    "expected": "what was expected",
    "constraint": "constraint violated"
  }
}
```

---

## Appendix B: Security Checklist

Pre-implementation review:
- [ ] All validators have type guards
- [ ] All validators have length guards
- [ ] All validators have format validation
- [ ] Regex patterns are anchored (^ and $)
- [ ] Max lengths have documented rationale
- [ ] Performance is O(1) effective
- [ ] No user input reaches database without validation
- [ ] All database queries are parameterized
- [ ] Error messages don't leak sensitive info
- [ ] No validation bypass paths exist

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | ODIN | Initial architecture design |

---

**Status**: ✅ **DESIGN COMPLETE - READY FOR IMPLEMENTATION**

**Next Steps**:
1. Review this design document
2. Approve for implementation
3. Proceed to Phase 2.2 (Create Shared Library)
4. Implement according to specifications in Section 6
