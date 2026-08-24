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
   SKYRA - PHYSICAL SEAT CONTROLLER
   File: backend/src/controllers/seatController.js

   PURPOSE
   ---------------------------------------------------------
   Phase 6 Admin Seat Layout HTTP controller.

   Endpoints:

   GET
   /api/admin/venues/:venueId/seats

   PUT
   /api/admin/venues/:venueId/seat-layout

   IMPORTANT
   ---------------------------------------------------------
   Database/business logic belongs in venueService.js.

   The Phase 6 venueService functions used here are:

   getVenueSeats()
   saveVenueSeatLayout()

   They will be added when we wire the complete Phase 6
   persistence logic.
   ========================================================= */


/* =========================================================
   1. HTTP STATUS
   ========================================================= */

const STATUS_OK =
    HTTP_STATUS?.OK ||
    200;


/* =========================================================
   2. GET VALIDATED PARAMS
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


    if (req.validatedParams) {

        return req.validatedParams;

    }


    return (
        req.params ||
        {}
    );

}


/* =========================================================
   3. GET VENUE ID
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
   4. GET REQUEST BODY

   Supports the same validation-middleware conventions
   already used by SKYRA Venue controllers.
   ========================================================= */

function getRequestBody(
    req
) {

    if (
        req.validated &&
        req.validated.body !==
            undefined
    ) {

        return req.validated.body;

    }


    if (
        req.validatedBody !==
        undefined
    ) {

        return req.validatedBody;

    }


    return (
        req.body ??
        {}
    );

}


/* =========================================================
   5. EXTRACT SEAT ARRAY

   Frontend currently sends the array directly:

   [
       {
           id,
           venueId,
           row,
           number,
           label,
           categoryId,
           active
       }
   ]

   Also accept:

   {
       seats: [...]
   }

   so the endpoint remains flexible.
   ========================================================= */

function getSeatLayoutPayload(
    req
) {

    const body =
        getRequestBody(
            req
        );


    if (
        Array.isArray(
            body
        )
    ) {

        return body;

    }


    if (
        body &&
        Array.isArray(
            body.seats
        )
    ) {

        return body.seats;

    }


    return body;

}


/* =========================================================
   6. GET VENUE PHYSICAL SEATS

   GET /api/admin/venues/:venueId/seats
   ========================================================= */

const getVenueSeats =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const seats =
                await venueService
                    .getVenueSeats(
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
                        "Physical seats retrieved successfully.",

                    data: {

                        seats

                    }

                });

        }
    );


/* =========================================================
   7. SAVE COMPLETE VENUE SEAT LAYOUT

   PUT /api/admin/venues/:venueId/seat-layout

   Saving an empty array intentionally clears the layout.

   Backend service responsibilities:
   - validate every seat
   - verify each category belongs to Venue
   - create/update/delete physical Seat documents
   - derive Venue.capacity
   - derive each category.capacity
   - set Venue.layoutConfigured
   ========================================================= */

const saveVenueSeatLayout =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const venueId =
                getVenueId(
                    req
                );


            const seats =
                getSeatLayoutPayload(
                    req
                );


            const savedSeats =
                await venueService
                    .saveVenueSeatLayout(
                        venueId,
                        seats
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Physical seat layout saved successfully.",

                    data: {

                        seats:
                            savedSeats

                    }

                });

        }
    );


/* =========================================================
   8. EXPORTS
   ========================================================= */

module.exports = {

    getVenueSeats,

    saveVenueSeatLayout

};
