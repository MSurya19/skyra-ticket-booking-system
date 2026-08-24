# SKYRA Testing

## Phase 23 — Full System Testing

The complete local application was tested after removing remaining frontend mock data.

## 1. Customer Booking Flow

Validated:

```text
Customer login
→ Event
→ Show
→ Seat selection
→ Seat hold
→ Razorpay payment
→ Payment verification
→ Booking
→ QR ticket
→ Confirmation email
```

Result:

```text
PASS
```

## 2. Cancellation / Refund / Seat Release

Validated:

```text
Confirmed booking
→ Cancel
→ Refund request
→ Booking CANCELLED
→ Refund state tracked
→ ShowSeat AVAILABLE
```

Result:

```text
PASS
```

## 3. Concurrency

Two-browser test:

```text
Customer A holds seat
Customer B views same show
Customer B cannot acquire same seat
```

Result:

```text
PASS
```

## 4. Waitlist

Validated:

```text
Sold-out Standard category
→ Customer joins waitlist
→ WAITING position established
→ cancellation releases eligible seat
→ automatic offer created
→ offer claimed
→ SeatHold created
→ frontend All/History rendering verified
```

Result:

```text
PASS
```

## 5. Socket.IO Real-Time Seat Updates

Validated in two browsers without refresh:

```text
B2 AVAILABLE → HELD
B2 HELD → AVAILABLE
```

Result:

```text
PASS
```

## 6. Security / Role Access

Validated:

```text
No JWT → Admin            401
Customer → Admin          403
Organiser → Admin         403
Admin → Admin             200
Customer → Organiser      403
```

Result:

```text
PASS
```

## 7. Final Smoke Test

Checked major functional pages for:

```text
Customer pages
Organiser pages
Admin pages
No blank pages
No blocking JavaScript failures
No remaining mock data
No unexpected 401/403 errors
Backend remains running
```

Result:

```text
PASS
```

## Overall Phase 23 Result

```text
PHASE 23 — FULL SYSTEM TESTING: COMPLETE
```

## Recommended Future Automated Tests

Add automated test coverage for:

- authentication
- role middleware
- venues
- seat categories
- physical seats
- events
- shows
- ShowSeat generation
- holds
- hold expiry
- concurrency
- payments
- bookings
- cancellation
- refunds
- waitlist
- waitlist offers
- notifications
