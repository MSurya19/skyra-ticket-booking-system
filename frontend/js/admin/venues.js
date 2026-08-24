/* =========================================================
   SKYRA - ADMIN VENUES
   File:
   frontend/js/admin/venues.js

   Current frontend phase:
   - MongoDB venue records
   - Runtime-created venue support
   - Venue overrides
   - Search
   - Status filter
   - City filter
   - Seat-layout filter
   - Sorting
   - Summary counts
   - Edit / Seat Layout / Categories routing

   Future backend:
   GET /api/admin/venues

   MongoDB/API data is authoritative.
   ========================================================= */

"use strict";


/* =========================================================
   1-2. BACKEND-ONLY VENUE DATA
   ========================================================= */

/* =========================================================
   3. STATE
   ========================================================= */

const adminVenuesState = {

    venues:
        [],

    filteredVenues:
        [],

    statusFilter:
        "ALL",

    cityFilter:
        "ALL",

    layoutFilter:
        "ALL",

    search:
        "",

    sort:
        "NAME_ASC",

    loading:
        false

};


/* =========================================================
   4. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeAdminVenuesPage();

    }
);


/* =========================================================
   5. INITIALIZATION
   ========================================================= */

async function initializeAdminVenuesPage() {

    initializeAdminVenueUser();

    initializeAdminVenueNavigation();

    initializeAdminVenueControls();

    initializeAdminVenueTopSearch();


    await loadAdminVenues();


    applyAdminVenueURLParameters();

    refreshAdminVenueIcons();

}


/* =========================================================
   6. LOAD VENUES
   ========================================================= */

async function loadAdminVenues() {

    adminVenuesState.loading =
        true;


    try {

        let venues =
            await fetchAdminVenuesSource();


        venues =
            venues
                .map(
                    normalizeAdminVenueRecord
                )
                .filter(
                    (venue) =>
                        Boolean(
                            venue.id
                        )
                );


        adminVenuesState.venues =
            mergeUniqueAdminVenues(
                venues
            );


        populateAdminVenueCityFilter();

        renderAdminVenueSummary();

        renderAdminVenueSidebarCounts();

        applyAdminVenueFilters();

    } catch (error) {

        console.error(
            "Unable to load admin venues:",
            error
        );


        adminVenuesState.venues =
            [];


        populateAdminVenueCityFilter();

        renderAdminVenueSummary();

        renderAdminVenueSidebarCounts();

        applyAdminVenueFilters();


        showAdminVenueToast(
            "Unable to load venue records.",
            "error",
            "Venues Unavailable"
        );

    } finally {

        adminVenuesState.loading =
            false;

    }

}


/* =========================================================
   7. DATA SOURCE - MONGODB ONLY
   ========================================================= */
async function fetchAdminVenuesSource() {
    if (!window.SKYRA_API || typeof window.SKYRA_API.getAdminVenues !== "function") {
        throw new Error("Admin venues API client is unavailable.");
    }
    const response = await window.SKYRA_API.getAdminVenues();
    const venues = response?.venues || response?.data?.venues || response?.data || response;
    if (!Array.isArray(venues)) throw new Error("Admin venues API returned an invalid response.");
    return venues;
}

/* =========================================================
   11. NORMALIZE VENUE
   ========================================================= */

function normalizeAdminVenueRecord(
    raw,
    index = 0
) {

    const rawCategories =
        Array.isArray(
            raw.categories
        )
            ? raw.categories
            : (
                Array.isArray(
                    raw.seatCategories
                )
                    ? raw.seatCategories
                    : []
            );


    const categories =
        rawCategories.map(
            (
                category,
                categoryIndex
            ) => {

                if (
                    typeof category ===
                    "string"
                ) {

                    return {

                        id:
                            `category_${categoryIndex}`,

                        name:
                            category,

                        capacity:
                            0

                    };

                }


                return {

                    id:
                        String(
                            category.id ||
                            category._id ||
                            category.categoryId ||
                            `category_${categoryIndex}`
                        ),

                    name:
                        String(
                            category.name ||
                            category.categoryName ||
                            `Category ${
                                categoryIndex +
                                1
                            }`
                        ),

                    capacity:
                        Math.max(
                            0,
                            Number(
                                category.capacity ??
                                category.seatCount ??
                                0
                            ) ||
                            0
                        )

                };

            }
        );


    const categoryCapacity =
        categories.reduce(
            (
                total,
                category
            ) =>
                total +
                category.capacity,
            0
        );


    const capacity =
        Math.max(
            0,
            Number(
                raw.capacity ??
                raw.totalSeats ??
                raw.seatCount ??
                categoryCapacity
            ) ||
            categoryCapacity
        );


    return {

        id:
            String(
                raw.id ||
                raw._id ||
                `venue_${index}`
            ),

        name:
            String(
                raw.name ||
                raw.venueName ||
                "Unnamed Venue"
            ),

        type:
            normalizeAdminVenueType(
                raw.type ||
                raw.venueType
            ),

        address:
            String(
                raw.address ||
                raw.location?.address ||
                raw.addressLine1 ||
                ""
            ),

        city:
            String(
                raw.city ||
                raw.location?.city ||
                ""
            ),

        state:
            String(
                raw.state ||
                raw.location?.state ||
                ""
            ),

        country:
            String(
                raw.country ||
                raw.location?.country ||
                "India"
            ),

        postalCode:
            String(
                raw.postalCode ||
                raw.pincode ||
                raw.zipCode ||
                ""
            ),

        capacity,

        categories,

        layoutConfigured:
            Boolean(
                raw.layoutConfigured ??
                raw.hasSeatLayout ??
                raw.seatLayoutConfigured ??
                (
                    capacity >
                    0
                )
            ),

        status:
            normalizeAdminVenueStatus(
                raw.status
            ),

        description:
            String(
                raw.description ||
                ""
            ),

        createdAt:
            raw.createdAt ||
            new Date()
                .toISOString(),

        updatedAt:
            raw.updatedAt ||
            null,

        deleted:
            Boolean(
                raw.deleted
            )

    };

}


/* =========================================================
   12. UNIQUE VENUES
   ========================================================= */

function mergeUniqueAdminVenues(
    venues
) {

    const map =
        new Map();


    venues.forEach(
        (venue) => {

            if (
                venue.deleted
            ) {

                return;

            }


            if (
                !map.has(
                    venue.id
                )
            ) {

                map.set(
                    venue.id,
                    venue
                );

            }

        }
    );


    return [
        ...map.values()
    ];

}


/* =========================================================
   13. ADMIN USER
   ========================================================= */

function initializeAdminVenueUser() {

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


    const email =
        String(
            admin.email ||
            ""
        );


    const initials =
        createAdminVenueInitials(
            name
        );


    setAdminVenueText(
        "sidebarUserName",
        name
    );


    setAdminVenueText(
        "sidebarUserInitials",
        initials
    );


    setAdminVenueText(
        "topbarUserName",
        name
    );


    setAdminVenueText(
        "topbarUserInitials",
        initials
    );


    setAdminVenueText(
        "dropdownUserName",
        name
    );


    setAdminVenueText(
        "dropdownUserInitials",
        initials
    );


    setAdminVenueText(
        "dropdownUserEmail",
        email
    );

}


/* =========================================================
   14. ACTIVE NAVIGATION
   ========================================================= */

function initializeAdminVenueNavigation() {

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
                    "./venues.html";


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
   15. CONTROLS
   ========================================================= */

function initializeAdminVenueControls() {

    /*
       STATUS TABS
    */

    document
        .querySelectorAll(
            "[data-venue-status]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        adminVenuesState.statusFilter =
                            button.dataset
                                .venueStatus ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-venue-status]"
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


                        applyAdminVenueFilters();

                    }
                );

            }
        );


    /*
       SEARCH
    */

    document
        .getElementById(
            "venueSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                adminVenuesState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyAdminVenueFilters();

            }
        );


    /*
       CITY
    */

    document
        .getElementById(
            "venueCityFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminVenuesState.cityFilter =
                    event.target.value ||
                    "ALL";


                applyAdminVenueFilters();

            }
        );


    /*
       LAYOUT
    */

    document
        .getElementById(
            "venueLayoutFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminVenuesState.layoutFilter =
                    event.target.value ||
                    "ALL";


                applyAdminVenueFilters();

            }
        );


    /*
       SORT
    */

    document
        .getElementById(
            "venueSort"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminVenuesState.sort =
                    event.target.value ||
                    "NAME_ASC";


                applyAdminVenueFilters();

            }
        );


    document
        .getElementById(
            "clearVenueFilters"
        )
        ?.addEventListener(
            "click",
            clearAdminVenueFilters
        );


    document
        .getElementById(
            "emptyClearVenueFilters"
        )
        ?.addEventListener(
            "click",
            clearAdminVenueFilters
        );

}


/* =========================================================
   16. TOPBAR SEARCH
   ========================================================= */

function initializeAdminVenueTopSearch() {

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
                        "venueSearch"
                    );


                if (localSearch) {

                    localSearch.value =
                        query;

                }


                adminVenuesState.search =
                    query
                        .toLowerCase();


                applyAdminVenueFilters();

            }
        );

}


/* =========================================================
   17. CITY FILTER
   ========================================================= */

function populateAdminVenueCityFilter() {

    const select =
        document.getElementById(
            "venueCityFilter"
        );


    if (!select) {

        return;

    }


    select.innerHTML = `

        <option value="ALL">
            All Cities
        </option>

    `;


    const cities =
        [
            ...new Set(
                adminVenuesState
                    .venues
                    .map(
                        (venue) =>
                            venue.city
                    )
                    .filter(Boolean)
            )
        ]
            .sort(
                (
                    first,
                    second
                ) =>
                    first.localeCompare(
                        second
                    )
            );


    cities.forEach(
        (city) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                city;


            option.textContent =
                city;


            select.appendChild(
                option
            );

        }
    );

}


/* =========================================================
   18. URL PARAMETERS
   ========================================================= */

function applyAdminVenueURLParameters() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const search =
        params.get(
            "search"
        );


    const city =
        params.get(
            "city"
        );


    const status =
        params.get(
            "status"
        );


    if (search) {

        adminVenuesState.search =
            search
                .trim()
                .toLowerCase();


        const input =
            document.getElementById(
                "venueSearch"
            );


        if (input) {

            input.value =
                search;

        }

    }


    if (
        city &&
        adminVenuesState
            .venues
            .some(
                (venue) =>
                    venue.city ===
                    city
            )
    ) {

        adminVenuesState.cityFilter =
            city;


        const select =
            document.getElementById(
                "venueCityFilter"
            );


        if (select) {

            select.value =
                city;

        }

    }


    if (
        [
            "ACTIVE",
            "INACTIVE"
        ].includes(
            String(
                status ||
                ""
            ).toUpperCase()
        )
    ) {

        adminVenuesState.statusFilter =
            status.toUpperCase();


        document
            .querySelectorAll(
                "[data-venue-status]"
            )
            .forEach(
                (button) => {

                    const active =
                        button.dataset
                            .venueStatus ===
                        adminVenuesState
                            .statusFilter;


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

    }


    applyAdminVenueFilters();

}


/* =========================================================
   19. FILTER VENUES
   ========================================================= */

function applyAdminVenueFilters() {

    const {

        statusFilter,
        cityFilter,
        layoutFilter,
        search,
        sort

    } =
        adminVenuesState;


    let venues =
        adminVenuesState
            .venues
            .filter(
                (venue) => {

                    /*
                       STATUS
                    */

                    if (
                        statusFilter !==
                            "ALL" &&
                        venue.status !==
                            statusFilter
                    ) {

                        return false;

                    }


                    /*
                       CITY
                    */

                    if (
                        cityFilter !==
                            "ALL" &&
                        venue.city !==
                            cityFilter
                    ) {

                        return false;

                    }


                    /*
                       LAYOUT
                    */

                    if (
                        layoutFilter ===
                            "CONFIGURED" &&
                        !venue.layoutConfigured
                    ) {

                        return false;

                    }


                    if (
                        layoutFilter ===
                            "PENDING" &&
                        venue.layoutConfigured
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

                            venue.name,
                            venue.type,
                            venue.address,
                            venue.city,
                            venue.state,
                            venue.country,
                            venue.postalCode,

                            venue.categories
                                .map(
                                    (category) =>
                                        category.name
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


    venues =
        sortAdminVenues(
            venues,
            sort
        );


    adminVenuesState.filteredVenues =
        venues;


    renderAdminVenues();

    renderAdminVenueResultCount();

    updateAdminVenueClearButton();

}


/* =========================================================
   20. SORT VENUES
   ========================================================= */

function sortAdminVenues(
    venues,
    sort
) {

    const result = [
        ...venues
    ];


    switch (sort) {

        case "CAPACITY_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.capacity -
                    first.capacity
            );


        case "CAPACITY_ASC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    first.capacity -
                    second.capacity
            );


        case "NEWEST":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getAdminVenueTimestamp(
                        second.createdAt
                    ) -
                    getAdminVenueTimestamp(
                        first.createdAt
                    )
            );


        case "NAME_ASC":
        default:

            return result.sort(
                (
                    first,
                    second
                ) =>
                    first.name
                        .localeCompare(
                            second.name
                        )
            );

    }

}


/* =========================================================
   21. RENDER VENUES
   ========================================================= */

function renderAdminVenues() {

    const body =
        document.getElementById(
            "adminVenuesTableBody"
        );


    const empty =
        document.getElementById(
            "adminVenuesEmpty"
        );


    const wrapper =
        document.querySelector(
            ".admin-venues-table-wrapper"
        );


    if (
        !body ||
        !empty
    ) {

        return;

    }


    const venues =
        adminVenuesState
            .filteredVenues;


    if (!venues.length) {

        body.innerHTML =
            "";


        if (wrapper) {

            wrapper.hidden =
                true;

        }


        empty.hidden =
            false;


        refreshAdminVenueIcons();

        return;

    }


    if (wrapper) {

        wrapper.hidden =
            false;

    }


    empty.hidden =
        true;


    body.innerHTML =
        venues
            .map(
                createAdminVenueRowHTML
            )
            .join("");


    refreshAdminVenueIcons();

}


/* =========================================================
   22. VENUE ROW
   ========================================================= */

function createAdminVenueRowHTML(
    venue
) {

    const type =
        getAdminVenueTypeVisual(
            venue.type
        );


    const location =
        [
            venue.city,
            venue.state
        ]
            .filter(Boolean)
            .join(", ");


    const categoryNames =
        venue.categories
            .slice(
                0,
                3
            )
            .map(
                (category) =>
                    category.name
            );


    return `

        <tr data-venue-id="${
            escapeAdminVenueAttribute(
                venue.id
            )
        }">


            <!-- VENUE -->

            <td>

                <div class="admin-venues-name-cell">

                    <div class="admin-venues-name-icon">

                        <i data-lucide="${
                            type.icon
                        }"></i>

                    </div>


                    <div>

                        <strong>

                            ${
                                escapeAdminVenueHTML(
                                    venue.name
                                )
                            }

                        </strong>


                        <small>

                            ${
                                escapeAdminVenueHTML(
                                    venue.id
                                )
                            }

                        </small>

                    </div>

                </div>

            </td>



            <!-- LOCATION -->

            <td>

                <div class="admin-venue-location-cell">

                    <span>

                        <i data-lucide="map-pin"></i>

                        ${
                            escapeAdminVenueHTML(
                                location ||
                                "Location unavailable"
                            )
                        }

                    </span>


                    <small>

                        ${
                            escapeAdminVenueHTML(
                                venue.address ||
                                venue.country
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- TYPE -->

            <td>

                <span
                    class="
                        admin-venue-type-badge
                        ${type.className}
                    "
                >

                    ${escapeAdminVenueHTML(
                        type.label
                    )}

                </span>

            </td>



            <!-- CAPACITY -->

            <td>

                <div class="admin-venue-capacity-cell">

                    <strong>

                        ${
                            formatAdminVenueNumber(
                                venue.capacity
                            )
                        }

                    </strong>


                    <small>
                        seats
                    </small>

                </div>

            </td>



            <!-- CATEGORIES -->

            <td>

                <div class="admin-venue-category-cell">

                    <strong>

                        ${
                            venue.categories.length
                        }

                        ${
                            venue.categories.length ===
                            1
                                ? "category"
                                : "categories"
                        }

                    </strong>


                    <small>

                        ${
                            escapeAdminVenueHTML(
                                categoryNames.join(", ") ||
                                "Not configured"
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- LAYOUT -->

            <td>

                <span
                    class="
                        admin-venue-layout-status
                        ${
                            venue.layoutConfigured
                                ? "configured"
                                : "pending"
                        }
                    "
                >

                    <i
                        data-lucide="${
                            venue.layoutConfigured
                                ? "circle-check-big"
                                : "clock-3"
                        }"
                    ></i>

                    ${
                        venue.layoutConfigured
                            ? "Configured"
                            : "Pending"
                    }

                </span>

            </td>



            <!-- STATUS -->

            <td>

                <span
                    class="
                        admin-venue-record-status
                        ${
                            venue.status ===
                            "ACTIVE"
                                ? "active"
                                : "inactive"
                        }
                    "
                >

                    <span></span>

                    ${
                        venue.status ===
                        "ACTIVE"
                            ? "Active"
                            : "Inactive"
                    }

                </span>

            </td>



            <!-- ACTIONS -->

            <td>

                <div class="admin-venue-actions">


                    <a
                        href="./edit-venue.html?id=${
                            encodeURIComponent(
                                venue.id
                            )
                        }"
                        class="admin-venue-action-button"
                        title="Edit venue"
                        aria-label="Edit ${
                            escapeAdminVenueAttribute(
                                venue.name
                            )
                        }"
                    >

                        <i data-lucide="pencil"></i>

                    </a>


                    <a
                        href="./seat-categories.html?venue=${
                            encodeURIComponent(
                                venue.id
                            )
                        }"
                        class="admin-venue-action-button"
                        title="Seat categories"
                        aria-label="Manage seat categories for ${
                            escapeAdminVenueAttribute(
                                venue.name
                            )
                        }"
                    >

                        <i data-lucide="tags"></i>

                    </a>


                    <a
                        href="./seat-layout.html?venue=${
                            encodeURIComponent(
                                venue.id
                            )
                        }"
                        class="admin-venue-action-button primary"
                        title="Seat layout"
                        aria-label="Configure seat layout for ${
                            escapeAdminVenueAttribute(
                                venue.name
                            )
                        }"
                    >

                        <i data-lucide="armchair"></i>

                    </a>

                </div>

            </td>

        </tr>

    `;

}


/* =========================================================
   23. SUMMARY
   ========================================================= */

function renderAdminVenueSummary() {

    const venues =
        adminVenuesState
            .venues;


    const active =
        venues.filter(
            (venue) =>
                venue.status ===
                "ACTIVE"
        ).length;


    const physicalSeats =
        venues.reduce(
            (
                total,
                venue
            ) =>
                total +
                venue.capacity,
            0
        );


    const pendingLayouts =
        venues.filter(
            (venue) =>
                !venue.layoutConfigured
        ).length;


    setAdminVenueText(
        "venueTotalCount",
        formatAdminVenueNumber(
            venues.length
        )
    );


    setAdminVenueText(
        "venueActiveCount",
        formatAdminVenueNumber(
            active
        )
    );


    setAdminVenueText(
        "venueSeatCount",
        formatAdminVenueNumber(
            physicalSeats
        )
    );


    setAdminVenueText(
        "venuePendingLayoutCount",
        formatAdminVenueNumber(
            pendingLayouts
        )
    );

}


/* =========================================================
   24. SIDEBAR COUNTS
   ========================================================= */

function renderAdminVenueSidebarCounts() {

    setAdminVenueText(
        "sidebarVenueCount",
        adminVenuesState
            .venues
            .length
    );

}


/* =========================================================
   25. RESULT COUNT
   ========================================================= */

function renderAdminVenueResultCount() {

    setAdminVenueText(
        "venueResultCount",
        adminVenuesState
            .filteredVenues
            .length
    );

}


/* =========================================================
   26. CLEAR BUTTON
   ========================================================= */

function updateAdminVenueClearButton() {

    const active =
        adminVenuesState.statusFilter !==
            "ALL" ||
        adminVenuesState.cityFilter !==
            "ALL" ||
        adminVenuesState.layoutFilter !==
            "ALL" ||
        Boolean(
            adminVenuesState.search
        ) ||
        adminVenuesState.sort !==
            "NAME_ASC";


    const button =
        document.getElementById(
            "clearVenueFilters"
        );


    if (button) {

        button.hidden =
            !active;

    }

}


/* =========================================================
   27. CLEAR FILTERS
   ========================================================= */

function clearAdminVenueFilters() {

    adminVenuesState.statusFilter =
        "ALL";


    adminVenuesState.cityFilter =
        "ALL";


    adminVenuesState.layoutFilter =
        "ALL";


    adminVenuesState.search =
        "";


    adminVenuesState.sort =
        "NAME_ASC";


    document
        .querySelectorAll(
            "[data-venue-status]"
        )
        .forEach(
            (button) => {

                const active =
                    button.dataset
                        .venueStatus ===
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
            "venueSearch"
        );


    if (search) {

        search.value =
            "";

    }


    const city =
        document.getElementById(
            "venueCityFilter"
        );


    if (city) {

        city.value =
            "ALL";

    }


    const layout =
        document.getElementById(
            "venueLayoutFilter"
        );


    if (layout) {

        layout.value =
            "ALL";

    }


    const sort =
        document.getElementById(
            "venueSort"
        );


    if (sort) {

        sort.value =
            "NAME_ASC";

    }


    applyAdminVenueFilters();

}


/* =========================================================
   28. VENUE STATUS
   ========================================================= */

function normalizeAdminVenueStatus(
    value
) {

    const status =
        String(
            value ||
            "ACTIVE"
        )
            .trim()
            .toUpperCase();


    if (
        [
            "INACTIVE",
            "DISABLED",
            "ARCHIVED"
        ].includes(
            status
        )
    ) {

        return "INACTIVE";

    }


    return "ACTIVE";

}


/* =========================================================
   29. VENUE TYPE
   ========================================================= */

function normalizeAdminVenueType(
    value
) {

    const type =
        String(
            value ||
            "VENUE"
        )
            .trim()
            .toUpperCase()
            .replace(
                /\s+/g,
                "_"
            );


    if (
        type.includes(
            "STADIUM"
        )
    ) {

        return "STADIUM";

    }


    if (
        type.includes(
            "CINEMA"
        ) ||
        type.includes(
            "THEATRE"
        ) ||
        type.includes(
            "THEATER"
        )
    ) {

        return "CINEMA";

    }


    if (
        type.includes(
            "ARENA"
        )
    ) {

        return "ARENA";

    }


    if (
        type.includes(
            "CONVENTION"
        ) ||
        type.includes(
            "HALL"
        )
    ) {

        return "CONVENTION_HALL";

    }


    if (
        type.includes(
            "AUDITORIUM"
        )
    ) {

        return "AUDITORIUM";

    }


    return "VENUE";

}


/* =========================================================
   30. TYPE VISUAL
   ========================================================= */

function getAdminVenueTypeVisual(
    type
) {

    switch (type) {

        case "STADIUM":

            return {

                label:
                    "Stadium",

                className:
                    "stadium",

                icon:
                    "landmark"

            };


        case "ARENA":

            return {

                label:
                    "Arena",

                className:
                    "arena",

                icon:
                    "circle-dot"
            };


        case "CINEMA":

            return {

                label:
                    "Cinema",

                className:
                    "cinema",

                icon:
                    "clapperboard"

            };


        case "CONVENTION_HALL":

            return {

                label:
                    "Convention Hall",

                className:
                    "hall",

                icon:
                    "building-2"

            };


        case "AUDITORIUM":

            return {

                label:
                    "Auditorium",

                className:
                    "auditorium",

                icon:
                    "presentation"

            };


        default:

            return {

                label:
                    "Venue",

                className:
                    "venue",

                icon:
                    "building-2"

            };

    }

}


/* =========================================================
   31. TIMESTAMP
   ========================================================= */

function getAdminVenueTimestamp(
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
   32. NUMBER FORMAT
   ========================================================= */

function formatAdminVenueNumber(
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
   33. INITIALS
   ========================================================= */

function createAdminVenueInitials(
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
   34. SET TEXT
   ========================================================= */

function setAdminVenueText(
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
   35. HTML ESCAPE
   ========================================================= */

function escapeAdminVenueHTML(
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
   36. ATTRIBUTE ESCAPE
   ========================================================= */

function escapeAdminVenueAttribute(
    value
) {

    return escapeAdminVenueHTML(
        value
    );

}


/* =========================================================
   37. TOAST
   ========================================================= */

function showAdminVenueToast(
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
   38. ICONS
   ========================================================= */

function refreshAdminVenueIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   39. PUBLIC PAGE API
   ========================================================= */

window.SKYRA_ADMIN_VENUES_PAGE = {

    getVenues:
        () =>
            adminVenuesState
                .venues
                .map(
                    (venue) => ({

                        ...venue,

                        categories:
                            venue.categories.map(
                                (category) => ({
                                    ...category
                                })
                            )

                    })
                ),

    getFilteredVenues:
        () =>
            adminVenuesState
                .filteredVenues
                .map(
                    (venue) => ({
                        ...venue
                    })
                ),

    getVenueById:
        (venueId) =>
            adminVenuesState
                .venues
                .find(
                    (venue) =>
                        venue.id ===
                        venueId
                ) ||
            null,

    refresh:
        loadAdminVenues

};


/* =========================================================
   END SKYRA ADMIN VENUES
   ========================================================= */