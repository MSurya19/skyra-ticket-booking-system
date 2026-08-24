/* =========================================================
   SKYRA - ORGANISER DASHBOARD
   File:
   frontend/js/organiser/dashboard.js

   Phase 21:
   - Uses real organiser dashboard API data
   - Renders dashboard summary
   - Renders upcoming shows
   - Renders recent bookings
   - Calculates ticket capacity
   - Supports organiser search
   - Uses shared common.js sidebar/logout system

   Final backend phase:
   - GET /api/organiser/dashboard
   - Real organiser identity from JWT
   - Events / Shows / Bookings from MongoDB
   ========================================================= */

"use strict";


/* =========================================================
   2. STATE
   ========================================================= */

const organiserDashboardState = {

    organiser:
        null,

    summary:
        null,

    shows:
        [],

    bookings:
        [],

    loading:
        false

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeOrganiserDashboard();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

async function initializeOrganiserDashboard() {

    organiserDashboardState.loading =
        true;


    try {

        const data =
            await loadOrganiserDashboardData();


        organiserDashboardState.organiser =
            resolveOrganiserUser(
                data.organiser
            );


        organiserDashboardState.summary =
            normalizeOrganiserSummary(
                data.summary,
                data
            );


        organiserDashboardState.shows =
            normalizeOrganiserShows(
                data.shows
            );


        organiserDashboardState.bookings =
            normalizeOrganiserBookings(
                data.bookings
            );


        renderOrganiserUser();

        renderOrganiserSummary();

        renderUpcomingShows();

        renderRecentBookings();

        renderOrganiserCapacity();

        renderSidebarCounts();

        initializeOrganiserSearch();

        keepOrganiserDashboardActive();

        refreshOrganiserIcons();

    } catch (error) {

        console.error(
            "Unable to initialize organiser dashboard:",
            error
        );


        showOrganiserToast(
            "Unable to load organiser dashboard.",
            "error",
            "Dashboard Error"
        );

    } finally {

        organiserDashboardState.loading =
            false;

    }

}


/* =========================================================
   5. LOAD DATA
   ========================================================= */

async function loadOrganiserDashboardData() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getOrganiserDashboard !==
            "function"
    ) {

        throw new Error(
            "Organiser dashboard API client is unavailable."
        );

    }

    const response =
        await window.SKYRA_API
            .getOrganiserDashboard();

    const data =
        response?.data ||
        response;

    if (!data) {

        throw new Error(
            "Organiser dashboard returned no data."
        );

    }

    return {

        organiser:
            data.organiser ||
            data.user ||
            null,

        summary:
            data.summary ||
            {},

        shows:
            Array.isArray(
                data.shows
            )
                ? data.shows
                : [],

        bookings:
            Array.isArray(
                data.bookings
            )
                ? data.bookings
                : []

    };

}

/* =========================================================
   6. RESOLVE ORGANISER USER
   ========================================================= */

function resolveOrganiserUser(
    dashboardOrganiser
) {

    const sharedUser =
        window.SKYRA_COMMON
            ?.getUser?.();


    /*
       Use authenticated user only if backend/common.js
       says the logged-in account really is an organiser.
    */

    if (
        sharedUser &&
        String(
            sharedUser.role ||
            ""
        ).toUpperCase() ===
        "ORGANISER"
    ) {

        return {

            id:
                sharedUser.id ||
                sharedUser._id ||
                dashboardOrganiser?.id,

            name:
                sharedUser.name ||
                sharedUser.fullName ||
                dashboardOrganiser?.name ||
                "Organiser",

            email:
                sharedUser.email ||
                dashboardOrganiser?.email ||
                "",

            role:
                "ORGANISER"

        };

    }


    return {

        id:
            dashboardOrganiser?.id ||
            "organiser_demo",

        name:
            dashboardOrganiser?.name ||
            "Organiser",

        email:
            dashboardOrganiser?.email ||
            "",

        role:
            "ORGANISER"

    };

}


/* =========================================================
   7. NORMALIZE SUMMARY
   ========================================================= */

function normalizeOrganiserSummary(
    raw,
    data
) {

    const shows =
        Array.isArray(
            data.shows
        )
            ? data.shows
            : [];


    const bookings =
        Array.isArray(
            data.bookings
        )
            ? data.bookings
            : [];


    const activeShows =
        shows.filter(
            (show) =>
                [
                    "ACTIVE",
                    "SCHEDULED",
                    "UPCOMING"
                ].includes(
                    String(
                        show.status ||
                        ""
                    ).toUpperCase()
                )
        ).length;


    return {

        totalEvents:
            Number(
                raw?.totalEvents ??
                raw?.events ??
                0
            ),

        activeShows:
            Number(
                raw?.activeShows ??
                activeShows
            ),

        totalBookings:
            Number(
                raw?.totalBookings ??
                raw?.bookings ??
                bookings.length
            ),

        revenue:
            Number(
                raw?.ticketRevenue ??
                raw?.revenue ??
                raw?.totalRevenue ??
                0
            )

    };

}


/* =========================================================
   8. NORMALIZE SHOWS
   ========================================================= */

function normalizeOrganiserShows(
    shows
) {

    if (
        !Array.isArray(
            shows
        )
    ) {

        return [];

    }


    return shows
        .map(
            (
                show,
                index
            ) => {

                return {

                    id:
                        String(
                            show.id ||
                            show._id ||
                            `organiser_show_${index}`
                        ),

                    eventId:
                        show.eventId ||
                        show.event?._id ||
                        show.event?.id ||
                        null,

                    eventTitle:
                        String(
                            show.eventTitle ||
                            show.event?.title ||
                            "SKYRA Event"
                        ),

                    type:
                        normalizeOrganiserEventType(
                            show.type ||
                            show.eventType ||
                            show.event?.type
                        ),

                    venue:
                        String(
                            show.venue ||
                            show.venueName ||
                            show.venue?.name ||
                            "Venue TBA"
                        ),

                    city:
                        String(
                            show.city ||
                            show.venue?.city ||
                            ""
                        ),

                    date:
                        show.date ||
                        show.showDate ||
                        null,

                    time:
                        show.time ||
                        show.showTime ||
                        null,

                    status:
                        normalizeOrganiserShowStatus(
                            show.status
                        ),

                    soldSeats:
                        Math.max(
                            0,
                            Number(
                                show.soldSeats ??
                                show.bookedSeats ??
                                show.ticketsSold ??
                                0
                            )
                        ),

                    totalSeats:
                        Math.max(
                            0,
                            Number(
                                show.totalSeats ??
                                show.capacity ??
                                0
                            )
                        )

                };

            }
        )
        .sort(
            (
                first,
                second
            ) =>
                getOrganiserShowTimestamp(
                    first
                ) -
                getOrganiserShowTimestamp(
                    second
                )
        );

}


/* =========================================================
   9. NORMALIZE BOOKINGS
   ========================================================= */

function normalizeOrganiserBookings(
    bookings
) {

    if (
        !Array.isArray(
            bookings
        )
    ) {

        return [];

    }


    return bookings
        .map(
            (
                booking,
                index
            ) => {

                const seats =
                    Array.isArray(
                        booking.seats
                    )
                        ? booking.seats.map(
                            (seat) =>
                                typeof seat ===
                                    "string"
                                    ? seat
                                    : (
                                        seat.label ||
                                        seat.seatNumber ||
                                        seat.number ||
                                        ""
                                    )
                        )
                        : [];


                return {

                    id:
                        String(
                            booking.id ||
                            booking._id ||
                            `organiser_booking_${index}`
                        ),

                    reference:
                        String(
                            booking.reference ||
                            booking.bookingReference ||
                            booking.bookingRef ||
                            booking.id ||
                            "SKYRA"
                        ),

                    customer:
                        String(
                            booking.customer ||
                            booking.user?.name ||
                            booking.customerName ||
                            "Customer"
                        ),

                    eventTitle:
                        String(
                            booking.eventTitle ||
                            booking.event?.title ||
                            "SKYRA Event"
                        ),

                    seats,

                    amount:
                        Number(
                            booking.amount ??
                            booking.total ??
                            booking.totalAmount ??
                            0
                        ),

                    status:
                        normalizeOrganiserBookingStatus(
                            booking.status
                        ),

                    createdAt:
                        booking.createdAt ||
                        booking.bookedAt ||
                        booking.date ||
                        null

                };

            }
        )
        .sort(
            (
                first,
                second
            ) =>
                (
                    new Date(
                        second.createdAt
                    ).getTime() ||
                    0
                ) -
                (
                    new Date(
                        first.createdAt
                    ).getTime() ||
                    0
                )
        );

}


/* =========================================================
   10. RENDER USER
   ========================================================= */

function renderOrganiserUser() {

    const organiser =
        organiserDashboardState
            .organiser;


    if (!organiser) {

        return;

    }


    const initials =
        createOrganiserInitials(
            organiser.name
        );


    setOrganiserText(
        "sidebarUserName",
        organiser.name
    );


    setOrganiserText(
        "sidebarUserInitials",
        initials
    );


    setOrganiserText(
        "topbarUserName",
        organiser.name
    );


    setOrganiserText(
        "topbarUserInitials",
        initials
    );


    setOrganiserText(
        "dropdownUserName",
        organiser.name
    );


    setOrganiserText(
        "dropdownUserInitials",
        initials
    );


    setOrganiserText(
        "dropdownUserEmail",
        organiser.email
    );


    setOrganiserText(
        "organiserWelcomeName",
        organiser.name
    );

}


/* =========================================================
   11. RENDER SUMMARY
   ========================================================= */

function renderOrganiserSummary() {

    const summary =
        organiserDashboardState
            .summary;


    if (!summary) {

        return;

    }


    setOrganiserText(
        "organiserTotalEvents",
        formatOrganiserNumber(
            summary.totalEvents
        )
    );


    setOrganiserText(
        "organiserActiveShows",
        formatOrganiserNumber(
            summary.activeShows
        )
    );


    setOrganiserText(
        "organiserBookings",
        formatOrganiserNumber(
            summary.totalBookings
        )
    );


    setOrganiserText(
        "organiserRevenue",
        formatCompactIndianCurrency(
            summary.revenue
        )
    );

}


/* =========================================================
   12. SIDEBAR COUNTS
   ========================================================= */

function renderSidebarCounts() {

    const summary =
        organiserDashboardState
            .summary;


    setOrganiserText(
        "sidebarEventCount",
        summary?.totalEvents ??
        0
    );


    setOrganiserText(
        "sidebarShowCount",
        summary?.activeShows ??
        0
    );

}


/* =========================================================
   13. UPCOMING SHOWS
   ========================================================= */

function renderUpcomingShows() {

    const container =
        document.getElementById(
            "organiserUpcomingShows"
        );


    if (!container) {

        return;

    }


    const shows =
        organiserDashboardState
            .shows
            .filter(
                (show) =>
                    [
                        "ACTIVE",
                        "SCHEDULED",
                        "UPCOMING"
                    ].includes(
                        show.status
                    )
            )
            .slice(
                0,
                4
            );


    if (!shows.length) {

        container.innerHTML =
            createNoShowsHTML();


        refreshOrganiserIcons();

        return;

    }


    container.innerHTML =
        shows
            .map(
                createOrganiserShowHTML
            )
            .join("");


    refreshOrganiserIcons();

}


/* =========================================================
   14. SHOW HTML
   ========================================================= */

function createOrganiserShowHTML(
    show
) {

    const date =
        parseOrganiserDate(
            show.date
        );


    const month =
        date
            ? new Intl.DateTimeFormat(
                "en-IN",
                {
                    month:
                        "short"
                }
            )
                .format(
                    date
                )
                .toUpperCase()
            : "TBA";


    const day =
        date
            ? String(
                date.getDate()
            ).padStart(
                2,
                "0"
            )
            : "--";


    const soldPercent =
        calculateSoldPercent(
            show.soldSeats,
            show.totalSeats
        );


    const status =
        getOrganiserShowStatusVisual(
            show.status
        );


    const type =
        getOrganiserTypeVisual(
            show.type
        );


    const location =
        [
            show.venue,
            show.city
        ]
            .filter(Boolean)
            .join(", ");


    return `

        <article class="organiser-show-item">

            <div class="organiser-show-date">

                <span>
                    ${escapeOrganiserHTML(
                        month
                    )}
                </span>

                <strong>
                    ${escapeOrganiserHTML(
                        day
                    )}
                </strong>

            </div>


            <div class="organiser-show-info">

                <div>

                    <span
                        class="
                            organiser-type-badge
                            ${type.className}
                        "
                    >
                        ${escapeOrganiserHTML(
                            type.label
                        )}
                    </span>


                    <span
                        class="
                            organiser-status-badge
                            ${status.className}
                        "
                    >
                        ${escapeOrganiserHTML(
                            status.label
                        )}
                    </span>

                </div>


                <h3>
                    ${escapeOrganiserHTML(
                        show.eventTitle
                    )}
                </h3>


                <p>

                    <i data-lucide="map-pin"></i>

                    ${escapeOrganiserHTML(
                        location ||
                        "Venue TBA"
                    )}

                    ${
                        show.time
                            ? ` · ${
                                escapeOrganiserHTML(
                                    formatOrganiserTime(
                                        show.time
                                    )
                                )
                            }`
                            : ""
                    }

                </p>

            </div>


            <div class="organiser-show-sales">

                <span>
                    Tickets Sold
                </span>


                <strong>

                    ${
                        formatOrganiserNumber(
                            show.soldSeats
                        )
                    }

                    /

                    ${
                        formatOrganiserNumber(
                            show.totalSeats
                        )
                    }

                </strong>


                <div class="organiser-sales-progress">

                    <span
                        style="width:${soldPercent}%"
                    ></span>

                </div>

            </div>


            <a
                href="./manage-shows.html?show=${
                    encodeURIComponent(
                        show.id
                    )
                }"
                class="organiser-show-open"
                aria-label="View ${escapeOrganiserAttribute(
                    show.eventTitle
                )}"
            >

                <i data-lucide="chevron-right"></i>

            </a>

        </article>

    `;

}


/* =========================================================
   15. EMPTY SHOWS
   ========================================================= */

function createNoShowsHTML() {

    return `

        <div class="organiser-empty-state">

            <div>

                <i data-lucide="calendar-plus"></i>

            </div>


            <h3>
                No upcoming shows
            </h3>


            <p>

                Create a show for one of your events
                to start selling tickets.

            </p>


            <a
                href="./create-show.html"
                class="btn btn-primary"
            >

                <i data-lucide="calendar-plus"></i>

                Create Show

            </a>

        </div>

    `;

}


/* =========================================================
   16. RECENT BOOKINGS
   ========================================================= */

function renderRecentBookings() {

    const container =
        document.getElementById(
            "organiserRecentBookings"
        );


    if (!container) {

        return;

    }


    const bookings =
        organiserDashboardState
            .bookings
            .slice(
                0,
                5
            );


    if (!bookings.length) {

        container.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    style="
                        text-align:center;
                        padding:32px;
                        color:#64748b;
                    "
                >

                    No bookings available yet.

                </td>

            </tr>

        `;


        return;

    }


    container.innerHTML =
        bookings
            .map(
                createOrganiserBookingHTML
            )
            .join("");

}


/* =========================================================
   17. BOOKING HTML
   ========================================================= */

function createOrganiserBookingHTML(
    booking
) {

    const status =
        getOrganiserBookingStatusVisual(
            booking.status
        );


    return `

        <tr>

            <td>

                <strong>
                    ${escapeOrganiserHTML(
                        booking.reference
                    )}
                </strong>

                <span>
                    ${escapeOrganiserHTML(
                        formatOrganiserRelativeTime(
                            booking.createdAt
                        )
                    )}
                </span>

            </td>


            <td>
                ${escapeOrganiserHTML(
                    booking.customer
                )}
            </td>


            <td>
                ${escapeOrganiserHTML(
                    booking.eventTitle
                )}
            </td>


            <td>

                ${
                    booking.seats.length
                        ? escapeOrganiserHTML(
                            booking.seats.join(
                                ", "
                            )
                        )
                        : "—"
                }

            </td>


            <td>

                ${formatOrganiserCurrency(
                    booking.amount
                )}

            </td>


            <td>

                <span
                    class="
                        organiser-booking-status
                        ${status.className}
                    "
                >
                    ${escapeOrganiserHTML(
                        status.label
                    )}
                </span>

            </td>

        </tr>

    `;

}


/* =========================================================
   18. CAPACITY
   ========================================================= */

function renderOrganiserCapacity() {

    const shows =
        organiserDashboardState
            .shows
            .filter(
                (show) =>
                    [
                        "ACTIVE",
                        "SCHEDULED",
                        "UPCOMING"
                    ].includes(
                        show.status
                    )
            );


    const sold =
        shows.reduce(
            (
                total,
                show
            ) =>
                total +
                show.soldSeats,
            0
        );


    const capacity =
        shows.reduce(
            (
                total,
                show
            ) =>
                total +
                show.totalSeats,
            0
        );


    const percentage =
        calculateSoldPercent(
            sold,
            capacity
        );


    setOrganiserText(
        "organiserCapacityPercent",
        `${percentage}%`
    );


    setOrganiserText(
        "organiserSeatsSold",
        formatOrganiserNumber(
            sold
        )
    );


    setOrganiserText(
        "organiserSeatCapacity",
        formatOrganiserNumber(
            capacity
        )
    );


    const bar =
        document.getElementById(
            "organiserCapacityBar"
        );


    if (bar) {

        bar.style.width =
            `${percentage}%`;

    }

}


/* =========================================================
   19. SEARCH
   ========================================================= */

function initializeOrganiserSearch() {

    const input =
        document.getElementById(
            "dashboardSearch"
        );


    input?.addEventListener(
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
                input.value
                    .trim();


            if (!query) {

                return;

            }


            window.location.href =
                `./manage-events.html?search=${
                    encodeURIComponent(
                        query
                    )
                }`;

        }
    );

}


/* =========================================================
   20. ACTIVE NAVIGATION
   ========================================================= */

function keepOrganiserDashboardActive() {

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
   21. EVENT TYPE
   ========================================================= */

function normalizeOrganiserEventType(
    value
) {

    const type =
        String(
            value ||
            "EVENT"
        )
            .trim()
            .toUpperCase();


    if (
        type.includes(
            "MOVIE"
        )
    ) {

        return "MOVIE";

    }


    if (
        type.includes(
            "CONCERT"
        )
    ) {

        return "CONCERT";

    }


    if (
        type.includes(
            "LIVE"
        ) ||
        type.includes(
            "COMEDY"
        )
    ) {

        return "LIVE_SHOW";

    }


    return "EVENT";

}


/* =========================================================
   22. TYPE VISUAL
   ========================================================= */

function getOrganiserTypeVisual(
    type
) {

    switch (type) {

        case "MOVIE":

            return {

                label:
                    "Movie",

                className:
                    "movie"

            };


        case "LIVE_SHOW":

            return {

                label:
                    "Live Show",

                className:
                    "live-show"

            };


        case "CONCERT":

            return {

                label:
                    "Concert",

                className:
                    "concert"

            };


        default:

            return {

                label:
                    "Event",

                className:
                    "concert"

            };

    }

}


/* =========================================================
   23. SHOW STATUS
   ========================================================= */

function normalizeOrganiserShowStatus(
    value
) {

    const status =
        String(
            value ||
            "SCHEDULED"
        )
            .trim()
            .toUpperCase();


    if (
        [
            "ACTIVE",
            "PUBLISHED"
        ].includes(
            status
        )
    ) {

        return "ACTIVE";

    }


    if (
        [
            "UPCOMING",
            "SCHEDULED"
        ].includes(
            status
        )
    ) {

        return "SCHEDULED";

    }


    if (
        [
            "COMPLETED",
            "FINISHED"
        ].includes(
            status
        )
    ) {

        return "COMPLETED";

    }


    return status;

}


/* =========================================================
   24. SHOW STATUS VISUAL
   ========================================================= */

function getOrganiserShowStatusVisual(
    status
) {

    switch (status) {

        case "ACTIVE":

            return {

                label:
                    "Active",

                className:
                    "active"

            };


        case "COMPLETED":

            return {

                label:
                    "Completed",

                className:
                    "completed"

            };


        default:

            return {

                label:
                    "Scheduled",

                className:
                    "scheduled"

            };

    }

}


/* =========================================================
   25. BOOKING STATUS
   ========================================================= */

function normalizeOrganiserBookingStatus(
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
            "SUCCESS",
            "BOOKED",
            "CONFIRMED"
        ].includes(
            status
        )
    ) {

        return "CONFIRMED";

    }


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


    return "PENDING";

}


/* =========================================================
   26. BOOKING STATUS VISUAL
   ========================================================= */

function getOrganiserBookingStatusVisual(
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


        case "PENDING":

            return {

                label:
                    "Pending",

                className:
                    "pending"

            };


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
   27. SOLD PERCENT
   ========================================================= */

function calculateSoldPercent(
    sold,
    total
) {

    const soldValue =
        Number(
            sold
        );


    const totalValue =
        Number(
            total
        );


    if (
        !Number.isFinite(
            soldValue
        ) ||
        !Number.isFinite(
            totalValue
        ) ||
        totalValue <= 0
    ) {

        return 0;

    }


    return Math.max(
        0,
        Math.min(
            100,
            Math.round(
                (
                    soldValue /
                    totalValue
                ) *
                100
            )
        )
    );

}


/* =========================================================
   28. SHOW TIMESTAMP
   ========================================================= */

function getOrganiserShowTimestamp(
    show
) {

    if (!show.date) {

        return Number.MAX_SAFE_INTEGER;

    }


    const dateTime =
        `${show.date}T${
            show.time ||
            "00:00"
        }`;


    const timestamp =
        new Date(
            dateTime
        ).getTime();


    return Number.isFinite(
        timestamp
    )
        ? timestamp
        : Number.MAX_SAFE_INTEGER;

}


/* =========================================================
   29. DATE PARSER
   ========================================================= */

function parseOrganiserDate(
    value
) {

    if (!value) {

        return null;

    }


    if (
        typeof value ===
            "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {

        const [
            year,
            month,
            day
        ] =
            value
                .split("-")
                .map(Number);


        return new Date(
            year,
            month - 1,
            day
        );

    }


    const date =
        new Date(
            value
        );


    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;

}


/* =========================================================
   30. TIME
   ========================================================= */

function formatOrganiserTime(
    value
) {

    if (!value) {

        return "TBA";

    }


    if (
        !/^\d{2}:\d{2}$/.test(
            String(
                value
            )
        )
    ) {

        return String(
            value
        );

    }


    const [
        hoursValue,
        minutes
    ] =
        String(
            value
        )
            .split(":")
            .map(Number);


    const period =
        hoursValue >= 12
            ? "PM"
            : "AM";


    const hours =
        hoursValue % 12 ||
        12;


    return `${
        hours
    }:${
        String(
            minutes
        ).padStart(
            2,
            "0"
        )
    } ${period}`;

}


/* =========================================================
   31. RELATIVE TIME
   ========================================================= */

function formatOrganiserRelativeTime(
    value
) {

    if (!value) {

        return "";

    }


    const timestamp =
        new Date(
            value
        ).getTime();


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


    return `${days}d ago`;

}


/* =========================================================
   32. CURRENCY
   ========================================================= */

function formatOrganiserCurrency(
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
   33. COMPACT CURRENCY
   ========================================================= */

function formatCompactIndianCurrency(
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


    if (
        amount >=
        10000000
    ) {

        return `₹${
            (
                amount /
                10000000
            ).toFixed(
                1
            )
        }Cr`;

    }


    if (
        amount >=
        100000
    ) {

        return `₹${
            (
                amount /
                100000
            ).toFixed(
                1
            )
        }L`;

    }


    if (
        amount >=
        1000
    ) {

        return `₹${
            (
                amount /
                1000
            ).toFixed(
                1
            )
        }K`;

    }


    return `₹${amount}`;

}


/* =========================================================
   34. NUMBER
   ========================================================= */

function formatOrganiserNumber(
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
   35. INITIALS
   ========================================================= */

function createOrganiserInitials(
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

        return "OR";

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
   36. SET TEXT
   ========================================================= */

function setOrganiserText(
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
   37. ESCAPE HTML
   ========================================================= */

function escapeOrganiserHTML(
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
   38. ESCAPE ATTRIBUTE
   ========================================================= */

function escapeOrganiserAttribute(
    value
) {

    return escapeOrganiserHTML(
        value
    );

}


/* =========================================================
   39. CLONE
   ========================================================= */

function cloneOrganiserData(
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
   40. TOAST
   ========================================================= */

function showOrganiserToast(
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
   41. ICONS
   ========================================================= */

function refreshOrganiserIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   42. PUBLIC API
   ========================================================= */

window.SKYRA_ORGANISER_DASHBOARD = {

    refresh:
        initializeOrganiserDashboard,

    getSummary:
        () => ({
            ...organiserDashboardState
                .summary
        }),

    getShows:
        () =>
            organiserDashboardState
                .shows
                .map(
                    (show) => ({
                        ...show
                    })
                ),

    getBookings:
        () =>
            organiserDashboardState
                .bookings
                .map(
                    (booking) => ({
                        ...booking
                    })
                )

};


/* =========================================================
   END SKYRA ORGANISER DASHBOARD
   ========================================================= */