# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in the LTI (Legislative Transparency & Insight Platform) project, please report it by emailing the maintainers directly. **Do not create a public GitHub issue for security vulnerabilities.**

**Response Time**: We aim to acknowledge security reports within 48 hours and provide a detailed response within 7 days.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Features

### Account Lockout Protection (Implemented)

**Threat**: Brute Force Authentication Attacks (CWE-307)
**CVSS Score**: 7.5 (High)
**Status**: ✅ Mitigated (CR-2026-02-02-001)

#### How It Works

The platform implements progressive account lockout to prevent brute force password attacks:

1. **Failure Tracking**: System tracks failed login attempts per username and IP address
2. **Exponential Backoff**: Lockout duration increases with repeated failures
3. **Dual Protection**: Both username and IP are locked independently
4. **Admin Override**: Administrators can manually unlock accounts

#### Lockout Progression

| Attempt | Duration   | Trigger                       |
|---------|------------|-------------------------------|
| 1st     | 15 minutes | 5 failures in 15min window   |
| 2nd     | 1 hour     | 5 more failures after unlock |
| 3rd     | 6 hours    | 5 more failures after unlock |
| 4th+    | 24 hours   | Persistent attack pattern    |

#### Technical Details

- **Storage**: Redis-based distributed tracking
- **Keys TTL**: Automatic expiration (15min-30 days)
- **Response**: HTTP 429 with Retry-After header
- **Graceful Degradation**: Falls back to rate limiting if Redis unavailable

#### Admin Unlock

Administrators can unlock accounts via:

```bash
POST /api/v1/admin/unlock-account
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Authentication**: Requires valid JWT token + admin role (see Admin Authorization below)

#### Monitoring

```bash
GET /api/v1/admin/lockout-stats
Authorization: Bearer <jwt-token>
```

Returns:
- Total locked users
- Redis availability status
- System health metrics

### Admin Authorization (Temporary Implementation)

**Status**: ⚠️ Temporary - Pending proper RBAC (Issue #TBD)

#### Configuration

Admin access is controlled via the `ADMIN_EMAILS` environment variable:

```bash
# .env
ADMIN_EMAILS=admin@example.com,security-team@example.com
```

**Format**: Comma-separated list of email addresses
**Matching**: Case-insensitive
**Restart Required**: Yes (environment variable change)

#### Security Considerations

- ✅ Requires valid authentication (JWT token)
- ✅ Failed admin access attempts are logged
- ⚠️ No role hierarchy or granular permissions
- ⚠️ Requires server restart to update admin list

#### Future: Proper RBAC

**Planned Improvements** (Issue #TBD):
- Database-driven role management
- Dynamic role assignment (no restart)
- Granular permissions
- Role hierarchy
- Comprehensive audit trail

**Estimated Implementation**: 2-3 hours

---

## Defense in Depth

The platform employs multiple layers of security:

### Layer 1: Rate Limiting (Existing)
- **Limit**: 5 requests per 15 minutes per IP
- **Scope**: All API endpoints
- **Response**: HTTP 429

### Layer 2: Account Lockout (New)
- **Trigger**: 5 failed login attempts
- **Duration**: Progressive (15min → 24hr)
- **Tracking**: Username + IP address

### Layer 3: Strong Passwords (Existing)
- **Algorithm**: Argon2id
- **Requirements**: Minimum complexity enforced
- **Storage**: Hashed, never plaintext

### Layer 4: Audit Logging (New)
- **Events**: All authentication attempts
- **Events**: All lockout actions
- **Events**: All admin operations
- **Storage**: Structured logs

---

## Known Security Issues

### High Priority (Scheduled for Sprint Follow-Up)

**Issue 1: IP Spoofing Vulnerability** (CWE-441)
- **CVSS**: 7.5
- **Impact**: Attackers can bypass lockout by spoofing x-forwarded-for header
- **Remediation**: Only trust x-forwarded-for when behind verified proxy
- **Effort**: 2 hours
- **Status**: Tracked in Issue #TBD

**Issue 2: Race Condition in Lockout Check** (TOCTOU)
- **CVSS**: 6.5
- **Impact**: Concurrent requests can bypass lockout threshold
- **Remediation**: Use Redis Lua script for atomic check-and-increment
- **Effort**: 4-6 hours
- **Status**: Tracked in Issue #TBD

### Technical Debt

See `docs/change-control/PHASE-2-CODE-REVIEW-2026-02-02.md` for complete list:
- 6 HIGH priority issues
- 8 MEDIUM priority issues
- 4 LOW priority issues

**Total Remediation**: 27-34 hours (scheduled for next sprint)

---

## Security Best Practices

### For Developers

**Authentication**:
- Always use `authenticate` middleware on protected routes
- Check authorization with `requireAdmin()` for admin endpoints
- Never hardcode credentials or secrets
- Use environment variables for configuration

**Input Validation**:
- Validate all user inputs with Zod schemas
- Sanitize inputs before database queries
- Use parameterized queries (Prisma)
- Validate file uploads

**Secrets Management**:
- Never commit secrets to git
- Use `.env.local` for local development
- Rotate credentials regularly
- Use secret management service in production

**Error Handling**:
- Never expose internal details in error messages
- Log errors server-side only
- Return generic error messages to clients
- Include correlation IDs for debugging

### For Operators

**Deployment**:
- Use HTTPS in production (enforce TLS 1.2+)
- Enable security headers (helmet middleware)
- Configure CORS properly
- Keep dependencies updated

**Monitoring**:
- Watch for increased 429 errors (rate limit/lockout)
- Monitor Redis connection status
- Track admin unlock frequency
- Alert on suspicious patterns

**Incident Response**:
- Clear all lockouts: `redis-cli --scan --pattern "lockout:*" | xargs redis-cli del`
- Disable lockout middleware: Revert commit + restart
- Check audit logs: Search for user email/IP
- Investigate failed admin access attempts

---

## Compliance

### Standards Adherence

- **OWASP ASVS 4.0**: V2.2 - Authentication (Account Lockout)
- **CWE-307**: Improper Restriction of Excessive Authentication Attempts ✅ Mitigated
- **CWE-441**: Unintended Proxy or Intermediary ⚠️ In remediation

### Data Privacy

**Personal Data Handling**:
- Email addresses: Tracked for lockout (operational requirement)
- IP addresses: Logged but not persisted long-term
- Passwords: Never logged (only hashes stored)

**Retention**:
- Lockout data: Automatic TTL expiry (15min-30 days)
- Audit logs: Metadata only (no sensitive data)
- GDPR compliant: Right to erasure supported

---

## Security Contacts

**Security Team**: [To be configured]
**Incident Response**: [To be configured]
**Vulnerability Reports**: [To be configured]

---

## Changelog

### 2026-02-02 - Account Lockout Implementation
- Added account lockout protection (CWE-307)
- Implemented admin unlock functionality
- Added comprehensive audit logging
- Documented known security issues
- Created technical debt remediation plan

**Reference**: CR-2026-02-02-001

---

## Additional Resources

- [Change Control Records](docs/change-control/)
- [Code Review Findings](docs/change-control/PHASE-2-CODE-REVIEW-2026-02-02.md)
- [Security Sprint Summary](docs/change-control/2026-02-02-cr-001-security-reliability-sprint.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-02
**Next Review**: 2026-03-02
