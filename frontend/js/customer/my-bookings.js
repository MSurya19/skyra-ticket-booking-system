/* =========================================================
   SKYRA - CUSTOMER MY BOOKINGS
   File:
   frontend/js/customer/my-bookings.js

   Used by:
   - customer/my-bookings.html

   Current phase:
   - Loads bookings from backend APIs
   - Includes bookings created during real checkout
   - Search
   - Status filters
   - Booking counts
   - Cancellation modal
   - Backend cancellation persistence

   Backend phase:
   - GET /api/bookings/my
   - POST /api/bookings/:id/cancel
   - Database becomes source of truth
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_MY_BOOKINGS = {};


/* =========================================================
   2. STATE
   ========================================================= */

const skyraBookingsState = {

    bookings: [],

    filteredBookings: [],

    filter:
        "ALL",

    search:
        "",

    cancellingBookingId:
        null,

    loading:
        false

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeMyBookingsPage();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

async function initializeMyBookingsPage() {

    initializeBookingsUser();

    await updateBookingsIndicators();

    initializeBookingsSearch();

    initializeBookingTabs();

    initializeCancellationModal();

    initializeTopbarSearch();

    keepBookingsNavigationActive();


    await loadMyBookings();


    refreshBookingsIcons();

}


/* =========================================================
   5. LOAD BOOKINGS
   ========================================================= */

async function loadMyBookings() {

    skyraBookingsState.loading =
        true;


    try {

        let bookings =
            await fetchBookingsSource();


        bookings =
            bookings
                .map(
                    normalizeBooking
                )
                .filter(
                    (booking) =>
                        Boolean(
                            booking.id
                        )
                );


        bookings =
            sortBookings(
                bookings
            );


        skyraBookingsState.bookings =
            bookings;


        renderBookingsSummary();

        applyBookingsFilters();

    } catch (error) {

        console.error(
            "Unable to load bookings:",
            error
        );


        skyraBookingsState.bookings =
            [];


        renderBookingsSummary();

        applyBookingsFilters();


        showBookingsToast(
            "Bookings could not be loaded.",
            "error",
            "Unable to Load"
        );

    } finally {

        skyraBookingsState.loading =
            false;

    }

}


/* =========================================================
   6. BOOKING SOURCE

   Priority:
   1. Backend API
   ========================================================= */

async function fetchBookingsSource() {

    if (!window.SKYRA_API) {
        throw new Error(
            "SKYRA booking API is unavailable."
        );
    }


    const loader =
        typeof window.SKYRA_API
            .getMyBookings ===
            "function"
            ? window.SKYRA_API
                .getMyBookings
            : window.SKYRA_API
                .getCustomerBookings;


    if (
        typeof loader !==
        "function"
    ) {
        throw new Error(
            "Customer bookings API is unavailable."
        );
    }


    const response =
        await loader();


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
            "Bookings API returned an invalid response."
        );
    }


    return bookings;

}




/* =========================================================
   10. NORMALIZE BOOKING
   ========================================================= */
function normalizeBooking(rawBooking) {
    const id = getBookingId(rawBooking);
    const embeddedEvent = rawBooking?.event && typeof rawBooking.event === "object" ? rawBooking.event : null;
    const embeddedShow = rawBooking?.show && typeof rawBooking.show === "object" ? rawBooking.show : null;
    const embeddedVenue = rawBooking?.venue && typeof rawBooking.venue === "object" ? rawBooking.venue : null;

    const event = embeddedEvent || {
        id: rawBooking?.eventId || null,
        _id: rawBooking?.eventId || null,
        title: rawBooking?.eventTitle || "SKYRA Event",
        type: rawBooking?.eventType || "EVENT"
    };
    const show = embeddedShow || {
        id: rawBooking?.showId || null,
        _id: rawBooking?.showId || null,
        date: rawBooking?.date || rawBooking?.showDate || null,
        time: rawBooking?.time || rawBooking?.showTime || null,
        startsAt: rawBooking?.startsAt || null
    };
    const venue = embeddedVenue || {
        id: rawBooking?.venueId || null,
        _id: rawBooking?.venueId || null,
        name: rawBooking?.venueName || "Venue",
        city: rawBooking?.venueCity || ""
    };
    const seats = normalizeBookingSeats(rawBooking?.seats || rawBooking?.selectedSeats || []);
    const subtotal = Number(rawBooking?.subtotal ?? rawBooking?.ticketSubtotal ?? seats.reduce((sum, seat) => sum + Number(seat.price || 0), 0));
    const convenienceFee = Number(rawBooking?.convenienceFee ?? rawBooking?.bookingFee ?? rawBooking?.fee ?? 0);
    const total = Number(rawBooking?.grandTotal ?? rawBooking?.total ?? rawBooking?.totalAmount ?? rawBooking?.amount ?? subtotal + convenienceFee);
    const status = normalizeBookingStatus(rawBooking?.status);
    const lifecycle = determineBookingLifecycle(status, show?.date || rawBooking?.eventDate || rawBooking?.date || rawBooking?.startsAt, show?.time || rawBooking?.eventTime || rawBooking?.time);

    return {
        ...rawBooking,
        id,
        eventId: event?.id || event?._id || rawBooking?.eventId || null,
        showId: show?.id || show?._id || rawBooking?.showId || null,
        venueId: venue?.id || venue?._id || rawBooking?.venueId || null,
        event, show, venue, seats, subtotal, convenienceFee, total, status, lifecycle,
        eventTitle: rawBooking?.eventTitle || event?.title || "SKYRA Event",
        eventDate: rawBooking?.eventDate || rawBooking?.date || show?.date || rawBooking?.startsAt || show?.startsAt || null,
        eventTime: rawBooking?.eventTime || rawBooking?.time || show?.time || null,
        venueName: rawBooking?.venueName || venue?.name || "Venue",
        bookingReference: String(rawBooking?.bookingReference || rawBooking?.reference || rawBooking?.bookingRef || rawBooking?.ticketReference || id),
        paymentStatus: String(rawBooking?.refundStatus || rawBooking?.paymentStatus || rawBooking?.payment?.refundStatus || rawBooking?.payment?.status || (status === "CANCELLED" ? "PENDING" : "SUCCESS")).toUpperCase(),
        bookedAt: rawBooking?.bookedAt || rawBooking?.createdAt || rawBooking?.bookingDate || null
    };
}

/* =========================================================
   11. NORMALIZE SEATS
   ========================================================= */

function normalizeBookingSeats(
    seats
) {

    if (
        !Array.isArray(
            seats
        )
    ) {

        return [];

    }


    return seats.map(
        (
            seat,
            index
        ) => ({

            id:
                String(
                    seat.id ||
                    seat._id ||
                    seat.showSeatId ||
                    `seat_${index + 1}`
                ),

            label:
                String(
                    seat.label ||
                    seat.seatLabel ||
                    `${
                        seat.row ||
                        ""
                    }${
                        seat.number ||
                        index + 1
                    }`
                ),

            category:
                String(
                    seat.category ||
                    seat.categoryName ||
                    seat.seatCategory ||
                    "Standard"
                ),

            price:
                Number(
                    seat.price ||
                    0
                )

        })
    );

}


/* =========================================================
   12. BOOKING ID
   ========================================================= */

function getBookingId(
    booking
) {

    return String(
        booking?.id ||
        booking?._id ||
        booking?.bookingId ||
        ""
    );

}


/* =========================================================
   13. NORMALIZE STATUS
   ========================================================= */

function normalizeBookingStatus(
    value
) {

    const status =
        String(
            value ||
            "CONFIRMED"
        ).toUpperCase();


    if (
        [
            "CONFIRMED",
            "COMPLETED",
            "CANCELLED",
            "PENDING"
        ].includes(
            status
        )
    ) {

        return status;

    }


    return "CONFIRMED";

}


/* =========================================================
   14. BOOKING LIFECYCLE
   ========================================================= */

function determineBookingLifecycle(
    status,
    date,
    time
) {

    if (
        status ===
        "CANCELLED"
    ) {

        return "CANCELLED";

    }


    if (
        status ===
        "COMPLETED"
    ) {

        return "COMPLETED";

    }


    const showTime =
        createBookingShowDate(
            date,
            time
        );


    if (
        showTime &&
        showTime.getTime() <
            Date.now()
    ) {

        return "COMPLETED";

    }


    return "UPCOMING";

}


/* =========================================================
   15. SHOW DATE
   ========================================================= */

function createBookingShowDate(
    dateValue,
    timeValue
) {

    if (!dateValue) {

        return null;

    }


    const date =
        parseBookingDate(
            dateValue
        );


    if (!date) {

        return null;

    }


    if (
        typeof timeValue ===
            "string" &&
        /^\d{2}:\d{2}$/.test(
            timeValue
        )
    ) {

        const [
            hours,
            minutes
        ] =
            timeValue
                .split(":")
                .map(Number);


        date.setHours(
            hours,
            minutes,
            0,
            0
        );

    }


    return date;

}


/* =========================================================
   16. SORT BOOKINGS
   ========================================================= */

function sortBookings(
    bookings
) {

    const rank = {

        UPCOMING:
            0,

        COMPLETED:
            1,

        CANCELLED:
            2

    };


    return [
        ...bookings
    ].sort(
        (
            first,
            second
        ) => {

            const rankDifference =
                (
                    rank[
                        first.lifecycle
                    ] ??
                    9
                ) -
                (
                    rank[
                        second.lifecycle
                    ] ??
                    9
                );


            if (
                rankDifference !==
                0
            ) {

                return rankDifference;

            }


            const firstDate =
                createBookingShowDate(
                    first.show?.date ||
                    first.eventDate ||
                    first.date,
                    first.show?.time ||
                    first.eventTime ||
                    first.time
                )
                    ?.getTime() ||
                0;


            const secondDate =
                createBookingShowDate(
                    second.show?.date ||
                    second.eventDate ||
                    second.date,
                    second.show?.time ||
                    second.eventTime ||
                    second.time
                )
                    ?.getTime() ||
                0;


            if (
                first.lifecycle ===
                "UPCOMING"
            ) {

                return (
                    firstDate -
                    secondDate
                );

            }


            return (
                secondDate -
                firstDate
            );

        }
    );

}




/* =========================================================
   20. SUMMARY
   ========================================================= */

function renderBookingsSummary() {

    const bookings =
        skyraBookingsState
            .bookings;


    const upcoming =
        bookings.filter(
            (booking) =>
                booking.lifecycle ===
                "UPCOMING"
        ).length;


    const completed =
        bookings.filter(
            (booking) =>
                booking.lifecycle ===
                "COMPLETED"
        ).length;


    const cancelled =
        bookings.filter(
            (booking) =>
                booking.lifecycle ===
                "CANCELLED"
        ).length;


    setBookingsText(
        "upcomingBookingsCount",
        upcoming
    );


    setBookingsText(
        "completedBookingsCount",
        completed
    );


    setBookingsText(
        "cancelledBookingsCount",
        cancelled
    );


    setBookingsText(
        "totalBookingsCount",
        bookings.length
    );

}


/* =========================================================
   21. STATUS TABS
   ========================================================= */

function initializeBookingTabs() {

    document
        .querySelectorAll(
            ".my-bookings-tab"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        skyraBookingsState.filter =
                            button.dataset
                                .filter ||
                            "ALL";


                        document
                            .querySelectorAll(
                                ".my-bookings-tab"
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


                        applyBookingsFilters();

                    }
                );

            }
        );

}


/* =========================================================
   22. LOCAL SEARCH
   ========================================================= */

function initializeBookingsSearch() {

    const input =
        document.getElementById(
            "bookingSearchInput"
        );


    input?.addEventListener(
        "input",
        () => {

            skyraBookingsState.search =
                input.value
                    .trim()
                    .toLowerCase();


            applyBookingsFilters();

        }
    );

}


/* =========================================================
   23. APPLY FILTERS
   ========================================================= */

function applyBookingsFilters() {

    const {
        filter,
        search
    } =
        skyraBookingsState;


    const filtered =
        skyraBookingsState
            .bookings
            .filter(
                (booking) => {

                    if (
                        filter !==
                            "ALL" &&
                        booking.lifecycle !==
                            filter
                    ) {

                        return false;

                    }


                    if (!search) {

                        return true;

                    }


                    const searchable =
                        [
                            booking.bookingReference,
                            booking.event?.title,
                            booking.eventTitle,
                            booking.venue?.name,
                            booking.venue?.city,
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


    skyraBookingsState.filteredBookings =
        filtered;


    renderBookingsList();

}


/* =========================================================
   24. RENDER LIST
   ========================================================= */

function renderBookingsList() {

    const container =
        document.getElementById(
            "myBookingsList"
        );


    const empty =
        document.getElementById(
            "myBookingsEmptyState"
        );


    if (
        !container ||
        !empty
    ) {

        return;

    }


    const bookings =
        skyraBookingsState
            .filteredBookings;


    if (!bookings.length) {

        container.hidden =
            true;


        empty.hidden =
            false;


        refreshBookingsIcons();

        return;

    }


    empty.hidden =
        true;


    container.hidden =
        false;


    container.innerHTML =
        bookings
            .map(
                createBookingCardHTML
            )
            .join("");


    initializeRenderedBookingActions();

    refreshBookingsIcons();

}


/* =========================================================
   25. BOOKING CARD
   ========================================================= */

function createBookingCardHTML(
    booking
) {

    const event =
        booking.event;


    const show =
        booking.show;


    const venue =
        booking.venue;


    const title =
        event?.title ||
        booking.eventTitle ||
        "SKYRA Event";


    const type =
        event?.type ||
        booking.eventType ||
        "EVENT";


    const venueText =
        formatBookingVenue(
            venue,
            booking
        );


    const seatText =
        booking.seats
            .map(
                (seat) =>
                    seat.label
            )
            .join(", ") ||
        "See ticket";


    const statusInfo =
        getBookingStatusInfo(
            booking
        );


    const canViewTicket =
        booking.lifecycle !==
        "CANCELLED";


    const canCancel =
        booking.lifecycle ===
            "UPCOMING" &&
        booking.status ===
            "CONFIRMED";


    return `

        <article
            class="
                my-booking-card
                ${booking.lifecycle.toLowerCase()}
            "
            data-booking-id="${escapeBookingAttribute(
                booking.id
            )}"
        >


            <div
                class="
                    my-booking-poster
                    ${getBookingPosterClass(
                        event?.id ||
                        event?._id
                    )}
                "
            >

                <div
                    class="my-booking-poster-content"
                >

                    <small>
                        ${escapeBookingsHTML(
                            getBookingPosterEyebrow(
                                type
                            )
                        )}
                    </small>

                    <strong>
                        ${escapeBookingsHTML(
                            getBookingPosterWord(
                                title
                            )
                        )}
                    </strong>

                </div>

            </div>


            <div class="my-booking-main">


                <div class="my-booking-title-row">

                    <div>

                        <div class="my-booking-badges">

                            <span
                                class="badge ${statusInfo.badgeClass}"
                            >

                                <span
                                    class="status-dot ${statusInfo.dotClass}"
                                ></span>

                                ${escapeBookingsHTML(
                                    statusInfo.label
                                )}

                            </span>


                            <span class="my-booking-type">

                                <i
                                    data-lucide="${getBookingsEventIcon(
                                        type
                                    )}"
                                ></i>

                                ${escapeBookingsHTML(
                                    formatBookingsEventType(
                                        type
                                    )
                                )}

                            </span>

                        </div>


                        <h2>
                            ${escapeBookingsHTML(
                                title
                            )}
                        </h2>

                    </div>


                    <div class="my-booking-reference">

                        <span>
                            Booking Ref
                        </span>

                        <strong>
                            ${escapeBookingsHTML(
                                booking.bookingReference
                            )}
                        </strong>

                    </div>

                </div>


                <div class="my-booking-meta-grid">

                    <div>

                        <i data-lucide="calendar-days"></i>

                        <span>

                            <small>
                                Date
                            </small>

                            <strong>
                                ${escapeBookingsHTML(
                                    formatBookingDate(
                                        show?.date ||
                                        booking.eventDate ||
                                        booking.date
                                    )
                                )}
                            </strong>

                        </span>

                    </div>


                    <div>

                        <i data-lucide="clock-3"></i>

                        <span>

                            <small>
                                Time
                            </small>

                            <strong>
                                ${escapeBookingsHTML(
                                    formatBookingTime(
                                        show?.time ||
                                        booking.eventTime ||
                                        booking.time
                                    )
                                )}
                            </strong>

                        </span>

                    </div>


                    <div>

                        <i data-lucide="map-pin"></i>

                        <span>

                            <small>
                                Venue
                            </small>

                            <strong>
                                ${escapeBookingsHTML(
                                    venueText
                                )}
                            </strong>

                        </span>

                    </div>


                    <div>

                        <i data-lucide="armchair"></i>

                        <span>

                            <small>
                                Seats
                            </small>

                            <strong>
                                ${escapeBookingsHTML(
                                    seatText
                                )}
                            </strong>

                        </span>

                    </div>

                </div>


                <div class="my-booking-footer">

                    <div class="my-booking-total">

                        <span>
                            ${
                                booking.lifecycle ===
                                "CANCELLED"
                                    ? "Booking Amount"
                                    : "Amount Paid"
                            }
                        </span>

                        <strong>
                            ${escapeBookingsHTML(
                                formatBookingsCurrency(
                                    booking.total
                                )
                            )}
                        </strong>

                    </div>


                    <div class="my-booking-actions">

                        ${
                            canViewTicket
                                ? `

                                    <a
                                        href="./ticket.html?booking=${encodeURIComponent(
                                            booking.id
                                        )}"
                                        class="btn btn-primary"
                                    >

                                        <i data-lucide="qr-code"></i>

                                        View Ticket

                                    </a>

                                `
                                : `
                                    <span
                                        class="badge badge-danger"
                                    >
                                        Ticket Invalid
                                    </span>
                                `
                        }


                        ${
                            canCancel
                                ? `

                                    <button
                                        type="button"
                                        class="
                                            btn
                                            btn-outline
                                            booking-cancel-button
                                        "
                                        data-cancel-booking="${escapeBookingAttribute(
                                            booking.id
                                        )}"
                                    >
                                        Cancel Booking
                                    </button>

                                `
                                : ""
                        }

                    </div>

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   26. RENDERED ACTIONS
   ========================================================= */

function initializeRenderedBookingActions() {

    document
        .querySelectorAll(
            "[data-cancel-booking]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openCancelBookingModal(
                            button.dataset
                                .cancelBooking
                        );

                    }
                );

            }
        );

}


/* =========================================================
   27. STATUS VISUAL
   ========================================================= */

function getBookingStatusInfo(
    booking
) {

    if (
        booking.lifecycle ===
        "CANCELLED"
    ) {

        return {

            label:
                "Cancelled",

            badgeClass:
                "badge-danger",

            dotClass:
                "danger"

        };

    }


    if (
        booking.lifecycle ===
        "COMPLETED"
    ) {

        return {

            label:
                "Completed",

            badgeClass:
                "badge-success",

            dotClass:
                "success"

        };

    }


    if (
        booking.status ===
        "PENDING"
    ) {

        return {

            label:
                "Pending",

            badgeClass:
                "badge-warning",

            dotClass:
                "warning"

        };

    }


    return {

        label:
            "Confirmed",

        badgeClass:
            "badge-success",

        dotClass:
            "success"

    };

}


/* =========================================================
   28. CANCEL MODAL
   ========================================================= */

function initializeCancellationModal() {

    document
        .getElementById(
            "closeCancelBookingModal"
        )
        ?.addEventListener(
            "click",
            closeCancelBookingModal
        );


    document
        .getElementById(
            "keepBookingButton"
        )
        ?.addEventListener(
            "click",
            closeCancelBookingModal
        );


    document
        .getElementById(
            "confirmCancelBookingButton"
        )
        ?.addEventListener(
            "click",
            confirmBookingCancellation
        );


    document
        .getElementById(
            "cancelBookingModal"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.id ===
                    "cancelBookingModal"
                ) {

                    closeCancelBookingModal();

                }

            }
        );

}


/* =========================================================
   29. OPEN CANCEL MODAL
   ========================================================= */

function openCancelBookingModal(
    bookingId
) {

    skyraBookingsState.cancellingBookingId =
        bookingId;


    const modal =
        document.getElementById(
            "cancelBookingModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshBookingsIcons();

}


/* =========================================================
   30. CLOSE CANCEL MODAL
   ========================================================= */

function closeCancelBookingModal() {

    skyraBookingsState.cancellingBookingId =
        null;


    const modal =
        document.getElementById(
            "cancelBookingModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    const reasonInput =
        document.getElementById(
            "cancelBookingReason"
        );

    if (reasonInput) {
        reasonInput.value =
            "";
    }

}


/* =========================================================
   31. CONFIRM CANCELLATION
   ========================================================= */

async function confirmBookingCancellation() {

    const bookingId =
        skyraBookingsState
            .cancellingBookingId;


    if (!bookingId) {
        return;
    }


    const button =
        document.getElementById(
            "confirmCancelBookingButton"
        );


    const reasonInput =
        document.getElementById(
            "cancelBookingReason"
        );


    if (button) {
        button.disabled =
            true;
    }


    try {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .cancelBooking !==
                "function"
        ) {
            throw new Error(
                "Cancellation API is unavailable."
            );
        }


        const response =
            await window.SKYRA_API
                .cancelBooking(
                    bookingId,
                    {
                        reason:
                            String(
                                reasonInput?.value ||
                                ""
                            ).trim() ||
                            "Cancelled by customer."
                    }
                );


        const refundStatus =
            String(
                response?.data
                    ?.booking
                    ?.refundStatus ||
                response?.data
                    ?.refund
                    ?.status ||
                ""
            ).toUpperCase();


        closeCancelBookingModal();


        if (reasonInput) {
            reasonInput.value =
                "";
        }


        /*
           MongoDB is the source of truth. Reload the real list
           instead of applying local mock cancellation overrides.
        */
        await loadMyBookings();


        if (
            refundStatus ===
            "REFUNDED"
        ) {

            showBookingsToast(
                "Your booking was cancelled and the refund was completed.",
                "success",
                "Booking Cancelled"
            );

        } else {

            showBookingsToast(
                "Your booking was cancelled. Refund status: " +
                    (
                        refundStatus ||
                        "PENDING"
                    ),
                "warning",
                "Cancellation Saved"
            );

        }

    } catch (error) {

        console.error(
            "Cancellation failed:",
            error
        );


        showBookingsToast(
            error?.message ||
            "This booking could not be cancelled.",
            "error",
            "Cancellation Failed"
        );

    } finally {

        if (button) {
            button.disabled =
                false;
        }

    }

}




/* =========================================================
   35. USER
   ========================================================= */
function initializeBookingsUser() {
    const user = window.SKYRA_COMMON?.getUser?.();
    if (!user) return;
    const name = String(user.name || user.fullName || "Customer");
    const initials = window.SKYRA_COMMON?.createInitials?.(name) || createBookingsInitials(name);
    setBookingsText("sidebarUserName", name);
    setBookingsText("sidebarUserInitials", initials);
    setBookingsText("topbarUserName", name);
    setBookingsText("topbarUserInitials", initials);
    setBookingsText("dropdownUserName", name);
    setBookingsText("dropdownUserInitials", initials);
    if (user.email) setBookingsText("dropdownUserEmail", user.email);
}

/* =========================================================
   36. INITIALS
   ========================================================= */

function createBookingsInitials(
    name
) {

    const parts =
        String(name)
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
   37. INDICATORS
   ========================================================= */
async function updateBookingsIndicators() {
    await window.SKYRA_COMMON?.refreshCustomerIndicators?.();
}

/* =========================================================
   38. TOPBAR SEARCH
   ========================================================= */

function initializeTopbarSearch() {

    const search =
        document.getElementById(
            "dashboardSearch"
        );


    search?.addEventListener(
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
                search.value.trim();


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
   39. SIDEBAR ACTIVE
   ========================================================= */

function keepBookingsNavigationActive() {

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
                    "./my-bookings.html";


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
   40. POSTER CLASS
   ========================================================= */

function getBookingPosterClass(
    eventId
) {

    const map = {

        coldplay:
            "events-poster-coldplay",

        diljit:
            "events-poster-diljit",

        interstellar:
            "events-poster-interstellar",

        arijit:
            "events-poster-arijit",

        "comedy-night":
            "events-poster-comedy",

        "avengers-secret-wars":
            "events-poster-avengers"

    };


    return (
        map[eventId] ||
        "events-poster-coldplay"
    );

}


/* =========================================================
   41. POSTER WORD
   ========================================================= */

function getBookingPosterWord(
    title
) {

    return String(
        title ||
        "SKYRA"
    )
        .split(/\s+/)
        .slice(
            0,
            2
        )
        .join(" ")
        .toUpperCase();

}


/* =========================================================
   42. POSTER EYEBROW
   ========================================================= */

function getBookingPosterEyebrow(
    type
) {

    switch (
        String(
            type ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "CINEMA EXPERIENCE";


        case "CONCERT":

            return "LIVE EXPERIENCE";


        case "LIVE_SHOW":

            return "LIVE SHOW";


        default:

            return "SKYRA EVENT";

    }

}


/* =========================================================
   43. EVENT TYPE
   ========================================================= */

function formatBookingsEventType(
    type
) {

    switch (
        String(
            type ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "Movie";


        case "CONCERT":

            return "Concert";


        case "LIVE_SHOW":

            return "Live Show";


        default:

            return "Event";

    }

}


/* =========================================================
   44. EVENT ICON
   ========================================================= */

function getBookingsEventIcon(
    type
) {

    switch (
        String(
            type ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "film";


        case "CONCERT":

            return "music-2";


        case "LIVE_SHOW":

            return "mic-2";


        default:

            return "calendar-days";

    }

}


/* =========================================================
   45. VENUE
   ========================================================= */

function formatBookingVenue(
    venue,
    booking
) {

    if (venue) {

        return `${
            venue.shortName ||
            venue.name ||
            "Venue"
        }${
            venue.city
                ? `, ${venue.city}`
                : ""
        }`;

    }


    return (
        booking.venueName ||
        "Venue TBA"
    );

}


/* =========================================================
   46. DATE
   ========================================================= */

function formatBookingDate(
    value
) {

    const date =
        parseBookingDate(
            value
        );


    if (!date) {

        return "TBA";

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
   47. DATE PARSER
   ========================================================= */

function parseBookingDate(
    value
) {

    if (!value) {

        return null;

    }


    if (
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
   48. TIME
   ========================================================= */

function formatBookingTime(
    value
) {

    if (!value) {

        return "TBA";

    }


    if (
        !/^\d{2}:\d{2}$/.test(
            value
        )
    ) {

        return String(value);

    }


    const [
        hourValue,
        minuteValue
    ] =
        value
            .split(":")
            .map(Number);


    const period =
        hourValue >=
            12
            ? "PM"
            : "AM";


    const hours =
        hourValue %
        12 ||
        12;


    return `${
        hours
    }:${
        String(
            minuteValue
        ).padStart(
            2,
            "0"
        )
    } ${period}`;

}


/* =========================================================
   49. CURRENCY
   ========================================================= */

function formatBookingsCurrency(
    value
) {

    if (
        window.SKYRA_COMMON
            ?.formatCurrency
    ) {

        return window.SKYRA_COMMON
            .formatCurrency(
                value
            );

    }


    const amount =
        Number(value);


    return Number.isFinite(
        amount
    )
        ? `₹${
            amount.toLocaleString(
                "en-IN"
            )
        }`
        : "₹0";

}


/* =========================================================
   50. SET TEXT
   ========================================================= */

function setBookingsText(
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
   51. ESCAPE HTML
   ========================================================= */

function escapeBookingsHTML(
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
   52. ESCAPE ATTRIBUTE
   ========================================================= */

function escapeBookingAttribute(
    value
) {

    return escapeBookingsHTML(
        value
    );

}


/* =========================================================
   53. TOAST
   ========================================================= */

function showBookingsToast(
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
   54. ICONS
   ========================================================= */

function refreshBookingsIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   55. ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Escape"
        ) {

            closeCancelBookingModal();

        }

    }
);


/* =========================================================
   56. PUBLIC API
   ========================================================= */

window.SKYRA_MY_BOOKINGS_PAGE = {

    getBookings:
        () =>
            skyraBookingsState
                .bookings
                .map(
                    (booking) => ({
                        ...booking,

                        seats:
                            booking.seats.map(
                                (seat) => ({
                                    ...seat
                                })
                            )
                    })
                ),

    refresh:
        loadMyBookings,

    cancelBooking:
        (bookingId) => {

            openCancelBookingModal(
                bookingId
            );

        }

};


/* =========================================================
   END OF MY BOOKINGS
   ========================================================= */ 