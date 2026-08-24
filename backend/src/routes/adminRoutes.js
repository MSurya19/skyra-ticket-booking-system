"use strict";

const express = require("express");
const router = express.Router();

const {
    getDashboard,
    getUsers,
    getUser,
    updateUserStatus,
    getOrganisers,
    getOrganiser,
    updateOrganiserStatus,
    getBookings,
    getBooking
} = require("../controllers/adminController");

const { authMiddleware } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

/* Mounted at /api/admin */
router.use(authMiddleware);
router.use(adminOnly);

router.get("/dashboard", getDashboard);

router.get("/users", getUsers);
router.get("/users/:userId", getUser);
router.patch("/users/:userId/status", updateUserStatus);

router.get("/organisers", getOrganisers);
router.get("/organisers/:organiserId", getOrganiser);
router.patch("/organisers/:organiserId/status", updateOrganiserStatus);

router.get("/bookings", getBookings);
router.get("/bookings/:bookingId", getBooking);

module.exports = router;
