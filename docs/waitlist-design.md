# SKYRA Waitlist Design

## Purpose

The waitlist handles demand when a seat category has no immediately available inventory.

## Join Rule

A customer can join only when the selected show/category is eligible for waitlisting.

An available seat should prevent inappropriate waitlist entry.

## Queue Record

A Waitlist entry stores:

```text
userId
showId
eventId
venueId
categoryId
categoryName
status
joinedAt
activeOfferId
```

## Automatic Offer

When an eligible seat becomes available:

```text
ShowSeat AVAILABLE
       ↓
Waitlist processor
       ↓
First eligible WAITING entry
       ↓
WaitlistOffer ACTIVE
       ↓
Waitlist OFFERED
       ↓
ShowSeat OFFERED
```

## Offer Claim

Endpoint:

```text
POST /api/waitlist/offers/:offerId/claim
```

Successful claim:

```text
Waitlist       CLAIMED
WaitlistOffer  CLAIMED
SeatHold       ACTIVE
ShowSeat       HELD
```

The customer must still complete normal checkout before the hold expires.

## Offer Expiry

If the customer does not claim within the offer window:

```text
WaitlistOffer ACTIVE
      ↓
EXPIRED
      ↓
ShowSeat becomes available / reassigned
      ↓
next eligible waiter
```

## Frontend States

The customer waitlist page can represent:

```text
Waiting
Offers
History
```

History includes completed terminal states such as:

```text
CLAIMED
EXPIRED
LEFT
```
