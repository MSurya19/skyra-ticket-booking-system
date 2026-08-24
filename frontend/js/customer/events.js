/* =========================================================
   SKYRA - CUSTOMER EVENTS PAGE
   File: frontend/js/customer/events.js

   Used by:
   - customer/events.html

   Depends on:
   - ../common.js

   Phase 10:
   - Events are loaded from the real customer API / MongoDB.
   - No active mock-data Event/Show/Venue fallback is used.

   Handles:
   - Events rendering from backend data
   - Search
   - URL search/type parameters
   - Category filtering
   - City filtering
   - Language filtering
   - Date filtering
   - Sorting
   - Active filter chips
   - Result count
   - Empty state
   - Favourites
   - Mobile filters
   - Load more
   - Featured event
   - Customer/sidebar information
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_EVENTS_STORAGE_KEYS = {

    FAVOURITES:
        "skyra_favourites"

};


const SKYRA_EVENTS_PAGE_SIZE =
    6;


/* =========================================================
   2. PAGE STATE
   ========================================================= */

const skyraEventsState = {

    search:
        "",

    type:
        "ALL",

    city:
        "ALL",

    language:
        "ALL",

    date:
        "ALL",

    sort:
        "POPULAR",

    visibleCount:
        SKYRA_EVENTS_PAGE_SIZE,

    /*
       Phase 10 backend cache.
       MongoDB remains the source of truth; this array only holds
       the most recent API result for rendering the current page.
    */
    events:
        [],

    total:
        0,

    loading:
        false,

    requestId:
        0

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeEventsPage();

    }
);


/* =========================================================
   4. INITIALIZE PAGE
   ========================================================= */

async function initializeEventsPage() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getCustomerEvents !==
            "function"
    ) {

        console.error(
            "SKYRA Phase 10 customer Event API is unavailable."
        );


        showEventsToast(
            "Events could not be loaded. Refresh after updating common.js.",
            "error"
        );


        return;

    }


    initializeEventsUser();

    initializeEventsFromURL();

    initializeCategoryTabs();

    initializeMainSearch();

    initializeTopbarSearch();

    initializeDesktopFilters();

    initializeResetFilters();

    initializeMobileFilters();

    initializeEmptyStateReset();

    initializeLoadMore();

    updateEventsAccountIndicators();


    /*
       Strict Phase 10 path:
       customer/events.html now obtains Event data from the backend.
    */
    await applyEventsFilters();


    refreshEventsIcons();

}


/* =========================================================
   5. LUCIDE ICONS
   ========================================================= */

function refreshEventsIcons() {

    if (
        typeof lucide !== "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   6. INITIALIZE USER
   ========================================================= */

function initializeEventsUser() {

    const storedUser =
        window.SKYRA_COMMON
            ?.getUser?.();


    const user =
        storedUser;


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
            : createEventsInitials(
                name
            );


    setEventsText(
        "sidebarUserName",
        name
    );


    setEventsText(
        "sidebarUserInitials",
        initials
    );


    setEventsText(
        "topbarUserName",
        name
    );


    setEventsText(
        "topbarUserInitials",
        initials
    );


    setEventsText(
        "dropdownUserName",
        name
    );


    setEventsText(
        "dropdownUserInitials",
        initials
    );


    if (email) {

        setEventsText(
            "dropdownUserEmail",
            email
        );

    }

}


/* =========================================================
   7. FALLBACK INITIALS
   ========================================================= */

function createEventsInitials(
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
   8. READ URL PARAMETERS

   Supported examples:

   events.html?search=coldplay
   events.html?type=movie
   events.html?type=concert
   events.html?type=live
   events.html?type=event
   ========================================================= */

function initializeEventsFromURL() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const search =
        params.get(
            "search"
        );


    const type =
        params.get(
            "type"
        );


    if (search) {

        skyraEventsState.search =
            search.trim();

    }


    if (type) {

        skyraEventsState.type =
            normalizeEventTypeParameter(
                type
            );

    }


    syncEventsControlsFromState();

}


/* =========================================================
   9. NORMALIZE TYPE PARAMETER
   ========================================================= */

function normalizeEventTypeParameter(
    type
) {

    switch (
        String(type || "")
            .trim()
            .toUpperCase()
    ) {

        case "MOVIE":
        case "MOVIES":

            return "MOVIE";


        case "CONCERT":
        case "CONCERTS":

            return "CONCERT";


        case "LIVE":
        case "LIVE_SHOW":
        case "LIVE-SHOW":
        case "LIVESHOW":

            return "LIVE_SHOW";


        case "EVENT":
        case "EVENTS":

            return "EVENT";


        default:

            return "ALL";

    }

}


/* =========================================================
   10. CATEGORY TABS
   ========================================================= */

function initializeCategoryTabs() {

    const tabs =
        document.querySelectorAll(
            ".events-category-tab"
        );


    if (!tabs.length) {
        return;
    }


    tabs.forEach(
        (tab) => {

            tab.addEventListener(
                "click",
                () => {

                    const type =
                        tab.dataset
                            .type ||
                        "ALL";


                    skyraEventsState.type =
                        type;


                    skyraEventsState.visibleCount =
                        SKYRA_EVENTS_PAGE_SIZE;


                    updateCategoryTabUI();

                    updateEventsURL();

                    applyEventsFilters();

                }
            );

        }
    );


    updateCategoryTabUI();

}


/* =========================================================
   11. UPDATE CATEGORY TAB UI
   ========================================================= */

function updateCategoryTabUI() {

    const tabs =
        document.querySelectorAll(
            ".events-category-tab"
        );


    tabs.forEach(
        (tab) => {

            const active =
                tab.dataset.type ===
                skyraEventsState.type;


            tab.classList.toggle(
                "active",
                active
            );


            tab.setAttribute(
                "aria-pressed",
                String(active)
            );

        }
    );

}


/* =========================================================
   12. MAIN SEARCH
   ========================================================= */

function initializeMainSearch() {

    const input =
        document.getElementById(
            "eventsSearchInput"
        );

    const clearButton =
        document.getElementById(
            "clearEventsSearch"
        );


    if (!input) {
        return;
    }


    input.value =
        skyraEventsState.search;


    updateSearchClearButton();


    const debouncedSearch =
        window.SKYRA_COMMON
            ?.debounce
            ? window.SKYRA_COMMON
                .debounce(
                    handleEventsSearch,
                    220
                )
            : debounceEvents(
                handleEventsSearch,
                220
            );


    input.addEventListener(
        "input",
        () => {

            skyraEventsState.search =
                input.value.trim();


            updateSearchClearButton();


            debouncedSearch();

        }
    );


    clearButton?.addEventListener(
        "click",
        () => {

            input.value = "";


            skyraEventsState.search =
                "";


            skyraEventsState.visibleCount =
                SKYRA_EVENTS_PAGE_SIZE;


            updateSearchClearButton();

            updateEventsURL();

            applyEventsFilters();


            input.focus();

        }
    );

}


/* =========================================================
   13. SEARCH HANDLER
   ========================================================= */

function handleEventsSearch() {

    skyraEventsState.visibleCount =
        SKYRA_EVENTS_PAGE_SIZE;


    updateEventsURL();

    applyEventsFilters();

}


/* =========================================================
   14. SEARCH CLEAR BUTTON
   ========================================================= */

function updateSearchClearButton() {

    const clearButton =
        document.getElementById(
            "clearEventsSearch"
        );


    if (!clearButton) {
        return;
    }


    clearButton.hidden =
        !skyraEventsState.search;

}


/* =========================================================
   15. TOPBAR SEARCH
   ========================================================= */

function initializeTopbarSearch() {

    const input =
        document.getElementById(
            "dashboardSearch"
        );


    if (!input) {
        return;
    }


    if (
        skyraEventsState.search
    ) {

        input.value =
            skyraEventsState.search;

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


            const value =
                input.value.trim();


            skyraEventsState.search =
                value;


            const mainSearch =
                document.getElementById(
                    "eventsSearchInput"
                );


            if (mainSearch) {

                mainSearch.value =
                    value;

            }


            skyraEventsState.visibleCount =
                SKYRA_EVENTS_PAGE_SIZE;


            updateSearchClearButton();

            updateEventsURL();

            applyEventsFilters();


            document
                .getElementById(
                    "eventsGrid"
                )
                ?.scrollIntoView(
                    {
                        behavior:
                            "smooth",

                        block:
                            "start"
                    }
                );

        }
    );

}


/* =========================================================
   16. DESKTOP FILTERS
   ========================================================= */

function initializeDesktopFilters() {

    const city =
        document.getElementById(
            "eventsCityFilter"
        );

    const language =
        document.getElementById(
            "eventsLanguageFilter"
        );

    const date =
        document.getElementById(
            "eventsDateFilter"
        );

    const sort =
        document.getElementById(
            "eventsSortFilter"
        );


    city?.addEventListener(
        "change",
        () => {

            skyraEventsState.city =
                city.value;


            handleFilterChange();

        }
    );


    language?.addEventListener(
        "change",
        () => {

            skyraEventsState.language =
                language.value;


            handleFilterChange();

        }
    );


    date?.addEventListener(
        "change",
        () => {

            skyraEventsState.date =
                date.value;


            handleFilterChange();

        }
    );


    sort?.addEventListener(
        "change",
        () => {

            skyraEventsState.sort =
                sort.value;


            handleFilterChange();

        }
    );

}


/* =========================================================
   17. FILTER CHANGE
   ========================================================= */

function handleFilterChange() {

    skyraEventsState.visibleCount =
        SKYRA_EVENTS_PAGE_SIZE;


    syncMobileFiltersFromState();

    updateEventsURL();

    applyEventsFilters();

}


/* =========================================================
   18. RESET BUTTON
   ========================================================= */

function initializeResetFilters() {

    const button =
        document.getElementById(
            "resetEventsFilters"
        );


    button?.addEventListener(
        "click",
        resetAllEventsFilters
    );

}


/* =========================================================
   19. RESET ALL FILTERS
   ========================================================= */

function resetAllEventsFilters() {

    skyraEventsState.search =
        "";

    skyraEventsState.type =
        "ALL";

    skyraEventsState.city =
        "ALL";

    skyraEventsState.language =
        "ALL";

    skyraEventsState.date =
        "ALL";

    skyraEventsState.sort =
        "POPULAR";

    skyraEventsState.visibleCount =
        SKYRA_EVENTS_PAGE_SIZE;


    syncEventsControlsFromState();

    updateCategoryTabUI();

    updateEventsURL();

    applyEventsFilters();

}


/* =========================================================
   20. SYNC CONTROLS FROM STATE
   ========================================================= */

function syncEventsControlsFromState() {

    setInputValue(
        "eventsSearchInput",
        skyraEventsState.search
    );


    setInputValue(
        "dashboardSearch",
        skyraEventsState.search
    );


    setInputValue(
        "eventsCityFilter",
        skyraEventsState.city
    );


    setInputValue(
        "eventsLanguageFilter",
        skyraEventsState.language
    );


    setInputValue(
        "eventsDateFilter",
        skyraEventsState.date
    );


    setInputValue(
        "eventsSortFilter",
        skyraEventsState.sort
    );


    syncMobileFiltersFromState();

    updateSearchClearButton();

    updateCategoryTabUI();

}


/* =========================================================
   21. SET INPUT VALUE
   ========================================================= */

function setInputValue(
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


    element.value =
        value;

}


/* =========================================================
   22. APPLY FILTERS
   ========================================================= */

async function applyEventsFilters() {

    const requestId =
        ++skyraEventsState
            .requestId;


    skyraEventsState.loading =
        true;


    try {

        const response =
            await window.SKYRA_API
                .getCustomerEvents(
                    buildCustomerEventsQuery()
                );


        /*
           Ignore a slower older request if the user changed a
           filter/search again while that request was in flight.
        */
        if (
            requestId !==
            skyraEventsState
                .requestId
        ) {

            return;

        }


        const events =
            Array.isArray(
                response?.data?.events
            )
                ? response.data.events
                : [];


        skyraEventsState.events =
            events.map(
                normalizeCustomerEvent
            );


        skyraEventsState.total =
            Number(
                response?.data?.pagination
                    ?.total ??
                skyraEventsState.events
                    .length
            );


        const filteredEvents =
            getFilteredEvents();


        renderEventsGrid(
            filteredEvents
        );


        renderActiveFilters();

        updateEventsResultsHeader(
            skyraEventsState.total
        );


        updateEventsEmptyState(
            filteredEvents.length
        );


        updateLoadMoreButton(
            filteredEvents.length
        );


        updateEventsAccountIndicators();

        renderFeaturedEvent();

    } catch (error) {

        if (
            requestId !==
            skyraEventsState
                .requestId
        ) {

            return;

        }


        console.error(
            "Unable to load customer Events:",
            error
        );


        skyraEventsState.events =
            [];

        skyraEventsState.total =
            0;


        renderEventsGrid(
            []
        );


        renderActiveFilters();

        updateEventsResultsHeader(
            0
        );


        updateEventsEmptyState(
            0
        );


        updateLoadMoreButton(
            0
        );


        showEventsToast(
            error?.message ||
            "Unable to load events from SKYRA.",
            "error",
            "Events Unavailable"
        );

    } finally {

        if (
            requestId ===
            skyraEventsState
                .requestId
        ) {

            skyraEventsState.loading =
                false;

        }

    }

}


/* =========================================================
   22.1 BUILD CUSTOMER EVENT QUERY
   ========================================================= */

function buildCustomerEventsQuery() {

    return {

        search:
            skyraEventsState.search,

        type:
            skyraEventsState.type,

        city:
            skyraEventsState.city,

        language:
            skyraEventsState.language,

        date:
            skyraEventsState.date,

        sort:
            skyraEventsState.sort,

        /*
           Fetch the filtered result set once, then preserve the
           existing client-side "Load More" presentation in groups
           of SKYRA_EVENTS_PAGE_SIZE.
        */
        page:
            1,

        limit:
            100

    };

}


/* =========================================================
   22.2 NORMALIZE CUSTOMER EVENT
   ========================================================= */

function normalizeCustomerEvent(
    event
) {

    const id =
        String(
            event?._id ||
            event?.id ||
            ""
        );


    const nextShow =
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
                    ),

                _id:
                    String(
                        event.nextShow
                            ._id ||
                        event.nextShow
                            .id ||
                        ""
                    )
            }
            : null;


    return {

        ...event,

        id,

        _id:
            id,

        category:
            event?.category ||
            event?.genre ||
            "",

        genre:
            event?.genre ||
            event?.category ||
            "",

        shortDescription:
            event?.shortDescription ||
            event?.description ||
            "",

        tags:
            Array.isArray(
                event?.tags
            )
                ? event.tags
                : [],

        performers:
            Array.isArray(
                event?.performers
            )
                ? event.performers
                : [],

        cities:
            Array.isArray(
                event?.cities
            )
                ? event.cities
                : [],

        showCount:
            Number(
                event?.showCount ||
                0
            ),

        startingPrice:
            event?.startingPrice ===
                null ||
            event?.startingPrice ===
                undefined
                ? null
                : Number(
                    event.startingPrice
                ),

        nextShow

    };

}


/* =========================================================
   23. GET FILTERED EVENTS
   ========================================================= */

function getFilteredEvents() {

    /*
       Phase 10 filtering and sorting are server-authoritative.
       Return a defensive copy of the current API result so
       rendering code cannot mutate the cached response.
    */
    return [
        ...skyraEventsState.events
    ];

}


/* =========================================================
   24. EVENT DATE FILTER
   ========================================================= */

function eventMatchesDateFilter(
    event,
    filter
) {

    /*
       The live page no longer calls this for filtering because
       Phase 10 performs date filtering in GET /api/events.
       Retain it as a safe utility for exposed/debug helpers.
    */

    if (
        !filter ||
        filter ===
            "ALL"
    ) {

        return true;

    }


    const nextShow =
        event?.nextShow;


    if (!nextShow) {

        return false;

    }


    const showDate =
        parseEventDate(
            nextShow.date
        );


    if (!showDate) {

        return false;

    }


    const today =
        getTodayStart();


    switch (filter) {

        case "TODAY":

            return isSameCalendarDay(
                showDate,
                today
            );


        case "THIS_WEEK":

            return isDateThisWeek(
                showDate,
                today
            );


        case "THIS_MONTH":

            return (
                showDate.getFullYear() ===
                    today.getFullYear() &&
                showDate.getMonth() ===
                    today.getMonth() &&
                showDate >=
                    today
            );


        case "UPCOMING":

            return showDate >=
                today;


        default:

            return true;

    }

}


/* =========================================================
   25. TODAY START
   ========================================================= */

function getTodayStart() {

    const now =
        new Date();


    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

}


/* =========================================================
   26. SAME DAY
   ========================================================= */

function isSameCalendarDay(
    first,
    second
) {

    return (
        first.getFullYear() ===
            second.getFullYear()
        &&
        first.getMonth() ===
            second.getMonth()
        &&
        first.getDate() ===
            second.getDate()
    );

}


/* =========================================================
   27. THIS WEEK
   ========================================================= */

function isDateThisWeek(
    date,
    today
) {

    const start =
        new Date(
            today
        );


    /*
       Monday is considered the first day of the week.
    */

    const day =
        start.getDay();


    const mondayOffset =
        day === 0
            ? -6
            : 1 - day;


    start.setDate(
        start.getDate() +
        mondayOffset
    );


    const end =
        new Date(
            start
        );


    end.setDate(
        end.getDate() + 6
    );


    end.setHours(
        23,
        59,
        59,
        999
    );


    return (
        date >= today &&
        date >= start &&
        date <= end
    );

}


/* =========================================================
   28. SORT EVENTS
   ========================================================= */

function sortEvents(
    events,
    sort
) {

    const sorted =
        [...events];


    switch (sort) {

        case "DATE_ASC":

            sorted.sort(
                (a, b) =>
                    getEventSortDate(a) -
                    getEventSortDate(b)
            );

            break;


        case "PRICE_ASC":

            sorted.sort(
                (a, b) =>
                    getEventSortPrice(a) -
                    getEventSortPrice(b)
            );

            break;


        case "PRICE_DESC":

            sorted.sort(
                (a, b) =>
                    getEventSortPrice(b) -
                    getEventSortPrice(a)
            );

            break;


        case "TITLE_ASC":

            sorted.sort(
                (a, b) =>
                    String(a.title)
                        .localeCompare(
                            String(b.title)
                        )
            );

            break;


        case "POPULAR":
        default:

            sorted.sort(
                (a, b) => {

                    const popularDifference =
                        Number(
                            Boolean(
                                b.popular
                            )
                        ) -
                        Number(
                            Boolean(
                                a.popular
                            )
                        );


                    if (
                        popularDifference !==
                        0
                    ) {

                        return popularDifference;

                    }


                    const featuredDifference =
                        Number(
                            Boolean(
                                b.featured
                            )
                        ) -
                        Number(
                            Boolean(
                                a.featured
                            )
                        );


                    if (
                        featuredDifference !==
                        0
                    ) {

                        return featuredDifference;

                    }


                    return (
                        getEventSortDate(a) -
                        getEventSortDate(b)
                    );

                }
            );

    }


    return sorted;

}


/* =========================================================
   29. SORT DATE
   ========================================================= */

function getEventSortDate(
    event
) {

    const show =
        event?.nextShow;


    if (!show) {

        return Number.MAX_SAFE_INTEGER;

    }


    if (show.startsAt) {

        const timestamp =
            new Date(
                show.startsAt
            ).getTime();


        if (
            Number.isFinite(
                timestamp
            )
        ) {

            return timestamp;

        }

    }


    return getShowTimestamp(
        show
    );

}


/* =========================================================
   30. SORT PRICE
   ========================================================= */

function getEventSortPrice(
    event
) {

    const price =
        event?.startingPrice;


    if (
        price === null ||
        price === undefined ||
        !Number.isFinite(
            Number(
                price
            )
        )
    ) {

        return Number.MAX_SAFE_INTEGER;

    }


    return Number(
        price
    );

}


/* =========================================================
   31. RENDER EVENTS GRID
   ========================================================= */

function renderEventsGrid(
    events
) {

    const grid =
        document.getElementById(
            "eventsGrid"
        );


    if (!grid) {
        return;
    }


    const favourites =
        getEventsFavourites();


    const visibleEvents =
        events.slice(
            0,
            skyraEventsState.visibleCount
        );


    grid.innerHTML =
        visibleEvents
            .map(
                (event) =>
                    createEventsCard(
                        event,
                        favourites.includes(
                            event.id
                        )
                    )
            )
            .join("");


    initializeEventsFavouriteButtons();

    refreshEventsIcons();

}


/* =========================================================
   32. CREATE EVENT CARD
   ========================================================= */

function createEventsCard(
    event,
    favourite
) {

    const details =
        getEventPrimaryDetails(
            event.id
        );


    const show =
        details?.show;


    const venue =
        details?.venue;


    const typeLabel =
        formatEventsType(
            event.type
        );


    const typeClass =
        getEventsTypeClass(
            event.type
        );


    const posterClass =
        getEventsPosterClass(
            event.id
        );


    const posterContent =
        createEventsPosterContent(
            event
        );


    const date =
        show
            ? formatEventsDate(
                show.date
            )
            : "Shows Coming Soon";


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
            : "Multiple Cinemas";


    const startingPrice =
        event.startingPrice ===
            null ||
        event.startingPrice ===
            undefined
            ? null
            : Number(
                event.startingPrice
            );


    const price =
        startingPrice !== null
            ? formatEventsCurrency(
                startingPrice
            )
            : "Coming Soon";


    const hoverLabel =
        event.type === "MOVIE"
            ? "View Movie"
            : event.type === "LIVE_SHOW"
                ? "View Show"
                : "View Event";


    return `

        <article
            class="events-listing-card"
            data-event-id="${escapeEventsAttribute(
                event.id
            )}"
        >

            <a
                href="./event-details.html?id=${
                    encodeURIComponent(
                        event.id
                    )
                }"
                class="
                    events-listing-poster
                    ${posterClass}
                "
            >

                <span
                    class="
                        events-card-type
                        ${typeClass}
                    "
                >
                    ${escapeEventsHTML(
                        typeLabel
                    )}
                </span>


                <button
                    type="button"
                    class="
                        events-favourite-btn
                        ${
                            favourite
                                ? "active"
                                : ""
                        }
                    "
                    data-event-id="${escapeEventsAttribute(
                        event.id
                    )}"
                    aria-label="${
                        favourite
                            ? "Remove"
                            : "Add"
                    } ${escapeEventsAttribute(
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
                >

                    <i
                        data-lucide="heart"
                    ></i>

                </button>


                ${posterContent}


                <div
                    class="events-card-hover-action"
                >

                    <span>
                        ${hoverLabel}
                    </span>

                    <i
                        data-lucide="arrow-up-right"
                    ></i>

                </div>

            </a>


            <div class="events-listing-body">

                <div class="events-listing-title">

                    <div>

                        <h3>
                            ${escapeEventsHTML(
                                event.title
                            )}
                        </h3>

                        <p>
                            ${escapeEventsHTML(
                                [
                                    event.genre,
                                    typeLabel
                                ]
                                    .filter(Boolean)
                                    .join(" • ")
                            )}
                        </p>

                    </div>


                    ${
                        event.popular
                            ? `

                                <span
                                    class="events-popular-badge"
                                >

                                    <i
                                        data-lucide="flame"
                                    ></i>

                                    Popular

                                </span>

                            `
                            : ""
                    }

                </div>


                <div class="events-listing-meta">

                    <span>

                        <i
                            data-lucide="calendar-days"
                        ></i>

                        ${escapeEventsHTML(
                            date
                        )}

                    </span>


                    <span>

                        <i
                            data-lucide="map-pin"
                        ></i>

                        ${escapeEventsHTML(
                            location
                        )}

                    </span>

                </div>


                <div class="events-listing-footer">

                    <div class="events-listing-price">

                        <span>
                            ${
                                startingPrice !== null
                                    ? "Starts from"
                                    : "Booking"
                            }
                        </span>

                        <strong>
                            ${escapeEventsHTML(
                                price
                            )}
                        </strong>

                    </div>


                    <a
                        href="./event-details.html?id=${
                            encodeURIComponent(
                                event.id
                            )
                        }"
                        class="events-card-action-btn"
                        aria-label="View ${escapeEventsAttribute(
                            event.title
                        )}"
                    >

                        <i
                            data-lucide="arrow-right"
                        ></i>

                    </a>

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   33. PRIMARY EVENT DETAILS
   ========================================================= */

function getEventPrimaryDetails(
    eventId
) {

    const event =
        skyraEventsState
            .events
            .find(
                (item) =>
                    String(
                        item.id
                    ) ===
                    String(
                        eventId
                    )
            );


    const show =
        event?.nextShow ||
        null;


    if (!show) {

        return {

            show:
                null,

            venue:
                null

        };

    }


    const venue = {

        id:
            String(
                show.venueId ||
                ""
            ),

        _id:
            String(
                show.venueId ||
                ""
            ),

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


    return {

        show,

        venue

    };

}


/* =========================================================
   34. SHOW TIMESTAMP
   ========================================================= */

function getShowTimestamp(
    show
) {

    const date =
        parseEventDate(
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
   35. POSTER CLASS
   ========================================================= */

function getEventsPosterClass(
    eventId
) {

    const classes = {

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
        classes[eventId] ||
        "events-poster-coldplay"
    );

}


/* =========================================================
   36. POSTER CONTENT
   ========================================================= */

function createEventsPosterContent(
    event
) {

    switch (event.id) {

        case "coldplay":

            return `

                <div
                    class="events-poster-content"
                >

                    <small>
                        MUSIC OF THE SPHERES
                    </small>

                    <strong>
                        COLDPLAY
                    </strong>

                    <span>
                        LIVE 2026
                    </span>

                </div>

            `;


        case "diljit":

            return `

                <div
                    class="events-poster-content"
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
                        events-poster-content
                        events-space-poster
                    "
                >

                    <span
                        class="events-space-planet"
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
                    class="events-poster-content"
                >

                    <small>
                        LIVE IN CONCERT
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
                    class="events-poster-content"
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


        case "avengers-secret-wars":

            return `

                <div
                    class="events-poster-content"
                >

                    <small>
                        MARVEL STUDIOS
                    </small>

                    <strong>
                        AVENGERS
                    </strong>

                    <span>
                        SECRET WARS
                    </span>

                </div>

            `;


        default:

            return `

                <div
                    class="events-poster-content"
                >

                    <small>
                        ${escapeEventsHTML(
                            event.category ||
                            "SKYRA"
                        )}
                    </small>

                    <strong>
                        ${escapeEventsHTML(
                            event.title
                        )}
                    </strong>

                </div>

            `;

    }

}


/* =========================================================
   37. FAVOURITES
   ========================================================= */

function initializeEventsFavouriteButtons() {

    const buttons =
        document.querySelectorAll(
            ".events-favourite-btn"
        );


    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    event.stopPropagation();


                    const eventId =
                        button.dataset
                            .eventId;


                    if (!eventId) {
                        return;
                    }


                    toggleEventsFavourite(
                        eventId,
                        button
                    );

                }
            );

        }
    );

}


/* =========================================================
   38. GET FAVOURITES
   ========================================================= */

function getEventsFavourites() {

    try {

        const value =
            localStorage.getItem(
                SKYRA_EVENTS_STORAGE_KEYS
                    .FAVOURITES
            );


        if (!value) {

            return [];

        }


        const parsed =
            JSON.parse(
                value
            );


        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch {

        return [];

    }

}


/* =========================================================
   39. TOGGLE FAVOURITE
   ========================================================= */

function toggleEventsFavourite(
    eventId,
    button
) {

    const favourites =
        getEventsFavourites();


    const index =
        favourites.indexOf(
            eventId
        );


    let active;


    if (index >= 0) {

        favourites.splice(
            index,
            1
        );


        active = false;

    } else {

        favourites.push(
            eventId
        );


        active = true;

    }


    try {

        localStorage.setItem(
            SKYRA_EVENTS_STORAGE_KEYS
                .FAVOURITES,

            JSON.stringify(
                favourites
            )
        );

    } catch {

        showEventsToast(
            "Unable to update favourites.",
            "error"
        );


        return;

    }


    button.classList.toggle(
        "active",
        active
    );


    button.setAttribute(
        "aria-pressed",
        String(active)
    );


    const event =
        skyraEventsState
            .events
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
            active
                ? "Remove"
                : "Add"
        } ${
            event?.title ||
            "event"
        } ${
            active
                ? "from"
                : "to"
        } favourites`
    );


    showEventsToast(

        active
            ? `${
                event?.title ||
                "Event"
            } added to favourites.`
            : `${
                event?.title ||
                "Event"
            } removed from favourites.`,

        active
            ? "success"
            : "info",

        active
            ? "Saved"
            : "Removed"

    );

}


/* =========================================================
   40. ACTIVE FILTER CHIPS
   ========================================================= */

function renderActiveFilters() {

    const container =
        document.getElementById(
            "eventsActiveFilters"
        );


    if (!container) {
        return;
    }


    const filters = [];


    if (
        skyraEventsState.search
    ) {

        filters.push({

            key:
                "search",

            label:
                `Search: ${skyraEventsState.search}`

        });

    }


    if (
        skyraEventsState.type !==
        "ALL"
    ) {

        filters.push({

            key:
                "type",

            label:
                formatEventsType(
                    skyraEventsState.type
                )

        });

    }


    if (
        skyraEventsState.city !==
        "ALL"
    ) {

        filters.push({

            key:
                "city",

            label:
                skyraEventsState.city

        });

    }


    if (
        skyraEventsState.language !==
        "ALL"
    ) {

        filters.push({

            key:
                "language",

            label:
                skyraEventsState.language

        });

    }


    if (
        skyraEventsState.date !==
        "ALL"
    ) {

        filters.push({

            key:
                "date",

            label:
                formatDateFilterLabel(
                    skyraEventsState.date
                )

        });

    }


    container.innerHTML =
        filters
            .map(
                (filter) => `

                    <span
                        class="events-filter-chip"
                    >

                        ${escapeEventsHTML(
                            filter.label
                        )}

                        <button
                            type="button"
                            data-remove-filter="${filter.key}"
                            aria-label="Remove ${escapeEventsAttribute(
                                filter.label
                            )} filter"
                        >

                            <i
                                data-lucide="x"
                            ></i>

                        </button>

                    </span>

                `
            )
            .join("");


    container
        .querySelectorAll(
            "[data-remove-filter]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        removeEventsFilter(
                            button.dataset
                                .removeFilter
                        );

                    }
                );

            }
        );


    refreshEventsIcons();

}


/* =========================================================
   41. REMOVE ONE FILTER
   ========================================================= */

function removeEventsFilter(
    key
) {

    switch (key) {

        case "search":

            skyraEventsState.search =
                "";

            break;


        case "type":

            skyraEventsState.type =
                "ALL";

            break;


        case "city":

            skyraEventsState.city =
                "ALL";

            break;


        case "language":

            skyraEventsState.language =
                "ALL";

            break;


        case "date":

            skyraEventsState.date =
                "ALL";

            break;

    }


    skyraEventsState.visibleCount =
        SKYRA_EVENTS_PAGE_SIZE;


    syncEventsControlsFromState();

    updateEventsURL();

    applyEventsFilters();

}


/* =========================================================
   42. RESULTS HEADER
   ========================================================= */

function updateEventsResultsHeader(
    count
) {

    setEventsText(
        "eventsResultCount",
        count
    );


    const title =
        document.getElementById(
            "eventsResultsTitle"
        );


    if (!title) {
        return;
    }


    if (
        skyraEventsState.search
    ) {

        title.textContent =
            "Search Results";

        return;

    }


    if (
        skyraEventsState.type !==
        "ALL"
    ) {

        title.textContent =
            getEventsTypeHeading(
                skyraEventsState.type
            );

        return;

    }


    title.textContent =
        "Popular Experiences";

}


/* =========================================================
   43. TYPE HEADING
   ========================================================= */

function getEventsTypeHeading(
    type
) {

    switch (type) {

        case "MOVIE":

            return "Movies";


        case "CONCERT":

            return "Concerts";


        case "LIVE_SHOW":

            return "Live Shows";


        case "EVENT":

            return "Events";


        default:

            return "Experiences";

    }

}


/* =========================================================
   44. EMPTY STATE
   ========================================================= */

function updateEventsEmptyState(
    count
) {

    const grid =
        document.getElementById(
            "eventsGrid"
        );

    const empty =
        document.getElementById(
            "eventsEmptyState"
        );


    if (!grid || !empty) {
        return;
    }


    const noResults =
        count === 0;


    grid.hidden =
        noResults;


    empty.hidden =
        !noResults;


    refreshEventsIcons();

}


/* =========================================================
   45. EMPTY RESET BUTTON
   ========================================================= */

function initializeEmptyStateReset() {

    document
        .getElementById(
            "emptyStateResetButton"
        )
        ?.addEventListener(
            "click",
            resetAllEventsFilters
        );

}


/* =========================================================
   46. LOAD MORE
   ========================================================= */

function initializeLoadMore() {

    const button =
        document.getElementById(
            "eventsLoadMoreButton"
        );


    button?.addEventListener(
        "click",
        () => {

            skyraEventsState.visibleCount +=
                SKYRA_EVENTS_PAGE_SIZE;


            applyEventsFilters();

        }
    );

}


/* =========================================================
   47. UPDATE LOAD MORE
   ========================================================= */

function updateLoadMoreButton(
    total
) {

    const section =
        document.getElementById(
            "eventsLoadMoreSection"
        );


    if (!section) {
        return;
    }


    section.hidden =
        total === 0 ||
        skyraEventsState
            .visibleCount >=
            total;

}


/* =========================================================
   48. MOBILE FILTERS
   ========================================================= */

function initializeMobileFilters() {

    const openButton =
        document.getElementById(
            "mobileFilterButton"
        );

    const closeButton =
        document.getElementById(
            "closeMobileFilters"
        );

    const applyButton =
        document.getElementById(
            "applyMobileFilters"
        );

    const resetButton =
        document.getElementById(
            "mobileResetFilters"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    openButton?.addEventListener(
        "click",
        openEventsMobileFilters
    );


    closeButton?.addEventListener(
        "click",
        closeEventsMobileFilters
    );


    overlay?.addEventListener(
        "click",
        () => {

            closeEventsMobileFilters();

        }
    );


    resetButton?.addEventListener(
        "click",
        () => {

            setInputValue(
                "mobileCityFilter",
                "ALL"
            );

            setInputValue(
                "mobileLanguageFilter",
                "ALL"
            );

            setInputValue(
                "mobileDateFilter",
                "ALL"
            );

            setInputValue(
                "mobileSortFilter",
                "POPULAR"
            );

        }
    );


    applyButton?.addEventListener(
        "click",
        () => {

            skyraEventsState.city =
                getInputValue(
                    "mobileCityFilter",
                    "ALL"
                );


            skyraEventsState.language =
                getInputValue(
                    "mobileLanguageFilter",
                    "ALL"
                );


            skyraEventsState.date =
                getInputValue(
                    "mobileDateFilter",
                    "ALL"
                );


            skyraEventsState.sort =
                getInputValue(
                    "mobileSortFilter",
                    "POPULAR"
                );


            skyraEventsState.visibleCount =
                SKYRA_EVENTS_PAGE_SIZE;


            syncDesktopFiltersFromState();

            closeEventsMobileFilters();

            updateEventsURL();

            applyEventsFilters();

        }
    );

}


/* =========================================================
   49. OPEN MOBILE FILTERS
   ========================================================= */

function openEventsMobileFilters() {

    const panel =
        document.getElementById(
            "eventsMobileFilterPanel"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (!panel) {
        return;
    }


    syncMobileFiltersFromState();


    panel.hidden =
        false;


    overlay?.classList.add(
        "active"
    );


    overlay?.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";


    refreshEventsIcons();

}


/* =========================================================
   50. CLOSE MOBILE FILTERS
   ========================================================= */

function closeEventsMobileFilters() {

    const panel =
        document.getElementById(
            "eventsMobileFilterPanel"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (!panel) {
        return;
    }


    panel.hidden =
        true;


    /*
       Only remove overlay if mobile sidebar
       isn't currently open.
    */

    if (
        !document.body.classList
            .contains(
                "mobile-sidebar-open"
            )
    ) {

        overlay?.classList.remove(
            "active"
        );


        overlay?.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    document.body.style.overflow =
        "";

}


/* =========================================================
   51. SYNC MOBILE FILTERS
   ========================================================= */

function syncMobileFiltersFromState() {

    setInputValue(
        "mobileCityFilter",
        skyraEventsState.city
    );


    setInputValue(
        "mobileLanguageFilter",
        skyraEventsState.language
    );


    setInputValue(
        "mobileDateFilter",
        skyraEventsState.date
    );


    setInputValue(
        "mobileSortFilter",
        skyraEventsState.sort
    );

}


/* =========================================================
   52. SYNC DESKTOP FILTERS
   ========================================================= */

function syncDesktopFiltersFromState() {

    setInputValue(
        "eventsCityFilter",
        skyraEventsState.city
    );


    setInputValue(
        "eventsLanguageFilter",
        skyraEventsState.language
    );


    setInputValue(
        "eventsDateFilter",
        skyraEventsState.date
    );


    setInputValue(
        "eventsSortFilter",
        skyraEventsState.sort
    );

}


/* =========================================================
   53. GET INPUT VALUE
   ========================================================= */

function getInputValue(
    id,
    fallback = ""
) {

    const element =
        document.getElementById(
            id
        );


    return (
        element?.value ??
        fallback
    );

}


/* =========================================================
   54. UPDATE URL
   ========================================================= */

function updateEventsURL() {

    const params =
        new URLSearchParams();


    if (
        skyraEventsState.search
    ) {

        params.set(
            "search",
            skyraEventsState.search
        );

    }


    if (
        skyraEventsState.type !==
        "ALL"
    ) {

        params.set(
            "type",
            getTypeURLValue(
                skyraEventsState.type
            )
        );

    }


    const query =
        params.toString();


    const url =
        query
            ? `${
                window.location.pathname
            }?${query}`
            : window.location.pathname;


    window.history.replaceState(
        {},
        document.title,
        url
    );

}


/* =========================================================
   55. TYPE URL VALUE
   ========================================================= */

function getTypeURLValue(
    type
) {

    switch (type) {

        case "MOVIE":

            return "movie";


        case "CONCERT":

            return "concert";


        case "LIVE_SHOW":

            return "live";


        case "EVENT":

            return "event";


        default:

            return "";

    }

}


/* =========================================================
   56. FEATURED EVENT
   ========================================================= */

function renderFeaturedEvent() {

    const banner =
        document.getElementById(
            "featuredEventBanner"
        );


    if (!banner) {

        return;

    }


    /*
       The backend currently has no separate "featured" flag.
       The API's POPULAR ordering is deterministic, so the first
       currently returned bookable Event becomes the banner item.
    */
    const featured =
        skyraEventsState
            .events
            .find(
                (event) =>
                    event.nextShow
            ) ||
        skyraEventsState
            .events[0];


    if (!featured) {

        banner.hidden =
            true;

        return;

    }


    banner.hidden =
        false;


    const details =
        getEventPrimaryDetails(
            featured.id
        );


    const show =
        details?.show;


    const venue =
        details?.venue;


    const title =
        banner.querySelector(
            ".events-featured-content h2"
        );


    const description =
        banner.querySelector(
            ".events-featured-content > p"
        );


    const meta =
        banner.querySelector(
            ".events-featured-meta"
        );


    const viewButton =
        banner.querySelector(
            ".events-featured-actions a:first-child"
        );


    const showsButton =
        banner.querySelector(
            ".events-featured-actions a:nth-child(2)"
        );


    if (title) {

        title.textContent =
            featured.title;

    }


    if (description) {

        description.textContent =
            featured.shortDescription ||
            featured.description ||
            "";

    }


    if (meta) {

        meta.innerHTML = `

            <span>

                <i
                    data-lucide="calendar-days"
                ></i>

                ${
                    show
                        ? escapeEventsHTML(
                            formatEventsDate(
                                show.date
                            )
                        )
                        : "Coming Soon"
                }

            </span>


            <span>

                <i
                    data-lucide="clock-3"
                ></i>

                ${
                    show
                        ? escapeEventsHTML(
                            formatEventsTime(
                                show.time
                            )
                        )
                        : "TBA"
                }

            </span>


            <span>

                <i
                    data-lucide="map-pin"
                ></i>

                ${
                    venue
                        ? escapeEventsHTML(
                            `${
                                venue.name
                            }${
                                venue.city
                                    ? `, ${venue.city}`
                                    : ""
                            }`
                        )
                        : "Venue Coming Soon"
                }

            </span>

        `;

    }


    if (viewButton) {

        viewButton.href =
            `./event-details.html?id=${
                encodeURIComponent(
                    featured.id
                )
            }`;

    }


    if (showsButton) {

        showsButton.href =
            `./shows.html?event=${
                encodeURIComponent(
                    featured.id
                )
            }`;

    }


    refreshEventsIcons();

}


/* =========================================================
   57. ACCOUNT INDICATORS
   ========================================================= */

function updateEventsAccountIndicators() {

    /*
       Waitlist and Notification APIs are later phases.
       Do not populate these badges from mock data while the
       Event discovery path is being made backend-authoritative.
    */

    setEventsText(
        "sidebarWaitlistCount",
        0
    );


    const notificationBadge =
        document.getElementById(
            "sidebarNotificationCount"
        );


    if (notificationBadge) {

        notificationBadge.textContent =
            "0";

        notificationBadge.hidden =
            true;

    }


    const notificationDot =
        document.getElementById(
            "topbarNotificationDot"
        );


    if (notificationDot) {

        notificationDot.hidden =
            true;

    }

}


/* =========================================================
   58. FORMAT EVENT TYPE
   ========================================================= */

function formatEventsType(
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

            return formatEventsLabel(
                type ||
                "Event"
            );

    }

}


/* =========================================================
   59. TYPE CLASS
   ========================================================= */

function getEventsTypeClass(
    type
) {

    switch (
        String(type || "")
            .toUpperCase()
    ) {

        case "MOVIE":

            return "movie";


        case "LIVE_SHOW":

            return "live";


        case "EVENT":

            return "event";


        default:

            return "concert";

    }

}


/* =========================================================
   60. DATE FILTER LABEL
   ========================================================= */

function formatDateFilterLabel(
    value
) {

    const labels = {

        TODAY:
            "Today",

        THIS_WEEK:
            "This Week",

        THIS_MONTH:
            "This Month",

        UPCOMING:
            "Upcoming"

    };


    return (
        labels[value] ||
        value
    );

}


/* =========================================================
   61. FORMAT LABEL
   ========================================================= */

function formatEventsLabel(
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
            (letter) =>
                letter.toUpperCase()
        );

}


/* =========================================================
   62. PARSE YYYY-MM-DD
   ========================================================= */

function parseEventDate(
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
   63. FORMAT DATE
   ========================================================= */

function formatEventsDate(
    value
) {

    const date =
        parseEventDate(
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
   64. FORMAT TIME
   ========================================================= */

function formatEventsTime(
    value
) {

    if (
        !value ||
        !/^\d{2}:\d{2}$/.test(
            value
        )
    ) {

        return value || "TBA";

    }


    const [
        hoursValue,
        minutes
    ] =
        value
            .split(":")
            .map(Number);


    const suffix =
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
    } ${suffix}`;

}


/* =========================================================
   65. FORMAT CURRENCY
   ========================================================= */

function formatEventsCurrency(
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


    const number =
        Number(value);


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
   66. TEXT SETTER
   ========================================================= */

function setEventsText(
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
   67. ESCAPE HTML
   ========================================================= */

function escapeEventsHTML(
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
   68. ESCAPE ATTRIBUTE
   ========================================================= */

function escapeEventsAttribute(
    value
) {

    return escapeEventsHTML(
        value
    );

}


/* =========================================================
   69. TOAST
   ========================================================= */

function showEventsToast(
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
   70. FALLBACK DEBOUNCE
   ========================================================= */

function debounceEvents(
    callback,
    delay
) {

    let timer;


    return function (
        ...args
    ) {

        window.clearTimeout(
            timer
        );


        timer =
            window.setTimeout(
                () => {

                    callback.apply(
                        this,
                        args
                    );

                },
                delay
            );

    };

}


/* =========================================================
   71. ESCAPE KEY FOR MOBILE FILTER
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape"
        ) {

            closeEventsMobileFilters();

        }

    }
);


/* =========================================================
   72. EXPOSE EVENTS HELPERS
   ========================================================= */

window.SKYRA_EVENTS = {

    refresh:
        applyEventsFilters,

    reset:
        resetAllEventsFilters,

    getState:
        () => ({
            ...skyraEventsState
        }),

    setType:
        (type) => {

            skyraEventsState.type =
                normalizeEventTypeParameter(
                    type
                );


            skyraEventsState.visibleCount =
                SKYRA_EVENTS_PAGE_SIZE;


            syncEventsControlsFromState();

            updateEventsURL();

            applyEventsFilters();

        }

};


/* =========================================================
   END OF SKYRA CUSTOMER EVENTS JAVASCRIPT
   ========================================================= */