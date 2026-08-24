"use strict";

const asyncHandler =
    require("../utils/asyncHandler");

const venueService =
    require("../services/venueService");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - VENUE CONTROLLER
   File: backend/src/controllers/venueController.js

   Phase 4:
   - Create Venue
   - List Venues
   - Get Venue
   - Update Venue
   - Soft Delete Venue
   - Venue summary

   Phase 5:
   - Create Seat Category
   - Update Seat Category
   - Delete Seat Category

   Controller responsibilities:
   - Receive HTTP request
   - Read validated/sanitized values
   - Call venueService.js
   - Return consistent JSON

   Controller does NOT:
   - talk directly to MongoDB
   - perform business logic
   - perform Admin authorization
   - create physical seats
   ========================================================= */


/* =========================================================
   1. HTTP STATUS FALLBACKS
   ========================================================= */

const STATUS_OK =
    HTTP_STATUS?.OK ||
    200;


const STATUS_CREATED =
    HTTP_STATUS?.CREATED ||
    201;


/* =========================================================
   2. GET VALIDATED REQUEST BODY

   Supports:

   req.validated.body
   req.validatedBody
   req.body
   ========================================================= */

function getRequestBody(
    req
) {

    if (
        req.validated &&
        req.validated.body
    ) {

        return req.validated.body;

    }


    if (
        req.validatedBody
    ) {

        return req.validatedBody;

    }


    return (
        req.body ||
        {}
    );

}


/* =========================================================
   3. GET VALIDATED QUERY
   ========================================================= */

function getRequestQuery(
    req
) {

    if (
        req.validated &&
        req.validated.query
    ) {

        return req.validated.query;

    }


    if (
        req.validatedQuery
    ) {

        return req.validatedQuery;

    }


    return (
        req.query ||
        {}
    );

}


/* =========================================================
   4. GET VALIDATED PARAMS

   Supports:

   req.validated.params
   req.validatedParams
   req.params
   ========================================================= */

function getRequestParams(
    req
) {

    if (
        req.validated &&
        req.validated.params
    ) {

        return req.validated.params;

    }


    if (
        req.validatedParams
    ) {

        return req.validatedParams;

    }


    return (
        req.params ||
        {}
    );

}


/* =========================================================
   5. GET VENUE ID
   ========================================================= */

function getVenueId(
    req
) {

    const params =
        getRequestParams(
            req
        );


    return (
        params.venueId ||
        params.id
    );

}


/* =========================================================
   6. GET SEAT CATEGORY ID
   ========================================================= */

function getSeatCategoryId(
    req
) {

    const params =
        getRequestParams(
            req
        );


    return (
        params.categoryId ||
        params.seatCategoryId
    );

}


/* =========================================================
   7. CREATE VENUE

   POST /api/admin/venues

   New Venue automatically begins with:

   capacity = 0
   seatCategories = []
   layoutConfigured = false
   ========================================================= */

const createVenue =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueData =
                getRequestBody(
                    req
                );


            const venue =
                await venueService
                    .createVenue(
                        venueData
                    );


            return res
                .status(
                    STATUS_CREATED
                )
                .json({

                    success:
                        true,

                    message:
                        "Venue created successfully.",

                    data: {

                        venue

                    }

                });

        }
    );


/* =========================================================
   8. GET ALL VENUES

   GET /api/admin/venues

   Supports:

   ?search=
   ?status=
   ?type=
   ?city=
   ?page=
   ?limit=
   ========================================================= */

const getVenues =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const query =
                getRequestQuery(
                    req
                );


            const result =
                await venueService
                    .getVenues(
                        query
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Venues retrieved successfully.",

                    data: {

                        venues:
                            result.venues,

                        pagination:
                            result.pagination

                    }

                });

        }
    );


/* =========================================================
   9. GET SINGLE VENUE

   GET /api/admin/venues/:venueId

   Used by:

   edit-venue.html
   seat-categories.html
   seat-layout.html
   ========================================================= */

const getVenue =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const venue =
                await venueService
                    .getVenueById(
                        venueId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Venue retrieved successfully.",

                    data: {

                        venue

                    }

                });

        }
    );


/* =========================================================
   10. UPDATE VENUE

   PATCH /api/admin/venues/:venueId

   Protected from this endpoint:

   capacity
   seatCategories
   layoutConfigured
   ========================================================= */

const updateVenue =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const updateData =
                getRequestBody(
                    req
                );


            const venue =
                await venueService
                    .updateVenue(
                        venueId,
                        updateData
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Venue updated successfully.",

                    data: {

                        venue

                    }

                });

        }
    );


/* =========================================================
   11. DELETE VENUE

   DELETE /api/admin/venues/:venueId

   Soft delete only.
   ========================================================= */

const deleteVenue =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const venue =
                await venueService
                    .softDeleteVenue(
                        venueId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Venue removed successfully.",

                    data: {

                        venue

                    }

                });

        }
    );


/* =========================================================
   12. GET ACTIVE VENUES

   Future Organiser functionality.
   ========================================================= */

const getActiveVenues =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venues =
                await venueService
                    .getActiveVenues();


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Active venues retrieved successfully.",

                    data: {

                        venues

                    }

                });

        }
    );


/* =========================================================
   13. GET VENUE COUNTS

   GET /api/admin/venues/summary
   ========================================================= */

const getVenueCounts =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const counts =
                await venueService
                    .getVenueCounts();


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Venue summary retrieved successfully.",

                    data: {

                        counts

                    }

                });

        }
    );


/* =========================================================
   PHASE 5 - SEAT CATEGORY CONTROLLERS
   ========================================================= */


/* =========================================================
   14. CREATE SEAT CATEGORY

   POST
   /api/admin/venues/:venueId/categories

   Request:

   {
       "name": "Premium",
       "code": "PREMIUM",
       "status": "ACTIVE",
       "description": "Premium seating section"
   }

   Response:

   {
       success: true,
       message: "...",
       data: {
           category: {...}
       }
   }
   ========================================================= */

const createSeatCategory =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const categoryData =
                getRequestBody(
                    req
                );


            const category =
                await venueService
                    .createSeatCategory(
                        venueId,
                        categoryData
                    );


            return res
                .status(
                    STATUS_CREATED
                )
                .json({

                    success:
                        true,

                    message:
                        "Seat category created successfully.",

                    data: {

                        category

                    }

                });

        }
    );


/* =========================================================
   15. GET ONE SEAT CATEGORY

   Not required by the current frontend,
   but useful internally/testing.

   GET
   /api/admin/venues/:venueId/categories/:categoryId
   ========================================================= */

const getSeatCategory =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const categoryId =
                getSeatCategoryId(
                    req
                );


            const category =
                await venueService
                    .getSeatCategory(
                        venueId,
                        categoryId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Seat category retrieved successfully.",

                    data: {

                        category

                    }

                });

        }
    );


/* =========================================================
   16. GET ALL SEAT CATEGORIES

   Optional helper endpoint.

   GET
   /api/admin/venues/:venueId/categories

   Current frontend can already read categories from
   GET /api/admin/venues or GET one Venue.
   ========================================================= */

const getSeatCategories =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const categories =
                await venueService
                    .getSeatCategories(
                        venueId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Seat categories retrieved successfully.",

                    data: {

                        categories

                    }

                });

        }
    );


/* =========================================================
   17. UPDATE SEAT CATEGORY

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

const updateSeatCategory =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const categoryId =
                getSeatCategoryId(
                    req
                );


            const updateData =
                getRequestBody(
                    req
                );


            const category =
                await venueService
                    .updateSeatCategory(
                        venueId,
                        categoryId,
                        updateData
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Seat category updated successfully.",

                    data: {

                        category

                    }

                });

        }
    );


/* =========================================================
   18. DELETE SEAT CATEGORY

   DELETE
   /api/admin/venues/:venueId/categories/:categoryId

   Service rejects deletion when:

   category.capacity > 0
   ========================================================= */

const deleteSeatCategory =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const categoryId =
                getSeatCategoryId(
                    req
                );


            const category =
                await venueService
                    .deleteSeatCategory(
                        venueId,
                        categoryId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Seat category deleted successfully.",

                    data: {

                        category

                    }

                });

        }
    );


/* =========================================================
   19. EXPORTS
   ========================================================= */

module.exports = {

    /* =====================================================
       PHASE 4 - VENUES
       ===================================================== */

    createVenue,

    getVenues,

    getVenue,

    updateVenue,

    deleteVenue,

    getActiveVenues,

    getVenueCounts,


    /* =====================================================
       PHASE 5 - SEAT CATEGORIES
       ===================================================== */

    createSeatCategory,

    getSeatCategory,

    getSeatCategories,

    updateSeatCategory,

    deleteSeatCategory

};