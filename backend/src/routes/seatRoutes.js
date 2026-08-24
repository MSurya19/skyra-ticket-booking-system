"use strict";

const express =
    require("express");

const router =
    express.Router();


/* =========================================================
   SKYRA - PHYSICAL SEAT ROUTES
   File: backend/src/routes/seatRoutes.js

   PHASE 6
   ---------------------------------------------------------
   This router manages permanent physical Venue Seat records.

   Mount in app.js at:

   /api/admin/venues

   Final endpoints:

   GET
   /api/admin/venues/:venueId/seats

   PUT
   /api/admin/venues/:venueId/seat-layout

   IMPORTANT
   ---------------------------------------------------------
   These are physical Seat records only.

   AVAILABLE / HELD / BOOKED / OFFERED belong to ShowSeat
   later and are not handled here.
   ========================================================= */


/* =========================================================
   1. CONTROLLERS
   ========================================================= */

const {
    getVenueSeats,
    saveVenueSeatLayout
} =
    require(
        "../controllers/seatController"
    );


/* =========================================================
   2. AUTHENTICATION
   ========================================================= */

const {
    authMiddleware
} =
    require(
        "../middleware/authMiddleware"
    );


/* =========================================================
   3. ADMIN AUTHORIZATION
   ========================================================= */

const {
    adminOnly
} =
    require(
        "../middleware/roleMiddleware"
    );


/* =========================================================
   4. VALIDATION MIDDLEWARE
   ========================================================= */

const {
    validateBody,
    validateParams
} =
    require(
        "../middleware/validationMiddleware"
    );


/* =========================================================
   5. VALIDATORS
   ========================================================= */

const {
    validateVenueParams,
    validateSeatLayout
} =
    require(
        "../validators/venueValidator"
    );


/* =========================================================
   6. PROTECT ALL ROUTES

   Every physical Seat Layout endpoint requires:

   1. valid JWT
   2. ADMIN role
   ========================================================= */

router.use(
    authMiddleware
);

router.use(
    adminOnly
);


/* =========================================================
   7. GET VENUE PHYSICAL SEATS

   GET
   /api/admin/venues/:venueId/seats

   Response:

   {
       success: true,
       data: {
           seats: [...]
       }
   }
   ========================================================= */

router.get(
    "/:venueId/seats",

    validateParams(
        validateVenueParams
    ),

    getVenueSeats
);


/* =========================================================
   8. SAVE / REPLACE COMPLETE PHYSICAL SEAT LAYOUT

   PUT
   /api/admin/venues/:venueId/seat-layout

   The request body represents the COMPLETE desired layout.

   Example:

   [
       {
           row: "A",
           number: 1,
           label: "A1",
           categoryId: "...",
           active: true
       },
       {
           row: "A",
           number: 2,
           label: "A2",
           categoryId: "...",
           active: true
       }
   ]

   Important:

   - venueId from body is ignored
   - client Seat id is ignored
   - label is derived from row + number
   - categoryId must belong to this Venue
   - [] means clear the physical layout

   Validation is performed before the controller reaches
   venueService.saveVenueSeatLayout().
   ========================================================= */

router.put(
    "/:venueId/seat-layout",

    validateParams(
        validateVenueParams
    ),

    validateBody(
        validateSeatLayout
    ),

    saveVenueSeatLayout
);


/* =========================================================
   9. EXPORT
   ========================================================= */

module.exports =
    router;
