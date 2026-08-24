"use strict";

const express =
    require("express");

const router =
    express.Router();


const {
    createHold,
    getActiveHold,
    getHold,
    releaseHold
} =
    require("../controllers/holdController");


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
    validateParams,
    validateQuery
} =
    require("../middleware/validationMiddleware");


const {
    validateCreateHold,
    validateHoldParams,
    validateActiveHoldQuery
} =
    require("../validators/holdValidator");


/* =========================================================
   PHASE 11 - CUSTOMER SEAT HOLD ROUTES

   Mounted at:
   /api/holds

   Authentication:
   Customer JWT required.
   ========================================================= */


router.use(
    authMiddleware
);


router.use(
    customerOnly
);


router.post(
    "/",
    validateBody(
        validateCreateHold
    ),
    createHold
);


router.get(
    "/active",
    validateQuery(
        validateActiveHoldQuery
    ),
    getActiveHold
);


router.get(
    "/:holdId",
    validateParams(
        validateHoldParams
    ),
    getHold
);


router.delete(
    "/:holdId",
    validateParams(
        validateHoldParams
    ),
    releaseHold
);


module.exports =
    router;
