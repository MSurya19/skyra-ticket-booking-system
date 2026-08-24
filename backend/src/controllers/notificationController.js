"use strict";

const asyncHandler =
    require("../utils/asyncHandler");

const ApiError =
    require("../utils/ApiError");

const notificationService =
    require("../services/notificationService");

const { HTTP_STATUS } =
    require("../utils/constants");

const STATUS_OK =
    HTTP_STATUS?.OK || 200;

const STATUS_UNAUTHORIZED =
    HTTP_STATUS?.UNAUTHORIZED || 401;

function customerId(
    req
) {
    const value =
        req.user?._id ||
        req.user?.id ||
        req.auth?.userId ||
        req.auth?.id ||
        req.auth?.sub ||
        req.userId ||
        null;

    if (!value) {
        throw new ApiError(
            STATUS_UNAUTHORIZED,
            "Authentication required."
        );
    }

    return String(value);
}

const listNotifications =
    asyncHandler(
        async (
            req,
            res
        ) => {
            const result =
                await notificationService
                    .listCustomerNotifications(
                        customerId(req),
                        req.query || {}
                    );

            return res
                .status(
                    STATUS_OK
                )
                .json({
                    success: true,
                    message:
                        "Notifications retrieved successfully.",
                    data: result
                });
        }
    );

const unreadCount =
    asyncHandler(
        async (
            req,
            res
        ) => {
            const count =
                await notificationService
                    .getUnreadCount(
                        customerId(req)
                    );

            return res
                .status(
                    STATUS_OK
                )
                .json({
                    success: true,
                    message:
                        "Unread notification count retrieved successfully.",
                    data: {
                        unreadCount:
                            count
                    }
                });
        }
    );

const markRead =
    asyncHandler(
        async (
            req,
            res
        ) => {
            const notification =
                await notificationService
                    .markNotificationRead(
                        customerId(req),
                        req.params
                            .notificationId
                    );

            return res
                .status(
                    STATUS_OK
                )
                .json({
                    success: true,
                    message:
                        "Notification marked as read.",
                    data: {
                        notification
                    }
                });
        }
    );

const markAllRead =
    asyncHandler(
        async (
            req,
            res
        ) => {
            const result =
                await notificationService
                    .markAllNotificationsRead(
                        customerId(req)
                    );

            return res
                .status(
                    STATUS_OK
                )
                .json({
                    success: true,
                    message:
                        "All notifications marked as read.",
                    data: result
                });
        }
    );

module.exports = {
    listNotifications,
    unreadCount,
    markRead,
    markAllRead
};
