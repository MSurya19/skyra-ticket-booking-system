/* =========================================================
   SKYRA - CUSTOMER SHOW SELECTION
   File: frontend/js/customer/shows.js

   Used by:
   - customer/shows.html

   Depends on:
   - ../common.js

   Phase 10:
   - Loads Event with GET /api/events/:eventId
   - Loads Shows with GET /api/events/:eventId/shows
   - Uses real ShowSeat-derived availability and real Show pricing
   - No active Event/Show/Venue mock-data fallback

   Handles:
   - Event query parameter
   - Show query parameter
   - Event summary
   - Dynamic show date tabs
   - Show rendering
   - Venue information
   - Category pricing
   - Seat availability
   - Show sorting
   - Sold-out states
   - Waitlist routing
   - Seat-selection routing
   - Customer account indicators
   - Topbar search
   ========================================================= */

"use strict";


/* =========================================================
   1. PAGE STATE
   ========================================================= */

const skyraShowsState = {

    eventId:
        null,

    event:
        null,

    shows:
        [],

    selectedDate:
        "ALL",

    selectedShowId:
        null,

    sort:
        "EARLIEST"

};


/* =========================================================
   2. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeShowsPage();

    }
);


/* =========================================================
   3. INITIALIZE PAGE
   ========================================================= */

async function initializeShowsPage() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getCustomerEvent !==
            "function" ||
        typeof window.SKYRA_API
            .getCustomerEventShows !==
            "function"
    ) {

        showShowsNotFound(
            "Show information could not be loaded. Update common.js and refresh."
        );

        return;

    }


    initializeShowsUser();

    updateShowsAccountIndicators();

    initializeShowsSearch();

    initializeShowsSort();

    initializeShowAllDatesButton();


    const params =
        new URLSearchParams(
            window.location.search
        );


    const eventId =
        String(
            params.get("event") ||
            ""
        ).trim();


    const requestedShowId =
        String(
            params.get("show") ||
            ""
        ).trim() ||
        null;


    if (!eventId) {

        showShowsNotFound(
            "No event was selected. Return to Explore Events and choose an event."
        );

        return;

    }


    await loadShowsEvent(
        eventId,
        requestedShowId
    );


    refreshShowsIcons();

}


/* =========================================================
   4. LOAD EVENT + SHOWS
   ========================================================= */

async function loadShowsEvent(
    eventId,
    requestedShowId = null
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
                "The selected event could not be found."
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
                )

        };


        const rawShows =
            Array.isArray(
                showsResponse?.data?.shows
            )
                ? showsResponse.data.shows
                : [];


        const normalizedShows =
            rawShows.map(
                normalizeCustomerShow
            );


        skyraShowsState.eventId =
            event.id;


        skyraShowsState.event =
            event;


        skyraShowsState.shows =
            normalizedShows;


        skyraShowsState.selectedShowId =
            requestedShowId;


        if (requestedShowId) {

            const requestedShow =
                normalizedShows.find(
                    (show) =>
                        show.id ===
                        requestedShowId
                );


            if (requestedShow) {

                skyraShowsState.selectedDate =
                    requestedShow.date;

            }

        }


        hideShowsNotFound();

        renderShowsEventSummary();

        renderShowsDateTabs();

        renderShowsList();

        updateShowsBackLink();

        keepShowsExploreNavigationActive();

        updateShowsDocumentTitle();

        refreshShowsIcons();

    } catch (error) {

        console.error(
            "Unable to load customer Shows:",
            error
        );


        showShowsNotFound(
            error?.message ||
            "The selected event or its shows could not be loaded."
        );

    }

}


/* =========================================================
   4.1 NORMALIZE CUSTOMER SHOW
   ========================================================= */

function normalizeCustomerShow(
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
   5. CUSTOMER USER
   ========================================================= */

function initializeShowsUser() {

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
            : createShowsInitials(
                name
            );


    setShowsText(
        "sidebarUserName",
        name
    );


    setShowsText(
        "sidebarUserInitials",
        initials
    );


    setShowsText(
        "topbarUserName",
        name
    );


    setShowsText(
        "topbarUserInitials",
        initials
    );


    setShowsText(
        "dropdownUserName",
        name
    );


    setShowsText(
        "dropdownUserInitials",
        initials
    );


    if (email) {

        setShowsText(
            "dropdownUserEmail",
            email
        );

    }

}


/* =========================================================
   6. FALLBACK INITIALS
   ========================================================= */

function createShowsInitials(
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
   7. ACCOUNT INDICATORS
   ========================================================= */

function updateShowsAccountIndicators() {

    /*
       Waitlist and Notification APIs are later phases.
       Do not display mock counts on the real Show selection path.
    */

    setShowsText(
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
   8. EVENT SUMMARY
   ========================================================= */

function renderShowsEventSummary() {

    const event =
        skyraShowsState.event;


    if (!event) {
        return;
    }


    setShowsText(
        "showsEventTitle",
        event.title
    );


    setShowsText(

        "showsEventDescription",

        event.shortDescription ||
        event.description ||
        "Choose your preferred show."

    );


    setShowsText(
        "showsEventGenre",
        event.genre ||
        "Entertainment"
    );


    setShowsText(
        "showsEventLanguage",
        event.language ||
        "Not specified"
    );


    setShowsText(
        "showsEventDuration",
        event.duration ||
        "TBA"
    );


    renderShowsEventType();

    renderShowsEventPoster();

    renderShowsStartingPrice();

}


/* =========================================================
   9. EVENT TYPE
   ========================================================= */

function renderShowsEventType() {

    const event =
        skyraShowsState.event;


    const container =
        document.getElementById(
            "showsEventType"
        );


    if (
        !event ||
        !container
    ) {
        return;
    }


    container.innerHTML = `

        <i
            data-lucide="${getShowsEventIcon(
                event.type
            )}"
        ></i>

        ${escapeShowsHTML(
            formatShowsEventType(
                event.type
            )
        )}

    `;


    refreshShowsIcons();

}


/* =========================================================
   10. EVENT POSTER
   ========================================================= */

function renderShowsEventPoster() {

    const event =
        skyraShowsState.event;


    const poster =
        document.getElementById(
            "showsEventPoster"
        );


    const content =
        document.getElementById(
            "showsEventPosterContent"
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
        getShowsPosterClass(
            event.id
        )
    );


    content.innerHTML =
        getShowsPosterContent(
            event
        );

}


/* =========================================================
   11. POSTER CLASS
   ========================================================= */

function getShowsPosterClass(
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
   12. POSTER CONTENT
   ========================================================= */

function getShowsPosterContent(
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
                    ${escapeShowsHTML(
                        event.category ||
                        "SKYRA"
                    )}
                </small>

                <strong>
                    ${escapeShowsHTML(
                        getShowsPosterMainWord(
                            event.title
                        )
                    )}
                </strong>

                <span>
                    ${escapeShowsHTML(
                        getShowsPosterSubtitle(
                            event.title
                        )
                    )}
                </span>

            `;

    }

}


/* =========================================================
   13. POSTER HELPERS
   ========================================================= */

function getShowsPosterMainWord(
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


function getShowsPosterSubtitle(
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
   14. EVENT STARTING PRICE
   ========================================================= */

function renderShowsStartingPrice() {

    const event =
        skyraShowsState.event;


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


    setShowsText(

        "showsEventStartingPrice",

        Number.isFinite(
            price
        )
            ? formatShowsCurrency(
                price
            )
            : "Coming Soon"

    );

}


/* =========================================================
   15. DATE TABS
   ========================================================= */

function renderShowsDateTabs() {

    const container =
        document.getElementById(
            "showsDateTabs"
        );


    if (!container) {
        return;
    }


    const uniqueDates =
        [
            ...new Set(
                skyraShowsState
                    .shows
                    .map(
                        (show) =>
                            show.date
                    )
                    .filter(Boolean)
            )
        ]
            .sort(
                (first, second) => {

                    const firstDate =
                        parseShowsDate(
                            first
                        );


                    const secondDate =
                        parseShowsDate(
                            second
                        );


                    return (
                        (firstDate?.getTime() || 0) -
                        (secondDate?.getTime() || 0)
                    );

                }
            );


    const allActive =
        skyraShowsState.selectedDate ===
        "ALL";


    const allButton = `

        <button
            type="button"
            class="
                shows-date-tab
                ${
                    allActive
                        ? "active"
                        : ""
                }
            "
            data-date="ALL"
            aria-pressed="${
                allActive
                    ? "true"
                    : "false"
            }"
        >

            <span>
                All
            </span>

            <strong>
                Dates
            </strong>

        </button>

    `;


    const dateButtons =
        uniqueDates
            .map(
                (dateValue) => {

                    const date =
                        parseShowsDate(
                            dateValue
                        );


                    if (!date) {

                        return "";

                    }


                    const active =
                        skyraShowsState
                            .selectedDate ===
                        dateValue;


                    const weekday =
                        new Intl.DateTimeFormat(
                            "en-IN",
                            {
                                weekday:
                                    "short"
                            }
                        )
                            .format(date)
                            .toUpperCase();


                    const dayMonth =
                        new Intl.DateTimeFormat(
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


                    return `

                        <button
                            type="button"
                            class="
                                shows-date-tab
                                ${
                                    active
                                        ? "active"
                                        : ""
                                }
                            "
                            data-date="${escapeShowsAttribute(
                                dateValue
                            )}"
                            aria-pressed="${
                                active
                                    ? "true"
                                    : "false"
                            }"
                        >

                            <span>
                                ${escapeShowsHTML(
                                    weekday
                                )}
                            </span>

                            <strong>
                                ${escapeShowsHTML(
                                    dayMonth
                                )}
                            </strong>

                        </button>

                    `;

                }
            )
            .join("");


    container.innerHTML =
        allButton +
        dateButtons;


    initializeShowsDateTabEvents();

}


/* =========================================================
   16. DATE TAB EVENTS
   ========================================================= */

function initializeShowsDateTabEvents() {

    const buttons =
        document.querySelectorAll(
            ".shows-date-tab"
        );


    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    skyraShowsState.selectedDate =
                        button.dataset.date ||
                        "ALL";


                    skyraShowsState.selectedShowId =
                        null;


                    updateShowsDateTabUI();

                    updateShowsURL();

                    renderShowsList();

                }
            );

        }
    );

}


/* =========================================================
   17. DATE TAB UI
   ========================================================= */

function updateShowsDateTabUI() {

    const buttons =
        document.querySelectorAll(
            ".shows-date-tab"
        );


    buttons.forEach(
        (button) => {

            const active =
                button.dataset.date ===
                skyraShowsState
                    .selectedDate;


            button.classList.toggle(
                "active",
                active
            );


            button.setAttribute(
                "aria-pressed",
                String(active)
            );

        }
    );

}


/* =========================================================
   18. SORT INITIALIZATION
   ========================================================= */

function initializeShowsSort() {

    const select =
        document.getElementById(
            "showsSortSelect"
        );


    if (!select) {
        return;
    }


    select.value =
        skyraShowsState.sort;


    select.addEventListener(
        "change",
        () => {

            skyraShowsState.sort =
                select.value;


            renderShowsList();

        }
    );

}


/* =========================================================
   19. GET FILTERED SHOWS
   ========================================================= */

function getVisibleShows() {

    let shows =
        [
            ...skyraShowsState.shows
        ];


    if (
        skyraShowsState.selectedDate !==
        "ALL"
    ) {

        shows =
            shows.filter(
                (show) =>
                    show.date ===
                    skyraShowsState
                        .selectedDate
            );

    }


    return sortShows(
        shows,
        skyraShowsState.sort
    );

}


/* =========================================================
   20. SORT SHOWS
   ========================================================= */

function sortShows(
    shows,
    sort
) {

    const sorted =
        [...shows];


    switch (sort) {

        case "LATEST":

            sorted.sort(
                (first, second) =>
                    getShowsTimestamp(
                        second
                    ) -
                    getShowsTimestamp(
                        first
                    )
            );

            break;


        case "PRICE_LOW":

            sorted.sort(
                (first, second) =>
                    getShowStartingPrice(
                        first
                    ) -
                    getShowStartingPrice(
                        second
                    )
            );

            break;


        case "AVAILABILITY":

            sorted.sort(
                (first, second) =>
                    getShowAvailableSeatCount(
                        second
                    ) -
                    getShowAvailableSeatCount(
                        first
                    )
            );

            break;


        case "EARLIEST":
        default:

            sorted.sort(
                (first, second) =>
                    getShowsTimestamp(
                        first
                    ) -
                    getShowsTimestamp(
                        second
                    )
            );

    }


    return sorted;

}


/* =========================================================
   21. RENDER SHOW LIST
   ========================================================= */

function renderShowsList() {

    const container =
        document.getElementById(
            "showsList"
        );


    if (!container) {
        return;
    }


    const shows =
        getVisibleShows();


    updateShowsResultCount(
        shows.length
    );


    updateShowsEmptyState(
        shows.length
    );


    if (!shows.length) {

        container.innerHTML =
            "";

        return;

    }


    container.innerHTML =
        shows
            .map(
                (show) =>
                    createShowCard(
                        show
                    )
            )
            .join("");


    /*
       If event-details sent ?show=<id>,
       bring the requested show into view.
    */

    if (
        skyraShowsState.selectedShowId
    ) {

        requestAnimationFrame(
            () => {

                const target =
                    container.querySelector(
                        `[data-show-id="${
                            escapeShowsSelector(
                                skyraShowsState
                                    .selectedShowId
                            )
                        }"]`
                    );


                target?.classList.add(
                    "highlighted"
                );


                target?.scrollIntoView(
                    {
                        behavior:
                            "smooth",

                        block:
                            "center"
                    }
                );

            }
        );

    }


    refreshShowsIcons();

}


/* =========================================================
   22. CREATE SHOW CARD
   ========================================================= */

function createShowCard(
    show
) {

    const event =
        skyraShowsState.event;


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
        parseShowsDate(
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
        getShowAvailableSeatCount(
            show
        );


    const totalSeats =
        getShowTotalSeatCount(
            show
        );


    const startingPrice =
        getShowStartingPrice(
            show
        );


    const soldOut =
        availableSeats <= 0;


    const availability =
        getShowAvailabilityState(
            availableSeats,
            totalSeats
        );


    const venueName =
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


    const categories =
        (show.seatCategories || [])
            .map(
                (
                    category,
                    index
                ) =>
                    createShowCategoryOption(
                        show,
                        category,
                        index
                    )
            )
            .join("");


    const action =
        soldOut
            ? createShowWaitlistAction(
                show
            )
            : createShowSeatSelectionAction(
                show
            );


    return `

        <article
            class="
                show-selection-card
                ${
                    soldOut
                        ? "sold-out"
                        : ""
                }
                ${
                    skyraShowsState
                        .selectedShowId ===
                    show.id
                        ? "highlighted"
                        : ""
                }
            "
            data-show-id="${escapeShowsAttribute(
                show.id
            )}"
        >


            <!-- =============================================
                 DATE
                 ============================================= -->

            <div class="show-selection-date">

                <span>
                    ${escapeShowsHTML(
                        month
                    )}
                </span>

                <strong>
                    ${escapeShowsHTML(
                        day
                    )}
                </strong>

                <small>
                    ${escapeShowsHTML(
                        weekday
                    )}
                </small>

            </div>



            <!-- =============================================
                 SHOW MAIN
                 ============================================= -->

            <div class="show-selection-main">


                <!-- =========================================
                     HEADING
                     ========================================= -->

                <div class="show-selection-heading">


                    <div>

                        <div class="show-time-row">

                            <h3>
                                ${escapeShowsHTML(
                                    formatShowsTime(
                                        show.time
                                    )
                                )}
                            </h3>


                            <span
                                class="
                                    badge
                                    ${availability.badgeClass}
                                "
                            >

                                <span
                                    class="
                                        status-dot
                                        ${availability.dotClass}
                                    "
                                ></span>

                                ${escapeShowsHTML(
                                    availability.label
                                )}

                            </span>

                        </div>


                        <p>

                            <i
                                data-lucide="map-pin"
                            ></i>

                            ${escapeShowsHTML(
                                venueName
                            )}

                        </p>

                    </div>



                    <div class="show-door-time">

                        <i
                            data-lucide="door-open"
                        ></i>

                        <span>

                            <small>
                                Doors Open
                            </small>

                            <strong>

                                ${
                                    show.doorsOpen
                                        ? escapeShowsHTML(
                                            formatShowsTime(
                                                show.doorsOpen
                                            )
                                        )
                                        : "Not specified"
                                }

                            </strong>

                        </span>

                    </div>

                </div>



                <!-- =========================================
                     CATEGORIES
                     ========================================= -->

                <div class="show-category-grid">

                    ${
                        categories ||
                        `

                            <div
                                class="show-category-empty"
                            >
                                Ticket categories unavailable.
                            </div>

                        `
                    }

                </div>



                <!-- =========================================
                     FOOTER
                     ========================================= -->

                <div class="show-selection-footer">


                    <div class="show-seat-summary">

                        <i
                            data-lucide="${
                                soldOut
                                    ? "circle-x"
                                    : "armchair"
                            }"
                        ></i>


                        <span>

                            ${
                                soldOut
                                    ? `

                                        <strong>
                                            Sold Out
                                        </strong>

                                        Join the waitlist for
                                        available categories

                                    `
                                    : `

                                        <strong>
                                            ${availableSeats.toLocaleString(
                                                "en-IN"
                                            )}
                                        </strong>

                                        seats currently available

                                    `
                            }

                        </span>

                    </div>



                    <div class="show-selection-actions">

                        <span class="show-starting-price">

                            ${
                                startingPrice !== null
                                    ? `

                                        From

                                        <strong>
                                            ${escapeShowsHTML(
                                                formatShowsCurrency(
                                                    startingPrice
                                                )
                                            )}
                                        </strong>

                                    `
                                    : `

                                        <strong>
                                            TBA
                                        </strong>

                                    `
                            }

                        </span>


                        ${action}

                    </div>

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   23. CATEGORY OPTION
   ========================================================= */

function createShowCategoryOption(
    show,
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


    const soldOut =
        available <= 0;


    const limited =
        !soldOut &&
        (
            available <= 100 ||
            (
                total > 0 &&
                available / total <= 0.15
            )
        );


    const visual =
        getShowCategoryVisual(
            category.name,
            index
        );


    let availabilityText;


    if (soldOut) {

        availabilityText =
            "Sold out";

    } else if (limited) {

        availabilityText =
            `${available.toLocaleString(
                "en-IN"
            )} left`;

    } else {

        availabilityText =
            `${available.toLocaleString(
                "en-IN"
            )} available`;

    }


    return `

        <div
            class="
                show-category-option
                ${
                    soldOut
                        ? "sold-out"
                        : ""
                }
                ${
                    limited
                        ? "limited"
                        : ""
                }
            "
        >

            <div
                class="
                    show-category-icon
                    ${visual.className}
                "
            >

                <i
                    data-lucide="${visual.icon}"
                ></i>

            </div>


            <div class="show-category-details">

                <strong>
                    ${escapeShowsHTML(
                        category.name ||
                        "Ticket"
                    )}
                </strong>

                <span>

                    ${escapeShowsHTML(
                        availabilityText
                    )}

                </span>

            </div>


            <div class="show-category-price">

                <small>
                    From
                </small>

                <strong>
                    ${escapeShowsHTML(
                        formatShowsCurrency(
                            category.price
                        )
                    )}
                </strong>

            </div>


            ${
                soldOut
                    ? `

                        <a
                            href="./waitlist.html?show=${
                                encodeURIComponent(
                                    show.id
                                )
                            }&category=${
                                encodeURIComponent(
                                    category.name ||
                                    ""
                                )
                            }"
                            class="show-category-waitlist-link"
                            aria-label="Join ${
                                escapeShowsAttribute(
                                    category.name ||
                                    "ticket"
                                )
                            } waitlist"
                        >
                            Waitlist
                        </a>

                    `
                    : ""
            }

        </div>

    `;

}


/* =========================================================
   24. CATEGORY VISUAL
   ========================================================= */

function getShowCategoryVisual(
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
   25. SEAT SELECTION ACTION
   ========================================================= */

function createShowSeatSelectionAction(
    show
) {

    return `

        <a
            href="./seat-selection.html?show=${
                encodeURIComponent(
                    show.id
                )
            }"
            class="
                btn
                btn-primary
                show-select-button
            "
        >

            Select Seats

            <i
                data-lucide="arrow-right"
            ></i>

        </a>

    `;

}


/* =========================================================
   26. SOLD OUT WAITLIST ACTION
   ========================================================= */

function createShowWaitlistAction(
    show
) {

    const firstCategory =
        show.seatCategories?.[0]
            ?.name ||
        "";


    return `

        <a
            href="./waitlist.html?show=${
                encodeURIComponent(
                    show.id
                )
            }${
                firstCategory
                    ? `&category=${
                        encodeURIComponent(
                            firstCategory
                        )
                    }`
                    : ""
            }"
            class="
                btn
                btn-outline
                show-select-button
            "
        >

            <i
                data-lucide="users-round"
            ></i>

            Join Waitlist

        </a>

    `;

}


/* =========================================================
   27. SHOW AVAILABILITY STATE
   ========================================================= */

function getShowAvailabilityState(
    availableSeats,
    totalSeats
) {

    if (
        availableSeats <= 0
    ) {

        return {

            label:
                "Sold Out",

            badgeClass:
                "badge-danger",

            dotClass:
                "danger"

        };

    }


    const ratio =
        totalSeats > 0
            ? availableSeats /
                totalSeats
            : 1;


    if (
        availableSeats <= 100 ||
        ratio <= 0.1
    ) {

        return {

            label:
                "Limited",

            badgeClass:
                "badge-warning",

            dotClass:
                "warning"

        };

    }


    return {

        label:
            "Available",

        badgeClass:
            "badge-success",

        dotClass:
            "success"

    };

}


/* =========================================================
   28. AVAILABLE SEAT COUNT
   ========================================================= */

function getShowAvailableSeatCount(
    show
) {

    return (
        show.seatCategories ||
        []
    )
        .reduce(
            (
                total,
                category
            ) =>
                total +
                Number(
                    category.availableSeats ||
                    0
                ),
            0
        );

}


/* =========================================================
   29. TOTAL SEAT COUNT
   ========================================================= */

function getShowTotalSeatCount(
    show
) {

    return (
        show.seatCategories ||
        []
    )
        .reduce(
            (
                total,
                category
            ) =>
                total +
                Number(
                    category.totalSeats ||
                    0
                ),
            0
        );

}


/* =========================================================
   30. STARTING PRICE
   ========================================================= */

function getShowStartingPrice(
    show
) {

    const prices =
        (
            show.seatCategories ||
            []
        )
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
   31. RESULT COUNT
   ========================================================= */

function updateShowsResultCount(
    count
) {

    setShowsText(
        "showsResultCount",
        count
    );


    const summary =
        document.querySelector(
            ".shows-result-summary span"
        );


    if (!summary) {
        return;
    }


    summary.innerHTML = `

        <strong>
            ${count}
        </strong>

        ${
            count === 1
                ? "show available"
                : "shows available"
        }

    `;

}


/* =========================================================
   32. EMPTY STATE
   ========================================================= */

function updateShowsEmptyState(
    count
) {

    const emptyState =
        document.getElementById(
            "showsEmptyState"
        );


    const list =
        document.getElementById(
            "showsList"
        );


    if (
        !emptyState ||
        !list
    ) {
        return;
    }


    const empty =
        count === 0;


    emptyState.hidden =
        !empty;


    list.hidden =
        empty;


    refreshShowsIcons();

}


/* =========================================================
   33. SHOW ALL DATES BUTTON
   ========================================================= */

function initializeShowAllDatesButton() {

    document
        .getElementById(
            "showAllDatesButton"
        )
        ?.addEventListener(
            "click",
            () => {

                skyraShowsState.selectedDate =
                    "ALL";


                skyraShowsState.selectedShowId =
                    null;


                updateShowsDateTabUI();

                updateShowsURL();

                renderShowsList();

            }
        );

}


/* =========================================================
   34. TOPBAR SEARCH
   ========================================================= */

function initializeShowsSearch() {

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

                showShowsToast(
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
   35. BACK LINK
   ========================================================= */

function updateShowsBackLink() {

    const event =
        skyraShowsState.event;


    const link =
        document.getElementById(
            "showsEventBackLink"
        );


    if (
        !event ||
        !link
    ) {
        return;
    }


    link.href =
        `./event-details.html?id=${
            encodeURIComponent(
                event.id
            )
        }`;

}


/* =========================================================
   36. URL STATE
   ========================================================= */

function updateShowsURL() {

    const event =
        skyraShowsState.event;


    if (!event) {
        return;
    }


    const params =
        new URLSearchParams();


    params.set(
        "event",
        event.id
    );


    /*
       Date selection is intentionally not written
       into the URL because it is only a browsing filter.
    */


    const query =
        params.toString();


    window.history.replaceState(
        {},
        document.title,
        `${
            window.location.pathname
        }?${query}`
    );

}


/* =========================================================
   37. EXPLORE NAVIGATION ACTIVE
   ========================================================= */

function keepShowsExploreNavigationActive() {

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


    const explore =
        [...links].find(
            (link) =>
                link.getAttribute(
                    "href"
                ) ===
                "./events.html"
        );


    if (explore) {

        explore.classList.add(
            "active"
        );


        explore.setAttribute(
            "aria-current",
            "page"
        );

    }

}


/* =========================================================
   38. DOCUMENT TITLE
   ========================================================= */

function updateShowsDocumentTitle() {

    const event =
        skyraShowsState.event;


    if (!event) {
        return;
    }


    document.title =
        `Select Show - ${event.title} | SKYRA`;

}


/* =========================================================
   39. NOT FOUND
   ========================================================= */

function showShowsNotFound(
    message
) {

    const state =
        document.getElementById(
            "showsNotFoundState"
        );


    const content =
        document.getElementById(
            "showsPageContent"
        );


    if (state) {

        state.hidden =
            false;


        const messageElement =
            document.getElementById(
                "showsNotFoundMessage"
            );


        if (
            messageElement &&
            message
        ) {

            messageElement.textContent =
                message;

        }

    }


    if (content) {

        content.hidden =
            true;

    }


    document.title =
        "Event Unavailable | SKYRA";


    refreshShowsIcons();

}


/* =========================================================
   40. HIDE NOT FOUND
   ========================================================= */

function hideShowsNotFound() {

    const state =
        document.getElementById(
            "showsNotFoundState"
        );


    const content =
        document.getElementById(
            "showsPageContent"
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
   41. SHOW TIMESTAMP
   ========================================================= */

function getShowsTimestamp(
    show
) {

    const date =
        parseShowsDate(
            show.date
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
   42. DATE PARSER
   ========================================================= */

function parseShowsDate(
    value
) {

    if (!value) {

        return null;

    }


    /*
       Parse YYYY-MM-DD manually so browser timezone
       conversion does not shift the calendar date.
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
   43. FORMAT TIME
   ========================================================= */

function formatShowsTime(
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
   44. FORMAT CURRENCY
   ========================================================= */

function formatShowsCurrency(
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
   45. EVENT TYPE
   ========================================================= */

function formatShowsEventType(
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

            return formatShowsLabel(
                type ||
                "Event"
            );

    }

}


/* =========================================================
   46. EVENT ICON
   ========================================================= */

function getShowsEventIcon(
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
   47. FORMAT LABEL
   ========================================================= */

function formatShowsLabel(
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
   48. SAFE TEXT SETTER
   ========================================================= */

function setShowsText(
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
   49. HTML ESCAPE
   ========================================================= */

function escapeShowsHTML(
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
   50. ATTRIBUTE ESCAPE
   ========================================================= */

function escapeShowsAttribute(
    value
) {

    return escapeShowsHTML(
        value
    );

}


/* =========================================================
   51. SELECTOR ESCAPE
   ========================================================= */

function escapeShowsSelector(
    value
) {

    const text =
        String(
            value ?? ""
        );


    if (
        window.CSS &&
        typeof window.CSS.escape ===
            "function"
    ) {

        return window.CSS.escape(
            text
        );

    }


    return text.replace(
        /["\\]/g,
        "\\$&"
    );

}


/* =========================================================
   52. TOAST
   ========================================================= */

function showShowsToast(
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

function refreshShowsIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   54. EXPOSE SHOW PAGE HELPERS
   ========================================================= */

window.SKYRA_SHOWS = {

    getEvent:
        () =>
            skyraShowsState.event,

    getShows:
        () => [
            ...skyraShowsState.shows
        ],

    getState:
        () => ({
            ...skyraShowsState
        }),

    selectDate:
        (date) => {

            skyraShowsState.selectedDate =
                date ||
                "ALL";


            skyraShowsState.selectedShowId =
                null;


            renderShowsDateTabs();

            renderShowsList();

        },

    refresh:
        () => {

            if (
                skyraShowsState.eventId
            ) {

                loadShowsEvent(
                    skyraShowsState.eventId
                );

            }

        }

};


/* =========================================================
   END OF SKYRA CUSTOMER SHOWS JAVASCRIPT
   ========================================================= */