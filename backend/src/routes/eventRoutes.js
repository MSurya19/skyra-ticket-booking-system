"use strict";

const express =
    require("express");

const router =
    express.Router();

const customerRouter =
    express.Router();


const {
    createEvent,
    getOrganiserEvents,
    getEvent,
    updateEvent,
    deleteEvent,
    getCustomerEvents,
    getCustomerEvent,
    getCustomerEventShows
} =
    require("../controllers/eventController");


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
    validateCreateEvent,
    validateUpdateEvent,
    validateEventParams,
    validateEventListQuery,
    validateCustomerEventListQuery
} =
    require("../validators/eventValidator");


/* =========================================================
   ORGANISER EVENT ROUTES

   Mounted:
   /api/organiser/events
   ========================================================= */

router.use(
    authMiddleware
);


router.use(
    organiserOnly
);


router.get(
    "/",
    validateQuery(
        validateEventListQuery
    ),
    getOrganiserEvents
);


router.post(
    "/",
    validateBody(
        validateCreateEvent
    ),
    createEvent
);


router.get(
    "/:eventId",
    validateParams(
        validateEventParams
    ),
    getEvent
);


router.patch(
    "/:eventId",
    validateParams(
        validateEventParams
    ),
    validateBody(
        validateUpdateEvent
    ),
    updateEvent
);


router.delete(
    "/:eventId",
    validateParams(
        validateEventParams
    ),
    deleteEvent
);


/* =========================================================
   PHASE 10 - CUSTOMER/PUBLIC EVENT ROUTES

   Mounted:
   /api/events

   These are read-only discovery endpoints.
   They intentionally do not expose organiser management
   fields or DRAFT/ARCHIVED/deleted Events.
   ========================================================= */

customerRouter.get(
    "/",
    validateQuery(
        validateCustomerEventListQuery
    ),
    getCustomerEvents
);


customerRouter.get(
    "/:eventId/shows",
    validateParams(
        validateEventParams
    ),
    getCustomerEventShows
);


customerRouter.get(
    "/:eventId",
    validateParams(
        validateEventParams
    ),
    getCustomerEvent
);


module.exports =
    router;


/*
   Preserve the frozen folder/file structure:
   no additional customer route file is required.
*/
module.exports.customerRouter =
    customerRouter;
