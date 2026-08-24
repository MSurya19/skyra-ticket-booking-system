"use strict";

const asyncHandler =
    require("../utils/asyncHandler");

const ApiError =
    require("../utils/ApiError");

const waitlistService =
    require("../services/waitlistService");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


const STATUS_OK =
    HTTP_STATUS?.OK || 200;

const STATUS_CREATED =
    HTTP_STATUS?.CREATED || 201;

const STATUS_UNAUTHORIZED =
    HTTP_STATUS?.UNAUTHORIZED || 401;


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


const joinWaitlist =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const waitlist =
                await waitlistService
                    .joinWaitlist(
                        customerId(
                            req
                        ),
                        req.body ||
                        {}
                    );


            return res
                .status(
                    STATUS_CREATED
                )
                .json({
                    success:
                        true,
                    message:
                        "Waitlist joined successfully.",
                    data: {
                        waitlist
                    }
                });

        }
    );


const listMyWaitlist =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const waitlist =
                await waitlistService
                    .listMyWaitlist(
                        customerId(
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
                        "Waitlist retrieved successfully.",
                    data: {
                        waitlist,
                        count:
                            waitlist.length
                    }
                });

        }
    );


const leaveWaitlist =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const waitlist =
                await waitlistService
                    .leaveWaitlist(
                        customerId(
                            req
                        ),
                        req.params
                            .waitlistId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({
                    success:
                        true,
                    message:
                        "Waitlist entry left successfully.",
                    data: {
                        waitlist
                    }
                });

        }
    );


const claimWaitlistOffer =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const result =
                await waitlistService
                    .claimWaitlistOffer(
                        customerId(
                            req
                        ),
                        req.params
                            .offerId
                    );


            return res
                .status(
                    STATUS_OK
                )
                .json({
                    success:
                        true,
                    message:
                        "Waitlist offer claimed successfully.",
                    data:
                        result
                });

        }
    );


module.exports = {

    joinWaitlist,

    listMyWaitlist,

    leaveWaitlist,

    claimWaitlistOffer

};
