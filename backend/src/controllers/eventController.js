"use strict";

const asyncHandler =
    require("../utils/asyncHandler");

const eventService =
    require("../services/eventService");

const showService =
    require("../services/showService");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - EVENT CONTROLLER
   File: backend/src/controllers/eventController.js
   ========================================================= */


const STATUS_OK =
    HTTP_STATUS?.OK ||
    200;

const STATUS_CREATED =
    HTTP_STATUS?.CREATED ||
    201;

const STATUS_UNAUTHORIZED =
    HTTP_STATUS?.UNAUTHORIZED ||
    401;


/* =========================================================
   VALIDATED REQUEST HELPERS
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


    return req.body || {};

}


function getRequestQuery(
    req
) {

    if (
        req.validated &&
        req.validated.query
    ) {

        return req.validated.query;

    }


    if (req.validatedQuery) {

        return req.validatedQuery;

    }


    return req.query || {};

}


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


    return req.params || {};

}


/* =========================================================
   AUTHENTICATED ORGANISER ID

   Supports the common request shapes used by SKYRA auth
   middleware and keeps the Event module decoupled from one
   property alias.
   ========================================================= */

function getOrganiserId(
    req
) {

    const value =
        req.user?._id ||
        req.user?.id ||
        req.auth?.userId ||
        req.auth?.id ||
        req.auth?.sub ||
        req.userId ||
        null;


    if (!value) {

        throw new ApiError(
            STATUS_UNAUTHORIZED,
            "Authentication required."
        );

    }


    return String(
        value
    );

}


function getEventId(
    req
) {

    const params =
        getRequestParams(
            req
        );


    return (
        params.eventId ||
        params.id
    );

}


/* =========================================================
   CREATE
   ========================================================= */

const createEvent =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const event =
                await eventService
                    .createEvent(
                        getOrganiserId(
                            req
                        ),
                        getRequestBody(
                            req
                        )
                    );


            return res
                .status(
                    STATUS_CREATED
                )
                .json({

                    success:
                        true,

                    message:
                        "Event created successfully.",

                    data: {

                        event

                    }

                });

        }
    );


/* =========================================================
   LIST
   ========================================================= */

const getOrganiserEvents =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const result =
                await eventService
                    .getOrganiserEvents(
                        getOrganiserId(
                            req
                        ),
                        getRequestQuery(
                            req
                        )
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Events retrieved successfully.",

                    data:
                        result

                });

        }
    );


/* =========================================================
   GET ONE
   ========================================================= */

const getEvent =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const event =
                await eventService
                    .getEventById(
                        getOrganiserId(
                            req
                        ),
                        getEventId(
                            req
                        )
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Event retrieved successfully.",

                    data: {

                        event

                    }

                });

        }
    );


/* =========================================================
   UPDATE
   ========================================================= */

const updateEvent =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const event =
                await eventService
                    .updateEvent(
                        getOrganiserId(
                            req
                        ),
                        getEventId(
                            req
                        ),
                        getRequestBody(
                            req
                        )
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Event updated successfully.",

                    data: {

                        event

                    }

                });

        }
    );


/* =========================================================
   DELETE
   ========================================================= */

const deleteEvent =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const event =
                await eventService
                    .deleteEvent(
                        getOrganiserId(
                            req
                        ),
                        getEventId(
                            req
                        )
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Event removed successfully.",

                    data: {

                        event

                    }

                });

        }
    );



/* =========================================================
   PHASE 10 - CUSTOMER / PUBLIC EVENT DISCOVERY
   ========================================================= */

const getCustomerEvents =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const result =
                await eventService
                    .getCustomerEvents(
                        getRequestQuery(
                            req
                        )
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Events retrieved successfully.",

                    data: {

                        events:
                            result.events,

                        pagination:
                            result.pagination

                    }

                });

        }
    );


const getCustomerEvent =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const event =
                await eventService
                    .getCustomerEventById(
                        getEventId(
                            req
                        )
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Event retrieved successfully.",

                    data: {

                        event

                    }

                });

        }
    );


const getCustomerEventShows =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const shows =
                await showService
                    .getCustomerShowsByEvent(
                        getEventId(
                            req
                        )
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Event shows retrieved successfully.",

                    data: {

                        shows

                    }

                });

        }
    );


module.exports = {

    createEvent,

    getOrganiserEvents,

    getEvent,

    updateEvent,

    deleteEvent,

    getCustomerEvents,

    getCustomerEvent,

    getCustomerEventShows

};
