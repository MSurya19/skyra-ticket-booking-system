"use strict";

const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");

const User = require("../models/User");
const Event = require("../models/Event");
const Show = require("../models/Show");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");

const BOOKING_CONFIRMED = "CONFIRMED";
const BOOKING_CANCELLED = "CANCELLED";

function toIdString(value) {
    if (value === null || value === undefined) return "";
    return String(value);
}

function assertObjectId(value, label = "ID") {
    if (!mongoose.Types.ObjectId.isValid(String(value || ""))) {
        throw new ApiError(400, `${label} is invalid.`);
    }
}

function asObjectId(value, label = "ID") {
    assertObjectId(value, label);
    return new mongoose.Types.ObjectId(String(value));
}

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function organiserDisplayName(user) {
    return (
        user?.organiserProfile?.businessName ||
        user?.name ||
        "Organiser"
    );
}

function serializeOrganiser(user) {
    if (!user) return null;

    return {
        _id: user._id,
        id: toIdString(user._id),
        name: organiserDisplayName(user),
        accountName: user.name || "",
        contactPerson:
            user?.organiserProfile?.contactPerson ||
            user?.name ||
            "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role,
        status: user.status,
        emailVerified: Boolean(user.emailVerified)
    };
}

function paymentStatusForOrganiser(payment, booking) {
    if (
        booking?.refundStatus === "REFUNDED" ||
        payment?.refundStatus === "REFUNDED"
    ) {
        return "REFUNDED";
    }

    if (payment?.status === "VERIFIED") {
        return "SUCCESS";
    }

    if (payment?.status === "FAILED") {
        return "FAILED";
    }

    return payment?.status || "PENDING";
}

function serializeBooking(booking) {
    const customer =
        booking.userId && typeof booking.userId === "object"
            ? booking.userId
            : null;

    const payment =
        booking.paymentId && typeof booking.paymentId === "object"
            ? booking.paymentId
            : null;

    const customerId = customer?._id || booking.userId || null;
    const paymentId = payment?._id || booking.paymentId || null;

    const seats = Array.isArray(booking.seats)
        ? booking.seats.map((seat) => ({
            showSeatId: seat.showSeatId || null,
            categoryId: seat.categoryId || null,
            row: seat.row || "",
            number: Number(seat.number || 0),
            label: seat.label || "",
            categoryName: seat.categoryName || "",
            category: seat.categoryName || "",
            price: Number(seat.price || 0)
        }))
        : [];

    return {
        _id: booking._id,
        id: toIdString(booking._id),
        reference: booking.reference,

        customer: {
            _id: customerId,
            id: toIdString(customerId),
            name: customer?.name || "Customer",
            email: customer?.email || ""
        },
        customerName: customer?.name || "Customer",
        customerEmail: customer?.email || "",

        organiserId: booking.organiserId,

        eventId: booking.eventId,
        eventTitle: booking.eventTitle,
        eventType: booking.eventType || "",
        event: {
            _id: booking.eventId,
            id: toIdString(booking.eventId),
            title: booking.eventTitle,
            type: booking.eventType || ""
        },

        showId: booking.showId,
        showReference:
            booking.showId && typeof booking.showId === "object"
                ? booking.showId.reference || ""
                : "",
        show: {
            _id:
                booking.showId && typeof booking.showId === "object"
                    ? booking.showId._id
                    : booking.showId,
            id: toIdString(
                booking.showId && typeof booking.showId === "object"
                    ? booking.showId._id
                    : booking.showId
            ),
            reference:
                booking.showId && typeof booking.showId === "object"
                    ? booking.showId.reference || ""
                    : "",
            date: booking.date,
            time: booking.time,
            startsAt: booking.startsAt
        },

        venueId: booking.venueId,
        venueName: booking.venueName,
        venueCity: booking.venueCity || "",
        venue: {
            _id: booking.venueId,
            id: toIdString(booking.venueId),
            name: booking.venueName,
            city: booking.venueCity || ""
        },

        date: booking.date,
        time: booking.time,
        showDate: booking.date,
        showTime: booking.time,
        startsAt: booking.startsAt,

        seats,
        seatLabels: seats.map((seat) => seat.label).filter(Boolean).join(", "),
        seatCount: Number(booking.seatCount || seats.length || 0),

        subtotal: Number(booking.subtotal || 0),
        convenienceFee: Number(booking.convenienceFee || 0),
        total: Number(booking.grandTotal || 0),
        amount: Number(booking.grandTotal || 0),
        grandTotal: Number(booking.grandTotal || 0),
        currency: booking.currency || "INR",

        paymentId,
        paymentStatus: paymentStatusForOrganiser(payment, booking),
        paymentMethod: payment?.paymentMethod || booking.paymentMethod || "",
        paymentReference:
            payment?.reference ||
            payment?.razorpayPaymentId ||
            booking.razorpayPaymentId ||
            toIdString(paymentId) ||
            "—",
        payment: {
            _id: paymentId,
            id: toIdString(paymentId),
            status: paymentStatusForOrganiser(payment, booking),
            rawStatus: payment?.status || null,
            method: payment?.paymentMethod || booking.paymentMethod || "",
            reference:
                payment?.reference ||
                payment?.razorpayPaymentId ||
                booking.razorpayPaymentId ||
                "",
            refundStatus:
                payment?.refundStatus || booking.refundStatus || "NONE"
        },

        status: booking.status,
        refundStatus: booking.refundStatus || "NONE",
        refundAmount: Number(booking.refundAmount || 0),
        confirmedAt: booking.confirmedAt || null,
        cancelledAt: booking.cancelledAt || null,
        cancellationReason: booking.cancellationReason || null,
        createdAt: booking.createdAt || null,
        updatedAt: booking.updatedAt || null
    };
}

function serializeShow(show) {
    const capacity = Number(show.capacity || 0);
    const soldSeats = Number(show.soldSeats || 0);
    const occupancyPercent = capacity > 0
        ? Math.round((soldSeats / capacity) * 10000) / 100
        : 0;

    return {
        _id: show._id,
        id: toIdString(show._id),
        organiserId: show.organiserId,
        eventId: show.eventId,
        eventTitle: show.eventTitle,
        type: show.eventType || "",
        eventType: show.eventType || "",
        venueId: show.venueId,
        venue: show.venueName,
        venueName: show.venueName,
        city: show.venueCity || "",
        venueCity: show.venueCity || "",
        reference: show.reference,
        date: show.date,
        time: show.time,
        startsAt: show.startsAt,
        endsAt: show.endsAt || null,
        status: show.status,
        totalSeats: capacity,
        capacity,
        soldSeats,
        availableSeats: Math.max(0, capacity - soldSeats),
        occupancyPercent,
        ticketRevenue: Number(show.revenue || 0),
        revenue: Number(show.revenue || 0),
        seatsGenerated: Boolean(show.seatsGenerated)
    };
}

function buildDateFilter(periodValue) {
    const raw = String(periodValue ?? "ALL").trim().toUpperCase();

    if (!raw || raw === "ALL") {
        return null;
    }

    const days = Number(raw.replace(/DAYS?|D/g, ""));

    if (![7, 30, 90, 365].includes(days)) {
        throw new ApiError(
            400,
            "Revenue period must be ALL, 7, 30, 90, or 365 days."
        );
    }

    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function revenueMatch(organiserObjectId, query = {}) {
    const match = { organiserId: organiserObjectId };

    const start = buildDateFilter(query.period);
    if (start) {
        match.createdAt = { $gte: start };
    }

    if (query.eventId) {
        match.eventId = asObjectId(query.eventId, "Event ID");
    }

    if (query.showId) {
        match.showId = asObjectId(query.showId, "Show ID");
    }

    return match;
}

async function getOrganiserAccount(organiserId) {
    const organiserObjectId = asObjectId(organiserId, "Organiser ID");

    const organiser = await User.findOne({
        _id: organiserObjectId,
        role: "ORGANISER"
    })
        .select(
            "name email phone role status emailVerified organiserProfile createdAt lastLoginAt"
        )
        .lean();

    if (!organiser) {
        throw new ApiError(404, "Organiser account not found.");
    }

    return organiser;
}

async function aggregateBookingSummary(match) {
    const rows = await Booking.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", BOOKING_CONFIRMED] },
                            1,
                            0
                        ]
                    }
                },
                cancelledBookings: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", BOOKING_CANCELLED] },
                            1,
                            0
                        ]
                    }
                },
                ticketsSold: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", BOOKING_CONFIRMED] },
                            "$seatCount",
                            0
                        ]
                    }
                },
                grossBookingValue: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", BOOKING_CONFIRMED] },
                            "$grandTotal",
                            0
                        ]
                    }
                },
                ticketRevenue: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", BOOKING_CONFIRMED] },
                            "$subtotal",
                            0
                        ]
                    }
                },
                convenienceFees: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", BOOKING_CONFIRMED] },
                            "$convenienceFee",
                            0
                        ]
                    }
                },
                refundedValue: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$status", BOOKING_CANCELLED] },
                                    { $eq: ["$refundStatus", "REFUNDED"] }
                                ]
                            },
                            "$refundAmount",
                            0
                        ]
                    }
                },
                refundedTicketValue: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$status", BOOKING_CANCELLED] },
                                    { $eq: ["$refundStatus", "REFUNDED"] }
                                ]
                            },
                            "$subtotal",
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const row = rows[0] || {};

    return {
        totalBookings: Number(row.totalBookings || 0),
        confirmedBookings: Number(row.confirmedBookings || 0),
        cancelledBookings: Number(row.cancelledBookings || 0),
        ticketsSold: Number(row.ticketsSold || 0),
        grossBookingValue: Number(row.grossBookingValue || 0),
        ticketRevenue: Number(row.ticketRevenue || 0),
        convenienceFees: Number(row.convenienceFees || 0),
        refundedValue: Number(row.refundedValue || 0),
        refundedTicketValue: Number(row.refundedTicketValue || 0)
    };
}

async function getDashboard(organiserId) {
    const organiser = await getOrganiserAccount(organiserId);
    const organiserObjectId = asObjectId(organiserId, "Organiser ID");
    const now = new Date();

    const [
        totalEvents,
        totalShows,
        activeShows,
        bookingSummary,
        showDocs,
        recentBookingDocs
    ] = await Promise.all([
        Event.countDocuments({
            organiserId: organiserObjectId,
            deleted: false
        }),
        Show.countDocuments({ organiserId: organiserObjectId }),
        Show.countDocuments({
            organiserId: organiserObjectId,
            status: "SCHEDULED",
            startsAt: { $gte: now }
        }),
        aggregateBookingSummary({ organiserId: organiserObjectId }),
        Show.find({ organiserId: organiserObjectId })
            .sort({ startsAt: 1, createdAt: -1 })
            .select(
                "organiserId eventId venueId reference eventTitle eventType venueName venueCity date time startsAt endsAt capacity soldSeats revenue seatsGenerated status"
            )
            .lean(),
        Booking.find({ organiserId: organiserObjectId })
            .sort({ createdAt: -1 })
            .limit(8)
            .populate("userId", "name email")
            .populate("paymentId", "status refundStatus paymentMethod reference razorpayPaymentId")
            .populate("showId", "reference")
            .lean()
    ]);

    const shows = showDocs.map(serializeShow);
    const upcomingShows = shows
        .filter((show) =>
            show.status === "SCHEDULED" &&
            new Date(show.startsAt).getTime() >= now.getTime()
        )
        .slice(0, 8);

    const capacity = upcomingShows.reduce(
        (sum, show) => sum + Number(show.totalSeats || 0),
        0
    );
    const soldSeats = upcomingShows.reduce(
        (sum, show) => sum + Number(show.soldSeats || 0),
        0
    );

    return {
        organiser: serializeOrganiser(organiser),
        summary: {
            totalEvents,
            totalShows,
            activeShows,
            totalBookings: bookingSummary.totalBookings,
            confirmedBookings: bookingSummary.confirmedBookings,
            cancelledBookings: bookingSummary.cancelledBookings,
            ticketsSold: bookingSummary.ticketsSold,
            revenue: bookingSummary.ticketRevenue,
            grossBookingValue: bookingSummary.grossBookingValue,
            ticketRevenue: bookingSummary.ticketRevenue,
            convenienceFees: bookingSummary.convenienceFees,
            refundedValue: bookingSummary.refundedValue,
            seatCapacity: capacity,
            soldSeats,
            occupancyPercent:
                capacity > 0
                    ? Math.round((soldSeats / capacity) * 10000) / 100
                    : 0
        },
        shows: upcomingShows,
        allShows: shows,
        bookings: recentBookingDocs.map(serializeBooking)
    };
}

function normalizeBookingStatus(value) {
    const status = String(value || "").trim().toUpperCase();
    if (!status || status === "ALL") return null;

    if (![BOOKING_CONFIRMED, BOOKING_CANCELLED].includes(status)) {
        throw new ApiError(400, "Booking status must be CONFIRMED or CANCELLED.");
    }

    return status;
}

async function getBookings(organiserId, query = {}) {
    const organiserObjectId = asObjectId(organiserId, "Organiser ID");

    const filter = { organiserId: organiserObjectId };
    const status = normalizeBookingStatus(query.status);

    if (status) filter.status = status;

    if (query.showId) {
        filter.showId = asObjectId(query.showId, "Show ID");
    }

    if (query.eventId) {
        filter.eventId = asObjectId(query.eventId, "Event ID");
    }

    const search = String(query.search || "").trim();
    if (search) {
        const regex = new RegExp(escapeRegExp(search), "i");
        const matchingUsers = await User.find({
            role: "CUSTOMER",
            $or: [
                { name: regex },
                { email: regex }
            ]
        }).select("_id").lean();

        filter.$or = [
            { reference: regex },
            { eventTitle: regex },
            { venueName: regex },
            { userId: { $in: matchingUsers.map((user) => user._id) } }
        ];
    }

    const [bookingDocs, summary, shows] = await Promise.all([
        Booking.find(filter)
            .sort({ createdAt: -1 })
            .populate("userId", "name email")
            .populate("paymentId", "status refundStatus paymentMethod reference razorpayPaymentId")
            .populate("showId", "reference")
            .lean(),
        aggregateBookingSummary({ organiserId: organiserObjectId }),
        Show.find({ organiserId: organiserObjectId })
            .sort({ startsAt: -1 })
            .select("_id reference eventTitle date time startsAt status")
            .lean()
    ]);

    return {
        bookings: bookingDocs.map(serializeBooking),
        count: bookingDocs.length,
        summary: {
            total: summary.totalBookings,
            confirmed: summary.confirmedBookings,
            cancelled: summary.cancelledBookings,
            ticketsSold: summary.ticketsSold,
            revenue: summary.ticketRevenue,
            grossBookingValue: summary.grossBookingValue,
            ticketRevenue: summary.ticketRevenue,
            convenienceFees: summary.convenienceFees
        },
        shows: shows.map((show) => ({
            _id: show._id,
            id: toIdString(show._id),
            reference: show.reference,
            eventTitle: show.eventTitle,
            date: show.date,
            time: show.time,
            startsAt: show.startsAt,
            status: show.status
        }))
    };
}

async function getBookingById(organiserId, bookingId) {
    const organiserObjectId = asObjectId(organiserId, "Organiser ID");
    const bookingObjectId = asObjectId(bookingId, "Booking ID");

    const booking = await Booking.findOne({
        _id: bookingObjectId,
        organiserId: organiserObjectId
    })
        .populate("userId", "name email")
        .populate("paymentId", "status refundStatus paymentMethod reference razorpayPaymentId")
        .populate("showId", "reference")
        .lean();

    if (!booking) {
        throw new ApiError(404, "Booking not found for this organiser.");
    }

    return serializeBooking(booking);
}

async function getRevenue(organiserId, query = {}) {
    const organiserObjectId = asObjectId(organiserId, "Organiser ID");
    const match = revenueMatch(organiserObjectId, query);

    const [summary, eventRows, trendRows, bookingDocs] = await Promise.all([
        aggregateBookingSummary(match),
        Booking.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        eventId: "$eventId",
                        eventTitle: "$eventTitle"
                    },
                    totalBookings: { $sum: 1 },
                    confirmedBookings: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", BOOKING_CONFIRMED] },
                                1,
                                0
                            ]
                        }
                    },
                    ticketsSold: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", BOOKING_CONFIRMED] },
                                "$seatCount",
                                0
                            ]
                        }
                    },
                    ticketRevenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", BOOKING_CONFIRMED] },
                                "$subtotal",
                                0
                            ]
                        }
                    },
                    grossBookingValue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", BOOKING_CONFIRMED] },
                                "$grandTotal",
                                0
                            ]
                        }
                    },
                    refundedTicketValue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$status", BOOKING_CANCELLED] },
                                        { $eq: ["$refundStatus", "REFUNDED"] }
                                    ]
                                },
                                "$subtotal",
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { ticketRevenue: -1, "_id.eventTitle": 1 } }
        ]),
        Booking.aggregate([
            {
                $match: {
                    ...match,
                    status: BOOKING_CONFIRMED
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt"
                        }
                    },
                    bookings: { $sum: 1 },
                    tickets: { $sum: "$seatCount" },
                    ticketRevenue: { $sum: "$subtotal" },
                    grossBookingValue: { $sum: "$grandTotal" }
                }
            },
            { $sort: { _id: 1 } }
        ]),
        Booking.find(match)
            .sort({ createdAt: -1 })
            .populate("userId", "name email")
            .populate("paymentId", "status refundStatus paymentMethod reference razorpayPaymentId")
            .populate("showId", "reference")
            .lean()
    ]);

    const paidBookings = summary.confirmedBookings;
    const ticketsSold = summary.ticketsSold;

    const serverSummary = {
        grossTicketRevenue: summary.ticketRevenue,
        ticketRevenue: summary.ticketRevenue,
        grossBookingValue: summary.grossBookingValue,
        convenienceFees: summary.convenienceFees,
        paidBookings,
        ticketsSold,
        cancelledBookings: summary.cancelledBookings,
        refundedValue: summary.refundedValue,
        refundedTicketValue: summary.refundedTicketValue,
        averageBooking:
            paidBookings > 0
                ? Math.round((summary.grossBookingValue / paidBookings) * 100) / 100
                : 0,
        averageTicket:
            ticketsSold > 0
                ? Math.round((summary.ticketRevenue / ticketsSold) * 100) / 100
                : 0
    };

    const events = eventRows.map((row) => ({
        eventId: row._id?.eventId || null,
        id: toIdString(row._id?.eventId),
        eventTitle: row._id?.eventTitle || "SKYRA Event",
        totalBookings: Number(row.totalBookings || 0),
        confirmedBookings: Number(row.confirmedBookings || 0),
        bookings: Number(row.confirmedBookings || 0),
        ticketsSold: Number(row.ticketsSold || 0),
        tickets: Number(row.ticketsSold || 0),
        ticketRevenue: Number(row.ticketRevenue || 0),
        revenue: Number(row.ticketRevenue || 0),
        grossBookingValue: Number(row.grossBookingValue || 0),
        refundedTicketValue: Number(row.refundedTicketValue || 0),
        refunded: Number(row.refundedTicketValue || 0)
    }));

    const trend = trendRows.map((row) => ({
        date: row._id,
        bookings: Number(row.bookings || 0),
        tickets: Number(row.tickets || 0),
        ticketRevenue: Number(row.ticketRevenue || 0),
        revenue: Number(row.ticketRevenue || 0),
        grossBookingValue: Number(row.grossBookingValue || 0)
    }));

    const bookings = bookingDocs.map(serializeBooking);

    return {
        summary: serverSummary,
        events,
        trend,
        bookings,
        transactions: bookings
    };
}

async function getRevenueEvents(organiserId, query = {}) {
    const revenue = await getRevenue(organiserId, query);
    return {
        summary: revenue.summary,
        events: revenue.events
    };
}

async function getRevenueTransactions(organiserId, query = {}) {
    const revenue = await getRevenue(organiserId, query);
    return {
        summary: revenue.summary,
        transactions: revenue.transactions,
        count: revenue.transactions.length
    };
}

module.exports = {
    getDashboard,
    getBookings,
    getBookingById,
    getRevenue,
    getRevenueEvents,
    getRevenueTransactions
};
