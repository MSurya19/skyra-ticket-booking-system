# SKYRA Security

## 1. Authentication

Protected routes require a valid JWT.

Expected behaviour:

```text
Missing token  → 401
Invalid token  → 401
Expired token  → 401
```

## 2. Role-Based Authorization

Role middleware separates:

```text
CUSTOMER
ORGANISER
ADMIN
```

Expected behaviour:

```text
Authenticated wrong role → 403
```

## 3. Organiser Ownership

Organisers must not be able to access another organiser's:

- events
- shows
- bookings
- revenue

Ownership is checked on the backend.

## 4. Seat Security

The backend verifies all seat operations.

The browser cannot legitimately force:

```text
BOOKED → AVAILABLE
HELD by another user → BOOKED
AVAILABLE → BOOKED without valid flow
```

## 5. Payment Security

Razorpay secret keys stay only on the backend.

Payment verification occurs on the backend.

## 6. Environment Security

Sensitive values belong in `.env`:

```text
MONGO_URI
JWT_SECRET
RAZORPAY_KEY_SECRET
MAIL_PASSWORD
```

Never:

- commit `.env`
- print secrets into logs
- paste secrets into frontend files
- expose secrets through API responses

## 7. Password Security

Passwords are hashed using bcryptjs.

Plain-text passwords are never persisted.

## 8. Input Validation

Backend controllers/routes should validate:

- required fields
- MongoDB IDs
- enumerated values
- seat/category ownership
- event/show ownership
- request state

## 9. Final Role Security Test

Verified expected status codes:

```text
No JWT → Admin            401
Customer → Admin          403
Organiser → Admin         403
Admin → Admin             200
Customer → Organiser      403
```
