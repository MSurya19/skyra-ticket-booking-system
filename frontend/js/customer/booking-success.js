/* =========================================================
   SKYRA - CUSTOMER BOOKING SUCCESS
   File:
   frontend/js/customer/booking-success.js

   Used by:
   - customer/booking-success.html

   Current frontend phase:
   - Displays event/show/venue/seats/payment
   - Builds ticket preview
   - Copies booking reference
   - Routes to full ticket page

   Final backend phase:
   - GET /api/bookings/:bookingId
   - Render confirmed Booking from MongoDB
   - Display backend-generated QR
   - Email already sent by backend
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_BOOKING_SUCCESS = { LATEST_BOOKING_KEY: "skyra_latest_booking" };


/* =========================================================
   2. STATE
   ========================================================= */

const skyraBookingSuccessState = {

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

        initializeBookingSuccessPage();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

async function initializeBookingSuccessPage() {

    initializeBookingSuccessUser();

    updateBookingSuccessIndicators();

    initializeBookingSuccessSearch();

    initializeBookingReferenceCopy();


    const params =
        new URLSearchParams(
            window.location.search
        );


    const bookingId =
        params.get("booking");


    const booking =
        await loadBookingSuccessData(
            bookingId
        );


    if (!booking) {

        showBookingSuccessNotFound(
            "We couldn't find this booking confirmation."
        );


        return;

    }


    skyraBookingSuccessState.bookingId =
        getBookingId(
            booking
        );


    skyraBookingSuccessState.booking =
        normalizeSuccessBooking(
            booking
        );


    resolveBookingRelationships();

    hideBookingSuccessNotFound();

    renderBookingSuccessPage();

    keepBookingSuccessNavigationActive();

    refreshBookingSuccessIcons();

}


/* =========================================================
   5. LOAD BOOKING - BACKEND / SESSION ONLY
   ========================================================= */
async function loadBookingSuccessData(requestedBookingId) {
    if (requestedBookingId && window.SKYRA_API?.getBooking) {
        try {
            const response = await window.SKYRA_API.getBooking(requestedBookingId);
            const booking = response?.booking || response?.data?.booking || response?.data || response;
            if (booking) return booking;
        } catch (error) {
            console.error("Unable to load booking from API.", error);
        }
    }

    const latest = getLatestSessionBooking();
    if (latest && (!requestedBookingId || getBookingId(latest) === requestedBookingId)) return latest;
    return null;
}

/* =========================================================
   6. LATEST SESSION BOOKING
   ========================================================= */

function getLatestSessionBooking() {

    try {

        const stored =
            sessionStorage.getItem(
                SKYRA_BOOKING_SUCCESS
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
   9. NORMALIZE BOOKING
   ========================================================= */

function normalizeSuccessBooking(
    booking
) {

    const eventObject =
        booking.event &&
        typeof booking.event ===
            "object"
            ? booking.event
            : null;


    const showObject =
        booking.show &&
        typeof booking.show ===
            "object"
            ? booking.show
            : null;


    const venueObject =
        booking.venue &&
        typeof booking.venue ===
            "object"
            ? booking.venue
            : null;


    const rawSeats =
        booking.seats ||
        booking.selectedSeats ||
        [];


    const seats =
        Array.isArray(
            rawSeats
        )
            ? rawSeats.map(
                (
                    seat,
                    index
                ) => ({

                    id:
                        String(
                            seat.id ||
                            seat._id ||
                            seat.showSeatId ||
                            `booking_seat_${
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
            )
            : [];


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
                    seat.price,
                0
            )
        );


    const convenienceFee =
        Number(
            booking.convenienceFee ??
            booking.fee ??
            booking.bookingFee ??
            0
        );


    const total =
        Number(
            booking.total ??
            booking.totalAmount ??
            booking.amount ??
            subtotal +
            convenienceFee
        );


    return {

        ...booking,

        id:
            getBookingId(
                booking
            ),

        bookingReference:
            String(
                booking.bookingReference ||
                booking.reference ||
                booking.bookingRef ||
                booking.ticketReference ||
                getBookingId(
                    booking
                ) ||
                "SKYRA"
            ),

        eventId:
            booking.eventId ||
            eventObject?.id ||
            eventObject?._id ||
            null,

        showId:
            booking.showId ||
            showObject?.id ||
            showObject?._id ||
            null,

        venueId:
            booking.venueId ||
            venueObject?.id ||
            venueObject?._id ||
            null,

        event:
            eventObject,

        show:
            showObject,

        venue:
            venueObject,

        seats,

        subtotal,

        convenienceFee,

        total,

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

        email:
            booking.email ||
            booking.customerEmail ||
            booking.contact?.email ||
            null,

        bookedAt:
            booking.bookedAt ||
            booking.createdAt ||
            booking.bookingDate ||
            new Date()
                .toISOString(),

        qrCode:
            booking.qrCode ||
            booking.qrCodeDataUrl ||
            booking.qrDataUrl ||
            booking.ticketQr ||
            booking.ticket?.qrCode ||
            null

    };

}


/* =========================================================
   10. RESOLVE EVENT / SHOW / VENUE
   Uses the persisted booking snapshot; no frontend catalogue
   fallback is permitted.
   ========================================================= */
function resolveBookingRelationships() {
    const booking = skyraBookingSuccessState.booking;
    if (!booking) return;
    skyraBookingSuccessState.event = booking.event && typeof booking.event === "object"
        ? booking.event
        : { id: booking.eventId || null, title: booking.eventTitle || "SKYRA Event", type: booking.eventType || "EVENT" };
    skyraBookingSuccessState.show = booking.show && typeof booking.show === "object"
        ? booking.show
        : { id: booking.showId || null, date: booking.date || booking.showDate || null, time: booking.time || booking.showTime || null, startsAt: booking.startsAt || null };
    skyraBookingSuccessState.venue = booking.venue && typeof booking.venue === "object"
        ? booking.venue
        : { id: booking.venueId || null, name: booking.venueName || "Venue", city: booking.venueCity || "" };
}

/* =========================================================
   11. RENDER PAGE
   ========================================================= */

function renderBookingSuccessPage() {

    renderBookingReference();

    renderSuccessEvent();

    renderSuccessSeats();

    renderSuccessPayment();

    renderSuccessEmail();

    renderSuccessTicketPreview();

    updateSuccessTicketLinks();

    updateBookingSuccessDocumentTitle();

}


/* =========================================================
   12. BOOKING REFERENCE
   ========================================================= */

function renderBookingReference() {

    const booking =
        skyraBookingSuccessState
            .booking;


    if (!booking) {

        return;

    }


    setSuccessText(
        "successBookingReference",
        booking.bookingReference
    );


    setSuccessText(
        "ticketPreviewReference",
        booking.bookingReference
    );

}


/* =========================================================
   13. RENDER EVENT
   ========================================================= */

function renderSuccessEvent() {

    const booking =
        skyraBookingSuccessState
            .booking;


    const event =
        skyraBookingSuccessState
            .event;


    const show =
        skyraBookingSuccessState
            .show;


    const venue =
        skyraBookingSuccessState
            .venue;


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


    const date =
        show?.date ||
        booking?.show?.date ||
        booking?.eventDate ||
        booking?.date;


    const time =
        show?.time ||
        booking?.show?.time ||
        booking?.eventTime ||
        booking?.time;


    const venueName =
        formatSuccessVenue(
            venue,
            booking
        );


    setSuccessText(
        "successEventTitle",
        title
    );


    setSuccessText(
        "successEventDate",
        formatSuccessDate(
            date
        )
    );


    setSuccessText(
        "successEventTime",
        formatSuccessTime(
            time
        )
    );


    setSuccessText(
        "successEventVenue",
        venueName
    );


    renderSuccessEventType(
        type
    );


    renderSuccessPoster(
        event,
        title
    );

}


/* =========================================================
   14. EVENT TYPE
   ========================================================= */

function renderSuccessEventType(
    type
) {

    const element =
        document.getElementById(
            "successEventType"
        );


    if (!element) {

        return;

    }


    element.innerHTML = `

        <i
            data-lucide="${getSuccessEventIcon(
                type
            )}"
        ></i>

        ${escapeSuccessHTML(
            formatSuccessEventType(
                type
            )
        )}

    `;

}


/* =========================================================
   15. POSTER
   ========================================================= */

function renderSuccessPoster(
    event,
    title
) {

    const poster =
        document.getElementById(
            "successEventPoster"
        );


    const content =
        document.getElementById(
            "successEventPosterContent"
        );


    if (
        !poster ||
        !content
    ) {

        return;

    }


    poster.classList.remove(

        "events-poster-coldplay",

        "events-poster-diljit",

        "events-poster-interstellar",

        "events-poster-arijit",

        "events-poster-comedy",

        "events-poster-avengers"

    );


    poster.classList.add(
        getSuccessPosterClass(
            event?.id ||
            event?._id
        )
    );


    content.innerHTML =
        getSuccessPosterContent(
            event,
            title
        );

}


/* =========================================================
   16. POSTER CLASS
   ========================================================= */

function getSuccessPosterClass(
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
        "events-poster-interstellar"
    );

}


/* =========================================================
   17. POSTER CONTENT
   ========================================================= */

function getSuccessPosterContent(
    event,
    fallbackTitle
) {

    switch (
        event?.id ||
        event?._id
    ) {

        case "coldplay":

            return `
                <small>MUSIC OF THE SPHERES</small>
                <strong>COLDPLAY</strong>
                <span>LIVE 2026</span>
            `;


        case "diljit":

            return `
                <small>INDIA TOUR</small>
                <strong>DILJIT</strong>
                <span>DOSANJH</span>
            `;


        case "interstellar":

            return `
                <small>IMAX EXPERIENCE</small>
                <strong>INTERSTELLAR</strong>
                <span>SCIENCE BEYOND TIME</span>
            `;


        case "arijit":

            return `
                <small>LIVE IN CONCERT</small>
                <strong>ARIJIT</strong>
                <span>SINGH</span>
            `;


        case "comedy-night":

            return `
                <small>LIVE COMEDY</small>
                <strong>COMEDY</strong>
                <span>NIGHT</span>
            `;


        case "avengers-secret-wars":

            return `
                <small>MARVEL STUDIOS</small>
                <strong>AVENGERS</strong>
                <span>SECRET WARS</span>
            `;


        default:

            return `

                <small>
                    SKYRA EXPERIENCE
                </small>

                <strong>
                    ${escapeSuccessHTML(
                        getSuccessPosterTitle(
                            fallbackTitle
                        )
                    )}
                </strong>

            `;

    }

}


/* =========================================================
   18. POSTER TITLE
   ========================================================= */

function getSuccessPosterTitle(
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
   19. SEATS
   ========================================================= */

function renderSuccessSeats() {

    const booking =
        skyraBookingSuccessState
            .booking;


    const container =
        document.getElementById(
            "successSeatList"
        );


    if (
        !booking ||
        !container
    ) {

        return;

    }


    const seats =
        booking.seats ||
        [];


    setSuccessText(
        "successSeatCount",
        seats.length
    );


    if (!seats.length) {

        container.innerHTML = `

            <div
                class="booking-success-seat"
            >

                <div>

                    <strong>
                        Seat details unavailable
                    </strong>

                    <small>
                        Check your full ticket.
                    </small>

                </div>

            </div>

        `;


        return;

    }


    container.innerHTML =
        seats
            .map(
                (seat) => `

                    <article
                        class="booking-success-seat"
                    >

                        <span>
                            ${escapeSuccessHTML(
                                seat.label
                            )}
                        </span>


                        <div>

                            <strong>
                                Seat ${escapeSuccessHTML(
                                    seat.label
                                )}
                            </strong>

                            <small>
                                ${escapeSuccessHTML(
                                    seat.category
                                )}
                            </small>

                        </div>


                        <strong>
                            ${escapeSuccessHTML(
                                formatSuccessCurrency(
                                    seat.price
                                )
                            )}
                        </strong>

                    </article>

                `
            )
            .join("");

}


/* =========================================================
   20. PAYMENT
   ========================================================= */

function renderSuccessPayment() {

    const booking =
        skyraBookingSuccessState
            .booking;


    if (!booking) {

        return;

    }


    setSuccessText(
        "successSubtotal",
        formatSuccessCurrency(
            booking.subtotal
        )
    );


    setSuccessText(
        "successConvenienceFee",
        formatSuccessCurrency(
            booking.convenienceFee
        )
    );


    setSuccessText(
        "successTotal",
        formatSuccessCurrency(
            booking.total
        )
    );


    setSuccessText(
        "successPaymentStatus",
        formatSuccessStatus(
            booking.paymentStatus
        )
    );


    setSuccessText(
        "successBookedAt",
        formatSuccessDate(
            booking.bookedAt
        )
    );

}


/* =========================================================
   21. EMAIL
   ========================================================= */

function renderSuccessEmail() {

    const booking =
        skyraBookingSuccessState
            .booking;


    const user = window.SKYRA_COMMON?.getUser?.();


    setSuccessText(

        "successCustomerEmail",

        booking?.email ||
        user?.email ||
        "your registered email"

    );

}


/* =========================================================
   22. TICKET PREVIEW
   ========================================================= */

function renderSuccessTicketPreview() {

    const booking =
        skyraBookingSuccessState
            .booking;


    if (!booking) {

        return;

    }


    const event =
        skyraBookingSuccessState
            .event;


    const show =
        skyraBookingSuccessState
            .show;


    const venue =
        skyraBookingSuccessState
            .venue;


    const title =
        event?.title ||
        booking.event?.title ||
        booking.eventTitle ||
        "SKYRA Event";


    const date =
        show?.date ||
        booking.show?.date ||
        booking.eventDate ||
        booking.date;


    const time =
        show?.time ||
        booking.show?.time ||
        booking.eventTime ||
        booking.time;


    const seats =
        booking.seats
            .map(
                (seat) =>
                    seat.label
            )
            .join(", ");


    setSuccessText(
        "ticketPreviewEventTitle",
        title
    );


    setSuccessText(
        "ticketPreviewVenue",
        formatSuccessVenue(
            venue,
            booking
        )
    );


    setSuccessText(
        "ticketPreviewDate",
        formatTicketPreviewDate(
            date
        )
    );


    setSuccessText(
        "ticketPreviewTime",
        formatSuccessTime(
            time
        )
    );


    setSuccessText(
        "ticketPreviewSeats",
        seats ||
        "See Ticket"
    );


    renderBookingQRCode(
        booking
    );

}


/* =========================================================
   23. QR CODE
   ========================================================= */

function renderBookingQRCode(
    booking
) {

    const container =
        document.getElementById(
            "successQRCode"
        );


    if (!container) {

        return;

    }


    /*
       FINAL BACKEND:
       Backend may return a QR data URL.
    */

    if (
        booking.qrCode &&
        (
            String(
                booking.qrCode
            ).startsWith(
                "data:image"
            ) ||
            String(
                booking.qrCode
            ).startsWith(
                "http"
            )
        )
    ) {

        const image =
            document.createElement(
                "img"
            );


        image.src =
            booking.qrCode;


        image.alt =
            `QR ticket for ${
                booking.bookingReference
            }`;


        container.replaceChildren(
            image
        );


        return;

    }


    container.innerHTML = `

        <div class="booking-qr-unavailable" role="status">
            QR ticket is not available yet. Open your ticket to retry.
        </div>

    `;

}


/* =========================================================
   25. COPY BOOKING REFERENCE
   ========================================================= */

function initializeBookingReferenceCopy() {

    document
        .getElementById(
            "copyBookingReferenceButton"
        )
        ?.addEventListener(
            "click",
            copyBookingReference
        );

}


/* =========================================================
   26. COPY
   ========================================================= */

async function copyBookingReference() {

    const reference =
        skyraBookingSuccessState
            .booking
            ?.bookingReference;


    if (!reference) {

        return;

    }


    try {

        await navigator
            .clipboard
            .writeText(
                reference
            );


        showBookingSuccessToast(
            "Booking reference copied.",
            "success",
            "Copied"
        );

    } catch {

        /*
           Browser fallback.
        */

        const temporary =
            document.createElement(
                "textarea"
            );


        temporary.value =
            reference;


        temporary.style.position =
            "fixed";


        temporary.style.opacity =
            "0";


        document.body.appendChild(
            temporary
        );


        temporary.select();


        try {

            document.execCommand(
                "copy"
            );


            showBookingSuccessToast(
                "Booking reference copied.",
                "success",
                "Copied"
            );

        } catch {

            showBookingSuccessToast(
                reference,
                "info",
                "Booking Reference"
            );

        }


        temporary.remove();

    }

}


/* =========================================================
   27. TICKET LINKS
   ========================================================= */

function updateSuccessTicketLinks() {

    const bookingId =
        skyraBookingSuccessState
            .bookingId;


    if (!bookingId) {

        return;

    }


    const ticketURL =
        `./ticket.html?booking=${
            encodeURIComponent(
                bookingId
            )
        }`;


    [
        "viewTicketButton",
        "bottomViewTicketButton"
    ]
        .forEach(
            (id) => {

                const link =
                    document.getElementById(
                        id
                    );


                if (link) {

                    link.href =
                        ticketURL;

                }

            }
        );

}


/* =========================================================
   28. USER
   ========================================================= */
function initializeBookingSuccessUser() {
    const user = window.SKYRA_COMMON?.getUser?.();
    if (!user) return;
    const name = String(user.name || user.fullName || "Customer").trim();
    const initials = window.SKYRA_COMMON?.createInitials?.(name) || createBookingSuccessInitials(name);
    setSuccessText("sidebarUserName", name);
    setSuccessText("sidebarUserInitials", initials);
    setSuccessText("topbarUserName", name);
    setSuccessText("topbarUserInitials", initials);
    setSuccessText("dropdownUserName", name);
    setSuccessText("dropdownUserInitials", initials);
    if (user.email) setSuccessText("dropdownUserEmail", user.email);
}

/* =========================================================
   29. INITIALS
   ========================================================= */

function createBookingSuccessInitials(
    name
) {

    const words =
        String(
            name ||
            ""
        )
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!words.length) {

        return "SK";

    }


    if (
        words.length ===
        1
    ) {

        return words[0]
            .slice(
                0,
                2
            )
            .toUpperCase();

    }


    return (
        words[0][0] +
        words[
            words.length - 1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   30. INDICATORS
   ========================================================= */
function updateBookingSuccessIndicators() {
    window.SKYRA_COMMON?.refreshCustomerIndicators?.();
}

/* =========================================================
   31. SEARCH
   ========================================================= */

function initializeBookingSuccessSearch() {

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
                input.value.trim();


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
   32. ACTIVE SIDEBAR
   ========================================================= */

function keepBookingSuccessNavigationActive() {

    const links =
        document.querySelectorAll(
            ".sidebar-nav .sidebar-link"
        );


    links.forEach(
        (link) => {

            link.classList.remove(
                "active"
            );


            link.removeAttribute(
                "aria-current"
            );

        }
    );


    const bookings =
        [...links].find(
            (link) =>
                link.getAttribute(
                    "href"
                ) ===
                "./my-bookings.html"
        );


    if (bookings) {

        bookings.classList.add(
            "active"
        );


        bookings.setAttribute(
            "aria-current",
            "page"
        );

    }

}


/* =========================================================
   33. NOT FOUND
   ========================================================= */

function showBookingSuccessNotFound(
    message
) {

    const state =
        document.getElementById(
            "bookingSuccessNotFound"
        );


    const content =
        document.getElementById(
            "bookingSuccessContent"
        );


    if (state) {

        state.hidden =
            false;

    }


    if (content) {

        content.hidden =
            true;

    }


    setSuccessText(
        "bookingSuccessNotFoundMessage",
        message
    );


    document.title =
        "Booking Unavailable | SKYRA";


    refreshBookingSuccessIcons();

}


/* =========================================================
   34. HIDE NOT FOUND
   ========================================================= */

function hideBookingSuccessNotFound() {

    const state =
        document.getElementById(
            "bookingSuccessNotFound"
        );


    const content =
        document.getElementById(
            "bookingSuccessContent"
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

function updateBookingSuccessDocumentTitle() {

    const event =
        skyraBookingSuccessState
            .event;


    document.title =
        event?.title
            ? `Booking Confirmed - ${event.title} | SKYRA`
            : "Booking Confirmed | SKYRA";

}


/* =========================================================
   36. VENUE
   ========================================================= */

function formatSuccessVenue(
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
                ? `, ${booking.venue.city}`
                : ""
        }`;

    }


    return (
        booking?.venueName ||
        "Venue TBA"
    );

}


/* =========================================================
   37. EVENT TYPE
   ========================================================= */

function formatSuccessEventType(
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


        case "EVENT":

            return "Event";


        default:

            return "Event";

    }

}


/* =========================================================
   38. EVENT ICON
   ========================================================= */

function getSuccessEventIcon(
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
   39. DATE
   ========================================================= */

function formatSuccessDate(
    value
) {

    const date =
        parseSuccessDate(
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
   40. TICKET DATE
   ========================================================= */

function formatTicketPreviewDate(
    value
) {

    const date =
        parseSuccessDate(
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
   41. DATE PARSER
   ========================================================= */

function parseSuccessDate(
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
   42. TIME
   ========================================================= */

function formatSuccessTime(
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

        return String(
            value
        );

    }


    const [
        hoursValue,
        minutes
    ] =
        value
            .split(":")
            .map(Number);


    const period =
        hoursValue >=
            12
            ? "PM"
            : "AM";


    const hours =
        hoursValue %
        12 ||
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
   43. CURRENCY
   ========================================================= */

function formatSuccessCurrency(
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


    return `₹${
        amount.toLocaleString(
            "en-IN"
        )
    }`;

}


/* =========================================================
   44. STATUS
   ========================================================= */

function formatSuccessStatus(
    status
) {

    const value =
        String(
            status ||
            ""
        )
            .toLowerCase()
            .replace(
                /[_-]+/g,
                " "
            );


    return value.replace(
        /\b\w/g,
        (letter) =>
            letter.toUpperCase()
    );

}


/* =========================================================
   45. TEXT
   ========================================================= */

function setSuccessText(
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
   46. ESCAPE
   ========================================================= */

function escapeSuccessHTML(
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
   47. TOAST
   ========================================================= */

function showBookingSuccessToast(
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
   48. ICONS
   ========================================================= */

function refreshBookingSuccessIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   49. PUBLIC HELPERS
   ========================================================= */

window.SKYRA_BOOKING_SUCCESS_PAGE = {

    getBooking:
        () => {

            if (
                !skyraBookingSuccessState
                    .booking
            ) {

                return null;

            }


            return {

                ...skyraBookingSuccessState
                    .booking,

                seats:
                    skyraBookingSuccessState
                        .booking
                        .seats
                        ?.map(
                            (seat) => ({
                                ...seat
                            })
                        )

            };

        },

    refresh:
        async () => {

            const booking =
                await loadBookingSuccessData(
                    skyraBookingSuccessState
                        .bookingId
                );


            if (booking) {

                skyraBookingSuccessState
                    .booking =
                    normalizeSuccessBooking(
                        booking
                    );


                resolveBookingRelationships();

                renderBookingSuccessPage();

            }

        }

};


/* =========================================================
   END OF SKYRA BOOKING SUCCESS
   ========================================================= */