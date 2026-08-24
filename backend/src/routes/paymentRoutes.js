"use strict";

const express =
    require("express");

const router =
    express.Router();

const {
    createOrder,
    verify,
    getPayment,
    getPaymentByHold
} =
    require("../controllers/paymentController");

const {
    authMiddleware
} =
    require("../middleware/authMiddleware");

const {
    customerOnly
} =
    require("../middleware/roleMiddleware");

const {
    validateBody,
    validateParams
} =
    require("../middleware/validationMiddleware");

const {
    validateCreatePaymentOrder,
    validateVerifyPayment,
    validatePaymentParams,
    validatePaymentHoldParams
} =
    require("../validators/paymentValidator");

/* =========================================================
   PHASE 13 - CUSTOMER RAZORPAY PAYMENT ROUTES

   Mounted at:
   /api/payments
   ========================================================= */

router.use(
    authMiddleware
);

router.use(
    customerOnly
);

router.post(
    "/order",
    validateBody(
        validateCreatePaymentOrder
    ),
    createOrder
);

router.post(
    "/verify",
    validateBody(
        validateVerifyPayment
    ),
    verify
);

router.get(
    "/hold/:holdId",
    validateParams(
        validatePaymentHoldParams
    ),
    getPaymentByHold
);

router.get(
    "/:paymentId",
    validateParams(
        validatePaymentParams
    ),
    getPayment
);

module.exports =
    router;
