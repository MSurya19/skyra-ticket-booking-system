/* =========================================================
   SKYRA - ORGANISER REVENUE
   File:
   frontend/js/organiser/revenue.js

   Phase 21 real revenue:
   - Data comes from authenticated organiser revenue API
   - CONFIRMED + SUCCESS => revenue
   - COMPLETED + SUCCESS => revenue
   - CANCELLED + REFUNDED => refund value
   - Convenience fees displayed separately
   - No organiser settlement/commission is invented

   Future backend:
   - GET /api/organiser/revenue
   - GET /api/organiser/revenue/events
   - GET /api/organiser/revenue/transactions
   ========================================================= */

"use strict";


/* =========================================================
   1-2. BACKEND-ONLY REVENUE DATA
   ========================================================= */

/* =========================================================
   3. STATE
   ========================================================= */

const organiserRevenueState = {

    bookings:
        [],

    filteredBookings:
        [],

    revenueBookings:
        [],

    eventBreakdown:
        [],

    period:
        "ALL",

    eventFilter:
        "ALL",

    showFilter:
        "ALL",

    search:
        "",

    sort:
        "NEWEST",

    loading:
        false

};


/* =========================================================
   4. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeOrganiserRevenuePage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

async function initializeOrganiserRevenuePage() {

    initializeRevenueUser();

    initializeRevenueNavigation();

    initializeRevenueControls();

    initializeRevenueTopSearch();


    await loadRevenueData();


    applyRevenueURLParameters();

    refreshRevenueIcons();

}


/* =========================================================
   6. LOAD
   ========================================================= */

async function loadRevenueData() {

    organiserRevenueState.loading =
        true;


    try {

        let bookings =
            await fetchRevenueSource();


        bookings =
            bookings
                .map(
                    normalizeRevenueBooking
                )
                .filter(
                    (booking) =>
                        Boolean(
                            booking.id
                        )
                );


        organiserRevenueState.bookings =
            mergeUniqueRevenueBookings(
                bookings
            );


        populateRevenueFilters();

        renderRevenueSidebarCounts();

        applyRevenueFilters();

    } catch (error) {

        console.error(
            "Unable to load organiser revenue:",
            error
        );


        organiserRevenueState.bookings =
            [];


        populateRevenueFilters();

        applyRevenueFilters();


        showRevenueToast(
            "Unable to load revenue information.",
            "error",
            "Revenue Unavailable"
        );

    } finally {

        organiserRevenueState.loading =
            false;

    }

}


/* =========================================================
   7. DATA SOURCE
   ========================================================= */

async function fetchRevenueSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getOrganiserRevenue !==
            "function"
    ) {

        throw new Error(
            "Organiser revenue API client is unavailable."
        );

    }

    const response =
        await window.SKYRA_API
            .getOrganiserRevenue();

    const transactions =
        response?.data?.transactions ||
        response?.transactions ||
        [];

    if (
        !Array.isArray(
            transactions
        )
    ) {

        throw new Error(
            "Organiser revenue response is invalid."
        );

    }

    return transactions;

}



/* =========================================================
   9. NORMALIZE BOOKING
   ========================================================= */

function normalizeRevenueBooking(
    raw,
    index = 0
) {

    const customer =
        raw.customer &&
        typeof raw.customer ===
        "object"
            ? raw.customer
            : {};


    const rawSeats =
        Array.isArray(
            raw.seats
        )
            ? raw.seats
            : [];


    const seats =
        rawSeats.map(
            (
                seat,
                seatIndex
            ) => {

                if (
                    typeof seat ===
                    "string"
                ) {

                    return {

                        label:
                            seat,

                        category:
                            "Seat",

                        price:
                            0

                    };

                }


                return {

                    label:
                        String(
                            seat.label ||
                            seat.seatLabel ||
                            seat.number ||
                            `Seat ${
                                seatIndex +
                                1
                            }`
                        ),

                    category:
                        String(
                            seat.category ||
                            seat.categoryName ||
                            "Seat"
                        ),

                    price:
                        Math.max(
                            0,
                            Number(
                                seat.price ??
                                0
                            ) ||
                            0
                        )

                };

            }
        );


    const seatSubtotal =
        seats.reduce(
            (
                total,
                seat
            ) =>
                total +
                seat.price,
            0
        );


    const total =
        Math.max(
            0,
            Number(
                raw.total ??
                raw.totalAmount ??
                raw.amount ??
                raw.payment?.amount ??
                seatSubtotal
            ) ||
            0
        );


    const convenienceFee =
        Math.max(
            0,
            Number(
                raw.convenienceFee ??
                raw.fees ??
                Math.max(
                    0,
                    total -
                    seatSubtotal
                )
            ) ||
            0
        );


    const subtotal =
        Math.max(
            0,
            Number(
                raw.subtotal ??
                raw.ticketSubtotal ??
                Math.max(
                    0,
                    total -
                    convenienceFee
                )
            ) ||
            seatSubtotal
        );


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
                raw.bookingCode ||
                `SKY-${
                    String(
                        index +
                        1
                    ).padStart(
                        5,
                        "0"
                    )
                }`
            ),

        customer: {

            name:
                String(
                    customer.name ||
                    customer.fullName ||
                    raw.customerName ||
                    "Customer"
                ),

            email:
                String(
                    customer.email ||
                    raw.customerEmail ||
                    ""
                )

        },

        eventId:
            String(
                raw.eventId ||
                raw.event?.id ||
                raw.event?._id ||
                ""
            ),

        eventTitle:
            String(
                raw.eventTitle ||
                raw.event?.title ||
                "SKYRA Event"
            ),

        showId:
            String(
                raw.showId ||
                raw.show?.id ||
                raw.show?._id ||
                ""
            ),

        showReference:
            String(
                raw.showReference ||
                raw.show?.reference ||
                ""
            ),

        venueName:
            String(
                raw.venueName ||
                raw.venue?.name ||
                raw.show?.venue?.name ||
                "Venue"
            ),

        venueCity:
            String(
                raw.venueCity ||
                raw.venue?.city ||
                raw.show?.venue?.city ||
                ""
            ),

        seats,

        subtotal,

        convenienceFee,

        total,

        status:
            normalizeRevenueBookingStatus(
                raw.status
            ),

        paymentStatus:
            normalizeRevenuePaymentStatus(
                raw.paymentStatus ||
                raw.payment?.status
            ),

        paymentReference:
            String(
                raw.paymentReference ||
                raw.paymentId ||
                raw.payment?.reference ||
                "—"
            ),

        createdAt:
            raw.createdAt ||
            new Date()
                .toISOString(),

        cancelledAt:
            raw.cancelledAt ||
            null

    };

}


/* =========================================================
   10. UNIQUE BOOKINGS
   ========================================================= */

function mergeUniqueRevenueBookings(
    bookings
) {

    const map =
        new Map();


    bookings.forEach(
        (booking) => {

            if (
                !map.has(
                    booking.id
                )
            ) {

                map.set(
                    booking.id,
                    booking
                );

            }

        }
    );


    return [
        ...map.values()
    ];

}


/* =========================================================
   11. USER
   ========================================================= */

function initializeRevenueUser() {

    const sharedUser =
        window.SKYRA_COMMON
            ?.getUser?.();


    let organiser = {

        name:
            "Organiser",

        email:
            "",

        role:
            "ORGANISER"

    };


    if (
        sharedUser &&
        String(
            sharedUser.role ||
            ""
        ).toUpperCase() ===
        "ORGANISER"
    ) {

        organiser = {

            ...organiser,
            ...sharedUser

        };

    }


    const name =
        String(
            organiser.name ||
            organiser.fullName ||
            "Organiser"
        );


    const initials =
        createRevenueInitials(
            name
        );


    setRevenueText(
        "sidebarUserName",
        name
    );


    setRevenueText(
        "sidebarUserInitials",
        initials
    );


    setRevenueText(
        "topbarUserName",
        name
    );


    setRevenueText(
        "topbarUserInitials",
        initials
    );


    setRevenueText(
        "dropdownUserName",
        name
    );


    setRevenueText(
        "dropdownUserInitials",
        initials
    );


    setRevenueText(
        "dropdownUserEmail",
        organiser.email ||
        ""
    );

}


/* =========================================================
   12. NAVIGATION
   ========================================================= */

function initializeRevenueNavigation() {

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
                    "./revenue.html";


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
   13. CONTROLS
   ========================================================= */

function initializeRevenueControls() {

    /*
       PERIOD
    */

    document
        .querySelectorAll(
            "[data-revenue-period]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        organiserRevenueState.period =
                            button.dataset
                                .revenuePeriod ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-revenue-period]"
                            )
                            .forEach(
                                (item) => {

                                    const active =
                                        item ===
                                        button;


                                    item.classList.toggle(
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


                        applyRevenueFilters();

                    }
                );

            }
        );


    /*
       EVENT
    */

    document
        .getElementById(
            "revenueEventFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserRevenueState.eventFilter =
                    event.target.value ||
                    "ALL";


                updateRevenueShowFilterOptions();

                applyRevenueFilters();

            }
        );


    /*
       SHOW
    */

    document
        .getElementById(
            "revenueShowFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserRevenueState.showFilter =
                    event.target.value ||
                    "ALL";


                applyRevenueFilters();

            }
        );


    /*
       SEARCH
    */

    document
        .getElementById(
            "revenueSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                organiserRevenueState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                renderRevenueTransactions();

                updateRevenueClearButton();

            }
        );


    /*
       SORT
    */

    document
        .getElementById(
            "revenueSort"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserRevenueState.sort =
                    event.target.value ||
                    "NEWEST";


                renderRevenueTransactions();

                updateRevenueClearButton();

            }
        );


    document
        .getElementById(
            "clearRevenueFilters"
        )
        ?.addEventListener(
            "click",
            clearRevenueFilters
        );

}


/* =========================================================
   14. TOP SEARCH
   ========================================================= */

function initializeRevenueTopSearch() {

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


                const search =
                    document.getElementById(
                        "revenueSearch"
                    );


                if (search) {

                    search.value =
                        query;

                }


                organiserRevenueState.search =
                    query
                        .toLowerCase();


                renderRevenueTransactions();

                updateRevenueClearButton();

            }
        );

}


/* =========================================================
   15. FILTER OPTIONS
   ========================================================= */

function populateRevenueFilters() {

    const eventSelect =
        document.getElementById(
            "revenueEventFilter"
        );


    if (!eventSelect) {

        return;

    }


    eventSelect.innerHTML = `

        <option value="ALL">
            All Events
        </option>

    `;


    const events =
        new Map();


    organiserRevenueState
        .bookings
        .forEach(
            (booking) => {

                if (
                    booking.eventId &&
                    !events.has(
                        booking.eventId
                    )
                ) {

                    events.set(
                        booking.eventId,
                        booking.eventTitle
                    );

                }

            }
        );


    [
        ...events.entries()
    ]
        .sort(
            (
                first,
                second
            ) =>
                first[1]
                    .localeCompare(
                        second[1]
                    )
        )
        .forEach(
            ([
                id,
                title
            ]) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    id;


                option.textContent =
                    title;


                eventSelect.appendChild(
                    option
                );

            }
        );


    updateRevenueShowFilterOptions();

}


/* =========================================================
   16. SHOW FILTER OPTIONS
   ========================================================= */

function updateRevenueShowFilterOptions() {

    const select =
        document.getElementById(
            "revenueShowFilter"
        );


    if (!select) {

        return;

    }


    const selectedEvent =
        organiserRevenueState
            .eventFilter;


    select.innerHTML = `

        <option value="ALL">
            All Shows
        </option>

    `;


    const shows =
        new Map();


    organiserRevenueState
        .bookings
        .filter(
            (booking) => {

                return (
                    selectedEvent ===
                        "ALL" ||
                    booking.eventId ===
                        selectedEvent
                );

            }
        )
        .forEach(
            (booking) => {

                if (
                    booking.showId &&
                    !shows.has(
                        booking.showId
                    )
                ) {

                    const label =
                        booking.showReference
                            ? `${
                                booking.eventTitle
                            } · ${
                                booking.showReference
                            }`
                            : booking.eventTitle;


                    shows.set(
                        booking.showId,
                        label
                    );

                }

            }
        );


    [
        ...shows.entries()
    ]
        .forEach(
            ([
                id,
                label
            ]) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    id;


                option.textContent =
                    label;


                select.appendChild(
                    option
                );

            }
        );


    const stillExists =
        organiserRevenueState
            .showFilter ===
            "ALL" ||
        shows.has(
            organiserRevenueState
                .showFilter
        );


    if (!stillExists) {

        organiserRevenueState.showFilter =
            "ALL";

    }


    select.value =
        organiserRevenueState
            .showFilter;

}


/* =========================================================
   17. URL PARAMETERS
   ========================================================= */

function applyRevenueURLParameters() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const eventId =
        params.get(
            "event"
        );


    const showId =
        params.get(
            "show"
        );


    if (
        eventId &&
        organiserRevenueState
            .bookings
            .some(
                (booking) =>
                    booking.eventId ===
                    eventId
            )
    ) {

        organiserRevenueState.eventFilter =
            eventId;


        const select =
            document.getElementById(
                "revenueEventFilter"
            );


        if (select) {

            select.value =
                eventId;

        }


        updateRevenueShowFilterOptions();

    }


    if (
        showId &&
        organiserRevenueState
            .bookings
            .some(
                (booking) =>
                    booking.showId ===
                    showId
            )
    ) {

        organiserRevenueState.showFilter =
            showId;


        const showSelect =
            document.getElementById(
                "revenueShowFilter"
            );


        if (showSelect) {

            showSelect.value =
                showId;

        }

    }


    applyRevenueFilters();

}


/* =========================================================
   18. APPLY MAIN FILTERS
   ========================================================= */

function applyRevenueFilters() {

    organiserRevenueState.filteredBookings =
        organiserRevenueState
            .bookings
            .filter(
                (booking) => {

                    /*
                       PERIOD
                    */

                    if (
                        !matchesRevenuePeriod(
                            booking
                        )
                    ) {

                        return false;

                    }


                    /*
                       EVENT
                    */

                    if (
                        organiserRevenueState.eventFilter !==
                            "ALL" &&
                        booking.eventId !==
                            organiserRevenueState.eventFilter
                    ) {

                        return false;

                    }


                    /*
                       SHOW
                    */

                    if (
                        organiserRevenueState.showFilter !==
                            "ALL" &&
                        booking.showId !==
                            organiserRevenueState.showFilter
                    ) {

                        return false;

                    }


                    return true;

                }
            );


    organiserRevenueState.revenueBookings =
        organiserRevenueState
            .filteredBookings
            .filter(
                isRecognizedRevenueBooking
            );


    organiserRevenueState.eventBreakdown =
        buildRevenueEventBreakdown(
            organiserRevenueState
                .filteredBookings
        );


    renderRevenueSummary();

    renderRevenueDetails();

    renderRevenueTrend();

    renderRevenueEventBreakdown();

    renderRevenueTransactions();

    updateRevenueClearButton();

}


/* =========================================================
   19. PERIOD MATCH
   ========================================================= */

function matchesRevenuePeriod(
    booking
) {

    if (
        organiserRevenueState.period ===
        "ALL"
    ) {

        return true;

    }


    const days =
        Number(
            organiserRevenueState.period
        );


    if (
        !Number.isFinite(
            days
        )
    ) {

        return true;

    }


    const bookingTimestamp =
        getRevenueTimestamp(
            booking.createdAt
        );


    if (!bookingTimestamp) {

        return false;

    }


    const start =
        Date.now() -
        (
            days *
            24 *
            60 *
            60 *
            1000
        );


    return bookingTimestamp >=
        start;

}


/* =========================================================
   20. RECOGNIZED REVENUE
   ========================================================= */

function isRecognizedRevenueBooking(
    booking
) {

    return (
        [
            "CONFIRMED",
            "COMPLETED"
        ].includes(
            booking.status
        ) &&
        booking.paymentStatus ===
            "SUCCESS"
    );

}


/* =========================================================
   21. REFUNDED BOOKING
   ========================================================= */

function isRefundedRevenueBooking(
    booking
) {

    return (
        booking.paymentStatus ===
            "REFUNDED"
    );

}


/* =========================================================
   22. SUMMARY
   ========================================================= */

function renderRevenueSummary() {

    const paid =
        organiserRevenueState
            .revenueBookings;


    const refunds =
        organiserRevenueState
            .filteredBookings
            .filter(
                isRefundedRevenueBooking
            );


    const grossTicketRevenue =
        paid.reduce(
            (
                total,
                booking
            ) =>
                total +
                booking.subtotal,
            0
        );


    const tickets =
        paid.reduce(
            (
                total,
                booking
            ) =>
                total +
                booking.seats.length,
            0
        );


    const refunded =
        refunds.reduce(
            (
                total,
                booking
            ) =>
                total +
                booking.subtotal,
            0
        );


    setRevenueText(
        "revenueGrossTotal",
        formatRevenueCompactCurrency(
            grossTicketRevenue
        )
    );


    setRevenueText(
        "revenuePaidBookings",
        formatRevenueNumber(
            paid.length
        )
    );


    setRevenueText(
        "revenueTicketsSold",
        formatRevenueNumber(
            tickets
        )
    );


    setRevenueText(
        "revenueRefundedValue",
        formatRevenueCompactCurrency(
            refunded
        )
    );

}


/* =========================================================
   23. REVENUE DETAILS
   ========================================================= */

function renderRevenueDetails() {

    const paid =
        organiserRevenueState
            .revenueBookings;


    const refunds =
        organiserRevenueState
            .filteredBookings
            .filter(
                isRefundedRevenueBooking
            );


    const ticketSubtotal =
        paid.reduce(
            (
                total,
                booking
            ) =>
                total +
                booking.subtotal,
            0
        );


    const fees =
        paid.reduce(
            (
                total,
                booking
            ) =>
                total +
                booking.convenienceFee,
            0
        );


    const bookingTotal =
        paid.reduce(
            (
                total,
                booking
            ) =>
                total +
                booking.total,
            0
        );


    const tickets =
        paid.reduce(
            (
                total,
                booking
            ) =>
                total +
                booking.seats.length,
            0
        );


    const refunded =
        refunds.reduce(
            (
                total,
                booking
            ) =>
                total +
                booking.subtotal,
            0
        );


    const averageBooking =
        paid.length
            ? bookingTotal /
                paid.length
            : 0;


    const averageTicket =
        tickets
            ? ticketSubtotal /
                tickets
            : 0;


    setRevenueText(
        "revenueTicketSubtotal",
        formatRevenueCurrency(
            ticketSubtotal
        )
    );


    setRevenueText(
        "revenueConvenienceFees",
        formatRevenueCurrency(
            fees
        )
    );


    setRevenueText(
        "revenueAverageBooking",
        formatRevenueCurrency(
            averageBooking
        )
    );


    setRevenueText(
        "revenueAverageTicket",
        formatRevenueCurrency(
            averageTicket
        )
    );


    setRevenueText(
        "revenueRefundDetail",
        formatRevenueCurrency(
            refunded
        )
    );

}


/* =========================================================
   24. BUILD EVENT BREAKDOWN
   ========================================================= */

function buildRevenueEventBreakdown(
    bookings
) {

    const map =
        new Map();


    bookings.forEach(
        (booking) => {

            const key =
                booking.eventId ||
                booking.eventTitle;


            if (
                !map.has(
                    key
                )
            ) {

                map.set(
                    key,
                    {

                        eventId:
                            booking.eventId,

                        eventTitle:
                            booking.eventTitle,

                        bookings:
                            0,

                        tickets:
                            0,

                        revenue:
                            0,

                        refunded:
                            0

                    }
                );

            }


            const record =
                map.get(
                    key
                );


            if (
                isRecognizedRevenueBooking(
                    booking
                )
            ) {

                record.bookings +=
                    1;


                record.tickets +=
                    booking.seats.length;


                record.revenue +=
                    booking.subtotal;

            }


            if (
                isRefundedRevenueBooking(
                    booking
                )
            ) {

                record.refunded +=
                    booking.subtotal;

            }

        }
    );


    return [
        ...map.values()
    ]
        .filter(
            (item) =>
                item.revenue >
                    0 ||
                item.refunded >
                    0
        )
        .sort(
            (
                first,
                second
            ) =>
                second.revenue -
                first.revenue
        );

}


/* =========================================================
   25. EVENT BREAKDOWN
   ========================================================= */

function renderRevenueEventBreakdown() {

    const body =
        document.getElementById(
            "revenueEventTableBody"
        );


    const empty =
        document.getElementById(
            "revenueEventEmpty"
        );


    const wrapper =
        document.querySelector(
            ".organiser-revenue-breakdown-panel .organiser-revenue-table-wrapper"
        );


    if (
        !body ||
        !empty
    ) {

        return;

    }


    const records =
        organiserRevenueState
            .eventBreakdown;


    if (!records.length) {

        body.innerHTML =
            "";


        if (wrapper) {

            wrapper.hidden =
                true;

        }


        empty.hidden =
            false;


        refreshRevenueIcons();

        return;

    }


    if (wrapper) {

        wrapper.hidden =
            false;

    }


    empty.hidden =
        true;


    const totalRevenue =
        records.reduce(
            (
                total,
                record
            ) =>
                total +
                record.revenue,
            0
        );


    body.innerHTML =
        records
            .map(
                (record) => {

                    const share =
                        totalRevenue
                            ? Math.round(
                                (
                                    record.revenue /
                                    totalRevenue
                                ) *
                                100
                            )
                            : 0;


                    return `

                        <tr>


                            <td>

                                <div class="organiser-revenue-event-cell">

                                    <div>

                                        <i data-lucide="calendar-range"></i>

                                    </div>


                                    <span>

                                        <strong>
                                            ${
                                                escapeRevenueHTML(
                                                    record.eventTitle
                                                )
                                            }
                                        </strong>

                                        <small>
                                            Event revenue
                                        </small>

                                    </span>

                                </div>

                            </td>


                            <td>

                                <strong class="organiser-revenue-table-value">

                                    ${
                                        formatRevenueNumber(
                                            record.bookings
                                        )
                                    }

                                </strong>

                            </td>


                            <td>

                                <strong class="organiser-revenue-table-value">

                                    ${
                                        formatRevenueNumber(
                                            record.tickets
                                        )
                                    }

                                </strong>

                            </td>


                            <td>

                                <strong class="organiser-revenue-money positive">

                                    ${
                                        formatRevenueCurrency(
                                            record.revenue
                                        )
                                    }

                                </strong>

                            </td>


                            <td>

                                <strong class="organiser-revenue-money refund">

                                    ${
                                        formatRevenueCurrency(
                                            record.refunded
                                        )
                                    }

                                </strong>

                            </td>


                            <td>

                                <div class="organiser-revenue-share">

                                    <div>

                                        <span
                                            style="width:${share}%"
                                        ></span>

                                    </div>


                                    <strong>
                                        ${share}%
                                    </strong>

                                </div>

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");


    refreshRevenueIcons();

}


/* =========================================================
   26. REVENUE TREND
   ========================================================= */

function renderRevenueTrend() {

    const container =
        document.getElementById(
            "revenueTrendChart"
        );


    if (!container) {

        return;

    }


    const data =
        buildRevenueTrendData();


    if (!data.length) {

        container.innerHTML = `

            <div class="organiser-revenue-chart-empty">

                <i data-lucide="chart-column"></i>

                <p>
                    No paid revenue in this period.
                </p>

            </div>

        `;


        refreshRevenueIcons();

        return;

    }


    const maximum =
        Math.max(
            ...data.map(
                (item) =>
                    item.amount
            ),
            1
        );


    container.innerHTML =
        data
            .map(
                (item) => {

                    const height =
                        item.amount
                            ? Math.max(
                                8,
                                Math.round(
                                    (
                                        item.amount /
                                        maximum
                                    ) *
                                    100
                                )
                            )
                            : 3;


                    return `

                        <div class="organiser-revenue-chart-column">


                            <div class="organiser-revenue-chart-value">

                                ${
                                    item.amount
                                        ? formatRevenueCompactCurrency(
                                            item.amount
                                        )
                                        : "₹0"
                                }

                            </div>


                            <div class="organiser-revenue-chart-bar-track">

                                <span
                                    class="organiser-revenue-chart-bar"
                                    style="height:${height}%"
                                ></span>

                            </div>


                            <small>
                                ${
                                    escapeRevenueHTML(
                                        item.label
                                    )
                                }
                            </small>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   27. TREND DATA
   ========================================================= */

function buildRevenueTrendData() {

    const paid =
        organiserRevenueState
            .revenueBookings;


    if (!paid.length) {

        return [];

    }


    /*
       Show up to 7 most recent revenue dates.
    */

    const map =
        new Map();


    paid.forEach(
        (booking) => {

            const date =
                new Date(
                    booking.createdAt
                );


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return;

            }


            const key =
                `${date.getFullYear()}-${
                    String(
                        date.getMonth() +
                        1
                    ).padStart(
                        2,
                        "0"
                    )
                }-${
                    String(
                        date.getDate()
                    ).padStart(
                        2,
                        "0"
                    )
                }`;


            map.set(
                key,
                (
                    map.get(
                        key
                    ) ||
                    0
                ) +
                booking.subtotal
            );

        }
    );


    return [
        ...map.entries()
    ]
        .sort(
            (
                first,
                second
            ) =>
                first[0]
                    .localeCompare(
                        second[0]
                    )
        )
        .slice(
            -7
        )
        .map(
            ([
                date,
                amount
            ]) => ({

                date,

                amount,

                label:
                    formatRevenueShortDate(
                        date
                    )

            })
        );

}


/* =========================================================
   28. TRANSACTIONS
   ========================================================= */

function renderRevenueTransactions() {

    const body =
        document.getElementById(
            "revenueTransactionTableBody"
        );


    const empty =
        document.getElementById(
            "revenueTransactionEmpty"
        );


    const wrapper =
        document.querySelector(
            ".organiser-revenue-transactions-panel .organiser-revenue-table-wrapper"
        );


    if (
        !body ||
        !empty
    ) {

        return;

    }


    let transactions =
        organiserRevenueState
            .filteredBookings
            .filter(
                (booking) => {

                    return (
                        isRecognizedRevenueBooking(
                            booking
                        ) ||
                        isRefundedRevenueBooking(
                            booking
                        )
                    );

                }
            );


    /*
       SEARCH
    */

    if (
        organiserRevenueState.search
    ) {

        transactions =
            transactions.filter(
                (booking) => {

                    const searchable =
                        [

                            booking.reference,

                            booking.customer.name,

                            booking.customer.email,

                            booking.eventTitle,

                            booking.showReference,

                            booking.venueName,

                            booking.paymentReference

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        organiserRevenueState.search
                    );

                }
            );

    }


    transactions =
        sortRevenueTransactions(
            transactions
        );


    if (!transactions.length) {

        body.innerHTML =
            "";


        if (wrapper) {

            wrapper.hidden =
                true;

        }


        empty.hidden =
            false;


        refreshRevenueIcons();

        return;

    }


    if (wrapper) {

        wrapper.hidden =
            false;

    }


    empty.hidden =
        true;


    body.innerHTML =
        transactions
            .map(
                createRevenueTransactionHTML
            )
            .join("");


    refreshRevenueIcons();

}


/* =========================================================
   29. TRANSACTION ROW
   ========================================================= */

function createRevenueTransactionHTML(
    booking
) {

    const refunded =
        isRefundedRevenueBooking(
            booking
        );


    const payment =
        refunded
            ? {
                label:
                    "Refunded",

                className:
                    "refunded"
            }
            : {
                label:
                    "Success",

                className:
                    "success"
            };


    return `

        <tr>


            <td>

                <div class="organiser-revenue-reference">

                    <strong>

                        ${
                            escapeRevenueHTML(
                                booking.reference
                            )
                        }

                    </strong>


                    <small>

                        ${
                            escapeRevenueHTML(
                                formatRevenueDateTime(
                                    booking.createdAt
                                )
                            )
                        }

                    </small>

                </div>

            </td>



            <td>

                <div class="organiser-revenue-customer">

                    <div>

                        ${
                            escapeRevenueHTML(
                                createRevenueInitials(
                                    booking.customer.name
                                )
                            )
                        }

                    </div>


                    <span>

                        <strong>

                            ${
                                escapeRevenueHTML(
                                    booking.customer.name
                                )
                            }

                        </strong>


                        <small>

                            ${
                                escapeRevenueHTML(
                                    booking.customer.email
                                )
                            }

                        </small>

                    </span>

                </div>

            </td>



            <td>

                <div class="organiser-revenue-transaction-event">

                    <strong>

                        ${
                            escapeRevenueHTML(
                                booking.eventTitle
                            )
                        }

                    </strong>


                    <small>

                        ${
                            escapeRevenueHTML(
                                booking.showReference ||
                                booking.venueName
                            )
                        }

                    </small>

                </div>

            </td>



            <td>

                <strong class="organiser-revenue-table-value">

                    ${
                        formatRevenueNumber(
                            booking.seats.length
                        )
                    }

                </strong>

            </td>



            <td>

                <div class="organiser-revenue-transaction-amount">

                    <strong class="${
                        refunded
                            ? "refund"
                            : "positive"
                    }">

                        ${
                            refunded
                                ? `-${
                                    formatRevenueCurrency(
                                        booking.subtotal
                                    )
                                }`
                                : formatRevenueCurrency(
                                    booking.subtotal
                                )
                        }

                    </strong>


                    <small>

                        ${
                            refunded
                                ? "Refunded value"
                                : `+${
                                    formatRevenueCurrency(
                                        booking.convenienceFee
                                    )
                                } fee`
                        }

                    </small>

                </div>

            </td>



            <td>

                <span
                    class="
                        organiser-payment-status
                        ${payment.className}
                    "
                >

                    ${
                        payment.label
                    }

                </span>

            </td>



            <td>

                <a
                    href="./bookings.html?search=${
                        encodeURIComponent(
                            booking.reference
                        )
                    }"
                    class="organiser-revenue-view-booking"
                >

                    <i data-lucide="eye"></i>

                    View

                </a>

            </td>

        </tr>

    `;

}


/* =========================================================
   30. SORT TRANSACTIONS
   ========================================================= */

function sortRevenueTransactions(
    transactions
) {

    const result = [
        ...transactions
    ];


    switch (
        organiserRevenueState.sort
    ) {

        case "OLDEST":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getRevenueTimestamp(
                        first.createdAt
                    ) -
                    getRevenueTimestamp(
                        second.createdAt
                    )
            );


        case "AMOUNT_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.subtotal -
                    first.subtotal
            );


        case "AMOUNT_ASC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    first.subtotal -
                    second.subtotal
            );


        case "NEWEST":
        default:

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getRevenueTimestamp(
                        second.createdAt
                    ) -
                    getRevenueTimestamp(
                        first.createdAt
                    )
            );

    }

}


/* =========================================================
   31. CLEAR FILTERS
   ========================================================= */

function clearRevenueFilters() {

    organiserRevenueState.period =
        "ALL";


    organiserRevenueState.eventFilter =
        "ALL";


    organiserRevenueState.showFilter =
        "ALL";


    organiserRevenueState.search =
        "";


    organiserRevenueState.sort =
        "NEWEST";


    document
        .querySelectorAll(
            "[data-revenue-period]"
        )
        .forEach(
            (button) => {

                const active =
                    button.dataset
                        .revenuePeriod ===
                    "ALL";


                button.classList.toggle(
                    "active",
                    active
                );


                button.setAttribute(
                    "aria-selected",
                    String(
                        active
                    )
                );

            }
        );


    const eventSelect =
        document.getElementById(
            "revenueEventFilter"
        );


    if (eventSelect) {

        eventSelect.value =
            "ALL";

    }


    updateRevenueShowFilterOptions();


    const showSelect =
        document.getElementById(
            "revenueShowFilter"
        );


    if (showSelect) {

        showSelect.value =
            "ALL";

    }


    const search =
        document.getElementById(
            "revenueSearch"
        );


    if (search) {

        search.value =
            "";

    }


    const sort =
        document.getElementById(
            "revenueSort"
        );


    if (sort) {

        sort.value =
            "NEWEST";

    }


    applyRevenueFilters();

}


/* =========================================================
   32. CLEAR BUTTON
   ========================================================= */

function updateRevenueClearButton() {

    const active =
        organiserRevenueState.period !==
            "ALL" ||
        organiserRevenueState.eventFilter !==
            "ALL" ||
        organiserRevenueState.showFilter !==
            "ALL" ||
        Boolean(
            organiserRevenueState.search
        ) ||
        organiserRevenueState.sort !==
            "NEWEST";


    const button =
        document.getElementById(
            "clearRevenueFilters"
        );


    if (button) {

        button.hidden =
            !active;

    }

}


/* =========================================================
   33. SIDEBAR COUNTS
   ========================================================= */

function renderRevenueSidebarCounts() {

    const eventIds =
        new Set(
            organiserRevenueState
                .bookings
                .map(
                    (booking) =>
                        booking.eventId
                )
                .filter(Boolean)
        );


    const showIds =
        new Set(
            organiserRevenueState
                .bookings
                .map(
                    (booking) =>
                        booking.showId
                )
                .filter(Boolean)
        );


    setRevenueText(
        "sidebarEventCount",
        eventIds.size
    );


    setRevenueText(
        "sidebarShowCount",
        showIds.size
    );

}


/* =========================================================
   34. NORMALIZE BOOKING STATUS
   ========================================================= */

function normalizeRevenueBookingStatus(
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
   35. PAYMENT STATUS
   ========================================================= */

function normalizeRevenuePaymentStatus(
    value
) {

    const status =
        String(
            value ||
            "SUCCESS"
        )
            .trim()
            .toUpperCase();


    if (
        [
            "REFUNDED",
            "REFUND"
        ].includes(
            status
        )
    ) {

        return "REFUNDED";

    }


    if (
        [
            "FAILED",
            "FAILURE"
        ].includes(
            status
        )
    ) {

        return "FAILED";

    }


    if (
        [
            "PENDING",
            "CREATED",
            "PROCESSING"
        ].includes(
            status
        )
    ) {

        return "PENDING";

    }


    return "SUCCESS";

}


/* =========================================================
   36. DATE TIME
   ========================================================= */

function formatRevenueDateTime(
    value
) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {

            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"

        }
    ).format(
        date
    );

}


/* =========================================================
   37. SHORT DATE
   ========================================================= */

function formatRevenueShortDate(
    value
) {

    const date =
        new Date(
            `${value}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {

            day:
                "2-digit",

            month:
                "short"

        }
    ).format(
        date
    );

}


/* =========================================================
   38. TIMESTAMP
   ========================================================= */

function getRevenueTimestamp(
    value
) {

    const timestamp =
        new Date(
            value
        ).getTime();


    return Number.isFinite(
        timestamp
    )
        ? timestamp
        : 0;

}


/* =========================================================
   39. CURRENCY
   ========================================================= */

function formatRevenueCurrency(
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
        Math.round(
            amount
        )
    );

}


/* =========================================================
   40. COMPACT CURRENCY
   ========================================================= */

function formatRevenueCompactCurrency(
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


    return formatRevenueCurrency(
        amount
    );

}


/* =========================================================
   41. NUMBER
   ========================================================= */

function formatRevenueNumber(
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
   42. INITIALS
   ========================================================= */

function createRevenueInitials(
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
            parts.length -
            1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   43. TEXT
   ========================================================= */

function setRevenueText(
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
   44. ESCAPE HTML
   ========================================================= */

function escapeRevenueHTML(
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
   45. TOAST
   ========================================================= */

function showRevenueToast(
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
   46. ICONS
   ========================================================= */

function refreshRevenueIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   47. PUBLIC API
   ========================================================= */

window.SKYRA_ORGANISER_REVENUE_PAGE = {

    getBookings:
        () =>
            organiserRevenueState
                .bookings
                .map(
                    (booking) => ({
                        ...booking,

                        customer: {
                            ...booking.customer
                        },

                        seats:
                            booking.seats.map(
                                (seat) => ({
                                    ...seat
                                })
                            )

                    })
                ),

    getRevenueBookings:
        () =>
            organiserRevenueState
                .revenueBookings
                .map(
                    (booking) => ({
                        ...booking
                    })
                ),

    getEventBreakdown:
        () =>
            organiserRevenueState
                .eventBreakdown
                .map(
                    (record) => ({
                        ...record
                    })
                ),

    refresh:
        loadRevenueData

};


/* =========================================================
   END SKYRA ORGANISER REVENUE
   ========================================================= */