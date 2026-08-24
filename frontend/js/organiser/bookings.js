/* =========================================================
   SKYRA - ORGANISER BOOKINGS
   File:
   frontend/js/organiser/bookings.js

   Phase 21:
   - Real organiser bookings API
   - JWT-scoped organiser data
   - Booking summary
   - Show filter
   - Status filters
   - Search
   - Sorting
   - Booking detail modal
   - URL ?show=<showId> support

   Future backend:
   GET /api/organiser/bookings
   GET /api/bookings/:id
   ========================================================= */

"use strict";


/* =========================================================
   1-2. BACKEND-ONLY BOOKING DATA
   ========================================================= */

/* =========================================================
   3. STATE
   ========================================================= */

const organiserBookingsState = {

    bookings:
        [],

    filteredBookings:
        [],

    statusFilter:
        "ALL",

    showFilter:
        "ALL",

    search:
        "",

    sort:
        "NEWEST",

    selectedBookingId:
        null,

    loading:
        false

};


/* =========================================================
   4. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeOrganiserBookingsPage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

async function initializeOrganiserBookingsPage() {

    initializeOrganiserBookingUser();

    initializeOrganiserBookingNavigation();

    initializeOrganiserBookingControls();

    initializeOrganiserBookingTopSearch();

    initializeBookingDetailModal();


    await loadOrganiserBookings();


    applyOrganiserBookingURLParameters();

    refreshOrganiserBookingIcons();

}


/* =========================================================
   6. LOAD BOOKINGS
   ========================================================= */

async function loadOrganiserBookings() {

    organiserBookingsState.loading =
        true;


    try {

        let bookings =
            await fetchOrganiserBookingsSource();


        bookings =
            bookings
                .map(
                    normalizeOrganiserBooking
                )
                .filter(
                    (booking) =>
                        Boolean(
                            booking.id
                        )
                );


        organiserBookingsState.bookings =
            mergeUniqueOrganiserBookings(
                bookings
            );


        populateOrganiserBookingShowFilter();

        renderOrganiserBookingSummary();

        renderOrganiserBookingSidebarCounts();

        applyOrganiserBookingFilters();

    } catch (error) {

        console.error(
            "Unable to load organiser bookings:",
            error
        );


        organiserBookingsState.bookings =
            [];


        populateOrganiserBookingShowFilter();

        renderOrganiserBookingSummary();

        applyOrganiserBookingFilters();


        showOrganiserBookingToast(
            "Unable to load booking information.",
            "error",
            "Bookings Unavailable"
        );

    } finally {

        organiserBookingsState.loading =
            false;

    }

}


/* =========================================================
   7. BOOKING SOURCE
   ========================================================= */

async function fetchOrganiserBookingsSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getOrganiserBookings !==
            "function"
    ) {

        throw new Error(
            "Organiser bookings API client is unavailable."
        );

    }

    const response =
        await window.SKYRA_API
            .getOrganiserBookings();

    const bookings =
        response?.data?.bookings ||
        response?.bookings ||
        [];

    if (
        !Array.isArray(
            bookings
        )
    ) {

        throw new Error(
            "Organiser bookings response is invalid."
        );

    }

    return bookings;

}



/* =========================================================
   9. NORMALIZE BOOKING
   ========================================================= */

function normalizeOrganiserBooking(
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

                        seatId:
                            `seat_${seatIndex}`,

                        label:
                            seat,

                        category:
                            "Seat",

                        price:
                            0

                    };

                }


                return {

                    seatId:
                        String(
                            seat.seatId ||
                            seat.id ||
                            seat._id ||
                            `seat_${seatIndex}`
                        ),

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


    const total =
        Math.max(
            0,
            Number(
                raw.total ??
                raw.amount ??
                raw.totalAmount ??
                raw.payment?.amount ??
                0
            ) ||
            0
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

            id:
                String(
                    customer.id ||
                    customer._id ||
                    raw.userId ||
                    ""
                ),

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
                (
                    raw.showId &&
                    typeof raw.showId === "object"
                        ? (
                            raw.showId.id ||
                            raw.showId._id
                        )
                        : raw.showId
                ) ||
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

        showDate:
            raw.showDate ||
            raw.show?.date ||
            "",

        showTime:
            raw.showTime ||
            raw.show?.time ||
            "",

        seats,

        subtotal:
            Math.max(
                0,
                Number(
                    raw.subtotal ??
                    total
                ) ||
                0
            ),

        convenienceFee:
            Math.max(
                0,
                Number(
                    raw.convenienceFee ??
                    raw.fees ??
                    0
                ) ||
                0
            ),

        total,

        status:
            normalizeOrganiserBookingStatus(
                raw.status
            ),

        paymentStatus:
            normalizeOrganiserPaymentStatus(
                raw.paymentStatus ||
                raw.payment?.status
            ),

        paymentReference:
            String(
                raw.paymentReference ||
                raw.paymentId ||
                raw.payment?.reference ||
                raw.payment?._id ||
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

function mergeUniqueOrganiserBookings(
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

function initializeOrganiserBookingUser() {

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
        createOrganiserBookingInitials(
            name
        );


    setOrganiserBookingText(
        "sidebarUserName",
        name
    );


    setOrganiserBookingText(
        "sidebarUserInitials",
        initials
    );


    setOrganiserBookingText(
        "topbarUserName",
        name
    );


    setOrganiserBookingText(
        "topbarUserInitials",
        initials
    );


    setOrganiserBookingText(
        "dropdownUserName",
        name
    );


    setOrganiserBookingText(
        "dropdownUserInitials",
        initials
    );


    setOrganiserBookingText(
        "dropdownUserEmail",
        organiser.email ||
        ""
    );

}


/* =========================================================
   12. NAVIGATION
   ========================================================= */

function initializeOrganiserBookingNavigation() {

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
                    "./bookings.html";


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

function initializeOrganiserBookingControls() {

    /*
       STATUS TABS
    */

    document
        .querySelectorAll(
            "[data-booking-filter]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        organiserBookingsState.statusFilter =
                            button.dataset
                                .bookingFilter ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-booking-filter]"
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


                        applyOrganiserBookingFilters();

                    }
                );

            }
        );


    /*
       SEARCH
    */

    document
        .getElementById(
            "bookingSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                organiserBookingsState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyOrganiserBookingFilters();

            }
        );


    /*
       SHOW
    */

    document
        .getElementById(
            "bookingShowFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserBookingsState.showFilter =
                    event.target.value ||
                    "ALL";


                applyOrganiserBookingFilters();

            }
        );


    /*
       SORT
    */

    document
        .getElementById(
            "bookingSort"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserBookingsState.sort =
                    event.target.value ||
                    "NEWEST";


                applyOrganiserBookingFilters();

            }
        );


    document
        .getElementById(
            "clearBookingFilters"
        )
        ?.addEventListener(
            "click",
            clearOrganiserBookingFilters
        );


    document
        .getElementById(
            "emptyClearBookingFilters"
        )
        ?.addEventListener(
            "click",
            clearOrganiserBookingFilters
        );

}


/* =========================================================
   14. TOPBAR SEARCH
   ========================================================= */

function initializeOrganiserBookingTopSearch() {

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


                const localSearch =
                    document.getElementById(
                        "bookingSearch"
                    );


                if (localSearch) {

                    localSearch.value =
                        query;

                }


                organiserBookingsState.search =
                    query
                        .toLowerCase();


                applyOrganiserBookingFilters();

            }
        );

}


/* =========================================================
   15. POPULATE SHOW FILTER
   ========================================================= */

function populateOrganiserBookingShowFilter() {

    const select =
        document.getElementById(
            "bookingShowFilter"
        );


    if (!select) {

        return;

    }


    select.innerHTML = `

        <option value="ALL">
            All Shows
        </option>

    `;


    const shows =
        new Map();


    organiserBookingsState
        .bookings
        .forEach(
            (booking) => {

                if (
                    booking.showId &&
                    !shows.has(
                        booking.showId
                    )
                ) {

                    shows.set(
                        booking.showId,
                        `${
                            booking.eventTitle
                        } · ${
                            formatOrganiserBookingDate(
                                booking.showDate
                            )
                        }`
                    );

                }

            }
        );


    [
        ...shows.entries()
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

}


/* =========================================================
   16. URL PARAMETERS
   ========================================================= */

function applyOrganiserBookingURLParameters() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const showId =
        params.get(
            "show"
        );


    const search =
        params.get(
            "search"
        );


    if (
        showId &&
        organiserBookingsState
            .bookings
            .some(
                (booking) =>
                    booking.showId ===
                    showId
            )
    ) {

        organiserBookingsState.showFilter =
            showId;


        const select =
            document.getElementById(
                "bookingShowFilter"
            );


        if (select) {

            select.value =
                showId;

        }

    }


    if (search) {

        organiserBookingsState.search =
            search
                .trim()
                .toLowerCase();


        const input =
            document.getElementById(
                "bookingSearch"
            );


        if (input) {

            input.value =
                search;

        }

    }


    applyOrganiserBookingFilters();

}


/* =========================================================
   17. APPLY FILTERS
   ========================================================= */

function applyOrganiserBookingFilters() {

    const {
        statusFilter,
        showFilter,
        search,
        sort
    } =
        organiserBookingsState;


    let bookings =
        organiserBookingsState
            .bookings
            .filter(
                (booking) => {

                    /*
                       STATUS
                    */

                    if (
                        statusFilter !==
                            "ALL" &&
                        booking.status !==
                            statusFilter
                    ) {

                        return false;

                    }


                    /*
                       SHOW
                    */

                    if (
                        showFilter !==
                            "ALL" &&
                        booking.showId !==
                            showFilter
                    ) {

                        return false;

                    }


                    /*
                       SEARCH
                    */

                    if (!search) {

                        return true;

                    }


                    const searchable =
                        [

                            booking.reference,

                            booking.customer.name,

                            booking.customer.email,

                            booking.eventTitle,

                            booking.showReference,

                            booking.venueName,

                            booking.venueCity,

                            booking.paymentReference,

                            booking.seats
                                .map(
                                    (seat) =>
                                        seat.label
                                )
                                .join(" ")

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        search
                    );

                }
            );


    bookings =
        sortOrganiserBookings(
            bookings,
            sort
        );


    organiserBookingsState.filteredBookings =
        bookings;


    renderOrganiserBookings();

    renderOrganiserBookingResultCount();

    updateOrganiserBookingClearButton();

}


/* =========================================================
   18. SORT
   ========================================================= */

function sortOrganiserBookings(
    bookings,
    sort
) {

    const result = [
        ...bookings
    ];


    switch (sort) {

        case "OLDEST":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getOrganiserBookingTimestamp(
                        first.createdAt
                    ) -
                    getOrganiserBookingTimestamp(
                        second.createdAt
                    )
            );


        case "AMOUNT_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.total -
                    first.total
            );


        case "AMOUNT_ASC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    first.total -
                    second.total
            );


        case "NEWEST":
        default:

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getOrganiserBookingTimestamp(
                        second.createdAt
                    ) -
                    getOrganiserBookingTimestamp(
                        first.createdAt
                    )
            );

    }

}


/* =========================================================
   19. RENDER BOOKINGS
   ========================================================= */

function renderOrganiserBookings() {

    const body =
        document.getElementById(
            "organiserBookingsTableBody"
        );


    const empty =
        document.getElementById(
            "organiserBookingsEmpty"
        );


    const tableWrapper =
        document.querySelector(
            ".organiser-bookings-table-wrapper"
        );


    if (
        !body ||
        !empty
    ) {

        return;

    }


    const bookings =
        organiserBookingsState
            .filteredBookings;


    if (!bookings.length) {

        body.innerHTML =
            "";


        if (tableWrapper) {

            tableWrapper.hidden =
                true;

        }


        empty.hidden =
            false;


        refreshOrganiserBookingIcons();

        return;

    }


    if (tableWrapper) {

        tableWrapper.hidden =
            false;

    }


    empty.hidden =
        true;


    body.innerHTML =
        bookings
            .map(
                createOrganiserBookingRowHTML
            )
            .join("");


    initializeRenderedOrganiserBookingActions();

    refreshOrganiserBookingIcons();

}


/* =========================================================
   20. BOOKING ROW
   ========================================================= */

function createOrganiserBookingRowHTML(
    booking
) {

    const status =
        getOrganiserBookingStatusVisual(
            booking.status
        );


    const seats =
        booking.seats;


    const visibleSeats =
        seats
            .slice(
                0,
                2
            )
            .map(
                (seat) =>
                    seat.label
            )
            .join(", ");


    const remainingSeats =
        Math.max(
            0,
            seats.length -
            2
        );


    const showLocation =
        [
            booking.venueName,
            booking.venueCity
        ]
            .filter(Boolean)
            .join(", ");


    return `

        <tr>


            <!-- BOOKING -->

            <td>

                <div class="organiser-booking-reference-cell">

                    <div>

                        <i data-lucide="ticket-check"></i>

                    </div>


                    <span>

                        <strong>
                            ${
                                escapeOrganiserBookingHTML(
                                    booking.reference
                                )
                            }
                        </strong>

                        <small>
                            ${
                                escapeOrganiserBookingHTML(
                                    formatOrganiserBookingDateTime(
                                        booking.createdAt
                                    )
                                )
                            }
                        </small>

                    </span>

                </div>

            </td>



            <!-- CUSTOMER -->

            <td>

                <div class="organiser-booking-customer">

                    <div class="organiser-booking-customer-avatar">

                        ${
                            escapeOrganiserBookingHTML(
                                createOrganiserBookingInitials(
                                    booking.customer.name
                                )
                            )
                        }

                    </div>


                    <span>

                        <strong>
                            ${
                                escapeOrganiserBookingHTML(
                                    booking.customer.name
                                )
                            }
                        </strong>

                        <small>
                            ${
                                escapeOrganiserBookingHTML(
                                    booking.customer.email
                                )
                            }
                        </small>

                    </span>

                </div>

            </td>



            <!-- EVENT -->

            <td>

                <div class="organiser-booking-event">

                    <strong>
                        ${
                            escapeOrganiserBookingHTML(
                                booking.eventTitle
                            )
                        }
                    </strong>


                    <span>

                        <i data-lucide="map-pin"></i>

                        ${
                            escapeOrganiserBookingHTML(
                                showLocation
                            )
                        }

                    </span>


                    <small>

                        ${
                            escapeOrganiserBookingHTML(
                                formatOrganiserBookingDate(
                                    booking.showDate
                                )
                            )
                        }

                        ·

                        ${
                            escapeOrganiserBookingHTML(
                                formatOrganiserBookingTime(
                                    booking.showTime
                                )
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- SEATS -->

            <td>

                <div class="organiser-booking-seat-cell">

                    <strong>

                        ${
                            seats.length
                        }

                        ${
                            seats.length ===
                            1
                                ? "seat"
                                : "seats"
                        }

                    </strong>


                    <small>

                        ${
                            escapeOrganiserBookingHTML(
                                visibleSeats ||
                                "—"
                            )
                        }

                        ${
                            remainingSeats
                                ? ` +${remainingSeats}`
                                : ""
                        }

                    </small>

                </div>

            </td>



            <!-- AMOUNT -->

            <td>

                <div class="organiser-booking-amount">

                    <strong>
                        ${
                            formatOrganiserBookingCurrency(
                                booking.total
                            )
                        }
                    </strong>

                    <small>
                        ${
                            escapeOrganiserBookingHTML(
                                formatOrganiserPaymentStatus(
                                    booking.paymentStatus
                                )
                            )
                        }
                    </small>

                </div>

            </td>



            <!-- STATUS -->

            <td>

                <span
                    class="
                        organiser-booking-status
                        ${status.className}
                    "
                >

                    <i
                        data-lucide="${
                            status.icon
                        }"
                    ></i>

                    ${
                        escapeOrganiserBookingHTML(
                            status.label
                        )
                    }

                </span>

            </td>



            <!-- ACTION -->

            <td>

                <button
                    type="button"
                    class="organiser-booking-view-button"
                    data-view-booking="${
                        escapeOrganiserBookingAttribute(
                            booking.id
                        )
                    }"
                    aria-label="View booking ${
                        escapeOrganiserBookingAttribute(
                            booking.reference
                        )
                    }"
                >

                    <i data-lucide="eye"></i>

                    <span>
                        View
                    </span>

                </button>

            </td>

        </tr>

    `;

}


/* =========================================================
   21. INITIALIZE ROW ACTIONS
   ========================================================= */

function initializeRenderedOrganiserBookingActions() {

    document
        .querySelectorAll(
            "[data-view-booking]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openOrganiserBookingDetail(
                            button.dataset
                                .viewBooking
                        );

                    }
                );

            }
        );

}


/* =========================================================
   22. SUMMARY
   ========================================================= */

function renderOrganiserBookingSummary() {

    const bookings =
        organiserBookingsState
            .bookings;


    const confirmed =
        bookings.filter(
            (booking) =>
                booking.status ===
                "CONFIRMED"
        );


    const completed =
        bookings.filter(
            (booking) =>
                booking.status ===
                "COMPLETED"
        );


    const revenueBookings = [

        ...confirmed,
        ...completed

    ];


    const ticketCount =
        revenueBookings
            .reduce(
                (
                    total,
                    booking
                ) =>
                    total +
                    booking.seats.length,
                0
            );


    const revenue =
        revenueBookings
            .reduce(
                (
                    total,
                    booking
                ) =>
                    total +
                    booking.total,
                0
            );


    setOrganiserBookingText(
        "bookingTotalCount",
        formatOrganiserBookingNumber(
            bookings.length
        )
    );


    setOrganiserBookingText(
        "bookingConfirmedCount",
        formatOrganiserBookingNumber(
            confirmed.length
        )
    );


    setOrganiserBookingText(
        "bookingTicketCount",
        formatOrganiserBookingNumber(
            ticketCount
        )
    );


    setOrganiserBookingText(
        "bookingRevenueTotal",
        formatOrganiserBookingCompactCurrency(
            revenue
        )
    );

}


/* =========================================================
   23. SIDEBAR COUNTS
   ========================================================= */

function renderOrganiserBookingSidebarCounts() {

    const bookings =
        organiserBookingsState
            .bookings;


    const eventIds =
        new Set(
            bookings
                .map(
                    (booking) =>
                        booking.eventId
                )
                .filter(Boolean)
        );


    const showIds =
        new Set(
            bookings
                .map(
                    (booking) =>
                        booking.showId
                )
                .filter(Boolean)
        );


    setOrganiserBookingText(
        "sidebarEventCount",
        eventIds.size
    );


    setOrganiserBookingText(
        "sidebarShowCount",
        showIds.size
    );

}


/* =========================================================
   24. RESULT COUNT
   ========================================================= */

function renderOrganiserBookingResultCount() {

    setOrganiserBookingText(
        "bookingResultCount",
        organiserBookingsState
            .filteredBookings
            .length
    );

}


/* =========================================================
   25. CLEAR BUTTON
   ========================================================= */

function updateOrganiserBookingClearButton() {

    const active =
        organiserBookingsState.statusFilter !==
            "ALL" ||
        organiserBookingsState.showFilter !==
            "ALL" ||
        Boolean(
            organiserBookingsState.search
        ) ||
        organiserBookingsState.sort !==
            "NEWEST";


    const button =
        document.getElementById(
            "clearBookingFilters"
        );


    if (button) {

        button.hidden =
            !active;

    }

}


/* =========================================================
   26. CLEAR FILTERS
   ========================================================= */

function clearOrganiserBookingFilters() {

    organiserBookingsState.statusFilter =
        "ALL";


    organiserBookingsState.showFilter =
        "ALL";


    organiserBookingsState.search =
        "";


    organiserBookingsState.sort =
        "NEWEST";


    document
        .querySelectorAll(
            "[data-booking-filter]"
        )
        .forEach(
            (button) => {

                const active =
                    button.dataset
                        .bookingFilter ===
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


    const search =
        document.getElementById(
            "bookingSearch"
        );


    if (search) {

        search.value =
            "";

    }


    const showFilter =
        document.getElementById(
            "bookingShowFilter"
        );


    if (showFilter) {

        showFilter.value =
            "ALL";

    }


    const sort =
        document.getElementById(
            "bookingSort"
        );


    if (sort) {

        sort.value =
            "NEWEST";

    }


    applyOrganiserBookingFilters();

}


/* =========================================================
   27. DETAIL MODAL INITIALIZATION
   ========================================================= */

function initializeBookingDetailModal() {

    document
        .getElementById(
            "closeBookingDetailModal"
        )
        ?.addEventListener(
            "click",
            closeOrganiserBookingDetail
        );


    document
        .getElementById(
            "closeBookingDetailButton"
        )
        ?.addEventListener(
            "click",
            closeOrganiserBookingDetail
        );


    document
        .getElementById(
            "bookingDetailModal"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.id ===
                    "bookingDetailModal"
                ) {

                    closeOrganiserBookingDetail();

                }

            }
        );

}


/* =========================================================
   28. OPEN DETAIL
   ========================================================= */

async function openOrganiserBookingDetail(
    bookingId
) {

    let booking =
        getOrganiserBookingById(
            bookingId
        );

    if (
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .getOrganiserBooking ===
            "function"
    ) {

        try {

            const response =
                await window.SKYRA_API
                    .getOrganiserBooking(
                        bookingId
                    );

            const rawBooking =
                response?.data?.booking ||
                response?.booking ||
                null;

            if (rawBooking) {

                booking =
                    normalizeOrganiserBooking(
                        rawBooking
                    );

                const index =
                    organiserBookingsState
                        .bookings
                        .findIndex(
                            (item) =>
                                item.id === booking.id
                        );

                if (index >= 0) {

                    organiserBookingsState
                        .bookings[index] =
                        booking;

                }

            }

        } catch (error) {

            console.error(
                "Unable to load organiser booking detail:",
                error
            );

            if (!booking) {

                showOrganiserBookingToast(
                    error?.message ||
                    "Unable to load booking detail.",
                    "error",
                    "Booking Unavailable"
                );

                return;

            }

        }

    }

    if (!booking) {

        return;

    }

    organiserBookingsState.selectedBookingId =
        bookingId;

    const status =
        getOrganiserBookingStatusVisual(
            booking.status
        );

    const payment =
        getOrganiserPaymentStatusVisual(
            booking.paymentStatus
        );

    setOrganiserBookingText(
        "bookingDetailModalTitle",
        booking.reference
    );

    setOrganiserBookingText(
        "bookingDetailReference",
        `Booked ${
            formatOrganiserBookingDateTime(
                booking.createdAt
            )
        }`
    );

    const statusElement =
        document.getElementById(
            "bookingDetailStatus"
        );

    if (statusElement) {

        statusElement.className =
            `organiser-booking-status ${
                status.className
            }`;

        statusElement.textContent =
            status.label;

    }

    const paymentElement =
        document.getElementById(
            "bookingDetailPaymentStatus"
        );

    if (paymentElement) {

        paymentElement.className =
            `organiser-payment-status ${
                payment.className
            }`;

        paymentElement.textContent =
            payment.label;

    }

    setOrganiserBookingText(
        "bookingDetailAmount",
        formatOrganiserBookingCurrency(
            booking.total
        )
    );

    setOrganiserBookingText(
        "bookingDetailCustomer",
        booking.customer.name
    );

    setOrganiserBookingText(
        "bookingDetailEmail",
        booking.customer.email ||
        "—"
    );

    setOrganiserBookingText(
        "bookingDetailEvent",
        booking.eventTitle
    );

    setOrganiserBookingText(
        "bookingDetailVenue",
        [
            booking.venueName,
            booking.venueCity
        ]
            .filter(Boolean)
            .join(", ")
    );

    setOrganiserBookingText(
        "bookingDetailDate",
        formatOrganiserBookingDate(
            booking.showDate
        )
    );

    setOrganiserBookingText(
        "bookingDetailTime",
        formatOrganiserBookingTime(
            booking.showTime
        )
    );

    setOrganiserBookingText(
        "bookingDetailPaymentReference",
        booking.paymentReference
    );

    setOrganiserBookingText(
        "bookingDetailCreatedAt",
        formatOrganiserBookingDateTime(
            booking.createdAt
        )
    );

    renderOrganiserBookingDetailSeats(
        booking.seats
    );

    const modal =
        document.getElementById(
            "bookingDetailModal"
        );

    if (modal) {

        modal.hidden =
            false;

    }

    refreshOrganiserBookingIcons();

}

/* =========================================================
   29. DETAIL SEATS
   ========================================================= */

function renderOrganiserBookingDetailSeats(
    seats
) {

    const container =
        document.getElementById(
            "bookingDetailSeats"
        );


    if (!container) {

        return;

    }


    if (
        !Array.isArray(
            seats
        ) ||
        !seats.length
    ) {

        container.innerHTML = `

            <span class="organiser-booking-detail-no-seats">
                Seat information unavailable
            </span>

        `;


        return;

    }


    container.innerHTML =
        seats
            .map(
                (seat) => `

                    <div class="organiser-booking-detail-seat">

                        <div>

                            <i data-lucide="armchair"></i>

                        </div>


                        <span>

                            <strong>
                                ${
                                    escapeOrganiserBookingHTML(
                                        seat.label
                                    )
                                }
                            </strong>

                            <small>
                                ${
                                    escapeOrganiserBookingHTML(
                                        seat.category
                                    )
                                }
                            </small>

                        </span>


                        <strong>

                            ${
                                formatOrganiserBookingCurrency(
                                    seat.price
                                )
                            }

                        </strong>

                    </div>

                `
            )
            .join("");

}


/* =========================================================
   30. CLOSE DETAIL
   ========================================================= */

function closeOrganiserBookingDetail() {

    organiserBookingsState.selectedBookingId =
        null;


    const modal =
        document.getElementById(
            "bookingDetailModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   31. GET BOOKING
   ========================================================= */

function getOrganiserBookingById(
    bookingId
) {

    return organiserBookingsState
        .bookings
        .find(
            (booking) =>
                booking.id ===
                bookingId
        ) ||
        null;

}


/* =========================================================
   32. BOOKING STATUS NORMALIZATION
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
   33. PAYMENT STATUS
   ========================================================= */

function normalizeOrganiserPaymentStatus(
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
   34. BOOKING STATUS VISUAL
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
                    "cancelled",

                icon:
                    "circle-x"

            };


        case "COMPLETED":

            return {

                label:
                    "Completed",

                className:
                    "completed",

                icon:
                    "circle-check-big"

            };


        case "PENDING":

            return {

                label:
                    "Pending",

                className:
                    "pending",

                icon:
                    "clock-3"

            };


        case "CONFIRMED":
        default:

            return {

                label:
                    "Confirmed",

                className:
                    "confirmed",

                icon:
                    "circle-check-big"

            };

    }

}


/* =========================================================
   35. PAYMENT VISUAL
   ========================================================= */

function getOrganiserPaymentStatusVisual(
    status
) {

    switch (status) {

        case "REFUNDED":

            return {

                label:
                    "Refunded",

                className:
                    "refunded"

            };


        case "FAILED":

            return {

                label:
                    "Failed",

                className:
                    "failed"

            };


        case "PENDING":

            return {

                label:
                    "Pending",

                className:
                    "pending"

            };


        case "SUCCESS":
        default:

            return {

                label:
                    "Success",

                className:
                    "success"

            };

    }

}


/* =========================================================
   36. PAYMENT LABEL
   ========================================================= */

function formatOrganiserPaymentStatus(
    status
) {

    return getOrganiserPaymentStatusVisual(
        status
    ).label;

}


/* =========================================================
   37. DATE
   ========================================================= */

function formatOrganiserBookingDate(
    value
) {

    if (!value) {

        return "—";

    }


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
                "short",

            year:
                "numeric"

        }
    ).format(
        date
    );

}


/* =========================================================
   38. DATE TIME
   ========================================================= */

function formatOrganiserBookingDateTime(
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
   39. TIME
   ========================================================= */

function formatOrganiserBookingTime(
    value
) {

    if (
        !/^\d{2}:\d{2}$/.test(
            String(
                value ||
                ""
            )
        )
    ) {

        return value ||
        "—";

    }


    const [
        hours,
        minutes
    ] =
        value
            .split(":")
            .map(Number);


    const period =
        hours >=
        12
            ? "PM"
            : "AM";


    const hour =
        hours %
        12 ||
        12;


    return `${
        hour
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
   40. TIMESTAMP
   ========================================================= */

function getOrganiserBookingTimestamp(
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
   41. CURRENCY
   ========================================================= */

function formatOrganiserBookingCurrency(
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
   42. COMPACT CURRENCY
   ========================================================= */

function formatOrganiserBookingCompactCurrency(
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


    return formatOrganiserBookingCurrency(
        amount
    );

}


/* =========================================================
   43. NUMBER
   ========================================================= */

function formatOrganiserBookingNumber(
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
   44. INITIALS
   ========================================================= */

function createOrganiserBookingInitials(
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

        return "CU";

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
   45. SET TEXT
   ========================================================= */

function setOrganiserBookingText(
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
   46. ESCAPE HTML
   ========================================================= */

function escapeOrganiserBookingHTML(
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
   47. ESCAPE ATTRIBUTE
   ========================================================= */

function escapeOrganiserBookingAttribute(
    value
) {

    return escapeOrganiserBookingHTML(
        value
    );

}


/* =========================================================
   48. TOAST
   ========================================================= */

function showOrganiserBookingToast(
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
   49. ICONS
   ========================================================= */

function refreshOrganiserBookingIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   50. ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Escape"
        ) {

            closeOrganiserBookingDetail();

        }

    }
);


/* =========================================================
   51. PUBLIC API
   ========================================================= */

window.SKYRA_ORGANISER_BOOKINGS_PAGE = {

    getBookings:
        () =>
            organiserBookingsState
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

    getFilteredBookings:
        () =>
            organiserBookingsState
                .filteredBookings
                .map(
                    (booking) => ({
                        ...booking
                    })
                ),

    getBookingById:
        getOrganiserBookingById,

    refresh:
        loadOrganiserBookings

};


/* =========================================================
   END SKYRA ORGANISER BOOKINGS
   ========================================================= */