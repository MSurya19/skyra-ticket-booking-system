/* =========================================================
   SKYRA - CUSTOMER DIGITAL TICKET
   File:
   frontend/js/customer/ticket.js

   Used by:
   - customer/ticket.html

   URL:
   ticket.html?booking=<bookingId>

   Current phase:
   - Loads the real confirmed booking
   - Loads the backend-generated secure QR
   - Renders a real scannable QR image
   - Print support
   - Share support

   Backend:
   - GET /api/bookings/:id
   - GET /api/bookings/:id/ticket
   - Booking/database verification
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_TICKET = { LATEST_BOOKING_KEY: "skyra_latest_booking" };


/* =========================================================
   2. STATE
   ========================================================= */

const skyraTicketState = {

    bookingId:
        null,

    booking:
        null,

    event:
        null,

    show:
        null,

    venue:
        null

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeTicketPage();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

async function initializeTicketPage() {

    initializeTicketUser();

    updateTicketIndicators();

    initializeTicketSearch();

    initializeTicketActions();

    keepTicketBookingsNavigationActive();


    const params =
        new URLSearchParams(
            window.location.search
        );


    const bookingId =
        params.get("booking");


    const booking =
        await loadTicketBooking(
            bookingId
        );


    if (!booking) {

        showTicketNotFound(
            "We couldn't find the requested booking."
        );


        return;

    }


    skyraTicketState.bookingId =
        getTicketBookingId(
            booking
        );


    skyraTicketState.booking =
        normalizeTicketBooking(
            booking
        );


    resolveTicketRelationships();

    hideTicketNotFound();

    renderTicketPage();

    refreshTicketIcons();

}


/* =========================================================
   5. LOAD BOOKING - BACKEND / SESSION ONLY
   ========================================================= */
async function loadTicketBooking(requestedBookingId) {
    if (requestedBookingId && window.SKYRA_API?.getBookingTicket) {
        try {
            const response = await window.SKYRA_API.getBookingTicket(requestedBookingId);
            const booking = response?.data?.booking || response?.booking || null;
            const qrDataUrl = response?.data?.qrDataUrl || response?.qrDataUrl || null;
            if (booking) return { ...booking, qrDataUrl };
        } catch (error) {
            console.error("Unable to load secure QR ticket.", error);
        }
    }

    if (requestedBookingId && window.SKYRA_API?.getBooking) {
        try {
            const response = await window.SKYRA_API.getBooking(requestedBookingId);
            const booking = response?.booking || response?.data?.booking || response?.data || response;
            if (booking) return booking;
        } catch (error) {
            console.error("Unable to load booking.", error);
        }
    }

    const latest = getTicketLatestBooking();
    if (latest && (!requestedBookingId || getTicketBookingId(latest) === requestedBookingId)) return latest;
    return null;
}

/* =========================================================
   6. LATEST BOOKING
   ========================================================= */

function getTicketLatestBooking() {

    try {

        const stored =
            sessionStorage.getItem(
                SKYRA_TICKET
                    .LATEST_BOOKING_KEY
            );


        return stored
            ? JSON.parse(
                stored
            )
            : null;

    } catch {

        return null;

    }

}




/* =========================================================
   8. BOOKING ID
   ========================================================= */

function getTicketBookingId(
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
   9. NORMALIZE BOOKING
   ========================================================= */

function normalizeTicketBooking(
    rawBooking
) {

    const id =
        getTicketBookingId(
            rawBooking
        );


    const booking = rawBooking;


    const embeddedEvent =
        booking.event &&
        typeof booking.event ===
            "object"
            ? booking.event
            : null;


    const embeddedShow =
        booking.show &&
        typeof booking.show ===
            "object"
            ? booking.show
            : null;


    const embeddedVenue =
        booking.venue &&
        typeof booking.venue ===
            "object"
            ? booking.venue
            : null;


    const seats =
        normalizeTicketSeats(
            booking.seats ||
            booking.selectedSeats ||
            []
        );


    const subtotal =
        Number(
            booking.subtotal ??
            booking.ticketSubtotal ??
            seats.reduce(
                (
                    total,
                    seat
                ) =>
                    total +
                    Number(
                        seat.price ||
                        0
                    ),
                0
            )
        );


    const fee =
        Number(
            booking.convenienceFee ??
            booking.bookingFee ??
            booking.fee ??
            0
        );


    return {

        ...booking,

        id,

        bookingReference:
            String(
                booking.bookingReference ||
                booking.reference ||
                booking.bookingRef ||
                booking.ticketReference ||
                id
            ),

        eventId:
            booking.eventId ||
            embeddedEvent?.id ||
            embeddedEvent?._id ||
            null,

        showId:
            booking.showId ||
            embeddedShow?.id ||
            embeddedShow?._id ||
            null,

        venueId:
            booking.venueId ||
            embeddedVenue?.id ||
            embeddedVenue?._id ||
            null,

        event:
            embeddedEvent,

        show:
            embeddedShow,

        venue:
            embeddedVenue,

        seats,

        subtotal,

        convenienceFee:
            fee,

        total:
            Number(
                booking.grandTotal ??
                booking.total ??
                booking.totalAmount ??
                booking.amount ??
                subtotal +
                fee
            ),

        status:
            String(
                booking.status ||
                "CONFIRMED"
            ).toUpperCase(),

        paymentStatus:
            String(
                booking.paymentStatus ||
                booking.payment?.status ||
                "SUCCESS"
            ).toUpperCase(),

        bookedAt:
            booking.bookedAt ||
            booking.createdAt ||
            booking.bookingDate ||
            null,

        qrCode:
            booking.qrCode ||
            booking.qrCodeDataUrl ||
            booking.qrDataUrl ||
            booking.ticket?.qrCode ||
            null

    };

}


/* =========================================================
   10. SEATS
   ========================================================= */

function normalizeTicketSeats(
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
                    `ticket_seat_${
                        index + 1
                    }`
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
   12. RELATIONSHIPS
   Flat booking snapshots from MongoDB are sufficient; no
   frontend catalogue lookup is used.
   ========================================================= */
function resolveTicketRelationships() {
    const booking = skyraTicketState.booking;
    if (!booking) return;

    skyraTicketState.event = booking.event && typeof booking.event === "object"
        ? booking.event
        : { id: booking.eventId || null, title: booking.eventTitle || "SKYRA Event", type: booking.eventType || "EVENT" };
    skyraTicketState.show = booking.show && typeof booking.show === "object"
        ? booking.show
        : { id: booking.showId || null, date: booking.date || booking.showDate || null, time: booking.time || booking.showTime || null, startsAt: booking.startsAt || null };
    skyraTicketState.venue = booking.venue && typeof booking.venue === "object"
        ? booking.venue
        : { id: booking.venueId || null, name: booking.venueName || "Venue", city: booking.venueCity || "" };
}

/* =========================================================
   13. RENDER PAGE
   ========================================================= */

function renderTicketPage() {

    renderTicketReference();

    renderTicketEvent();

    renderTicketSeatInformation();

    renderTicketBookingDetails();

    renderTicketVenue();

    renderTicketQR();

    renderTicketValidity();

    updateTicketDocumentTitle();

}


/* =========================================================
   14. REFERENCE
   ========================================================= */

function renderTicketReference() {

    const reference =
        skyraTicketState
            .booking
            ?.bookingReference;


    setTicketText(
        "fullTicketReference",
        reference
    );


    setTicketText(
        "ticketSideReference",
        reference
    );

}


/* =========================================================
   15. EVENT
   ========================================================= */

function renderTicketEvent() {

    const booking =
        skyraTicketState.booking;


    const event =
        skyraTicketState.event;


    const show =
        skyraTicketState.show;


    const venue =
        skyraTicketState.venue;


    const title =
        event?.title ||
        booking?.event?.title ||
        booking?.eventTitle ||
        "SKYRA Event";


    const type =
        event?.type ||
        booking?.event?.type ||
        booking?.eventType ||
        "EVENT";


    const venueText =
        formatTicketVenue(
            venue,
            booking
        );


    setTicketText(
        "fullTicketEventTitle",
        title
    );


    setTicketText(
        "fullTicketVenue",
        venueText
    );


    setTicketText(
        "fullTicketDate",
        formatTicketDate(
            show?.date ||
            booking?.eventDate ||
            booking?.date
        )
    );


    setTicketText(
        "fullTicketTime",
        formatTicketTime(
            show?.time ||
            booking?.eventTime ||
            booking?.time
        )
    );


    renderFullTicketEventType(
        type
    );


    renderFullTicketEventMark(
        event,
        title
    );

}


/* =========================================================
   16. EVENT TYPE
   ========================================================= */

function renderFullTicketEventType(
    type
) {

    const element =
        document.getElementById(
            "fullTicketEventType"
        );


    if (!element) {

        return;

    }


    element.innerHTML = `

        <i
            data-lucide="${getTicketEventIcon(
                type
            )}"
        ></i>

        ${escapeTicketHTML(
            formatTicketEventType(
                type
            )
        )}

    `;

}


/* =========================================================
   17. EVENT MARK
   ========================================================= */

function renderFullTicketEventMark(
    event,
    title
) {

    const mark =
        document.getElementById(
            "fullTicketEventMark"
        );


    if (!mark) {

        return;

    }


    mark.classList.remove(

        "events-poster-coldplay",

        "events-poster-diljit",

        "events-poster-interstellar",

        "events-poster-arijit",

        "events-poster-comedy",

        "events-poster-avengers"

    );


    mark.classList.add(
        getTicketPosterClass(
            event?.id ||
            event?._id
        )
    );


    setTicketText(
        "fullTicketPosterWord",
        getTicketPosterWord(
            title
        )
    );

}


/* =========================================================
   18. SEAT INFORMATION
   ========================================================= */

function renderTicketSeatInformation() {

    const seats =
        skyraTicketState
            .booking
            ?.seats ||
        [];


    const labels =
        seats
            .map(
                (seat) =>
                    seat.label
            )
            .join(", ");


    const categories =
        [
            ...new Set(
                seats.map(
                    (seat) =>
                        seat.category
                )
            )
        ]
            .filter(Boolean)
            .join(", ");


    setTicketText(
        "fullTicketSeats",
        labels ||
        "See booking"
    );


    setTicketText(
        "fullTicketCategory",
        categories ||
        "Standard"
    );

}


/* =========================================================
   19. BOOKING DETAILS
   ========================================================= */

function renderTicketBookingDetails() {

    const booking =
        skyraTicketState.booking;


    if (!booking) {

        return;

    }


    setTicketText(
        "ticketSidePaymentStatus",
        formatTicketStatus(
            booking.paymentStatus
        )
    );


    setTicketText(
        "ticketSideAmount",
        formatTicketCurrency(
            booking.total
        )
    );


    setTicketText(
        "ticketSideBookedAt",
        formatNormalTicketDate(
            booking.bookedAt
        )
    );

}


/* =========================================================
   20. VENUE
   ========================================================= */

function renderTicketVenue() {

    const booking =
        skyraTicketState.booking;


    const venue =
        skyraTicketState.venue;


    const name =
        venue?.name ||
        booking?.venue?.name ||
        booking?.venueName ||
        "Venue TBA";


    const address =
        venue?.address ||
        booking?.venue?.address ||
        [
            venue?.city,
            venue?.state
        ]
            .filter(Boolean)
            .join(", ") ||
        booking?.venue?.city ||
        "Venue details available with booking";


    setTicketText(
        "ticketVenueName",
        name
    );


    setTicketText(
        "ticketVenueAddress",
        address
    );

}


/* =========================================================
   21. REAL QR
   ========================================================= */

function renderTicketQR() {

    const booking =
        skyraTicketState.booking;


    const container =
        document.getElementById(
            "fullTicketQRCode"
        );


    if (
        !booking ||
        !container
    ) {

        return;

    }


    const qrDataUrl =
        String(
            booking.qrCode ||
            ""
        ).trim();


    /*
       Only a real PNG generated by the backend is accepted.
       Never display a decorative fallback as a ticket QR.
    */

    if (
        /^data:image\/png;base64,/i.test(
            qrDataUrl
        )
    ) {

        const image =
            document.createElement(
                "img"
            );


        image.id =
            "skyraRealTicketQrImage";

        image.dataset.skyraRealQr =
            "true";

        image.src =
            qrDataUrl;

        image.alt =
            `SKYRA ticket QR for ${
                booking.bookingReference
            }`;


        Object.assign(
            image.style,
            {
                display:
                    "block",

                width:
                    "230px",

                maxWidth:
                    "100%",

                height:
                    "230px",

                objectFit:
                    "contain",

                margin:
                    "0 auto",

                padding:
                    "8px",

                background:
                    "#ffffff",

                borderRadius:
                    "10px"
            }
        );


        container.replaceChildren(
            image
        );


        container.dataset.skyraRealQrContainer =
            "true";


        return;

    }


    /*
       If QR loading fails, show a clear error state.
       Do NOT render the old fake square pattern.
    */

    container.innerHTML = `
        <div
            class="ticket-qr-unavailable"
            role="status"
            style="
                display:flex;
                align-items:center;
                justify-content:center;
                min-height:230px;
                padding:16px;
                text-align:center;
                color:#94a3b8;
                background:#ffffff;
                border-radius:10px;
            "
        >
            Secure QR unavailable.<br>
            Refresh the ticket page.
        </div>
    `;

}


/* =========================================================
   23. VALIDITY
   ========================================================= */

function renderTicketValidity() {

    const booking =
        skyraTicketState.booking;


    if (!booking) {

        return;

    }


    const cancelled =
        booking.status ===
        "CANCELLED";


    const status =
        document.querySelector(
            ".full-ticket-status"
        );


    const verification =
        document.querySelector(
            ".full-ticket-verification"
        );


    if (status) {

        if (cancelled) {

            status.innerHTML = `

                <i data-lucide="circle-x"></i>

                Cancelled & Invalid

            `;


            status.style.color =
                "#f87171";


            status.style.borderColor =
                "rgba(239, 68, 68, 0.18)";


            status.style.background =
                "rgba(239, 68, 68, 0.05)";

        } else {

            status.innerHTML = `

                <i data-lucide="badge-check"></i>

                Confirmed & Valid

            `;

        }

    }


    const bookingStatusElement =
        findBookingStatusElement();


    if (bookingStatusElement) {

        bookingStatusElement.textContent =
            formatTicketStatus(
                booking.status
            );


        if (cancelled) {

            bookingStatusElement.classList
                .remove(
                    "success-text"
                );


            bookingStatusElement.style.color =
                "#f87171";

        }

    }


    if (
        verification &&
        cancelled
    ) {

        verification.innerHTML = `

            <i data-lucide="shield-x"></i>

            <span>
                Ticket Invalid
            </span>

        `;


        verification.style.color =
            "#f87171";

    }

}


/* =========================================================
   24. FIND BOOKING STATUS
   HTML currently has no ID for this field.
   ========================================================= */

function findBookingStatusElement() {

    const rows =
        document.querySelectorAll(
            ".full-ticket-info-list > div"
        );


    for (
        const row of rows
    ) {

        const label =
            row.querySelector(
                "span"
            );


        const value =
            row.querySelector(
                "strong"
            );


        if (
            label?.textContent
                ?.trim() ===
                "Booking Status"
        ) {

            return value;

        }

    }


    return null;

}


/* =========================================================
   25. ACTIONS
   ========================================================= */

function initializeTicketActions() {

    document
        .getElementById(
            "printTicketButton"
        )
        ?.addEventListener(
            "click",
            printSkyraTicket
        );


    document
        .getElementById(
            "shareTicketButton"
        )
        ?.addEventListener(
            "click",
            shareSkyraTicket
        );

}


/* =========================================================
   26. PRINT
   ========================================================= */

function printSkyraTicket() {

    window.print();

}


/* =========================================================
   27. SHARE
   ========================================================= */

async function shareSkyraTicket() {

    const booking =
        skyraTicketState.booking;


    const event =
        skyraTicketState.event;


    if (!booking) {

        return;

    }


    const title =
        event?.title ||
        booking.eventTitle ||
        "SKYRA Ticket";


    const shareData = {

        title:
            `${title} | SKYRA`,

        text:
            `SKYRA booking ${booking.bookingReference} for ${title}.`,

        url:
            window.location.href

    };


    try {

        if (
            navigator.share
        ) {

            await navigator.share(
                shareData
            );


            return;

        }


        await navigator.clipboard
            .writeText(
                window.location.href
            );


        showTicketToast(
            "Ticket link copied.",
            "success",
            "Copied"
        );

    } catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {

            return;

        }


        showTicketToast(
            "Unable to share this ticket.",
            "error",
            "Share Failed"
        );

    }

}


/* =========================================================
   28. USER
   ========================================================= */
function initializeTicketUser() {
    const user = window.SKYRA_COMMON?.getUser?.();
    if (!user) return;
    const name = String(user.name || user.fullName || "Customer");
    const initials = window.SKYRA_COMMON?.createInitials?.(name) || createTicketInitials(name);
    setTicketText("sidebarUserName", name);
    setTicketText("sidebarUserInitials", initials);
    setTicketText("topbarUserName", name);
    setTicketText("topbarUserInitials", initials);
    setTicketText("dropdownUserName", name);
    setTicketText("dropdownUserInitials", initials);
    if (user.email) setTicketText("dropdownUserEmail", user.email);
}

/* =========================================================
   29. INITIALS
   ========================================================= */

function createTicketInitials(
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
   30. INDICATORS
   ========================================================= */
function updateTicketIndicators() {
    window.SKYRA_COMMON?.refreshCustomerIndicators?.();
}

/* =========================================================
   31. SEARCH
   ========================================================= */

function initializeTicketSearch() {

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


            const query =
                search.value.trim();


            if (!query) {

                return;

            }


            window.location.href =
                `./events.html?search=${
                    encodeURIComponent(
                        query
                    )
                }`;

        }
    );

}


/* =========================================================
   32. ACTIVE NAV
   ========================================================= */

function keepTicketBookingsNavigationActive() {

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
   33. NOT FOUND
   ========================================================= */

function showTicketNotFound(
    message
) {

    const state =
        document.getElementById(
            "ticketNotFoundState"
        );


    const content =
        document.getElementById(
            "ticketPageContent"
        );


    setTicketText(
        "ticketNotFoundMessage",
        message
    );


    if (state) {

        state.hidden =
            false;

    }


    if (content) {

        content.hidden =
            true;

    }


    document.title =
        "Ticket Unavailable | SKYRA";


    refreshTicketIcons();

}


/* =========================================================
   34. HIDE NOT FOUND
   ========================================================= */

function hideTicketNotFound() {

    const state =
        document.getElementById(
            "ticketNotFoundState"
        );


    const content =
        document.getElementById(
            "ticketPageContent"
        );


    if (state) {

        state.hidden =
            true;

    }


    if (content) {

        content.hidden =
            false;

    }

}


/* =========================================================
   35. DOCUMENT TITLE
   ========================================================= */

function updateTicketDocumentTitle() {

    const title =
        skyraTicketState.event
            ?.title;


    document.title =
        title
            ? `${title} Ticket | SKYRA`
            : "My Ticket | SKYRA";

}


/* =========================================================
   36. EVENT TYPE
   ========================================================= */

function formatTicketEventType(
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
   37. EVENT ICON
   ========================================================= */

function getTicketEventIcon(
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
   38. POSTER CLASS
   ========================================================= */

function getTicketPosterClass(
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
   39. POSTER WORD
   ========================================================= */

function getTicketPosterWord(
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
   40. VENUE
   ========================================================= */

function formatTicketVenue(
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


    if (
        booking?.venue &&
        typeof booking.venue ===
            "object"
    ) {

        return `${
            booking.venue.name ||
            "Venue"
        }${
            booking.venue.city
                ? `, ${
                    booking.venue.city
                }`
                : ""
        }`;

    }


    return (
        booking?.venueName ||
        "Venue TBA"
    );

}


/* =========================================================
   41. DATE
   ========================================================= */

function formatTicketDate(
    value
) {

    const date =
        parseTicketDate(
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
    )
        .format(
            date
        )
        .toUpperCase();

}


/* =========================================================
   42. NORMAL DATE
   ========================================================= */

function formatNormalTicketDate(
    value
) {

    const date =
        parseTicketDate(
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
   43. PARSE DATE
   ========================================================= */

function parseTicketDate(
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
   44. TIME
   ========================================================= */

function formatTicketTime(
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
   45. STATUS
   ========================================================= */

function formatTicketStatus(
    value
) {

    return String(
        value ||
        ""
    )
        .toLowerCase()
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );

}


/* =========================================================
   46. CURRENCY
   ========================================================= */

function formatTicketCurrency(
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
   47. TEXT SETTER
   ========================================================= */

function setTicketText(
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
   48. ESCAPE HTML
   ========================================================= */

function escapeTicketHTML(
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
   49. TOAST
   ========================================================= */

function showTicketToast(
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
   50. ICONS
   ========================================================= */

function refreshTicketIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   51. PUBLIC API
   ========================================================= */

window.SKYRA_TICKET_PAGE = {

    getBooking:
        () =>
            skyraTicketState.booking
                ? {
                    ...skyraTicketState
                        .booking,

                    seats:
                        skyraTicketState
                            .booking
                            .seats
                            ?.map(
                                (seat) => ({
                                    ...seat
                                })
                            )
                }
                : null,

    print:
        printSkyraTicket,

    share:
        shareSkyraTicket

};


/* =========================================================
   END OF SKYRA DIGITAL TICKET
   ========================================================= */