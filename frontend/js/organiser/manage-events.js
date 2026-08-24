/* =========================================================
   SKYRA - ORGANISER MANAGE EVENTS
   File:
   frontend/js/organiser/manage-events.js

   Phase 7 backend-connected frontend:
   - Reads Organiser Events from MongoDB
   - Search
   - Status filter
   - Event type filter
   - Sorting
   - Edit routing
   - Create-show routing
   - Real backend soft deletion

   API:
   - GET    /api/organiser/events
   - DELETE /api/organiser/events/:eventId

   MongoDB/backend is the source of truth.
   No mock or local event-record fallback is used.
   ========================================================= */

"use strict";


/* =========================================================
   1. STORAGE KEYS
   Only the unsaved create-event draft is local UI state.
   Event records and status are backend-authoritative.
   ========================================================= */

const SKYRA_MANAGE_EVENTS_STORAGE = {
    EVENT_DRAFT: "skyra_organiser_event_draft"
};


/* =========================================================
   3. STATE
   ========================================================= */

const organiserManageEventsState = {

    events: [],

    filteredEvents: [],

    filter:
        "ALL",

    type:
        "ALL",

    search:
        "",

    sort:
        "NEWEST",

    deletingEventId:
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

        initializeManageEventsPage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

async function initializeManageEventsPage() {

    initializeManageEventsUser();

    initializeManageEventsNavigation();

    initializeManageEventsControls();

    initializeManageEventsDeleteModal();

    initializeManageEventsTopbarSearch();

    renderSavedEventDraft();


    await loadManageEvents();


    applySearchFromURL();

    refreshManageEventsIcons();

}


/* =========================================================
   6. LOAD EVENTS - REAL BACKEND
   ========================================================= */

async function loadManageEvents() {

    organiserManageEventsState.loading =
        true;


    try {

        const events =
            (
                await fetchManageEventsSource()
            )
                .map(
                    normalizeManageEvent
                )
                .filter(
                    (event) =>
                        Boolean(
                            event.id
                        ) &&
                        !event.deleted
                );


        organiserManageEventsState.events =
            events;


        renderManageEventSummary();

        renderManageEventSidebarCounts();

        applyManageEventFilters();

    } catch (error) {

        console.error(
            "Unable to load organiser events:",
            error
        );


        organiserManageEventsState.events =
            [];


        renderManageEventSummary();

        renderManageEventSidebarCounts();

        applyManageEventFilters();


        showManageEventToast(
            error?.message ||
            "Unable to load organiser events.",
            "error",
            "Events Unavailable"
        );

    } finally {

        organiserManageEventsState.loading =
            false;

    }

}


/* =========================================================
   7. DATA SOURCE - REAL BACKEND
   ========================================================= */

async function fetchManageEventsSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getOrganiserEvents !==
            "function"
    ) {

        throw new Error(
            "Event API is unavailable. Make sure Phase 7 common.js is loaded."
        );

    }


    const response =
        await window.SKYRA_API
            .getOrganiserEvents({
                limit:
                    100
            });


    const events =
        response?.data?.events ||
        response?.events ||
        null;


    if (
        !Array.isArray(
            events
        )
    ) {

        throw new Error(
            "Backend returned an invalid Event list."
        );

    }


    return events;

}


/* =========================================================
   9. NORMALIZE EVENT
   ========================================================= */

function normalizeManageEvent(
    raw,
    index = 0
) {

    return {

        ...raw,

        id:
            String(
                raw.id ||
                raw._id ||
                raw.eventId ||
                `event_${index}`
            ),

        title:
            String(
                raw.title ||
                raw.name ||
                "Untitled Event"
            ),

        type:
            normalizeManageEventType(
                raw.type ||
                raw.eventType
            ),

        genre:
            String(
                raw.genre ||
                raw.category ||
                "General"
            ),

        language:
            String(
                raw.language ||
                "Not specified"
            ),

        duration:
            normalizeManageEventDuration(
                raw.duration
            ),

        description:
            String(
                raw.description ||
                "No event description available."
            ),

        performers:
            Array.isArray(
                raw.performers
            )
                ? raw.performers
                : parseManageEventPerformers(
                    raw.performers
                ),

        creator:
            raw.creator ||
            null,

        status:
            normalizeManageEventStatus(
                raw.status
            ),

        showCount:
            Math.max(
                0,
                Number(
                    raw.showCount ??
                    raw.totalShows ??
                    raw.shows?.length ??
                    0
                ) || 0
            ),

        poster:
            raw.poster ||
            raw.posterUrl ||
            raw.image ||
            null,

        banner:
            raw.banner ||
            raw.bannerUrl ||
            null,

        createdAt:
            raw.createdAt ||
            raw.updatedAt ||
            new Date()
                .toISOString(),

        deleted:
            Boolean(
                raw.deleted
            )

    };

}


/* =========================================================
   10. MERGE UNIQUE EVENTS
   ========================================================= */

function mergeUniqueManageEvents(
    events
) {

    const map =
        new Map();


    events.forEach(
        (event) => {

            /*
               Runtime-created event wins over
               fallback event with same ID.
            */

            if (
                !map.has(
                    event.id
                )
            ) {

                map.set(
                    event.id,
                    event
                );

            }

        }
    );


    return [
        ...map.values()
    ];

}


/* =========================================================
   11. NORMALIZE EVENT TYPE
   ========================================================= */

function normalizeManageEventType(
    value
) {

    const type =
        String(
            value ||
            "EVENT"
        )
            .trim()
            .toUpperCase();


    if (
        type.includes(
            "MOVIE"
        )
    ) {

        return "MOVIE";

    }


    if (
        type.includes(
            "CONCERT"
        )
    ) {

        return "CONCERT";

    }


    if (
        type.includes(
            "LIVE"
        ) ||
        type.includes(
            "COMEDY"
        )
    ) {

        return "LIVE_SHOW";

    }


    return "EVENT";

}


/* =========================================================
   12. NORMALIZE STATUS
   ========================================================= */

function normalizeManageEventStatus(
    value
) {

    const status =
        String(
            value ||
            "PUBLISHED"
        )
            .trim()
            .toUpperCase();


    if (
        [
            "PUBLISHED",
            "ACTIVE"
        ].includes(
            status
        )
    ) {

        return "PUBLISHED";

    }


    if (
        [
            "DRAFT",
            "UNPUBLISHED"
        ].includes(
            status
        )
    ) {

        return "DRAFT";

    }


    if (
        [
            "ARCHIVED",
            "INACTIVE"
        ].includes(
            status
        )
    ) {

        return "ARCHIVED";

    }


    return "PUBLISHED";

}


/* =========================================================
   13. DURATION
   ========================================================= */

function normalizeManageEventDuration(
    value
) {

    const duration =
        Number(
            value
        );


    return (
        Number.isFinite(
            duration
        ) &&
        duration >
        0
    )
        ? duration
        : null;

}


/* =========================================================
   14. PERFORMERS
   ========================================================= */

function parseManageEventPerformers(
    value
) {

    if (!value) {

        return [];

    }


    return String(
        value
    )
        .split(",")
        .map(
            (item) =>
                item.trim()
        )
        .filter(Boolean);

}


/* =========================================================
   18. USER
   ========================================================= */

function initializeManageEventsUser() {

    const sharedUser = window.SKYRA_COMMON?.getUser?.();
    const organiser =
        sharedUser && String(sharedUser.role || "").toUpperCase() === "ORGANISER"
            ? sharedUser
            : { name: "Organiser", email: "", role: "ORGANISER" };

    const name = String(organiser.name || organiser.fullName || "Organiser");
    const initials = createManageEventInitials(name);

    setManageEventText("sidebarUserName", name);
    setManageEventText("sidebarUserInitials", initials);
    setManageEventText("topbarUserName", name);
    setManageEventText("topbarUserInitials", initials);
    setManageEventText("dropdownUserName", name);
    setManageEventText("dropdownUserInitials", initials);
    setManageEventText("dropdownUserEmail", organiser.email || "");

}


/* =========================================================
   19. ACTIVE NAVIGATION
   ========================================================= */

function initializeManageEventsNavigation() {

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
                    "./manage-events.html";


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
   20. CONTROLS
   ========================================================= */

function initializeManageEventsControls() {

    /*
       STATUS TABS
    */

    document
        .querySelectorAll(
            "[data-event-filter]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        organiserManageEventsState.filter =
                            button.dataset
                                .eventFilter ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-event-filter]"
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


                        applyManageEventFilters();

                    }
                );

            }
        );


    /*
       LOCAL SEARCH
    */

    document
        .getElementById(
            "manageEventSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                organiserManageEventsState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyManageEventFilters();

            }
        );


    /*
       TYPE
    */

    document
        .getElementById(
            "manageEventTypeFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserManageEventsState.type =
                    event.target.value ||
                    "ALL";


                applyManageEventFilters();

            }
        );


    /*
       SORT
    */

    document
        .getElementById(
            "manageEventSort"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserManageEventsState.sort =
                    event.target.value ||
                    "NEWEST";


                applyManageEventFilters();

            }
        );


    /*
       CLEAR
    */

    document
        .getElementById(
            "clearManageEventFilters"
        )
        ?.addEventListener(
            "click",
            clearManageEventFilters
        );


    document
        .getElementById(
            "emptyClearEventFilters"
        )
        ?.addEventListener(
            "click",
            clearManageEventFilters
        );

}


/* =========================================================
   21. TOPBAR SEARCH
   ========================================================= */

function initializeManageEventsTopbarSearch() {

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
                        "manageEventSearch"
                    );


                if (localSearch) {

                    localSearch.value =
                        query;

                }


                organiserManageEventsState.search =
                    query
                        .toLowerCase();


                applyManageEventFilters();

            }
        );

}


/* =========================================================
   22. URL SEARCH
   ========================================================= */

function applySearchFromURL() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const search =
        params.get(
            "search"
        );


    if (!search) {

        return;

    }


    const input =
        document.getElementById(
            "manageEventSearch"
        );


    if (input) {

        input.value =
            search;

    }


    organiserManageEventsState.search =
        search
            .trim()
            .toLowerCase();


    applyManageEventFilters();

}


/* =========================================================
   23. APPLY FILTERS
   ========================================================= */

function applyManageEventFilters() {

    const {
        filter,
        type,
        search,
        sort
    } =
        organiserManageEventsState;


    let events =
        organiserManageEventsState
            .events
            .filter(
                (event) => {

                    /*
                       STATUS
                    */

                    if (
                        filter !==
                            "ALL" &&
                        event.status !==
                            filter
                    ) {

                        return false;

                    }


                    /*
                       TYPE
                    */

                    if (
                        type !==
                            "ALL" &&
                        event.type !==
                            type
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
                            event.title,
                            event.genre,
                            event.language,
                            event.description,
                            event.performers
                                .join(" "),
                            event.creator,
                            event.type
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        search
                    );

                }
            );


    events =
        sortManageEvents(
            events,
            sort
        );


    organiserManageEventsState.filteredEvents =
        events;


    renderManageEvents();

    renderManageEventResultCount();

    updateManageEventClearButton();

}


/* =========================================================
   24. SORT EVENTS
   ========================================================= */

function sortManageEvents(
    events,
    sort
) {

    const result =
        [
            ...events
        ];


    switch (sort) {

        case "OLDEST":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getManageEventTimestamp(
                        first.createdAt
                    ) -
                    getManageEventTimestamp(
                        second.createdAt
                    )
            );


        case "TITLE_ASC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    first.title.localeCompare(
                        second.title
                    )
            );


        case "TITLE_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.title.localeCompare(
                        first.title
                    )
            );


        case "NEWEST":
        default:

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getManageEventTimestamp(
                        second.createdAt
                    ) -
                    getManageEventTimestamp(
                        first.createdAt
                    )
            );

    }

}


/* =========================================================
   25. TIMESTAMP
   ========================================================= */

function getManageEventTimestamp(
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
   26. RENDER EVENTS
   ========================================================= */

function renderManageEvents() {

    const list =
        document.getElementById(
            "organiserEventsList"
        );


    const empty =
        document.getElementById(
            "organiserEventsEmpty"
        );


    if (
        !list ||
        !empty
    ) {

        return;

    }


    const events =
        organiserManageEventsState
            .filteredEvents;


    if (!events.length) {

        list.hidden =
            true;


        empty.hidden =
            false;


        refreshManageEventsIcons();

        return;

    }


    empty.hidden =
        true;


    list.hidden =
        false;


    list.innerHTML =
        events
            .map(
                createManageEventCardHTML
            )
            .join("");


    initializeRenderedManageEventActions();

    refreshManageEventsIcons();

}


/* =========================================================
   27. EVENT CARD
   ========================================================= */

function createManageEventCardHTML(
    event
) {

    const type =
        getManageEventTypeVisual(
            event.type
        );


    const status =
        getManageEventStatusVisual(
            event.status
        );


    const posterWord =
        getManageEventPosterWord(
            event.title
        );


    const posterEyebrow =
        getManageEventPosterEyebrow(
            event.type
        );


    return `

        <article
            class="organiser-manage-event-card"
            data-event-card="${escapeManageEventAttribute(
                event.id
            )}"
        >


            <div
                class="
                    organiser-manage-event-poster
                    organiser-event-poster-${type.className}
                "
            >

                ${
                    event.poster
                        ? `

                            <img
                                src="${escapeManageEventAttribute(
                                    event.poster
                                )}"
                                alt="${escapeManageEventAttribute(
                                    event.title
                                )}"
                            >

                        `
                        : `

                            <div>

                                <small>
                                    ${escapeManageEventHTML(
                                        posterEyebrow
                                    )}
                                </small>

                                <strong>
                                    ${escapeManageEventHTML(
                                        posterWord
                                    )}
                                </strong>

                            </div>

                        `
                }

            </div>



            <div class="organiser-manage-event-main">


                <div class="organiser-manage-event-heading">


                    <div>

                        <div class="organiser-manage-event-badges">

                            <span
                                class="
                                    organiser-type-badge
                                    ${type.className}
                                "
                            >
                                ${escapeManageEventHTML(
                                    type.label
                                )}
                            </span>


                            <span
                                class="
                                    organiser-event-status
                                    ${status.className}
                                "
                            >
                                ${escapeManageEventHTML(
                                    status.label
                                )}
                            </span>

                        </div>


                        <h2>
                            ${escapeManageEventHTML(
                                event.title
                            )}
                        </h2>


                        <p>

                            ${escapeManageEventHTML(
                                event.genre
                            )}

                            ·

                            ${escapeManageEventHTML(
                                event.language
                            )}

                        </p>

                    </div>



                    <div class="organiser-event-card-actions">

                        <a
                            href="./edit-event.html?id=${
                                encodeURIComponent(
                                    event.id
                                )
                            }"
                            class="btn btn-outline"
                        >

                            <i data-lucide="pencil"></i>

                            Edit Event

                        </a>

                    </div>

                </div>



                <p class="organiser-manage-event-description">

                    ${escapeManageEventHTML(
                        event.description
                    )}

                </p>



                <div class="organiser-manage-event-meta">


                    <div>

                        <i data-lucide="clapperboard"></i>


                        <span>

                            <small>
                                Shows
                            </small>

                            <strong>
                                ${event.showCount}
                            </strong>

                        </span>

                    </div>



                    <div>

                        <i data-lucide="clock-3"></i>


                        <span>

                            <small>
                                Duration
                            </small>

                            <strong>

                                ${
                                    event.duration
                                        ? `${
                                            event.duration
                                        } min`
                                        : "Not set"
                                }

                            </strong>

                        </span>

                    </div>



                    <div>

                        <i data-lucide="calendar-days"></i>


                        <span>

                            <small>
                                Created
                            </small>

                            <strong>
                                ${escapeManageEventHTML(
                                    formatManageEventDate(
                                        event.createdAt
                                    )
                                )}
                            </strong>

                        </span>

                    </div>

                </div>



                <div class="organiser-manage-event-footer">


                    <div
                        class="
                            organiser-event-ready-state
                            ${
                                event.status ===
                                "PUBLISHED"
                                    ? "ready"
                                    : "draft"
                            }
                        "
                    >

                        <i
                            data-lucide="${
                                event.status ===
                                "PUBLISHED"
                                    ? "circle-check-big"
                                    : "file-clock"
                            }"
                        ></i>


                        ${
                            event.status ===
                            "PUBLISHED"
                                ? "Ready for show scheduling"
                                : "Complete this draft before scheduling"
                        }

                    </div>



                    <div class="organiser-event-footer-actions">


                        ${
                            event.status ===
                            "PUBLISHED"
                                ? `

                                    <a
                                        href="./create-show.html?event=${
                                            encodeURIComponent(
                                                event.id
                                            )
                                        }"
                                        class="btn btn-primary"
                                    >

                                        <i data-lucide="calendar-plus"></i>

                                        Create Show

                                    </a>

                                `
                                : ""
                        }


                        <button
                            type="button"
                            class="
                                btn
                                btn-outline
                                organiser-delete-event-button
                            "
                            data-delete-event="${escapeManageEventAttribute(
                                event.id
                            )}"
                        >

                            <i data-lucide="trash-2"></i>

                            Delete

                        </button>

                    </div>

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   28. RENDERED ACTIONS
   ========================================================= */

function initializeRenderedManageEventActions() {

    document
        .querySelectorAll(
            "[data-delete-event]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openDeleteManageEventModal(
                            button.dataset
                                .deleteEvent
                        );

                    }
                );

            }
        );

}


/* =========================================================
   29. EVENT SUMMARY
   ========================================================= */

function renderManageEventSummary() {

    const events =
        organiserManageEventsState
            .events;


    const published =
        events.filter(
            (event) =>
                event.status ===
                "PUBLISHED"
        ).length;


    const drafts =
        events.filter(
            (event) =>
                event.status ===
                "DRAFT"
        ).length;


    const withShows =
        events.filter(
            (event) =>
                event.showCount >
                0
        ).length;


    setManageEventText(
        "manageTotalEvents",
        events.length
    );


    setManageEventText(
        "managePublishedEvents",
        published
    );


    setManageEventText(
        "manageDraftEvents",
        drafts
    );


    setManageEventText(
        "manageEventsWithShows",
        withShows
    );

}


/* =========================================================
   30. SIDEBAR COUNTS
   ========================================================= */

function renderManageEventSidebarCounts() {

    const events =
        organiserManageEventsState
            .events;


    const showCount =
        events.reduce(
            (
                total,
                event
            ) =>
                total +
                event.showCount,
            0
        );


    setManageEventText(
        "sidebarEventCount",
        events.length
    );


    setManageEventText(
        "sidebarShowCount",
        showCount
    );

}


/* =========================================================
   31. RESULT COUNT
   ========================================================= */

function renderManageEventResultCount() {

    setManageEventText(
        "manageEventResultCount",
        organiserManageEventsState
            .filteredEvents
            .length
    );

}


/* =========================================================
   32. CLEAR FILTER BUTTON
   ========================================================= */

function updateManageEventClearButton() {

    const active =
        organiserManageEventsState.filter !==
            "ALL" ||
        organiserManageEventsState.type !==
            "ALL" ||
        Boolean(
            organiserManageEventsState.search
        ) ||
        organiserManageEventsState.sort !==
            "NEWEST";


    const button =
        document.getElementById(
            "clearManageEventFilters"
        );


    if (button) {

        button.hidden =
            !active;

    }

}


/* =========================================================
   33. CLEAR FILTERS
   ========================================================= */

function clearManageEventFilters() {

    organiserManageEventsState.filter =
        "ALL";


    organiserManageEventsState.type =
        "ALL";


    organiserManageEventsState.search =
        "";


    organiserManageEventsState.sort =
        "NEWEST";


    document
        .querySelectorAll(
            "[data-event-filter]"
        )
        .forEach(
            (button) => {

                const active =
                    button.dataset
                        .eventFilter ===
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
            "manageEventSearch"
        );


    if (search) {

        search.value =
            "";

    }


    const type =
        document.getElementById(
            "manageEventTypeFilter"
        );


    if (type) {

        type.value =
            "ALL";

    }


    const sort =
        document.getElementById(
            "manageEventSort"
        );


    if (sort) {

        sort.value =
            "NEWEST";

    }


    applyManageEventFilters();

}


/* =========================================================
   34. SAVED DRAFT NOTICE
   ========================================================= */

function renderSavedEventDraft() {

    let draft =
        null;


    try {

        const stored =
            localStorage.getItem(
                SKYRA_MANAGE_EVENTS_STORAGE
                    .EVENT_DRAFT
            );


        draft =
            stored
                ? JSON.parse(
                    stored
                )
                : null;

    } catch {

        draft =
            null;

    }


    const notice =
        document.getElementById(
            "organiserDraftNotice"
        );


    if (!notice) {

        return;

    }


    if (!draft) {

        notice.hidden =
            true;


        return;

    }


    notice.hidden =
        false;


    setManageEventText(
        "organiserDraftTitle",
        draft.title ||
        "Untitled Event"
    );


    setManageEventText(
        "organiserDraftSavedTime",
        draft.savedAt
            ? `Saved ${
                formatManageEventRelativeTime(
                    draft.savedAt
                )
            }`
            : "Draft saved on this browser"
    );

}


/* =========================================================
   35. DELETE MODAL
   ========================================================= */

function initializeManageEventsDeleteModal() {

    document
        .getElementById(
            "closeDeleteEventModal"
        )
        ?.addEventListener(
            "click",
            closeDeleteManageEventModal
        );


    document
        .getElementById(
            "cancelDeleteEventButton"
        )
        ?.addEventListener(
            "click",
            closeDeleteManageEventModal
        );


    document
        .getElementById(
            "confirmDeleteEventButton"
        )
        ?.addEventListener(
            "click",
            confirmDeleteManageEvent
        );


    document
        .getElementById(
            "deleteEventModal"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.id ===
                    "deleteEventModal"
                ) {

                    closeDeleteManageEventModal();

                }

            }
        );

}


/* =========================================================
   36. OPEN DELETE MODAL
   ========================================================= */

function openDeleteManageEventModal(
    eventId
) {

    const event =
        getManageEventById(
            eventId
        );


    if (!event) {

        return;

    }


    organiserManageEventsState.deletingEventId =
        eventId;


    setManageEventText(
        "deleteEventName",
        event.title
    );


    const modal =
        document.getElementById(
            "deleteEventModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshManageEventsIcons();

}


/* =========================================================
   37. CLOSE DELETE MODAL
   ========================================================= */

function closeDeleteManageEventModal() {

    organiserManageEventsState.deletingEventId =
        null;


    const modal =
        document.getElementById(
            "deleteEventModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   38. CONFIRM DELETE - REAL BACKEND
   ========================================================= */

async function confirmDeleteManageEvent() {

    const eventId =
        organiserManageEventsState
            .deletingEventId;


    if (!eventId) {

        return;

    }


    const event =
        getManageEventById(
            eventId
        );


    if (!event) {

        closeDeleteManageEventModal();

        return;

    }


    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .deleteEvent !==
            "function"
    ) {

        showManageEventToast(
            "Event API is unavailable. Make sure Phase 7 common.js is loaded.",
            "error",
            "API Unavailable"
        );

        return;

    }


    const button =
        document.getElementById(
            "confirmDeleteEventButton"
        );


    if (button) {

        button.disabled =
            true;

    }


    try {

        await window.SKYRA_API
            .deleteEvent(
                eventId
            );


        organiserManageEventsState.events =
            organiserManageEventsState
                .events
                .filter(
                    (item) =>
                        item.id !==
                        eventId
                );


        closeDeleteManageEventModal();

        renderManageEventSummary();

        renderManageEventSidebarCounts();

        applyManageEventFilters();


        showManageEventToast(
            `${event.title} was removed.`,
            "success",
            "Event Deleted"
        );

    } catch (error) {

        console.error(
            "Unable to delete Event:",
            error
        );


        showManageEventToast(
            error?.message ||
            "This event could not be deleted.",
            "error",
            "Delete Failed"
        );

    } finally {

        if (button) {

            button.disabled =
                false;

        }

    }

}


/* =========================================================
   40. GET EVENT
   ========================================================= */

function getManageEventById(
    eventId
) {

    return organiserManageEventsState
        .events
        .find(
            (event) =>
                event.id ===
                eventId
        ) ||
        null;

}


/* =========================================================
   41. TYPE VISUAL
   ========================================================= */

function getManageEventTypeVisual(
    type
) {

    switch (type) {

        case "MOVIE":

            return {

                label:
                    "Movie",

                className:
                    "movie"

            };


        case "LIVE_SHOW":

            return {

                label:
                    "Live Show",

                className:
                    "live-show"

            };


        case "CONCERT":

            return {

                label:
                    "Concert",

                className:
                    "concert"

            };


        default:

            return {

                label:
                    "Event",

                className:
                    "event"

            };

    }

}


/* =========================================================
   42. STATUS VISUAL
   ========================================================= */

function getManageEventStatusVisual(
    status
) {

    switch (status) {

        case "DRAFT":

            return {

                label:
                    "Draft",

                className:
                    "draft"

            };


        case "ARCHIVED":

            return {

                label:
                    "Archived",

                className:
                    "archived"

            };


        default:

            return {

                label:
                    "Published",

                className:
                    "published"

            };

    }

}


/* =========================================================
   43. POSTER WORD
   ========================================================= */

function getManageEventPosterWord(
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
   44. POSTER EYEBROW
   ========================================================= */

function getManageEventPosterEyebrow(
    type
) {

    switch (type) {

        case "MOVIE":

            return "CINEMA EXPERIENCE";


        case "LIVE_SHOW":

            return "LIVE SHOW";


        case "CONCERT":

            return "LIVE IN CONCERT";


        default:

            return "SKYRA EVENT";

    }

}


/* =========================================================
   45. DATE
   ========================================================= */

function formatManageEventDate(
    value
) {

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
   46. RELATIVE TIME
   ========================================================= */

function formatManageEventRelativeTime(
    value
) {

    const timestamp =
        new Date(
            value
        ).getTime();


    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        return "recently";

    }


    const difference =
        Math.max(
            0,
            Date.now() -
            timestamp
        );


    const minutes =
        Math.floor(
            difference /
            60000
        );


    if (
        minutes <
        1
    ) {

        return "just now";

    }


    if (
        minutes <
        60
    ) {

        return `${minutes}m ago`;

    }


    const hours =
        Math.floor(
            minutes /
            60
        );


    if (
        hours <
        24
    ) {

        return `${hours}h ago`;

    }


    const days =
        Math.floor(
            hours /
            24
        );


    return `${days}d ago`;

}


/* =========================================================
   47. INITIALS
   ========================================================= */

function createManageEventInitials(
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
   48. TEXT
   ========================================================= */

function setManageEventText(
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
   49. ESCAPE HTML
   ========================================================= */

function escapeManageEventHTML(
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
   50. ESCAPE ATTRIBUTE
   ========================================================= */

function escapeManageEventAttribute(
    value
) {

    return escapeManageEventHTML(
        value
    );

}


/* =========================================================
   51. DELAY
   ========================================================= */

function manageEventDelay(
    milliseconds
) {

    return new Promise(
        (resolve) => {

            window.setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


/* =========================================================
   52. TOAST
   ========================================================= */

function showManageEventToast(
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
   53. ICONS
   ========================================================= */

function refreshManageEventsIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   54. ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Escape"
        ) {

            closeDeleteManageEventModal();

        }

    }
);


/* =========================================================
   55. PUBLIC API
   ========================================================= */

window.SKYRA_MANAGE_EVENTS_PAGE = {

    getEvents:
        () =>
            organiserManageEventsState
                .events
                .map(
                    (event) => ({
                        ...event
                    })
                ),

    getFilteredEvents:
        () =>
            organiserManageEventsState
                .filteredEvents
                .map(
                    (event) => ({
                        ...event
                    })
                ),

    refresh:
        loadManageEvents,

    deleteEvent:
        openDeleteManageEventModal

};


/* =========================================================
   END SKYRA MANAGE EVENTS
   ========================================================= */