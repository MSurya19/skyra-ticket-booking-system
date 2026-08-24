"use strict";

const express = require("express");
const router = express.Router();

const {
    getDashboard,
    getBookings,
    getBooking,
    getRevenue,
    getRevenueEvents,
    getRevenueTransactions
} = require("../controllers/organiserAnalyticsController");

const { authMiddleware } = require("../middleware/authMiddleware");
const { organiserOnly } = require("../middleware/roleMiddleware");

/* Mounted at /api/organiser */
router.use(authMiddleware);
router.use(organiserOnly);

router.get("/dashboard", getDashboard);

router.get("/bookings", getBookings);
router.get("/bookings/:bookingId", getBooking);

router.get("/revenue", getRevenue);
router.get("/revenue/events", getRevenueEvents);
router.get("/revenue/transactions", getRevenueTransactions);

module.exports = router;
