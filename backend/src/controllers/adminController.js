"use strict";

const asyncHandler = require("../utils/asyncHandler");
const adminService = require("../services/adminService");

function query(req) {
    return req.validated?.query ?? req.validatedQuery ?? req.query ?? {};
}

function params(req) {
    return req.validated?.params ?? req.validatedParams ?? req.params ?? {};
}

function body(req) {
    return req.validated?.body ?? req.validatedBody ?? req.body ?? {};
}

const getDashboard = asyncHandler(async (req, res) => {
    const dashboard = await adminService.getDashboard();

    return res.status(200).json({
        success: true,
        message: "Admin dashboard retrieved successfully.",
        data: { dashboard }
    });
});

const getUsers = asyncHandler(async (req, res) => {
    const result = await adminService.getUsers(query(req));

    return res.status(200).json({
        success: true,
        message: "Customers retrieved successfully.",
        data: result
    });
});

const getUser = asyncHandler(async (req, res) => {
    const { userId } = params(req);
    const user = await adminService.getUserById(userId);

    return res.status(200).json({
        success: true,
        message: "Customer retrieved successfully.",
        data: { user }
    });
});

const updateUserStatus = asyncHandler(async (req, res) => {
    const { userId } = params(req);
    const user = await adminService.updateUserStatus(userId, body(req).status);

    return res.status(200).json({
        success: true,
        message: `Customer account ${user.status === "ACTIVE" ? "reactivated" : "suspended"} successfully.`,
        data: { user }
    });
});

const getOrganisers = asyncHandler(async (req, res) => {
    const result = await adminService.getOrganisers(query(req));

    return res.status(200).json({
        success: true,
        message: "Organisers retrieved successfully.",
        data: result
    });
});

const getOrganiser = asyncHandler(async (req, res) => {
    const { organiserId } = params(req);
    const organiser = await adminService.getOrganiserById(organiserId);

    return res.status(200).json({
        success: true,
        message: "Organiser retrieved successfully.",
        data: { organiser }
    });
});

const updateOrganiserStatus = asyncHandler(async (req, res) => {
    const { organiserId } = params(req);
    const organiser = await adminService.updateOrganiserStatus(
        organiserId,
        body(req).status
    );

    return res.status(200).json({
        success: true,
        message: `Organiser account ${organiser.status === "ACTIVE" ? "reactivated" : "suspended"} successfully.`,
        data: { organiser }
    });
});

const getBookings = asyncHandler(async (req, res) => {
    const result = await adminService.getBookings(query(req));

    return res.status(200).json({
        success: true,
        message: "Platform bookings retrieved successfully.",
        data: result
    });
});

const getBooking = asyncHandler(async (req, res) => {
    const { bookingId } = params(req);
    const booking = await adminService.getBookingById(bookingId);

    return res.status(200).json({
        success: true,
        message: "Booking retrieved successfully.",
        data: { booking }
    });
});

module.exports = {
    getDashboard,
    getUsers,
    getUser,
    updateUserStatus,
    getOrganisers,
    getOrganiser,
    updateOrganiserStatus,
    getBookings,
    getBooking
};
