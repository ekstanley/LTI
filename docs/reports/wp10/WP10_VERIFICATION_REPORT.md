# WP10 Security Hardening - Verification Report

**Report Date**: 2026-01-31
**Verification By**: ODIN (Outline Driven INtelligence)
**Status**: ⚠️ **PARTIAL COMPLETION - CRITICAL ISSUES IDENTIFIED**
**Production Deployment**: 🔴 **BLOCKED**

---

## Executive Summary

Comprehensive verification of WP10 Security Hardening deliverables reveals **partial completion** with **critical discrepancies** between claimed status and actual implementation state. While frontend route validation is functioning correctly, the API package contains **130+ TypeScript errors** that directly contradict completion report claims and **block production deployment**.

### Key Findings

✅ **VERIFIED WORKING**:
- Frontend route parameter validation (bills/legislators) ✅
- Git commit 44de38c implemented correctly ✅
- Documentation complete (13 files, 218KB) ✅
- All 3 Change Requests meet ODIN criteria ✅

❌ **CRITICAL FAILURES**:
- **130+ TypeScript errors in @ltip/api package** (contradicts "zero errors" claim)
- **Production deployment BLOCKED** by GAP-1 and GAP-2
- **WP10 acceptance criteria NOT FULLY MET** (monorepo-wide typecheck failed)

⚠️ **BLOCKERS IDENTIFIED**:
- GAP-1: Validation bypass vulnerability (CVSS 7.5 HIGH) - Requires CR-2026-01-31-003
- GAP-2: ReDoS vulnerability (CVSS 5.3 MEDIUM) - Requires CR-2026-01-31-004
- H-1: CSRF token exposed to XSS (CVSS 8.1 HIGH) - Requires backend changes

---

## Verification Methodology

### Verification Workflow
1. ✅ Git commit verification (3 commands executed)
2. ✅ Documentation file verification (Glob + Bash)
3. ✅ TypeScript compilation (monorepo-wide `pnpm typecheck`)
4. ✅ Dev server verification (frontend routes tested)
5. ✅ Screenshot evidence capture (10 screenshots)
6. ✅ ODIN criteria review (all 3 CRs analyzed)
7. ✅ Change Control verification (CHANGE-CONTROL.md analyzed)
8. ✅ Final report creation (this document)

### Evidence-Based Approach
- **NO completion claims without fresh verification evidence**
- **Actual compilation results over documentation claims**
- **Visual screenshot evidence for route validation**
- **Complete ODIN criteria verification for all CRs**

---

## 1. Git Commit Verification ✅

### Commands Executed
```bash
git status
git log --oneline -10
git show --stat 44de38c
```

### Results

**Commit 44de38c - WP10 Security Hardening** ✅
- **Author**: ekstanley <estanley@ekstanleyholdings.com>
- **Date**: Sat Jan 31 17:48:07 2026 -0500
- **Message**: `fix(security): add route parameter validation for bills and legislators`
- **Files Modified**:
  - `apps/web/src/app/bills/[id]/page.tsx` (+27 insertions)
  - `apps/web/src/app/legislators/[id]/page.tsx` (+27 insertions)
- **Total Changes**: 54 insertions, 0 deletions

**Verification Status**: ✅ **PASSED** - Commit exists and modified expected files

---

## 2. Documentation Verification ✅

### WP10 Documentation Files (10 files, 181KB)
- ✅ `WP10_COMPLETION_REPORT.md` (18KB) - **CLAIMS CONTRADICTED** by typecheck
- ✅ `WP10_FINAL_SUMMARY.md` (10KB)
- ✅ `WP10_GAP_ANALYSIS.md` (19KB)
- ✅ `WP10_REMEDIATION_GUIDE.md` (23KB)
- ✅ `WP10_REMEDIATION_PLAN.md` (28KB)
- ✅ `WP10_SECURITY_ARCHITECTURE.md` (9.6KB)
- ✅ `WP10_SECURITY_AUDIT_COMPREHENSIVE.md` (37KB)
- ✅ `WP10_SECURITY_AUDIT_EXECUTIVE_SUMMARY.md` (11KB)
- ✅ `WP10_SECURITY_CHECKLIST.md` (16KB)
- ✅ `WP10_SECURITY_QUICK_REFERENCE.md` (10KB)

### Change Request Documentation (3 files, 37KB)
- ✅ `docs/change-control/2026-01-31-wp10-security-hardening.md` (8KB) - CR-002
- ✅ `docs/change-control/2026-01-31-gap1-validation-bypass.md` (16KB) - CR-003
- ✅ `docs/change-control/2026-01-31-gap2-redos-vulnerability.md` (13KB) - CR-004

**Verification Status**: ✅ **PASSED** - All 13 files exist with substantive content (218KB total)

---

## 3. TypeScript Compilation ❌ CRITICAL FAILURE

### Command Executed
```bash
cd /Users/estanley/Documents/GitHub/LTI
pnpm typecheck
```

### Results

**@ltip/web**: ✅ **PASSED** (0 errors)
**@ltip/shared**: ✅ **PASSED** (0 errors)
**@ltip/api**: ❌ **FAILED** (130+ errors, exit code 2)

### Critical API Package Errors

**Missing Prisma Client Type Exports** (14+ types):
```typescript
// Prisma Client types not found
'PrismaClient' is not exported from '@prisma/client'
'Chamber' is not exported from '@prisma/client'
'VotePosition', 'VoteResult', 'VoteType', 'VoteCategory'
'BillType', 'Party', 'CommitteeType', 'BillStatus'
'TextFormat', 'DataSource', 'DataQuality', 'Prisma'
```

**Implicit 'any' Type Errors** (50+ occurrences):
```typescript
// Throughout service files
Parameter 'c' implicitly has an 'any' type.
Parameter 'tx' implicitly has an 'any' type.
Parameter 'req' implicitly has an 'any' type.
Parameter 'res' implicitly has an 'any' type.
```

**Test File Issues**:
```typescript
// src/middleware/__tests__/validateParams.test.ts
'mockRes' is declared but never used
'mockNext' is declared but never used
'beforeEach' is declared but never used
Argument type not assignable to parameter type
```

**Unknown Type Errors**:
```typescript
// src/services/committee.service.ts
'b' is of type 'unknown'
```

### Gap Analysis

**WP10 Completion Report Claims**:
> "Zero TypeScript errors" ❌ **FALSE**
> "TypeScript Errors: 0" ❌ **FALSE**
> "All tests passing (11/11 manual, 100% rate)" ⚠️ **FRONTEND ONLY**

**Actual Status**:
- Frontend package: ✅ 0 errors (claim accurate for frontend only)
- API package: ❌ 130+ errors (claim false for monorepo)
- WP10 testing only verified frontend, not full monorepo

**Impact**: Production deployment **BLOCKED** by TypeScript compilation failures

**Verification Status**: ❌ **FAILED** - Critical contradiction between claims and reality

---

## 4. Dev Server Verification ✅

### Backend Process Status
```bash
# Background Bash processes running
# - cd apps/web && pnpm dev (frontend on port 3000) ✅
# - API backend NOT running (expected for frontend-only verification)
```

### Frontend Routes Tested
- ✅ `http://localhost:3000` - Homepage loads
- ✅ `http://localhost:3000/bills` - Bills page loads (network error expected, API not running)
- ✅ `http://localhost:3000/legislators` - Legislators page loads (network error expected)
- ✅ `http://localhost:3000/votes` - Votes page loads (network error expected)
- ✅ `http://localhost:3000/bills/hr-1-118` - Valid bill ID loads page structure
- ✅ `http://localhost:3000/bills/invalid-id-test` - **Returns 404** (validation working ✅)
- ✅ `http://localhost:3000/legislators/A000360` - Valid legislator ID loads page structure
- ✅ `http://localhost:3000/legislators/invalid-id-test` - **Returns 404** (validation working ✅)
- ✅ `http://localhost:3000/about` - About page loads
- ✅ `http://localhost:3000/privacy` - Privacy page loads

### WP10 Route Validation Status

**Bills Route** (`/bills/[id]`):
```typescript
function isValidBillId(id: string): boolean {
  // Format: billType-billNumber-congressNumber
  // Example: "hr-1234-118", "s-567-119", "hjres-45-118"
  return /^[a-z]+(-[0-9]+){2}$/.test(id);
}
```
- ✅ Valid IDs load correctly: `hr-1-118` → Page structure loads
- ✅ Invalid IDs return 404: `invalid-id-test` → 404 page (response time <25ms)

**Legislators Route** (`/legislators/[id]`):
```typescript
function isValidLegislatorId(id: string): boolean {
  // Format: Bioguide ID - One uppercase letter + 6 digits
  // Example: "A000360", "S001198", "M001111"
  return /^[A-Z][0-9]{6}$/.test(id);
}
```
- ✅ Valid IDs load correctly: `A000360` → Page structure loads
- ✅ Invalid IDs return 404: `invalid-id-test` → 404 page (response time <25ms)

**Verification Status**: ✅ **PASSED** - Frontend route validation working correctly

---

## 5. Screenshot Evidence ✅

### All Screenshots Captured (10 total)

**Evidence Location**: `/Users/estanley/Documents/GitHub/LTI/docs/screenshots/`

1. ✅ **01-homepage.png** - Hero section "Track Legislation with Unbiased Intelligence"
2. ✅ **02-bills-page.png** - "Failed to load bills" (network error - API not running)
3. ✅ **03-legislators-page.png** - "Failed to load legislators" (network error)
4. ✅ **04-votes-page.png** - "Failed to load votes" (network error)
5. ✅ **05-bill-detail-valid.png** - `hr-1-118` page structure loads, data fails (API not running)
6. ✅ **06-bill-404-invalid-id.png** - **404 page for "invalid-id-test"** ✅ WP10 validation working
7. ✅ **07-legislator-detail-valid.png** - `A000360` page structure loads, data fails
8. ✅ **08-legislator-404-invalid-id.png** - **404 page for "invalid-id-test"** ✅ WP10 validation working
9. ✅ **09-about-page.png** - About LTIP page content
10. ✅ **10-privacy-page.png** - Privacy Policy page content

### Key Evidence

**Screenshot 06** (`06-bill-404-invalid-id.png`):
- URL: `http://localhost:3000/bills/invalid-id-test`
- Result: **404 Not Found** page
- Validation: ✅ Bills route validation **WORKING CORRECTLY**

**Screenshot 08** (`08-legislator-404-invalid-id.png`):
- URL: `http://localhost:3000/legislators/invalid-id-test`
- Result: **404 Not Found** page
- Validation: ✅ Legislators route validation **WORKING CORRECTLY**

**Verification Status**: ✅ **PASSED** - Visual evidence confirms route validation functioning

---

## 6. ODIN Criteria Verification ✅

### CR-2026-01-31-002: WP10 Security Hardening

**Status**: ✅ **COMPLETE** (per CHANGE-CONTROL.md)

**ODIN Criteria**:
- ✅ **Acceptance Criteria**: Route parameter validation for `/bills/[id]` and `/legislators/[id]`
- ✅ **Testable Deliverables**: Validation functions implemented, 404 responses verified
- ✅ **Dependencies**: Next.js 14.2.35, TypeScript strict mode, existing 404 infrastructure
- ✅ **Risk Assessment**: Low risk, non-breaking additive validation
- ✅ **Effort Estimates**: Completed in <30 minutes (claimed), actual ~4 hours (including docs)

**Change Control Entry**:
```markdown
Version: 1.14.0
Date: 2026-01-31
Status: COMPLETE ✅
Git Commit: 44de38c
Security Impact: +2% (78→80), Attack surface -15%, Input validation +10%
```

**Verification**: ✅ **PASSED** - Meets all ODIN criteria

---

### CR-2026-01-31-003: GAP-1 Validation Bypass Fix

**Status**: 🔴 **PENDING APPROVAL**

**ODIN Criteria**:
- ✅ **Acceptance Criteria**: Four-layer defense-in-depth validation (Frontend, API Middleware, Service Layer, Database)
- ✅ **Testable Deliverables**:
  - Shared validation library (`packages/shared/src/validation/`)
  - API validation middleware (`apps/api/src/middleware/validateParams.ts`)
  - Service-layer validation (bills.service.ts, legislators.service.ts)
  - Unit tests (100% coverage target)
  - Integration tests (≥3 scenarios)
- ✅ **Dependencies**:
  - Monorepo package infrastructure
  - TypeScript with strict mode
  - Express.js API server
  - Existing validation patterns (WP10)
- ✅ **Risk Assessment**: Medium risk (coordinated changes across layers, no breaking changes)
- ✅ **Effort Estimates**: 14 hours total
  - Planning: 1 hour
  - Shared library: 3 hours
  - API middleware: 4 hours
  - Service-layer validation: 3 hours
  - Testing: 2 hours
  - Deployment: 1 hour

**Change Control Entry**:
```markdown
Version: 1.15.0
Date: 2026-01-31
Status: 🔴 PENDING APPROVAL
Priority: P0 (CRITICAL - Blocks Production)
CVSS: 7.5 HIGH
Impact: BLOCKS PRODUCTION DEPLOYMENT
```

**Verification**: ✅ **PASSED** - Meets all ODIN criteria, awaiting stakeholder approval

---

### CR-2026-01-31-004: GAP-2 ReDoS Vulnerability Fix

**Status**: 🔴 **PENDING APPROVAL**

**ODIN Criteria**:
- ✅ **Acceptance Criteria**: Length validation before regex processing (prevents CPU exhaustion)
- ✅ **Testable Deliverables**:
  - Length guards in validation functions (2 files)
  - Unit tests (length limit enforcement)
  - Performance tests (verify <1ms rejection for long strings)
- ✅ **Dependencies**:
  - Coordination with CR-2026-01-31-003 (determines implementation path)
  - Next.js 14.2.35
  - TypeScript with strict mode
- ✅ **Risk Assessment**: Low risk (simple guard checks, no breaking changes)
- ✅ **Effort Estimates**:
  - **Option 1** (via Shared Library): 1 hour (performance tests only)
  - **Option 2** (standalone): 4 hours (2h implementation + 2h testing)

**Change Control Entry**:
```markdown
Version: 1.16.0
Date: 2026-01-31
Status: 🔴 PENDING APPROVAL
Priority: P0 (CRITICAL - Blocks Production)
CVSS: 5.3 MEDIUM
Coordination: Largely superseded by CR-003 (includes length guards)
Impact: BLOCKS PRODUCTION DEPLOYMENT
```

**Verification**: ✅ **PASSED** - Meets all ODIN criteria, awaiting stakeholder approval

---

## 7. Change Control Verification ✅

### CHANGE-CONTROL.md Master Log

**File**: `/Users/estanley/Documents/GitHub/LTI/docs/change-control/CHANGE-CONTROL.md`
**Size**: 28,518 tokens (read via Grep tool due to size limit)

### Verified Entries

**Version 1.14.0** - CR-2026-01-31-002:
```markdown
**CR-2026-01-31-002 COMPLETE**: WP10 Security Hardening
- Route parameter validation for /bills/[id] and /legislators/[id]
- Security +2% (78→80), Attack surface -15%, Input validation +10%
- Commit: 44de38c
```
✅ Status: Accurate, matches git commit and implementation

**Version 1.15.0** - CR-2026-01-31-003:
```markdown
**CR-2026-01-31-003 PENDING**: GAP-1 Validation Bypass Fix
- Defense-in-depth validation across frontend/API/backend layers
- CVSS 7.5 HIGH
- P0 CRITICAL
- **BLOCKS PRODUCTION**
```
✅ Status: Accurate, pending approval documented

**Version 1.16.0** - CR-2026-01-31-004:
```markdown
**CR-2026-01-31-004 PENDING**: GAP-2 ReDoS Vulnerability Fix
- Length validation before regex processing
- CVSS 5.3 MEDIUM
- P0 CRITICAL
- **BLOCKS PRODUCTION**
```
✅ Status: Accurate, pending approval documented

### QC Findings Section

CR-2026-01-31-002 entry includes:
```markdown
#### QC Findings

Post-implementation QC review identified 8 critical gaps requiring remediation:
- **GAP-1**: Validation bypass vulnerability (CVSS 7.5 HIGH) - See CR-2026-01-31-003
- **GAP-2**: ReDoS vulnerability (CVSS 5.3 MEDIUM) - See CR-2026-01-31-004
```
✅ Cross-references are accurate

**Verification Status**: ✅ **PASSED** - All CR entries accurate and properly logged

---

## 8. Production Deployment Blockers

### Critical Blockers (MUST FIX before production)

**B-1: TypeScript Compilation Failures** ❌
- **Component**: @ltip/api package
- **Issue**: 130+ TypeScript errors
- **Impact**: Production build will FAIL
- **Status**: Not mentioned in WP10 completion report
- **Required Action**: Fix all TypeScript errors in API package
- **Estimated Effort**: 8-12 hours

**B-2: GAP-1 Validation Bypass** 🔴
- **Severity**: CVSS 7.5 HIGH
- **Issue**: Frontend validation can be bypassed via direct API calls
- **Impact**: Defense-in-depth violation, security vulnerability
- **Status**: Documented in CR-2026-01-31-003
- **Required Action**: Implement shared validation library + API middleware
- **Estimated Effort**: 14 hours (per CR-003)

**B-3: GAP-2 ReDoS Vulnerability** 🔴
- **Severity**: CVSS 5.3 MEDIUM
- **Issue**: No length validation before regex processing (CPU exhaustion risk)
- **Impact**: Denial of Service attack vector
- **Status**: Documented in CR-2026-01-31-004
- **Required Action**: Add length guards (1 hour via CR-003, or 4 hours standalone)
- **Estimated Effort**: 1-4 hours (depends on CR-003 approval)

### High-Priority Issues (Should fix before production)

**H-1: CSRF Token Exposed to XSS** ⚠️
- **Severity**: CVSS 8.1 HIGH
- **Issue**: CSRF token stored in JavaScript variable accessible to XSS
- **File**: `apps/web/src/lib/api.ts:24`
- **Code**:
  ```typescript
  // VULNERABLE
  let csrfToken: string | null = null;
  console.log(csrfToken); // ❌ Can be read by XSS payloads
  ```
- **Impact**: XSS can steal CSRF tokens
- **Status**: Documented in SECURITY.md
- **Required Action**: Move CSRF token to HTTP-only cookie (requires backend changes)
- **Estimated Effort**: 6-8 hours (backend + frontend coordination)

---

## 9. Security Score Analysis

### Current Security Posture

**Overall Security Score**: 80/100 (improved from 78/100)

**Score Breakdown** (from SECURITY.md):
- Input Validation: 85% (+10% from WP10)
- Attack Surface: 85% of baseline (-15% reduction from WP10)
- Route Parameter Validation: ✅ Implemented (bills + legislators)

**Production Deployment Status**: 🔴 **BLOCKED**

**Blocking Issues**:
1. GAP-1: Validation bypass (CVSS 7.5 HIGH) - CR-2026-01-31-003
2. GAP-2: ReDoS vulnerability (CVSS 5.3 MEDIUM) - CR-2026-01-31-004
3. TypeScript compilation failures (130+ errors in API) - NOT documented in CRs

**Target Security Score**: 75/100 (WP10 goal)
**Gap to Target**: -5 points (need to resolve GAP-1 and GAP-2 to reach target)

---

## 10. Recommendations

### Immediate Actions (P0 - Critical)

1. **Fix TypeScript Compilation Errors** (8-12 hours)
   - Generate Prisma Client types correctly
   - Fix implicit 'any' parameter types throughout API services
   - Clean up test file type errors
   - **Acceptance**: `pnpm typecheck` passes with 0 errors across all packages

2. **Approve and Implement CR-2026-01-31-003** (14 hours)
   - Create shared validation library
   - Add API validation middleware
   - Implement service-layer validation
   - Write comprehensive tests
   - **Acceptance**: Four-layer defense-in-depth validation operational

3. **Implement CR-2026-01-31-004 via CR-003** (1 hour)
   - Length guards included in shared library
   - Add performance tests
   - **Acceptance**: ReDoS vulnerability mitigated, performance tests pass

### Short-Term Actions (P1 - High Priority)

4. **Update WP10 Completion Report** (1 hour)
   - Correct "zero TypeScript errors" claim to "zero frontend TypeScript errors"
   - Add note: "API package has 130+ errors requiring remediation"
   - Update acceptance criteria to specify "monorepo-wide typecheck"

5. **Implement H-1 CSRF Token Fix** (6-8 hours)
   - Move CSRF token to HTTP-only cookie
   - Requires backend API changes
   - Coordinate frontend + backend deployment

### Process Improvements (P2 - Medium Priority)

6. **Expand Acceptance Criteria** (0.5 hours)
   - Add "Full monorepo typecheck passes" to WP acceptance criteria
   - Require verification of all packages, not just frontend
   - Document in CHANGE-CONTROL.md standards

7. **Add Pre-Deployment Checklist** (1 hour)
   - Create `DEPLOYMENT_CHECKLIST.md`
   - Include: Monorepo typecheck, security scan, full test suite, screenshot verification
   - Require all items checked before claiming "production ready"

8. **Automate Verification** (4-6 hours)
   - Create `npm run verify:all` script
   - Runs: typecheck, lint, test, security scan
   - Gates production deployment
   - Add to CI/CD pipeline

---

## 11. Lessons Learned

### What Went Well ✅

1. **Evidence-Based Verification**: Fresh verification revealed discrepancies that documentation review alone would miss
2. **Screenshot Evidence**: Visual proof of route validation functionality
3. **Systematic Approach**: TodoWrite workflow ensured complete coverage
4. **ODIN Criteria Enforcement**: All CRs properly documented with acceptance criteria, deliverables, dependencies, risks, estimates

### What Went Wrong ❌

1. **Incomplete Testing**: WP10 testing only verified frontend, missed API package errors
2. **Inaccurate Completion Claims**: "Zero TypeScript errors" claim false for monorepo
3. **Acceptance Criteria Too Narrow**: Should have specified "monorepo-wide typecheck"
4. **Missing Pre-Deployment Gates**: No automated check prevented claiming completion with failing typecheck

### Process Improvements

1. **Always Run Full Monorepo Verification**: Never claim "zero errors" without running `pnpm typecheck` at root
2. **Require Fresh Evidence**: Documentation alone insufficient, must run actual verification commands
3. **Expand Acceptance Criteria**: Specify full scope (e.g., "all packages" vs "frontend only")
4. **Add Quality Gates**: Automate verification before allowing completion claims

---

## 12. Conclusion

WP10 Security Hardening achieved **partial completion** with **critical gaps** that block production deployment:

**✅ Successes**:
- Frontend route validation implemented correctly ✅
- Visual evidence confirms functionality ✅
- Documentation comprehensive (218KB) ✅
- All CRs meet ODIN criteria ✅

**❌ Critical Failures**:
- 130+ TypeScript errors in API package ❌
- "Zero TypeScript errors" claim contradicted by evidence ❌
- Production deployment blocked by GAP-1, GAP-2, and TypeScript errors ❌

**⏳ Pending Work**:
- CR-2026-01-31-003 approval and implementation (14 hours)
- CR-2026-01-31-004 implementation (1 hour via CR-003)
- TypeScript error remediation (8-12 hours)
- H-1 CSRF token fix (6-8 hours)

**Total Estimated Effort to Production Readiness**: 29-35 hours

**Recommendation**: Do NOT deploy to production until all blockers resolved and full monorepo typecheck passes.

---

## Appendix A: Evidence Files

### Git Commits
- `44de38c` - WP10 Security Hardening implementation ✅

### Documentation Files (13 total, 218KB)
- WP10_*.md (10 files, 181KB)
- CR-2026-01-31-00*.md (3 files, 37KB)

### Screenshot Evidence (10 files)
- `docs/screenshots/01-homepage.png`
- `docs/screenshots/02-bills-page.png`
- `docs/screenshots/03-legislators-page.png`
- `docs/screenshots/04-votes-page.png`
- `docs/screenshots/05-bill-detail-valid.png`
- `docs/screenshots/06-bill-404-invalid-id.png` ✅ **Validation proof**
- `docs/screenshots/07-legislator-detail-valid.png`
- `docs/screenshots/08-legislator-404-invalid-id.png` ✅ **Validation proof**
- `docs/screenshots/09-about-page.png`
- `docs/screenshots/10-privacy-page.png`

### TypeScript Compilation Output
```
@ltip/web:typecheck: ✅ PASSED
@ltip/shared:typecheck: ✅ PASSED
@ltip/api:typecheck: ❌ FAILED (exit code 2, 130+ errors)
```

### Change Control Entries
```
Version 1.14.0: CR-2026-01-31-002 COMPLETE ✅
Version 1.15.0: CR-2026-01-31-003 PENDING 🔴 BLOCKS PRODUCTION
Version 1.16.0: CR-2026-01-31-004 PENDING 🔴 BLOCKS PRODUCTION
```

---

**Report Prepared By**: ODIN (Outline Driven INtelligence)
**Methodology**: Verification-Before-Completion, Evidence-Based Testing
**Classification**: Internal Development Documentation
**Next Review**: After CR-003 and CR-004 implementation
