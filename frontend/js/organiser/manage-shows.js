/* =========================================================
   SKYRA - ORGANISER MANAGE SHOWS
   File:
   frontend/js/organiser/manage-shows.js

   Phase 8 backend-connected frontend:
   - Loads organiser Shows from MongoDB
   - Search
   - Status filtering
   - Event filtering
   - Venue filtering
   - Sorting
   - Ticket sales summary
   - Revenue summary
   - Category pricing
   - Real backend Show cancellation
   - No active mock/localStorage Show fallback

   Backend routes:
   - GET   /api/organiser/shows
   - PATCH /api/organiser/shows/:showId/cancel

   Booking/refund/customer notification behavior belongs
   to later booking/cancellation phases.
   ========================================================= */

"use strict";


/* =========================================================
   3. STATE
   ========================================================= */

const organiserManageShowsState = {

    shows:
        [],

    filteredShows:
        [],

    statusFilter:
        "ALL",

    eventFilter:
        "ALL",

    venueFilter:
        "ALL",

    search:
        "",

    sort:
        "DATE_ASC",

    cancellingShowId:
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

        initializeManageShowsPage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

async function initializeManageShowsPage() {

    initializeManageShowsUser();

    initializeManageShowsNavigation();

    initializeManageShowsControls();

    initializeManageShowsTopSearch();

    initializeCancelShowModal();


    await loadManageShows();


    applyManageShowURLParameters();

    refreshManageShowIcons();

}


/* =========================================================
   6. LOAD SHOWS - PHASE 8 BACKEND
   ========================================================= */

async function loadManageShows() {

    organiserManageShowsState.loading =
        true;


    try {

        const shows =
            await fetchManageShowsSource();


        organiserManageShowsState.shows =
            shows
                .map(
                    normalizeManageShow
                )
                .filter(
                    (show) =>
                        Boolean(
                            show.id
                        )
                );


        populateManageShowFilters();

        renderManageShowSummary();

        await renderManageShowSidebarCounts();

        applyManageShowFilters();

    } catch (error) {

        console.error(
            "Unable to load organiser shows:",
            error
        );


        /*
           Do not fall back to local/default Shows.
           MongoDB/API is the Phase 8 source of truth.
        */
        organiserManageShowsState.shows =
            [];


        populateManageShowFilters();

        renderManageShowSummary();

        await renderManageShowSidebarCounts();

        applyManageShowFilters();


        showManageShowToast(
            error?.message ||
            "Unable to load organiser shows.",
            "error",
            "Shows Unavailable"
        );

    } finally {

        organiserManageShowsState.loading =
            false;

    }

}


/* =========================================================
   7. DATA SOURCE - PHASE 8 BACKEND
   ========================================================= */

async function fetchManageShowsSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getOrganiserShows !==
            "function"
    ) {

        throw new Error(
            "Organiser Show API is unavailable."
        );

    }


    const response =
        await window.SKYRA_API
            .getOrganiserShows({
                limit:
                    100,
                sort:
                    "DATE_ASC"
            });


    const shows =
        response?.data?.shows ||
        response?.shows;


    if (
        !Array.isArray(
            shows
        )
    ) {

        throw new Error(
            "Invalid Show API response."
        );

    }


    return shows;

}


/* =========================================================
   9. NORMALIZE SHOW
   ========================================================= */

function normalizeManageShow(
    raw,
    index = 0
) {

    const pricing =
        Array.isArray(
            raw.pricing
        )
            ? raw.pricing
            : (
                Array.isArray(
                    raw.prices
                )
                    ? raw.prices
                    : []
            );


    const normalizedPricing =
        pricing.map(
            (
                item,
                pricingIndex
            ) => ({

                categoryId:
                    String(
                        item.categoryId ||
                        item.id ||
                        `category_${pricingIndex}`
                    ),

                categoryName:
                    String(
                        item.categoryName ||
                        item.name ||
                        "Category"
                    ),

                capacity:
                    Math.max(
                        0,
                        Number(
                            item.capacity ??
                            item.seatCount ??
                            0
                        ) ||
                        0
                    ),

                price:
                    Math.max(
                        0,
                        Number(
                            item.price ??
                            item.amount ??
                            0
                        ) ||
                        0
                    )

            })
        );


    const pricingCapacity =
        normalizedPricing.reduce(
            (
                total,
                item
            ) =>
                total +
                item.capacity,
            0
        );


    const capacity =
        Math.max(
            0,
            Number(
                raw.capacity ??
                raw.totalSeats ??
                pricingCapacity
            ) ||
            pricingCapacity
        );


    const soldSeats =
        Math.max(
            0,
            Number(
                raw.soldSeats ??
                raw.ticketsSold ??
                raw.bookedSeats ??
                0
            ) ||
            0
        );


    const show = {

        id:
            String(
                raw.id ||
                raw._id ||
                `show_${index}`
            ),

        reference:
            String(
                raw.reference ||
                raw.showReference ||
                raw.code ||
                `SKY-SH-${
                    String(
                        index +
                        1
                    ).padStart(
                        4,
                        "0"
                    )
                }`
            ),

        eventId:
            String(
                raw.eventId ||
                raw.event?._id ||
                raw.event?.id ||
                ""
            ),

        eventTitle:
            String(
                raw.eventTitle ||
                raw.event?.title ||
                "SKYRA Event"
            ),

        eventType:
            normalizeManageShowEventType(
                raw.eventType ||
                raw.type ||
                raw.event?.type
            ),

        venueId:
            String(
                raw.venueId ||
                raw.venue?._id ||
                raw.venue?.id ||
                ""
            ),

        venueName:
            String(
                raw.venueName ||
                raw.venue?.name ||
                raw.venue ||
                "Venue"
            ),

        venueCity:
            String(
                raw.venueCity ||
                raw.city ||
                raw.venue?.city ||
                ""
            ),

        date:
            raw.date ||
            raw.showDate ||
            "",

        time:
            raw.time ||
            raw.showTime ||
            "",

        entryTime:
            raw.entryTime ||
            null,

        capacity,

        soldSeats:
            Math.min(
                soldSeats,
                capacity ||
                soldSeats
            ),

        revenue:
            Math.max(
                0,
                Number(
                    raw.revenue ??
                    raw.totalRevenue ??
                    0
                ) ||
                0
            ),

        pricing:
            normalizedPricing,

        status:
            normalizeManageShowStatus(
                raw.status
            ),

        createdAt:
            raw.createdAt ||
            new Date()
                .toISOString(),

        updatedAt:
            raw.updatedAt ||
            null

    };


    if (
        !show.revenue &&
        show.soldSeats >
        0
    ) {

        show.revenue =
            estimateManageShowRevenue(
                show
            );

    }


    return show;

}


/* =========================================================
   10. MERGE UNIQUE SHOWS
   ========================================================= */

function mergeUniqueManageShows(
    shows
) {

    const map =
        new Map();


    shows.forEach(
        (show) => {

            if (
                !map.has(
                    show.id
                )
            ) {

                map.set(
                    show.id,
                    show
                );

            }

        }
    );


    return [
        ...map.values()
    ];

}


/* =========================================================
   14. USER
   ========================================================= */

function initializeManageShowsUser() {

    const sharedUser = window.SKYRA_COMMON?.getUser?.();
    const organiser =
        sharedUser && String(sharedUser.role || "").toUpperCase() === "ORGANISER"
            ? sharedUser
            : { name: "Organiser", email: "", role: "ORGANISER" };

    const name = String(organiser.name || organiser.fullName || "Organiser");
    const initials = createManageShowInitials(name);

    setManageShowText("sidebarUserName", name);
    setManageShowText("sidebarUserInitials", initials);
    setManageShowText("topbarUserName", name);
    setManageShowText("topbarUserInitials", initials);
    setManageShowText("dropdownUserName", name);
    setManageShowText("dropdownUserInitials", initials);
    setManageShowText("dropdownUserEmail", organiser.email || "");

}


/* =========================================================
   15. NAVIGATION
   ========================================================= */

function initializeManageShowsNavigation() {

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
                    "./manage-shows.html";


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
   16. CONTROLS
   ========================================================= */

function initializeManageShowsControls() {

    /*
       STATUS TABS
    */

    document
        .querySelectorAll(
            "[data-show-filter]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        organiserManageShowsState.statusFilter =
                            button.dataset
                                .showFilter ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-show-filter]"
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


                        applyManageShowFilters();

                    }
                );

            }
        );


    /*
       LOCAL SEARCH
    */

    document
        .getElementById(
            "manageShowSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                organiserManageShowsState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyManageShowFilters();

            }
        );


    /*
       EVENT
    */

    document
        .getElementById(
            "manageShowEventFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserManageShowsState.eventFilter =
                    event.target.value ||
                    "ALL";


                applyManageShowFilters();

            }
        );


    /*
       VENUE
    */

    document
        .getElementById(
            "manageShowVenueFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserManageShowsState.venueFilter =
                    event.target.value ||
                    "ALL";


                applyManageShowFilters();

            }
        );


    /*
       SORT
    */

    document
        .getElementById(
            "manageShowSort"
        )
        ?.addEventListener(
            "change",
            (event) => {

                organiserManageShowsState.sort =
                    event.target.value ||
                    "DATE_ASC";


                applyManageShowFilters();

            }
        );


    document
        .getElementById(
            "clearManageShowFilters"
        )
        ?.addEventListener(
            "click",
            clearManageShowFilters
        );


    document
        .getElementById(
            "emptyClearShowFilters"
        )
        ?.addEventListener(
            "click",
            clearManageShowFilters
        );

}


/* =========================================================
   17. TOP SEARCH
   ========================================================= */

function initializeManageShowsTopSearch() {

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
                        "manageShowSearch"
                    );


                if (localSearch) {

                    localSearch.value =
                        query;

                }


                organiserManageShowsState.search =
                    query
                        .toLowerCase();


                applyManageShowFilters();

            }
        );

}


/* =========================================================
   18. POPULATE FILTERS
   ========================================================= */

function populateManageShowFilters() {

    const eventSelect =
        document.getElementById(
            "manageShowEventFilter"
        );


    const venueSelect =
        document.getElementById(
            "manageShowVenueFilter"
        );


    if (eventSelect) {

        eventSelect.innerHTML = `

            <option value="ALL">
                All Events
            </option>

        `;


        const events =
            new Map();


        organiserManageShowsState
            .shows
            .forEach(
                (show) => {

                    if (
                        show.eventId &&
                        !events.has(
                            show.eventId
                        )
                    ) {

                        events.set(
                            show.eventId,
                            show.eventTitle
                        );

                    }

                }
            );


        [
            ...events.entries()
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
                    title
                ]) => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        id;


                    option.textContent =
                        title;


                    eventSelect.appendChild(
                        option
                    );

                }
            );

    }


    if (venueSelect) {

        venueSelect.innerHTML = `

            <option value="ALL">
                All Venues
            </option>

        `;


        const venues =
            new Map();


        organiserManageShowsState
            .shows
            .forEach(
                (show) => {

                    const id =
                        show.venueId ||
                        show.venueName;


                    if (
                        id &&
                        !venues.has(
                            id
                        )
                    ) {

                        venues.set(
                            id,
                            `${
                                show.venueName
                            }${
                                show.venueCity
                                    ? `, ${
                                        show.venueCity
                                    }`
                                    : ""
                            }`
                        );

                    }

                }
            );


        [
            ...venues.entries()
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
                    title
                ]) => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        id;


                    option.textContent =
                        title;


                    venueSelect.appendChild(
                        option
                    );

                }
            );

    }

}


/* =========================================================
   19. URL PARAMETERS
   ========================================================= */

function applyManageShowURLParameters() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const search =
        params.get(
            "search"
        );


    const eventId =
        params.get(
            "event"
        );


    if (search) {

        organiserManageShowsState.search =
            search
                .trim()
                .toLowerCase();


        const input =
            document.getElementById(
                "manageShowSearch"
            );


        if (input) {

            input.value =
                search;

        }

    }


    if (
        eventId &&
        organiserManageShowsState
            .shows
            .some(
                (show) =>
                    show.eventId ===
                    eventId
            )
    ) {

        organiserManageShowsState.eventFilter =
            eventId;


        const select =
            document.getElementById(
                "manageShowEventFilter"
            );


        if (select) {

            select.value =
                eventId;

        }

    }


    applyManageShowFilters();

}


/* =========================================================
   20. FILTER SHOWS
   ========================================================= */

function applyManageShowFilters() {

    const {
        statusFilter,
        eventFilter,
        venueFilter,
        search,
        sort
    } =
        organiserManageShowsState;


    let shows =
        organiserManageShowsState
            .shows
            .filter(
                (show) => {

                    const displayStatus =
                        getManageShowDisplayStatus(
                            show
                        );


                    /*
                       STATUS
                    */

                    if (
                        statusFilter ===
                            "UPCOMING" &&
                        ![
                            "UPCOMING",
                            "SOLD_OUT"
                        ].includes(
                            displayStatus
                        )
                    ) {

                        return false;

                    }


                    if (
                        statusFilter ===
                            "COMPLETED" &&
                        displayStatus !==
                            "COMPLETED"
                    ) {

                        return false;

                    }


                    if (
                        statusFilter ===
                            "CANCELLED" &&
                        displayStatus !==
                            "CANCELLED"
                    ) {

                        return false;

                    }


                    /*
                       EVENT
                    */

                    if (
                        eventFilter !==
                            "ALL" &&
                        show.eventId !==
                            eventFilter
                    ) {

                        return false;

                    }


                    /*
                       VENUE
                    */

                    const showVenueKey =
                        show.venueId ||
                        show.venueName;


                    if (
                        venueFilter !==
                            "ALL" &&
                        showVenueKey !==
                            venueFilter
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
                            show.reference,
                            show.eventTitle,
                            show.venueName,
                            show.venueCity,
                            show.eventType
                        ]
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        search
                    );

                }
            );


    shows =
        sortManageShows(
            shows,
            sort
        );


    organiserManageShowsState.filteredShows =
        shows;


    renderManageShows();

    renderManageShowResultCount();

    updateManageShowClearFilters();

}


/* =========================================================
   21. SORT SHOWS
   ========================================================= */

function sortManageShows(
    shows,
    sort
) {

    const result = [
        ...shows
    ];


    switch (sort) {

        case "DATE_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getManageShowTimestamp(
                        second
                    ) -
                    getManageShowTimestamp(
                        first
                    )
            );


        case "SALES_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.soldSeats -
                    first.soldSeats
            );


        case "REVENUE_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.revenue -
                    first.revenue
            );


        case "DATE_ASC":
        default:

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getManageShowTimestamp(
                        first
                    ) -
                    getManageShowTimestamp(
                        second
                    )
            );

    }

}


/* =========================================================
   22. RENDER SHOWS
   ========================================================= */

function renderManageShows() {

    const list =
        document.getElementById(
            "organiserShowsList"
        );


    const empty =
        document.getElementById(
            "organiserShowsEmpty"
        );


    if (
        !list ||
        !empty
    ) {

        return;

    }


    const shows =
        organiserManageShowsState
            .filteredShows;


    if (!shows.length) {

        list.hidden =
            true;


        empty.hidden =
            false;


        refreshManageShowIcons();

        return;

    }


    list.hidden =
        false;


    empty.hidden =
        true;


    list.innerHTML =
        shows
            .map(
                createManageShowCardHTML
            )
            .join("");


    initializeRenderedShowActions();

    refreshManageShowIcons();

}


/* =========================================================
   23. SHOW CARD
   ========================================================= */

function createManageShowCardHTML(
    show
) {

    const date =
        parseManageShowDate(
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
                .format(
                    date
                )
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


    const year =
        date
            ? date.getFullYear()
            : "----";


    const type =
        getManageShowTypeVisual(
            show.eventType
        );


    const status =
        getManageShowStatusVisual(
            show
        );


    const soldPercent =
        calculateManageShowSalesPercent(
            show.soldSeats,
            show.capacity
        );


    const canCancel =
        canCancelManageShow(
            show
        );


    const location =
        [
            show.venueName,
            show.venueCity
        ]
            .filter(Boolean)
            .join(", ");


    return `

        <article
            class="organiser-manage-show-card"
            data-show-id="${escapeManageShowAttribute(
                show.id
            )}"
        >


            <div class="organiser-manage-show-date">

                <span>
                    ${escapeManageShowHTML(
                        month
                    )}
                </span>

                <strong>
                    ${escapeManageShowHTML(
                        day
                    )}
                </strong>

                <small>
                    ${escapeManageShowHTML(
                        year
                    )}
                </small>

            </div>



            <div class="organiser-manage-show-main">


                <div class="organiser-manage-show-heading">


                    <div>

                        <div class="organiser-manage-show-badges">


                            <span
                                class="
                                    organiser-type-badge
                                    ${type.className}
                                "
                            >
                                ${escapeManageShowHTML(
                                    type.label
                                )}
                            </span>


                            <span
                                class="
                                    organiser-show-status
                                    ${status.className}
                                "
                            >
                                ${escapeManageShowHTML(
                                    status.label
                                )}
                            </span>

                        </div>


                        <h2>
                            ${escapeManageShowHTML(
                                show.eventTitle
                            )}
                        </h2>


                        <p>

                            <i data-lucide="map-pin"></i>

                            ${escapeManageShowHTML(
                                location ||
                                "Venue"
                            )}

                        </p>

                    </div>



                    <div class="organiser-show-reference">

                        <small>
                            Show Reference
                        </small>

                        <strong>
                            ${escapeManageShowHTML(
                                show.reference
                            )}
                        </strong>

                    </div>

                </div>



                <div class="organiser-manage-show-details">


                    <div>

                        <i data-lucide="clock-3"></i>


                        <span>

                            <small>
                                Start Time
                            </small>

                            <strong>
                                ${escapeManageShowHTML(
                                    formatManageShowTime(
                                        show.time
                                    )
                                )}
                            </strong>

                        </span>

                    </div>



                    <div>

                        <i data-lucide="armchair"></i>


                        <span>

                            <small>
                                Capacity
                            </small>

                            <strong>

                                ${formatManageShowNumber(
                                    show.capacity
                                )}

                                seats

                            </strong>

                        </span>

                    </div>



                    <div>

                        <i data-lucide="tickets"></i>


                        <span>

                            <small>
                                Tickets Sold
                            </small>

                            <strong>
                                ${formatManageShowNumber(
                                    show.soldSeats
                                )}
                            </strong>

                        </span>

                    </div>



                    <div>

                        <i data-lucide="indian-rupee"></i>


                        <span>

                            <small>
                                Revenue
                            </small>

                            <strong>
                                ${formatManageShowCompactCurrency(
                                    show.revenue
                                )}
                            </strong>

                        </span>

                    </div>

                </div>



                <div class="organiser-manage-show-sales">


                    <div>

                        <span>
                            Seat Sales
                        </span>

                        <strong>

                            ${soldPercent}%

                            booked

                        </strong>

                    </div>


                    <div class="organiser-manage-show-progress">

                        <span
                            style="width:${soldPercent}%"
                        ></span>

                    </div>

                </div>



                <div class="organiser-manage-show-footer">


                    <div class="organiser-manage-show-prices">

                        ${
                            createManageShowPricingHTML(
                                show.pricing
                            )
                        }

                    </div>



                    <div class="organiser-manage-show-actions">


                        <a
                            href="./bookings.html?show=${
                                encodeURIComponent(
                                    show.id
                                )
                            }"
                            class="btn btn-outline"
                        >

                            <i data-lucide="tickets"></i>

                            View Bookings

                        </a>


                        ${
                            canCancel
                                ? `

                                    <button
                                        type="button"
                                        class="
                                            btn
                                            btn-outline
                                            organiser-cancel-show-button
                                        "
                                        data-cancel-show="${
                                            escapeManageShowAttribute(
                                                show.id
                                            )
                                        }"
                                    >

                                        <i data-lucide="ban"></i>

                                        Cancel Show

                                    </button>

                                `
                                : ""
                        }


                        ${
                            status.key ===
                            "UPCOMING"
                                ? `

                                    <a
                                        href="./create-show.html?event=${
                                            encodeURIComponent(
                                                show.eventId
                                            )
                                        }"
                                        class="
                                            organiser-show-copy-link
                                        "
                                        title="Create another show for this event"
                                    >

                                        <i data-lucide="copy-plus"></i>

                                    </a>

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
   24. PRICING HTML
   ========================================================= */

function createManageShowPricingHTML(
    pricing
) {

    if (
        !Array.isArray(
            pricing
        ) ||
        !pricing.length
    ) {

        return `

            <span>
                Pricing unavailable
            </span>

        `;

    }


    return pricing
        .slice(
            0,
            4
        )
        .map(
            (item) => `

                <span>

                    ${escapeManageShowHTML(
                        item.categoryName
                    )}

                    ${formatManageShowCurrency(
                        item.price
                    )}

                </span>

            `
        )
        .join("");

}


/* =========================================================
   25. RENDERED ACTIONS
   ========================================================= */

function initializeRenderedShowActions() {

    document
        .querySelectorAll(
            "[data-cancel-show]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openCancelManageShowModal(
                            button.dataset
                                .cancelShow
                        );

                    }
                );

            }
        );

}


/* =========================================================
   26. SUMMARY
   ========================================================= */

function renderManageShowSummary() {

    const shows =
        organiserManageShowsState
            .shows;


    const upcoming =
        shows.filter(
            (show) => {

                const status =
                    getManageShowDisplayStatus(
                        show
                    );


                return [
                    "UPCOMING",
                    "SOLD_OUT"
                ].includes(
                    status
                );

            }
        ).length;


    const ticketsSold =
        shows.reduce(
            (
                total,
                show
            ) =>
                total +
                show.soldSeats,
            0
        );


    const revenue =
        shows.reduce(
            (
                total,
                show
            ) =>
                total +
                show.revenue,
            0
        );


    setManageShowText(
        "manageTotalShows",
        formatManageShowNumber(
            shows.length
        )
    );


    setManageShowText(
        "manageUpcomingShows",
        formatManageShowNumber(
            upcoming
        )
    );


    setManageShowText(
        "manageTicketsSold",
        formatManageShowNumber(
            ticketsSold
        )
    );


    setManageShowText(
        "manageShowRevenue",
        formatManageShowCompactCurrency(
            revenue
        )
    );

}


/* =========================================================
   27. SIDEBAR COUNTS - PHASE 8 BACKEND
   ========================================================= */

async function renderManageShowSidebarCounts() {

    const shows =
        organiserManageShowsState
            .shows;


    let eventCount =
        new Set(
            shows
                .map(
                    (show) =>
                        show.eventId
                )
                .filter(Boolean)
        ).size;


    if (
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .getOrganiserEvents ===
            "function"
    ) {

        try {

            const response =
                await window.SKYRA_API
                    .getOrganiserEvents({
                        limit:
                            100
                    });


            const events =
                response?.data?.events ||
                response?.events;


            if (
                Array.isArray(
                    events
                )
            ) {

                eventCount =
                    events.length;

            }

        } catch (error) {

            console.warn(
                "Unable to refresh organiser Event count.",
                error
            );

        }

    }


    setManageShowText(
        "sidebarEventCount",
        eventCount
    );


    setManageShowText(
        "sidebarShowCount",
        shows.length
    );

}


/* =========================================================
   28. RESULT COUNT
   ========================================================= */

function renderManageShowResultCount() {

    setManageShowText(
        "manageShowResultCount",
        organiserManageShowsState
            .filteredShows
            .length
    );

}


/* =========================================================
   29. CLEAR BUTTON
   ========================================================= */

function updateManageShowClearFilters() {

    const active =
        organiserManageShowsState.statusFilter !==
            "ALL" ||
        organiserManageShowsState.eventFilter !==
            "ALL" ||
        organiserManageShowsState.venueFilter !==
            "ALL" ||
        Boolean(
            organiserManageShowsState.search
        ) ||
        organiserManageShowsState.sort !==
            "DATE_ASC";


    const button =
        document.getElementById(
            "clearManageShowFilters"
        );


    if (button) {

        button.hidden =
            !active;

    }

}


/* =========================================================
   30. CLEAR FILTERS
   ========================================================= */

function clearManageShowFilters() {

    organiserManageShowsState.statusFilter =
        "ALL";


    organiserManageShowsState.eventFilter =
        "ALL";


    organiserManageShowsState.venueFilter =
        "ALL";


    organiserManageShowsState.search =
        "";


    organiserManageShowsState.sort =
        "DATE_ASC";


    document
        .querySelectorAll(
            "[data-show-filter]"
        )
        .forEach(
            (button) => {

                const active =
                    button.dataset
                        .showFilter ===
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
            "manageShowSearch"
        );


    if (search) {

        search.value =
            "";

    }


    const event =
        document.getElementById(
            "manageShowEventFilter"
        );


    if (event) {

        event.value =
            "ALL";

    }


    const venue =
        document.getElementById(
            "manageShowVenueFilter"
        );


    if (venue) {

        venue.value =
            "ALL";

    }


    const sort =
        document.getElementById(
            "manageShowSort"
        );


    if (sort) {

        sort.value =
            "DATE_ASC";

    }


    applyManageShowFilters();

}


/* =========================================================
   31. CANCEL MODAL
   ========================================================= */

function initializeCancelShowModal() {

    document
        .getElementById(
            "closeCancelShowModal"
        )
        ?.addEventListener(
            "click",
            closeCancelManageShowModal
        );


    document
        .getElementById(
            "keepShowButton"
        )
        ?.addEventListener(
            "click",
            closeCancelManageShowModal
        );


    document
        .getElementById(
            "confirmCancelShowButton"
        )
        ?.addEventListener(
            "click",
            confirmCancelManageShow
        );


    document
        .getElementById(
            "cancelShowModal"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.id ===
                    "cancelShowModal"
                ) {

                    closeCancelManageShowModal();

                }

            }
        );

}


/* =========================================================
   32. OPEN CANCEL
   ========================================================= */

function openCancelManageShowModal(
    showId
) {

    const show =
        getManageShowById(
            showId
        );


    if (
        !show ||
        !canCancelManageShow(
            show
        )
    ) {

        return;

    }


    organiserManageShowsState.cancellingShowId =
        showId;


    setManageShowText(
        "cancelShowEventName",
        show.eventTitle
    );


    setManageShowText(
        "cancelShowVenue",
        `${
            show.venueName
        }${
            show.venueCity
                ? `, ${
                    show.venueCity
                }`
                : ""
        }`
    );


    setManageShowText(
        "cancelShowSchedule",
        `${
            formatManageShowDate(
                show.date
            )
        } · ${
            formatManageShowTime(
                show.time
            )
        }`
    );


    setManageShowText(
        "cancelShowTickets",
        formatManageShowNumber(
            show.soldSeats
        )
    );


    const modal =
        document.getElementById(
            "cancelShowModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshManageShowIcons();

}


/* =========================================================
   33. CLOSE CANCEL
   ========================================================= */

function closeCancelManageShowModal() {

    organiserManageShowsState.cancellingShowId =
        null;


    const modal =
        document.getElementById(
            "cancelShowModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   34. CONFIRM CANCEL - PHASE 8 BACKEND
   ========================================================= */

async function confirmCancelManageShow() {

    const showId =
        organiserManageShowsState
            .cancellingShowId;


    if (!showId) {

        return;

    }


    const show =
        getManageShowById(
            showId
        );


    if (!show) {

        closeCancelManageShowModal();

        return;

    }


    const button =
        document.getElementById(
            "confirmCancelShowButton"
        );


    if (button) {

        button.disabled =
            true;

    }


    try {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .cancelShow !==
                "function"
        ) {

            throw new Error(
                "Organiser Show cancellation API is unavailable."
            );

        }


        const response =
            await window.SKYRA_API
                .cancelShow(
                    showId,
                    {}
                );


        const cancelledShow =
            response?.data?.show ||
            response?.show;


        if (
            !cancelledShow ||
            !(
                cancelledShow.id ||
                cancelledShow._id
            )
        ) {

            throw new Error(
                "Show cancellation API returned an invalid Show."
            );

        }


        const normalized =
            normalizeManageShow(
                cancelledShow
            );


        const index =
            organiserManageShowsState
                .shows
                .findIndex(
                    (item) =>
                        item.id ===
                        showId
                );


        if (
            index >=
            0
        ) {

            organiserManageShowsState
                .shows[
                    index
                ] =
                normalized;

        }


        closeCancelManageShowModal();

        renderManageShowSummary();

        await renderManageShowSidebarCounts();

        applyManageShowFilters();


        showManageShowToast(
            `${normalized.eventTitle} has been cancelled.`,
            "success",
            "Show Cancelled"
        );

    } catch (error) {

        console.error(
            "Unable to cancel show:",
            error
        );


        showManageShowToast(
            error?.message ||
            "Unable to cancel this show.",
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
   36. CAN CANCEL
   ========================================================= */

function canCancelManageShow(
    show
) {

    const status =
        getManageShowDisplayStatus(
            show
        );


    return [
        "UPCOMING",
        "SOLD_OUT"
    ].includes(
        status
    );

}


/* =========================================================
   37. DISPLAY STATUS
   ========================================================= */

function getManageShowDisplayStatus(
    show
) {

    if (
        show.status ===
        "CANCELLED"
    ) {

        return "CANCELLED";

    }


    if (
        show.status ===
        "COMPLETED"
    ) {

        return "COMPLETED";

    }


    const timestamp =
        getManageShowTimestamp(
            show
        );


    if (
        timestamp &&
        timestamp <
        Date.now()
    ) {

        return "COMPLETED";

    }


    if (
        show.capacity >
            0 &&
        show.soldSeats >=
            show.capacity
    ) {

        return "SOLD_OUT";

    }


    return "UPCOMING";

}


/* =========================================================
   38. STATUS VISUAL
   ========================================================= */

function getManageShowStatusVisual(
    show
) {

    const status =
        getManageShowDisplayStatus(
            show
        );


    switch (status) {

        case "COMPLETED":

            return {

                key:
                    status,

                label:
                    "Completed",

                className:
                    "completed"

            };


        case "CANCELLED":

            return {

                key:
                    status,

                label:
                    "Cancelled",

                className:
                    "cancelled"

            };


        case "SOLD_OUT":

            return {

                key:
                    status,

                label:
                    "Sold Out",

                className:
                    "sold-out"

            };


        default:

            return {

                key:
                    "UPCOMING",

                label:
                    "Upcoming",

                className:
                    "active"

            };

    }

}


/* =========================================================
   39. NORMALIZE STATUS
   ========================================================= */

function normalizeManageShowStatus(
    value
) {

    const status =
        String(
            value ||
            "SCHEDULED"
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


    if (
        [
            "COMPLETED",
            "FINISHED"
        ].includes(
            status
        )
    ) {

        return "COMPLETED";

    }


    return "SCHEDULED";

}


/* =========================================================
   40. TYPE
   ========================================================= */

function normalizeManageShowEventType(
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
   41. TYPE VISUAL
   ========================================================= */

function getManageShowTypeVisual(
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
   42. TIMESTAMP
   ========================================================= */

function getManageShowTimestamp(
    show
) {

    if (!show?.date) {

        return 0;

    }


    const value =
        `${show.date}T${
            show.time ||
            "00:00"
        }:00`;


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
   43. SALES PERCENT
   ========================================================= */

function calculateManageShowSalesPercent(
    sold,
    capacity
) {

    const soldValue =
        Number(
            sold
        );


    const capacityValue =
        Number(
            capacity
        );


    if (
        !Number.isFinite(
            soldValue
        ) ||
        !Number.isFinite(
            capacityValue
        ) ||
        capacityValue <=
            0
    ) {

        return 0;

    }


    return Math.max(
        0,
        Math.min(
            100,
            Math.round(
                (
                    soldValue /
                    capacityValue
                ) *
                100
            )
        )
    );

}


/* =========================================================
   44. ESTIMATE REVENUE
   ========================================================= */

function estimateManageShowRevenue(
    show
) {

    const prices =
        show.pricing
            .map(
                (item) =>
                    Number(
                        item.price
                    )
            )
            .filter(
                (price) =>
                    Number.isFinite(
                        price
                    ) &&
                    price >
                        0
            );


    if (!prices.length) {

        return 0;

    }


    const average =
        prices.reduce(
            (
                total,
                price
            ) =>
                total +
                price,
            0
        ) /
        prices.length;


    return Math.round(
        average *
        show.soldSeats
    );

}


/* =========================================================
   45. GET SHOW
   ========================================================= */

function getManageShowById(
    showId
) {

    return organiserManageShowsState
        .shows
        .find(
            (show) =>
                show.id ===
                showId
        ) ||
        null;

}


/* =========================================================
   46. DATE PARSER
   ========================================================= */

function parseManageShowDate(
    value
) {

    if (!value) {

        return null;

    }


    const match =
        String(
            value
        )
            .match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );


    if (match) {

        return new Date(
            Number(
                match[1]
            ),
            Number(
                match[2]
            ) -
            1,
            Number(
                match[3]
            )
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
   47. DATE FORMAT
   ========================================================= */

function formatManageShowDate(
    value
) {

    const date =
        parseManageShowDate(
            value
        );


    if (!date) {

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
   48. TIME
   ========================================================= */

function formatManageShowTime(
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


    const displayHour =
        hours %
        12 ||
        12;


    return `${
        displayHour
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
   49. CURRENCY
   ========================================================= */

function formatManageShowCurrency(
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
   50. COMPACT CURRENCY
   ========================================================= */

function formatManageShowCompactCurrency(
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


    return formatManageShowCurrency(
        amount
    );

}


/* =========================================================
   51. NUMBER
   ========================================================= */

function formatManageShowNumber(
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
   52. INITIALS
   ========================================================= */

function createManageShowInitials(
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
   53. SET TEXT
   ========================================================= */

function setManageShowText(
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
   54. ESCAPE HTML
   ========================================================= */

function escapeManageShowHTML(
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
   55. ESCAPE ATTRIBUTE
   ========================================================= */

function escapeManageShowAttribute(
    value
) {

    return escapeManageShowHTML(
        value
    );

}


/* =========================================================
   56. DELAY
   ========================================================= */

function manageShowDelay(
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
   57. TOAST
   ========================================================= */

function showManageShowToast(
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
   58. ICONS
   ========================================================= */

function refreshManageShowIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   59. ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Escape"
        ) {

            closeCancelManageShowModal();

        }

    }
);


/* =========================================================
   60. PUBLIC API
   ========================================================= */

window.SKYRA_MANAGE_SHOWS_PAGE = {

    getShows:
        () =>
            organiserManageShowsState
                .shows
                .map(
                    (show) => ({
                        ...show,

                        pricing:
                            show.pricing.map(
                                (item) => ({
                                    ...item
                                })
                            )

                    })
                ),

    getFilteredShows:
        () =>
            organiserManageShowsState
                .filteredShows
                .map(
                    (show) => ({
                        ...show
                    })
                ),

    refresh:
        loadManageShows,

    cancelShow:
        openCancelManageShowModal

};


/* =========================================================
   END SKYRA MANAGE SHOWS
   ========================================================= */