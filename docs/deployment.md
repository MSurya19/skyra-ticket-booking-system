# SKYRA Deployment Guide

Deployment should be performed only after local testing is complete.

## Recommended Targets

### Frontend
- Vercel
- Netlify

### Backend
- Render
- Railway

### Database
- MongoDB Atlas

### Payment
- Razorpay Test Mode during evaluation/testing

## 1. Production Environment Variables

Configure backend deployment variables:

```text
NODE_ENV=production
PORT=<platform-provided-or-configured-port>

MONGO_URI=<MongoDB Atlas URI>

JWT_SECRET=<strong production secret>
JWT_EXPIRES_IN=7d

FRONTEND_URL=https://your-frontend-domain.example

TICKET_PUBLIC_BASE_URL=https://your-backend-domain.example

RAZORPAY_KEY_ID=<test or production key id>
RAZORPAY_KEY_SECRET=<secret>

MAIL_HOST=<smtp host>
MAIL_PORT=<smtp port>
MAIL_SECURE=<true/false>
MAIL_USER=<smtp user>
MAIL_PASSWORD=<smtp password>
MAIL_FROM=<sender>
```

## 2. CORS

The backend must allow the deployed frontend origin.

Example:

```text
https://skyra.example.com
```

Do not leave an unnecessary unrestricted origin in production.

## 3. Frontend API Base URL

Change the frontend API configuration from:

```text
http://localhost:5000
```

to the deployed backend URL.

Example:

```text
https://skyra-api.onrender.com
```

## 4. Socket.IO

The frontend Socket.IO client must connect to the deployed backend.

The backend hosting provider must support WebSockets.

## 5. QR Ticket Public URL

Set:

```text
TICKET_PUBLIC_BASE_URL
```

to the publicly reachable backend URL so scanned QR tickets open correctly outside the developer machine.

## 6. MongoDB Atlas

Configure Atlas Network Access so the deployed backend can connect.

Use a dedicated database user with only the permissions required by SKYRA.

## 7. Razorpay

For project demonstration:

```text
Razorpay Test Mode
```

For real production use, complete all Razorpay live-account requirements before switching to live keys.

## 8. Email

Use a production-compatible SMTP provider.

Do not store SMTP credentials in source code.

## 9. Deployment Verification

After deployment, repeat critical smoke tests:

```text
Login
Event discovery
Show discovery
Seat map
Hold
Payment
Booking
QR
Email
Cancellation
Waitlist
Socket.IO
Admin access
Organiser access
```

Also test from a second device/network because QR and WebSocket behaviour can differ from localhost.
