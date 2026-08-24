# SKYRA Authentication Design

## 1. Authentication Mechanism

SKYRA uses:

```text
Email + Password
      ↓
bcryptjs password verification
      ↓
JWT issued by backend
```

The JWT is sent in protected API requests as:

```http
Authorization: Bearer <token>
```

## 2. Role Model

Supported roles:

```text
CUSTOMER
ORGANISER
ADMIN
```

Authentication answers:

```text
Who is this user?
```

Authorization answers:

```text
Is this user allowed to perform this action?
```

## 3. Middleware Design

Protected route flow:

```text
Request
  ↓
JWT authentication middleware
  ↓
Authenticated user
  ↓
Role middleware
  ↓
Controller
  ↓
Service
```

Some organiser routes also require resource-ownership verification.

## 4. Expected Security Behaviour

```text
No JWT                   → 401
Invalid/expired JWT      → 401
Wrong authenticated role → 403
Correct role             → route continues
```

## 5. Frontend Token Handling

The frontend retrieves the authenticated token from browser storage and attaches it to API requests.

The browser token is not trusted for authorization decisions beyond identification. The backend still enforces the user's current role and permissions.

## 6. Password Security

Passwords should:

- never be stored in plain text
- be hashed with bcryptjs
- never appear in logs
- never be returned by API responses
