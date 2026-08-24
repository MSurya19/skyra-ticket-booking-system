"use strict";

const asyncHandler =
    require("../utils/asyncHandler");

const seatHoldService =
    require("../services/seatHoldService");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - HOLD CONTROLLER
   File: backend/src/controllers/holdController.js
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


function requestBody(
    req
) {

    return req.validated
        ?.body ??
        req.validatedBody ??
        req.body ??
        {};

}


function requestParams(
    req
) {

    return req.validated
        ?.params ??
        req.validatedParams ??
        req.params ??
        {};

}


function requestQuery(
    req
) {

    return req.validated
        ?.query ??
        req.validatedQuery ??
        req.query ??
        {};

}


function customerId(
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


const createHold =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const hold =
                await seatHoldService
                    .createSeatHold(
                        customerId(
                            req
                        ),
                        requestBody(
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
                        "Seats held successfully.",

                    data: {
                        hold
                    }

                });

        }
    );


const getActiveHold =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const query =
                requestQuery(
                    req
                );


            const hold =
                await seatHoldService
                    .getActiveSeatHold(
                        customerId(
                            req
                        ),
                        query.showId ||
                        ""
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        hold
                            ? "Active seat hold retrieved successfully."
                            : "No active seat hold.",

                    data: {
                        hold
                    }

                });

        }
    );


const getHold =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const params =
                requestParams(
                    req
                );


            const hold =
                await seatHoldService
                    .getSeatHoldById(
                        customerId(
                            req
                        ),
                        params.holdId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Seat hold retrieved successfully.",

                    data: {
                        hold
                    }

                });

        }
    );


const releaseHold =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const params =
                requestParams(
                    req
                );


            const hold =
                await seatHoldService
                    .releaseSeatHold(
                        customerId(
                            req
                        ),
                        params.holdId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({

                    success:
                        true,

                    message:
                        hold.status ===
                            "EXPIRED"
                            ? "Expired seat hold released."
                            : "Seat hold released successfully.",

                    data: {
                        hold
                    }

                });

        }
    );


module.exports = {

    createHold,

    getActiveHold,

    getHold,

    releaseHold

};
