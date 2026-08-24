# SKYRA API Documentation

Base URL:

```text
http://localhost:5000/api
```

Protected routes require:

```http
Authorization: Bearer <JWT>
```

## Authentication

Typical authentication capabilities include:

```text
Register
Login
Forgot Password
Reset Password
Authenticated user/session lookup
```

JWT authentication is required for protected Customer, Organiser, and Admin routes.

## Customer Discovery

### GET /api/events

Returns customer-visible events.

Possible filters can include:

```text
search
type
city
language
date
sort
page
limit
```

### GET /api/events/:eventId

Returns event detail.

### GET /api/events/:eventId/shows

Returns shows for an event.

### GET /api/shows/:showId

Returns one customer-visible show.

### GET /api/shows/:showId/seats

Returns ShowSeats and their current runtime state.

## Seat Holds

### POST /api/holds

Create a temporary hold.

Example body:

```json
{
  "showId": "SHOW_ID",
  "seatIds": ["SHOW_SEAT_ID"]
}
```

### GET /api/holds/active?showId=:showId

Returns the authenticated customer's active hold for the show, if any.

### GET /api/holds/:holdId

Returns a specific hold if access is allowed.

### DELETE /api/holds/:holdId

Releases an active hold.

## Payments

### POST /api/payments/order

Creates a Razorpay order for an active hold.

### POST /api/payments/verify

Verifies Razorpay payment data.

### GET /api/payments/:paymentId

Returns payment information.

### GET /api/payments/hold/:holdId

Returns payment information associated with a hold.

## Bookings

Booking routes support confirmed booking lifecycle operations such as:

```text
Create booking
Get booking
Get booking by reference
Get customer bookings
Get QR ticket
Email ticket
Cancel booking
```

QR ticket helpers use booking routes including:

```text
GET  /api/bookings/:bookingId/ticket
POST /api/bookings/:bookingId/email-ticket
```

## Ticket Verification

Public ticket verification:

```text
GET /ticket/verify?ref=<booking-reference>&sig=<signature>
```

Optional JSON verification:

```text
GET /api/tickets/verify?ref=<booking-reference>&sig=<signature>
```

## Waitlist

### GET /api/waitlist/my

Returns the authenticated customer's waitlist records.

### POST /api/waitlist

Joins a waitlist for an eligible sold-out show/category.

### DELETE /api/waitlist/:id

Leaves a waitlist.

### POST /api/waitlist/offers/:offerId/claim

Claims a valid active waitlist offer and creates a temporary SeatHold.

## Notifications

Notification APIs support:

```text
List notifications
Read/unread state
Mark one as read
Mark all as read
```

## Admin

Admin routes are protected by JWT + ADMIN role.

Major resource groups:

```text
/api/admin/dashboard
/api/admin/users
/api/admin/organisers
/api/admin/bookings
/api/admin/venues
```

Venue-management routes include:

```text
GET    /api/admin/venues
GET    /api/admin/venues/:venueId
PATCH  /api/admin/venues/:venueId
DELETE /api/admin/venues/:venueId
```

Seat category routes are nested under a venue.

Physical seat-layout routes include:

```text
GET /api/admin/venues/:venueId/seats
PUT /api/admin/venues/:venueId/seat-layout
```

## Organiser

Organiser routes are protected by JWT + ORGANISER role and ownership checks.

Main route groups include:

```text
/api/organiser/events
/api/organiser/shows
/api/organiser/dashboard
/api/organiser/bookings
/api/organiser/revenue
```

Organisers can access only resources owned by that organiser.

## HTTP Status Expectations

Typical responses:

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
```

Examples verified during final security testing:

```text
No JWT → protected Admin route         401
Customer → Admin route                403
Organiser → Admin route               403
Admin → Admin route                   200
Customer → Organiser route            403
```
