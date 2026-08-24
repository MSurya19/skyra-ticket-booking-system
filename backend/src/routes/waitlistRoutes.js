"use strict";

const express =
    require("express");

const router =
    express.Router();

const {
    joinWaitlist,
    listMyWaitlist,
    leaveWaitlist,
    claimWaitlistOffer
} =
    require("../controllers/waitlistController");

const {
    authMiddleware
} =
    require("../middleware/authMiddleware");

const {
    customerOnly
} =
    require("../middleware/roleMiddleware");


/*
   Mounted at /api/waitlist
*/
router.use(
    authMiddleware
);

router.use(
    customerOnly
);


router.get(
    "/my",
    listMyWaitlist
);


router.post(
    "/",
    joinWaitlist
);


router.post(
    "/offers/:offerId/claim",
    claimWaitlistOffer
);


router.delete(
    "/:waitlistId",
    leaveWaitlist
);


module.exports =
    router;
