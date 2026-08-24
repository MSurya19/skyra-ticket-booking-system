"use strict";

const mongoose = require("mongoose");

const Notification = require("../models/Notification");
const ApiError = require("../utils/ApiError");
const { HTTP_STATUS } = require("../utils/constants");

const STATUS_BAD_REQUEST =
    HTTP_STATUS?.BAD_REQUEST || 400;

const STATUS_NOT_FOUND =
    HTTP_STATUS?.NOT_FOUND || 404;

function requireObjectId(
    value,
    fieldName
) {
    if (
        !mongoose.Types.ObjectId
            .isValid(value)
    ) {
        throw new ApiError(
            STATUS_BAD_REQUEST,
            `Invalid ${fieldName}.`
        );
    }

    return String(value);
}

function optionalObjectId(
    value,
    fieldName
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    return requireObjectId(
        value,
        fieldName
    );
}

function serializeNotification(
    notification
) {
    if (!notification) {
        return null;
    }

    const value =
        typeof notification.toObject ===
            "function"
            ? notification.toObject()
            : { ...notification };

    delete value.__v;

    const objectIdFields = [
        "userId",
        "bookingId",
        "paymentId",
        "showId",
        "eventId",
        "waitlistId",
        "offerId"
    ];

    objectIdFields.forEach(
        (field) => {
            if (value[field]) {
                value[field] =
                    String(
                        value[field]
                    );
            } else if (
                field !== "userId"
            ) {
                value[field] =
                    null;
            }
        }
    );

    return {
        ...value,
        id:
            String(
                value._id
            ),
        _id:
            String(
                value._id
            ),
        isRead:
            Boolean(
                value.read
            )
    };
}

function sanitizeCreatePayload(
    payload = {}
) {
    const userId =
        requireObjectId(
            payload.userId,
            "userId"
        );

    const type =
        String(
            payload.type ||
            "SYSTEM"
        )
            .trim()
            .toUpperCase();

    const title =
        String(
            payload.title ||
            "SKYRA Update"
        ).trim();

    const message =
        String(
            payload.message ||
            "You have a new SKYRA notification."
        ).trim();

    if (!title) {
        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Notification title is required."
        );
    }

    if (!message) {
        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Notification message is required."
        );
    }

    return {
        userId,
        type,
        title,
        message,
        read: false,
        readAt: null,
        bookingId:
            optionalObjectId(
                payload.bookingId,
                "bookingId"
            ),
        paymentId:
            optionalObjectId(
                payload.paymentId,
                "paymentId"
            ),
        showId:
            optionalObjectId(
                payload.showId,
                "showId"
            ),
        eventId:
            optionalObjectId(
                payload.eventId,
                "eventId"
            ),
        waitlistId:
            optionalObjectId(
                payload.waitlistId,
                "waitlistId"
            ),
        offerId:
            optionalObjectId(
                payload.offerId,
                "offerId"
            ),
        actionUrl:
            payload.actionUrl
                ? String(
                    payload.actionUrl
                ).trim()
                : null,
        actionLabel:
            payload.actionLabel
                ? String(
                    payload.actionLabel
                ).trim()
                : null,
        dedupeKey:
            payload.dedupeKey
                ? String(
                    payload.dedupeKey
                ).trim()
                : undefined
    };
}

async function createNotification(
    payload = {},
    options = {}
) {
    const document =
        sanitizeCreatePayload(
            payload
        );

    const session =
        options.session ||
        null;

    if (document.dedupeKey) {
        let query =
            Notification.findOne({
                dedupeKey:
                    document.dedupeKey
            });

        if (session) {
            query =
                query.session(
                    session
                );
        }

        const existing =
            await query;

        if (existing) {
            return serializeNotification(
                existing
            );
        }
    }

    try {
        const created =
            await Notification.create(
                [document],
                session
                    ? { session }
                    : {}
            );

        return serializeNotification(
            created[0]
        );
    } catch (error) {
        if (
            Number(error?.code) ===
                11000 &&
            document.dedupeKey &&
            !session
        ) {
            const existing =
                await Notification.findOne({
                    dedupeKey:
                        document.dedupeKey
                });

            if (existing) {
                return serializeNotification(
                    existing
                );
            }
        }

        throw error;
    }
}

async function listCustomerNotifications(
    userId,
    query = {}
) {
    requireObjectId(
        userId,
        "userId"
    );

    const filter = {
        userId
    };

    const readFilter =
        String(
            query.read ||
            query.status ||
            ""
        )
            .trim()
            .toUpperCase();

    if (
        [
            "UNREAD",
            "FALSE",
            "0"
        ].includes(
            readFilter
        )
    ) {
        filter.read = false;
    }

    if (
        [
            "READ",
            "TRUE",
            "1"
        ].includes(
            readFilter
        )
    ) {
        filter.read = true;
    }

    const type =
        String(
            query.type ||
            ""
        )
            .trim()
            .toUpperCase();

    if (type) {
        filter.type = type;
    }

    const requestedLimit =
        Number(
            query.limit ||
            100
        );

    const limit =
        Number.isFinite(
            requestedLimit
        )
            ? Math.min(
                100,
                Math.max(
                    1,
                    Math.floor(
                        requestedLimit
                    )
                )
            )
            : 100;

    const notifications =
        await Notification.find(
            filter
        )
            .sort({
                createdAt: -1,
                _id: -1
            })
            .limit(limit);

    const unreadCount =
        await Notification
            .countDocuments({
                userId,
                read: false
            });

    return {
        notifications:
            notifications.map(
                serializeNotification
            ),
        count:
            notifications.length,
        unreadCount
    };
}

async function getUnreadCount(
    userId
) {
    requireObjectId(
        userId,
        "userId"
    );

    return Notification
        .countDocuments({
            userId,
            read: false
        });
}

async function markNotificationRead(
    userId,
    notificationId
) {
    requireObjectId(
        userId,
        "userId"
    );

    requireObjectId(
        notificationId,
        "notificationId"
    );

    const notification =
        await Notification.findOne({
            _id:
                notificationId,
            userId
        });

    if (!notification) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Notification not found."
        );
    }

    if (!notification.read) {
        notification.read = true;
        notification.readAt =
            new Date();

        await notification.save();
    }

    return serializeNotification(
        notification
    );
}

async function markAllNotificationsRead(
    userId
) {
    requireObjectId(
        userId,
        "userId"
    );

    const now =
        new Date();

    const result =
        await Notification.updateMany(
            {
                userId,
                read: false
            },
            {
                $set: {
                    read: true,
                    readAt: now
                }
            }
        );

    return {
        modifiedCount:
            Number(
                result.modifiedCount ||
                0
            ),
        unreadCount: 0,
        readAt: now
    };
}

async function notifyWaitlistOffer(
    {
        userId,
        waitlistId,
        offerId,
        showId,
        eventId,
        categoryName,
        seatLabel,
        expiresAt
    },
    options = {}
) {
    const expiryText =
        expiresAt
            ? new Date(
                expiresAt
            ).toISOString()
            : null;

    return createNotification(
        {
            userId,
            type:
                "WAITLIST_OFFER",
            title:
                "A seat is available from your waitlist",
            message:
                `${seatLabel || "A seat"} in ${categoryName || "your category"} is available for a limited time.${
                    expiryText
                        ? ` Claim it before ${expiryText}.`
                        : ""
                }`,
            showId,
            eventId,
            waitlistId,
            offerId,
            actionUrl:
                `./waitlist.html?offer=${encodeURIComponent(
                    String(offerId)
                )}`,
            actionLabel:
                "View Offer",
            dedupeKey:
                `waitlist-offer:${String(offerId)}`
        },
        options
    );
}

async function notifyBookingConfirmed(
    booking,
    options = {}
) {
    const seatLabels =
        Array.isArray(
            booking?.seats
        )
            ? booking.seats
                .map(
                    (seat) =>
                        seat.label
                )
                .filter(Boolean)
                .join(", ")
            : "";

    return createNotification(
        {
            userId:
                booking.userId,
            type:
                "BOOKING_CONFIRMED",
            title:
                "Booking confirmed",
            message:
                `${booking.eventTitle || "Your SKYRA booking"} is confirmed${
                    booking.reference
                        ? ` (${booking.reference})`
                        : ""
                }${
                    seatLabels
                        ? `. Seats: ${seatLabels}.`
                        : "."
                }`,
            bookingId:
                booking._id,
            paymentId:
                booking.paymentId,
            showId:
                booking.showId,
            eventId:
                booking.eventId,
            actionUrl:
                `./ticket.html?booking=${encodeURIComponent(
                    String(
                        booking._id
                    )
                )}`,
            actionLabel:
                "View Ticket",
            dedupeKey:
                `booking-confirmed:${String(
                    booking._id
                )}`
        },
        options
    );
}

async function notifyBookingCancelled(
    booking,
    options = {}
) {
    return createNotification(
        {
            userId:
                booking.userId,
            type:
                "BOOKING_CANCELLED",
            title:
                "Booking cancelled",
            message:
                `${booking.eventTitle || "Your SKYRA booking"}${
                    booking.reference
                        ? ` (${booking.reference})`
                        : ""
                } has been cancelled.`,
            bookingId:
                booking._id,
            paymentId:
                booking.paymentId,
            showId:
                booking.showId,
            eventId:
                booking.eventId,
            actionUrl:
                "./my-bookings.html",
            actionLabel:
                "My Bookings",
            dedupeKey:
                `booking-cancelled:${String(
                    booking._id
                )}`
        },
        options
    );
}

async function notifyRefundUpdated(
    booking
) {
    const status =
        String(
            booking?.refundStatus ||
            "NONE"
        ).toUpperCase();

    if (
        ![
            "PENDING",
            "REFUNDED",
            "FAILED"
        ].includes(
            status
        )
    ) {
        return null;
    }

    const amount =
        Number(
            booking.refundAmount ||
            booking.grandTotal ||
            0
        );

    let title =
        "Refund update";

    let message =
        `Refund status for ${booking.reference || "your booking"}: ${status}.`;

    if (status === "PENDING") {
        title =
            "Refund initiated";
        message =
            `Your refund${amount > 0 ? ` of ₹${amount}` : ""} for ${booking.reference || "your booking"} is being processed.`;
    }

    if (status === "REFUNDED") {
        title =
            "Refund completed";
        message =
            `Your refund${amount > 0 ? ` of ₹${amount}` : ""} for ${booking.reference || "your booking"} has been completed.`;
    }

    if (status === "FAILED") {
        title =
            "Refund needs attention";
        message =
            `The refund for ${booking.reference || "your booking"} could not be completed automatically.`;
    }

    return createNotification({
        userId:
            booking.userId,
        type:
            "REFUND_UPDATED",
        title,
        message,
        bookingId:
            booking._id,
        paymentId:
            booking.paymentId,
        showId:
            booking.showId,
        eventId:
            booking.eventId,
        actionUrl:
            "./my-bookings.html",
        actionLabel:
            "My Bookings",
        dedupeKey:
            `refund:${String(
                booking._id
            )}:${status}`
    });
}

module.exports = {
    createNotification,
    listCustomerNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    notifyWaitlistOffer,
    notifyBookingConfirmed,
    notifyBookingCancelled,
    notifyRefundUpdated,
    serializeNotification
};
