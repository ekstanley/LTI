# Environment Configuration Guide

## Overview

The web application uses centralized environment configuration to manage all runtime settings. This allows easy customization for different environments (development, staging, production) without code changes.

## Configuration Files

### 1. `src/config/env.ts`

Centralized configuration module that reads from environment variables.

**Exports:**
- `apiConfig` - API client configuration (retry logic, timeouts, CSRF)
- `swrConfig` - SWR caching configuration
- `config` - Combined configuration object

### 2. `.env.example`

Template for environment variables with documentation and examples.

**Copy this file to `.env.local` for local development:**
```bash
cp .env.example .env.local
```

## Environment Variables

### API Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | string | `http://localhost:4000` | Base URL for API requests |
| `NEXT_PUBLIC_API_MAX_RETRIES` | number | `3` | Maximum retry attempts for failed requests |
| `NEXT_PUBLIC_API_INITIAL_BACKOFF_MS` | number | `1000` | Initial retry delay in milliseconds |
| `NEXT_PUBLIC_API_MAX_BACKOFF_MS` | number | `30000` | Maximum retry delay (caps exponential growth) |
| `NEXT_PUBLIC_API_MAX_CSRF_REFRESH_ATTEMPTS` | number | `2` | Maximum CSRF token refresh attempts |

### SWR Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_SWR_DEDUPING_INTERVAL` | number | `5000` | Request deduplication interval in milliseconds |
| `NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS` | boolean | `false` | Revalidate data when window regains focus |

## Usage Examples

### Basic Setup

```bash
# .env.local for development
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Staging Environment

```bash
# .env.staging
NEXT_PUBLIC_API_URL=https://api-staging.ltip.example.com
NEXT_PUBLIC_API_MAX_RETRIES=5
NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS=false
```

### Production Environment

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.ltip.example.com
NEXT_PUBLIC_API_MAX_RETRIES=5
NEXT_PUBLIC_API_MAX_BACKOFF_MS=60000
NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS=false
```

## Using Configuration in Code

### In API Client

The API client (`src/lib/api.ts`) automatically uses the configuration:

```typescript
import { apiConfig } from '@/config/env';

// Configuration is automatically applied
const MAX_RETRIES = apiConfig.maxRetries;
const API_BASE_URL = apiConfig.baseUrl;
```

### In React Hooks

SWR hooks (`useBills`, `useLegislators`, `useVotes`) automatically use the configuration:

```typescript
import { swrConfig } from '@/config/env';

// Configuration is automatically applied in SWR options
useSWR(key, fetcher, {
  revalidateOnFocus: swrConfig.revalidateOnFocus,
  dedupingInterval: swrConfig.dedupingInterval,
});
```

### In Custom Code

You can import and use the configuration anywhere:

```typescript
import { config } from '@/config/env';

// Access API config
console.log(config.api.baseUrl);
console.log(config.api.maxRetries);

// Access SWR config
console.log(config.swr.dedupingInterval);
```

## Configuration Tuning Guide

### API Retry Configuration

**Use Case: High-reliability production environment**
```bash
NEXT_PUBLIC_API_MAX_RETRIES=5
NEXT_PUBLIC_API_INITIAL_BACKOFF_MS=2000
NEXT_PUBLIC_API_MAX_BACKOFF_MS=60000
```

**Use Case: Fast-failing development environment**
```bash
NEXT_PUBLIC_API_MAX_RETRIES=1
NEXT_PUBLIC_API_INITIAL_BACKOFF_MS=500
NEXT_PUBLIC_API_MAX_BACKOFF_MS=5000
```

### SWR Configuration

**Use Case: Real-time data requirements**
```bash
NEXT_PUBLIC_SWR_DEDUPING_INTERVAL=1000
NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS=true
```

**Use Case: Performance-optimized with mostly static data**
```bash
NEXT_PUBLIC_SWR_DEDUPING_INTERVAL=10000
NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS=false
```

## Testing with Custom Configuration

### Running Tests

Tests will use default configuration values. To test with custom values:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4001 npm test
```

### Building with Custom Configuration

```bash
NEXT_PUBLIC_API_URL=https://api.example.com npm run build
```

## Security Considerations

1. **NEXT_PUBLIC_ prefix**: All configuration variables use this prefix, meaning they are **exposed to the browser**. Never put secrets in these variables.

2. **API URL validation**: The API URL should always use HTTPS in production.

3. **CSRF configuration**: The `MAX_CSRF_REFRESH_ATTEMPTS` prevents infinite refresh loops that could be used for DoS attacks.

## Migration from Hardcoded Values

### Before (Hardcoded)

```typescript
// api.ts
const API_BASE_URL = 'http://localhost:4000'; // ❌ Hardcoded
const MAX_RETRIES = 3; // ❌ Hardcoded

// useBills.ts
useSWR(key, fetcher, {
  dedupingInterval: 5000, // ❌ Hardcoded
});
```

### After (Configurable)

```typescript
// api.ts
import { apiConfig } from '@/config/env';
const API_BASE_URL = apiConfig.baseUrl; // ✅ Configurable
const MAX_RETRIES = apiConfig.maxRetries; // ✅ Configurable

// useBills.ts
import { swrConfig } from '@/config/env';
useSWR(key, fetcher, {
  dedupingInterval: swrConfig.dedupingInterval, // ✅ Configurable
});
```

## Troubleshooting

### Configuration not taking effect

1. **Restart dev server**: Environment variables are loaded at build time
   ```bash
   npm run dev
   ```

2. **Check variable names**: Ensure you're using the correct `NEXT_PUBLIC_` prefix

3. **Verify .env.local exists**: Create it from .env.example if missing

### Type errors

If you see type errors related to the config module:

```bash
# Run typecheck to identify issues
npm run typecheck
```

## References

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [SWR Configuration](https://swr.vercel.app/docs/options)
- Project Architecture: `docs/ARCHITECTURE.md`
