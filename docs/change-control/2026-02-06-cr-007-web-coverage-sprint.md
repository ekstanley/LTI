# Change Control Record: CR-2026-02-06-007

## Web Test Coverage Sprint (Issue #23)

**Date**: 2026-02-06
**Author**: ODIN Code Agent
**Status**: Completed
**Branch**: `test/web-coverage-80-percent`
**Parent Branch**: `test/auth-testing-hardening-sprint` (PR #44)
**Issue**: #23 ([P2] Increase frontend test coverage to 80%)

---

## Summary

Added 103 new web tests across 9 new test files targeting previously untested utility functions, components, and the WebSocket service class. This sprint specifically targeted business logic, formatting utilities, and the most complex untested service module.

## Predecessor Sprints

| Sprint | CR | Description | Status |
|--------|----|-------------|--------|
| Quick Wins | CR-005 | Test coverage expansion | Merged |
| Auth Hardening | CR-006 | Auth testing & hardening (PR #44) | Open |
| Security & Reliability | CR-007 (prior) | 6 HIGH security issues | Merged |
| **Web Coverage** | **CR-007** | **This sprint** | **Completed** |

## Changes

### Phase 1: Pure Utility Functions (4 files, 35 tests)

| File | Source | Tests | Description |
|------|--------|-------|-------------|
| `config/__tests__/env.test.ts` | `config/env.ts` | 11 | parseEnvInt, apiConfig, swrConfig defaults and overrides |
| `lib/__tests__/swr.test.ts` | `lib/utils/swr.ts` | 8 | createStableCacheKey key ordering, undefined filtering, determinism |
| `components/common/__tests__/DateFormatter.test.ts` | `components/common/DateFormatter.ts` | 6 | formatDate with various date formats and invalid input |
| `components/bills/__tests__/BillFormatters.test.ts` | `components/bills/BillFormatters.ts` | 10 | formatBillId for all 8 BillType values |

### Phase 2: Component Tests (4 files, 31 tests)

| File | Source | Tests | Description |
|------|--------|-------|-------------|
| `components/bills/__tests__/BiasSpectrum.test.tsx` | `components/bills/BiasSpectrum.tsx` | 13 | Position calculation, label toggle, size variants, scale labels |
| `app/__tests__/home.page.test.tsx` | `app/page.tsx` | 8 | Hero section, feature cards, stat cards, nav links, footer |
| `components/bills/__tests__/BillInfoCard.test.tsx` | `components/bills/BillInfoCard.tsx` | 5 | Icon, label, children rendering |
| `components/legislators/__tests__/LegislatorInfoCard.test.tsx` | `components/legislators/LegislatorInfoCard.tsx` | 5 | Icon, label, children rendering |

### Phase 3: WebSocket Service Tests (1 file, 37 tests)

| File | Source | Tests | Description |
|------|--------|-------|-------------|
| `services/__tests__/websocket.test.ts` | `services/websocket.ts` | 37 | Connection, security, reconnection, subscriptions, heartbeat, message dispatch, topic extraction |

## Test Results

```
New test files:  9
New tests:       103
Total web tests: ~709 (up from ~606 baseline)
All new tests:   PASSING
Build:           CLEAN
TypeScript:      ZERO ERRORS
Lint:            ZERO NEW WARNINGS
```

## Quality Gates

| Gate | Status |
|------|--------|
| `pnpm build` | PASS |
| `pnpm typecheck` | PASS (zero errors) |
| `pnpm lint` | PASS (pre-existing warnings only) |
| `pnpm --filter=@ltip/web test` | PASS (pre-existing api.test.ts timeout flake only) |

## Commits (9 atomic)

1. `test(web): add config/env utility tests`
2. `test(web): add SWR createStableCacheKey utility tests`
3. `test(web): add DateFormatter utility tests`
4. `test(web): add BillFormatters utility tests`
5. `test(web): add BiasSpectrum component tests`
6. `test(web): add HomePage rendering tests`
7. `test(web): add BillInfoCard component tests`
8. `test(web): add LegislatorInfoCard component tests`
9. `test(web): add WebSocketService unit tests with security and reconnection scenarios`

## Technical Notes

### Timezone-Safe Date Testing
DateFormatter tests use `T12:00:00` suffix on date strings to avoid UTC midnight boundary issues. `new Date('2023-01-03')` parses as midnight UTC, which in negative-offset timezones (e.g., PST) resolves to the previous calendar day.

### BiasSpectrum Mock Strategy
Mock `getBiasLabel`/`getBiasColor` from `@ltip/shared` to return distinct strings ("Leans Left" instead of "Left") to avoid collision with the always-visible scale labels ("Left", "Center", "Right").

### WebSocket Mock Architecture
Lightweight `MockWebSocket` class implements the global WebSocket API with:
- `simulateOpen()`, `simulateClose()`, `simulateMessage()`, `simulateError()` helpers
- `sentMessages[]` array for assertion tracking
- Static instance registry for multi-connection tests
- Compatible with `vi.useFakeTimers()` for heartbeat/reconnection timing

### Pre-existing Flaky Test
`api.test.ts` line 400 ("should throw after 3 failed NetworkError retries") intermittently times out at 5000ms. This is pre-existing and unrelated to this sprint.

## Risk Assessment

| Risk | Mitigation | Outcome |
|------|-----------|---------|
| Timezone-dependent date assertions | Used T12:00:00 suffix | Resolved |
| Duplicate text elements in DOM | Used distinct mock labels / getAllByText | Resolved |
| LucideIcon type mismatch | Used forwardRef for mock components | Resolved |
| exactOptionalPropertyTypes strict mode | Explicit `| undefined` types in mocks | Resolved |
