# Phase 1: Authentication State Management - Design Document

**Date**: 2026-02-02
**Issue**: #17
**Phase**: 1 of 3 (Security & Reliability Sprint)

---

## 1. Architecture Diagram

```nomnoml
#title: Authentication Architecture
#direction: down

[<frame>Authentication Layer|
  [AuthProvider]
  [AuthContext]
  [useAuth Hook]
  [ProtectedRoute]
]

[<frame>Storage Layer|
  [localStorage|
    auth_token
    auth_user
  ]
]

[<frame>API Layer|
  [api.ts|
    login()
    logout()
    refreshToken()
    fetchCsrfToken()
  ]
]

[<frame>Backend|
  [POST /api/v1/auth/login]
  [POST /api/v1/auth/logout]
  [POST /api/v1/auth/refresh]
  [GET /api/v1/auth/csrf-token]
]

[AuthProvider]-->[AuthContext: provides state]
[useAuth Hook]-->[AuthContext: consumes state]
[ProtectedRoute]-->[useAuth Hook: checks auth]
[AuthProvider]-->[Storage Layer: persist/restore]
[AuthProvider]-->[API Layer: auth operations]
[API Layer]-->[Backend: HTTP requests]
```

## 2. Data Flow Diagram

```nomnoml
#title: Authentication Data Flow
#direction: right

[<start>App Mount]-->[AuthProvider Init]
[AuthProvider Init]-->[Check localStorage]

[Check localStorage]--yes>[Restore Session|
  token: string
  user: User
]
[Check localStorage]--no>[Anonymous State]

[Restore Session]-->[Validate Token]
[Validate Token]--expired>[Refresh Token]
[Validate Token]--valid>[Set Authenticated]

[Refresh Token]--success>[Set Authenticated]
[Refresh Token]--fail>[Clear State]

[<actor>User]-->[Login Action]
[Login Action]-->[POST /api/v1/auth/login]
[POST /api/v1/auth/login]--success>[Store Token + User]
[POST /api/v1/auth/login]--fail>[Show Error]

[Store Token + User]-->[Set Authenticated]
[Set Authenticated]-->[Fetch CSRF Token]

[<actor>User]-->[Logout Action]
[Logout Action]-->[POST /api/v1/auth/logout]
[POST /api/v1/auth/logout]-->[Clear localStorage]
[Clear localStorage]-->[Clear CSRF Token]
[Clear CSRF Token]-->[Set Anonymous]

[<actor>User]-->[Access Protected Route]
[Access Protected Route]-->[ProtectedRoute Check]
[ProtectedRoute Check]--authenticated>[Render Children]
[ProtectedRoute Check]--not_authenticated>[Redirect to /login]
```

## 3. Memory Management Diagram

```nomnoml
#title: State Persistence & Memory
#direction: down

[<frame>In-Memory State (React)|
  [AuthContext State|
    user: User | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
  ]
]

[<frame>Persistent Storage (localStorage)|
  [auth_token|
    JWT token string
    Expires: token.exp
  ]
  [auth_user|
    User object JSON
    Serialized user data
  ]
]

[<frame>Session Lifecycle|
  [Mount]-->[Restore from localStorage]
  [Login Success]-->[Write to localStorage]
  [Token Refresh]-->[Update localStorage]
  [Logout]-->[Clear localStorage]
  [Token Expired]-->[Clear localStorage]
]

[AuthContext State]<-->[Persistent Storage: sync]

[<note>Memory Safety|
  1. Clear sensitive data on logout
  2. Validate token before restore
  3. Handle parsing errors gracefully
  4. No passwords in storage
]
```

## 4. Optimization Strategy

```nomnoml
#title: Performance Optimization
#direction: down

[<frame>Memoization Strategy|
  [Context Value|
    useMemo: Prevents re-renders
    Dependencies: [user, token, isAuthenticated, isLoading, error]
  ]
  [Action Functions|
    useCallback: login, logout, refreshToken
    Dependencies: []
  ]
]

[<frame>Render Optimization|
  [AuthProvider|
    Single context provider
    Memoized value
    Stable action functions
  ]
  [useAuth Hook|
    Selective consumption
    Only re-renders on state changes
  ]
]

[<frame>Loading States|
  [Initial Load|
    isLoading: true
    Restore from localStorage
    Validate token
    isLoading: false
  ]
  [Login Flow|
    isLoading: true
    API request
    isLoading: false
  ]
]

[<note>Performance Targets|
  1. Context re-renders: Minimize via memoization
  2. localStorage operations: Async where possible
  3. Token validation: O(1) expiry check
  4. CSRF token: Fetch once per session
]
```

---

## 5. Interface Contracts

### User Type
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}
```

### AuthState Type
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
```

### AuthContextValue Type
```typescript
interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
```

### API Endpoints

**POST /api/v1/auth/login**
- Request: `{ email: string, password: string }`
- Response: `{ token: string, user: User }`
- Errors: 401 (invalid credentials), 429 (rate limit)

**POST /api/v1/auth/logout**
- Request: None (uses session cookie)
- Response: `{ success: boolean }`

**POST /api/v1/auth/refresh**
- Request: None (uses existing token)
- Response: `{ token: string, user: User }`
- Errors: 401 (token expired/invalid)

---

## 6. Security Considerations

1. **Token Storage**: JWT in localStorage (XSS risk acknowledged, CSRF protection via token)
2. **Token Expiry**: Checked on restore, automatic refresh on expiry
3. **CSRF Protection**: Fetch CSRF token after authentication
4. **Password Handling**: Never stored, only transmitted over HTTPS
5. **Error Messages**: Sanitized to prevent information disclosure

---

## 7. Error Handling Strategy

### Error States
1. **Invalid Credentials**: Display user-friendly error
2. **Network Error**: Display retry option
3. **Token Expired**: Auto-refresh or redirect to login
4. **Token Refresh Failed**: Clear state, redirect to login
5. **Logout Failed**: Clear local state regardless (defensive)

### Error Recovery
- **Automatic**: Token refresh on 401 responses
- **Manual**: User can retry login
- **Defensive**: Clear auth state on critical failures

---

## 8. Testing Strategy (25 Tests)

### Unit Tests: AuthContext Provider (8 tests)
1. Login flow with valid credentials
2. Login flow with invalid credentials (401)
3. Logout clears all state
4. Session persistence on page reload
5. Token refresh on expiry
6. Loading states during auth operations
7. Error states with proper messages
8. Multiple simultaneous login attempts (race condition)

### Integration Tests: useAuth Hook (10 tests)
1. Hook provides correct initial state
2. Login updates state correctly
3. Logout clears state correctly
4. Session restore from localStorage works
5. Token refresh works correctly
6. Hook throws error when used outside provider
7. Multiple components can consume hook simultaneously
8. State updates propagate to all consumers
9. Error state is accessible via hook
10. Loading state is accessible via hook

### Component Tests: ProtectedRoute (7 tests)
1. Renders children when authenticated
2. Redirects to /login when not authenticated
3. Shows loading state during auth check
4. Handles expired tokens correctly
5. Redirects maintain return URL
6. Works with nested routes
7. Handles auth state changes (user logs out)

---

## 9. Acceptance Criteria Checklist

- [ ] AuthContext provides login/logout/session state
- [ ] useAuth hook for component consumption
- [ ] ProtectedRoute wrapper component
- [ ] Session persistence in localStorage
- [ ] Automatic token refresh on expiry
- [ ] Loading states during auth operations
- [ ] 25+ comprehensive tests covering all scenarios
- [ ] TypeScript strict mode (no `any`, no `@ts-ignore`)
- [ ] All tests passing
- [ ] Documentation updated

---

## 10. Risk Assessment

**Risk Level**: MEDIUM
- **Blast Radius**: All authenticated pages
- **Dependencies**: Phase 2 and 3 depend on this
- **Mitigation**: Comprehensive tests, incremental rollout

**Known Risks**:
1. **XSS Vulnerability**: Token in localStorage (accepted trade-off)
2. **Race Conditions**: Multiple simultaneous logins (handled with loading state)
3. **Token Refresh Loops**: Prevented with max attempts counter
4. **Backward Compatibility**: No existing auth to break

---

## 11. Implementation Phases

1. **Phase A**: Types and interfaces (~30 min)
2. **Phase B**: AuthContext implementation (~60 min)
3. **Phase C**: useAuth hook (~30 min)
4. **Phase D**: ProtectedRoute component (~45 min)
5. **Phase E**: API endpoints (~30 min)
6. **Phase F**: Comprehensive tests (~120 min)
7. **Phase G**: Documentation (~30 min)

**Total Estimated Effort**: 5.75 hours
