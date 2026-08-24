# SKYRA Architecture

## 1. Architectural Style

SKYRA uses a browser-based client/server architecture.

```text
Frontend
HTML + CSS + Vanilla JavaScript
        ↓
REST API + Socket.IO
        ↓
Node.js + Express
        ↓
MongoDB Atlas
```

External integrations:

```text
Express
 ├─ Razorpay Test Mode
 ├─ SMTP / Nodemailer
 └─ QR code generation
```

## 2. Frontend Responsibilities

The frontend is responsible for:

- page rendering
- form input and validation
- calling backend APIs
- storing/reusing authenticated session data
- Razorpay Checkout interaction
- displaying booking and waitlist status
- rendering the visual seat map
- listening for Socket.IO seat updates
- showing notifications and dashboard data

The frontend must not be the source of truth for:

- seat ownership
- hold validity
- payment verification
- booking status
- refund status
- waitlist order
- organiser ownership

Those decisions are enforced by the backend.

## 3. Backend Responsibilities

The Express backend is responsible for:

- authentication
- authorization
- validation
- business rules
- MongoDB persistence
- concurrency-safe seat updates
- temporary hold lifecycle
- payment creation and verification
- booking creation
- refund handling
- QR ticket generation
- waitlist offers
- notifications
- Socket.IO event emission

## 4. Database

MongoDB Atlas stores persistent application data.

Mongoose models represent the domain entities.

The most important architectural distinction is:

```text
Physical Seat != ShowSeat
```

Physical seats belong to venues.

ShowSeats belong to a specific show and contain runtime availability state.

## 5. Real-Time Layer

Socket.IO is used for real-time seat-status propagation.

Typical room strategy:

```text
show:<showId>
```

Customers viewing the same show join the same logical room.

When a seat changes state, the backend broadcasts a seat update.

## 6. External Services

### Razorpay

Used in Test Mode for:

- order creation
- payment confirmation
- refund request

### Nodemailer / SMTP

Used for:

- booking confirmation
- QR ticket email delivery

### QR Code

Used to generate a signed ticket verification payload.

## 7. Security Boundary

The browser is considered untrusted.

The backend revalidates:

- JWT
- user role
- resource ownership
- seat state
- hold ownership
- hold expiry
- payment verification
- booking eligibility
