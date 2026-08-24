"use strict";

const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");

const User = require("../models/User");
const Venue = require("../models/Venue");
const Seat = require("../models/Seat");
const Event = require("../models/Event");
const Show = require("../models/Show");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");

const ACTIVE = "ACTIVE";
const SUSPENDED = "SUSPENDED";
const CUSTOMER = "CUSTOMER";
const ORGANISER = "ORGANISER";

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIdString(value) {
    if (value === null || value === undefined) return "";
    return String(value);
}

function assertObjectId(value, label = "ID") {
    if (!mongoose.Types.ObjectId.isValid(String(value || ""))) {
        throw new ApiError(400, `${label} is invalid.`);
    }
}

function normalizeAccountStatus(value) {
    const status = String(value || "").trim().toUpperCase();
    if (![ACTIVE, SUSPENDED].includes(status)) {
        throw new ApiError(400, "Status must be ACTIVE or SUSPENDED.");
    }
    return status;
}

async function aggregateCountBy(field, Model, match = {}) {
    const rows = await Model.aggregate([
        { $match: match },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } }
    ]);

    return new Map(
        rows
            .filter((row) => row?._id)
            .map((row) => [toIdString(row._id), Number(row.count || 0)])
    );
}

async function aggregateRevenueByOrganiser(match = {}) {
    const rows = await Booking.aggregate([
        {
            $match: {
                status: "CONFIRMED",
                organiserId: { $ne: null },
                ...match
            }
        },
        {
            $group: {
                _id: "$organiserId",
                revenue: { $sum: "$grandTotal" },
                bookingCount: { $sum: 1 }
            }
        }
    ]);

    const map = new Map();
    rows.forEach((row) => {
        if (!row?._id) return;
        map.set(toIdString(row._id), {
            revenue: Number(row.revenue || 0),
            bookingCount: Number(row.bookingCount || 0)
        });
    });
    return map;
}

function serializeCustomer(user, bookingCount = 0) {
    return {
        _id: user._id,
        id: toIdString(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        city: user.city || "",
        state: user.state || "",
        country: user.country || "",
        role: user.role,
        emailVerified: Boolean(user.emailVerified),
        status: user.status,
        bookingCount: Number(bookingCount || 0),
        joinedAt: user.createdAt || null,
        createdAt: user.createdAt || null,
        lastLoginAt: user.lastLoginAt || null
    };
}

function organiserDisplayName(user) {
    return (
        user?.organiserProfile?.businessName ||
        user?.name ||
        "Organiser"
    );
}

function serializeOrganiser(user, metrics = {}) {
    return {
        _id: user._id,
        id: toIdString(user._id),
        name: organiserDisplayName(user),
        accountName: user.name,
        contactPerson:
            user?.organiserProfile?.contactPerson || user.name || "",
        description: user?.organiserProfile?.description || "",
        email: user.email,
        phone: user.phone || "",
        city: user.city || "",
        state: user.state || "",
        country: user.country || "",
        role: user.role,
        emailVerified: Boolean(user.emailVerified),
        status: user.status,
        eventCount: Number(metrics.eventCount || 0),
        showCount: Number(metrics.showCount || 0),
        bookingCount: Number(metrics.bookingCount || 0),
        revenue: Number(metrics.revenue || 0),
        joinedAt: user.createdAt || null,
        createdAt: user.createdAt || null,
        lastLoginAt: user.lastLoginAt || null
    };
}

function paymentStatusForAdmin(payment, booking) {
    if (booking?.refundStatus === "REFUNDED" || payment?.refundStatus === "REFUNDED") {
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
    const customer = booking.userId && typeof booking.userId === "object"
        ? booking.userId
        : null;

    const organiser = booking.organiserId && typeof booking.organiserId === "object"
        ? booking.organiserId
        : null;

    const payment = booking.paymentId && typeof booking.paymentId === "object"
        ? booking.paymentId
        : null;

    const customerId = customer?._id || booking.userId || null;
    const organiserId = organiser?._id || booking.organiserId || null;
    const paymentId = payment?._id || booking.paymentId || null;

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

        organiser: {
            _id: organiserId,
            id: toIdString(organiserId),
            name: organiser ? organiserDisplayName(organiser) : "Organiser"
        },

        event: {
            _id: booking.eventId,
            id: toIdString(booking.eventId),
            name: booking.eventTitle,
            title: booking.eventTitle,
            type: booking.eventType || ""
        },

        show: {
            _id: booking.showId,
            id: toIdString(booking.showId),
            startsAt: booking.startsAt
        },

        venue: {
            _id: booking.venueId,
            id: toIdString(booking.venueId),
            name: booking.venueName,
            city: booking.venueCity || ""
        },

        seats: Array.isArray(booking.seats) ? booking.seats : [],
        seatCount: Number(booking.seatCount || booking.seats?.length || 0),
        subtotal: Number(booking.subtotal || 0),
        convenienceFee: Number(booking.convenienceFee || 0),
        amount: Number(booking.grandTotal || 0),
        grandTotal: Number(booking.grandTotal || 0),
        currency: booking.currency || "INR",

        payment: {
            _id: paymentId,
            id: toIdString(paymentId),
            status: paymentStatusForAdmin(payment, booking),
            rawStatus: payment?.status || null,
            method: payment?.paymentMethod || booking.paymentMethod || "",
            refundStatus: payment?.refundStatus || booking.refundStatus || "NONE"
        },

        paymentId,
        paymentMethod: booking.paymentMethod || payment?.paymentMethod || "",
        paymentStatus: paymentStatusForAdmin(payment, booking),

        status: booking.status,
        refundStatus: booking.refundStatus || "NONE",
        refundAmount: Number(booking.refundAmount || 0),
        qrIssued: Boolean(booking.qrPayload),
        bookedAt: booking.createdAt || booking.confirmedAt || null,
        confirmedAt: booking.confirmedAt || null,
        cancelledAt: booking.cancelledAt || null,
        cancellationReason: booking.cancellationReason || null,
        createdAt: booking.createdAt || null,
        updatedAt: booking.updatedAt || null
    };
}

async function getDashboard() {
    const [
        totalVenues,
        activeVenues,
        totalSeats,
        totalUsers,
        totalCustomers,
        totalOrganisers,
        totalEvents,
        totalShows,
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        revenueRows,
        venues,
        recentBookingDocs,
        recentOrganiserDocs
    ] = await Promise.all([
        Venue.countDocuments({ deleted: false }),
        Venue.countDocuments({ deleted: false, status: "ACTIVE" }),
        Seat.countDocuments({}),
        User.countDocuments({}),
        User.countDocuments({ role: CUSTOMER }),
        User.countDocuments({ role: ORGANISER }),
        Event.countDocuments({ deleted: false }),
        Show.countDocuments({}),
        Booking.countDocuments({}),
        Booking.countDocuments({ status: "CONFIRMED" }),
        Booking.countDocuments({ status: "CANCELLED" }),
        Booking.aggregate([
            { $match: { status: "CONFIRMED" } },
            { $group: { _id: null, revenue: { $sum: "$grandTotal" } } }
        ]),
        Venue.find({ deleted: false })
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(5)
            .select("name city capacity seatCategories layoutConfigured status createdAt updatedAt")
            .lean(),
        Booking.find({})
            .sort({ createdAt: -1 })
            .limit(8)
            .populate("userId", "name email")
            .populate("organiserId", "name organiserProfile")
            .populate("paymentId", "status paymentMethod refundStatus")
            .lean(),
        User.find({ role: ORGANISER })
            .sort({ createdAt: -1 })
            .limit(6)
            .select("name email status organiserProfile createdAt lastLoginAt")
            .lean()
    ]);

    const recentOrganiserIds = recentOrganiserDocs.map((row) => row._id);
    const recentEventCounts = recentOrganiserIds.length
        ? await aggregateCountBy("organiserId", Event, {
            organiserId: { $in: recentOrganiserIds },
            deleted: false
        })
        : new Map();

    return {
        summary: {
            totalVenues,
            activeVenues,
            totalSeats,
            totalUsers,
            totalCustomers,
            totalOrganisers,
            totalEvents,
            totalShows,
            totalBookings,
            confirmedBookings,
            cancelledBookings,
            revenue: Number(revenueRows?.[0]?.revenue || 0)
        },
        venues: venues.map((venue) => ({
            ...venue,
            id: toIdString(venue._id),
            categories: Array.isArray(venue.seatCategories)
                ? venue.seatCategories.length
                : 0
        })),
        recentBookings: recentBookingDocs.map(serializeBooking),
        recentOrganisers: recentOrganiserDocs.map((user) =>
            serializeOrganiser(user, {
                eventCount: recentEventCounts.get(toIdString(user._id)) || 0
            })
        )
    };
}

async function getUsers(query = {}) {
    const role = String(query.role || CUSTOMER).trim().toUpperCase();

    // The Admin Users page is intentionally customer-focused.
    const targetRole = role === CUSTOMER ? CUSTOMER : CUSTOMER;

    const filter = { role: targetRole };

    const status = String(query.status || "").trim().toUpperCase();
    if ([ACTIVE, SUSPENDED].includes(status)) {
        filter.status = status;
    }

    const search = String(query.search || "").trim();
    if (search) {
        const regex = new RegExp(escapeRegExp(search), "i");
        filter.$or = [
            { name: regex },
            { email: regex },
            { phone: regex },
            { city: regex }
        ];
    }

    const [users, total, active, suspended, verified] = await Promise.all([
        User.find(filter)
            .sort({ createdAt: -1 })
            .select("name email phone city state country role emailVerified status createdAt lastLoginAt")
            .lean(),
        User.countDocuments({ role: CUSTOMER }),
        User.countDocuments({ role: CUSTOMER, status: ACTIVE }),
        User.countDocuments({ role: CUSTOMER, status: SUSPENDED }),
        User.countDocuments({ role: CUSTOMER, emailVerified: true })
    ]);

    const ids = users.map((user) => user._id);
    const bookingCounts = ids.length
        ? await aggregateCountBy("userId", Booking, { userId: { $in: ids } })
        : new Map();

    return {
        users: users.map((user) =>
            serializeCustomer(user, bookingCounts.get(toIdString(user._id)) || 0)
        ),
        summary: { total, active, suspended, verified }
    };
}

async function getUserById(userId) {
    assertObjectId(userId, "User ID");

    const user = await User.findOne({ _id: userId, role: CUSTOMER })
        .select("name email phone city state country role emailVerified status createdAt lastLoginAt")
        .lean();

    if (!user) {
        throw new ApiError(404, "Customer not found.");
    }

    const bookingCount = await Booking.countDocuments({ userId: user._id });
    return serializeCustomer(user, bookingCount);
}

async function updateUserStatus(userId, statusValue) {
    assertObjectId(userId, "User ID");
    const status = normalizeAccountStatus(statusValue);

    const user = await User.findOneAndUpdate(
        { _id: userId, role: CUSTOMER },
        { $set: { status } },
        { new: true, runValidators: true }
    )
        .select("name email phone city state country role emailVerified status createdAt lastLoginAt")
        .lean();

    if (!user) {
        throw new ApiError(404, "Customer not found.");
    }

    const bookingCount = await Booking.countDocuments({ userId: user._id });
    return serializeCustomer(user, bookingCount);
}

async function getOrganisers(query = {}) {
    const filter = { role: ORGANISER };

    const status = String(query.status || "").trim().toUpperCase();
    if ([ACTIVE, SUSPENDED].includes(status)) {
        filter.status = status;
    }

    const search = String(query.search || "").trim();
    if (search) {
        const regex = new RegExp(escapeRegExp(search), "i");
        filter.$or = [
            { name: regex },
            { email: regex },
            { phone: regex },
            { city: regex },
            { "organiserProfile.businessName": regex },
            { "organiserProfile.contactPerson": regex }
        ];
    }

    const [organisers, total, active, suspended, verified] = await Promise.all([
        User.find(filter)
            .sort({ createdAt: -1 })
            .select("name email phone city state country role emailVerified status organiserProfile createdAt lastLoginAt")
            .lean(),
        User.countDocuments({ role: ORGANISER }),
        User.countDocuments({ role: ORGANISER, status: ACTIVE }),
        User.countDocuments({ role: ORGANISER, status: SUSPENDED }),
        User.countDocuments({ role: ORGANISER, emailVerified: true })
    ]);

    const ids = organisers.map((user) => user._id);

    const [eventCounts, showCounts, bookingCounts, revenueMap] = ids.length
        ? await Promise.all([
            aggregateCountBy("organiserId", Event, {
                organiserId: { $in: ids },
                deleted: false
            }),
            aggregateCountBy("organiserId", Show, {
                organiserId: { $in: ids }
            }),
            aggregateCountBy("organiserId", Booking, {
                organiserId: { $in: ids }
            }),
            aggregateRevenueByOrganiser({ organiserId: { $in: ids } })
        ])
        : [new Map(), new Map(), new Map(), new Map()];

    return {
        organisers: organisers.map((user) => {
            const key = toIdString(user._id);
            const revenueMetrics = revenueMap.get(key) || {};
            return serializeOrganiser(user, {
                eventCount: eventCounts.get(key) || 0,
                showCount: showCounts.get(key) || 0,
                bookingCount: bookingCounts.get(key) || 0,
                revenue: revenueMetrics.revenue || 0
            });
        }),
        summary: { total, active, suspended, verified }
    };
}

async function getOrganiserById(organiserId) {
    assertObjectId(organiserId, "Organiser ID");

    const user = await User.findOne({ _id: organiserId, role: ORGANISER })
        .select("name email phone city state country role emailVerified status organiserProfile createdAt lastLoginAt")
        .lean();

    if (!user) {
        throw new ApiError(404, "Organiser not found.");
    }

    const [eventCount, showCount, bookingCount, revenueRows] = await Promise.all([
        Event.countDocuments({ organiserId: user._id, deleted: false }),
        Show.countDocuments({ organiserId: user._id }),
        Booking.countDocuments({ organiserId: user._id }),
        Booking.aggregate([
            { $match: { organiserId: user._id, status: "CONFIRMED" } },
            { $group: { _id: null, revenue: { $sum: "$grandTotal" } } }
        ])
    ]);

    return serializeOrganiser(user, {
        eventCount,
        showCount,
        bookingCount,
        revenue: Number(revenueRows?.[0]?.revenue || 0)
    });
}

async function updateOrganiserStatus(organiserId, statusValue) {
    assertObjectId(organiserId, "Organiser ID");
    const status = normalizeAccountStatus(statusValue);

    const user = await User.findOneAndUpdate(
        { _id: organiserId, role: ORGANISER },
        { $set: { status } },
        { new: true, runValidators: true }
    )
        .select("name email phone city state country role emailVerified status organiserProfile createdAt lastLoginAt")
        .lean();

    if (!user) {
        throw new ApiError(404, "Organiser not found.");
    }

    const [eventCount, showCount, bookingCount, revenueRows] = await Promise.all([
        Event.countDocuments({ organiserId: user._id, deleted: false }),
        Show.countDocuments({ organiserId: user._id }),
        Booking.countDocuments({ organiserId: user._id }),
        Booking.aggregate([
            { $match: { organiserId: user._id, status: "CONFIRMED" } },
            { $group: { _id: null, revenue: { $sum: "$grandTotal" } } }
        ])
    ]);

    return serializeOrganiser(user, {
        eventCount,
        showCount,
        bookingCount,
        revenue: Number(revenueRows?.[0]?.revenue || 0)
    });
}

async function getBookings(query = {}) {
    const filter = {};

    const status = String(query.status || "").trim().toUpperCase();
    if (["CONFIRMED", "CANCELLED"].includes(status)) {
        filter.status = status;
    }

    if (query.customer) {
        assertObjectId(query.customer, "Customer ID");
        filter.userId = query.customer;
    }

    if (query.organiser) {
        assertObjectId(query.organiser, "Organiser ID");
        filter.organiserId = query.organiser;
    }

    const search = String(query.search || "").trim();
    if (search) {
        const regex = new RegExp(escapeRegExp(search), "i");
        filter.$or = [
            { reference: regex },
            { eventTitle: regex },
            { venueName: regex }
        ];
    }

    let docs = await Booking.find(filter)
        .sort({ createdAt: -1 })
        .populate("userId", "name email")
        .populate("organiserId", "name organiserProfile")
        .populate("paymentId", "status paymentMethod refundStatus")
        .lean();

    const paymentStatus = String(query.paymentStatus || "").trim().toUpperCase();
    if (paymentStatus) {
        docs = docs.filter((booking) => {
            const normalized = paymentStatusForAdmin(booking.paymentId, booking);
            return normalized === paymentStatus ||
                (paymentStatus === "VERIFIED" && normalized === "SUCCESS");
        });
    }

    const [total, confirmed, cancelled, qrIssued] = await Promise.all([
        Booking.countDocuments({}),
        Booking.countDocuments({ status: "CONFIRMED" }),
        Booking.countDocuments({ status: "CANCELLED" }),
        Booking.countDocuments({
            qrPayload: { $exists: true, $nin: [null, ""] }
        })
    ]);

    return {
        bookings: docs.map(serializeBooking),
        summary: { total, confirmed, cancelled, qrIssued }
    };
}

async function getBookingById(bookingId) {
    assertObjectId(bookingId, "Booking ID");

    const booking = await Booking.findById(bookingId)
        .populate("userId", "name email")
        .populate("organiserId", "name organiserProfile")
        .populate("paymentId", "status paymentMethod refundStatus")
        .lean();

    if (!booking) {
        throw new ApiError(404, "Booking not found.");
    }

    return serializeBooking(booking);
}

module.exports = {
    getDashboard,
    getUsers,
    getUserById,
    updateUserStatus,
    getOrganisers,
    getOrganiserById,
    updateOrganiserStatus,
    getBookings,
    getBookingById
};
