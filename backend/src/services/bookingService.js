"use strict";

const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const SeatHold = require("../models/SeatHold");
const ShowSeat = require("../models/ShowSeat");
const Show = require("../models/Show");
const paymentService = require("./paymentService");
const waitlistService = require("./waitlistService");
const notificationService = require("./notificationService");

const ApiError = require("../utils/ApiError");
const { HTTP_STATUS } = require("../utils/constants");

const STATUS_BAD_REQUEST = HTTP_STATUS?.BAD_REQUEST || 400;
const STATUS_NOT_FOUND = HTTP_STATUS?.NOT_FOUND || 404;
const STATUS_CONFLICT = HTTP_STATUS?.CONFLICT || 409;

function requireObjectId(value, fieldName) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(
            STATUS_BAD_REQUEST,
            `Invalid ${fieldName}.`
        );
    }

    return String(value);
}

function serializeBooking(booking) {
    if (!booking) {
        return null;
    }

    const value =
        typeof booking.toObject === "function"
            ? booking.toObject()
            : { ...booking };

    delete value.__v;
    delete value.qrDataUrl;

    return {
        ...value,
        id: String(value._id),
        _id: String(value._id),
        userId: String(value.userId),
        organiserId: value.organiserId
            ? String(value.organiserId)
            : null,
        paymentId: String(value.paymentId),
        holdId: String(value.holdId),
        showId: String(value.showId),
        eventId: String(value.eventId),
        venueId: String(value.venueId),
        seats: Array.isArray(value.seats)
            ? value.seats.map((seat) => ({
                ...seat,
                showSeatId: String(seat.showSeatId),
                categoryId: String(seat.categoryId)
            }))
            : [],
        seatCount: Number(value.seatCount),
        subtotal: Number(value.subtotal),
        convenienceFee: Number(value.convenienceFee),
        grandTotal: Number(value.grandTotal)
    };
}

function bookingSeatFromShowSeat(seat) {
    return {
        showSeatId: seat._id,
        categoryId: seat.categoryId,
        row: seat.row,
        number: seat.number,
        label: seat.label,
        categoryName: seat.categoryName,
        price: Number(seat.price || 0)
    };
}

async function createBookingFromPayment(userId, payload = {}) {
    requireObjectId(userId, "userId");

    const paymentId = requireObjectId(
        payload.paymentId,
        "paymentId"
    );

    /*
       Idempotency first: refreshing checkout or retrying the API must
       return the same Booking rather than sell the same seats twice.
    */
    const alreadyCreated = await Booking.findOne({
        paymentId,
        userId
    });

    if (alreadyCreated) {
        return serializeBooking(alreadyCreated);
    }

    const session = await mongoose.startSession();
    let createdBookingId = null;

    try {
        await session.withTransaction(async () => {
            const existing = await Booking.findOne({
                paymentId,
                userId
            }).session(session);

            if (existing) {
                createdBookingId = existing._id;
                return;
            }

            const payment = await Payment.findOne({
                _id: paymentId,
                userId,
                status: "VERIFIED"
            }).session(session);

            if (!payment) {
                throw new ApiError(
                    STATUS_CONFLICT,
                    "A verified payment is required before booking."
                );
            }

            const hold = await SeatHold.findOne({
                _id: payment.holdId,
                userId,
                status: "ACTIVE"
            }).session(session);

            if (!hold) {
                throw new ApiError(
                    STATUS_CONFLICT,
                    "The SeatHold is no longer active. Booking cannot be finalized automatically."
                );
            }

            const show = await Show.findById(
                payment.showId
            ).session(session);

            if (!show) {
                throw new ApiError(
                    STATUS_NOT_FOUND,
                    "Show not found for this payment."
                );
            }

            const seats = await ShowSeat.find({
                _id: { $in: hold.showSeatIds },
                showId: hold.showId,
                status: "HELD",
                holdId: hold._id,
                heldByUserId: hold.userId
            })
                .sort({ row: 1, number: 1 })
                .session(session);

            if (seats.length !== hold.showSeatIds.length) {
                throw new ApiError(
                    STATUS_CONFLICT,
                    "One or more held seats are no longer available for final booking."
                );
            }

            const seatSubtotal = seats.reduce(
                (total, seat) => total + Number(seat.price || 0),
                0
            );

            if (seatSubtotal !== Number(payment.subtotal)) {
                throw new ApiError(
                    STATUS_CONFLICT,
                    "Booking seat total does not match the verified payment."
                );
            }

            const booking = new Booking({
                userId: payment.userId,
                organiserId: show.organiserId || null,
                paymentId: payment._id,
                holdId: hold._id,
                showId: payment.showId,
                eventId: payment.eventId,
                venueId: payment.venueId,
                eventTitle: show.eventTitle,
                eventType: show.eventType || null,
                venueName: show.venueName,
                venueCity: show.venueCity || null,
                date: show.date,
                time: show.time,
                startsAt: show.startsAt,
                seats: seats.map(bookingSeatFromShowSeat),
                seatCount: seats.length,
                subtotal: Number(payment.subtotal),
                convenienceFee: Number(payment.convenienceFee),
                grandTotal: Number(payment.grandTotal),
                currency: payment.currency,
                razorpayOrderId: payment.razorpayOrderId,
                razorpayPaymentId: payment.razorpayPaymentId,
                paymentMethod: payment.paymentMethod || null,
                status: "CONFIRMED",
                confirmedAt: new Date()
            });

            /*
               The conditional update is the final database-level guard:
               every seat must still belong to THIS hold at commit time.
            */
            const seatResult = await ShowSeat.updateMany(
                {
                    _id: { $in: hold.showSeatIds },
                    showId: hold.showId,
                    status: "HELD",
                    holdId: hold._id,
                    heldByUserId: hold.userId
                },
                {
                    $set: {
                        status: "BOOKED",
                        bookingId: booking._id,
                        bookedByUserId: payment.userId,
                        bookedAt: new Date(),
                        holdId: null,
                        heldByUserId: null,
                        holdExpiresAt: null
                    }
                },
                { session }
            );

            if (seatResult.modifiedCount !== seats.length) {
                throw new ApiError(
                    STATUS_CONFLICT,
                    "Seat state changed while the booking was being finalized."
                );
            }

            const holdResult = await SeatHold.updateOne(
                {
                    _id: hold._id,
                    userId,
                    status: "ACTIVE"
                },
                {
                    $set: {
                        status: "CONSUMED",
                        consumedAt: new Date(),
                        consumedByBookingId: booking._id,
                        releaseReason: "BOOKING_CONFIRMED"
                    }
                },
                { session }
            );

            if (holdResult.modifiedCount !== 1) {
                throw new ApiError(
                    STATUS_CONFLICT,
                    "SeatHold changed while the booking was being finalized."
                );
            }

            await Show.updateOne(
                { _id: show._id },
                {
                    $inc: {
                        soldSeats: seats.length,
                        revenue: Number(payment.subtotal)
                    }
                },
                { session }
            );

            payment.bookingId = booking._id;
            await payment.save({ session });
            await booking.save({ session });

            /*
               Phase 18: booking and confirmation notification commit
               together, preventing duplicate confirmation alerts.
            */
            await notificationService
                .notifyBookingConfirmed(
                    booking,
                    { session }
                );

            createdBookingId = booking._id;
        });
    } catch (error) {
        /* Unique paymentId/holdId makes repeated concurrent finalization safe. */
        if (Number(error?.code) === 11000) {
            const existing = await Booking.findOne({
                paymentId,
                userId
            });

            if (existing) {
                return serializeBooking(existing);
            }
        }

        throw error;
    } finally {
        await session.endSession();
    }

    const booking = await Booking.findById(createdBookingId);

    if (!booking) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Booking could not be loaded after confirmation."
        );
    }

    return serializeBooking(booking);
}


function normalizeCancellationReason(payload = {}) {
    const reason =
        String(
            payload.reason ||
            payload.cancellationReason ||
            "Cancelled by customer."
        ).trim();

    if (reason.length > 500) {
        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Cancellation reason cannot exceed 500 characters."
        );
    }

    return reason || "Cancelled by customer.";
}

async function createRefundNotificationSafely(
    booking
) {

    try {

        await notificationService
            .notifyRefundUpdated(
                booking
            );

    } catch (error) {

        /*
           Never fail an already-completed refund operation only because
           the auxiliary in-app notification could not be written.
        */
        console.error(
            "[Notification] Refund notification failed:",
            error?.message ||
            error
        );

    }

}


async function completeRefundForCancelledBooking(
    booking,
    userId
) {

    if (
        booking.refundStatus ===
            "REFUNDED" &&
        booking.refundId
    ) {

        return {
            id:
                booking.refundId,
            status:
                "REFUNDED",
            amountPaise:
                Math.round(
                    Number(
                        booking.refundAmount ||
                        0
                    ) * 100
                ),
            currency:
                booking.currency
        };

    }


    /*
       A previous gateway failure can be retried by calling the
       cancellation endpoint again. Seats are not released twice
       because Booking.status is already CANCELLED.
    */
    if (
        ![
            "FAILED",
            "NONE",
            "PENDING"
        ].includes(
            booking.refundStatus
        )
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Booking refund is in an unsupported state."
        );

    }


    booking.refundStatus =
        "PENDING";

    await booking.save();


    try {

        const refund =
            await paymentService
                .refundVerifiedPayment(
                    userId,
                    booking.paymentId,
                    {
                        bookingId:
                            booking._id,
                        amountPaise:
                            Math.round(
                                Number(
                                    booking.grandTotal
                                ) * 100
                            ),
                        reason:
                            booking.cancellationReason ||
                            "Customer booking cancellation"
                    }
                );


        booking.refundStatus =
            refund.status ===
                "REFUNDED"
                ? "REFUNDED"
                : "PENDING";

        booking.refundAmount =
            Number(
                refund.amountPaise ||
                0
            ) / 100;

        booking.refundId =
            refund.id ||
            null;

        await booking.save();

        await createRefundNotificationSafely(
            booking
        );


        return refund;

    } catch (error) {

        /*
           If Razorpay status refresh itself fails, preserve the Payment
           state instead of incorrectly converting an already-created
           refund from PENDING to FAILED.
        */
        const payment =
            await Payment.findById(
                booking.paymentId
            );

        const paymentRefundStatus =
            String(
                payment?.refundStatus ||
                ""
            ).toUpperCase();


        if (
            paymentRefundStatus ===
            "PENDING"
        ) {

            booking.refundStatus =
                "PENDING";

            booking.refundAmount =
                Number(
                    payment?.refundAmountPaise ||
                    0
                ) / 100;

            booking.refundId =
                payment?.razorpayRefundId ||
                booking.refundId ||
                null;

            await booking.save();

            await createRefundNotificationSafely(
                booking
            );

            return {
                id:
                    booking.refundId,
                status:
                    "PENDING",
                gatewayStatus:
                    payment?.refundGatewayStatus ||
                    "pending",
                amountPaise:
                    Number(
                        payment?.refundAmountPaise ||
                        0
                    ),
                currency:
                    payment?.currency ||
                    booking.currency,
                error:
                    error?.message ||
                    "Refund status could not be refreshed yet."
            };

        }


        if (
            paymentRefundStatus ===
            "REFUNDED"
        ) {

            booking.refundStatus =
                "REFUNDED";

            booking.refundAmount =
                Number(
                    payment?.refundAmountPaise ||
                    0
                ) / 100;

            booking.refundId =
                payment?.razorpayRefundId ||
                booking.refundId ||
                null;

            await booking.save();

            await createRefundNotificationSafely(
                booking
            );

            return {
                id:
                    booking.refundId,
                status:
                    "REFUNDED",
                gatewayStatus:
                    payment?.refundGatewayStatus ||
                    "processed",
                amountPaise:
                    Number(
                        payment?.refundAmountPaise ||
                        0
                    ),
                currency:
                    payment?.currency ||
                    booking.currency,
                refundedAt:
                    payment?.refundedAt ||
                    null
            };

        }


        booking.refundStatus =
            "FAILED";

        await booking.save();

        await createRefundNotificationSafely(
            booking
        );

        return {
            id:
                payment?.razorpayRefundId ||
                null,
            status:
                "FAILED",
            gatewayStatus:
                payment?.refundGatewayStatus ||
                "failed",
            amountPaise:
                Number(
                    payment?.refundAmountPaise ||
                    0
                ),
            currency:
                payment?.currency ||
                booking.currency,
            error:
                error?.message ||
                payment?.refundFailureReason ||
                "Refund could not be completed automatically."
        };

    }

}

async function cancelCustomerBooking(
    userId,
    bookingId,
    payload = {}
) {

    requireObjectId(
        userId,
        "userId"
    );

    requireObjectId(
        bookingId,
        "bookingId"
    );


    const reason =
        normalizeCancellationReason(
            payload
        );


    let booking =
        await Booking.findOne({
            _id:
                bookingId,
            userId
        });


    if (!booking) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Booking not found."
        );

    }


    /*
       Idempotent/retry behavior:
       - REFUNDED: return the existing result.
       - FAILED: retry only the refund; seats are already released.
       - PENDING: do not create another refund.
    */
    if (
        booking.status ===
        "CANCELLED"
    ) {

        const refund =
            await completeRefundForCancelledBooking(
                booking,
                userId
            );


        booking =
            await Booking.findById(
                booking._id
            );


        return {
            booking:
                serializeBooking(
                    booking
                ),
            refund
        };

    }


    if (
        booking.status !==
        "CONFIRMED"
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Only confirmed bookings can be cancelled."
        );

    }


    if (
        booking.startsAt &&
        new Date(
            booking.startsAt
        ).getTime() <=
            Date.now()
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "This booking cannot be cancelled after the show has started."
        );

    }


    const session =
        await mongoose.startSession();


    try {

        await session.withTransaction(
            async () => {

                /*
                   Conditional status change is the cancellation
                   concurrency guard. Only one request can move
                   CONFIRMED -> CANCELLED.
                */
                const bookingResult =
                    await Booking.updateOne(
                        {
                            _id:
                                booking._id,
                            userId,
                            status:
                                "CONFIRMED"
                        },
                        {
                            $set: {
                                status:
                                    "CANCELLED",
                                cancelledAt:
                                    new Date(),
                                cancellationReason:
                                    reason,
                                refundStatus:
                                    "NONE",
                                refundAmount:
                                    0,
                                refundId:
                                    null
                            }
                        },
                        {
                            session
                        }
                    );


                if (
                    bookingResult.modifiedCount !==
                    1
                ) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "Booking state changed while cancellation was being processed."
                    );

                }


                const showSeatIds =
                    booking.seats.map(
                        (seat) =>
                            seat.showSeatId
                    );


                const seatResult =
                    await ShowSeat.updateMany(
                        {
                            _id: {
                                $in:
                                    showSeatIds
                            },
                            showId:
                                booking.showId,
                            bookingId:
                                booking._id,
                            status:
                                "BOOKED"
                        },
                        {
                            $set: {
                                status:
                                    "AVAILABLE",
                                bookingId:
                                    null,
                                bookedByUserId:
                                    null,
                                bookedAt:
                                    null,
                                holdId:
                                    null,
                                heldByUserId:
                                    null,
                                holdExpiresAt:
                                    null,
                                offerId:
                                    null,
                                waitlistId:
                                    null,
                                offeredToUserId:
                                    null,
                                offerExpiresAt:
                                    null
                            }
                        },
                        {
                            session
                        }
                    );


                if (
                    seatResult.modifiedCount !==
                    booking.seatCount
                ) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "Booked seat state changed while cancellation was being processed."
                    );

                }


                const showResult =
                    await Show.updateOne(
                        {
                            _id:
                                booking.showId
                        },
                        {
                            $inc: {
                                soldSeats:
                                    -Number(
                                        booking.seatCount
                                    ),
                                revenue:
                                    -Number(
                                        booking.subtotal
                                    )
                            }
                        },
                        {
                            session
                        }
                    );


                if (
                    showResult.matchedCount !==
                    1
                ) {

                    throw new ApiError(
                        STATUS_NOT_FOUND,
                        "Show not found while cancelling the booking."
                    );

                }


                /*
                   Phase 17:
                   Keep waitlist fairness inside the same cancellation
                   transaction. Each released seat is offered FIFO to
                   the next WAITING customer in the same Show/category.
                   If no customer is waiting, the seat remains AVAILABLE.
                */
                await waitlistService
                    .assignReleasedSeatsToWaitlist({
                        showId:
                            booking.showId,
                        seatIds:
                            showSeatIds,
                        session
                    });

                /*
                   Phase 18: cancellation and its in-app notification
                   commit together in the same database transaction.
                */
                await notificationService
                    .notifyBookingCancelled(
                        booking,
                        { session }
                    );

            }
        );

    } finally {

        await session.endSession();

    }


    booking =
        await Booking.findById(
            booking._id
        );


    const refund =
        await completeRefundForCancelledBooking(
            booking,
            userId
        );


    booking =
        await Booking.findById(
            booking._id
        );


    return {
        booking:
            serializeBooking(
                booking
            ),
        refund
    };

}


async function refreshPendingBookingRefund(
    booking,
    userId
) {

    if (
        !booking ||
        booking.status !==
            "CANCELLED" ||
        booking.refundStatus !==
            "PENDING"
    ) {

        return booking;

    }


    /*
       Customer reads are a safe reconciliation point:
       - no new refund is created
       - Payment.refundVerifiedPayment detects PENDING
       - the existing Razorpay refund id is fetched
       - Booking and Payment are synchronized
    */
    await completeRefundForCancelledBooking(
        booking,
        userId
    );


    return Booking.findById(
        booking._id
    );

}

async function getBookingById(userId, bookingId) {
    requireObjectId(bookingId, "bookingId");

    let booking = await Booking.findOne({
        _id: bookingId,
        userId
    });

    if (!booking) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Booking not found."
        );
    }

    booking =
        await refreshPendingBookingRefund(
            booking,
            userId
        );

    return serializeBooking(booking);
}

async function getBookingByReference(userId, reference) {
    let booking = await Booking.findOne({
        reference: String(reference || "").trim().toUpperCase(),
        userId
    });

    if (!booking) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Booking not found."
        );
    }

    booking =
        await refreshPendingBookingRefund(
            booking,
            userId
        );

    return serializeBooking(booking);
}

async function listCustomerBookings(userId) {
    requireObjectId(userId, "userId");

    let bookings = await Booking.find({ userId })
        .sort({ createdAt: -1 })
        .limit(100);

    const pendingRefundBookings =
        bookings.filter(
            (booking) =>
                booking.status ===
                    "CANCELLED" &&
                booking.refundStatus ===
                    "PENDING"
        );


    /*
       Refresh only existing pending refunds. This never creates a
       duplicate refund because the Payment service reconciles using
       the already-saved Razorpay refund id.
    */
    if (
        pendingRefundBookings.length >
        0
    ) {

        await Promise.allSettled(
            pendingRefundBookings.map(
                (booking) =>
                    completeRefundForCancelledBooking(
                        booking,
                        userId
                    )
            )
        );


        bookings =
            await Booking.find({
                userId
            })
                .sort({
                    createdAt:
                        -1
                })
                .limit(
                    100
                );

    }


    return bookings.map(
        serializeBooking
    );
}

module.exports = {
    createBookingFromPayment,
    cancelCustomerBooking,
    getBookingById,
    getBookingByReference,
    listCustomerBookings,
    serializeBooking
};
