"use strict";

/* =========================================================
   SKYRA - EXPRESS APPLICATION

   File:
   backend/src/app.js

   Purpose:
   - Create the Express application
   - Configure global middleware
   - Configure CORS
   - Parse incoming requests
   - Define base/health routes
   - Mount API routes
   - Handle 404 routes
   - Handle global errors

   Important:
   app.js creates/configures Express.
   server.js actually starts the HTTP server.
   ========================================================= */


const express =
    require("express");

const cors =
    require("cors");


const env =
    require("./config/env");


const {
    notFoundMiddleware,
    errorMiddleware
} =
    require("./middleware/errorMiddleware");


/* =========================================================
   PHASE 2 ROUTES
   ========================================================= */

const authRoutes =
    require("./routes/authRoutes");


/* =========================================================
   PHASE 4 / 5 ROUTES

   Venue CRUD + embedded Seat Categories
   ========================================================= */

const venueRoutes =
    require("./routes/venueRoutes");


/* =========================================================
   PHASE 6 ROUTES

   Permanent physical Venue Seat Layout
   ========================================================= */

const seatRoutes =
    require("./routes/seatRoutes");


/* =========================================================
   PHASE 7 ROUTES

   Organiser Event Management
   ========================================================= */

const eventRoutes =
    require("./routes/eventRoutes");

const customerEventRoutes =
    eventRoutes.customerRouter;


/* =========================================================
   PHASE 8 ROUTES

   Organiser Show Management
   ========================================================= */

const showRoutes =
    require("./routes/showRoutes");

const customerShowRoutes =
    showRoutes.customerRouter;



/* =========================================================
   PHASE 11 ROUTES / JOB
   ========================================================= */

const holdRoutes =
    require("./routes/holdRoutes");

const {
    startExpiredHoldReleaseJob
} =
    require("./jobs/releaseExpiredHolds");


/* =========================================================
   PHASE 13 ROUTES
   ========================================================= */

const paymentRoutes =
    require("./routes/paymentRoutes");


/* =========================================================
   PHASE 14 ROUTES
   ========================================================= */

const bookingRoutes =
    require("./routes/bookingRoutes");


/* =========================================================
   PHASE 15 - PUBLIC SIGNED TICKET VERIFICATION
   ========================================================= */

const ticketVerificationRoutes =
    require("./routes/ticketVerificationRoutes");

const ticketVerificationApiRoutes =
    ticketVerificationRoutes.apiRouter;


/* =========================================================
   PHASE 17 - WAITLIST + AUTOMATIC OFFER
   ========================================================= */

const waitlistRoutes =
    require("./routes/waitlistRoutes");

const {
    startExpiredWaitlistOfferJob
} =
    require("./jobs/processExpiredWaitlistOffers");


/* =========================================================
   PHASE 18 - CUSTOMER NOTIFICATIONS
   ========================================================= */

const notificationRoutes =
    require("./routes/notificationRoutes");


/* =========================================================
   PHASE 20 - ADMIN DASHBOARD / USERS / ORGANISERS / BOOKINGS
   ========================================================= */

const adminRoutes =
    require("./routes/adminRoutes");


/* =========================================================
   PHASE 21 - ORGANISER DASHBOARD / BOOKINGS / REVENUE
   ========================================================= */

const organiserAnalyticsRoutes =
    require("./routes/organiserAnalyticsRoutes");



/* =========================================================
   1. CREATE EXPRESS APPLICATION
   ========================================================= */

const app =
    express();



/* =========================================================
   2. SECURITY / EXPRESS SETTINGS
   ========================================================= */

/*
   Express normally sends:

   X-Powered-By: Express

   We do not need to expose that information.
*/

app.disable(
    "x-powered-by"
);



/* =========================================================
   3. CORS CONFIGURATION

   During development our frontend may run from:

   http://127.0.0.1:5500
   http://localhost:5500

   Later production may use Vercel / Netlify.

   Multiple frontend URLs can be provided in .env:

   FRONTEND_URL=http://127.0.0.1:5500,http://localhost:5500
   ========================================================= */

const allowedOrigins =
    env.FRONTEND_URL
        .split(",")
        .map(
            (origin) =>
                origin.trim()
        )
        .filter(Boolean);


const corsOptions = {

    origin: (
        origin,
        callback
    ) => {

        /*
           Requests without an Origin header are allowed.

           Examples:
           - Postman
           - Thunder Client
           - curl
           - backend tests
           - server-to-server requests
        */

        if (!origin) {

            return callback(
                null,
                true
            );

        }


        /*
           Allow configured frontend origins.
        */

        if (
            allowedOrigins.includes(
                origin
            )
        ) {

            return callback(
                null,
                true
            );

        }


        /*
           Reject unknown browser origins.
        */

        const corsError =
            new Error(
                `CORS blocked request from origin: ${origin}`
            );


        corsError.statusCode =
            403;


        return callback(
            corsError
        );

    },


    methods: [

        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"

    ],


    allowedHeaders: [

        "Content-Type",
        "Authorization"

    ],


    credentials:
        true

};


app.use(
    cors(
        corsOptions
    )
);



/* =========================================================
   4. REQUEST BODY PARSERS
   ========================================================= */

/*
   Parse JSON request bodies.

   Example:

   POST /api/auth/login

   {
       "email": "customer@skyra.com",
       "password": "Password123"
   }

   Phase 6 Seat Layout also sends JSON arrays containing
   physical Seat records.
*/

app.use(
    express.json({

        limit:
            "1mb"

    })
);


/*
   Parse standard HTML form encoded bodies if needed.
*/

app.use(
    express.urlencoded({

        extended:
            true,

        limit:
            "1mb"

    })
);



/* =========================================================
   IMPORTANT FOR LATER - RAZORPAY WEBHOOK

   During the payment phase, Razorpay webhook verification
   will require access to the RAW request body.

   At that phase we will place the webhook-specific raw body
   middleware BEFORE express.json() for that route.

   Nothing needs to be changed for Phase 6.
   ========================================================= */



/* =========================================================
   5. ROOT ROUTE

   Simple API information endpoint.
   ========================================================= */

app.get(
    "/",
    (
        req,
        res
    ) => {

        return res
            .status(200)
            .json({

                success:
                    true,

                message:
                    "SKYRA Ticket Booking API is running"

            });

    }
);



/* =========================================================
   6. HEALTH CHECK

   Used to confirm that the Express application is alive.

   Later deployment services can also use this endpoint.
   ========================================================= */

app.get(
    "/api/health",
    (
        req,
        res
    ) => {

        return res
            .status(200)
            .json({

                success:
                    true,

                message:
                    "SKYRA API is running",

                server:
                    "online",

                environment:
                    env.NODE_ENV

            });

    }
);



/* =========================================================
   7. PHASE 2 - AUTHENTICATION ROUTES

   All routes inside authRoutes.js receive this prefix:

   /api/auth

   Therefore:

   POST /register
       becomes
   POST /api/auth/register

   POST /login
       becomes
   POST /api/auth/login

   GET /me
       becomes
   GET /api/auth/me
   ========================================================= */

app.use(
    "/api/auth",
    authRoutes
);



/* =========================================================
   8. PHASE 4 / 5 - ADMIN VENUE ROUTES

   Prefix:

   /api/admin/venues

   Examples:

   GET /
       -> GET /api/admin/venues

   POST /
       -> POST /api/admin/venues

   GET /summary
       -> GET /api/admin/venues/summary

   GET /:venueId
       -> GET /api/admin/venues/:venueId

   PATCH /:venueId
       -> PATCH /api/admin/venues/:venueId

   DELETE /:venueId
       -> DELETE /api/admin/venues/:venueId

   Phase 5 category examples:

   POST /:venueId/categories
       -> POST /api/admin/venues/:venueId/categories

   PATCH /:venueId/categories/:categoryId
       -> PATCH /api/admin/venues/:venueId/categories/:categoryId

   DELETE /:venueId/categories/:categoryId
       -> DELETE /api/admin/venues/:venueId/categories/:categoryId
   ========================================================= */

app.use(
    "/api/admin/venues",
    venueRoutes
);



/* =========================================================
   9. PHASE 6 - ADMIN PHYSICAL SEAT LAYOUT ROUTES

   seatRoutes.js uses the SAME base prefix because physical
   Seats belong to a Venue.

   Prefix:

   /api/admin/venues

   Routes inside seatRoutes.js:

   GET /:venueId/seats
       becomes
   GET /api/admin/venues/:venueId/seats

   PUT /:venueId/seat-layout
       becomes
   PUT /api/admin/venues/:venueId/seat-layout

   These routes are protected inside seatRoutes.js using:

   authMiddleware
       ↓
   adminOnly
       ↓
   validation
       ↓
   seatController
       ↓
   venueService
   ========================================================= */

app.use(
    "/api/admin/venues",
    seatRoutes
);


/* =========================================================
   PHASE 21 - ORGANISER DASHBOARD / BOOKINGS / REVENUE
   ========================================================= */

app.use(
    "/api/organiser",
    organiserAnalyticsRoutes
);


/* =========================================================
   PHASE 7 - ORGANISER EVENT MANAGEMENT
   ========================================================= */

app.use(
    "/api/organiser/events",
    eventRoutes
);


/* =========================================================
   PHASE 8 - ORGANISER SHOW MANAGEMENT
   ========================================================= */

app.use(
    "/api/organiser/shows",
    showRoutes
);


/* =========================================================
   PHASE 10 - CUSTOMER / PUBLIC DISCOVERY

   Read-only endpoints used by:
   - Homepage
   - Customer Dashboard
   - Explore Events
   - Event Details
   - Show Selection
   ========================================================= */

app.use(
    "/api/events",
    customerEventRoutes
);


app.use(
    "/api/shows",
    customerShowRoutes
);



/* =========================================================
   PHASE 11 - CUSTOMER TEMPORARY SEAT HOLDS
   ========================================================= */

app.use(
    "/api/holds",
    holdRoutes
);


/* =========================================================
   PHASE 13 - RAZORPAY PAYMENT
   ========================================================= */

app.use(
    "/api/payments",
    paymentRoutes
);


/* =========================================================
   PHASE 14 - CONFIRMED BOOKINGS
   ========================================================= */

app.use(
    "/api/bookings",
    bookingRoutes
);


/* =========================================================
   PHASE 17 - CUSTOMER WAITLIST
   ========================================================= */

app.use(
    "/api/waitlist",
    waitlistRoutes
);


/* =========================================================
   PHASE 18 - CUSTOMER NOTIFICATIONS
   ========================================================= */

app.use(
    "/api/notifications",
    notificationRoutes
);


/* =========================================================
   PHASE 20 - ADMIN SYSTEM
   ========================================================= */

app.use(
    "/api/admin",
    adminRoutes
);


/* =========================================================
   PHASE 15 - PUBLIC SIGNED TICKET VERIFICATION

   QR camera opens:
   GET /ticket/verify?ref=...&sig=...

   Optional JSON verification:
   GET /api/tickets/verify?ref=...&sig=...
   ========================================================= */

app.use(
    "/ticket",
    ticketVerificationRoutes
);

app.use(
    "/api/tickets",
    ticketVerificationApiRoutes
);


/*
   Expired SeatHolds must actively release their ShowSeats.
   Tests can disable the background timer with NODE_ENV=test.
*/
if (
    env.NODE_ENV !==
    "test"
) {

    startExpiredHoldReleaseJob();

    startExpiredWaitlistOfferJob();

}



/* =========================================================
   10. FUTURE API ROUTES

   These will be mounted phase by phase.

   Examples:

   /api/users
   /api/events
   /api/shows
   /api/holds
   /api/payments
   /api/bookings
   /api/waitlist
   /api/notifications
   /api/dashboard

   Current implemented Admin Venue APIs:

   Phase 4:
   /api/admin/venues

   Phase 5:
   /api/admin/venues/:venueId/categories

   Phase 6:
   /api/admin/venues/:venueId/seats
   /api/admin/venues/:venueId/seat-layout
   ========================================================= */



/* =========================================================
   11. 404 - ROUTE NOT FOUND

   IMPORTANT:
   This must come AFTER every valid route.
   ========================================================= */

app.use(
    notFoundMiddleware
);



/* =========================================================
   12. GLOBAL ERROR HANDLER

   IMPORTANT:
   This must be the LAST middleware in app.js.
   ========================================================= */

app.use(
    errorMiddleware
);



/* =========================================================
   13. EXPORT APP
   ========================================================= */

module.exports =
    app;
