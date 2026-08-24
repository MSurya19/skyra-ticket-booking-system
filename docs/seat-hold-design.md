# SKYRA Seat Hold Design

## Purpose

Temporary holds prevent one customer from losing selected seats while completing checkout.

## Hold Flow

```text
ShowSeat AVAILABLE
        ↓
POST /api/holds
        ↓
SeatHold ACTIVE
        ↓
ShowSeat HELD
```

The hold stores:

```text
userId
showId
showSeatIds
status
createdAt
expiresAt
```

## Expiration

A hold is time-limited.

The backend runs an expired-hold release job.

Conceptually:

```text
ACTIVE hold
   ↓ expiry reached
EXPIRED
   ↓
ShowSeat AVAILABLE
```

## Manual Release

A customer can release an active hold:

```text
DELETE /api/holds/:holdId
```

Result:

```text
SeatHold RELEASED
ShowSeat AVAILABLE
```

## Booking Consumption

A confirmed booking consumes the hold:

```text
SeatHold ACTIVE
      ↓
Payment VERIFIED
      ↓
Booking CONFIRMED
      ↓
SeatHold CONSUMED
      ↓
ShowSeat BOOKED
```

## Validation

Before booking, the backend verifies:

- hold exists
- hold belongs to authenticated customer
- hold is ACTIVE
- hold has not expired
- ShowSeats are still associated with that hold
