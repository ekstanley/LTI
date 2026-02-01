# Type Guards Quick Reference

## Overview

Type guards provide runtime validation while enabling TypeScript type narrowing. Located in `/apps/api/src/utils/type-guards.ts`.

## Request Validation

### hasSession(req)
Validates request has valid session with ID.

```typescript
import { hasSession } from '@/utils/type-guards.js';

if (!hasSession(req)) {
  throw ApiError.unauthorized('Session required');
}
// TypeScript now knows req.session exists
const sessionId = req.session.id;
```

### hasAuthenticatedUser(req)
Validates request has authenticated user.

```typescript
import { hasAuthenticatedUser } from '@/utils/type-guards.js';

if (!hasAuthenticatedUser(req)) {
  throw ApiError.unauthorized('Authentication required');
}
// TypeScript now knows req.user exists
const userId = req.user.id;
```

## Value Validation

### isNonEmptyString(value)
Checks if value is non-empty string.

```typescript
const token = req.headers['x-csrf-token'];
if (!isNonEmptyString(token)) {
  throw ApiError.badRequest('Token required');
}
// TypeScript knows token is string
console.log(token.toUpperCase());
```

### isValidNumber(value)
Checks if value is valid number (not NaN or Infinity).

```typescript
const limit = parseInt(req.query.limit);
if (!isValidNumber(limit)) {
  throw ApiError.badRequest('Invalid limit');
}
// TypeScript knows limit is number
const doubled = limit * 2;
```

### isPositiveInteger(value)
Checks if value is positive integer.

```typescript
const id = parseInt(req.params.id);
if (!isPositiveInteger(id)) {
  throw ApiError.badRequest('Invalid ID');
}
// TypeScript knows id is positive number
await getRecordById(id);
```

## Object Validation

### isPlainObject(value)
Checks if value is plain object (not array or null).

```typescript
if (!isPlainObject(req.body)) {
  throw ApiError.badRequest('Invalid request body');
}
// TypeScript knows req.body is Record<string, unknown>
const keys = Object.keys(req.body);
```

### isArrayOf<T>(value, itemGuard)
Validates array of specific type.

```typescript
if (!isArrayOf(data, isNonEmptyString)) {
  throw ApiError.badRequest('Invalid data format');
}
// TypeScript knows data is string[]
data.forEach(item => console.log(item.toUpperCase()));
```

## Error Handling

### isErrorWithMessage(error)
Checks if error is Error instance with message.

```typescript
try {
  await riskyOperation();
} catch (error) {
  if (isErrorWithMessage(error)) {
    logger.error({ message: error.message });
  }
}
```

## Utility Guards

### isDefined<T>(value)
Filters out null and undefined.

```typescript
const values = [1, null, 2, undefined, 3];
const defined = values.filter(isDefined);
// Type: number[] (not (number | null | undefined)[])
```

### assert(condition, message)
Throws error if condition is false.

```typescript
assert(config.apiKey, 'API key must be configured');
// Continue with confidence that config.apiKey exists
```

### assertDefined<T>(value, message)
Throws error if value is null or undefined.

```typescript
assertDefined(user, 'User must be authenticated');
// TypeScript knows user is non-null after this line
const email = user.email;
```

## Common Patterns

### Middleware with Session
```typescript
export async function myMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!hasSession(req)) {
    throw ApiError.unauthorized('Session required');
  }

  const sessionId = req.session.id;
  // ... rest of middleware
}
```

### Route Handler with Auth
```typescript
router.get('/profile', async (req: Request, res: Response) => {
  if (!hasAuthenticatedUser(req)) {
    throw ApiError.unauthorized('Authentication required');
  }

  const profile = await getUserProfile(req.user.id);
  res.json(profile);
});
```

### Input Validation
```typescript
router.post('/create', async (req: Request, res: Response) => {
  const { name, age } = req.body;

  if (!isNonEmptyString(name)) {
    throw ApiError.badRequest('Name is required');
  }

  if (!isPositiveInteger(age)) {
    throw ApiError.badRequest('Age must be positive integer');
  }

  // TypeScript knows name is string and age is number
  const user = await createUser({ name, age });
  res.json(user);
});
```

## Type Definitions

### Express Request Extensions
Located in `/apps/api/src/types/express.d.ts`:

```typescript
interface SessionData {
  id: string;
  userId?: string;
  createdAt?: number;
  lastActivity?: number;
  [key: string]: unknown;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  isActive: boolean;
  rateLimit: number;
}

// These are automatically available on Express Request
interface Request {
  user?: AuthenticatedUser;
  session?: SessionData;
}
```

## Best Practices

1. **Use type guards instead of type assertions**
   ```typescript
   // ❌ Don't use type assertions
   const session = (req as any).session;

   // ✅ Use type guards
   if (!hasSession(req)) {
     throw ApiError.unauthorized('Session required');
   }
   const sessionId = req.session.id;
   ```

2. **Validate early, fail fast**
   ```typescript
   // Validate inputs at the start of handlers
   if (!hasAuthenticatedUser(req)) {
     throw ApiError.unauthorized();
   }

   if (!isNonEmptyString(req.body.name)) {
     throw ApiError.badRequest('Name required');
   }

   // Now proceed with confidence
   ```

3. **Leverage type narrowing**
   ```typescript
   // After type guard, TypeScript knows the type
   if (hasSession(req)) {
     // req.session is guaranteed to exist
     const id = req.session.id; // No optional chaining needed
   }
   ```

4. **Combine guards for complex validation**
   ```typescript
   if (hasAuthenticatedUser(req) && hasSession(req)) {
     // Both user and session are guaranteed
     const userId = req.user.id;
     const sessionId = req.session.id;
   }
   ```

## Migration Guide

### From Type Assertions to Type Guards

**Before**:
```typescript
const session = (req as any).session as { id: string } | undefined;
if (!session?.id) {
  throw ApiError.unauthorized();
}
const sessionId = session.id;
```

**After**:
```typescript
if (!hasSession(req)) {
  throw ApiError.unauthorized();
}
const sessionId = req.session.id;
```

### From Manual Checks to Type Guards

**Before**:
```typescript
if (typeof value === 'string' && value.length > 0) {
  // TypeScript doesn't narrow type automatically
}
```

**After**:
```typescript
if (isNonEmptyString(value)) {
  // TypeScript knows value is string
  console.log(value.toUpperCase());
}
```

## Testing with Type Guards

For tests that need to test invalid inputs, use `@ts-expect-error`:

```typescript
it('should reject invalid input', async () => {
  // @ts-expect-error - Testing invalid input types
  await expect(myFunction(null)).rejects.toThrow();

  // @ts-expect-error - Testing invalid input types
  await expect(myFunction(undefined)).rejects.toThrow();
});
```

## Additional Resources

- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Express Type Augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
- [LTIP Type Safety Report](/TYPESCRIPT_SAFETY_IMPROVEMENTS.md)
