"use strict";

const express =
    require("express");

const router =
    express.Router();

const {
    listNotifications,
    unreadCount,
    markRead,
    markAllRead
} =
    require("../controllers/notificationController");

const {
    authMiddleware
} =
    require("../middleware/authMiddleware");

const {
    customerOnly
} =
    require("../middleware/roleMiddleware");

/* Mounted at /api/notifications */
router.use(
    authMiddleware
);

router.use(
    customerOnly
);

router.get(
    "/",
    listNotifications
);

router.get(
    "/unread-count",
    unreadCount
);

router.patch(
    "/read-all",
    markAllRead
);

router.patch(
    "/:notificationId/read",
    markRead
);

module.exports =
    router;
