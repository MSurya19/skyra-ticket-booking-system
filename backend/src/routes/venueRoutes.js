"use strict";

const express =
    require("express");

const router =
    express.Router();


/* =========================================================
   SKYRA - VENUE ROUTES

   File:
   backend/src/routes/venueRoutes.js

   Mounted in app.js at:

   /api/admin/venues

   All routes are:
   - Authenticated
   - ADMIN only

   Phase 4:
   - Venue CRUD
   - Venue summary

   Phase 5:
   - Seat Category CRUD
   ========================================================= */


/* =========================================================
   1. CONTROLLER
   ========================================================= */

const {
    /* Phase 4 - Venue */
    createVenue,
    getVenues,
    getVenue,
    updateVenue,
    deleteVenue,
    getVenueCounts,

    /* Phase 5 - Seat Categories */
    createSeatCategory,
    getSeatCategory,
    getSeatCategories,
    updateSeatCategory,
    deleteSeatCategory
} =
    require(
        "../controllers/venueController"
    );


/* =========================================================
   2. AUTHENTICATION MIDDLEWARE
   ========================================================= */

const {
    authMiddleware
} =
    require(
        "../middleware/authMiddleware"
    );


/* =========================================================
   3. ROLE AUTHORIZATION
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
    validateParams,
    validateQuery
} =
    require(
        "../middleware/validationMiddleware"
    );


/* =========================================================
   5. VENUE + CATEGORY VALIDATORS
   ========================================================= */

const {
    /* Phase 4 */
    validateCreateVenue,
    validateUpdateVenue,
    validateVenueParams,
    validateVenueListQuery,

    /* Phase 5 */
    validateCreateSeatCategory,
    validateUpdateSeatCategory,
    validateSeatCategoryParams
} =
    require(
        "../validators/venueValidator"
    );


/* =========================================================
   6. PROTECT ALL ROUTES

   Request
      ↓
   authMiddleware
      ↓
   JWT verified
      ↓
   user loaded
      ↓
   adminOnly
      ↓
   ADMIN allowed

   CUSTOMER  -> 403
   ORGANISER -> 403
   ADMIN     -> allowed
   ========================================================= */

router.use(
    authMiddleware
);

router.use(
    adminOnly
);


/* =========================================================
   7. VENUE SUMMARY

   GET /api/admin/venues/summary

   IMPORTANT:
   Keep this BEFORE /:venueId so "summary"
   is never interpreted as a Venue ID.
   ========================================================= */

router.get(
    "/summary",

    getVenueCounts
);


/* =========================================================
   8. GET ALL VENUES

   GET /api/admin/venues

   Optional:

   ?search=
   ?status=
   ?type=
   ?city=
   ?page=
   ?limit=
   ========================================================= */

router.get(
    "/",

    validateQuery(
        validateVenueListQuery
    ),

    getVenues
);


/* =========================================================
   9. CREATE VENUE

   POST /api/admin/venues
   ========================================================= */

router.post(
    "/",

    validateBody(
        validateCreateVenue
    ),

    createVenue
);


/* =========================================================
   PHASE 5 - SEAT CATEGORY ROUTES
   ========================================================= */


/* =========================================================
   10. GET ALL CATEGORIES FOR ONE VENUE

   GET
   /api/admin/venues/:venueId/categories

   Example:

   /api/admin/venues/abc123/categories

   Response:

   {
       success: true,
       data: {
           categories: [...]
       }
   }

   This is useful for API testing and later frontend work.

   Current seat-categories.js can also receive categories
   through GET Venue data.
   ========================================================= */

router.get(
    "/:venueId/categories",

    validateParams(
        validateVenueParams
    ),

    getSeatCategories
);


/* =========================================================
   11. CREATE SEAT CATEGORY

   POST
   /api/admin/venues/:venueId/categories

   Body example:

   {
       "name": "Premium",
       "code": "PREMIUM",
       "status": "ACTIVE",
       "description": "Premium seating section"
   }

   Backend automatically sets:

   capacity = 0
   ========================================================= */

router.post(
    "/:venueId/categories",

    validateParams(
        validateVenueParams
    ),

    validateBody(
        validateCreateSeatCategory
    ),

    createSeatCategory
);


/* =========================================================
   12. GET ONE SEAT CATEGORY

   GET
   /api/admin/venues/:venueId/categories/:categoryId
   ========================================================= */

router.get(
    "/:venueId/categories/:categoryId",

    validateParams(
        validateSeatCategoryParams
    ),

    getSeatCategory
);


/* =========================================================
   13. UPDATE SEAT CATEGORY

   PATCH
   /api/admin/venues/:venueId/categories/:categoryId

   Editable:

   name
   code
   status
   description

   Protected:

   capacity
   _id
   ========================================================= */

router.patch(
    "/:venueId/categories/:categoryId",

    validateParams(
        validateSeatCategoryParams
    ),

    validateBody(
        validateUpdateSeatCategory
    ),

    updateSeatCategory
);


/* =========================================================
   14. DELETE SEAT CATEGORY

   DELETE
   /api/admin/venues/:venueId/categories/:categoryId

   Delete is rejected by the service when:

   category.capacity > 0

   because physical Seat records are using
   the category.
   ========================================================= */

router.delete(
    "/:venueId/categories/:categoryId",

    validateParams(
        validateSeatCategoryParams
    ),

    deleteSeatCategory
);


/* =========================================================
   PHASE 4 - SINGLE VENUE ROUTES
   ========================================================= */


/* =========================================================
   15. GET SINGLE VENUE

   GET /api/admin/venues/:venueId
   ========================================================= */

router.get(
    "/:venueId",

    validateParams(
        validateVenueParams
    ),

    getVenue
);


/* =========================================================
   16. UPDATE VENUE

   PATCH /api/admin/venues/:venueId

   Only normal Venue metadata can be modified.

   Protected:

   capacity
   seatCategories
   layoutConfigured
   ========================================================= */

router.patch(
    "/:venueId",

    validateParams(
        validateVenueParams
    ),

    validateBody(
        validateUpdateVenue
    ),

    updateVenue
);


/* =========================================================
   17. DELETE VENUE

   DELETE /api/admin/venues/:venueId

   This performs a SOFT DELETE.
   ========================================================= */

router.delete(
    "/:venueId",

    validateParams(
        validateVenueParams
    ),

    deleteVenue
);


/* =========================================================
   18. EXPORT
   ========================================================= */

module.exports =
    router;