/* =========================================================
   SKYRA - CUSTOMER DASHBOARD JAVASCRIPT
   File: frontend/js/customer/dashboard.js

   Used by:
   - customer/dashboard.html

   Depends on:
   - ../common.js

   Handles:
   - Customer information
   - Dashboard summary counts
   - Next booking
   - Waitlist preview
   - Featured events
   - Recent bookings
   - Favourites
   - Dashboard search
   - Notification indicators
   ========================================================= */

"use strict";


/* =========================================================
   1. CUSTOMER DASHBOARD CONSTANTS
   ========================================================= */

const SKYRA_CUSTOMER_KEYS = {

    FAVOURITES:
        "skyra_favourites"

};


/*
   Phase 10 customer Event cache.
   Only Event discovery uses this cache. Booking, Waitlist and
   Notification modules remain for their dedicated later phases.
*/
let skyraCustomerDashboardEvents = [];
let skyraCustomerDashboardBookings = [];
let skyraCustomerDashboardWaitlist = [];
let skyraCustomerDashboardUnreadNotifications = 0;


/* =========================================================
   2. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeCustomerDashboard();

    }
);


/* =========================================================
   3. INITIALIZE CUSTOMER DASHBOARD
   ========================================================= */

async function initializeCustomerDashboard() {

    initializeCustomerUser();

    await loadCustomerDashboardActivity();

    updateCustomerDashboardSummary();

    renderCustomerNextBooking();

    renderCustomerWaitlist();

    await loadCustomerDashboardEvents();

    renderCustomerFeaturedEvents();

    renderCustomerRecentBookings();

    initializeCustomerSearch();

    updateCustomerNotificationIndicators();

    refreshCustomerLucideIcons();

}


/* =========================================================
   4. LUCIDE ICONS
   ========================================================= */

function refreshCustomerLucideIcons() {

    if (
        typeof lucide !== "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   5. GET DASHBOARD USER
   ========================================================= */

function getCustomerDashboardUser() {

    return (
        window.SKYRA_COMMON
            ?.getUser?.() ||
        null
    );

}


/* =========================================================
   6. INITIALIZE CUSTOMER USER
   ========================================================= */

function initializeCustomerUser() {

    const user =
        getCustomerDashboardUser();


    if (!user) {
        return;
    }


    const name =
        String(
            user.name ||
            user.fullName ||
            "Customer"
        ).trim();


    const email =
        String(
            user.email ||
            ""
        ).trim();


    const initials =
        createCustomerInitials(
            name
        );


    const firstName =
        getCustomerFirstName(
            name
        );


    /* Sidebar */

    setCustomerText(
        "sidebarUserName",
        name
    );


    setCustomerText(
        "sidebarUserInitials",
        initials
    );


    /* Topbar */

    setCustomerText(
        "topbarUserName",
        name
    );


    setCustomerText(
        "topbarUserInitials",
        initials
    );


    /* Profile dropdown */

    setCustomerText(
        "dropdownUserName",
        name
    );


    setCustomerText(
        "dropdownUserInitials",
        initials
    );


    setCustomerText(
        "dropdownUserEmail",
        email
    );


    /* Greeting */

    setCustomerText(
        "dashboardFirstName",
        firstName
    );

}


/* =========================================================
   7. CREATE USER INITIALS
   ========================================================= */

function createCustomerInitials(
    name
) {

    if (
        window.SKYRA_COMMON
            ?.createInitials
    ) {

        return window.SKYRA_COMMON
            .createInitials(
                name
            );

    }


    const parts =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {

        return "SK";

    }


    if (parts.length === 1) {

        return parts[0]
            .slice(0, 2)
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();

}


/* =========================================================
   8. GET FIRST NAME
   ========================================================= */

function getCustomerFirstName(
    name
) {

    if (
        window.SKYRA_COMMON
            ?.getFirstName
    ) {

        return window.SKYRA_COMMON
            .getFirstName(
                name
            );

    }


    const cleanName =
        String(name || "")
            .trim();


    if (!cleanName) {

        return "Customer";

    }


    return cleanName
        .split(/\s+/)[0];

}


/* =========================================================
   9. LIVE DASHBOARD ACTIVITY + SUMMARY
   ========================================================= */
async function loadCustomerDashboardActivity() {
    if (!window.SKYRA_API) return;

    const [bookingsResult, waitlistResult, unreadResult] = await Promise.allSettled([
        window.SKYRA_API.getCustomerBookings?.(),
        window.SKYRA_API.getMyWaitlist?.(),
        window.SKYRA_API.getNotificationUnreadCount?.()
    ]);

    if (bookingsResult.status === "fulfilled") {
        const response = bookingsResult.value;
        const bookings = response?.data?.bookings || response?.bookings || [];
        skyraCustomerDashboardBookings = Array.isArray(bookings) ? bookings : [];
    }

    if (waitlistResult.status === "fulfilled") {
        const response = waitlistResult.value;
        const waitlist = response?.data?.waitlist || response?.waitlist || response?.data?.entries || response?.entries || [];
        skyraCustomerDashboardWaitlist = Array.isArray(waitlist) ? waitlist : [];
    }

    if (unreadResult.status === "fulfilled") {
        const response = unreadResult.value;
        skyraCustomerDashboardUnreadNotifications = Number(
            response?.data?.unreadCount ?? response?.unreadCount ?? response?.data?.count ?? response?.count ?? 0
        ) || 0;
    }
}

function normalizeDashboardBookingDetails(raw) {
    const id = String(raw?._id || raw?.id || raw?.bookingId || "");
    const event = raw?.event && typeof raw.event === "object"
        ? raw.event
        : { id: raw?.eventId || null, _id: raw?.eventId || null, title: raw?.eventTitle || "SKYRA Event", type: raw?.eventType || "EVENT" };
    const show = raw?.show && typeof raw.show === "object"
        ? raw.show
        : { id: raw?.showId || null, _id: raw?.showId || null, date: raw?.date || raw?.showDate || null, time: raw?.time || raw?.showTime || null, startsAt: raw?.startsAt || null };
    const venue = raw?.venue && typeof raw.venue === "object"
        ? raw.venue
        : { id: raw?.venueId || null, _id: raw?.venueId || null, name: raw?.venueName || "Venue", city: raw?.venueCity || "" };

    return {
        booking: {
            ...raw,
            id,
            bookingReference: String(raw?.reference || raw?.bookingReference || id),
            eventDate: raw?.date || raw?.showDate || show?.date || raw?.startsAt || show?.startsAt || null,
            eventTime: raw?.time || raw?.showTime || show?.time || null,
            total: Number(raw?.grandTotal ?? raw?.total ?? raw?.amount ?? 0),
            seats: Array.isArray(raw?.seats) ? raw.seats : []
        },
        event,
        show,
        venue
    };
}

function normalizeDashboardWaitlistDetails(raw) {
    const event = raw?.event && typeof raw.event === "object"
        ? raw.event
        : { id: raw?.eventId || null, title: raw?.eventTitle || "SKYRA Event", type: raw?.eventType || "EVENT" };
    const show = raw?.show && typeof raw.show === "object"
        ? raw.show
        : { id: raw?.showId || null, date: raw?.date || raw?.showDate || raw?.startsAt || null, time: raw?.time || raw?.showTime || null };
    return { waitlist: raw, event, show, venue: raw?.venue || null };
}

function updateCustomerDashboardSummary() {
    const confirmed = skyraCustomerDashboardBookings.filter(
        (booking) => String(booking?.status || "").toUpperCase() === "CONFIRMED"
    );
    const activeWaitlist = skyraCustomerDashboardWaitlist.filter((entry) =>
        ["WAITING", "WAITLISTED", "ACTIVE", "OFFERED"].includes(
            String(entry?.status || entry?.offer?.status || "").toUpperCase()
        )
    ).length;

    setCustomerText("upcomingBookingsCount", confirmed.length);
    setCustomerText("activeTicketsCount", confirmed.length);
    setCustomerText("waitlistCount", activeWaitlist);
    setCustomerText("unreadNotificationsCount", skyraCustomerDashboardUnreadNotifications);
    setCustomerText("sidebarWaitlistCount", activeWaitlist);
    setCustomerText("sidebarNotificationCount", skyraCustomerDashboardUnreadNotifications);
}

/* =========================================================
   10. RENDER NEXT BOOKING
   ========================================================= */
function renderCustomerNextBooking() {
    const container = document.getElementById("nextBookingCard");
    if (!container) return;

    const raw = skyraCustomerDashboardBookings.find(
        (booking) => String(booking?.status || "").toUpperCase() === "CONFIRMED"
    );
    const bookingDetails = raw ? normalizeDashboardBookingDetails(raw) : null;

    if (!bookingDetails?.booking) {
        renderNoUpcomingBooking(container);
        return;
    }

    const booking = bookingDetails.booking;
    const event = bookingDetails.event;
    const venue = bookingDetails.venue;
    const eventTitle = event?.title || "Upcoming Event";
    const eventType = formatCustomerEventType(event?.type);
    const bookingReference = booking.bookingReference || booking.id;
    const seatLabels = (booking.seats || []).map((seat) => seat.label).join(", ");
    const venueName = venue ? `${venue.name}${venue.city ? `, ${venue.city}` : ""}` : "Venue details unavailable";
    const date = formatCustomerDate(booking.eventDate);
    const time = formatCustomerTime(booking.eventTime);
    const ticketUrl = `./ticket.html?id=${encodeURIComponent(booking.id || bookingReference)}`;
    const eventUrl = event?.id ? `./event-details.html?id=${encodeURIComponent(event.id)}` : "./events.html";
    const posterTitle = getPosterMainTitle(eventTitle);
    const posterSubtitle = getPosterSubtitle(eventTitle);

    container.innerHTML = `
        <div class="next-booking-poster">
            <div class="next-booking-poster-glow"></div>
            <div class="next-booking-poster-content">
                <small>${escapeCustomerHTML(event?.genre || eventType)}</small>
                <strong>${escapeCustomerHTML(posterTitle)}</strong>
                <span>${escapeCustomerHTML(posterSubtitle)}</span>
            </div>
            <span class="event-category-label">${escapeCustomerHTML(eventType)}</span>
        </div>
        <div class="next-booking-details">
            <div class="next-booking-top">
                <div>
                    <div class="booking-status-line">
                        <span class="badge badge-success"><i data-lucide="circle-check"></i>Confirmed</span>
                        <span class="booking-reference">${escapeCustomerHTML(bookingReference)}</span>
                    </div>
                    <h3>${escapeCustomerHTML(eventTitle)}</h3>
                </div>
                <a href="${ticketUrl}" class="next-ticket-button" aria-label="Open ticket"><i data-lucide="qr-code"></i></a>
            </div>
            <div class="next-booking-info-grid">
                <div class="booking-info-item"><div class="booking-info-icon"><i data-lucide="calendar-days"></i></div><div><span>Date</span><strong>${escapeCustomerHTML(date)}</strong></div></div>
                <div class="booking-info-item"><div class="booking-info-icon"><i data-lucide="clock-3"></i></div><div><span>Time</span><strong>${escapeCustomerHTML(time)}</strong></div></div>
                <div class="booking-info-item booking-info-wide"><div class="booking-info-icon"><i data-lucide="map-pin"></i></div><div><span>Venue</span><strong>${escapeCustomerHTML(venueName)}</strong></div></div>
                <div class="booking-info-item"><div class="booking-info-icon"><i data-lucide="armchair"></i></div><div><span>Seats</span><strong>${escapeCustomerHTML(seatLabels || "—")}</strong></div></div>
            </div>
            <div class="next-booking-actions">
                <a href="${ticketUrl}" class="btn btn-primary"><i data-lucide="qr-code"></i>View Ticket</a>
                <a href="${eventUrl}" class="btn btn-outline">Event Details</a>
            </div>
        </div>`;

    refreshCustomerLucideIcons();
}

/* =========================================================
   11. NO UPCOMING BOOKING
   ========================================================= */

function renderNoUpcomingBooking(
    container
) {

    container.innerHTML = `

        <div
            class="customer-empty-card"
            style="
                grid-column: 1 / -1;
                margin: 18px;
            "
        >

            <div
                class="customer-empty-card-icon"
            >

                <i
                    data-lucide="ticket"
                ></i>

            </div>

            <h3>
                No upcoming bookings
            </h3>

            <p>
                Discover movies, concerts and live
                experiences and book your next moment.
            </p>

            <a
                href="./events.html"
                class="btn btn-primary"
            >

                <i
                    data-lucide="compass"
                ></i>

                Explore Events

            </a>

        </div>

    `;


    refreshCustomerLucideIcons();

}


/* =========================================================
   12. POSTER MAIN TITLE
   ========================================================= */

function getPosterMainTitle(
    title
) {

    const cleanTitle =
        String(title || "")
            .trim();


    if (!cleanTitle) {

        return "SKYRA";

    }


    const words =
        cleanTitle.split(/\s+/);


    /*
       Use a short visual heading for the poster.
    */

    return words[0]
        .replace(
            /[^A-Za-z0-9]/g,
            ""
        )
        .toUpperCase();

}


/* =========================================================
   13. POSTER SUBTITLE
   ========================================================= */

function getPosterSubtitle(
    title
) {

    const words =
        String(title || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (words.length <= 1) {

        return "LIVE EXPERIENCE";

    }


    return words
        .slice(1)
        .join(" ")
        .toUpperCase();

}


/* =========================================================
   14. RENDER WAITLIST
   ========================================================= */
function renderCustomerWaitlist() {
    const container = document.querySelector(".dashboard-waitlist-items");
    if (!container) return;

    const entries = skyraCustomerDashboardWaitlist
        .filter((entry) => ["WAITING", "WAITLISTED", "ACTIVE", "OFFERED"].includes(String(entry?.status || entry?.offer?.status || "").toUpperCase()))
        .slice(0, 3)
        .map(normalizeDashboardWaitlistDetails);

    if (!entries.length) {
        container.innerHTML = `<div class="customer-empty-card" style="margin:14px;min-height:150px;"><div class="customer-empty-card-icon"><i data-lucide="clock-3"></i></div><h3>No waitlist entries</h3><p>Your active waitlist requests will appear here.</p></div>`;
        refreshCustomerLucideIcons();
        return;
    }

    container.innerHTML = entries.map((details) => {
        const entry = details.waitlist;
        const event = details.event;
        const show = details.show;
        const status = String(entry?.status || entry?.offer?.status || "WAITING").toUpperCase();
        return `<article class="dashboard-waitlist-item">
            <div class="waitlist-event-icon"><i data-lucide="${getCustomerEventIcon(event?.type)}"></i></div>
            <div class="waitlist-event-info"><strong>${escapeCustomerHTML(event?.title || "Event")}</strong><span>${escapeCustomerHTML(entry?.categoryName || entry?.category || "General")} • ${escapeCustomerHTML(formatCustomerDate(show?.date || entry?.startsAt))}</span></div>
            <span class="badge badge-violet">${escapeCustomerHTML(status === "OFFERED" ? "OFFER" : `#${entry?.position ?? "—"}`)}</span>
        </article>`;
    }).join("");

    refreshCustomerLucideIcons();
}

/* =========================================================
   15. LOAD + RENDER FEATURED EVENTS
   ========================================================= */

async function loadCustomerDashboardEvents() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getCustomerEvents !==
            "function"
    ) {

        console.error(
            "Phase 10 customer Event API is unavailable on Dashboard."
        );


        skyraCustomerDashboardEvents =
            [];

        return;

    }


    try {

        const response =
            await window.SKYRA_API
                .getCustomerEvents({
                    sort:
                        "POPULAR",

                    page:
                        1,

                    limit:
                        4
                });


        skyraCustomerDashboardEvents =
            Array.isArray(
                response?.data?.events
            )
                ? response.data.events.map(
                    normalizeDashboardEvent
                )
                : [];

    } catch (error) {

        console.error(
            "Unable to load Dashboard Events:",
            error
        );


        skyraCustomerDashboardEvents =
            [];


        showCustomerToast(
            error?.message ||
            "Unable to load upcoming events.",
            "error",
            "Events Unavailable"
        );

    }

}


function normalizeDashboardEvent(
    event
) {

    const id =
        String(
            event?._id ||
            event?.id ||
            ""
        );


    return {

        ...event,

        id,

        _id:
            id,

        startingPrice:
            event?.startingPrice ===
                null ||
            event?.startingPrice ===
                undefined
                ? null
                : Number(
                    event.startingPrice
                ),

        nextShow:
            event?.nextShow
                ? {
                    ...event.nextShow,

                    id:
                        String(
                            event.nextShow
                                ._id ||
                            event.nextShow
                                .id ||
                            ""
                        )
                }
                : null

    };

}


function renderCustomerFeaturedEvents() {

    const grid =
        document.getElementById(
            "dashboardEventsGrid"
        );


    if (!grid) {
        return;
    }


    const events =
        skyraCustomerDashboardEvents;


    if (!events.length) {

        grid.innerHTML = `

            <div
                class="customer-empty-card"
                style="grid-column: 1 / -1;"
            >

                <div
                    class="customer-empty-card-icon"
                >
                    <i
                        data-lucide="calendar-x"
                    ></i>
                </div>

                <h3>
                    No upcoming events
                </h3>

                <p>
                    Published events with future shows
                    will appear here.
                </p>

                <a
                    href="./events.html"
                    class="btn btn-primary"
                >
                    Explore Events
                </a>

            </div>

        `;


        refreshCustomerLucideIcons();

        return;

    }


    const favourites =
        getCustomerFavourites();


    grid.innerHTML =
        events
            .map(
                (event) =>
                    createCustomerEventCard(
                        event,
                        favourites.includes(
                            event.id
                        )
                    )
            )
            .join("");


    initializeDashboardFavourites();

    refreshCustomerLucideIcons();

}


/* =========================================================
   16. CREATE CUSTOMER EVENT CARD
   ========================================================= */

function createCustomerEventCard(
    event,
    favourite
) {

    const show =
        event.nextShow ||
        null;


    const venue =
        show
            ? {
                name:
                    show.venueName ||
                    "Venue",

                shortName:
                    show.venueName ||
                    "Venue",

                city:
                    show.venueCity ||
                    ""
            }
            : null;


    const startingPrice =
        event.startingPrice ===
            null ||
        event.startingPrice ===
            undefined
            ? null
            : Number(
                event.startingPrice
            );


    const eventType =
        formatCustomerEventType(
            event.type
        );


    const eventTypeClass =
        getCustomerEventTypeClass(
            event.type
        );


    const posterClass =
        event.posterClass ||
        getDashboardPosterClass(
            event.type
        );


    const posterContent =
        getCustomerPosterContent(
            event
        );


    const location =
        venue
            ? `${
                venue.shortName ||
                venue.name
            }${
                venue.city
                    ? `, ${venue.city}`
                    : ""
            }`
            : "Venue coming soon";


    const date =
        show
            ? formatCustomerDate(
                show.date
            )
            : "Coming soon";


    const formattedPrice =
        Number.isFinite(
            startingPrice
        )
            ? formatCustomerCurrency(
                startingPrice
            )
            : "TBA";


    return `

        <article
            class="customer-event-card"
        >

            <a
                href="./event-details.html?id=${
                    encodeURIComponent(
                        event.id
                    )
                }"
                class="
                    customer-event-image
                    ${escapeCustomerAttribute(
                        posterClass
                    )}
                "
            >

                <span
                    class="
                        customer-event-type
                        ${eventTypeClass}
                    "
                >
                    ${escapeCustomerHTML(
                        eventType
                    )}
                </span>


                <button
                    type="button"
                    class="
                        dashboard-favourite-btn
                        ${
                            favourite
                                ? "active"
                                : ""
                        }
                    "
                    aria-label="${
                        favourite
                            ? "Remove"
                            : "Add"
                    } ${escapeCustomerAttribute(
                        event.title
                    )} ${
                        favourite
                            ? "from"
                            : "to"
                    } favourites"
                    aria-pressed="${
                        favourite
                            ? "true"
                            : "false"
                    }"
                    data-event-id="${escapeCustomerAttribute(
                        event.id
                    )}"
                >

                    <i
                        data-lucide="heart"
                    ></i>

                </button>


                ${posterContent}

            </a>


            <div class="customer-event-body">

                <div
                    class="customer-event-title-row"
                >

                    <div>

                        <h3>
                            ${escapeCustomerHTML(
                                event.title
                            )}
                        </h3>

                        <p>
                            ${escapeCustomerHTML(
                                [
                                    event.genre,
                                    eventType
                                ]
                                    .filter(Boolean)
                                    .join(" • ")
                            )}
                        </p>

                    </div>

                </div>


                <div class="customer-event-meta">

                    <span>

                        <i
                            data-lucide="calendar"
                        ></i>

                        ${escapeCustomerHTML(
                            date
                        )}

                    </span>


                    <span>

                        <i
                            data-lucide="map-pin"
                        ></i>

                        ${escapeCustomerHTML(
                            location
                        )}

                    </span>

                </div>


                <div
                    class="customer-event-footer"
                >

                    <div>

                        <span>
                            From
                        </span>

                        <strong>
                            ${escapeCustomerHTML(
                                formattedPrice
                            )}
                        </strong>

                    </div>


                    <a
                        href="./event-details.html?id=${
                            encodeURIComponent(
                                event.id
                            )
                        }"
                        class="customer-event-action"
                        aria-label="View ${escapeCustomerAttribute(
                            event.title
                        )}"
                    >

                        <i
                            data-lucide="arrow-up-right"
                        ></i>

                    </a>

                </div>

            </div>

        </article>

    `;

}


function getDashboardPosterClass(
    type
) {

    switch (
        String(
            type ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":
            return "event-poster-interstellar";

        case "LIVE_SHOW":
            return "event-poster-comedy";

        case "CONCERT":
        default:
            return "event-poster-arijit";

    }

}


/* =========================================================
   17. EVENT POSTER CONTENT
   ========================================================= */

function getCustomerPosterContent(
    event
) {

    switch (event.id) {

        case "diljit":

            return `

                <div
                    class="customer-event-poster-text"
                >

                    <small>
                        INDIA TOUR
                    </small>

                    <strong>
                        DILJIT
                    </strong>

                    <span>
                        DOSANJH
                    </span>

                </div>

            `;


        case "interstellar":

            return `

                <div
                    class="
                        customer-event-poster-text
                        interstellar-poster-text
                    "
                >

                    <span
                        class="dashboard-space-planet"
                    ></span>

                    <strong>
                        INTERSTELLAR
                    </strong>

                    <small>
                        IMAX EXPERIENCE
                    </small>

                </div>

            `;


        case "arijit":

            return `

                <div
                    class="customer-event-poster-text"
                >

                    <small>
                        LIVE
                    </small>

                    <strong>
                        ARIJIT
                    </strong>

                    <span>
                        SINGH
                    </span>

                </div>

            `;


        case "comedy-night":

            return `

                <div
                    class="
                        customer-event-poster-text
                        comedy-poster-text
                    "
                >

                    <small>
                        LIVE COMEDY
                    </small>

                    <strong>
                        COMEDY
                    </strong>

                    <span>
                        NIGHT
                    </span>

                </div>

            `;


        default:

            return `

                <div
                    class="customer-event-poster-text"
                >

                    <small>
                        ${escapeCustomerHTML(
                            event.category ||
                            "SKYRA"
                        )}
                    </small>

                    <strong>
                        ${escapeCustomerHTML(
                            getPosterMainTitle(
                                event.title
                            )
                        )}
                    </strong>

                    <span>
                        ${escapeCustomerHTML(
                            getPosterSubtitle(
                                event.title
                            )
                        )}
                    </span>

                </div>

            `;

    }

}


/* =========================================================
   18. INITIALIZE FAVOURITES
   ========================================================= */

function initializeDashboardFavourites() {

    const buttons =
        document.querySelectorAll(
            ".dashboard-favourite-btn"
        );


    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                (event) => {

                    /*
                       Favourite button is located inside
                       an event link.

                       Prevent clicking the heart from
                       navigating to event-details.html.
                    */

                    event.preventDefault();

                    event.stopPropagation();


                    const eventId =
                        button.dataset
                            .eventId;


                    if (!eventId) {
                        return;
                    }


                    toggleCustomerFavourite(
                        eventId,
                        button
                    );

                }
            );

        }
    );

}


/* =========================================================
   19. GET FAVOURITES
   ========================================================= */

function getCustomerFavourites() {

    try {

        const stored =
            localStorage.getItem(
                SKYRA_CUSTOMER_KEYS
                    .FAVOURITES
            );


        if (!stored) {

            return [];

        }


        const parsed =
            JSON.parse(
                stored
            );


        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.warn(
            "Unable to read SKYRA favourites:",
            error
        );


        return [];

    }

}


/* =========================================================
   20. SAVE FAVOURITES
   ========================================================= */

function saveCustomerFavourites(
    favourites
) {

    try {

        localStorage.setItem(
            SKYRA_CUSTOMER_KEYS
                .FAVOURITES,

            JSON.stringify(
                favourites
            )
        );


        return true;

    } catch (error) {

        console.warn(
            "Unable to save SKYRA favourites:",
            error
        );


        return false;

    }

}


/* =========================================================
   21. TOGGLE FAVOURITE
   ========================================================= */

function toggleCustomerFavourite(
    eventId,
    button
) {

    const favourites =
        getCustomerFavourites();


    const existingIndex =
        favourites.indexOf(
            eventId
        );


    let added;


    if (existingIndex >= 0) {

        favourites.splice(
            existingIndex,
            1
        );


        added = false;

    } else {

        favourites.push(
            eventId
        );


        added = true;

    }


    const saved =
        saveCustomerFavourites(
            favourites
        );


    if (!saved) {

        showCustomerToast(
            "Unable to update favourites.",
            "error"
        );


        return;

    }


    button.classList.toggle(
        "active",
        added
    );


    button.setAttribute(
        "aria-pressed",
        String(added)
    );


    const event =
        skyraCustomerDashboardEvents
            .find(
                (item) =>
                    String(
                        item.id
                    ) ===
                    String(
                        eventId
                    )
            );


    button.setAttribute(
        "aria-label",
        `${
            added
                ? "Remove"
                : "Add"
        } ${
            event?.title ||
            "event"
        } ${
            added
                ? "from"
                : "to"
        } favourites`
    );


    showCustomerToast(

        added
            ? `${
                event?.title ||
                "Event"
            } added to favourites.`
            : `${
                event?.title ||
                "Event"
            } removed from favourites.`,

        added
            ? "success"
            : "info",

        added
            ? "Saved"
            : "Removed"

    );

}


/* =========================================================
   22. RENDER RECENT BOOKINGS
   ========================================================= */
function renderCustomerRecentBookings() {
    const container = document.querySelector(".customer-booking-list");
    if (!container) return;

    const bookings = skyraCustomerDashboardBookings.slice(0, 4).map(normalizeDashboardBookingDetails);
    if (!bookings.length) {
        container.innerHTML = `<div class="customer-empty-card" style="margin:16px;"><div class="customer-empty-card-icon"><i data-lucide="ticket"></i></div><h3>No bookings yet</h3><p>Your recent booking activity will appear here.</p><a href="./events.html" class="btn btn-primary">Explore Events</a></div>`;
        refreshCustomerLucideIcons();
        return;
    }

    container.innerHTML = bookings.map(createCustomerBookingRow).join("");
    refreshCustomerLucideIcons();
}

/* =========================================================
   23. CREATE BOOKING ROW
   ========================================================= */

function createCustomerBookingRow(
    details
) {

    const booking =
        details.booking;


    const event =
        details.event;


    const eventType =
        event?.type ||
        "EVENT";


    const icon =
        getCustomerEventIcon(
            eventType
        );


    const posterClass =
        getBookingPosterClass(
            eventType
        );


    const seatLabels =
        (booking.seats || [])
            .map(
                (seat) =>
                    seat.label
            )
            .join(", ");


    const statusData =
        getCustomerBookingStatus(
            booking.status
        );


    const amount =
        formatCustomerCurrency(
            booking.total ??
            booking.subtotal ??
            0
        );


    const date =
        formatCustomerDate(
            booking.eventDate
        );


    const reference =
        booking.bookingReference ||
        booking.id;


    let targetUrl;


    if (
        String(
            booking.status
        ).toUpperCase() ===
        "CONFIRMED"
    ) {

        targetUrl =
            `./ticket.html?id=${
                encodeURIComponent(
                    reference
                )
            }`;

    } else {

        targetUrl =
            "./my-bookings.html";

    }


    return `

        <article
            class="customer-booking-row"
        >

            <div
                class="booking-row-event"
            >

                <div
                    class="
                        booking-row-poster
                        ${posterClass}
                    "
                >

                    <i
                        data-lucide="${icon}"
                    ></i>

                </div>


                <div>

                    <strong>
                        ${escapeCustomerHTML(
                            event?.title ||
                            "SKYRA Event"
                        )}
                    </strong>

                    <span>
                        ${escapeCustomerHTML(
                            reference
                        )}
                    </span>

                </div>

            </div>


            <div class="booking-row-info">

                <span>
                    Date
                </span>

                <strong>
                    ${escapeCustomerHTML(
                        date
                    )}
                </strong>

            </div>


            <div class="booking-row-info">

                <span>
                    Seats
                </span>

                <strong>
                    ${escapeCustomerHTML(
                        seatLabels ||
                        "—"
                    )}
                </strong>

            </div>


            <div class="booking-row-info">

                <span>
                    Amount
                </span>

                <strong>
                    ${escapeCustomerHTML(
                        amount
                    )}
                </strong>

            </div>


            <div
                class="booking-row-status"
            >

                <span
                    class="
                        badge
                        ${statusData.className}
                    "
                >

                    ${
                        statusData.dot
                            ? `
                                <span
                                    class="
                                        status-dot
                                        ${statusData.dot}
                                    "
                                ></span>
                            `
                            : ""
                    }

                    ${escapeCustomerHTML(
                        statusData.label
                    )}

                </span>

            </div>


            <a
                href="${targetUrl}"
                class="booking-row-action"
                aria-label="View ${escapeCustomerAttribute(
                    event?.title ||
                    "booking"
                )}"
            >

                <i
                    data-lucide="chevron-right"
                ></i>

            </a>

        </article>

    `;

}


/* =========================================================
   24. BOOKING STATUS
   ========================================================= */

function getCustomerBookingStatus(
    status
) {

    switch (
        String(
            status ||
            ""
        ).toUpperCase()
    ) {

        case "CONFIRMED":

            return {

                label:
                    "Confirmed",

                className:
                    "badge-success",

                dot:
                    "success"

            };


        case "CANCELLED":

            return {

                label:
                    "Cancelled",

                className:
                    "badge-danger",

                dot:
                    "danger"

            };


        case "PENDING":

            return {

                label:
                    "Pending",

                className:
                    "badge-warning",

                dot:
                    "warning"

            };


        case "COMPLETED":

            return {

                label:
                    "Completed",

                className:
                    "badge-neutral",

                dot:
                    null

            };


        default:

            return {

                label:
                    formatCustomerLabel(
                        status ||
                        "Unknown"
                    ),

                className:
                    "badge-neutral",

                dot:
                    null

            };

    }

}


/* =========================================================
   25. BOOKING POSTER CLASS
   ========================================================= */

function getBookingPosterClass(
    eventType
) {

    switch (
        String(
            eventType ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "booking-poster-blue";


        case "CONCERT":

            return "booking-poster-purple";


        default:

            return "booking-poster-violet";

    }

}


/* =========================================================
   26. CUSTOMER SEARCH
   ========================================================= */

function initializeCustomerSearch() {

    const searchInput =
        document.getElementById(
            "dashboardSearch"
        );


    if (!searchInput) {
        return;
    }


    searchInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key !== "Enter"
            ) {
                return;
            }


            event.preventDefault();


            submitCustomerSearch(
                searchInput.value
            );

        }
    );

}


/* =========================================================
   27. SUBMIT SEARCH
   ========================================================= */

function submitCustomerSearch(
    value
) {

    const query =
        String(value || "")
            .trim();


    if (!query) {

        showCustomerToast(
            "Enter an event, movie or concert to search.",
            "info"
        );


        return;

    }


    window.location.href =
        `./events.html?search=${
            encodeURIComponent(
                query
            )
        }`;

}


/* =========================================================
   28. NOTIFICATION INDICATORS
   ========================================================= */
function updateCustomerNotificationIndicators() {
    const unread = skyraCustomerDashboardUnreadNotifications;
    const sidebarBadge = document.getElementById("sidebarNotificationCount");
    const notificationDot = document.getElementById("topbarNotificationDot");
    if (sidebarBadge) {
        sidebarBadge.textContent = String(unread);
        sidebarBadge.hidden = unread === 0;
    }
    if (notificationDot) notificationDot.hidden = unread === 0;
}

/* =========================================================
   29. EVENT ICON
   ========================================================= */

function getCustomerEventIcon(
    eventType
) {

    switch (
        String(
            eventType ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "film";


        case "CONCERT":

            return "music-2";


        case "LIVE_SHOW":

            return "mic-2";


        case "SPORT":

        case "SPORTS":

            return "trophy";


        default:

            return "calendar-days";

    }

}


/* =========================================================
   30. EVENT TYPE DISPLAY
   ========================================================= */

function formatCustomerEventType(
    eventType
) {

    switch (
        String(
            eventType ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "Movie";


        case "CONCERT":

            return "Concert";


        case "LIVE_SHOW":

            return "Live Show";


        case "SPORT":

        case "SPORTS":

            return "Sports";


        case "EVENT":

            return "Event";


        default:

            return formatCustomerLabel(
                eventType ||
                "Event"
            );

    }

}


/* =========================================================
   31. EVENT TYPE CSS CLASS
   ========================================================= */

function getCustomerEventTypeClass(
    eventType
) {

    switch (
        String(
            eventType ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "movie";


        case "LIVE_SHOW":

            return "live";


        case "EVENT":

            return "event";


        default:

            return "";

    }

}


/* =========================================================
   32. FORMAT GENERAL LABEL
   ========================================================= */

function formatCustomerLabel(
    value
) {

    return String(value || "")
        .toLowerCase()
        .replace(
            /_/g,
            " "
        )
        .replace(
            /\b\w/g,
            (character) =>
                character.toUpperCase()
        );

}


/* =========================================================
   33. FORMAT DATE
   ========================================================= */

function formatCustomerDate(
    value
) {

    if (!value) {

        return "TBA";

    }


    /*
       Parse YYYY-MM-DD manually to prevent timezone
       conversion from changing the displayed date.
    */

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


        const date =
            new Date(
                year,
                month - 1,
                day
            );


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


    if (
        window.SKYRA_COMMON
            ?.formatDate
    ) {

        return window.SKYRA_COMMON
            .formatDate(
                value
            );

    }


    return String(value);

}


/* =========================================================
   34. FORMAT TIME
   ========================================================= */

function formatCustomerTime(
    time
) {

    if (!time) {

        return "TBA";

    }


    const parts =
        String(time)
            .split(":");


    if (
        parts.length < 2
    ) {

        return String(time);

    }


    let hours =
        Number(
            parts[0]
        );


    const minutes =
        Number(
            parts[1]
        );


    if (
        !Number.isFinite(hours)
        ||
        !Number.isFinite(minutes)
    ) {

        return String(time);

    }


    const suffix =
        hours >= 12
            ? "PM"
            : "AM";


    hours =
        hours % 12 ||
        12;


    return `${
        hours
    }:${
        String(minutes)
            .padStart(
                2,
                "0"
            )
    } ${suffix}`;

}


/* =========================================================
   35. FORMAT CURRENCY
   ========================================================= */

function formatCustomerCurrency(
    amount
) {

    if (
        window.SKYRA_COMMON
            ?.formatCurrency
    ) {

        return window.SKYRA_COMMON
            .formatCurrency(
                amount
            );

    }


    const number =
        Number(amount);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "₹0";

    }


    return `₹${
        number.toLocaleString(
            "en-IN"
        )
    }`;

}


/* =========================================================
   36. SAFE TEXT SETTER
   ========================================================= */

function setCustomerText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {
        return;
    }


    element.textContent =
        value;

}


/* =========================================================
   37. ESCAPE HTML

   Mock data is controlled by us, but this helper also
   makes the rendering safer when the same code later
   receives backend/API data.
   ========================================================= */

function escapeCustomerHTML(
    value
) {

    return String(
        value ?? ""
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

function escapeCustomerAttribute(
    value
) {

    return escapeCustomerHTML(
        value
    );

}


/* =========================================================
   39. CUSTOMER TOAST
   ========================================================= */

function showCustomerToast(
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


    /*
       Very small fallback in case common.js
       fails to load during development.
    */

    console.log(
        `[SKYRA ${type}]`,
        message
    );

}


/* =========================================================
   40. REFRESH DASHBOARD
   ========================================================= */

async function refreshCustomerDashboard() {

    await loadCustomerDashboardActivity();

    updateCustomerDashboardSummary();

    renderCustomerNextBooking();

    renderCustomerWaitlist();

    await loadCustomerDashboardEvents();

    renderCustomerFeaturedEvents();

    renderCustomerRecentBookings();

    updateCustomerNotificationIndicators();

}


/* =========================================================
   41. EXPOSE CUSTOMER DASHBOARD HELPERS
   ========================================================= */

window.SKYRA_CUSTOMER_DASHBOARD = {

    refresh:
        refreshCustomerDashboard,

    renderNextBooking:
        renderCustomerNextBooking,

    renderWaitlist:
        renderCustomerWaitlist,

    renderEvents:
        renderCustomerFeaturedEvents,

    renderRecentBookings:
        renderCustomerRecentBookings,

    updateSummary:
        updateCustomerDashboardSummary

};


/* =========================================================
   END OF SKYRA CUSTOMER DASHBOARD JAVASCRIPT
   ========================================================= */