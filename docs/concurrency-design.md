# SKYRA Concurrency Design

## Problem

Two customers may attempt to reserve the same seat at nearly the same time.

Incorrect behaviour:

```text
Customer A → SUCCESS
Customer B → SUCCESS
```

Correct behaviour:

```text
Customer A → SUCCESS
Customer B → REJECTED
```

## Backend Authority

The frontend never decides whether a seat can be held.

The backend checks current database state before changing:

```text
AVAILABLE → HELD
```

If the seat is already:

```text
HELD
BOOKED
OFFERED
```

another incompatible hold request is rejected.

## Database-Level Principle

Seat updates must be performed conditionally so only a valid current state can transition.

Conceptual condition:

```text
Update ShowSeat
WHERE
    _id = requestedSeat
    AND status = AVAILABLE
```

If the update does not match, another process has already changed that seat.

## Real-Time Visibility

After the successful state transition, Socket.IO broadcasts the result.

```text
Customer A holds B2
       ↓
MongoDB B2 = HELD
       ↓
Socket.IO
       ↓
Customer B sees HELD
```

The Socket.IO event improves user experience but does not provide the concurrency guarantee. The database/backend does.
