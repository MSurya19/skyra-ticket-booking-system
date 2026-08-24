/* =========================================================
   SKYRA - ADMIN DASHBOARD
   File:
   frontend/js/admin/dashboard.js

   Current frontend phase:
   - Real administration dashboard
   - Venue infrastructure overview
   - User / organiser counts
   - Booking record summary
   - Recent booking records
   - Recent organiser accounts
   - Search routing
   - MongoDB-backed API integration

   Future backend:
   GET /api/admin/dashboard
   ========================================================= */

"use strict";


/* =========================================================
   6. STATE
   ========================================================= */

const adminDashboardState = {

    admin:
        null,

    summary:
        null,

    venues:
        [],

    recentBookings:
        [],

    recentOrganisers:
        [],

    loading:
        false

};


/* =========================================================
   7. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeAdminDashboard();

    }
);


/* =========================================================
   8. INITIALIZE
   ========================================================= */

async function initializeAdminDashboard() {

    initializeAdminUser();

    initializeAdminNavigation();

    initializeAdminDashboardSearch();


    await loadAdminDashboard();


    renderAdminDashboard();

    refreshAdminDashboardIcons();

}


/* =========================================================
   9. LOAD DASHBOARD
   ========================================================= */

async function loadAdminDashboard() {

    adminDashboardState.loading =
        true;


    try {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .getAdminDashboard !==
                "function"
        ) {

            throw new Error(
                "Admin dashboard API client is unavailable."
            );

        }


        const response =
            await window.SKYRA_API
                .getAdminDashboard();


        const data =
            response?.data?.dashboard ||
            response?.dashboard ||
            response?.data ||
            response;


        if (
            !data ||
            typeof data !==
                "object"
        ) {

            throw new Error(
                "Admin dashboard API returned an invalid response."
            );

        }


        adminDashboardState.summary =
            normalizeAdminSummary(
                data.summary ||
                {}
            );


        adminDashboardState.venues =
            Array.isArray(
                data.venues
            )
                ? data.venues.map(
                    normalizeAdminVenue
                )
                : [];


        adminDashboardState.recentBookings =
            Array.isArray(
                data.recentBookings
            )
                ? data.recentBookings.map(
                    normalizeAdminBooking
                )
                : [];


        adminDashboardState.recentOrganisers =
            Array.isArray(
                data.recentOrganisers
            )
                ? data.recentOrganisers.map(
                    normalizeAdminOrganiser
                )
                : [];

    } catch (error) {

        console.error(
            "Unable to load admin dashboard:",
            error
        );


        adminDashboardState.summary =
            normalizeAdminSummary(
                {}
            );

        adminDashboardState.venues =
            [];

        adminDashboardState.recentBookings =
            [];

        adminDashboardState.recentOrganisers =
            [];


        showAdminDashboardToast(
            error?.message ||
            "Unable to load the real admin dashboard.",
            "error",
            "Admin Dashboard"
        );

    } finally {

        adminDashboardState.loading =
            false;

    }

}

/* =========================================================
   10. ADMIN USER
   ========================================================= */

function initializeAdminUser() {

    const sharedUser =
        window.SKYRA_COMMON
            ?.getUser?.();

    const admin =
        sharedUser &&
        String(sharedUser.role || "").toUpperCase() === "ADMIN"
            ? sharedUser
            : {
                name: "Admin",
                email: "",
                role: "ADMIN"
            };

    adminDashboardState.admin = admin;

    const name = String(admin.name || admin.fullName || "Admin");
    const initials = createAdminInitials(name);

    setAdminText("sidebarUserName", name);
    setAdminText("sidebarUserInitials", initials);
    setAdminText("topbarUserName", name);
    setAdminText("topbarUserInitials", initials);
    setAdminText("dropdownUserName", name);
    setAdminText("dropdownUserInitials", initials);
    setAdminText("dropdownUserEmail", admin.email || "");

}


/* =========================================================
   11. ACTIVE NAVIGATION
   ========================================================= */

function initializeAdminNavigation() {

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
                    "./dashboard.html";


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
   12. DASHBOARD SEARCH
   ========================================================= */

function initializeAdminDashboardSearch() {

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


                const query =
                    event.target.value
                        .trim();


                if (!query) {

                    return;

                }


                routeAdminSearch(
                    query
                );

            }
        );

}


/* =========================================================
   13. SEARCH ROUTING
   ========================================================= */

function routeAdminSearch(
    query
) {

    const normalized =
        query.toLowerCase();


    if (
        normalized.includes(
            "venue"
        ) ||
        normalized.includes(
            "stadium"
        ) ||
        normalized.includes(
            "hall"
        )
    ) {

        window.location.href =
            `./venues.html?search=${
                encodeURIComponent(
                    query
                )
            }`;


        return;

    }


    if (
        normalized.includes(
            "organiser"
        ) ||
        normalized.includes(
            "organizer"
        )
    ) {

        window.location.href =
            `./organisers.html?search=${
                encodeURIComponent(
                    query
                )
            }`;


        return;

    }


    if (
        normalized.includes(
            "booking"
        ) ||
        normalized.startsWith(
            "sky-"
        )
    ) {

        window.location.href =
            `./bookings.html?search=${
                encodeURIComponent(
                    query
                )
            }`;


        return;

    }


    window.location.href =
        `./users.html?search=${
            encodeURIComponent(
                query
            )
        }`;

}


/* =========================================================
   14. RENDER DASHBOARD
   ========================================================= */

function renderAdminDashboard() {

    renderAdminSummary();

    renderAdminVenueTable();

    renderAdminRecentBookings();

    renderAdminRecentOrganisers();

    renderAdminSidebarCounts();

}


/* =========================================================
   15. SUMMARY
   ========================================================= */

function renderAdminSummary() {

    const summary =
        adminDashboardState.summary ||
        normalizeAdminSummary(
            {}
        );


    setAdminText(
        "adminTotalVenues",
        formatAdminNumber(
            summary.totalVenues
        )
    );


    setAdminText(
        "adminActiveVenues",
        formatAdminNumber(
            summary.activeVenues
        )
    );


    setAdminText(
        "adminTotalSeats",
        formatAdminNumber(
            summary.totalSeats
        )
    );


    setAdminText(
        "adminTotalUsers",
        formatAdminNumber(
            summary.totalUsers
        )
    );


    setAdminText(
        "adminTotalCustomers",
        formatAdminNumber(
            summary.totalCustomers
        )
    );


    setAdminText(
        "adminTotalOrganisers",
        formatAdminNumber(
            summary.totalOrganisers
        )
    );


    setAdminText(
        "adminTotalEvents",
        formatAdminNumber(
            summary.totalEvents
        )
    );


    setAdminText(
        "adminTotalShows",
        formatAdminNumber(
            summary.totalShows
        )
    );


    setAdminText(
        "adminRevenue",
        formatAdminCurrency(
            summary.revenue
        )
    );


    setAdminText(
        "adminTotalBookings",
        formatAdminNumber(
            summary.totalBookings
        )
    );


    setAdminText(
        "adminConfirmedBookings",
        formatAdminNumber(
            summary.confirmedBookings
        )
    );


    setAdminText(
        "adminCancelledBookings",
        formatAdminNumber(
            summary.cancelledBookings
        )
    );

}

/* =========================================================
   16. SIDEBAR COUNTS
   ========================================================= */

function renderAdminSidebarCounts() {

    const summary =
        adminDashboardState.summary ||
        {};


    setAdminText(
        "sidebarVenueCount",
        summary.totalVenues ??
        adminDashboardState
            .venues
            .length
    );


    setAdminText(
        "sidebarUserCount",
        formatAdminCompactNumber(
            summary.totalUsers ||
            0
        )
    );


    setAdminText(
        "sidebarOrganiserCount",
        formatAdminCompactNumber(
            summary.totalOrganisers ||
            0
        )
    );

}


/* =========================================================
   17. VENUE TABLE
   ========================================================= */

function renderAdminVenueTable() {

    const body =
        document.getElementById(
            "adminVenueTableBody"
        );


    if (!body) {

        return;

    }


    const venues =
        adminDashboardState
            .venues
            .slice(
                0,
                5
            );


    if (!venues.length) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="admin-table-empty"
                >
                    No venue records available.
                </td>

            </tr>

        `;


        return;

    }


    body.innerHTML =
        venues
            .map(
                (venue) => `

                    <tr>


                        <td>

                            <div class="admin-venue-cell">

                                <div>

                                    <i data-lucide="building-2"></i>

                                </div>


                                <span>

                                    <strong>
                                        ${
                                            escapeAdminHTML(
                                                venue.name
                                            )
                                        }
                                    </strong>

                                    <small>
                                        ${
                                            escapeAdminHTML(
                                                venue.id
                                            )
                                        }
                                    </small>

                                </span>

                            </div>

                        </td>



                        <td>

                            <span class="admin-table-secondary">

                                ${
                                    escapeAdminHTML(
                                        venue.city
                                    )
                                }

                            </span>

                        </td>



                        <td>

                            <strong class="admin-table-value">

                                ${
                                    formatAdminNumber(
                                        venue.capacity
                                    )
                                }

                            </strong>

                        </td>



                        <td>

                            <span class="admin-category-count">

                                ${
                                    venue.categories
                                }

                                ${
                                    venue.categories ===
                                    1
                                        ? "category"
                                        : "categories"
                                }

                            </span>

                        </td>



                        <td>

                            <span
                                class="
                                    admin-layout-status
                                    ${
                                        venue.layoutConfigured
                                            ? "configured"
                                            : "pending"
                                    }
                                "
                            >

                                <i
                                    data-lucide="${
                                        venue.layoutConfigured
                                            ? "circle-check-big"
                                            : "clock-3"
                                    }"
                                ></i>

                                ${
                                    venue.layoutConfigured
                                        ? "Configured"
                                        : "Pending"
                                }

                            </span>

                        </td>

                    </tr>

                `
            )
            .join("");


    refreshAdminDashboardIcons();

}


/* =========================================================
   18. RECENT BOOKINGS
   ========================================================= */

function renderAdminRecentBookings() {

    const container =
        document.getElementById(
            "adminRecentBookings"
        );


    if (!container) {

        return;

    }


    const bookings =
        adminDashboardState
            .recentBookings
            .slice(
                0,
                4
            );


    if (!bookings.length) {

        container.innerHTML = `

            <div class="admin-empty-inline">

                No recent booking records.

            </div>

        `;


        return;

    }


    container.innerHTML =
        bookings
            .map(
                (booking) => {

                    const status =
                        getAdminBookingStatusVisual(
                            booking.status
                        );


                    return `

                        <a
                            href="./bookings.html?search=${
                                encodeURIComponent(
                                    booking.reference
                                )
                            }"
                            class="admin-recent-booking"
                        >


                            <div class="admin-recent-booking-icon">

                                <i data-lucide="ticket-check"></i>

                            </div>


                            <div class="admin-recent-booking-main">

                                <div>

                                    <strong>

                                        ${
                                            escapeAdminHTML(
                                                booking.reference
                                            )
                                        }

                                    </strong>


                                    <span
                                        class="
                                            admin-mini-status
                                            ${status.className}
                                        "
                                    >
                                        ${status.label}
                                    </span>

                                </div>


                                <p>

                                    ${
                                        escapeAdminHTML(
                                            booking.customer
                                        )
                                    }

                                </p>


                                <small>

                                    ${
                                        escapeAdminHTML(
                                            booking.event
                                        )
                                    }

                                </small>

                            </div>


                            <div class="admin-recent-booking-value">

                                <strong>

                                    ${
                                        formatAdminCurrency(
                                            booking.amount
                                        )
                                    }

                                </strong>


                                <small>

                                    ${
                                        booking.seats
                                    }

                                    ${
                                        booking.seats ===
                                        1
                                            ? "seat"
                                            : "seats"
                                    }

                                </small>

                            </div>

                        </a>

                    `;

                }
            )
            .join("");


    refreshAdminDashboardIcons();

}


/* =========================================================
   19. RECENT ORGANISERS
   ========================================================= */

function renderAdminRecentOrganisers() {

    const container =
        document.getElementById(
            "adminRecentOrganisers"
        );


    if (!container) {

        return;

    }


    const organisers =
        adminDashboardState
            .recentOrganisers
            .slice(
                0,
                4
            );


    if (!organisers.length) {

        container.innerHTML = `

            <div class="admin-empty-inline">

                No organiser records available.

            </div>

        `;


        return;

    }


    container.innerHTML =
        organisers
            .map(
                (organiser) => `

                    <a
                        href="./organisers.html?search=${
                            encodeURIComponent(
                                organiser.email
                            )
                        }"
                        class="admin-recent-organiser"
                    >


                        <div class="admin-recent-organiser-avatar">

                            ${
                                escapeAdminHTML(
                                    createAdminInitials(
                                        organiser.name
                                    )
                                )
                            }

                        </div>


                        <div class="admin-recent-organiser-main">

                            <strong>

                                ${
                                    escapeAdminHTML(
                                        organiser.name
                                    )
                                }

                            </strong>


                            <small>

                                ${
                                    escapeAdminHTML(
                                        organiser.email
                                    )
                                }

                            </small>

                        </div>


                        <div class="admin-recent-organiser-meta">

                            <strong>

                                ${
                                    organiser.events
                                }

                            </strong>

                            <small>
                                events
                            </small>

                        </div>

                    </a>

                `
            )
            .join("");

}


/* =========================================================
   20. NORMALIZE SUMMARY
   ========================================================= */

function normalizeAdminSummary(
    raw
) {

    const number =
        (value) =>
            Math.max(
                0,
                Number(
                    value ??
                    0
                ) ||
                0
            );


    return {

        totalVenues:
            number(
                raw.totalVenues ??
                raw.venues
            ),

        activeVenues:
            number(
                raw.activeVenues
            ),

        totalSeats:
            number(
                raw.totalSeats ??
                raw.seats
            ),

        totalUsers:
            number(
                raw.totalUsers ??
                raw.users
            ),

        totalCustomers:
            number(
                raw.totalCustomers ??
                raw.customers
            ),

        totalOrganisers:
            number(
                raw.totalOrganisers ??
                raw.organisers
            ),

        totalEvents:
            number(
                raw.totalEvents ??
                raw.events
            ),

        totalShows:
            number(
                raw.totalShows ??
                raw.shows
            ),

        totalBookings:
            number(
                raw.totalBookings ??
                raw.bookings
            ),

        confirmedBookings:
            number(
                raw.confirmedBookings ??
                raw.confirmed
            ),

        cancelledBookings:
            number(
                raw.cancelledBookings ??
                raw.cancelled
            ),

        revenue:
            number(
                raw.revenue ??
                raw.totalRevenue
            )

    };

}

/* =========================================================
   21. NORMALIZE VENUE
   ========================================================= */

function normalizeAdminVenue(
    raw,
    index = 0
) {

    return {

        id:
            String(
                raw.id ||
                raw._id ||
                `venue_${index}`
            ),

        name:
            String(
                raw.name ||
                "Unnamed Venue"
            ),

        city:
            String(
                raw.city ||
                raw.location?.city ||
                ""
            ),

        capacity:
            Math.max(
                0,
                Number(
                    raw.capacity ??
                    raw.totalSeats ??
                    0
                ) ||
                0
            ),

        categories:
            Math.max(
                0,
                Number(
                    raw.categories ??
                    raw.categoryCount ??
                    raw.seatCategories?.length ??
                    0
                ) ||
                0
            ),

        layoutConfigured:
            Boolean(
                raw.layoutConfigured ??
                raw.hasSeatLayout ??
                raw.capacity
            )

    };

}


/* =========================================================
   22. NORMALIZE BOOKING
   ========================================================= */

function normalizeAdminBooking(
    raw,
    index = 0
) {

    return {

        id:
            String(
                raw.id ||
                raw._id ||
                `booking_${index}`
            ),

        reference:
            String(
                raw.reference ||
                raw.bookingReference ||
                `SKY-${index + 1}`
            ),

        customer:
            String(
                raw.customer?.name ||
                raw.customer ||
                raw.customerName ||
                "Customer"
            ),

        event:
            String(
                raw.event?.title ||
                raw.event ||
                raw.eventTitle ||
                "SKYRA Event"
            ),

        seats:
            Math.max(
                0,
                Number(
                    raw.seats?.length ??
                    raw.seatCount ??
                    raw.tickets ??
                    0
                ) ||
                0
            ),

        amount:
            Math.max(
                0,
                Number(
                    raw.amount ??
                    raw.total ??
                    raw.totalAmount ??
                    0
                ) ||
                0
            ),

        status:
            normalizeAdminBookingStatus(
                raw.status
            ),

        createdAt:
            raw.createdAt ||
            new Date()
                .toISOString()

    };

}


/* =========================================================
   23. NORMALIZE ORGANISER
   ========================================================= */

function normalizeAdminOrganiser(
    raw,
    index = 0
) {

    return {

        id:
            String(
                raw.id ||
                raw._id ||
                `organiser_${index}`
            ),

        name:
            String(
                raw.name ||
                raw.organisationName ||
                raw.fullName ||
                "Organiser"
            ),

        email:
            String(
                raw.email ||
                ""
            ),

        events:
            Math.max(
                0,
                Number(
                    raw.events ??
                    raw.eventCount ??
                    raw.totalEvents ??
                    0
                ) ||
                0
            ),

        status:
            String(
                raw.status ||
                "ACTIVE"
            )
                .toUpperCase(),

        createdAt:
            raw.createdAt ||
            new Date()
                .toISOString()

    };

}


/* =========================================================
   24. BOOKING STATUS
   ========================================================= */

function normalizeAdminBookingStatus(
    value
) {

    const status =
        String(
            value ||
            "CONFIRMED"
        )
            .trim()
            .toUpperCase();


    if (
        [
            "CANCELLED",
            "CANCELED",
            "REFUNDED"
        ].includes(
            status
        )
    ) {

        return "CANCELLED";

    }


    if (
        [
            "COMPLETED",
            "USED"
        ].includes(
            status
        )
    ) {

        return "COMPLETED";

    }


    if (
        [
            "PENDING",
            "PROCESSING"
        ].includes(
            status
        )
    ) {

        return "PENDING";

    }


    return "CONFIRMED";

}


/* =========================================================
   25. STATUS VISUAL
   ========================================================= */

function getAdminBookingStatusVisual(
    status
) {

    switch (status) {

        case "CANCELLED":

            return {

                label:
                    "Cancelled",

                className:
                    "cancelled"

            };


        case "COMPLETED":

            return {

                label:
                    "Completed",

                className:
                    "completed"

            };


        case "PENDING":

            return {

                label:
                    "Pending",

                className:
                    "pending"

            };


        case "CONFIRMED":
        default:

            return {

                label:
                    "Confirmed",

                className:
                    "confirmed"

            };

    }

}


/* =========================================================
   26. CURRENCY
   ========================================================= */

function formatAdminCurrency(
    value
) {

    const amount =
        Number(
            value
        );


    if (
        !Number.isFinite(
            amount
        )
    ) {

        return "₹0";

    }


    return new Intl.NumberFormat(
        "en-IN",
        {

            style:
                "currency",

            currency:
                "INR",

            maximumFractionDigits:
                0

        }
    ).format(
        amount
    );

}


/* =========================================================
   27. NUMBER
   ========================================================= */

function formatAdminNumber(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "0";

    }


    return new Intl.NumberFormat(
        "en-IN"
    ).format(
        number
    );

}


/* =========================================================
   28. COMPACT NUMBER
   ========================================================= */

function formatAdminCompactNumber(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "0";

    }


    if (
        number >=
        1000000
    ) {

        return `${
            (
                number /
                1000000
            ).toFixed(
                1
            )
        }M`;

    }


    if (
        number >=
        1000
    ) {

        return `${
            (
                number /
                1000
            ).toFixed(
                1
            )
        }K`;

    }


    return String(
        number
    );

}


/* =========================================================
   29. INITIALS
   ========================================================= */

function createAdminInitials(
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

        return "AD";

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
            parts.length -
            1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   30. TEXT SETTER
   ========================================================= */

function setAdminText(
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
   31. CLONE
   ========================================================= */

function cloneAdminDashboardData(
    value
) {

    try {

        return structuredClone(
            value
        );

    } catch {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    }

}


/* =========================================================
   32. ESCAPE HTML
   ========================================================= */

function escapeAdminHTML(
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
   33. TOAST
   ========================================================= */

function showAdminDashboardToast(
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
   34. ICON REFRESH
   ========================================================= */

function refreshAdminDashboardIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   35. PUBLIC API
   ========================================================= */

window.SKYRA_ADMIN_DASHBOARD = {

    getSummary:
        () => ({
            ...adminDashboardState
                .summary
        }),

    getVenues:
        () =>
            adminDashboardState
                .venues
                .map(
                    (venue) => ({
                        ...venue
                    })
                ),

    getRecentBookings:
        () =>
            adminDashboardState
                .recentBookings
                .map(
                    (booking) => ({
                        ...booking
                    })
                ),

    getRecentOrganisers:
        () =>
            adminDashboardState
                .recentOrganisers
                .map(
                    (organiser) => ({
                        ...organiser
                    })
                ),

    refresh:
        loadAdminDashboard

};


/* =========================================================
   END SKYRA ADMIN DASHBOARD
   ========================================================= */