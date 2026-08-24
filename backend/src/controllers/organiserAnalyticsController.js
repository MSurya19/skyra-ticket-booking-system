"use strict";

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const organiserAnalyticsService = require("../services/organiserAnalyticsService");

function getOrganiserId(req) {
    const value =
        req.user?._id ||
        req.user?.id ||
        req.auth?.userId ||
        req.auth?.id ||
        req.auth?.sub ||
        req.userId ||
        null;

    if (!value) {
        throw new ApiError(401, "Authentication required.");
    }

    return String(value);
}

function params(req) {
    return req.validated?.params ?? req.validatedParams ?? req.params ?? {};
}

function query(req) {
    return req.validated?.query ?? req.validatedQuery ?? req.query ?? {};
}

const getDashboard = asyncHandler(async (req, res) => {
    const result = await organiserAnalyticsService.getDashboard(
        getOrganiserId(req)
    );

    return res.status(200).json({
        success: true,
        message: "Organiser dashboard retrieved successfully.",
        data: result
    });
});

const getBookings = asyncHandler(async (req, res) => {
    const result = await organiserAnalyticsService.getBookings(
        getOrganiserId(req),
        query(req)
    );

    return res.status(200).json({
        success: true,
        message: "Organiser bookings retrieved successfully.",
        data: result
    });
});

const getBooking = asyncHandler(async (req, res) => {
    const { bookingId } = params(req);
    const booking = await organiserAnalyticsService.getBookingById(
        getOrganiserId(req),
        bookingId
    );

    return res.status(200).json({
        success: true,
        message: "Organiser booking retrieved successfully.",
        data: { booking }
    });
});

const getRevenue = asyncHandler(async (req, res) => {
    const result = await organiserAnalyticsService.getRevenue(
        getOrganiserId(req),
        query(req)
    );

    return res.status(200).json({
        success: true,
        message: "Organiser revenue retrieved successfully.",
        data: result
    });
});

const getRevenueEvents = asyncHandler(async (req, res) => {
    const result = await organiserAnalyticsService.getRevenueEvents(
        getOrganiserId(req),
        query(req)
    );

    return res.status(200).json({
        success: true,
        message: "Organiser event revenue retrieved successfully.",
        data: result
    });
});

const getRevenueTransactions = asyncHandler(async (req, res) => {
    const result = await organiserAnalyticsService.getRevenueTransactions(
        getOrganiserId(req),
        query(req)
    );

    return res.status(200).json({
        success: true,
        message: "Organiser revenue transactions retrieved successfully.",
        data: result
    });
});

module.exports = {
    getDashboard,
    getBookings,
    getBooking,
    getRevenue,
    getRevenueEvents,
    getRevenueTransactions
};
