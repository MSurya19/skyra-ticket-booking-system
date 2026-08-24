"use strict";

const crypto =
    require("crypto");

const mongoose =
    require("mongoose");

const Payment =
    require("../models/Payment");

const SeatHold =
    require("../models/SeatHold");

const ShowSeat =
    require("../models/ShowSeat");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");

const {
    getRazorpayClient,
    getRazorpayKeyId,
    getRazorpayKeySecret
} =
    require("../config/razorpay");

const seatHoldService =
    require("./seatHoldService");

/* =========================================================
   SKYRA - PAYMENT SERVICE
   File: backend/src/services/paymentService.js

   PHASE 13 BOUNDARY
   ---------------------------------------------------------
   This service:
   - creates a Razorpay Order from a real ACTIVE SeatHold
   - derives the amount from HELD ShowSeats on the server
   - verifies Razorpay's HMAC signature on the server
   - confirms the gateway payment is CAPTURED
   - stores a VERIFIED Payment record

   It DOES NOT create a Booking and DOES NOT convert seats
   HELD -> BOOKED. That transaction belongs to Phase 14.
   ========================================================= */

const STATUS_BAD_REQUEST =
    HTTP_STATUS?.BAD_REQUEST ||
    400;

const STATUS_NOT_FOUND =
    HTTP_STATUS?.NOT_FOUND ||
    404;

const STATUS_CONFLICT =
    HTTP_STATUS?.CONFLICT ||
    409;

const STATUS_BAD_GATEWAY =
    HTTP_STATUS?.BAD_GATEWAY ||
    502;

function convenienceFeeRupees() {
    const configured =
        Number(
            process.env.SKYRA_CONVENIENCE_FEE ||
            99
        );

    if (!Number.isFinite(configured)) {
        return 99;
    }

    return Math.max(
        0,
        Math.round(configured)
    );
}

function requireObjectId(value, fieldName) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(
            STATUS_BAD_REQUEST,
            `Invalid ${fieldName}.`
        );
    }

    return String(value);
}

function safeString(value) {
    return String(value ?? "").trim();
}

function timingSafeHexEqual(expectedHex, receivedHex) {
    const expected =
        Buffer.from(
            safeString(expectedHex),
            "hex"
        );

    const received =
        Buffer.from(
            safeString(receivedHex),
            "hex"
        );

    return (
        expected.length > 0 &&
        expected.length === received.length &&
        crypto.timingSafeEqual(
            expected,
            received
        )
    );
}

function serializePayment(payment) {
    if (!payment) {
        return null;
    }

    const value =
        typeof payment.toObject === "function"
            ? payment.toObject()
            : { ...payment };

    delete value.razorpaySignature;
    delete value.__v;

    return {
        ...value,
        id: String(value._id),
        _id: String(value._id),
        userId: String(value.userId),
        holdId: String(value.holdId),
        showId: String(value.showId),
        eventId: String(value.eventId),
        venueId: String(value.venueId),
        amount: Number(value.amountPaise),
        amountPaise: Number(value.amountPaise),
        subtotal: Number(value.subtotal),
        convenienceFee: Number(value.convenienceFee),
        grandTotal: Number(value.grandTotal)
    };
}

async function requirePayableHold(userId, holdId) {
    requireObjectId(userId, "userId");
    requireObjectId(holdId, "holdId");

    let hold =
        await SeatHold.findOne({
            _id: holdId,
            userId
        });

    if (!hold) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Seat hold not found."
        );
    }

    if (
        hold.status === "ACTIVE" &&
        new Date(hold.expiresAt).getTime() <= Date.now()
    ) {
        await seatHoldService.releaseSeatHold(
            String(userId),
            String(holdId)
        );

        hold =
            await SeatHold.findById(holdId);
    }

    if (
        !hold ||
        hold.status !== "ACTIVE"
    ) {
        throw new ApiError(
            STATUS_CONFLICT,
            "Seat hold is no longer active. Select seats again."
        );
    }

    const seats =
        await ShowSeat.find({
            _id: {
                $in: hold.showSeatIds
            },
            showId: hold.showId,
            status: "HELD",
            holdId: hold._id,
            heldByUserId: hold.userId,
            holdExpiresAt: {
                $gt: new Date()
            }
        })
            .sort({
                row: 1,
                number: 1
            })
            .lean();

    if (
        seats.length !==
        hold.showSeatIds.length
    ) {
        throw new ApiError(
            STATUS_CONFLICT,
            "The selected seats are no longer fully held for this checkout."
        );
    }

    const subtotal =
        seats.reduce(
            (total, seat) =>
                total + Number(seat.price || 0),
            0
        );

    const convenienceFee =
        convenienceFeeRupees();

    const grandTotal =
        subtotal + convenienceFee;

    if (
        !Number.isFinite(grandTotal) ||
        grandTotal <= 0
    ) {
        throw new ApiError(
            STATUS_CONFLICT,
            "Payment amount could not be calculated."
        );
    }

    return {
        hold,
        seats,
        subtotal,
        convenienceFee,
        grandTotal,
        amountPaise:
            Math.round(
                grandTotal * 100
            )
    };
}

function buildOrderResponse(payment) {
    const publicPayment =
        serializePayment(payment);

    return {
        paymentId:
            publicPayment.id,
        paymentReference:
            publicPayment.reference,
        orderId:
            publicPayment.razorpayOrderId,
        razorpayOrderId:
            publicPayment.razorpayOrderId,
        keyId:
            getRazorpayKeyId(),
        amount:
            publicPayment.amountPaise,
        currency:
            publicPayment.currency,
        subtotal:
            publicPayment.subtotal,
        convenienceFee:
            publicPayment.convenienceFee,
        grandTotal:
            publicPayment.grandTotal,
        status:
            publicPayment.status,
        holdId:
            publicPayment.holdId,
        expiresAt:
            null
    };
}

async function createPaymentOrder(userId, payload = {}) {
    const holdId =
        requireObjectId(
            payload.holdId,
            "holdId"
        );

    const payable =
        await requirePayableHold(
            userId,
            holdId
        );

    let payment =
        await Payment.findOne({
            holdId,
            userId
        });

    /*
       One Razorpay Order can accept multiple payment attempts.
       Reuse the same order while this SeatHold remains active.
    */
    if (
        payment &&
        payment.status !== "FAILED"
    ) {
        return buildOrderResponse(payment);
    }

    const razorpay =
        getRazorpayClient();

    const receipt =
        `skyra_${String(holdId)}`
            .slice(0, 40);

    let gatewayOrder;

    try {
        gatewayOrder =
            await razorpay.orders.create({
                amount:
                    payable.amountPaise,
                currency:
                    "INR",
                receipt,
                notes: {
                    holdId:
                        String(payable.hold._id),
                    userId:
                        String(payable.hold.userId),
                    showId:
                        String(payable.hold.showId),
                    eventId:
                        String(payable.hold.eventId)
                }
            });
    } catch (error) {
        throw new ApiError(
            Number(error?.statusCode) ||
            502,
            error?.error?.description ||
            error?.message ||
            "Unable to create Razorpay order."
        );
    }

    const update = {
        userId:
            payable.hold.userId,
        holdId:
            payable.hold._id,
        showId:
            payable.hold.showId,
        eventId:
            payable.hold.eventId,
        venueId:
            payable.hold.venueId,
        status:
            "ORDER_CREATED",
        currency:
            "INR",
        subtotal:
            payable.subtotal,
        convenienceFee:
            payable.convenienceFee,
        grandTotal:
            payable.grandTotal,
        amountPaise:
            payable.amountPaise,
        email:
            payload.email || null,
        phone:
            payload.phone || null,
        razorpayOrderId:
            gatewayOrder.id,
        gatewayOrderStatus:
            gatewayOrder.status ||
            "created",
        // Keep the unique sparse field absent until verification.
        // Do not write null here, otherwise a second unpaid Payment
        // can collide on the unique razorpayPaymentId index.
        razorpayPaymentId:
            undefined,
        razorpaySignature:
            null,
        gatewayPaymentStatus:
            null,
        paymentMethod:
            null,
        verifiedAt:
            null,
        failedAt:
            null,
        failureReason:
            null
    };

    if (payment) {
        Object.assign(
            payment,
            update
        );
        await payment.save();
    } else {
        payment =
            await Payment.create(update);
    }

    return buildOrderResponse(payment);
}

async function markPaymentFailed(payment, reason) {
    if (!payment) {
        return;
    }

    payment.status =
        "FAILED";
    payment.failedAt =
        new Date();
    payment.failureReason =
        safeString(reason)
            .slice(0, 500) ||
        "Payment verification failed.";

    await payment.save();
}

async function verifyPayment(userId, payload = {}) {
    const holdId =
        requireObjectId(
            payload.holdId,
            "holdId"
        );

    await requirePayableHold(
        userId,
        holdId
    );

    const payment =
        await Payment.findOne({
            holdId,
            userId
        }).select(
            "+razorpaySignature"
        );

    if (!payment) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Payment order not found. Create a payment order first."
        );
    }

    if (
        payment.status === "VERIFIED"
    ) {
        if (
            payment.razorpayPaymentId ===
            payload.razorpayPaymentId
        ) {
            return serializePayment(payment);
        }

        throw new ApiError(
            STATUS_CONFLICT,
            "This SeatHold already has a different verified payment."
        );
    }

    /*
       SECURITY RULE:
       The order ID used to generate the HMAC comes from OUR
       Payment document, never from the browser callback.
    */
    const storedOrderId =
        safeString(
            payment.razorpayOrderId
        );

    if (
        storedOrderId !==
        safeString(
            payload.razorpayOrderId
        )
    ) {
        await markPaymentFailed(
            payment,
            "Razorpay Order ID mismatch."
        );

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Payment verification failed."
        );
    }

    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                getRazorpayKeySecret()
            )
            .update(
                `${storedOrderId}|${
                    payload.razorpayPaymentId
                }`
            )
            .digest("hex");

    if (
        !timingSafeHexEqual(
            expectedSignature,
            payload.razorpaySignature
        )
    ) {
        await markPaymentFailed(
            payment,
            "Razorpay signature mismatch."
        );

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Invalid Razorpay payment signature."
        );
    }

    const razorpay =
        getRazorpayClient();

    let gatewayPayment;

    try {
        gatewayPayment =
            await razorpay.payments.fetch(
                payload.razorpayPaymentId
            );
    } catch (error) {
        throw new ApiError(
            Number(error?.statusCode) ||
            502,
            error?.error?.description ||
            error?.message ||
            "Unable to verify payment with Razorpay."
        );
    }

    const gatewayOrderId =
        safeString(
            gatewayPayment?.order_id
        );

    const gatewayAmount =
        Number(
            gatewayPayment?.amount
        );

    const gatewayCurrency =
        safeString(
            gatewayPayment?.currency
        ).toUpperCase();

    const gatewayStatus =
        safeString(
            gatewayPayment?.status
        ).toLowerCase();

    if (
        gatewayOrderId !== storedOrderId ||
        gatewayAmount !== Number(payment.amountPaise) ||
        gatewayCurrency !== payment.currency
    ) {
        await markPaymentFailed(
            payment,
            "Gateway payment details did not match the server order."
        );

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Razorpay payment details do not match this order."
        );
    }

    /*
       SKYRA fulfils tickets only after capture.
       For this project enable automatic capture in Razorpay Test Mode.
    */
    if (gatewayStatus !== "captured") {
        throw new ApiError(
            STATUS_CONFLICT,
            `Razorpay payment is ${
                gatewayStatus || "not captured"
            }. Enable automatic capture and retry verification.`
        );
    }

    payment.status =
        "VERIFIED";
    payment.razorpayPaymentId =
        payload.razorpayPaymentId;
    payment.razorpaySignature =
        payload.razorpaySignature;
    payment.gatewayPaymentStatus =
        gatewayStatus;
    payment.paymentMethod =
        gatewayPayment?.method ||
        null;
    payment.email =
        payload.email ||
        payment.email ||
        null;
    payment.phone =
        payload.phone ||
        payment.phone ||
        null;
    payment.verifiedAt =
        new Date();
    payment.failedAt =
        null;
    payment.failureReason =
        null;

    await payment.save();

    return serializePayment(payment);
}


/* =========================================================
   PHASE 16 - RAZORPAY REFUND

   Refunds the already VERIFIED Razorpay payment. The original
   Payment.status intentionally remains VERIFIED; refundStatus
   tracks the separate refund lifecycle.
   ========================================================= */


async function reconcileVerifiedPaymentRefund(
    userId,
    paymentId
) {

    requireObjectId(userId, "userId");
    requireObjectId(paymentId, "paymentId");


    const payment =
        await Payment.findOne({
            _id: paymentId,
            userId,
            status: "VERIFIED"
        });


    if (!payment) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Verified payment not found for this booking."
        );

    }


    /*
       If MongoDB is already final, do not call Razorpay again.
    */
    if (
        payment.refundStatus ===
            "REFUNDED" &&
        payment.razorpayRefundId
    ) {

        return {
            id:
                String(
                    payment.razorpayRefundId
                ),
            status:
                "REFUNDED",
            gatewayStatus:
                payment.refundGatewayStatus ||
                "processed",
            amountPaise:
                Number(
                    payment.refundAmountPaise ||
                    0
                ),
            currency:
                payment.currency,
            refundedAt:
                payment.refundedAt ||
                null,
            payment:
                serializePayment(
                    payment
                )
        };

    }


    /*
       A PENDING refund without a gateway id can occur only in the
       very small window while the original refund request is being
       created. There is nothing safe to fetch from Razorpay yet.
    */
    if (!payment.razorpayRefundId) {

        if (
            payment.refundStatus ===
            "PENDING"
        ) {

            return {
                id:
                    null,
                status:
                    "PENDING",
                gatewayStatus:
                    payment.refundGatewayStatus ||
                    "pending",
                amountPaise:
                    Number(
                        payment.refundAmountPaise ||
                        0
                    ),
                currency:
                    payment.currency,
                refundedAt:
                    null,
                payment:
                    serializePayment(
                        payment
                    )
            };

        }


        throw new ApiError(
            STATUS_CONFLICT,
            "No Razorpay refund exists for this payment."
        );

    }


    const razorpay =
        getRazorpayClient();


    let gatewayRefund;


    try {

        gatewayRefund =
            await razorpay.refunds.fetch(
                String(
                    payment.razorpayRefundId
                )
            );

    } catch (error) {

        /*
           Do not mark the refund FAILED just because a reconciliation
           fetch temporarily failed. Razorpay may already be processing
           or may already have completed the refund.
        */
        throw new ApiError(
            Number(
                error?.statusCode
            ) ||
            STATUS_BAD_GATEWAY,
            String(
                error?.error?.description ||
                error?.message ||
                "Could not refresh Razorpay refund status."
            ).slice(
                0,
                500
            )
        );

    }


    const gatewayStatus =
        safeString(
            gatewayRefund?.status
        ).toLowerCase();

    const gatewayAmount =
        Number(
            gatewayRefund?.amount
        );


    payment.refundGatewayStatus =
        gatewayStatus ||
        payment.refundGatewayStatus ||
        "pending";


    if (
        Number.isFinite(
            gatewayAmount
        ) &&
        gatewayAmount >= 0
    ) {

        payment.refundAmountPaise =
            gatewayAmount;

    }


    if (
        gatewayStatus ===
        "processed"
    ) {

        payment.refundStatus =
            "REFUNDED";

        payment.refundedAt =
            payment.refundedAt ||
            new Date();

        payment.refundFailureReason =
            null;

    } else if (
        gatewayStatus ===
        "failed"
    ) {

        payment.refundStatus =
            "FAILED";

        payment.refundedAt =
            null;

        payment.refundFailureReason =
            "Razorpay reported the refund as failed.";

    } else {

        payment.refundStatus =
            "PENDING";

        payment.refundFailureReason =
            null;

    }


    await payment.save();


    return {
        id:
            String(
                payment.razorpayRefundId
            ),
        status:
            payment.refundStatus,
        gatewayStatus:
            payment.refundGatewayStatus,
        amountPaise:
            Number(
                payment.refundAmountPaise ||
                0
            ),
        currency:
            payment.currency,
        refundedAt:
            payment.refundedAt ||
            null,
        payment:
            serializePayment(
                payment
            )
    };

}

async function refundVerifiedPayment(
    userId,
    paymentId,
    options = {}
) {

    requireObjectId(userId, "userId");
    requireObjectId(paymentId, "paymentId");

    const bookingId =
        options.bookingId
            ? requireObjectId(
                options.bookingId,
                "bookingId"
            )
            : null;

    const requestedAmountPaise =
        Math.round(
            Number(
                options.amountPaise ||
                0
            )
        );

    const reason =
        safeString(
            options.reason ||
            "Customer booking cancellation"
        ).slice(0, 500);


    let payment =
        await Payment.findOne({
            _id: paymentId,
            userId,
            status: "VERIFIED"
        });


    if (!payment) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Verified payment not found for this booking."
        );

    }


    if (
        bookingId &&
        payment.bookingId &&
        String(payment.bookingId) !==
            String(bookingId)
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Payment is linked to a different booking."
        );

    }


    /*
       Idempotency:
       if Razorpay already refunded this Payment, return the
       stored refund instead of creating another refund.
    */
    if (
        payment.refundStatus ===
            "REFUNDED" &&
        payment.razorpayRefundId
    ) {

        return {
            id:
                String(
                    payment.razorpayRefundId
                ),
            status:
                "REFUNDED",
            gatewayStatus:
                payment.refundGatewayStatus ||
                "processed",
            amountPaise:
                Number(
                    payment.refundAmountPaise ||
                    0
                ),
            currency:
                payment.currency,
            refundedAt:
                payment.refundedAt ||
                null,
            payment:
                serializePayment(
                    payment
                )
        };

    }


    if (
        payment.refundStatus ===
        "PENDING"
    ) {

        /*
           Idempotent retry/reconciliation:
           never create a second refund. If Razorpay already returned
           a refund id, fetch that exact refund and synchronize MongoDB.
        */
        if (
            payment.razorpayRefundId
        ) {

            return reconcileVerifiedPaymentRefund(
                userId,
                paymentId
            );

        }


        throw new ApiError(
            STATUS_CONFLICT,
            "A refund is already being initialized for this payment."
        );

    }


    const refundAmountPaise =
        requestedAmountPaise > 0
            ? requestedAmountPaise
            : Number(
                payment.amountPaise
            );


    if (
        !Number.isInteger(
            refundAmountPaise
        ) ||
        refundAmountPaise <= 0 ||
        refundAmountPaise >
            Number(
                payment.amountPaise
            )
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Invalid refund amount."
        );

    }


    if (!payment.razorpayPaymentId) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Razorpay payment ID is missing; refund cannot be created."
        );

    }


    /*
       Claim the refund operation before calling Razorpay so a
       repeated/concurrent cancellation cannot issue two refunds.
    */
    const claimed =
        await Payment.findOneAndUpdate(
            {
                _id: payment._id,
                userId,
                status: "VERIFIED",
                $or: [
                    {
                        refundStatus: {
                            $in: [
                                "NONE",
                                "FAILED"
                            ]
                        }
                    },
                    {
                        refundStatus: {
                            $exists: false
                        }
                    }
                ]
            },
            {
                $set: {
                    refundStatus:
                        "PENDING",
                    refundAmountPaise,
                    refundFailureReason:
                        null
                }
            },
            {
                new: true
            }
        );


    if (!claimed) {

        payment =
            await Payment.findById(
                payment._id
            );

        if (
            payment?.refundStatus ===
                "REFUNDED" &&
            payment?.razorpayRefundId
        ) {

            return {
                id:
                    String(
                        payment.razorpayRefundId
                    ),
                status:
                    "REFUNDED",
                gatewayStatus:
                    payment.refundGatewayStatus ||
                    "processed",
                amountPaise:
                    Number(
                        payment.refundAmountPaise ||
                        0
                    ),
                currency:
                    payment.currency,
                refundedAt:
                    payment.refundedAt ||
                    null,
                payment:
                    serializePayment(
                        payment
                    )
            };

        }

        throw new ApiError(
            STATUS_CONFLICT,
            "Refund state changed while the request was being processed."
        );

    }


    payment =
        claimed;


    const razorpay =
        getRazorpayClient();


    let gatewayRefund;


    try {

        gatewayRefund =
            await razorpay.payments.refund(
                payment.razorpayPaymentId,
                {
                    amount:
                        refundAmountPaise,
                    speed:
                        "normal",
                    notes: {
                        bookingId:
                            bookingId ||
                            "",
                        reason
                    }
                }
            );

    } catch (error) {

        payment.refundStatus =
            "FAILED";

        payment.refundFailureReason =
            String(
                error?.error?.description ||
                error?.message ||
                "Razorpay refund failed."
            ).slice(
                0,
                500
            );

        await payment.save();


        throw new ApiError(
            Number(
                error?.statusCode
            ) ||
            STATUS_BAD_GATEWAY,
            payment.refundFailureReason
        );

    }


    const gatewayRefundId =
        safeString(
            gatewayRefund?.id
        );

    const gatewayStatus =
        safeString(
            gatewayRefund?.status
        ).toLowerCase();

    const gatewayAmount =
        Number(
            gatewayRefund?.amount
        );


    if (!gatewayRefundId) {

        payment.refundStatus =
            "FAILED";

        payment.refundFailureReason =
            "Razorpay did not return a refund ID.";

        await payment.save();


        throw new ApiError(
            STATUS_BAD_GATEWAY,
            payment.refundFailureReason
        );

    }


    if (
        gatewayStatus ===
        "failed"
    ) {

        payment.refundStatus =
            "FAILED";

        payment.refundAmountPaise =
            Number.isFinite(
                gatewayAmount
            )
                ? gatewayAmount
                : refundAmountPaise;

        payment.razorpayRefundId =
            gatewayRefundId;

        payment.refundGatewayStatus =
            gatewayStatus;

        payment.refundFailureReason =
            "Razorpay reported the refund as failed.";

        await payment.save();


        throw new ApiError(
            STATUS_BAD_GATEWAY,
            payment.refundFailureReason
        );

    }


    const completed =
        gatewayStatus ===
        "processed";


    payment.refundStatus =
        completed
            ? "REFUNDED"
            : "PENDING";

    payment.refundAmountPaise =
        Number.isFinite(
            gatewayAmount
        )
            ? gatewayAmount
            : refundAmountPaise;

    payment.razorpayRefundId =
        gatewayRefundId;

    payment.refundGatewayStatus =
        gatewayStatus ||
        "pending";

    payment.refundedAt =
        completed
            ? new Date()
            : null;

    payment.refundFailureReason =
        null;


    await payment.save();


    return {
        id:
            gatewayRefundId,
        status:
            payment.refundStatus,
        gatewayStatus:
            payment.refundGatewayStatus,
        amountPaise:
            Number(
                payment.refundAmountPaise
            ),
        currency:
            payment.currency,
        refundedAt:
            payment.refundedAt,
        payment:
            serializePayment(
                payment
            )
    };

}

async function getPaymentById(userId, paymentId) {
    requireObjectId(paymentId, "paymentId");

    const payment =
        await Payment.findOne({
            _id: paymentId,
            userId
        });

    if (!payment) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Payment not found."
        );
    }

    return serializePayment(payment);
}

async function getPaymentByHold(userId, holdId) {
    requireObjectId(holdId, "holdId");

    const payment =
        await Payment.findOne({
            holdId,
            userId
        });

    return serializePayment(payment);
}

module.exports = {
    convenienceFeeRupees,
    createPaymentOrder,
    verifyPayment,
    refundVerifiedPayment,
    reconcileVerifiedPaymentRefund,
    getPaymentById,
    getPaymentByHold,
    serializePayment,
    timingSafeHexEqual
};
