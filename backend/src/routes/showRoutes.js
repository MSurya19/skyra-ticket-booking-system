"use strict";

const express =
    require("express");

const router =
    express.Router();

const customerRouter =
    express.Router();


const {
    getVenues,
    getVenue,
    createShow,
    getOrganiserShows,
    getShow,
    getShowSeats,
    generateShowSeats,
    updateShow,
    cancelShow,
    getCustomerShow,
    getCustomerShowSeats
} =
    require("../controllers/showController");


const {
    authMiddleware
} =
    require("../middleware/authMiddleware");


const {
    organiserOnly
} =
    require("../middleware/roleMiddleware");


const {
    validateBody,
    validateParams,
    validateQuery
} =
    require("../middleware/validationMiddleware");


const {
    validateCreateShow,
    validateUpdateShow,
    validateShowParams,
    validateVenueParams,
    validateCancelShow,
    validateShowListQuery
} =
    require("../validators/showValidator");


/* =========================================================
   ORGANISER SHOW ROUTES

   Mounted:
   /api/organiser/shows
   ========================================================= */

router.use(
    authMiddleware
);


router.use(
    organiserOnly
);


router.get(
    "/venues",
    getVenues
);


router.get(
    "/venues/:venueId",
    validateParams(
        validateVenueParams
    ),
    getVenue
);


router.get(
    "/",
    validateQuery(
        validateShowListQuery
    ),
    getOrganiserShows
);


router.post(
    "/",
    validateBody(
        validateCreateShow
    ),
    createShow
);


router.get(
    "/:showId/seats",
    validateParams(
        validateShowParams
    ),
    getShowSeats
);


router.post(
    "/:showId/generate-seats",
    validateParams(
        validateShowParams
    ),
    generateShowSeats
);


router.get(
    "/:showId",
    validateParams(
        validateShowParams
    ),
    getShow
);


router.patch(
    "/:showId",
    validateParams(
        validateShowParams
    ),
    validateBody(
        validateUpdateShow
    ),
    updateShow
);


router.patch(
    "/:showId/cancel",
    validateParams(
        validateShowParams
    ),
    validateBody(
        validateCancelShow
    ),
    cancelShow
);


/* =========================================================
   PHASE 10 - CUSTOMER/PUBLIC SHOW ROUTES

   Mounted:
   /api/shows
   ========================================================= */

customerRouter.get(
    "/:showId/seats",
    validateParams(
        validateShowParams
    ),
    getCustomerShowSeats
);


customerRouter.get(
    "/:showId",
    validateParams(
        validateShowParams
    ),
    getCustomerShow
);


module.exports =
    router;

module.exports.customerRouter =
    customerRouter;
