"use strict";

const asyncHandler =
    require("../utils/asyncHandler");

const ApiError =
    require("../utils/ApiError");

const paymentService =
    require("../services/paymentService");

const {
    HTTP_STATUS
} =
    require("../utils/constants");

const STATUS_OK =
    HTTP_STATUS?.OK ||
    200;

const STATUS_CREATED =
    HTTP_STATUS?.CREATED ||
    201;

const STATUS_UNAUTHORIZED =
    HTTP_STATUS?.UNAUTHORIZED ||
    401;

function requestBody(req) {
    return req.validated?.body ??
        req.validatedBody ??
        req.body ??
        {};
}

function requestParams(req) {
    return req.validated?.params ??
        req.validatedParams ??
        req.params ??
        {};
}

function customerId(req) {
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

    return String(value);
}

const createOrder =
    asyncHandler(
        async (req, res) => {
            const order =
                await paymentService.createPaymentOrder(
                    customerId(req),
                    requestBody(req)
                );

            return res
                .status(STATUS_CREATED)
                .json({
                    success: true,
                    message: "Razorpay order created successfully.",
                    data: {
                        order
                    }
                });
        }
    );

const verify =
    asyncHandler(
        async (req, res) => {
            const payment =
                await paymentService.verifyPayment(
                    customerId(req),
                    requestBody(req)
                );

            return res
                .status(STATUS_OK)
                .json({
                    success: true,
                    message: "Payment verified successfully.",
                    data: {
                        payment,
                        nextPhase: "BOOKING"
                    }
                });
        }
    );

const getPayment =
    asyncHandler(
        async (req, res) => {
            const { paymentId } =
                requestParams(req);

            const payment =
                await paymentService.getPaymentById(
                    customerId(req),
                    paymentId
                );

            return res
                .status(STATUS_OK)
                .json({
                    success: true,
                    message: "Payment retrieved successfully.",
                    data: {
                        payment
                    }
                });
        }
    );

const getPaymentByHold =
    asyncHandler(
        async (req, res) => {
            const { holdId } =
                requestParams(req);

            const payment =
                await paymentService.getPaymentByHold(
                    customerId(req),
                    holdId
                );

            return res
                .status(STATUS_OK)
                .json({
                    success: true,
                    message: payment
                        ? "Payment retrieved successfully."
                        : "No payment exists for this SeatHold.",
                    data: {
                        payment
                    }
                });
        }
    );

module.exports = {
    createOrder,
    verify,
    getPayment,
    getPaymentByHold
};
