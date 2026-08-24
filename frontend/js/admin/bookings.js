/* =========================================================
   SKYRA - ADMIN BOOKINGS
   File:
   frontend/js/admin/bookings.js

   SCOPE
   ---------------------------------------------------------
   - Read platform booking records
   - Search / filter / sort
   - Customer-context filtering
   - Organiser-context filtering
   - Inspect booking details
   - Inspect payment status
   - Inspect QR ticket issuance

   IMPORTANT
   ---------------------------------------------------------
   This page does NOT:
   - create bookings
   - confirm payment
   - cancel bookings
   - change ShowSeat state
   - issue refunds directly

   Those actions belong to the actual booking/payment/
   cancellation services on the backend.

   Backend APIs:
   GET /api/admin/bookings
   GET /api/admin/bookings/:id

   Booking lifecycle:
   SeatHold
      ↓
   verified payment
      ↓
   Booking CONFIRMED
      ↓
   ShowSeat HELD → BOOKED
      ↓
   QR ticket + email

   Cancellation:
   Booking CONFIRMED → CANCELLED
      ↓
   refund
      ↓
   ShowSeat released / waitlist processing
   ========================================================= */

"use strict";


/* =========================================================
   3. STATE
   ========================================================= */

const adminBookingsState = {

    bookings:
        [],

    filteredBookings:
        [],

    summary: {
        total: 0,
        confirmed: 0,
        cancelled: 0,
        qrIssued: 0
    },

    statusFilter:
        "ALL",

    paymentFilter:
        "ALL",

    sort:
        "NEWEST",

    search:
        "",

    contextType:
        null,

    contextId:
        null,

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

        initializeAdminBookingsPage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

async function initializeAdminBookingsPage() {

    initializeAdminBookingsCurrentAdmin();

    initializeAdminBookingsNavigation();

    initializeAdminBookingsContext();

    initializeAdminBookingsControls();

    initializeAdminBookingDetailsModal();

    initializeAdminBookingsTopSearch();


    await loadAdminBookings();


    refreshAdminBookingsIcons();

}


/* =========================================================
   6. CURRENT ADMIN
   ========================================================= */

function initializeAdminBookingsCurrentAdmin() {

    const sharedUser =
        window.SKYRA_COMMON
            ?.getUser?.();


    let admin = {

        name:
            "SKYRA Admin",

        email:
            "",

        role:
            "ADMIN"

    };


    if (
        sharedUser &&
        String(
            sharedUser.role ||
            ""
        ).toUpperCase() ===
        "ADMIN"
    ) {

        admin = {

            ...admin,
            ...sharedUser

        };

    }


    const name =
        String(
            admin.name ||
            admin.fullName ||
            "SKYRA Admin"
        );


    const initials =
        createAdminBookingInitials(
            name
        );


    setAdminBookingText(
        "sidebarUserName",
        name
    );


    setAdminBookingText(
        "sidebarUserInitials",
        initials
    );


    setAdminBookingText(
        "topbarUserName",
        name
    );


    setAdminBookingText(
        "topbarUserInitials",
        initials
    );


    setAdminBookingText(
        "dropdownUserName",
        name
    );


    setAdminBookingText(
        "dropdownUserInitials",
        initials
    );


    setAdminBookingText(
        "dropdownUserEmail",
        admin.email ||
        ""
    );

}


/* =========================================================
   7. NAVIGATION
   ========================================================= */

function initializeAdminBookingsNavigation() {

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
   8. QUERY CONTEXT
   Supports:
   bookings.html?customer=customer_001
   bookings.html?organiser=organiser_001
   ========================================================= */

function initializeAdminBookingsContext() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const customer =
        params.get(
            "customer"
        );


    const organiser =
        params.get(
            "organiser"
        );


    const search =
        params.get(
            "search"
        );


    if (customer) {

        adminBookingsState.contextType =
            "CUSTOMER";


        adminBookingsState.contextId =
            customer;

    } else if (organiser) {

        adminBookingsState.contextType =
            "ORGANISER";


        adminBookingsState.contextId =
            organiser;

    }


    if (search) {

        adminBookingsState.search =
            search
                .trim()
                .toLowerCase();


        setAdminBookingInputValue(
            "adminBookingsSearch",
            search
        );

    }


    document
        .getElementById(
            "adminBookingsClearContext"
        )
        ?.addEventListener(
            "click",
            clearAdminBookingsContext
        );

}


/* =========================================================
   9. LOAD BOOKINGS
   ========================================================= */

async function loadAdminBookings() {

    adminBookingsState.loading =
        true;


    try {

        const source =
            await fetchAdminBookingsSource();


        adminBookingsState.bookings =
            source.bookings
                .map(
                    normalizeAdminBooking
                )
                .filter(
                    (booking) =>
                        booking.id
                );


        if (
            source.summary
        ) {

            adminBookingsState.summary =
                normalizeAdminBookingSummary(
                    source.summary
                );

        }


        renderAdminBookingsSummary();

        renderAdminBookingSidebarCount();

        renderAdminBookingsContext();

        applyAdminBookingFilters();


        const params =
            new URLSearchParams(
                window.location.search
            );


        const requestedBooking =
            params.get(
                "booking"
            );


        if (
            requestedBooking &&
            adminBookingsState
                .bookings
                .some(
                    (booking) =>
                        booking.id ===
                        requestedBooking ||
                        booking.reference ===
                        requestedBooking
                )
        ) {

            openAdminBookingDetails(
                requestedBooking
            );

        }

    } catch (error) {

        console.error(
            "Unable to load Admin bookings:",
            error
        );


        adminBookingsState.bookings =
            [];


        applyAdminBookingFilters();


        showAdminBookingToast(
            "Unable to load booking records.",
            "error",
            "Bookings Unavailable"
        );

    } finally {

        adminBookingsState.loading =
            false;

    }

}


/* =========================================================
   10. FETCH SOURCE
   ========================================================= */

async function fetchAdminBookingsSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getAdminBookings !==
            "function"
    ) {

        throw new Error(
            "Admin bookings API client is unavailable."
        );

    }


    const query = {};


    if (
        adminBookingsState.contextType ===
        "CUSTOMER"
    ) {

        query.customer =
            adminBookingsState.contextId;

    }


    if (
        adminBookingsState.contextType ===
        "ORGANISER"
    ) {

        query.organiser =
            adminBookingsState.contextId;

    }


    const response =
        await window.SKYRA_API
            .getAdminBookings(
                query
            );


    const bookings =
        response?.data?.bookings ||
        response?.bookings ||
        (
            Array.isArray(
                response?.data
            )
                ? response.data
                : null
        );


    const summary =
        response?.data?.summary ||
        response?.summary ||
        null;


    if (
        !Array.isArray(
            bookings
        )
    ) {

        throw new Error(
            "Admin bookings API returned an invalid response."
        );

    }


    return {

        bookings,
        summary

    };

}

/* =========================================================
   11. NORMALIZE BOOKING
   ========================================================= */

function normalizeAdminBooking(
    raw,
    index = 0
) {

    const customer =
        raw.customer ||
        {};


    const organiser =
        raw.organiser ||
        {};


    const event =
        raw.event ||
        {};


    const show =
        raw.show ||
        {};


    const venue =
        raw.venue ||
        show.venue ||
        {};


    const payment =
        raw.payment ||
        {};


    const seats =
        Array.isArray(
            raw.seats
        )
            ? raw.seats.map(
                normalizeAdminBookingSeat
            )
            : [];


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
                raw.bookingId ||
                raw.id ||
                raw._id ||
                `BOOKING-${index + 1}`
            ),

        customer: {

            id:
                String(
                    customer.id ||
                    customer._id ||
                    raw.customerId ||
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

        organiser: {

            id:
                String(
                    organiser.id ||
                    organiser._id ||
                    raw.organiserId ||
                    ""
                ),

            name:
                String(
                    organiser.name ||
                    organiser.companyName ||
                    raw.organiserName ||
                    "Organiser"
                )

        },

        event: {

            id:
                String(
                    event.id ||
                    event._id ||
                    raw.eventId ||
                    ""
                ),

            name:
                String(
                    event.name ||
                    event.title ||
                    raw.eventName ||
                    "Event"
                ),

            type:
                String(
                    event.type ||
                    raw.eventType ||
                    ""
                )
                    .trim()
                    .toUpperCase()

        },

        show: {

            id:
                String(
                    show.id ||
                    show._id ||
                    raw.showId ||
                    ""
                ),

            startsAt:
                show.startsAt ||
                show.startDateTime ||
                raw.showStartsAt ||
                raw.showDate ||
                null

        },

        venue: {

            id:
                String(
                    venue.id ||
                    venue._id ||
                    raw.venueId ||
                    ""
                ),

            name:
                String(
                    venue.name ||
                    venue.venueName ||
                    raw.venueName ||
                    "Venue"
                ),

            city:
                String(
                    venue.city ||
                    venue.location?.city ||
                    raw.venueCity ||
                    ""
                )

        },

        seats,

        amount:
            Math.max(
                0,
                Number(
                    raw.amount ??
                    raw.totalAmount ??
                    raw.grandTotal ??
                    0
                ) ||
                0
            ),

        currency:
            String(
                raw.currency ||
                "INR"
            )
                .toUpperCase(),

        payment: {

            id:
                String(
                    payment.id ||
                    payment._id ||
                    payment.paymentId ||
                    raw.paymentId ||
                    ""
                ),

            status:
                normalizeAdminBookingPaymentStatus(
                    payment.status ||
                    raw.paymentStatus
                ),

            method:
                String(
                    payment.method ||
                    raw.paymentMethod ||
                    ""
                )
                    .toUpperCase()

        },

        status:
            normalizeAdminBookingStatus(
                raw.status
            ),

        qrIssued:
            Boolean(
                raw.qrIssued ??
                raw.ticket?.qrIssued ??
                raw.qrCode ??
                false
            ),

        bookedAt:
            raw.bookedAt ||
            raw.createdAt ||
            null,

        cancelledAt:
            raw.cancelledAt ||
            null

    };

}


/* =========================================================
   12. NORMALIZE SEAT
   ========================================================= */

function normalizeAdminBookingSeat(
    seat
) {

    if (
        typeof seat ===
        "string"
    ) {

        return seat
            .trim()
            .toUpperCase();

    }


    return String(
        seat.label ||
        seat.seatLabel ||
        seat.name ||
        `${
            seat.row ||
            ""
        }${
            seat.number ||
            seat.seatNumber ||
            ""
        }`
    )
        .trim()
        .toUpperCase();

}


/* =========================================================
   13. NORMALIZE SUMMARY
   ========================================================= */

function normalizeAdminBookingSummary(
    summary
) {

    return {

        total:
            Math.max(
                0,
                Number(
                    summary.total ??
                    summary.totalBookings ??
                    0
                ) ||
                0
            ),

        confirmed:
            Math.max(
                0,
                Number(
                    summary.confirmed ??
                    summary.confirmedBookings ??
                    0
                ) ||
                0
            ),

        cancelled:
            Math.max(
                0,
                Number(
                    summary.cancelled ??
                    summary.cancelledBookings ??
                    0
                ) ||
                0
            ),

        qrIssued:
            Math.max(
                0,
                Number(
                    summary.qrIssued ??
                    summary.qrTickets ??
                    summary.issuedTickets ??
                    0
                ) ||
                0
            )

    };

}


/* =========================================================
   14. CONTROLS
   ========================================================= */

function initializeAdminBookingsControls() {

    /*
       SEARCH
    */

    document
        .getElementById(
            "adminBookingsSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                adminBookingsState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyAdminBookingFilters();

            }
        );


    /*
       STATUS
    */

    document
        .querySelectorAll(
            "[data-booking-status]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        adminBookingsState.statusFilter =
                            button.dataset
                                .bookingStatus ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-booking-status]"
                            )
                            .forEach(
                                (item) => {

                                    item.classList.toggle(
                                        "active",
                                        item ===
                                        button
                                    );

                                }
                            );


                        applyAdminBookingFilters();

                    }
                );

            }
        );


    /*
       PAYMENT
    */

    document
        .getElementById(
            "adminBookingsPaymentFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminBookingsState.paymentFilter =
                    event.target.value ||
                    "ALL";


                applyAdminBookingFilters();

            }
        );


    /*
       SORT
    */

    document
        .getElementById(
            "adminBookingsSort"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminBookingsState.sort =
                    event.target.value ||
                    "NEWEST";


                applyAdminBookingFilters();

            }
        );


    /*
       CLEAR FILTERS
    */

    document
        .getElementById(
            "adminBookingsClearFilters"
        )
        ?.addEventListener(
            "click",
            clearAdminBookingFilters
        );


    document
        .getElementById(
            "adminBookingsEmptyClearFilters"
        )
        ?.addEventListener(
            "click",
            clearAdminBookingFilters
        );

}


/* =========================================================
   15. FILTER BOOKINGS
   ========================================================= */

function applyAdminBookingFilters() {

    let bookings =
        adminBookingsState
            .bookings
            .filter(
                (booking) => {

                    /*
                       CUSTOMER / ORGANISER CONTEXT
                    */

                    if (
                        adminBookingsState.contextType ===
                            "CUSTOMER" &&
                        booking.customer.id !==
                            adminBookingsState.contextId
                    ) {

                        return false;

                    }


                    if (
                        adminBookingsState.contextType ===
                            "ORGANISER" &&
                        booking.organiser.id !==
                            adminBookingsState.contextId
                    ) {

                        return false;

                    }


                    /*
                       BOOKING STATUS
                    */

                    if (
                        adminBookingsState.statusFilter !==
                            "ALL" &&
                        booking.status !==
                            adminBookingsState.statusFilter
                    ) {

                        return false;

                    }


                    /*
                       PAYMENT STATUS
                    */

                    if (
                        adminBookingsState.paymentFilter !==
                            "ALL" &&
                        booking.payment.status !==
                            adminBookingsState.paymentFilter
                    ) {

                        return false;

                    }


                    /*
                       SEARCH
                    */

                    if (
                        !adminBookingsState.search
                    ) {

                        return true;

                    }


                    const searchable =
                        [

                            booking.id,
                            booking.reference,

                            booking.customer.id,
                            booking.customer.name,
                            booking.customer.email,

                            booking.organiser.id,
                            booking.organiser.name,

                            booking.event.id,
                            booking.event.name,
                            booking.event.type,

                            booking.show.id,

                            booking.venue.id,
                            booking.venue.name,
                            booking.venue.city,

                            booking.seats.join(" "),

                            booking.payment.id,
                            booking.payment.status,
                            booking.status

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        adminBookingsState.search
                    );

                }
            );


    bookings =
        sortAdminBookings(
            bookings,
            adminBookingsState.sort
        );


    adminBookingsState.filteredBookings =
        bookings;


    renderAdminBookingsTable();

    renderAdminBookingResultCount();

    updateAdminBookingClearFilters();

}


/* =========================================================
   16. SORT BOOKINGS
   ========================================================= */

function sortAdminBookings(
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
                    getAdminBookingTimestamp(
                        first.bookedAt
                    ) -
                    getAdminBookingTimestamp(
                        second.bookedAt
                    )
            );


        case "AMOUNT_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.amount -
                    first.amount
            );


        case "EVENT_ASC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    first.event.name.localeCompare(
                        second.event.name
                    )
            );


        case "NEWEST":
        default:

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getAdminBookingTimestamp(
                        second.bookedAt
                    ) -
                    getAdminBookingTimestamp(
                        first.bookedAt
                    )
            );

    }

}


/* =========================================================
   17. SUMMARY
   ========================================================= */

function renderAdminBookingsSummary() {

    const summary =
        adminBookingsState.summary;


    setAdminBookingText(
        "adminBookingsTotalCount",
        formatAdminBookingNumber(
            summary.total
        )
    );


    setAdminBookingText(
        "adminBookingsConfirmedCount",
        formatAdminBookingNumber(
            summary.confirmed
        )
    );


    setAdminBookingText(
        "adminBookingsCancelledCount",
        formatAdminBookingNumber(
            summary.cancelled
        )
    );


    setAdminBookingText(
        "adminBookingsQrCount",
        formatAdminBookingNumber(
            summary.qrIssued
        )
    );

}


/* =========================================================
   18. SIDEBAR COUNT
   ========================================================= */

function renderAdminBookingSidebarCount() {

    const total =
        adminBookingsState.summary.total;


    const element =
        document.getElementById(
            "sidebarBookingCount"
        );


    if (!element) {

        return;

    }


    if (
        total >=
        1000
    ) {

        element.textContent =
            `${
                (
                    total /
                    1000
                )
                    .toFixed(1)
                    .replace(
                        ".0",
                        ""
                    )
            }K`;

    } else {

        element.textContent =
            String(
                total
            );

    }

}


/* =========================================================
   19. RENDER CONTEXT
   ========================================================= */

function renderAdminBookingsContext() {

    const bar =
        document.getElementById(
            "adminBookingsContextBar"
        );


    if (!bar) {

        return;

    }


    if (
        !adminBookingsState.contextType ||
        !adminBookingsState.contextId
    ) {

        bar.hidden =
            true;


        return;

    }


    const matchingBooking =
        adminBookingsState
            .bookings
            .find(
                (booking) => {

                    if (
                        adminBookingsState.contextType ===
                        "CUSTOMER"
                    ) {

                        return booking.customer.id ===
                            adminBookingsState.contextId;

                    }


                    return booking.organiser.id ===
                        adminBookingsState.contextId;

                }
            );


    let label =
        adminBookingsState.contextId;


    if (matchingBooking) {

        label =
            adminBookingsState.contextType ===
                "CUSTOMER"
                ? matchingBooking.customer.name
                : matchingBooking.organiser.name;

    }


    setAdminBookingText(
        "adminBookingsContextText",
        `${
            adminBookingsState.contextType ===
            "CUSTOMER"
                ? "Customer"
                : "Organiser"
        }: ${label}`
    );


    bar.hidden =
        false;

}


/* =========================================================
   20. CLEAR CONTEXT
   ========================================================= */

function clearAdminBookingsContext() {

    adminBookingsState.contextType =
        null;


    adminBookingsState.contextId =
        null;


    const url =
        new URL(
            window.location.href
        );


    url.searchParams.delete(
        "customer"
    );


    url.searchParams.delete(
        "organiser"
    );


    window.history.replaceState(
        {},
        "",
        url
    );


    renderAdminBookingsContext();

    applyAdminBookingFilters();

}


/* =========================================================
   21. TABLE
   ========================================================= */

function renderAdminBookingsTable() {

    const body =
        document.getElementById(
            "adminBookingsTableBody"
        );


    const wrapper =
        document.getElementById(
            "adminBookingsTableWrapper"
        );


    const empty =
        document.getElementById(
            "adminBookingsEmpty"
        );


    if (
        !body ||
        !wrapper ||
        !empty
    ) {

        return;

    }


    const bookings =
        adminBookingsState
            .filteredBookings;


    if (!bookings.length) {

        body.innerHTML =
            "";


        wrapper.hidden =
            true;


        empty.hidden =
            false;


        refreshAdminBookingsIcons();

        return;

    }


    wrapper.hidden =
        false;


    empty.hidden =
        true;


    body.innerHTML =
        bookings
            .map(
                createAdminBookingRowHTML
            )
            .join("");


    bindAdminBookingRowActions();

    refreshAdminBookingsIcons();

}


/* =========================================================
   22. BOOKING ROW
   ========================================================= */

function createAdminBookingRowHTML(
    booking
) {

    const confirmed =
        booking.status ===
        "CONFIRMED";


    const paymentVisual =
        getAdminBookingPaymentVisual(
            booking.payment.status
        );


    const eventVisual =
        getAdminBookingEventVisual(
            booking.event.type
        );


    const displayedSeats =
        booking.seats
            .slice(
                0,
                3
            )
            .join(", ");


    const remainingSeats =
        Math.max(
            0,
            booking.seats.length -
            3
        );


    return `

        <tr
            data-booking-id="${
                escapeAdminBookingHTML(
                    booking.id
                )
            }"
        >


            <!-- BOOKING -->

            <td>

                <div class="admin-booking-reference-cell">

                    <div>

                        <i data-lucide="ticket-check"></i>

                    </div>


                    <span>

                        <strong>

                            ${
                                escapeAdminBookingHTML(
                                    booking.reference
                                )
                            }

                        </strong>


                        <small>

                            ${
                                escapeAdminBookingHTML(
                                    formatAdminBookingDate(
                                        booking.bookedAt
                                    )
                                )
                            }

                        </small>

                    </span>

                </div>

            </td>



            <!-- CUSTOMER -->

            <td>

                <div class="admin-booking-customer-cell">

                    <strong>

                        ${
                            escapeAdminBookingHTML(
                                booking.customer.name
                            )
                        }

                    </strong>


                    <small>

                        ${
                            escapeAdminBookingHTML(
                                booking.customer.email ||
                                booking.customer.id
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- EVENT -->

            <td>

                <div class="admin-booking-event-cell">


                    <div
                        class="admin-booking-event-icon ${
                            eventVisual.className
                        }"
                    >

                        <i
                            data-lucide="${
                                eventVisual.icon
                            }"
                        ></i>

                    </div>


                    <span>

                        <strong>

                            ${
                                escapeAdminBookingHTML(
                                    booking.event.name
                                )
                            }

                        </strong>


                        <small>

                            ${
                                escapeAdminBookingHTML(
                                    `${
                                        booking.venue.name
                                    } · ${
                                        formatAdminBookingShowDate(
                                            booking.show.startsAt
                                        )
                                    }`
                                )
                            }

                        </small>

                    </span>

                </div>

            </td>



            <!-- SEATS -->

            <td>

                <div class="admin-booking-seats-cell">

                    <strong>

                        ${
                            escapeAdminBookingHTML(
                                displayedSeats ||
                                "—"
                            )
                        }

                        ${
                            remainingSeats
                                ? `+${
                                    remainingSeats
                                }`
                                : ""
                        }

                    </strong>


                    <small>

                        ${
                            booking.seats.length
                        } ${
                            booking.seats.length ===
                            1
                                ? "seat"
                                : "seats"
                        }

                    </small>

                </div>

            </td>



            <!-- AMOUNT -->

            <td>

                <div class="admin-booking-amount-cell">

                    <strong>

                        ${
                            escapeAdminBookingHTML(
                                formatAdminBookingCurrency(
                                    booking.amount,
                                    booking.currency
                                )
                            )
                        }

                    </strong>


                    <small>

                        ${
                            escapeAdminBookingHTML(
                                booking.payment.method ||
                                "Payment"
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- PAYMENT -->

            <td>

                <span
                    class="
                        admin-booking-payment-status
                        ${
                            paymentVisual.className
                        }
                    "
                >

                    <i
                        data-lucide="${
                            paymentVisual.icon
                        }"
                    ></i>

                    ${
                        paymentVisual.label
                    }

                </span>

            </td>



            <!-- STATUS -->

            <td>

                <span
                    class="
                        admin-booking-record-status
                        ${
                            confirmed
                                ? "confirmed"
                                : "cancelled"
                        }
                    "
                >

                    <span></span>

                    ${
                        confirmed
                            ? "Confirmed"
                            : "Cancelled"
                    }

                </span>

            </td>



            <!-- ACTION -->

            <td>

                <div class="admin-booking-actions">

                    <button
                        type="button"
                        class="admin-booking-action-button"
                        data-view-booking="${
                            escapeAdminBookingHTML(
                                booking.id
                            )
                        }"
                        title="View booking"
                        aria-label="View booking ${
                            escapeAdminBookingHTML(
                                booking.reference
                            )
                        }"
                    >

                        <i data-lucide="eye"></i>

                    </button>

                </div>

            </td>

        </tr>

    `;

}


/* =========================================================
   23. ROW ACTIONS
   ========================================================= */

function bindAdminBookingRowActions() {

    document
        .querySelectorAll(
            "[data-view-booking]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openAdminBookingDetails(
                            button.dataset
                                .viewBooking
                        );

                    }
                );

            }
        );

}


/* =========================================================
   24. RESULT COUNT
   ========================================================= */

function renderAdminBookingResultCount() {

    setAdminBookingText(
        "adminBookingsResultCount",
        formatAdminBookingNumber(
            adminBookingsState
                .filteredBookings
                .length
        )
    );

}


/* =========================================================
   25. CLEAR FILTER VISIBILITY
   ========================================================= */

function updateAdminBookingClearFilters() {

    const active =
        Boolean(
            adminBookingsState.search
        ) ||
        adminBookingsState.statusFilter !==
            "ALL" ||
        adminBookingsState.paymentFilter !==
            "ALL" ||
        adminBookingsState.sort !==
            "NEWEST";


    const button =
        document.getElementById(
            "adminBookingsClearFilters"
        );


    if (button) {

        button.hidden =
            !active;

    }

}


/* =========================================================
   26. CLEAR FILTERS
   Context is intentionally preserved.
   ========================================================= */

function clearAdminBookingFilters() {

    adminBookingsState.search =
        "";


    adminBookingsState.statusFilter =
        "ALL";


    adminBookingsState.paymentFilter =
        "ALL";


    adminBookingsState.sort =
        "NEWEST";


    setAdminBookingInputValue(
        "adminBookingsSearch",
        ""
    );


    setAdminBookingInputValue(
        "adminBookingsPaymentFilter",
        "ALL"
    );


    setAdminBookingInputValue(
        "adminBookingsSort",
        "NEWEST"
    );


    document
        .querySelectorAll(
            "[data-booking-status]"
        )
        .forEach(
            (button) => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .bookingStatus ===
                        "ALL"
                );

            }
        );


    applyAdminBookingFilters();

}


/* =========================================================
   27. DETAILS MODAL
   ========================================================= */

function initializeAdminBookingDetailsModal() {

    document
        .getElementById(
            "closeAdminBookingDetailsModal"
        )
        ?.addEventListener(
            "click",
            closeAdminBookingDetails
        );


    document
        .getElementById(
            "adminBookingDetailsCloseButton"
        )
        ?.addEventListener(
            "click",
            closeAdminBookingDetails
        );


    const modal =
        document.getElementById(
            "adminBookingDetailsModal"
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                closeAdminBookingDetails();

            }

        }
    );

}


/* =========================================================
   28. OPEN DETAILS
   ========================================================= */

async function openAdminBookingDetails(
    identifier
) {

    let booking =
        adminBookingsState
            .bookings
            .find(
                (item) =>
                    item.id ===
                        identifier ||
                    item.reference ===
                        identifier
            );


    if (!booking) {

        return;

    }


    if (
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .getAdminBooking ===
            "function"
    ) {

        try {

            const response =
                await window.SKYRA_API
                    .getAdminBooking(
                        booking.id
                    );


            const fresh =
                response?.data?.booking ||
                response?.booking ||
                response?.data ||
                null;


            if (fresh) {

                booking =
                    normalizeAdminBooking(
                        fresh
                    );


                const index =
                    adminBookingsState
                        .bookings
                        .findIndex(
                            (item) =>
                                item.id ===
                                booking.id
                        );


                if (index >= 0) {

                    adminBookingsState
                        .bookings[index] =
                        booking;

                }

            }

        } catch (error) {

            console.warn(
                "Unable to refresh booking details:",
                error
            );

        }

    }


    adminBookingsState.selectedBookingId =
        booking.id;


    setAdminBookingText(
        "adminBookingDetailsTitle",
        booking.event.name
    );


    setAdminBookingText(
        "adminBookingModalReference",
        booking.reference
    );


    setAdminBookingText(
        "adminBookingModalStatus",
        booking.status ===
            "CONFIRMED"
            ? "Confirmed"
            : "Cancelled"
    );


    setAdminBookingText(
        "adminBookingModalPayment",
        formatAdminBookingPaymentLabel(
            booking.payment.status
        )
    );


    setAdminBookingText(
        "adminBookingModalAmount",
        formatAdminBookingCurrency(
            booking.amount,
            booking.currency
        )
    );


    setAdminBookingText(
        "adminBookingModalId",
        booking.id
    );


    setAdminBookingText(
        "adminBookingModalCustomer",
        booking.customer.name
    );


    setAdminBookingText(
        "adminBookingModalCustomerEmail",
        booking.customer.email ||
        "Not available"
    );


    setAdminBookingText(
        "adminBookingModalOrganiser",
        booking.organiser.name
    );


    setAdminBookingText(
        "adminBookingModalEvent",
        booking.event.name
    );


    setAdminBookingText(
        "adminBookingModalVenue",
        [
            booking.venue.name,
            booking.venue.city
        ]
            .filter(Boolean)
            .join(", ")
    );


    setAdminBookingText(
        "adminBookingModalShowDate",
        formatAdminBookingDateTime(
            booking.show.startsAt
        )
    );


    setAdminBookingText(
        "adminBookingModalSeats",
        booking.seats.join(
            ", "
        ) ||
        "No seats"
    );


    setAdminBookingText(
        "adminBookingModalPaymentId",
        booking.payment.id ||
        "Not available"
    );


    setAdminBookingText(
        "adminBookingModalQr",
        booking.qrIssued
            ? "Issued"
            : (
                booking.status ===
                "CANCELLED"
                    ? "Invalidated / Not active"
                    : "Not issued"
            )
    );


    setAdminBookingText(
        "adminBookingModalBookedAt",
        formatAdminBookingDateTime(
            booking.bookedAt
        )
    );


    setAdminBookingText(
        "adminBookingModalCancelledAt",
        booking.cancelledAt
            ? formatAdminBookingDateTime(
                booking.cancelledAt
            )
            : "Not cancelled"
    );


    const customerLink =
        document.getElementById(
            "adminBookingCustomerLink"
        );


    if (customerLink) {

        customerLink.href =
            `./users.html?search=${
                encodeURIComponent(
                    booking.customer.email ||
                    booking.customer.name
                )
            }`;

    }


    const organiserLink =
        document.getElementById(
            "adminBookingOrganiserLink"
        );


    if (organiserLink) {

        organiserLink.href =
            `./organisers.html?search=${
                encodeURIComponent(
                    booking.organiser.name
                )
            }`;

    }


    const modal =
        document.getElementById(
            "adminBookingDetailsModal"
        );


    if (modal) {

        modal.hidden =
            false;


        document.body.classList.add(
            "modal-open"
        );

    }

}


/* =========================================================
   29. CLOSE DETAILS
   ========================================================= */

function closeAdminBookingDetails() {

    const modal =
        document.getElementById(
            "adminBookingDetailsModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );


    adminBookingsState.selectedBookingId =
        null;

}


/* =========================================================
   30. TOPBAR SEARCH
   ========================================================= */

function initializeAdminBookingsTopSearch() {

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


                setAdminBookingInputValue(
                    "adminBookingsSearch",
                    query
                );


                adminBookingsState.search =
                    query.toLowerCase();


                applyAdminBookingFilters();

            }
        );

}


/* =========================================================
   31. BOOKING STATUS
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
            "CANCELED"
        ].includes(
            status
        )
    ) {

        return "CANCELLED";

    }


    return "CONFIRMED";

}


/* =========================================================
   32. PAYMENT STATUS
   ========================================================= */

function normalizeAdminBookingPaymentStatus(
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
            "FAILED",
            "PENDING",
            "CREATED"
        ].includes(
            status
        )
    ) {

        return status;

    }


    return "SUCCESS";

}


/* =========================================================
   33. PAYMENT VISUAL
   ========================================================= */

function getAdminBookingPaymentVisual(
    status
) {

    switch (status) {

        case "REFUNDED":

            return {

                label:
                    "Refunded",

                className:
                    "refunded",

                icon:
                    "rotate-ccw"

            };


        case "FAILED":

            return {

                label:
                    "Failed",

                className:
                    "failed",

                icon:
                    "circle-x"

            };


        case "PENDING":

        case "CREATED":

            return {

                label:
                    "Pending",

                className:
                    "pending",

                icon:
                    "clock-3"

            };


        case "SUCCESS":
        default:

            return {

                label:
                    "Success",

                className:
                    "success",

                icon:
                    "circle-check-big"

            };

    }

}


/* =========================================================
   34. PAYMENT LABEL
   ========================================================= */

function formatAdminBookingPaymentLabel(
    status
) {

    return getAdminBookingPaymentVisual(
        status
    ).label;

}


/* =========================================================
   35. EVENT VISUAL
   ========================================================= */

function getAdminBookingEventVisual(
    type
) {

    const normalized =
        String(
            type ||
            ""
        )
            .toUpperCase();


    if (
        normalized ===
        "MOVIE"
    ) {

        return {

            className:
                "movie",

            icon:
                "clapperboard"

        };

    }


    if (
        normalized ===
        "COMEDY"
    ) {

        return {

            className:
                "comedy",

            icon:
                "mic-2"

        };

    }


    return {

        className:
            "concert",

        icon:
            "music-2"

    };

}


/* =========================================================
   36. CURRENCY
   ========================================================= */

function formatAdminBookingCurrency(
    value,
    currency = "INR"
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


    try {

        return new Intl.NumberFormat(
            "en-IN",
            {

                style:
                    "currency",

                currency:
                    currency ||
                    "INR",

                maximumFractionDigits:
                    0

            }
        ).format(
            amount
        );

    } catch {

        return `₹${
            formatAdminBookingNumber(
                amount
            )
        }`;

    }

}


/* =========================================================
   37. DATE
   ========================================================= */

function formatAdminBookingDate(
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
                "numeric"

        }
    ).format(
        date
    );

}


/* =========================================================
   38. SHOW DATE
   ========================================================= */

function formatAdminBookingShowDate(
    value
) {

    if (!value) {

        return "Date unavailable";

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

        return "Date unavailable";

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {

            day:
                "2-digit",

            month:
                "short",

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
   39. DATE TIME
   ========================================================= */

function formatAdminBookingDateTime(
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
   40. TIMESTAMP
   ========================================================= */

function getAdminBookingTimestamp(
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
   41. NUMBER
   ========================================================= */

function formatAdminBookingNumber(
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

function createAdminBookingInitials(
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
   43. SET INPUT
   ========================================================= */

function setAdminBookingInputValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value ??
            "";

    }

}


/* =========================================================
   44. SET TEXT
   ========================================================= */

function setAdminBookingText(
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
   45. ESCAPE HTML
   ========================================================= */

function escapeAdminBookingHTML(
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
   46. TOAST
   ========================================================= */

function showAdminBookingToast(
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
   47. ICONS
   ========================================================= */

function refreshAdminBookingsIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   48. PUBLIC PAGE API
   ========================================================= */

window.SKYRA_ADMIN_BOOKINGS_PAGE = {

    getBookings:
        () =>
            adminBookingsState
                .bookings
                .map(
                    (booking) => ({
                        ...booking
                    })
                ),

    getFilteredBookings:
        () =>
            adminBookingsState
                .filteredBookings
                .map(
                    (booking) => ({
                        ...booking
                    })
                ),

    getBookingById:
        (bookingId) =>
            adminBookingsState
                .bookings
                .find(
                    (booking) =>
                        booking.id ===
                            bookingId ||
                        booking.reference ===
                            bookingId
                ) ||
            null,

    refresh:
        loadAdminBookings

};


/* =========================================================
   END SKYRA ADMIN BOOKINGS
   ========================================================= */