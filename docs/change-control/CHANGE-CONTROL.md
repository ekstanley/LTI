# Change Control Process

**Project**: LTIP (Legislative Tracking Intelligence Platform)
**Version**: 1.0.0
**Last Updated**: 2026-01-28

---

## Purpose

This document establishes the change control process for LTIP to ensure all modifications are properly evaluated, approved, documented, and tracked throughout the project lifecycle.

---

## Change Categories

### Category 1: Minor Changes (No Approval Required)
- Documentation updates
- Code style/formatting fixes
- Test additions without API changes
- Dependency patch updates
- Bug fixes that don't change behavior

**Process**: Direct commit to feature branch, standard PR review

### Category 2: Standard Changes (Team Approval)
- New features within approved scope
- API endpoint additions
- Database schema changes (additive)
- UI component additions
- Dependency minor version updates

**Process**: RFC discussion, team approval, PR with 2 reviewers

### Category 3: Major Changes (Architecture Review)
- Breaking API changes
- Database schema migrations (destructive)
- New external dependencies
- Infrastructure changes
- Security-related modifications

**Process**: Architecture review, RFC document, team vote, extended testing

### Category 4: Critical Changes (Stakeholder Approval)
- Scope changes
- Timeline adjustments
- Budget impacts
- Technology stack changes
- Third-party API replacements

**Process**: Change Request Form, stakeholder review, formal approval

---

## Change Request Process

### Step 1: Initiation

```markdown
## Change Request Form

**CR Number**: CR-YYYY-MM-DD-NNN
**Requestor**: [Name]
**Date**: [Date]
**Category**: [1/2/3/4]

### Description
[Detailed description of the proposed change]

### Justification
[Why is this change needed?]

### Impact Assessment
- **Scope Impact**: [None/Low/Medium/High]
- **Timeline Impact**: [None/Low/Medium/High]
- **Budget Impact**: [None/Low/Medium/High]
- **Risk Level**: [Low/Medium/High]

### Affected Components
- [ ] Frontend
- [ ] Backend API
- [ ] Database
- [ ] ML Pipeline
- [ ] Infrastructure
- [ ] Documentation

### Dependencies
[List any dependencies on other changes or external factors]

### Rollback Plan
[How to revert if the change fails]
```

### Step 2: Review

| Category | Review Board | SLA |
|----------|--------------|-----|
| 1 | Automated (CI/CD) | Immediate |
| 2 | Tech Lead | 2 business days |
| 3 | Architecture Team | 5 business days |
| 4 | Project Stakeholders | 10 business days |

### Step 3: Approval

**Approval Statuses**:
- **Approved**: Change can proceed
- **Approved with Conditions**: Change can proceed with modifications
- **Deferred**: Change postponed to future release
- **Rejected**: Change will not be implemented

### Step 4: Implementation

1. Create feature branch: `feature/CR-YYYY-MM-DD-NNN-description`
2. Implement change following coding standards
3. Write/update tests
4. Update documentation
5. Submit PR with CR reference

### Step 5: Verification

- [ ] All tests pass
- [ ] Code review approved
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Performance benchmarks met

### Step 6: Closure

- Merge to main branch
- Update CHANGELOG.md
- Close Change Request
- Notify stakeholders

---

## Change Log Template

```markdown
## CR-YYYY-MM-DD-NNN: [Title]

**Status**: [Open/In Review/Approved/Implemented/Closed/Rejected]
**Category**: [1/2/3/4]
**Priority**: [Low/Medium/High/Critical]

### Timeline
- Requested: YYYY-MM-DD
- Reviewed: YYYY-MM-DD
- Approved: YYYY-MM-DD
- Implemented: YYYY-MM-DD
- Closed: YYYY-MM-DD

### Description
[Brief description]

### Implementation Notes
[Technical details of implementation]

### Verification Results
[Test results, benchmark data]
```

---

## Emergency Change Process

For critical production issues requiring immediate action:

1. **Identify**: Confirm severity (P1/P2 only)
2. **Communicate**: Alert on-call team via PagerDuty
3. **Implement**: Hotfix with minimal viable change
4. **Verify**: Smoke tests in staging, then production
5. **Document**: Retrospective within 24 hours
6. **Formalize**: Create CR post-facto

**Emergency Approvers**: CTO, Tech Lead, On-Call Engineer (any 2)

---

## Metrics and Reporting

### Change Metrics Tracked
- Change volume by category
- Lead time (request to implementation)
- Change failure rate
- Rollback frequency
- Time to resolution (for failures)

### Monthly Report
- Total changes by category
- Approval rate
- Average lead time
- Notable changes
- Lessons learned

---

## RACI Matrix

| Activity | Requestor | Tech Lead | Architect | PM | Stakeholder |
|----------|-----------|-----------|-----------|-----|-------------|
| Submit CR | R | I | I | I | I |
| Category 1 Review | A | R | - | - | - |
| Category 2 Review | C | R/A | I | I | - |
| Category 3 Review | C | R | R/A | I | I |
| Category 4 Review | C | C | C | R | A |
| Implementation | R | C | C | I | - |
| Verification | R | A | I | I | - |
| Closure | R | A | I | I | I |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

---

## Change Freeze Periods

Changes restricted during:
- **Code Freeze**: 48 hours before major releases
- **Holiday Freeze**: Dec 20 - Jan 5 (emergency only)
- **Incident Response**: Active P1 incidents (emergency only)

---

## Appendix: Risk Assessment Matrix

| Probability | Impact: Low | Impact: Medium | Impact: High |
|-------------|-------------|----------------|--------------|
| Low | 1 (Accept) | 2 (Monitor) | 3 (Mitigate) |
| Medium | 2 (Monitor) | 4 (Mitigate) | 6 (Avoid) |
| High | 3 (Mitigate) | 6 (Avoid) | 9 (Escalate) |

---

## Active Change Log

### CR-2026-01-29-001: WP7-A Historical Data Load QC Fixes

**Status**: Implemented
**Category**: 2 (Standard Change)
**Priority**: High

#### Timeline
- Requested: 2026-01-29
- Reviewed: 2026-01-29
- Approved: 2026-01-29
- Implemented: 2026-01-29

#### Description
Quality control fixes for the WP7-A Historical Data Load system to address error handling issues discovered during testing.

#### Changes Implemented

| ID | Issue | Fix | Location |
|----|-------|-----|----------|
| WP7-A-001 | Offset leakage between phases | Reset offset to 0 when starting new phase | `import-votes.ts:listVotes()` |
| WP7-A-002 | 404 only detected at offset=0 | 404 detection at ANY offset breaks pagination | `import-votes.ts:254-260` |
| WP7-A-005 | Data loss on transient errors | Retry same offset, track consecutive errors | `import-votes.ts:262-275` |
| QC-001 | Infinite loop risk | Total error limit (100) stops import | `import-config.ts`, `import-votes.ts:277-286` |
| QC-003 | Stale compiled .js files | `scripts:clean` command, hooked into import scripts | `package.json` |

#### Affected Components
- [x] Backend API
- [x] Documentation
- [ ] Frontend
- [ ] Database
- [ ] ML Pipeline
- [ ] Infrastructure

#### Verification Results
- All 349 unit tests pass
- Dry-run completes successfully (5/5 phases)
- 404 detection verified at various offsets
- Stale file cleanup prevents infinite loop

#### Commits
- `5e6f36a` fix(api): add safeguard to clean stale compiled JS files before import
- `e3ba937` test(api): add behavior documentation tests for import error handling

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.1.0 | 2026-01-29 | ODIN | Added CR-2026-01-29-001 (WP7-A QC Fixes) |
| 1.0.0 | 2026-01-28 | ODIN | Initial version |
