"use strict";

const express = require("express");
const router = express.Router();

const {
    createBooking,
    cancelBooking,
    getBooking,
    getBookingByReference,
    listBookings,
    getTicket,
    emailTicket
} = require("../controllers/bookingController");

const { authMiddleware } = require("../middleware/authMiddleware");
const { customerOnly } = require("../middleware/roleMiddleware");
const {
    validateBody,
    validateParams
} = require("../middleware/validationMiddleware");

const {
    validateCreateBooking,
    validateBookingParams,
    validateBookingReferenceParams
} = require("../validators/bookingValidator");

/* Mounted at /api/bookings */
router.use(authMiddleware);
router.use(customerOnly);

router.post(
    "/",
    validateBody(validateCreateBooking),
    createBooking
);

router.get(
    "/",
    listBookings
);

router.get(
    "/reference/:reference",
    validateParams(validateBookingReferenceParams),
    getBookingByReference
);

router.post(
    "/:bookingId/cancel",
    validateParams(validateBookingParams),
    cancelBooking
);

router.get(
    "/:bookingId/ticket",
    validateParams(validateBookingParams),
    getTicket
);

router.post(
    "/:bookingId/email-ticket",
    validateParams(validateBookingParams),
    emailTicket
);

router.get(
    "/:bookingId",
    validateParams(validateBookingParams),
    getBooking
);

module.exports = router;
