# Security Checklist - LTIP MVP

**Last Updated**: 2026-01-29
**Phase**: MVP (Phase 1)

## Current Security Status

### Implemented

| Feature | Status | Implementation |
|---------|--------|----------------|
| Rate Limiting | ACTIVE | express-rate-limit, 100 req/min |
| Security Headers | ACTIVE | Helmet middleware |
| CORS | ACTIVE | Configurable via `CORS_ORIGINS` env var |
| Input Validation | ACTIVE | Zod schemas on all route handlers |
| Request Logging | ACTIVE | Pino HTTP (excludes sensitive data) |
| Graceful Shutdown | ACTIVE | SIGTERM/SIGINT handlers |

### Deferred to Phase 2

| Feature | Priority | Notes |
|---------|----------|-------|
| JWT Signature Verification | HIGH | WebSocket auth validates format only |
| User API Key Hashing | MEDIUM | Store user keys with Argon2 |
| CSRF Protection | MEDIUM | Not critical for stateless REST API |
| Fine-grained Rate Limiting | LOW | Per-endpoint rate limits |

## Production Deployment Checklist

### Environment Variables (Required)

```bash
# CORS - MUST be set to actual frontend domain(s)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database - Production connection string
DATABASE_URL=postgresql://user:pass@host:5432/ltip_prod

# Redis (if using distributed rate limiting)
REDIS_URL=redis://host:6379

# Log level - Reduce verbosity in production
LOG_LEVEL=info

# Rate limiting - Adjust based on expected traffic
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Pre-Deployment Security Checks

- [ ] `CORS_ORIGINS` is NOT set to `*` or `localhost`
- [ ] `NODE_ENV=production` is set
- [ ] Database credentials are not default values
- [ ] TLS/HTTPS is configured at load balancer/proxy level
- [ ] Rate limiting thresholds reviewed for production traffic
- [ ] Logging output goes to secure aggregation service
- [ ] Health check endpoint (`/api/health`) is not exposed publicly

### WebSocket Security Note

**IMPORTANT**: The current WebSocket authentication implementation (`apps/api/src/websocket/auth.ts`) validates JWT token format but does NOT verify signatures. This is acceptable for MVP where:

1. All data is public (legislative information)
2. User authentication is for optional features only
3. No sensitive operations require authentication

**Phase 2 Requirements**:
- Implement `jsonwebtoken.verify()` with proper secret/public key
- Add JWT expiration validation
- Implement token refresh mechanism
- Add WebSocket connection authentication middleware

## Security Contacts

- Report vulnerabilities to: security@[your-domain].com
- For general issues: Create a GitHub issue with the `security` label

## Audit History

| Date | Auditor | Score | Notes |
|------|---------|-------|-------|
| 2026-01-29 | ODIN Verification | 58/100 | Initial audit - items addressed |
