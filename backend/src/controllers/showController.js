"use strict";

const asyncHandler =
    require("../utils/asyncHandler");

const showService =
    require("../services/showService");

const showSeatService =
    require("../services/showSeatService");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - SHOW CONTROLLER
   File: backend/src/controllers/showController.js
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


function getShowId(
    req
) {

    const params =
        getRequestParams(
            req
        );


    return (
        params.showId ||
        params.id
    );

}


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
   VENUE OPTIONS FOR ORGANISER
   ========================================================= */

const getVenues =
    asyncHandler(
        async (
            req,
            res
        ) => {

            getOrganiserId(
                req
            );


            const venues =
                await showService
                    .getSchedulableVenues();


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

                        venues

                    }

                });

        }
    );


const getVenue =
    asyncHandler(
        async (
            req,
            res
        ) => {

            getOrganiserId(
                req
            );


            const venue =
                await showService
                    .getSchedulableVenueById(
                        getVenueId(
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
                        "Venue retrieved successfully.",

                    data: {

                        venue

                    }

                });

        }
    );


/* =========================================================
   CREATE
   ========================================================= */

const createShow =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const show =
                await showService
                    .createShow(
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
                        "Show created successfully.",

                    data: {

                        show

                    }

                });

        }
    );


/* =========================================================
   LIST
   ========================================================= */

const getOrganiserShows =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const result =
                await showService
                    .getOrganiserShows(
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
                        "Shows retrieved successfully.",

                    data:
                        result

                });

        }
    );


/* =========================================================
   GET ONE
   ========================================================= */

const getShow =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const show =
                await showService
                    .getShowById(
                        getOrganiserId(
                            req
                        ),
                        getShowId(
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
                        "Show retrieved successfully.",

                    data: {

                        show

                    }

                });

        }
    );


/* =========================================================
   PHASE 9 - SHOWSEATS
   ========================================================= */

const getShowSeats =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const result =
                await showSeatService
                    .getOrganiserShowSeats(
                        getOrganiserId(
                            req
                        ),
                        getShowId(
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
                        "Show seats retrieved successfully.",

                    data:
                        result

                });

        }
    );


const generateShowSeats =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const result =
                await showSeatService
                    .generateExistingShowSeats(
                        getOrganiserId(
                            req
                        ),
                        getShowId(
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
                        result.created
                            ? "Show seats generated successfully."
                            : "Show seats already exist.",

                    data:
                        result

                });

        }
    );


/* =========================================================
   UPDATE
   ========================================================= */

const updateShow =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const show =
                await showService
                    .updateShow(
                        getOrganiserId(
                            req
                        ),
                        getShowId(
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
                        "Show updated successfully.",

                    data: {

                        show

                    }

                });

        }
    );


/* =========================================================
   CANCEL
   ========================================================= */

const cancelShow =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const show =
                await showService
                    .cancelShow(
                        getOrganiserId(
                            req
                        ),
                        getShowId(
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
                        "Show cancelled successfully.",

                    data: {

                        show

                    }

                });

        }
    );



/* =========================================================
   PHASE 10 - CUSTOMER / PUBLIC SHOW DISCOVERY
   ========================================================= */

const getCustomerShow =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const show =
                await showService
                    .getCustomerShowById(
                        getShowId(
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
                        "Show retrieved successfully.",

                    data: {

                        show

                    }

                });

        }
    );


const getCustomerShowSeats =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const result =
                await showService
                    .getCustomerShowSeats(
                        getShowId(
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
                        "Show seats retrieved successfully.",

                    data:
                        result

                });

        }
    );


module.exports = {

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

};
