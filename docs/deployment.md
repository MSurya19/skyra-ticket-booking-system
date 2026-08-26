# SKYRA Deployment Guide

This document describes the final production deployment setup for **SKYRA — Movie/Event Ticket Booking System**.

SKYRA uses a separated frontend/backend architecture:

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB Atlas
- **Payment:** Razorpay Test Mode
- **Email:** Nodemailer + Brevo SMTP
- **Realtime communication:** Socket.IO

The application should be deployed only after local testing is complete.

---

## Demo Access for Project Review

The deployed SKYRA application includes the following demo accounts for evaluation:

| Role | Email | Password |
|---|---|---|
| Customer | `customer@skyra.com` | `Customer@1` |
| Organiser | `organizer@skyra.com` | `Organizer@1` |
| Admin | `admin@skyra.com` | `Admin@123` |

### Demo account email limitation

The demo accounts are intended for login and feature demonstration only. Their email addresses are not real accessible inboxes, so **email send/receive testing should not be performed with these demo addresses**. SKYRA may still trigger its transactional email workflow, but there is no real mailbox for the reviewer to receive those messages.

Use a SKYRA account with a **real accessible email address** to verify:

- password-reset email delivery
- booking confirmation email delivery
- QR ticket email delivery
- cancellation/refund email delivery
- waitlist-related transactional email delivery

This limitation applies only to the demo email identities; it does not indicate a failure in the Brevo/Nodemailer integration.

---

## 1. Final Deployment Architecture

```text
User Browser
     |
     v
Vercel Frontend
HTML + CSS + Vanilla JavaScript
     |
     | HTTPS REST API + Socket.IO
     v
Render Backend
Node.js + Express.js + Socket.IO
     |
     +--------------------+
     |                    |
     v                    v
MongoDB Atlas         Razorpay Test Mode
     |
     v
Brevo SMTP
     |
     v
Customer Email
```

The public production flow is:

```text
Customer
  -> Vercel frontend
  -> Render backend
  -> MongoDB Atlas
  -> Razorpay / Brevo / Socket.IO
```

---

## 2. Repository Structure

The GitHub repository contains both frontend and backend applications.

```text
skyra-ticket-booking-system/
|
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── customer/
│   ├── organiser/
│   ├── admin/
│   ├── css/
│   └── js/
│
├── backend/
│   ├── package.json
│   └── src/
│
└── docs/
```

Deployment is split as follows:

```text
Vercel -> frontend/
Render -> backend/
```

---

## 3. Backend Deployment — Render

### 3.1 Create the Render Web Service

Create a new **Web Service** in Render and connect the SKYRA GitHub repository.

Use the following service configuration:

```text
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm ci
Start Command: npm start
```

The backend `package.json` starts the application with:

```text
node src/server.js
```

Do not manually configure a fixed production `PORT` value in Render. Render supplies the port through `process.env.PORT`, and SKYRA reads that value automatically.

---

## 4. Render Production Environment Variables

Configure the following variables in:

```text
Render
-> SKYRA Backend Service
-> Environment
```

Never commit real credentials or secrets to GitHub.

```env
NODE_ENV=production

MONGO_URI=<mongodb-atlas-connection-string>

JWT_SECRET=<strong-private-jwt-secret>

FRONTEND_URL=https://skyra-ticket-booking.vercel.app

SEAT_HOLD_MINUTES=10
SEAT_HOLD_SWEEP_SECONDS=30
WAITLIST_OFFER_MINUTES=10

SKYRA_CONVENIENCE_FEE=99

RAZORPAY_KEY_ID=<razorpay-test-key-id>
RAZORPAY_KEY_SECRET=<razorpay-test-key-secret>

MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=2525
MAIL_SECURE=false
MAIL_USER=<brevo-smtp-login>
MAIL_PASS=<brevo-smtp-key>
MAIL_FROM_NAME=SKYRA
MAIL_FROM=<verified-brevo-sender-email>

TICKET_QR_SECRET=<private-random-qr-secret>
TICKET_PUBLIC_BASE_URL=https://<render-backend>.onrender.com
```

### Important notes

- Use `MAIL_PASS`, not `MAIL_PASSWORD`.
- Do not use a Gmail password or Gmail App Password for the Render deployment.
- `MAIL_USER` must contain the Brevo SMTP login.
- `MAIL_PASS` must contain the Brevo SMTP key.
- `MAIL_FROM` must contain a sender address verified in Brevo.
- `TICKET_PUBLIC_BASE_URL` must point to the public Render backend URL.
- `FRONTEND_URL` must contain the exact Vercel origin, including `https://` and without a trailing `/`.
- Keep Razorpay in **Test Mode** for project demonstration and evaluation.

### Generate a QR signing secret

A private QR secret can be generated locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store the generated value only in the Render environment configuration.

---

## 5. MongoDB Atlas Configuration

SKYRA uses MongoDB Atlas as the production database.

### 5.1 Database connection

Set:

```env
MONGO_URI=<MongoDB Atlas connection string>
```

The URI must reference the intended SKYRA database cluster.

### 5.2 Network Access

Render must be allowed to connect to MongoDB Atlas.

In Atlas:

```text
Security
-> Network Access
-> IP Access List
```

Add the outbound IP/CIDR ranges used by the Render service.

For a short-lived academic/demo deployment, `0.0.0.0/0` can be used temporarily, but restricting access to Render's outbound ranges is preferred.

Do not remove an existing local-development IP entry if the local backend still needs Atlas access.

### 5.3 Database user

Use a dedicated Atlas database user with only the permissions required by SKYRA.

Do not expose the database username or password in frontend code.

---

## 6. Brevo SMTP Configuration

SKYRA uses **Nodemailer** with **Brevo SMTP** for production email delivery.

Render configuration:

```env
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=2525
MAIL_SECURE=false
MAIL_USER=<brevo-smtp-login>
MAIL_PASS=<brevo-smtp-key>
MAIL_FROM_NAME=SKYRA
MAIL_FROM=<verified-sender-email>
```

Port `2525` is used for the Render deployment.

The configured sender must be verified in Brevo before sending email.

SKYRA uses email for functionality such as:

- password reset
- booking confirmation
- QR ticket delivery
- booking/cancellation communication
- waitlist-related communication where applicable

Never store SMTP credentials inside source files.

---

## 7. Razorpay Configuration

SKYRA uses **Razorpay Test Mode** during development, evaluation and project demonstration.

Configure:

```env
RAZORPAY_KEY_ID=<razorpay-test-key-id>
RAZORPAY_KEY_SECRET=<razorpay-test-key-secret>
```

The key secret must remain backend-only.

The frontend should receive only the public key information required to initialize Razorpay Checkout through the application's backend flow.

Before switching to real payments, complete Razorpay live-account requirements and replace the Test Mode credentials with approved live credentials.

---

## 8. QR Ticket Production Configuration

QR tickets must contain publicly reachable verification URLs.

Configure:

```env
TICKET_PUBLIC_BASE_URL=https://<render-backend>.onrender.com
TICKET_QR_SECRET=<private-random-secret>
```

Do not use:

```text
localhost
127.0.0.1
private LAN IP addresses
```

inside production QR ticket URLs.

This ensures a QR ticket can be scanned from another phone or network and still reach the deployed SKYRA backend.

---

## 9. Frontend Production Configuration

SKYRA uses:

```text
frontend/js/config.js
```

for environment-aware frontend configuration.

Recommended structure:

```javascript
"use strict";

(() => {
    const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    const backendBaseUrl =
        isLocal
            ? "http://localhost:5000"
            : "https://<render-backend>.onrender.com";

    window.SKYRA_CONFIG = Object.freeze({
        API_BASE_URL: backendBaseUrl + "/api",
        REALTIME_BASE_URL: backendBaseUrl
    });
})();
```

This produces:

```text
Local frontend
-> http://localhost:5000

Vercel frontend
-> Render production backend
```

The production Render URL is used for both:

- REST API requests
- Socket.IO realtime communication

`config.js` must be loaded before scripts that make API or Socket.IO requests.

---

## 10. Frontend Deployment — Vercel

Create a new Vercel project and import the SKYRA GitHub repository.

Use:

```text
Branch: main
Root Directory: frontend
Framework Preset: Other
```

The SKYRA frontend is a static HTML/CSS/Vanilla JavaScript application, so no React or frontend build framework is required.

Deploy the project and obtain the production URL.

Configured production frontend:

```text
https://skyra-ticket-booking.vercel.app
```

After receiving the Vercel URL, make sure Render contains:

```env
FRONTEND_URL=https://skyra-ticket-booking.vercel.app
```

Save the environment change and redeploy/restart the Render backend if required.

---

## 11. CORS Configuration

The deployed backend must allow requests from the deployed Vercel frontend.

Production origin:

```text
https://skyra-ticket-booking.vercel.app
```

The origin must match exactly.

Incorrect:

```text
skyra-ticket-booking.vercel.app
```

Correct:

```text
https://skyra-ticket-booking.vercel.app
```

Avoid unnecessary unrestricted CORS policies in production.

---

## 12. Socket.IO Deployment

Socket.IO runs on the same Render HTTP server as the Express application.

Production flow:

```text
Vercel Browser
-> Socket.IO
-> Render Backend
-> MongoDB ShowSeat updates
-> connected clients
```

The frontend must connect to:

```text
https://<render-backend>.onrender.com
```

and not to:

```text
http://localhost:5000
```

Realtime production verification should use two browser sessions:

1. Open the same show's seat-selection page in two browsers.
2. Hold an available seat in Browser A.
3. Confirm Browser B receives the seat-state update without refreshing.
4. Confirm Browser B cannot select the already-held seat.
5. Release or allow the hold to expire.
6. Confirm the seat becomes available again in Browser B without refreshing.

---

## 13. Production Email Test

A safe production SMTP test is the Forgot Password flow.

From the Vercel frontend:

```text
Forgot Password
-> Render API
-> Nodemailer
-> Brevo SMTP
-> Customer mailbox
```

The received reset link must use the Vercel frontend domain:

```text
https://skyra-ticket-booking.vercel.app/reset-password.html?token=...
```

It must not contain `localhost`.

---

## 14. Production Deployment Verification

After deployment, verify the complete production workflow.

| Test | Expected Result |
|---|---|
| Homepage | Loads correctly from Vercel |
| Registration | New customer account can be created |
| Login | Authentication succeeds through Render |
| Role protection | CUSTOMER / ORGANISER / ADMIN access rules remain enforced |
| Event discovery | Customer events load from MongoDB Atlas |
| Show discovery | Shows load correctly |
| Seat map | Real ShowSeat data is displayed |
| Seat hold | Selected seats become HELD |
| Concurrency | Another customer cannot hold the same seat |
| Socket.IO | Seat changes appear without page refresh |
| Razorpay | Test Checkout opens successfully |
| Booking | Successful test payment creates a confirmed booking |
| QR ticket | Ticket contains a public verification URL |
| Email | Brevo sends booking/reset emails successfully |
| Cancellation | Booking cancellation works |
| Refund | Razorpay Test Mode refund flow works |
| Seat release | Cancelled/expired seats become available |
| Waitlist | Customer can join waitlist |
| Automatic offer | Released seat can create the next waitlist offer |
| Notifications | Customer notifications are generated correctly |
| Organiser dashboard | Organiser data/revenue loads correctly |
| Admin dashboard | Admin system data loads correctly |

### Production verification status

The SKYRA deployment is verified for the critical customer, organiser, admin, payment, QR, email, waitlist and realtime flows.

---

## 15. Security Requirements

The following values must never be committed to GitHub or exposed in frontend JavaScript:

```text
MongoDB password
JWT secret
Razorpay key secret
Brevo SMTP key
Brevo SMTP login credentials
QR signing secret
```

Keep the real backend `.env` file out of Git using `.gitignore`.

Only environment-variable names and placeholders should appear in documentation or `.env.example`.

Also ensure:

- production CORS is restricted to the correct frontend origin
- JWT-protected routes still enforce roles
- admin and organiser APIs cannot be accessed using customer tokens
- QR verification does not expose secrets
- MongoDB Atlas access is restricted appropriately

---

## 16. Redeployment Workflow

### Frontend update

After changing frontend files:

```powershell
git add frontend
git commit -m "Update SKYRA frontend"
git push origin main
```

Vercel will redeploy the connected project automatically.

### Backend update

After changing backend files:

```powershell
git add backend
git commit -m "Update SKYRA backend"
git push origin main
```

Render will redeploy automatically when automatic deploys are enabled. Otherwise use:

```text
Render
-> Manual Deploy
-> Deploy latest commit
```

---

## 17. Deployment Troubleshooting

### MongoDB connection failure

Typical message:

```text
Could not connect to any servers in your MongoDB Atlas cluster
```

Check:

- `MONGO_URI`
- Atlas database credentials
- Atlas Network Access/IP allowlist
- Render outbound IP ranges

### Vercel login says backend is not running

Check browser Developer Tools -> Network.

Confirm requests are going to:

```text
https://<render-backend>.onrender.com/api/...
```

and not:

```text
http://localhost:5000/api/...
```

Also verify:

```env
FRONTEND_URL=https://skyra-ticket-booking.vercel.app
```

### CORS failure

Ensure `FRONTEND_URL` includes:

```text
https://
```

and matches the Vercel origin exactly.

### Brevo email failure

Verify:

```env
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=2525
MAIL_SECURE=false
MAIL_USER=<brevo-smtp-login>
MAIL_PASS=<brevo-smtp-key>
```

Do not use `MAIL_PASSWORD` because the current SKYRA mail configuration reads `MAIL_PASS`.

### QR opens localhost

Set:

```env
TICKET_PUBLIC_BASE_URL=https://<render-backend>.onrender.com
```

and redeploy the backend before generating a new ticket.

### Socket.IO does not update seats

Check that the browser connects to the Render domain and that the Vercel frontend is permitted by the backend Socket.IO/CORS configuration.

---

## 18. Final Production Stack

```text
Frontend       : Vercel
Backend        : Render
Database       : MongoDB Atlas
Authentication : JWT + bcryptjs
Payments       : Razorpay Test Mode
Email          : Nodemailer + Brevo SMTP
QR Tickets     : qrcode + signed public verification URL
Realtime       : Socket.IO
Scheduling     : backend expiration/release jobs
Source Control : GitHub
```

---

## 19. Final Deployment Checklist

```text
[✓] GitHub repository pushed
[✓] Secrets excluded from Git
[✓] Render backend deployed
[✓] MongoDB Atlas connected
[✓] Render environment variables configured
[✓] Brevo SMTP configured
[✓] Razorpay Test Mode configured
[✓] Public QR base URL configured
[✓] Vercel frontend deployed
[✓] FRONTEND_URL changed to Vercel HTTPS origin
[✓] Frontend production API URL points to Render
[✓] Socket.IO points to Render
[✓] Login tested
[✓] Customer pages tested
[✓] Organiser pages tested
[✓] Admin pages tested
[✓] Seat hold and concurrency tested
[✓] Razorpay test booking tested
[✓] QR ticket tested
[✓] Email tested
[✓] Cancellation/refund tested
[✓] Waitlist tested
[✓] Realtime seat updates tested
```

---

## 20. Deployment Summary

SKYRA is deployed as a three-tier web application:

```text
Vercel frontend
      |
      v
Render Node.js/Express backend
      |
      v
MongoDB Atlas
```

External services are integrated through the backend:

```text
Razorpay -> payment processing
Brevo    -> transactional email
Socket.IO -> realtime seat availability
```

This architecture keeps browser-facing code separate from sensitive backend credentials while providing a publicly accessible deployment suitable for project review, demonstration and testing.
