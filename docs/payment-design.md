# SKYRA Payment Design

## Provider

SKYRA uses Razorpay in **Test Mode**.

## Payment Flow

```text
Active SeatHold
      ↓
POST /api/payments/order
      ↓
Razorpay Order
      ↓
Razorpay Checkout
      ↓
Payment completed by customer
      ↓
POST /api/payments/verify
      ↓
Backend signature verification
      ↓
Payment VERIFIED
```

## Booking Rule

Frontend success alone is insufficient.

A booking should only be created after backend payment verification.

## Stored Payment Data

Typical payment information includes:

```text
holdId
razorpayOrderId
razorpayPaymentId
amountPaise
grandTotal
status
refundStatus
refundId
```

## Refund Flow

```text
Confirmed Booking
      ↓
Cancellation
      ↓
Razorpay refund request
      ↓
refundId saved
      ↓
refundStatus updated
```

The application tracks refund state independently from booking status because gateway processing may be asynchronous.

## Security

Never expose:

```text
RAZORPAY_KEY_SECRET
```

to frontend JavaScript.

The secret belongs only in the backend environment.
