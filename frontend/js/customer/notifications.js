/* =========================================================
   SKYRA - CUSTOMER NOTIFICATIONS
   File:
   frontend/js/customer/notifications.js

   Used by:
   - customer/notifications.html

   Phase 18 integration:
   - Uses real backend notification APIs
   - Filters notifications
   - Search
   - Mark one as read
   - Mark all as read
   - Updates sidebar unread count
   - Updates waitlist count from the backend
   - Routes relevant notification actions

   Backend APIs:
   - GET /api/notifications
   - GET /api/notifications/unread-count
   - PATCH /api/notifications/:id/read
   - PATCH /api/notifications/read-all
   ========================================================= */

"use strict";


/* =========================================================
   2. STATE
   ========================================================= */

const skyraNotificationsState = {

    notifications: [],

    filteredNotifications: [],

    filter:
        "ALL",

    search:
        "",

    loading:
        false

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeNotificationsPage();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

async function initializeNotificationsPage() {

    initializeNotificationsUser();

    initializeNotificationTabs();

    initializeNotificationSearch();

    initializeTopbarNotificationSearch();

    initializeNotificationHeaderActions();

    keepNotificationsNavigationActive();


    await loadNotifications();

    await refreshNotificationWaitlistIndicator();


    refreshNotificationIcons();

}


/* =========================================================
   5. LOAD NOTIFICATIONS
   ========================================================= */

async function loadNotifications() {

    skyraNotificationsState.loading =
        true;


    try {

        let notifications =
            await fetchNotificationSource();


        notifications =
            notifications
                .map(
                    (
                        notification,
                        index
                    ) =>
                        normalizeNotification(
                            notification,
                            index
                        )
                )
                .filter(
                    (notification) =>
                        Boolean(
                            notification.id
                        )
                );



        notifications =
            sortNotifications(
                notifications
            );


        skyraNotificationsState.notifications =
            notifications;


        renderNotificationSummary();

        applyNotificationFilters();

        updateNotificationAccountIndicators();

    } catch (error) {

        console.error(
            "Unable to load notifications:",
            error
        );


        skyraNotificationsState.notifications =
            [];


        renderNotificationSummary();

        applyNotificationFilters();

        updateNotificationAccountIndicators();

    } finally {

        skyraNotificationsState.loading =
            false;

    }

}


/* =========================================================
   6. DATA SOURCE
   ========================================================= */

async function fetchNotificationSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getNotifications !==
            "function"
    ) {

        throw new Error(
            "Notification API is unavailable."
        );

    }


    const response =
        await window.SKYRA_API
            .getNotifications();


    const notifications =
        response?.data?.notifications ||
        response?.notifications ||
        [];


    if (!Array.isArray(notifications)) {

        throw new Error(
            "Invalid notification response received from the server."
        );

    }


    return notifications;

}


/* =========================================================
   7. NORMALIZE NOTIFICATION
   ========================================================= */

function normalizeNotification(
    raw,
    index
) {

    const id =
        String(
            raw.id ||
            raw._id ||
            raw.notificationId ||
            `notification_${index + 1}`
        );


    const type =
        normalizeNotificationType(
            raw.type ||
            raw.category ||
            raw.notificationType
        );


    const read =
        Boolean(
            raw.read ??
            raw.isRead ??
            false
        );


    return {

        ...raw,

        id,

        type,

        title:
            String(
                raw.title ||
                getFallbackNotificationTitle(
                    type
                )
            ),

        message:
            String(
                raw.message ||
                raw.description ||
                raw.body ||
                "You have a new SKYRA notification."
            ),

        read,

        createdAt:
            raw.createdAt ||
            raw.date ||
            raw.timestamp ||
            new Date()
                .toISOString(),

        bookingId:
            raw.bookingId ||
            raw.booking?.id ||
            raw.booking?._id ||
            null,

        eventId:
            raw.eventId ||
            raw.event?.id ||
            raw.event?._id ||
            null,

        showId:
            raw.showId ||
            raw.show?.id ||
            raw.show?._id ||
            null,

        waitlistId:
            raw.waitlistId ||
            raw.waitlist?.id ||
            raw.waitlist?._id ||
            null,

        offerId:
            raw.offerId ||
            raw.waitlistOfferId ||
            raw.offer?.id ||
            raw.offer?._id ||
            null,

        actionUrl:
            raw.actionUrl ||
            raw.url ||
            null,

        actionLabel:
            raw.actionLabel ||
            null

    };

}


/* =========================================================
   8. NORMALIZE TYPE
   ========================================================= */

function normalizeNotificationType(
    value
) {

    const type =
        String(
            value ||
            "GENERAL"
        )
            .trim()
            .toUpperCase();


    if (
        type.includes(
            "WAITLIST"
        ) ||
        type.includes(
            "OFFER"
        )
    ) {

        return "WAITLIST";

    }


    if (
        type.includes(
            "BOOK"
        ) ||
        type.includes(
            "PAYMENT"
        ) ||
        type.includes(
            "REFUND"
        ) ||
        type.includes(
            "TICKET"
        ) ||
        type.includes(
            "CANCEL"
        )
    ) {

        return "BOOKING";

    }


    if (
        type.includes(
            "EVENT"
        ) ||
        type.includes(
            "REMINDER"
        ) ||
        type.includes(
            "SHOW"
        )
    ) {

        return "EVENT";

    }


    if (
        type.includes(
            "SYSTEM"
        )
    ) {

        return "SYSTEM";

    }


    return "GENERAL";

}


/* =========================================================
   9. FALLBACK TITLE
   ========================================================= */

function getFallbackNotificationTitle(
    type
) {

    switch (type) {

        case "WAITLIST":

            return "Waitlist Update";


        case "BOOKING":

            return "Booking Update";


        case "EVENT":

            return "Event Update";


        case "SYSTEM":

            return "SKYRA Update";


        default:

            return "Notification";

    }

}


/* =========================================================
   10. SORT
   ========================================================= */

function sortNotifications(
    notifications
) {

    return [
        ...notifications
    ].sort(
        (
            first,
            second
        ) => {

            const firstTime =
                new Date(
                    first.createdAt
                ).getTime();


            const secondTime =
                new Date(
                    second.createdAt
                ).getTime();


            return (
                (
                    Number.isFinite(
                        secondTime
                    )
                        ? secondTime
                        : 0
                ) -
                (
                    Number.isFinite(
                        firstTime
                    )
                        ? firstTime
                        : 0
                )
            );

        }
    );

}


/* =========================================================
   14. FILTER TABS
   ========================================================= */

function initializeNotificationTabs() {

    document
        .querySelectorAll(
            "[data-notification-filter]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        skyraNotificationsState.filter =
                            button.dataset
                                .notificationFilter ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-notification-filter]"
                            )
                            .forEach(
                                (item) => {

                                    const active =
                                        item ===
                                        button;


                                    item.classList
                                        .toggle(
                                            "active",
                                            active
                                        );


                                    item.setAttribute(
                                        "aria-selected",
                                        String(
                                            active
                                        )
                                    );

                                }
                            );


                        applyNotificationFilters();

                    }
                );

            }
        );

}


/* =========================================================
   15. SEARCH
   ========================================================= */

function initializeNotificationSearch() {

    document
        .getElementById(
            "notificationSearchInput"
        )
        ?.addEventListener(
            "input",
            (event) => {

                skyraNotificationsState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyNotificationFilters();

            }
        );

}


/* =========================================================
   16. APPLY FILTERS
   ========================================================= */

function applyNotificationFilters() {

    const {
        filter,
        search
    } =
        skyraNotificationsState;


    const filtered =
        skyraNotificationsState
            .notifications
            .filter(
                (notification) => {

                    if (
                        filter ===
                            "UNREAD" &&
                        notification.read
                    ) {

                        return false;

                    }


                    if (
                        [
                            "BOOKING",
                            "WAITLIST",
                            "EVENT"
                        ].includes(
                            filter
                        ) &&
                        notification.type !==
                            filter
                    ) {

                        return false;

                    }


                    if (!search) {

                        return true;

                    }


                    const searchable =
                        [
                            notification.title,
                            notification.message,
                            notification.type
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        search
                    );

                }
            );


    skyraNotificationsState.filteredNotifications =
        filtered;


    renderNotificationFeed();

}


/* =========================================================
   17. SUMMARY
   ========================================================= */

function renderNotificationSummary() {

    const notifications =
        skyraNotificationsState
            .notifications;


    const unread =
        notifications.filter(
            (notification) =>
                !notification.read
        ).length;


    const booking =
        notifications.filter(
            (notification) =>
                notification.type ===
                "BOOKING"
        ).length;


    const waitlist =
        notifications.filter(
            (notification) =>
                notification.type ===
                "WAITLIST"
        ).length;


    setNotificationText(
        "totalNotificationsCount",
        notifications.length
    );


    setNotificationText(
        "unreadNotificationsCount",
        unread
    );


    setNotificationText(
        "bookingNotificationsCount",
        booking
    );


    setNotificationText(
        "waitlistNotificationsCount",
        waitlist
    );


    const markAllButton =
        document.getElementById(
            "markAllNotificationsReadButton"
        );


    if (markAllButton) {

        markAllButton.disabled =
            unread === 0;

    }

}


/* =========================================================
   18. RENDER FEED
   ========================================================= */

function renderNotificationFeed() {

    const feed =
        document.getElementById(
            "notificationsFeed"
        );


    const empty =
        document.getElementById(
            "notificationsEmptyState"
        );


    if (
        !feed ||
        !empty
    ) {

        return;

    }


    const notifications =
        skyraNotificationsState
            .filteredNotifications;


    if (!notifications.length) {

        feed.hidden =
            true;


        empty.hidden =
            false;


        refreshNotificationIcons();

        return;

    }


    empty.hidden =
        true;


    feed.hidden =
        false;


    feed.innerHTML =
        notifications
            .map(
                createNotificationCardHTML
            )
            .join("");


    initializeRenderedNotificationActions();

    refreshNotificationIcons();

}


/* =========================================================
   19. CARD HTML
   ========================================================= */

function createNotificationCardHTML(
    notification
) {

    const visual =
        getNotificationVisual(
            notification
        );


    const action =
        getNotificationAction(
            notification
        );


    return `

        <article
            class="
                notification-card
                ${
                    notification.read
                        ? "read"
                        : "unread"
                }
            "
            data-notification-id="${escapeNotificationAttribute(
                notification.id
            )}"
        >

            ${
                notification.read
                    ? ""
                    : `
                        <div
                            class="notification-status-dot"
                            aria-hidden="true"
                        ></div>
                    `
            }


            <div
                class="
                    notification-icon
                    ${visual.className}
                "
            >

                <i
                    data-lucide="${visual.icon}"
                ></i>

            </div>


            <div class="notification-content">


                <div class="notification-heading">

                    <div>

                        <span
                            class="notification-category"
                        >
                            ${escapeNotificationHTML(
                                visual.label
                            )}
                        </span>


                        <h2>
                            ${escapeNotificationHTML(
                                notification.title
                            )}
                        </h2>

                    </div>


                    <time
                        datetime="${escapeNotificationAttribute(
                            notification.createdAt
                        )}"
                    >
                        ${escapeNotificationHTML(
                            formatNotificationRelativeTime(
                                notification.createdAt
                            )
                        )}
                    </time>

                </div>


                <p>
                    ${escapeNotificationHTML(
                        notification.message
                    )}
                </p>


                <div class="notification-actions">

                    ${
                        action
                            ? `

                                <a
                                    href="${escapeNotificationAttribute(
                                        action.url
                                    )}"
                                    class="
                                        btn
                                        ${
                                            action.primary
                                                ? "btn-primary"
                                                : "btn-outline"
                                        }
                                    "
                                    data-notification-action="${escapeNotificationAttribute(
                                        notification.id
                                    )}"
                                >

                                    <i
                                        data-lucide="${action.icon}"
                                    ></i>

                                    ${escapeNotificationHTML(
                                        action.label
                                    )}

                                </a>

                            `
                            : ""
                    }


                    ${
                        !notification.read
                            ? `

                                <button
                                    type="button"
                                    class="
                                        notification-mark-read-button
                                    "
                                    data-mark-notification-read="${escapeNotificationAttribute(
                                        notification.id
                                    )}"
                                >

                                    <i data-lucide="check"></i>

                                    Mark as Read

                                </button>

                            `
                            : `

                                <span
                                    class="notification-read-label"
                                >

                                    <i
                                        data-lucide="check-check"
                                    ></i>

                                    Read

                                </span>

                            `
                    }

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   20. VISUAL
   ========================================================= */

function getNotificationVisual(
    notification
) {

    const title =
        String(
            notification.title ||
            ""
        ).toLowerCase();


    const message =
        String(
            notification.message ||
            ""
        ).toLowerCase();


    const content =
        `${title} ${message}`;


    if (
        content.includes(
            "cancel"
        )
    ) {

        return {

            className:
                "cancelled",

            icon:
                "ticket-x",

            label:
                "Booking"

        };

    }


    if (
        content.includes(
            "refund"
        )
    ) {

        return {

            className:
                "refund",

            icon:
                "rotate-ccw",

            label:
                "Payment"

        };

    }


    if (
        notification.type ===
        "WAITLIST"
    ) {

        return {

            className:
                "waitlist",

            icon:
                content.includes(
                    "offer"
                )
                    ? "ticket-check"
                    : "clock-3",

            label:
                "Waitlist"

        };

    }


    if (
        notification.type ===
        "BOOKING"
    ) {

        return {

            className:
                "booking",

            icon:
                "ticket-check",

            label:
                "Booking"

        };

    }


    if (
        notification.type ===
        "EVENT"
    ) {

        return {

            className:
                "event",

            icon:
                "calendar-clock",

            label:
                "Event"

        };

    }


    return {

        className:
            "general",

        icon:
            "bell",

        label:
            "SKYRA"

    };

}


/* =========================================================
   21. ACTION
   ========================================================= */

function getNotificationAction(
    notification
) {

    if (
        notification.actionUrl
    ) {

        return {

            url:
                notification.actionUrl,

            label:
                notification.actionLabel ||
                "View",

            icon:
                "arrow-up-right",

            primary:
                false

        };

    }


    if (
        notification.type ===
        "WAITLIST"
    ) {

        return {

            url:
                notification.offerId
                    ? `./waitlist.html?offer=${
                        encodeURIComponent(
                            notification.offerId
                        )
                    }`
                    : "./waitlist.html",

            label:
                notification.offerId
                    ? "View Offer"
                    : "View Waitlist",

            icon:
                notification.offerId
                    ? "ticket-check"
                    : "clock-3",

            primary:
                Boolean(
                    notification.offerId
                )

        };

    }


    if (
        notification.type ===
        "BOOKING" &&
        notification.bookingId
    ) {

        return {

            url:
                `./ticket.html?booking=${
                    encodeURIComponent(
                        notification.bookingId
                    )
                }`,

            label:
                "View Ticket",

            icon:
                "qr-code",

            primary:
                true

        };

    }


    if (
        notification.type ===
            "EVENT" &&
        notification.eventId
    ) {

        return {

            url:
                `./event-details.html?id=${
                    encodeURIComponent(
                        notification.eventId
                    )
                }`,

            label:
                "View Event",

            icon:
                "calendar-days",

            primary:
                false

        };

    }


    if (
        notification.type ===
        "BOOKING"
    ) {

        return {

            url:
                "./my-bookings.html",

            label:
                "My Bookings",

            icon:
                "tickets",

            primary:
                false

        };

    }


    return null;

}


/* =========================================================
   22. RENDERED ACTIONS
   ========================================================= */

function initializeRenderedNotificationActions() {

    document
        .querySelectorAll(
            "[data-mark-notification-read]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        markNotificationAsRead(
                            button.dataset
                                .markNotificationRead
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            "[data-notification-action]"
        )
        .forEach(
            (link) => {

                link.addEventListener(
                    "click",
                    () => {

                        const id =
                            link.dataset
                                .notificationAction;


                        const notification =
                            getNotificationById(
                                id
                            );


                        if (
                            notification &&
                            !notification.read
                        ) {

                            markNotificationAsRead(
                                id,
                                {
                                    rerender:
                                        false
                                }
                            );

                        }

                    }
                );

            }
        );

}


/* =========================================================
   23. GET NOTIFICATION
   ========================================================= */

function getNotificationById(
    id
) {

    return skyraNotificationsState
        .notifications
        .find(
            (notification) =>
                notification.id ===
                id
        ) ||
        null;

}


/* =========================================================
   24. MARK ONE READ
   ========================================================= */

async function markNotificationAsRead(
    notificationId,
    options = {}
) {

    const notification =
        getNotificationById(
            notificationId
        );


    if (
        !notification ||
        notification.read
    ) {

        return;

    }


    try {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .markNotificationRead !==
                "function"
        ) {

            throw new Error(
                "Notification API is unavailable."
            );

        }


        const response =
            await window.SKYRA_API
                .markNotificationRead(
                    notificationId
                );


        const updated =
            response?.data?.notification ||
            response?.notification ||
            null;


        notification.read =
            Boolean(
                updated?.read ??
                updated?.isRead ??
                true
            );

        notification.readAt =
            updated?.readAt ||
            notification.readAt ||
            new Date().toISOString();


        renderNotificationSummary();

        updateNotificationAccountIndicators();


        if (
            options.rerender !==
            false
        ) {

            applyNotificationFilters();

        }

    } catch (error) {

        showNotificationToast(
            error?.message ||
            "Unable to mark this notification as read.",
            "error",
            "Update Failed"
        );

    }

}


/* =========================================================
   25. MARK ALL READ
   ========================================================= */

function initializeNotificationHeaderActions() {

    document
        .getElementById(
            "markAllNotificationsReadButton"
        )
        ?.addEventListener(
            "click",
            markAllNotificationsAsRead
        );

}


/* =========================================================
   26. MARK ALL
   ========================================================= */

async function markAllNotificationsAsRead() {

    const unread =
        skyraNotificationsState
            .notifications
            .filter(
                (notification) =>
                    !notification.read
            );


    if (!unread.length) {

        return;

    }


    const button =
        document.getElementById(
            "markAllNotificationsReadButton"
        );


    if (button) {

        button.disabled =
            true;

    }


    try {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .markAllNotificationsRead !==
                "function"
        ) {

            throw new Error(
                "Notification API is unavailable."
            );

        }


        await window.SKYRA_API
            .markAllNotificationsRead();


        skyraNotificationsState
            .notifications
            .forEach(
                (notification) => {

                    notification.read =
                        true;

                    notification.readAt =
                        notification.readAt ||
                        new Date().toISOString();

                }
            );


        renderNotificationSummary();

        applyNotificationFilters();

        updateNotificationAccountIndicators();


        showNotificationToast(
            "All notifications marked as read.",
            "success",
            "Notifications Updated"
        );

    } catch (error) {

        showNotificationToast(
            error?.message ||
            "Unable to update notifications.",
            "error",
            "Update Failed"
        );

    } finally {

        if (button) {

            button.disabled =
                skyraNotificationsState
                    .notifications
                    .every(
                        (notification) =>
                            notification.read
                    );

        }

    }

}


/* =========================================================
   27. SUMMARY / SIDEBAR INDICATORS
   ========================================================= */

function updateNotificationAccountIndicators() {

    const unread =
        skyraNotificationsState
            .notifications
            .filter(
                (notification) =>
                    !notification.read
            ).length;


    const notificationBadge =
        document.getElementById(
            "sidebarNotificationCount"
        );


    if (notificationBadge) {

        notificationBadge.textContent =
            unread;

        notificationBadge.hidden =
            unread === 0;

    }


    const dot =
        document.getElementById(
            "topbarNotificationDot"
        );


    if (dot) {

        dot.hidden =
            unread === 0;

    }

}


async function refreshNotificationWaitlistIndicator() {

    const badge =
        document.getElementById(
            "sidebarWaitlistCount"
        );


    if (!badge) {
        return;
    }


    let activeWaitlist = 0;


    try {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .getMyWaitlist !==
                "function"
        ) {

            throw new Error(
                "Waitlist API is unavailable."
            );

        }


        const response =
            await window.SKYRA_API
                .getMyWaitlist();


        const entries =
            response?.data?.waitlist ||
            response?.data?.entries ||
            response?.waitlist ||
            response?.entries ||
            [];


        if (Array.isArray(entries)) {

            activeWaitlist =
                entries.filter(
                    (entry) =>
                        [
                            "WAITING",
                            "OFFERED",
                            "ACTIVE"
                        ].includes(
                            String(
                                entry?.status ||
                                ""
                            ).toUpperCase()
                        )
                ).length;

        }

    } catch (error) {

        console.warn(
            "Unable to load waitlist count.",
            error
        );

    }


    badge.textContent =
        activeWaitlist;

    badge.hidden =
        activeWaitlist === 0;

}


/* =========================================================
   28. USER
   ========================================================= */

function initializeNotificationsUser() {

    const user =
        window.SKYRA_COMMON
            ?.getUser?.();


    if (!user) {

        return;

    }


    const name =
        String(
            user.name ||
            user.fullName ||
            "Customer"
        );


    const initials =
        window.SKYRA_COMMON
            ?.createInitials?.(
                name
            ) ||
        createNotificationInitials(
            name
        );


    setNotificationText(
        "sidebarUserName",
        name
    );


    setNotificationText(
        "sidebarUserInitials",
        initials
    );


    setNotificationText(
        "topbarUserName",
        name
    );


    setNotificationText(
        "topbarUserInitials",
        initials
    );


    setNotificationText(
        "dropdownUserName",
        name
    );


    setNotificationText(
        "dropdownUserInitials",
        initials
    );


    if (user.email) {

        setNotificationText(
            "dropdownUserEmail",
            user.email
        );

    }

}


/* =========================================================
   29. INITIALS
   ========================================================= */

function createNotificationInitials(
    name
) {

    const parts =
        String(
            name ||
            ""
        )
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {

        return "SK";

    }


    if (
        parts.length ===
        1
    ) {

        return parts[0]
            .slice(
                0,
                2
            )
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[
            parts.length - 1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   30. TOPBAR SEARCH
   ========================================================= */

function initializeTopbarNotificationSearch() {

    document
        .getElementById(
            "dashboardSearch"
        )
        ?.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key !==
                    "Enter"
                ) {

                    return;

                }


                event.preventDefault();


                const value =
                    event.target.value
                        .trim();


                if (!value) {

                    return;

                }


                window.location.href =
                    `./events.html?search=${
                        encodeURIComponent(
                            value
                        )
                    }`;

            }
        );

}


/* =========================================================
   31. ACTIVE NAVIGATION
   ========================================================= */

function keepNotificationsNavigationActive() {

    document
        .querySelectorAll(
            ".sidebar-nav .sidebar-link"
        )
        .forEach(
            (link) => {

                const active =
                    link.getAttribute(
                        "href"
                    ) ===
                    "./notifications.html";


                link.classList.toggle(
                    "active",
                    active
                );


                if (active) {

                    link.setAttribute(
                        "aria-current",
                        "page"
                    );

                } else {

                    link.removeAttribute(
                        "aria-current"
                    );

                }

            }
        );

}


/* =========================================================
   32. RELATIVE TIME
   ========================================================= */

function formatNotificationRelativeTime(
    value
) {

    const date =
        new Date(
            value
        );


    const timestamp =
        date.getTime();


    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        return "";

    }


    const difference =
        Date.now() -
        timestamp;


    if (
        difference <
        60 *
        1000
    ) {

        return "Just now";

    }


    const minutes =
        Math.floor(
            difference /
            (
                60 *
                1000
            )
        );


    if (
        minutes <
        60
    ) {

        return `${minutes}m ago`;

    }


    const hours =
        Math.floor(
            minutes /
            60
        );


    if (
        hours <
        24
    ) {

        return `${hours}h ago`;

    }


    const days =
        Math.floor(
            hours /
            24
        );


    if (
        days <
        7
    ) {

        return `${days}d ago`;

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"
        }
    ).format(
        date
    );

}


/* =========================================================
   33. TEXT
   ========================================================= */

function setNotificationText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   34. ESCAPE HTML
   ========================================================= */

function escapeNotificationHTML(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   35. ATTRIBUTE ESCAPE
   ========================================================= */

function escapeNotificationAttribute(
    value
) {

    return escapeNotificationHTML(
        value
    );

}


/* =========================================================
   36. TOAST
   ========================================================= */

function showNotificationToast(
    message,
    type = "info",
    title = null
) {

    if (
        window.SKYRA_COMMON
            ?.showToast
    ) {

        window.SKYRA_COMMON
            .showToast(
                message,
                type,
                title
            );


        return;

    }


    console.log(
        `[SKYRA ${type}]`,
        message
    );

}


/* =========================================================
   37. ICONS
   ========================================================= */

function refreshNotificationIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   38. PUBLIC API
   ========================================================= */

window.SKYRA_NOTIFICATIONS_PAGE = {

    getNotifications:
        () =>
            skyraNotificationsState
                .notifications
                .map(
                    (notification) => ({
                        ...notification
                    })
                ),

    refresh:
        loadNotifications,

    markRead:
        markNotificationAsRead,

    markAllRead:
        markAllNotificationsAsRead

};


/* =========================================================
   END OF SKYRA CUSTOMER NOTIFICATIONS
   ========================================================= */