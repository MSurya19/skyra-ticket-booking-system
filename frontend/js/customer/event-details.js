/* =========================================================
   SKYRA - CUSTOMER EVENT DETAILS
   File: frontend/js/customer/event-details.js

   Used by:
   - customer/event-details.html

   Depends on:
   - ../common.js

   Phase 10:
   - Loads the Event from GET /api/events/:eventId
   - Loads future bookable Shows from GET /api/events/:eventId/shows
   - Uses real Show availability/pricing derived from ShowSeat
   - No active Event/Show/Venue mock-data fallback

   Handles:
   - Event query parameter
   - Event information
   - Event poster
   - Shows
   - Venue
   - Ticket categories
   - Starting price
   - Favourites
   - Sharing
   - Search
   - Customer details
   - Sidebar counts
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_EVENT_DETAILS_KEYS = {

    FAVOURITES:
        "skyra_favourites"

};


/* =========================================================
   2. PAGE STATE
   ========================================================= */

const skyraEventDetailsState = {

    eventId:
        null,

    event:
        null,

    shows:
        [],

    primaryShow:
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

        initializeEventDetailsPage();

    }
);


/* =========================================================
   4. INITIALIZE PAGE
   ========================================================= */

async function initializeEventDetailsPage() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getCustomerEvent !==
            "function" ||
        typeof window.SKYRA_API
            .getCustomerEventShows !==
            "function"
    ) {

        showEventDetailsNotFound(
            "Event information could not be loaded. Update common.js and refresh."
        );

        return;

    }


    initializeEventDetailsUser();

    updateEventDetailsIndicators();

    initializeEventDetailsSearch();

    initializeEventDetailsTabs();


    const params =
        new URLSearchParams(
            window.location.search
        );


    const requestedEventId =
        String(
            params.get("id") ||
            ""
        ).trim();


    if (!requestedEventId) {

        showEventDetailsNotFound(
            "No event was selected. Return to Explore Events and choose an event."
        );

        return;

    }


    await loadEventDetails(
        requestedEventId
    );


    refreshEventDetailsIcons();

}


/* =========================================================
   5. LOAD EVENT
   ========================================================= */

async function loadEventDetails(
    eventId
) {

    try {

        const [
            eventResponse,
            showsResponse
        ] =
            await Promise.all([

                window.SKYRA_API
                    .getCustomerEvent(
                        eventId
                    ),

                window.SKYRA_API
                    .getCustomerEventShows(
                        eventId
                    )

            ]);


        const rawEvent =
            eventResponse?.data?.event ||
            null;


        if (!rawEvent) {

            throw new Error(
                "Backend did not return the selected Event."
            );

        }


        const event = {

            ...rawEvent,

            id:
                String(
                    rawEvent._id ||
                    rawEvent.id ||
                    eventId
                ),

            _id:
                String(
                    rawEvent._id ||
                    rawEvent.id ||
                    eventId
                ),

            category:
                rawEvent.category ||
                rawEvent.genre ||
                "",

            genre:
                rawEvent.genre ||
                rawEvent.category ||
                "",

            tags:
                Array.isArray(
                    rawEvent.tags
                )
                    ? rawEvent.tags
                    : [],

            performers:
                Array.isArray(
                    rawEvent.performers
                )
                    ? rawEvent.performers
                    : []

        };


        const rawShows =
            Array.isArray(
                showsResponse?.data?.shows
            )
                ? showsResponse.data.shows
                : [];


        const shows =
            rawShows.map(
                normalizeEventDetailsShow
            );


        const sortedShows =
            sortEventDetailShows(
                shows
            );


        const primaryShow =
            sortedShows[0] ||
            null;


        const venue =
            primaryShow?.venue ||
            (
                primaryShow
                    ? {
                        id:
                            primaryShow.venueId,

                        _id:
                            primaryShow.venueId,

                        name:
                            primaryShow.venueName ||
                            "Venue",

                        shortName:
                            primaryShow.venueName ||
                            "Venue",

                        city:
                            primaryShow.venueCity ||
                            ""
                    }
                    : null
            );


        skyraEventDetailsState.eventId =
            event.id;


        skyraEventDetailsState.event =
            event;


        skyraEventDetailsState.shows =
            sortedShows;


        skyraEventDetailsState.primaryShow =
            primaryShow;


        skyraEventDetailsState.venue =
            venue;


        hideEventDetailsNotFound();

        renderEventDetailsHero();

        renderEventDetailsAbout();

        renderEventDetailsShows();

        renderEventTicketCategories();

        renderEventVenue();

        renderEventNextShow();

        updateEventDetailsLinks();

        initializeEventFavouriteSystem();

        initializeEventSharing();

        keepExploreNavigationActive();

        updateEventDetailsDocumentTitle();

        refreshEventDetailsIcons();

    } catch (error) {

        console.error(
            "Unable to load customer Event details:",
            error
        );


        showEventDetailsNotFound(
            error?.message ||
            "The event you're looking for is unavailable or may have been removed."
        );

    }

}


/* =========================================================
   5.1 NORMALIZE SHOW
   ========================================================= */

function normalizeEventDetailsShow(
    show
) {

    const id =
        String(
            show?._id ||
            show?.id ||
            ""
        );


    return {

        ...show,

        id,

        _id:
            id,

        seatCategories:
            Array.isArray(
                show?.seatCategories
            )
                ? show.seatCategories
                : [],

        venue:
            show?.venue ||
            {
                id:
                    String(
                        show?.venueId ||
                        ""
                    ),

                _id:
                    String(
                        show?.venueId ||
                        ""
                    ),

                name:
                    show?.venueName ||
                    "Venue",

                shortName:
                    show?.venueName ||
                    "Venue",

                city:
                    show?.venueCity ||
                    ""
            }

    };

}


/* =========================================================
   6. USER INFORMATION
   ========================================================= */

function initializeEventDetailsUser() {

    const authenticatedUser =
        window.SKYRA_COMMON
            ?.getUser?.();


    const user =
        authenticatedUser;


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
        window.SKYRA_COMMON
            ?.createInitials
            ? window.SKYRA_COMMON
                .createInitials(
                    name
                )
            : createEventUserInitials(
                name
            );


    setEventDetailsText(
        "sidebarUserName",
        name
    );


    setEventDetailsText(
        "sidebarUserInitials",
        initials
    );


    setEventDetailsText(
        "topbarUserName",
        name
    );


    setEventDetailsText(
        "topbarUserInitials",
        initials
    );


    setEventDetailsText(
        "dropdownUserName",
        name
    );


    setEventDetailsText(
        "dropdownUserInitials",
        initials
    );


    if (email) {

        setEventDetailsText(
            "dropdownUserEmail",
            email
        );

    }

}


/* =========================================================
   7. USER INITIALS FALLBACK
   ========================================================= */

function createEventUserInitials(
    name
) {

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
   8. ACCOUNT INDICATORS
   ========================================================= */

function updateEventDetailsIndicators() {

    /*
       Waitlist and Notification APIs are implemented in later
       phases. Do not display mock counts on a backend-connected
       Phase 10 Event page.
    */

    setEventDetailsText(
        "sidebarWaitlistCount",
        0
    );


    const notificationBadge =
        document.getElementById(
            "sidebarNotificationCount"
        );


    const notificationDot =
        document.getElementById(
            "topbarNotificationDot"
        );


    if (notificationBadge) {

        notificationBadge.textContent =
            "0";

        notificationBadge.hidden =
            true;

    }


    if (notificationDot) {

        notificationDot.hidden =
            true;

    }

}


/* =========================================================
   9. RENDER HERO
   ========================================================= */

function renderEventDetailsHero() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    setEventDetailsText(
        "eventTitle",
        event.title
    );


    setEventDetailsText(
        "eventShortDescription",
        event.shortDescription ||
        event.description ||
        ""
    );


    setEventDetailsText(
        "eventGenre",
        event.genre ||
        "Entertainment"
    );


    setEventDetailsText(
        "eventLanguage",
        event.language ||
        "Not specified"
    );


    setEventDetailsText(
        "eventDuration",
        event.duration ||
        "TBA"
    );


    setEventDetailsText(
        "eventAgeRating",
        event.ageRating ||
        "Not Rated"
    );


    renderEventPoster();

    renderEventTypeBadge();

    renderEventPopularBadge();

    renderEventStartingPrice();

}


/* =========================================================
   10. EVENT POSTER
   ========================================================= */

function renderEventPoster() {

    const event =
        skyraEventDetailsState.event;


    const poster =
        document.getElementById(
            "eventDetailsPoster"
        );


    const content =
        document.getElementById(
            "eventPosterContent"
        );


    if (
        !event ||
        !poster ||
        !content
    ) {
        return;
    }


    const posterClasses = [

        "events-poster-coldplay",

        "events-poster-diljit",

        "events-poster-interstellar",

        "events-poster-arijit",

        "events-poster-comedy",

        "events-poster-avengers"

    ];


    poster.classList.remove(
        ...posterClasses
    );


    poster.classList.add(
        getEventDetailsPosterClass(
            event.id
        )
    );


    content.innerHTML =
        getEventDetailsPosterHTML(
            event
        );


    setEventDetailsText(
        "eventPosterType",
        formatEventDetailsType(
            event.type
        )
    );

}


/* =========================================================
   11. POSTER CLASS
   ========================================================= */

function getEventDetailsPosterClass(
    eventId
) {

    const posterMap = {

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
        posterMap[eventId] ||
        "events-poster-coldplay"
    );

}


/* =========================================================
   12. POSTER CONTENT
   ========================================================= */

function getEventDetailsPosterHTML(
    event
) {

    switch (event.id) {

        case "coldplay":

            return `

                <small>
                    MUSIC OF THE SPHERES
                </small>

                <strong>
                    COLDPLAY
                </strong>

                <span>
                    LIVE 2026
                </span>

            `;


        case "diljit":

            return `

                <small>
                    INDIA TOUR
                </small>

                <strong>
                    DILJIT
                </strong>

                <span>
                    DOSANJH
                </span>

            `;


        case "interstellar":

            return `

                <small>
                    IMAX EXPERIENCE
                </small>

                <strong>
                    INTERSTELLAR
                </strong>

                <span>
                    SCIENCE BEYOND TIME
                </span>

            `;


        case "arijit":

            return `

                <small>
                    LIVE IN CONCERT
                </small>

                <strong>
                    ARIJIT
                </strong>

                <span>
                    SINGH
                </span>

            `;


        case "comedy-night":

            return `

                <small>
                    LIVE COMEDY
                </small>

                <strong>
                    COMEDY
                </strong>

                <span>
                    NIGHT
                </span>

            `;


        case "avengers-secret-wars":

            return `

                <small>
                    MARVEL STUDIOS
                </small>

                <strong>
                    AVENGERS
                </strong>

                <span>
                    SECRET WARS
                </span>

            `;


        default:

            return `

                <small>
                    ${escapeEventDetailsHTML(
                        event.category ||
                        "SKYRA"
                    )}
                </small>

                <strong>
                    ${escapeEventDetailsHTML(
                        getEventPosterMainWord(
                            event.title
                        )
                    )}
                </strong>

                <span>
                    ${escapeEventDetailsHTML(
                        getEventPosterRemainingWords(
                            event.title
                        )
                    )}
                </span>

            `;

    }

}


/* =========================================================
   13. POSTER WORD HELPERS
   ========================================================= */

function getEventPosterMainWord(
    title
) {

    const words =
        String(title || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    return (
        words[0] ||
        "SKYRA"
    ).toUpperCase();

}


function getEventPosterRemainingWords(
    title
) {

    const words =
        String(title || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    return (
        words
            .slice(1)
            .join(" ")
            .toUpperCase()
        ||
        "EXPERIENCE"
    );

}


/* =========================================================
   14. TYPE BADGE
   ========================================================= */

function renderEventTypeBadge() {

    const event =
        skyraEventDetailsState.event;


    const badge =
        document.getElementById(
            "eventTypeBadge"
        );


    if (
        !event ||
        !badge
    ) {
        return;
    }


    const label =
        formatEventDetailsType(
            event.type
        );


    const icon =
        getEventDetailsIcon(
            event.type
        );


    badge.innerHTML = `

        <i
            data-lucide="${icon}"
        ></i>

        ${escapeEventDetailsHTML(
            label
        )}

    `;

}


/* =========================================================
   15. POPULAR BADGE
   ========================================================= */

function renderEventPopularBadge() {

    const event =
        skyraEventDetailsState.event;


    const badge =
        document.getElementById(
            "eventPopularBadge"
        );


    if (
        !event ||
        !badge
    ) {
        return;
    }


    badge.hidden =
        !event.popular;

}


/* =========================================================
   16. STARTING PRICE
   ========================================================= */

function renderEventStartingPrice() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    const price =
        event.startingPrice ===
            null ||
        event.startingPrice ===
            undefined
            ? null
            : Number(
                event.startingPrice
            );


    setEventDetailsText(

        "eventStartingPrice",

        Number.isFinite(
            price
        )
            ? formatEventDetailsCurrency(
                price
            )
            : "Coming Soon"

    );

}


/* =========================================================
   17. ABOUT EVENT
   ========================================================= */

function renderEventDetailsAbout() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    setEventDetailsText(
        "eventDescription",
        event.description ||
        event.shortDescription ||
        "Event information will be available soon."
    );


    const tagContainer =
        document.getElementById(
            "eventTags"
        );


    if (!tagContainer) {
        return;
    }


    let tags =
        event.tags ||
        [];


    if (!tags.length) {

        tags = [

            event.category,

            formatEventDetailsType(
                event.type
            ),

            event.genre

        ].filter(Boolean);

    }


    tagContainer.innerHTML =
        tags
            .map(
                (tag) => `

                    <span>
                        ${escapeEventDetailsHTML(
                            formatEventDetailsLabel(
                                tag
                            )
                        )}
                    </span>

                `
            )
            .join("");

}


/* =========================================================
   18. SORT SHOWS
   ========================================================= */

function sortEventDetailShows(
    shows
) {

    return [...(shows || [])]
        .sort(
            (first, second) =>
                getEventDetailsShowTimestamp(
                    first
                ) -
                getEventDetailsShowTimestamp(
                    second
                )
        );

}


/* =========================================================
   19. SHOW TIMESTAMP
   ========================================================= */

function getEventDetailsShowTimestamp(
    show
) {

    const date =
        parseEventDetailsDate(
            show?.date
        );


    if (!date) {

        return Number.MAX_SAFE_INTEGER;

    }


    if (
        /^\d{2}:\d{2}$/.test(
            show.time || ""
        )
    ) {

        const [
            hours,
            minutes
        ] =
            show.time
                .split(":")
                .map(Number);


        date.setHours(
            hours,
            minutes,
            0,
            0
        );

    }


    return date.getTime();

}


/* =========================================================
   20. RENDER SHOWS
   ========================================================= */

function renderEventDetailsShows() {

    const event =
        skyraEventDetailsState.event;


    const shows =
        skyraEventDetailsState.shows;


    const container =
        document.getElementById(
            "eventShowPreviewList"
        );


    if (
        !event ||
        !container
    ) {
        return;
    }


    if (!shows.length) {

        container.innerHTML = `

            <div class="event-no-shows">

                <i
                    data-lucide="calendar-x"
                ></i>

                <strong>
                    No shows available yet
                </strong>

                <span>
                    Show dates will appear here when
                    the organiser publishes them.
                </span>

            </div>

        `;


        refreshEventDetailsIcons();

        return;

    }


    const previewShows =
        shows.slice(
            0,
            3
        );


    container.innerHTML =
        previewShows
            .map(
                (show) =>
                    createEventShowPreview(
                        event,
                        show
                    )
            )
            .join("");


    refreshEventDetailsIcons();

}


/* =========================================================
   21. CREATE SHOW PREVIEW
   ========================================================= */

function createEventShowPreview(
    event,
    show
) {

    const venue =
        show.venue ||
        {
            name:
                show.venueName ||
                "Venue",

            shortName:
                show.venueName ||
                "Venue",

            city:
                show.venueCity ||
                ""
        };


    const date =
        parseEventDetailsDate(
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
                .format(date)
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


    const weekday =
        date
            ? new Intl.DateTimeFormat(
                "en-IN",
                {
                    weekday:
                        "short"
                }
            )
                .format(date)
                .toUpperCase()
            : "---";


    const availableSeats =
        (show.seatCategories || [])
            .reduce(
                (total, category) =>
                    total +
                    Number(
                        category.availableSeats ||
                        0
                    ),
                0
            );


    const status =
        availableSeats > 0
            ? "Available"
            : "Sold Out";


    const statusClass =
        availableSeats > 0
            ? "badge-success"
            : "badge-danger";


    const dotClass =
        availableSeats > 0
            ? "success"
            : "danger";


    const startingPrice =
        getShowStartingPrice(
            show
        );


    const venueText =
        venue
            ? `${
                venue.shortName ||
                venue.name
            }${
                venue.city
                    ? `, ${venue.city}`
                    : ""
            }`
            : "Venue TBA";


    const href =
        `./shows.html?event=${
            encodeURIComponent(
                event.id
            )
        }&show=${
            encodeURIComponent(
                show.id
            )
        }`;


    return `

        <article
            class="event-show-preview-card"
        >

            <div class="event-show-date">

                <span>
                    ${escapeEventDetailsHTML(
                        month
                    )}
                </span>

                <strong>
                    ${escapeEventDetailsHTML(
                        day
                    )}
                </strong>

                <small>
                    ${escapeEventDetailsHTML(
                        weekday
                    )}
                </small>

            </div>


            <div class="event-show-main">

                <div>

                    <h3>
                        ${escapeEventDetailsHTML(
                            formatEventDetailsTime(
                                show.time
                            )
                        )}
                    </h3>

                    <p>

                        <i
                            data-lucide="map-pin"
                        ></i>

                        ${escapeEventDetailsHTML(
                            venueText
                        )}

                    </p>

                </div>


                <span
                    class="badge ${statusClass}"
                >

                    <span
                        class="status-dot ${dotClass}"
                    ></span>

                    ${status}

                </span>

            </div>


            <div class="event-show-price">

                <span>
                    From
                </span>

                <strong>

                    ${
                        startingPrice !== null
                            ? escapeEventDetailsHTML(
                                formatEventDetailsCurrency(
                                    startingPrice
                                )
                            )
                            : "TBA"
                    }

                </strong>

            </div>


            <a
                href="${href}"
                class="event-show-action"
                aria-label="View show"
            >

                <i
                    data-lucide="chevron-right"
                ></i>

            </a>

        </article>

    `;

}


/* =========================================================
   22. SHOW STARTING PRICE
   ========================================================= */

function getShowStartingPrice(
    show
) {

    const prices =
        (show.seatCategories || [])
            .map(
                (category) =>
                    Number(
                        category.price
                    )
            )
            .filter(
                (price) =>
                    Number.isFinite(
                        price
                    )
            );


    if (!prices.length) {

        return null;

    }


    return Math.min(
        ...prices
    );

}


/* =========================================================
   23. TICKET CATEGORIES
   ========================================================= */

function renderEventTicketCategories() {

    const show =
        skyraEventDetailsState.primaryShow;


    const container =
        document.getElementById(
            "eventTicketCategoryList"
        );


    if (!container) {
        return;
    }


    if (
        !show ||
        !Array.isArray(
            show.seatCategories
        ) ||
        !show.seatCategories.length
    ) {

        container.innerHTML = `

            <div class="event-no-shows">

                <i
                    data-lucide="ticket"
                ></i>

                <strong>
                    Ticket categories unavailable
                </strong>

                <span>
                    Pricing will appear when shows
                    become available.
                </span>

            </div>

        `;


        refreshEventDetailsIcons();

        return;

    }


    container.innerHTML =
        show.seatCategories
            .map(
                (
                    category,
                    index
                ) =>
                    createTicketCategory(
                        category,
                        index
                    )
            )
            .join("");


    refreshEventDetailsIcons();

}


/* =========================================================
   24. CREATE TICKET CATEGORY
   ========================================================= */

function createTicketCategory(
    category,
    index
) {

    const available =
        Number(
            category.availableSeats ||
            0
        );


    const total =
        Number(
            category.totalSeats ||
            0
        );


    const availability =
        getTicketAvailabilityState(
            available,
            total
        );


    const visual =
        getTicketCategoryVisual(
            category.name,
            index
        );


    return `

        <article
            class="
                event-ticket-category
                ${
                    available === 0
                        ? "sold-out"
                        : ""
                }
            "
        >

            <div
                class="
                    event-ticket-category-icon
                    ${visual.className}
                "
            >

                <i
                    data-lucide="${visual.icon}"
                ></i>

            </div>


            <div
                class="event-ticket-category-info"
            >

                <strong>
                    ${escapeEventDetailsHTML(
                        category.name ||
                        "Ticket"
                    )}
                </strong>

                <span>
                    ${escapeEventDetailsHTML(
                        getTicketCategoryDescription(
                            category.name
                        )
                    )}
                </span>

            </div>


            <div
                class="event-ticket-category-availability"
            >

                <span>
                    ${availability.label}
                </span>

                <strong
                    class="${availability.className}"
                >

                    ${
                        available === 0
                            ? "No seats available"
                            : `${available.toLocaleString(
                                "en-IN"
                            )} seats`
                    }

                </strong>

            </div>


            <div
                class="event-ticket-category-price"
            >

                <span>
                    From
                </span>

                <strong>
                    ${escapeEventDetailsHTML(
                        formatEventDetailsCurrency(
                            category.price
                        )
                    )}
                </strong>

            </div>

        </article>

    `;

}


/* =========================================================
   25. CATEGORY AVAILABILITY
   ========================================================= */

function getTicketAvailabilityState(
    available,
    total
) {

    if (available <= 0) {

        return {

            label:
                "Sold Out",

            className:
                "sold-out"

        };

    }


    const ratio =
        total > 0
            ? available / total
            : 1;


    if (
        available <= 100 ||
        ratio <= 0.15
    ) {

        return {

            label:
                "Limited",

            className:
                "limited"

        };

    }


    return {

        label:
            "Available",

        className:
            "available"

    };

}


/* =========================================================
   26. CATEGORY VISUAL
   ========================================================= */

function getTicketCategoryVisual(
    name,
    index
) {

    const normalized =
        String(name || "")
            .toLowerCase();


    if (
        normalized.includes(
            "vip"
        ) ||
        normalized.includes(
            "fan pit"
        ) ||
        normalized.includes(
            "recliner"
        )
    ) {

        return {

            className:
                "vip",

            icon:
                "crown"

        };

    }


    if (
        normalized.includes(
            "premium"
        ) ||
        normalized.includes(
            "gold"
        ) ||
        normalized.includes(
            "prime"
        )
    ) {

        return {

            className:
                "premium",

            icon:
                "sparkles"

        };

    }


    if (index === 2) {

        return {

            className:
                "vip",

            icon:
                "crown"

        };

    }


    return {

        className:
            "general",

        icon:
            "ticket"

    };

}


/* =========================================================
   27. CATEGORY DESCRIPTION
   ========================================================= */

function getTicketCategoryDescription(
    name
) {

    const normalized =
        String(name || "")
            .toLowerCase();


    if (
        normalized.includes("vip") ||
        normalized.includes("fan pit")
    ) {

        return "Exclusive premium event section";

    }


    if (
        normalized.includes("recliner")
    ) {

        return "Premium reclining cinema seat";

    }


    if (
        normalized.includes("premium") ||
        normalized.includes("gold") ||
        normalized.includes("prime")
    ) {

        return "Enhanced viewing experience";

    }


    return "Standard event seating";

}


/* =========================================================
   28. VENUE
   ========================================================= */

function renderEventVenue() {

    const venue =
        skyraEventDetailsState.venue;


    if (!venue) {

        setEventDetailsText(
            "eventVenueName",
            "Venue Coming Soon"
        );


        setEventDetailsText(
            "eventVenueAddress",
            "Venue details will be announced."
        );


        setEventDetailsText(
            "eventVenueCapacity",
            "Capacity TBA"
        );


        setEventDetailsText(
            "eventVenueType",
            "Venue"
        );


        return;

    }


    setEventDetailsText(
        "eventVenueName",
        venue.name
    );


    const addressParts = [

        venue.address,

        venue.city,

        venue.state

    ]
        .filter(Boolean);


    /*
       Avoid duplicating city when address already
       contains it.
    */

    const uniqueAddress =
        [...new Set(
            addressParts
        )]
            .join(", ");


    setEventDetailsText(
        "eventVenueAddress",
        uniqueAddress
    );


    setEventDetailsText(

        "eventVenueCapacity",

        venue.capacity
            ? `Capacity ${Number(
                venue.capacity
            ).toLocaleString(
                "en-IN"
            )}`
            : "Capacity TBA"

    );


    setEventDetailsText(
        "eventVenueType",
        formatEventDetailsLabel(
            venue.type ||
            "Venue"
        )
    );

}


/* =========================================================
   29. NEXT SHOW
   ========================================================= */

function renderEventNextShow() {

    const show =
        skyraEventDetailsState.primaryShow;


    if (!show) {

        setEventDetailsText(
            "nextShowDate",
            "Coming Soon"
        );


        setEventDetailsText(
            "nextShowTime",
            "TBA"
        );


        setEventDetailsText(
            "nextShowDoorsOpen",
            "TBA"
        );


        return;

    }


    setEventDetailsText(
        "nextShowDate",
        formatEventDetailsDate(
            show.date
        )
    );


    setEventDetailsText(
        "nextShowTime",
        formatEventDetailsTime(
            show.time
        )
    );


    setEventDetailsText(

        "nextShowDoorsOpen",

        show.doorsOpen
            ? formatEventDetailsTime(
                show.doorsOpen
            )
            : "Not specified"

    );

}


/* =========================================================
   30. UPDATE LINKS
   ========================================================= */

function updateEventDetailsLinks() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    const showsURL =
        `./shows.html?event=${
            encodeURIComponent(
                event.id
            )
        }`;


    const linkIds = [

        "selectShowButton",

        "viewAllShowsLink",

        "sideSelectShowButton",

        "finalSelectShowButton"

    ];


    linkIds.forEach(
        (id) => {

            const link =
                document.getElementById(
                    id
                );


            if (link) {

                link.href =
                    showsURL;

            }

        }
    );


    setEventDetailsText(
        "eventFinalCTATitle",
        `Find the perfect show for ${event.title}.`
    );

}


/* =========================================================
   31. FAVOURITES SYSTEM
   ========================================================= */

function initializeEventFavouriteSystem() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    syncEventFavouriteUI();


    const iconButton =
        document.getElementById(
            "eventFavouriteButton"
        );


    const heroButton =
        document.getElementById(
            "heroFavouriteButton"
        );


    iconButton?.addEventListener(
        "click",
        toggleCurrentEventFavourite
    );


    heroButton?.addEventListener(
        "click",
        toggleCurrentEventFavourite
    );

}


/* =========================================================
   32. GET FAVOURITES
   ========================================================= */

function getEventDetailsFavourites() {

    try {

        const stored =
            localStorage.getItem(
                SKYRA_EVENT_DETAILS_KEYS
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

    } catch {

        return [];

    }

}


/* =========================================================
   33. TOGGLE CURRENT EVENT FAVOURITE
   ========================================================= */

function toggleCurrentEventFavourite() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    const favourites =
        getEventDetailsFavourites();


    const index =
        favourites.indexOf(
            event.id
        );


    let added;


    if (index >= 0) {

        favourites.splice(
            index,
            1
        );


        added = false;

    } else {

        favourites.push(
            event.id
        );


        added = true;

    }


    try {

        localStorage.setItem(
            SKYRA_EVENT_DETAILS_KEYS
                .FAVOURITES,

            JSON.stringify(
                favourites
            )
        );

    } catch {

        showEventDetailsToast(
            "Unable to update favourites.",
            "error"
        );


        return;

    }


    syncEventFavouriteUI();


    showEventDetailsToast(

        added
            ? `${event.title} added to favourites.`
            : `${event.title} removed from favourites.`,

        added
            ? "success"
            : "info",

        added
            ? "Saved"
            : "Removed"

    );

}


/* =========================================================
   34. SYNC FAVOURITE UI
   ========================================================= */

function syncEventFavouriteUI() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    const favourite =
        getEventDetailsFavourites()
            .includes(
                event.id
            );


    const iconButton =
        document.getElementById(
            "eventFavouriteButton"
        );


    const heroButton =
        document.getElementById(
            "heroFavouriteButton"
        );


    const heroText =
        document.getElementById(
            "heroFavouriteText"
        );


    iconButton?.classList.toggle(
        "active",
        favourite
    );


    heroButton?.classList.toggle(
        "active",
        favourite
    );


    iconButton?.setAttribute(
        "aria-pressed",
        String(favourite)
    );


    if (iconButton) {

        iconButton.setAttribute(
            "aria-label",
            favourite
                ? "Remove event from favourites"
                : "Add event to favourites"
        );

    }


    if (heroText) {

        heroText.textContent =
            favourite
                ? "Saved to Favourites"
                : "Add to Favourites";

    }

}


/* =========================================================
   35. EVENT SHARING
   ========================================================= */

function initializeEventSharing() {

    const shareButton =
        document.getElementById(
            "shareEventButton"
        );


    shareButton?.addEventListener(
        "click",
        shareCurrentEvent
    );

}


/* =========================================================
   36. SHARE CURRENT EVENT
   ========================================================= */

async function shareCurrentEvent() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    const shareData = {

        title:
            `${event.title} | SKYRA`,

        text:
            event.shortDescription ||
            event.description ||
            `Check out ${event.title} on SKYRA.`,

        url:
            window.location.href

    };


    if (
        navigator.share
    ) {

        try {

            await navigator.share(
                shareData
            );


            return;

        } catch (error) {

            if (
                error?.name ===
                "AbortError"
            ) {

                return;

            }

        }

    }


    /*
       Desktop/browser fallback.
    */

    try {

        await navigator.clipboard.writeText(
            window.location.href
        );


        showEventDetailsToast(
            "Event link copied to clipboard.",
            "success",
            "Link Copied"
        );

    } catch {

        showEventDetailsToast(
            "Copy the page address from your browser to share this event.",
            "info",
            "Share Event"
        );

    }

}


/* =========================================================
   37. TOPBAR SEARCH
   ========================================================= */

function initializeEventDetailsSearch() {

    const input =
        document.getElementById(
            "dashboardSearch"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key !== "Enter"
            ) {
                return;
            }


            event.preventDefault();


            const query =
                input.value.trim();


            if (!query) {

                showEventDetailsToast(
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
    );

}


/* =========================================================
   38. DETAILS TABS
   ========================================================= */

function initializeEventDetailsTabs() {

    const tabs =
        document.querySelectorAll(
            ".event-details-tab"
        );


    if (!tabs.length) {
        return;
    }


    tabs.forEach(
        (tab) => {

            tab.addEventListener(
                "click",
                () => {

                    tabs.forEach(
                        (item) =>
                            item.classList
                                .remove(
                                    "active"
                                )
                    );


                    tab.classList.add(
                        "active"
                    );

                }
            );

        }
    );


    /*
       Update active tab when scrolling between
       major sections.
    */

    if (
        "IntersectionObserver"
        in window
    ) {

        const sectionMap = [

            {
                id:
                    "aboutEvent",

                href:
                    "#aboutEvent"
            },

            {
                id:
                    "availableShows",

                href:
                    "#availableShows"
            },

            {
                id:
                    "venueSection",

                href:
                    "#venueSection"
            },

            {
                id:
                    "ticketCategories",

                href:
                    "#ticketCategories"
            }

        ];


        const observer =
            new IntersectionObserver(
                (entries) => {

                    const visible =
                        entries
                            .filter(
                                (entry) =>
                                    entry.isIntersecting
                            )
                            .sort(
                                (a, b) =>
                                    b.intersectionRatio -
                                    a.intersectionRatio
                            )[0];


                    if (!visible) {
                        return;
                    }


                    const target =
                        sectionMap.find(
                            (item) =>
                                item.id ===
                                visible.target.id
                        );


                    if (!target) {
                        return;
                    }


                    tabs.forEach(
                        (tab) => {

                            tab.classList.toggle(
                                "active",
                                tab.getAttribute(
                                    "href"
                                ) ===
                                    target.href
                            );

                        }
                    );

                },
                {

                    rootMargin:
                        "-25% 0px -55% 0px",

                    threshold: [
                        0,
                        0.15,
                        0.35
                    ]

                }
            );


        sectionMap.forEach(
            (item) => {

                const section =
                    document.getElementById(
                        item.id
                    );


                if (section) {

                    observer.observe(
                        section
                    );

                }

            }
        );

    }

}


/* =========================================================
   39. KEEP EXPLORE SIDEBAR ACTIVE
   ========================================================= */

function keepExploreNavigationActive() {

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


    const exploreLink =
        [...links].find(
            (link) => {

                const href =
                    link.getAttribute(
                        "href"
                    );


                return (
                    href ===
                    "./events.html"
                );

            }
        );


    if (exploreLink) {

        exploreLink.classList.add(
            "active"
        );


        exploreLink.setAttribute(
            "aria-current",
            "page"
        );

    }

}


/* =========================================================
   40. DOCUMENT TITLE
   ========================================================= */

function updateEventDetailsDocumentTitle() {

    const event =
        skyraEventDetailsState.event;


    if (!event) {
        return;
    }


    document.title =
        `${event.title} | SKYRA`;

}


/* =========================================================
   41. EVENT NOT FOUND
   ========================================================= */

function showEventDetailsNotFound(
    message
) {

    const state =
        document.getElementById(
            "eventNotFoundState"
        );


    const content =
        document.getElementById(
            "eventDetailsContent"
        );


    if (state) {

        state.hidden =
            false;


        const paragraph =
            state.querySelector(
                "p"
            );


        if (
            paragraph &&
            message
        ) {

            paragraph.textContent =
                message;

        }

    }


    if (content) {

        content.hidden =
            true;

    }


    document.title =
        "Event Not Found | SKYRA";


    refreshEventDetailsIcons();

}


/* =========================================================
   42. HIDE NOT FOUND
   ========================================================= */

function hideEventDetailsNotFound() {

    const state =
        document.getElementById(
            "eventNotFoundState"
        );


    const content =
        document.getElementById(
            "eventDetailsContent"
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
   43. EVENT TYPE
   ========================================================= */

function formatEventDetailsType(
    type
) {

    switch (
        String(type || "")
            .toUpperCase()
    ) {

        case "MOVIE":

            return "Movie";


        case "CONCERT":

            return "Concert";


        case "LIVE_SHOW":

            return "Live Show";


        case "EVENT":

            return "Event";


        case "SPORT":
        case "SPORTS":

            return "Sports";


        default:

            return formatEventDetailsLabel(
                type ||
                "Event"
            );

    }

}


/* =========================================================
   44. EVENT ICON
   ========================================================= */

function getEventDetailsIcon(
    type
) {

    switch (
        String(type || "")
            .toUpperCase()
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
   45. LABEL FORMATTER
   ========================================================= */

function formatEventDetailsLabel(
    value
) {

    return String(value || "")
        .replace(
            /[_-]+/g,
            " "
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );

}


/* =========================================================
   46. DATE PARSER
   ========================================================= */

function parseEventDetailsDate(
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


    const parsed =
        new Date(
            value
        );


    return Number.isNaN(
        parsed.getTime()
    )
        ? null
        : parsed;

}


/* =========================================================
   47. FORMAT DATE
   ========================================================= */

function formatEventDetailsDate(
    value
) {

    const date =
        parseEventDetailsDate(
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
   48. FORMAT TIME
   ========================================================= */

function formatEventDetailsTime(
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
        hoursValue,
        minutes
    ] =
        value
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
        String(minutes)
            .padStart(
                2,
                "0"
            )
    } ${period}`;

}


/* =========================================================
   49. FORMAT CURRENCY
   ========================================================= */

function formatEventDetailsCurrency(
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
   50. SAFE TEXT SETTER
   ========================================================= */

function setEventDetailsText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {
        return;
    }


    element.textContent =
        value;

}


/* =========================================================
   51. HTML ESCAPE
   ========================================================= */

function escapeEventDetailsHTML(
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
   52. TOAST
   ========================================================= */

function showEventDetailsToast(
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
   53. REFRESH ICONS
   ========================================================= */

function refreshEventDetailsIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   54. EXPOSE PAGE HELPERS
   ========================================================= */

window.SKYRA_EVENT_DETAILS = {

    getEvent:
        () =>
            skyraEventDetailsState.event,

    getShows:
        () => [
            ...skyraEventDetailsState
                .shows
        ],

    refresh:
        () => {

            if (
                skyraEventDetailsState
                    .eventId
            ) {

                loadEventDetails(
                    skyraEventDetailsState
                        .eventId
                );

            }

        }

};


/* =========================================================
   END OF SKYRA EVENT DETAILS JAVASCRIPT
   ========================================================= */