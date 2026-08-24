/* =========================================================
   SKYRA - ADMIN SEAT LAYOUT
   File:
   frontend/js/admin/seat-layout.js

   PURPOSE
   ---------------------------------------------------------
   This page manages PHYSICAL venue Seat records.

   Venue
      └── Seat
            ├── row
            ├── number
            ├── label
            ├── categoryId
            └── active

   IMPORTANT
   ---------------------------------------------------------
   AVAILABLE / HELD / BOOKED are NOT stored here.

   Those statuses belong to ShowSeat:

   Show
      └── ShowSeat
            ├── seatId
            └── status

   PHASE 6 BACKEND CONNECTION
   ---------------------------------------------------------
   GET /api/admin/venues
   GET /api/admin/venues/:venueId/seats
   PUT /api/admin/venues/:venueId/seat-layout

   MongoDB is now the source of truth for:
   - Venue seatCategories
   - permanent physical Seat records
   - Venue.capacity
   - category.capacity
   - layoutConfigured

   Browser record storage is not used by the active Phase 6
   load/save flow.
   ========================================================= */

"use strict";


/* =========================================================
   3. STATE
   ========================================================= */

const adminSeatLayoutState = {

    venues:
        [],

    currentVenueId:
        null,

    currentVenue:
        null,

    seats:
        [],

    originalSeats:
        [],

    selectedSeatIds:
        new Set(),

    search:
        "",

    categoryFilter:
        "ALL",

    dirty:
        false,

    loading:
        false,

    saving:
        false

};


/* =========================================================
   4. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeAdminSeatLayoutPage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

async function initializeAdminSeatLayoutPage() {

    initializeSeatLayoutAdminUser();

    initializeSeatLayoutNavigation();

    initializeSeatLayoutControls();

    initializeSeatLayoutModals();

    initializeSeatLayoutTopSearch();


    await loadSeatLayoutVenues();


    refreshSeatLayoutIcons();

}


/* =========================================================
   6. ADMIN USER
   ========================================================= */

function initializeSeatLayoutAdminUser() {

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


    const initials =
        createSeatLayoutInitials(
            name
        );


    setSeatLayoutText(
        "sidebarUserName",
        name
    );


    setSeatLayoutText(
        "sidebarUserInitials",
        initials
    );


    setSeatLayoutText(
        "topbarUserName",
        name
    );


    setSeatLayoutText(
        "topbarUserInitials",
        initials
    );


    setSeatLayoutText(
        "dropdownUserName",
        name
    );


    setSeatLayoutText(
        "dropdownUserInitials",
        initials
    );


    setSeatLayoutText(
        "dropdownUserEmail",
        admin.email ||
        ""
    );

}


/* =========================================================
   7. NAVIGATION
   ========================================================= */

function initializeSeatLayoutNavigation() {

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
                    "./seat-layout.html";


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
   8. LOAD VENUES
   ========================================================= */

async function loadSeatLayoutVenues() {

    adminSeatLayoutState.loading =
        true;


    try {

        let venues =
            await fetchSeatLayoutVenueSource();


        venues =
            venues
                .map(
                    normalizeSeatLayoutVenue
                )
                .filter(
                    (venue) =>
                        venue.id &&
                        !venue.deleted
                );


        /*
           Phase 6:
           Backend Venue documents are authoritative.

           Do not apply legacy localStorage venue overrides
           on top of MongoDB data.
        */

        adminSeatLayoutState.venues =
            mergeUniqueSeatLayoutVenues(
                venues
            );


        setSeatLayoutText(
            "sidebarVenueCount",
            adminSeatLayoutState
                .venues
                .length
        );


        populateSeatLayoutVenueSelect();

        await selectInitialSeatLayoutVenue();

    } catch (error) {

        console.error(
            "Unable to load seat layout venues:",
            error
        );


        showSeatLayoutToast(
            "Unable to load venue configuration.",
            "error",
            "Seat Layout"
        );

    } finally {

        adminSeatLayoutState.loading =
            false;

    }

}


/* =========================================================
   9. FETCH VENUE SOURCE
   ========================================================= */

async function fetchSeatLayoutVenueSource() {

    /*
       PHASE 6 REAL BACKEND

       GET /api/admin/venues

       Do not silently fall back to browser mock data.
       If the API is unavailable, show the real failure.
    */

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getAdminVenues !==
            "function"
    ) {

        throw new Error(
            "SKYRA Venue API is not available. Make sure common.js is loaded before seat-layout.js."
        );

    }


    const response =
        await window.SKYRA_API
            .getAdminVenues();


    const venues =
        response?.venues ||
        response?.data?.venues ||
        response?.data ||
        response;


    if (
        !Array.isArray(
            venues
        )
    ) {

        throw new Error(
            "Backend did not return a valid venue list."
        );

    }


    return venues;

}


/* =========================================================
   10. NORMALIZE VENUE
   ========================================================= */

function normalizeSeatLayoutVenue(
    raw,
    index = 0
) {

    const rawCategories =
        Array.isArray(
            raw.seatCategories
        )
            ? raw.seatCategories
            : (
                Array.isArray(
                    raw.categories
                )
                    ? raw.categories
                    : []
            );


    const categories =
        rawCategories
            .map(
                normalizeSeatLayoutCategory
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
            String(
                raw.type ||
                raw.venueType ||
                "VENUE"
            )
                .trim()
                .toUpperCase(),

        address:
            String(
                raw.address ||
                raw.location?.address ||
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

        capacity:
            Math.max(
                0,
                Number(
                    raw.capacity ??
                    raw.totalSeats ??
                    0
                ) ||
                0
            ),

        categories,

        layoutConfigured:
            Boolean(
                raw.layoutConfigured ??
                raw.hasSeatLayout ??
                false
            ),

        status:
            String(
                raw.status ||
                "ACTIVE"
            )
                .toUpperCase(),

        deleted:
            Boolean(
                raw.deleted
            )

    };

}


/* =========================================================
   11. NORMALIZE CATEGORY
   ========================================================= */

function normalizeSeatLayoutCategory(
    raw,
    index = 0
) {

    const name =
        String(
            raw.name ||
            raw.categoryName ||
            `Category ${index + 1}`
        );


    return {

        id:
            String(
                raw.id ||
                raw._id ||
                raw.categoryId ||
                `category_${index}`
            ),

        name,

        code:
            String(
                raw.code ||
                raw.categoryCode ||
                name
            )
                .trim()
                .toUpperCase()
                .replace(
                    /[^A-Z0-9]+/g,
                    "_"
                ),

        status:
            String(
                raw.status ||
                "ACTIVE"
            )
                .toUpperCase() ===
                "INACTIVE"
                    ? "INACTIVE"
                    : "ACTIVE",

        capacity:
            Math.max(
                0,
                Number(
                    raw.capacity ??
                    raw.seatCount ??
                    0
                ) ||
                0
            )

    };

}


/* =========================================================
   15. UNIQUE VENUES
   ========================================================= */

function mergeUniqueSeatLayoutVenues(
    venues
) {

    const map =
        new Map();


    venues.forEach(
        (venue) => {

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
   16. VENUE SELECT
   ========================================================= */

function populateSeatLayoutVenueSelect() {

    const select =
        document.getElementById(
            "seatLayoutVenueSelect"
        );


    if (!select) {

        return;

    }


    select.innerHTML =
        "";


    if (
        !adminSeatLayoutState
            .venues
            .length
    ) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            "";


        option.textContent =
            "No venues available";


        select.appendChild(
            option
        );


        select.disabled =
            true;


        return;

    }


    adminSeatLayoutState
        .venues
        .forEach(
            (venue) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    venue.id;


                option.textContent =
                    `${venue.name} — ${venue.city}`;


                select.appendChild(
                    option
                );

            }
        );

}


/* =========================================================
   17. INITIAL VENUE
   ========================================================= */

async function selectInitialSeatLayoutVenue() {

    if (
        !adminSeatLayoutState
            .venues
            .length
    ) {

        clearSeatLayoutVenue();

        return;

    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    const requested =
        params.get(
            "venue"
        );


    const exists =
        requested &&
        adminSeatLayoutState
            .venues
            .some(
                (venue) =>
                    venue.id ===
                    requested
            );


    const venueId =
        exists
            ? requested
            : adminSeatLayoutState
                .venues[0]
                .id;


    const select =
        document.getElementById(
            "seatLayoutVenueSelect"
        );


    if (select) {

        select.value =
            venueId;

    }


    await selectSeatLayoutVenue(
        venueId
    );

}


/* =========================================================
   18. SELECT VENUE
   ========================================================= */

async function selectSeatLayoutVenue(
    venueId
) {

    const venue =
        adminSeatLayoutState
            .venues
            .find(
                (item) =>
                    item.id ===
                    venueId
            );


    if (!venue) {

        clearSeatLayoutVenue();

        return;

    }


    adminSeatLayoutState.currentVenueId =
        venue.id;


    adminSeatLayoutState.currentVenue =
        cloneSeatLayoutData(
            venue
        );


    adminSeatLayoutState.selectedSeatIds =
        new Set();


    adminSeatLayoutState.search =
        "";


    adminSeatLayoutState.categoryFilter =
        "ALL";


    setSeatLayoutInputValue(
        "seatLayoutSearch",
        ""
    );


    await loadPhysicalSeatsForVenue(
        venue
    );


    populateSeatLayoutCategoryControls();

    renderSeatLayoutVenue();

    renderSeatLayout();

    updateSeatLayoutLinks();

    updateSeatLayoutURL(
        venue.id
    );


    adminSeatLayoutState.dirty =
        false;

}


/* =========================================================
   19. CLEAR VENUE
   ========================================================= */

function clearSeatLayoutVenue() {

    adminSeatLayoutState.currentVenueId =
        null;


    adminSeatLayoutState.currentVenue =
        null;


    adminSeatLayoutState.seats =
        [];


    adminSeatLayoutState.originalSeats =
        [];


    adminSeatLayoutState.selectedSeatIds =
        new Set();


    renderSeatLayoutVenue();

    renderSeatLayout();

}


/* =========================================================
   20. LOAD PHYSICAL SEATS
   ========================================================= */

async function loadPhysicalSeatsForVenue(
    venue
) {

    /*
       PHASE 6 REAL BACKEND

       GET /api/admin/venues/:venueId/seats

       MongoDB is the source of truth. We intentionally do
       not fall back to localStorage or generated mock Seats.
    */

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getAdminVenueSeats !==
            "function"
    ) {

        throw new Error(
            "SKYRA Physical Seat API is not available. Make sure common.js is loaded before seat-layout.js."
        );

    }


    const response =
        await window.SKYRA_API
            .getAdminVenueSeats(
                venue.id
            );


    const result =
        response?.seats ||
        response?.data?.seats ||
        response?.data ||
        response;


    if (
        !Array.isArray(
            result
        )
    ) {

        throw new Error(
            "Backend did not return a valid physical seat array."
        );

    }


    adminSeatLayoutState.seats =
        result
            .map(
                (
                    seat,
                    index
                ) =>
                    normalizePhysicalSeat(
                        seat,
                        venue.id,
                        index
                    )
            )
            .sort(
                comparePhysicalSeats
            );


    adminSeatLayoutState.originalSeats =
        cloneSeatLayoutData(
            adminSeatLayoutState
                .seats
        );


    adminSeatLayoutState.selectedSeatIds =
        new Set();

}


/* =========================================================
   23. NORMALIZE PHYSICAL SEAT
   ========================================================= */

function normalizePhysicalSeat(
    raw,
    venueId,
    index = 0
) {

    const row =
        String(
            raw.row ||
            raw.rowLabel ||
            "A"
        )
            .trim()
            .toUpperCase();


    const number =
        Math.max(
            1,
            Number(
                raw.number ??
                raw.seatNumber ??
                index +
                1
            ) ||
            1
        );


    const label =
        String(
            raw.label ||
            raw.seatLabel ||
            `${row}${number}`
        )
            .trim()
            .toUpperCase();


    return {

        id:
            String(
                raw.id ||
                raw._id ||
                raw.seatId ||
                createPhysicalSeatId(
                    venueId,
                    row,
                    number
                )
            ),

        venueId:
            String(
                raw.venueId ||
                raw.venue ||
                venueId
            ),

        row,

        number,

        label,

        categoryId:
            String(
                raw.categoryId ||
                raw.category?.id ||
                raw.category?._id ||
                raw.category ||
                ""
            ),

        active:
            raw.active !==
            false,

        createdAt:
            raw.createdAt ||
            null,

        updatedAt:
            raw.updatedAt ||
            null

    };

}


/* =========================================================
   26. RENDER VENUE
   ========================================================= */

function renderSeatLayoutVenue() {

    const venue =
        adminSeatLayoutState
            .currentVenue;


    if (!venue) {

        setSeatLayoutText(
            "seatLayoutVenueName",
            "No venue available"
        );


        setSeatLayoutText(
            "seatLayoutVenueLocation",
            "Create a venue before configuring physical seats."
        );


        setSeatLayoutSummaryValues(
            0,
            0,
            0,
            0
        );


        setSeatLayoutBuilderDisabled(
            true
        );


        return;

    }


    setSeatLayoutText(
        "seatLayoutVenueName",
        venue.name
    );


    const location =
        [
            venue.city,
            venue.state
        ]
            .filter(Boolean)
            .join(", ");


    setSeatLayoutText(
        "seatLayoutVenueLocation",
        location ||
        venue.address ||
        "Location unavailable"
    );


    setSeatLayoutFrontLabel(
        venue.type
    );


    setSeatLayoutBuilderDisabled(
        !venue.categories.length
    );

}


/* =========================================================
   27. FRONT LABEL
   ========================================================= */

function setSeatLayoutFrontLabel(
    venueType
) {

    const type =
        String(
            venueType ||
            ""
        )
            .toUpperCase();


    let text =
        "FRONT / STAGE";


    if (
        type ===
        "CINEMA"
    ) {

        text =
            "SCREEN";

    } else if (
        type ===
        "AUDITORIUM"
    ) {

        text =
            "STAGE";

    }


    setSeatLayoutText(
        "seatLayoutFrontLabel",
        text
    );

}


/* =========================================================
   28. CATEGORY CONTROLS
   ========================================================= */

function populateSeatLayoutCategoryControls() {

    const venue =
        adminSeatLayoutState
            .currentVenue;


    const rowSelect =
        document.getElementById(
            "seatRowCategory"
        );


    const filter =
        document.getElementById(
            "seatLayoutCategoryFilter"
        );


    const bulk =
        document.getElementById(
            "bulkSeatCategory"
        );


    if (
        !venue ||
        !rowSelect ||
        !filter ||
        !bulk
    ) {

        return;

    }


    rowSelect.innerHTML = `

        <option value="">
            Select category
        </option>

    `;


    filter.innerHTML = `

        <option value="ALL">
            All Categories
        </option>

    `;


    bulk.innerHTML = `

        <option value="">
            Change category...
        </option>

    `;


    venue.categories
        .forEach(
            (category) => {

                /*
                   New seat creation should use active
                   categories only.
                */

                if (
                    category.status ===
                    "ACTIVE"
                ) {

                    const rowOption =
                        document.createElement(
                            "option"
                        );


                    rowOption.value =
                        category.id;


                    rowOption.textContent =
                        category.name;


                    rowSelect.appendChild(
                        rowOption
                    );


                    const bulkOption =
                        document.createElement(
                            "option"
                        );


                    bulkOption.value =
                        category.id;


                    bulkOption.textContent =
                        category.name;


                    bulk.appendChild(
                        bulkOption
                    );

                }


                /*
                   Filter shows all categories because
                   existing seats may belong to inactive
                   categories.
                */

                const filterOption =
                    document.createElement(
                        "option"
                    );


                filterOption.value =
                    category.id;


                filterOption.textContent =
                    category.name;


                filter.appendChild(
                    filterOption
                );

            }
        );


    updateSeatLayoutCategoryLinks();

}


/* =========================================================
   29. CONTROLS
   ========================================================= */

function initializeSeatLayoutControls() {

    document
        .getElementById(
            "seatLayoutVenueSelect"
        )
        ?.addEventListener(
            "change",
            async (
                event
            ) => {

                if (
                    adminSeatLayoutState
                        .dirty
                ) {

                    const proceed =
                        window.confirm(
                            "You have unsaved seat-layout changes. Switch venue and discard them?"
                        );


                    if (!proceed) {

                        event.target.value =
                            adminSeatLayoutState
                                .currentVenueId ||
                            "";


                        return;

                    }

                }


                await selectSeatLayoutVenue(
                    event.target.value
                );

            }
        );


    document
        .getElementById(
            "seatRowGeneratorForm"
        )
        ?.addEventListener(
            "submit",
            handleGenerateSeatRows
        );


    document
        .getElementById(
            "seatLayoutSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                adminSeatLayoutState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                renderSeatMap();

            }
        );


    document
        .getElementById(
            "seatLayoutCategoryFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminSeatLayoutState.categoryFilter =
                    event.target.value ||
                    "ALL";


                renderSeatMap();

            }
        );


    document
        .getElementById(
            "selectAllVisibleSeatsButton"
        )
        ?.addEventListener(
            "click",
            selectAllVisibleSeats
        );


    document
        .getElementById(
            "clearSeatSelectionButton"
        )
        ?.addEventListener(
            "click",
            clearSeatSelection
        );


    document
        .getElementById(
            "applyBulkSeatCategoryButton"
        )
        ?.addEventListener(
            "click",
            applyBulkSeatCategory
        );


    document
        .getElementById(
            "toggleSelectedSeatsButton"
        )
        ?.addEventListener(
            "click",
            toggleSelectedSeatsActive
        );


    document
        .getElementById(
            "deleteSelectedSeatsButton"
        )
        ?.addEventListener(
            "click",
            openDeleteSelectedSeatsModal
        );


    document
        .getElementById(
            "saveSeatLayoutButton"
        )
        ?.addEventListener(
            "click",
            saveSeatLayout
        );


    document
        .getElementById(
            "resetSeatLayoutButton"
        )
        ?.addEventListener(
            "click",
            openResetSeatLayoutModal
        );


    document
        .getElementById(
            "clearSeatLayoutButton"
        )
        ?.addEventListener(
            "click",
            openClearSeatLayoutModal
        );


    window.addEventListener(
        "beforeunload",
        (event) => {

            if (
                !adminSeatLayoutState
                    .dirty ||
                adminSeatLayoutState
                    .saving
            ) {

                return;

            }


            event.preventDefault();

            event.returnValue =
                "";

        }
    );

}


/* =========================================================
   30. GENERATE ROWS
   ========================================================= */

function handleGenerateSeatRows(
    event
) {

    event.preventDefault();


    clearSeatRowGeneratorErrors();


    const venue =
        adminSeatLayoutState
            .currentVenue;


    if (!venue) {

        return;

    }


    if (
        !venue.categories.length
    ) {

        showSeatLayoutToast(
            "Create at least one seat category before generating physical seats.",
            "error",
            "Categories Required"
        );


        return;

    }


    const startingRow =
        normalizeSeatRowLabel(
            getSeatLayoutInputValue(
                "seatRowStart"
            )
        );


    const rowCount =
        Number(
            getSeatLayoutInputValue(
                "seatRowCount"
            )
        );


    const seatsPerRow =
        Number(
            getSeatLayoutInputValue(
                "seatCountPerRow"
            )
        );


    const startNumber =
        Number(
            getSeatLayoutInputValue(
                "seatStartNumber"
            )
        );


    const categoryId =
        getSeatLayoutInputValue(
            "seatRowCategory"
        );


    let valid =
        true;


    if (
        !startingRow ||
        !/^[A-Z]{1,3}$/.test(
            startingRow
        )
    ) {

        setSeatRowGeneratorError(
            "row",
            "Enter a valid row label such as A, B or AA."
        );


        valid =
            false;

    }


    if (
        !Number.isInteger(
            rowCount
        ) ||
        rowCount <
            1 ||
        rowCount >
            50
    ) {

        showSeatLayoutToast(
            "Number of rows must be between 1 and 50.",
            "error",
            "Invalid Row Count"
        );


        valid =
            false;

    }


    if (
        !Number.isInteger(
            seatsPerRow
        ) ||
        seatsPerRow <
            1 ||
        seatsPerRow >
            100
    ) {

        showSeatLayoutToast(
            "Seats per row must be between 1 and 100.",
            "error",
            "Invalid Seat Count"
        );


        valid =
            false;

    }


    if (
        !Number.isInteger(
            startNumber
        ) ||
        startNumber <
            1
    ) {

        showSeatLayoutToast(
            "Starting seat number must be at least 1.",
            "error",
            "Invalid Seat Number"
        );


        valid =
            false;

    }


    const category =
        venue.categories
            .find(
                (item) =>
                    item.id ===
                    categoryId
            );


    if (!category) {

        setSeatRowGeneratorError(
            "category",
            "Select a valid seat category."
        );


        valid =
            false;

    }


    if (!valid) {

        return;

    }


    const startingRowNumber =
        seatRowLabelToNumber(
            startingRow
        );


    const generatedRows =
        [];


    for (
        let rowIndex = 0;
        rowIndex < rowCount;
        rowIndex++
    ) {

        generatedRows.push(
            numberToSeatRowLabel(
                startingRowNumber +
                rowIndex
            )
        );

    }


    const duplicateRows =
        generatedRows.filter(
            (row) =>
                adminSeatLayoutState
                    .seats
                    .some(
                        (seat) =>
                            seat.row ===
                            row
                    )
        );


    if (
        duplicateRows.length
    ) {

        setSeatRowGeneratorError(
            "row",
            `Row ${
                duplicateRows[0]
            } already exists in this layout.`
        );


        return;

    }


    const newSeats =
        [];


    generatedRows.forEach(
        (row) => {

            for (
                let seatOffset = 0;
                seatOffset < seatsPerRow;
                seatOffset++
            ) {

                const number =
                    startNumber +
                    seatOffset;


                const label =
                    `${row}${number}`;


                newSeats.push({

                    id:
                        createPhysicalSeatId(
                            venue.id,
                            row,
                            number
                        ),

                    venueId:
                        venue.id,

                    row,

                    number,

                    label,

                    categoryId:
                        categoryId,

                    active:
                        true,

                    createdAt:
                        new Date()
                            .toISOString(),

                    updatedAt:
                        null

                });

            }

        }
    );


    adminSeatLayoutState.seats = [

        ...adminSeatLayoutState
            .seats,

        ...newSeats

    ]
        .sort(
            comparePhysicalSeats
        );


    adminSeatLayoutState.dirty =
        true;


    adminSeatLayoutState.selectedSeatIds =
        new Set();


    renderSeatLayout();


    /*
       Prepare next row automatically.
    */

    setSeatLayoutInputValue(
        "seatRowStart",
        numberToSeatRowLabel(
            startingRowNumber +
            rowCount
        )
    );


    showSeatLayoutToast(
        `${formatSeatLayoutNumber(
            newSeats.length
        )} physical seats generated.`,
        "success",
        "Rows Added"
    );

}


/* =========================================================
   31. RENDER COMPLETE LAYOUT
   ========================================================= */

function renderSeatLayout() {

    renderSeatLayoutSummary();

    renderSeatCategoryDistribution();

    renderSeatMap();

    renderSeatBulkActions();

    updateSeatLayoutButtons();

}


/* =========================================================
   32. SUMMARY
   ========================================================= */

function renderSeatLayoutSummary() {

    const seats =
        adminSeatLayoutState
            .seats;


    const activeSeats =
        seats.filter(
            (seat) =>
                seat.active
        ).length;


    const rows =
        new Set(
            seats.map(
                (seat) =>
                    seat.row
            )
        ).size;


    const categories =
        new Set(
            seats
                .map(
                    (seat) =>
                        seat.categoryId
                )
                .filter(Boolean)
        ).size;


    setSeatLayoutSummaryValues(
        seats.length,
        activeSeats,
        rows,
        categories
    );

}


/* =========================================================
   33. SUMMARY VALUES
   ========================================================= */

function setSeatLayoutSummaryValues(
    total,
    active,
    rows,
    categories
) {

    setSeatLayoutText(
        "seatLayoutTotalSeats",
        formatSeatLayoutNumber(
            total
        )
    );


    setSeatLayoutText(
        "seatLayoutActiveSeats",
        formatSeatLayoutNumber(
            active
        )
    );


    setSeatLayoutText(
        "seatLayoutRowCount",
        formatSeatLayoutNumber(
            rows
        )
    );


    setSeatLayoutText(
        "seatLayoutCategoryCount",
        formatSeatLayoutNumber(
            categories
        )
    );

}


/* =========================================================
   34. CATEGORY DISTRIBUTION
   ========================================================= */

function renderSeatCategoryDistribution() {

    const container =
        document.getElementById(
            "seatCategoryDistributionList"
        );


    const venue =
        adminSeatLayoutState
            .currentVenue;


    if (
        !container ||
        !venue
    ) {

        return;

    }


    if (
        !venue.categories.length
    ) {

        container.innerHTML = `

            <div class="admin-seat-distribution-empty">

                No seat categories configured.

            </div>

        `;


        return;

    }


    container.innerHTML =
        venue.categories
            .map(
                (category) => {

                    const count =
                        adminSeatLayoutState
                            .seats
                            .filter(
                                (seat) =>
                                    seat.categoryId ===
                                    category.id
                            )
                            .length;


                    const percentage =
                        adminSeatLayoutState
                            .seats
                            .length
                            ? (
                                count /
                                adminSeatLayoutState
                                    .seats
                                    .length
                            ) *
                            100
                            : 0;


                    return `

                        <div class="admin-seat-distribution-item">


                            <div class="admin-seat-distribution-heading">

                                <span>

                                    <strong>

                                        ${
                                            escapeSeatLayoutHTML(
                                                category.name
                                            )
                                        }

                                    </strong>

                                    <small>

                                        ${
                                            escapeSeatLayoutHTML(
                                                category.code
                                            )
                                        }

                                    </small>

                                </span>


                                <strong>

                                    ${
                                        formatSeatLayoutNumber(
                                            count
                                        )
                                    }

                                </strong>

                            </div>


                            <div class="admin-seat-distribution-track">

                                <span
                                    style="width: ${
                                        Math.min(
                                            100,
                                            percentage
                                        )
                                    }%"
                                ></span>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   35. RENDER SEAT MAP
   ========================================================= */

function renderSeatMap() {

    const map =
        document.getElementById(
            "physicalSeatMap"
        );


    const empty =
        document.getElementById(
            "seatLayoutEmpty"
        );


    const viewport =
        document.getElementById(
            "seatMapViewport"
        );


    if (
        !map ||
        !empty ||
        !viewport
    ) {

        return;

    }


    const seats =
        adminSeatLayoutState
            .seats;


    if (!seats.length) {

        map.innerHTML =
            "";


        viewport.hidden =
            true;


        empty.hidden =
            false;


        const venue =
            adminSeatLayoutState
                .currentVenue;


        const hasCategories =
            venue?.categories
                ?.length >
            0;


        setSeatLayoutText(
            "seatLayoutEmptyText",
            hasCategories
                ? "Use the row generator to create the first physical seats for this venue."
                : "Create seat categories first, then return here to build the physical layout."
        );


        refreshSeatLayoutIcons();

        return;

    }


    viewport.hidden =
        false;


    empty.hidden =
        true;


    const rows =
        groupPhysicalSeatsByRow(
            seats
        );


    map.innerHTML =
        rows
            .map(
                (
                    row
                ) =>
                    createPhysicalSeatRowHTML(
                        row
                    )
            )
            .join("");


    bindPhysicalSeatMapEvents();

    renderSeatMapDescription();

}


/* =========================================================
   36. GROUP BY ROW
   ========================================================= */

function groupPhysicalSeatsByRow(
    seats
) {

    const map =
        new Map();


    seats
        .slice()
        .sort(
            comparePhysicalSeats
        )
        .forEach(
            (seat) => {

                if (
                    !map.has(
                        seat.row
                    )
                ) {

                    map.set(
                        seat.row,
                        []
                    );

                }


                map
                    .get(
                        seat.row
                    )
                    .push(
                        seat
                    );

            }
        );


    return [
        ...map.entries()
    ]
        .map(
            (
                [
                    label,
                    rowSeats
                ]
            ) => ({

                label,
                seats:
                    rowSeats

            })
        );

}


/* =========================================================
   37. ROW HTML
   ========================================================= */

function createPhysicalSeatRowHTML(
    row
) {

    return `

        <div
            class="admin-physical-seat-row"
            data-seat-row="${
                escapeSeatLayoutHTML(
                    row.label
                )
            }"
        >


            <div class="admin-physical-seat-row-label">

                <strong>

                    ${
                        escapeSeatLayoutHTML(
                            row.label
                        )
                    }

                </strong>


                <button
                    type="button"
                    class="admin-delete-seat-row-button"
                    data-delete-seat-row="${
                        escapeSeatLayoutHTML(
                            row.label
                        )
                    }"
                    title="Delete row ${
                        escapeSeatLayoutHTML(
                            row.label
                        )
                    }"
                >

                    <i data-lucide="trash-2"></i>

                </button>

            </div>


            <div class="admin-physical-seat-row-seats">

                ${
                    row.seats
                        .map(
                            createPhysicalSeatButtonHTML
                        )
                        .join("")
                }

            </div>

        </div>

    `;

}


/* =========================================================
   38. SEAT BUTTON HTML
   ========================================================= */

function createPhysicalSeatButtonHTML(
    seat
) {

    const category =
        getSeatLayoutCategoryById(
            seat.categoryId
        );


    const selected =
        adminSeatLayoutState
            .selectedSeatIds
            .has(
                seat.id
            );


    const visible =
        physicalSeatMatchesFilters(
            seat
        );


    const classes = [

        "admin-physical-seat",

        seat.active
            ? "active"
            : "inactive",

        selected
            ? "selected"
            : "",

        !visible
            ? "is-filtered-out"
            : ""

    ]
        .filter(Boolean)
        .join(" ");


    return `

        <button
            type="button"
            class="${classes}"
            data-seat-id="${
                escapeSeatLayoutHTML(
                    seat.id
                )
            }"
            data-category-id="${
                escapeSeatLayoutHTML(
                    seat.categoryId
                )
            }"
            title="${
                escapeSeatLayoutHTML(
                    `${seat.label} · ${
                        category?.name ||
                        "Uncategorised"
                    } · ${
                        seat.active
                            ? "Active"
                            : "Inactive"
                    }`
                )
            }"
            aria-pressed="${
                selected
                    ? "true"
                    : "false"
            }"
        >

            <span>
                ${
                    escapeSeatLayoutHTML(
                        String(
                            seat.number
                        )
                    )
                }
            </span>

        </button>

    `;

}


/* =========================================================
   39. MAP EVENTS
   ========================================================= */

function bindPhysicalSeatMapEvents() {

    document
        .querySelectorAll(
            "[data-seat-id]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        togglePhysicalSeatSelection(
                            button.dataset
                                .seatId
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            "[data-delete-seat-row]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        deletePhysicalSeatRow(
                            button.dataset
                                .deleteSeatRow
                        );

                    }
                );

            }
        );

}


/* =========================================================
   40. FILTER MATCH
   ========================================================= */

function physicalSeatMatchesFilters(
    seat
) {

    const categoryMatches =
        adminSeatLayoutState
            .categoryFilter ===
            "ALL" ||
        seat.categoryId ===
            adminSeatLayoutState
                .categoryFilter;


    if (!categoryMatches) {

        return false;

    }


    const search =
        adminSeatLayoutState
            .search;


    if (!search) {

        return true;

    }


    return seat.label
        .toLowerCase()
        .includes(
            search
        );

}


/* =========================================================
   41. MAP DESCRIPTION
   ========================================================= */

function renderSeatMapDescription() {

    const visible =
        adminSeatLayoutState
            .seats
            .filter(
                physicalSeatMatchesFilters
            )
            .length;


    setSeatLayoutText(
        "seatMapResultDescription",
        `${
            formatSeatLayoutNumber(
                visible
            )
        } of ${
            formatSeatLayoutNumber(
                adminSeatLayoutState
                    .seats
                    .length
            )
        } seats visible`
    );

}


/* =========================================================
   42. SEAT SELECTION
   ========================================================= */

function togglePhysicalSeatSelection(
    seatId
) {

    if (
        adminSeatLayoutState
            .selectedSeatIds
            .has(
                seatId
            )
    ) {

        adminSeatLayoutState
            .selectedSeatIds
            .delete(
                seatId
            );

    } else {

        adminSeatLayoutState
            .selectedSeatIds
            .add(
                seatId
            );

    }


    renderSeatMap();

    renderSeatBulkActions();

}


/* =========================================================
   43. SELECT ALL VISIBLE
   ========================================================= */

function selectAllVisibleSeats() {

    adminSeatLayoutState
        .seats
        .filter(
            physicalSeatMatchesFilters
        )
        .forEach(
            (seat) => {

                adminSeatLayoutState
                    .selectedSeatIds
                    .add(
                        seat.id
                    );

            }
        );


    renderSeatMap();

    renderSeatBulkActions();

}


/* =========================================================
   44. CLEAR SELECTION
   ========================================================= */

function clearSeatSelection() {

    adminSeatLayoutState.selectedSeatIds =
        new Set();


    renderSeatMap();

    renderSeatBulkActions();

}


/* =========================================================
   45. BULK ACTIONS
   ========================================================= */

function renderSeatBulkActions() {

    const panel =
        document.getElementById(
            "seatBulkActions"
        );


    if (!panel) {

        return;

    }


    const count =
        adminSeatLayoutState
            .selectedSeatIds
            .size;


    panel.hidden =
        count ===
        0;


    setSeatLayoutText(
        "selectedSeatCount",
        formatSeatLayoutNumber(
            count
        )
    );

}


/* =========================================================
   46. APPLY BULK CATEGORY
   ========================================================= */

function applyBulkSeatCategory() {

    const categoryId =
        getSeatLayoutInputValue(
            "bulkSeatCategory"
        );


    if (!categoryId) {

        showSeatLayoutToast(
            "Choose a seat category first.",
            "error",
            "Category Required"
        );


        return;

    }


    if (
        !adminSeatLayoutState
            .selectedSeatIds
            .size
    ) {

        return;

    }


    adminSeatLayoutState.seats =
        adminSeatLayoutState
            .seats
            .map(
                (seat) => {

                    if (
                        !adminSeatLayoutState
                            .selectedSeatIds
                            .has(
                                seat.id
                            )
                    ) {

                        return seat;

                    }


                    return {

                        ...seat,

                        categoryId,

                        updatedAt:
                            new Date()
                                .toISOString()

                    };

                }
            );


    adminSeatLayoutState.dirty =
        true;


    renderSeatLayout();


    showSeatLayoutToast(
        "Selected seats were reassigned.",
        "success",
        "Category Updated"
    );

}


/* =========================================================
   47. TOGGLE ACTIVE
   ========================================================= */

function toggleSelectedSeatsActive() {

    if (
        !adminSeatLayoutState
            .selectedSeatIds
            .size
    ) {

        return;

    }


    adminSeatLayoutState.seats =
        adminSeatLayoutState
            .seats
            .map(
                (seat) => {

                    if (
                        !adminSeatLayoutState
                            .selectedSeatIds
                            .has(
                                seat.id
                            )
                    ) {

                        return seat;

                    }


                    return {

                        ...seat,

                        active:
                            !seat.active,

                        updatedAt:
                            new Date()
                                .toISOString()

                    };

                }
            );


    adminSeatLayoutState.dirty =
        true;


    renderSeatLayout();


    showSeatLayoutToast(
        "Selected seat states were updated.",
        "success",
        "Seat Status Updated"
    );

}


/* =========================================================
   48. DELETE ROW
   ========================================================= */

function deletePhysicalSeatRow(
    row
) {

    const rowSeats =
        adminSeatLayoutState
            .seats
            .filter(
                (seat) =>
                    seat.row ===
                    row
            );


    if (!rowSeats.length) {

        return;

    }


    const confirmed =
        window.confirm(
            `Delete row ${row} and its ${rowSeats.length} physical seats?`
        );


    if (!confirmed) {

        return;

    }


    const rowSeatIds =
        new Set(
            rowSeats.map(
                (seat) =>
                    seat.id
            )
        );


    adminSeatLayoutState.seats =
        adminSeatLayoutState
            .seats
            .filter(
                (seat) =>
                    !rowSeatIds.has(
                        seat.id
                    )
            );


    rowSeatIds.forEach(
        (seatId) => {

            adminSeatLayoutState
                .selectedSeatIds
                .delete(
                    seatId
                );

        }
    );


    adminSeatLayoutState.dirty =
        true;


    renderSeatLayout();


    showSeatLayoutToast(
        `Row ${row} removed from the current layout.`,
        "success",
        "Row Removed"
    );

}


/* =========================================================
   49. MODALS
   ========================================================= */

function initializeSeatLayoutModals() {

    bindSeatLayoutModal(

        "clearSeatLayoutModal",
        "closeClearSeatLayoutModal",
        "cancelClearSeatLayoutButton"

    );


    bindSeatLayoutModal(

        "deleteSelectedSeatsModal",
        "closeDeleteSelectedSeatsModal",
        "cancelDeleteSelectedSeatsButton"

    );


    bindSeatLayoutModal(

        "resetSeatLayoutModal",
        "closeResetSeatLayoutModal",
        "cancelResetSeatLayoutButton"

    );


    document
        .getElementById(
            "confirmClearSeatLayoutButton"
        )
        ?.addEventListener(
            "click",
            confirmClearSeatLayout
        );


    document
        .getElementById(
            "confirmDeleteSelectedSeatsButton"
        )
        ?.addEventListener(
            "click",
            confirmDeleteSelectedSeats
        );


    document
        .getElementById(
            "confirmResetSeatLayoutButton"
        )
        ?.addEventListener(
            "click",
            confirmResetSeatLayout
        );

}


/* =========================================================
   50. BIND MODAL
   ========================================================= */

function bindSeatLayoutModal(
    modalId,
    closeId,
    cancelId
) {

    const modal =
        document.getElementById(
            modalId
        );


    const close =
        () =>
            closeSeatLayoutModal(
                modalId
            );


    document
        .getElementById(
            closeId
        )
        ?.addEventListener(
            "click",
            close
        );


    document
        .getElementById(
            cancelId
        )
        ?.addEventListener(
            "click",
            close
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                close();

            }

        }
    );

}


/* =========================================================
   51. OPEN MODAL
   ========================================================= */

function openSeatLayoutModal(
    modalId
) {

    const modal =
        document.getElementById(
            modalId
        );


    if (!modal) {

        return;

    }


    modal.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );

}


/* =========================================================
   52. CLOSE MODAL
   ========================================================= */

function closeSeatLayoutModal(
    modalId
) {

    const modal =
        document.getElementById(
            modalId
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );

}


/* =========================================================
   53. CLEAR LAYOUT MODAL
   ========================================================= */

function openClearSeatLayoutModal() {

    if (
        !adminSeatLayoutState
            .seats
            .length
    ) {

        showSeatLayoutToast(
            "This venue has no physical seats to clear.",
            "info",
            "Layout Empty"
        );


        return;

    }


    openSeatLayoutModal(
        "clearSeatLayoutModal"
    );

}


/* =========================================================
   54. CONFIRM CLEAR
   ========================================================= */

function confirmClearSeatLayout() {

    adminSeatLayoutState.seats =
        [];


    adminSeatLayoutState.selectedSeatIds =
        new Set();


    adminSeatLayoutState.dirty =
        true;


    closeSeatLayoutModal(
        "clearSeatLayoutModal"
    );


    renderSeatLayout();


    showSeatLayoutToast(
        "The current physical seat layout was cleared. Save to persist the change.",
        "info",
        "Layout Cleared"
    );

}


/* =========================================================
   55. DELETE SELECTED MODAL
   ========================================================= */

function openDeleteSelectedSeatsModal() {

    const count =
        adminSeatLayoutState
            .selectedSeatIds
            .size;


    if (!count) {

        return;

    }


    setSeatLayoutText(
        "deleteSelectedSeatsModalText",
        `${formatSeatLayoutNumber(
            count
        )} selected physical ${
            count === 1
                ? "seat"
                : "seats"
        } will be removed from this venue layout.`
    );


    openSeatLayoutModal(
        "deleteSelectedSeatsModal"
    );

}


/* =========================================================
   56. CONFIRM DELETE SELECTED
   ========================================================= */

function confirmDeleteSelectedSeats() {

    const selected =
        adminSeatLayoutState
            .selectedSeatIds;


    adminSeatLayoutState.seats =
        adminSeatLayoutState
            .seats
            .filter(
                (seat) =>
                    !selected.has(
                        seat.id
                    )
            );


    adminSeatLayoutState.selectedSeatIds =
        new Set();


    adminSeatLayoutState.dirty =
        true;


    closeSeatLayoutModal(
        "deleteSelectedSeatsModal"
    );


    renderSeatLayout();


    showSeatLayoutToast(
        "Selected physical seats were removed.",
        "success",
        "Seats Removed"
    );

}


/* =========================================================
   57. RESET MODAL
   ========================================================= */

function openResetSeatLayoutModal() {

    if (
        !adminSeatLayoutState
            .dirty
    ) {

        showSeatLayoutToast(
            "There are no unsaved layout changes.",
            "info",
            "Nothing to Reset"
        );


        return;

    }


    openSeatLayoutModal(
        "resetSeatLayoutModal"
    );

}


/* =========================================================
   58. CONFIRM RESET
   ========================================================= */

function confirmResetSeatLayout() {

    adminSeatLayoutState.seats =
        cloneSeatLayoutData(
            adminSeatLayoutState
                .originalSeats
        );


    adminSeatLayoutState.selectedSeatIds =
        new Set();


    adminSeatLayoutState.dirty =
        false;


    closeSeatLayoutModal(
        "resetSeatLayoutModal"
    );


    renderSeatLayout();


    showSeatLayoutToast(
        "Seat layout returned to its last saved state.",
        "info",
        "Changes Reset"
    );

}


/* =========================================================
   59. SAVE LAYOUT
   ========================================================= */

async function saveSeatLayout() {

    const venue =
        adminSeatLayoutState
            .currentVenue;


    if (
        !venue ||
        adminSeatLayoutState
            .saving
    ) {

        return;

    }


    /*
       Every physical seat must have a valid category.
    */

    const invalidSeat =
        adminSeatLayoutState
            .seats
            .find(
                (seat) =>
                    !venue.categories
                        .some(
                            (category) =>
                                category.id ===
                                seat.categoryId
                        )
            );


    if (invalidSeat) {

        showSeatLayoutToast(
            `${invalidSeat.label} references an invalid seat category.`,
            "error",
            "Invalid Layout"
        );


        return;

    }


    adminSeatLayoutState.saving =
        true;


    setSeatLayoutSavingState(
        true
    );


    try {

        const savedSeats =
            await persistSeatLayout(
                venue.id,
                adminSeatLayoutState
                    .seats
            );


        adminSeatLayoutState.seats =
            savedSeats.map(
                (
                    seat,
                    index
                ) =>
                    normalizePhysicalSeat(
                        seat,
                        venue.id,
                        index
                    )
            );


        adminSeatLayoutState.originalSeats =
            cloneSeatLayoutData(
                adminSeatLayoutState
                    .seats
            );


        adminSeatLayoutState.selectedSeatIds =
            new Set();


        adminSeatLayoutState.dirty =
            false;


        updateCurrentVenueFromSeats();

        renderSeatLayout();


        showSeatLayoutToast(
            `${formatSeatLayoutNumber(
                savedSeats.length
            )} physical seats saved successfully.`,
            "success",
            "Layout Saved"
        );

    } catch (error) {

        console.error(
            "Unable to save seat layout:",
            error
        );


        showSeatLayoutToast(
            error?.message ||
            "Unable to save the physical seat layout.",
            "error",
            "Save Failed"
        );

    } finally {

        adminSeatLayoutState.saving =
            false;


        setSeatLayoutSavingState(
            false
        );

    }

}


/* =========================================================
   60. PERSIST LAYOUT
   ========================================================= */

async function persistSeatLayout(
    venueId,
    seats
) {

    /*
       PHASE 6 REAL BACKEND

       PUT /api/admin/venues/:venueId/seat-layout

       The request represents the COMPLETE desired layout.

       Backend responsibilities:
       - validate ADMIN
       - validate category ownership
       - create/update/delete physical Seat documents
       - preserve existing Seat _id when row + number remain
       - recalculate Venue.capacity
       - recalculate category.capacity
       - maintain layoutConfigured

       Client-generated id and venueId fields are not sent.
    */

    const payload =
        seats.map(
            (seat) => ({

                row:
                    seat.row,

                number:
                    seat.number,

                label:
                    seat.label,

                categoryId:
                    seat.categoryId,

                active:
                    seat.active

            })
        );


    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .saveAdminVenueSeatLayout !==
            "function"
    ) {

        throw new Error(
            "SKYRA Seat Layout API is not available. Make sure common.js is loaded before seat-layout.js."
        );

    }


    const response =
        await window.SKYRA_API
            .saveAdminVenueSeatLayout(
                venueId,
                payload
            );


    const saved =
        response?.seats ||
        response?.data?.seats ||
        response?.data ||
        response;


    if (
        !Array.isArray(
            saved
        )
    ) {

        throw new Error(
            "Backend did not return the saved seat layout."
        );

    }


    return saved;

}


/* =========================================================
   62. CATEGORY COUNTS
   ========================================================= */

function calculateSeatCategoryCounts(
    seats
) {

    return seats.reduce(
        (
            counts,
            seat
        ) => {

            if (
                !seat.categoryId
            ) {

                return counts;

            }


            counts[
                seat.categoryId
            ] =
                (
                    counts[
                        seat.categoryId
                    ] ||
                    0
                ) +
                1;


            return counts;

        },
        {}
    );

}


/* =========================================================
   63. SYNC CURRENT VENUE
   ========================================================= */

function updateCurrentVenueFromSeats() {

    const venue =
        adminSeatLayoutState
            .currentVenue;


    if (!venue) {

        return;

    }


    const counts =
        calculateSeatCategoryCounts(
            adminSeatLayoutState
                .seats
        );


    venue.capacity =
        adminSeatLayoutState
            .seats
            .length;


    venue.layoutConfigured =
        venue.capacity >
        0;


    venue.categories =
        venue.categories
            .map(
                (category) => ({

                    ...category,

                    capacity:
                        counts[
                            category.id
                        ] ||
                        0

                })
            );


    const venueIndex =
        adminSeatLayoutState
            .venues
            .findIndex(
                (item) =>
                    item.id ===
                    venue.id
            );


    if (
        venueIndex >=
        0
    ) {

        adminSeatLayoutState
            .venues[
                venueIndex
            ] =
            cloneSeatLayoutData(
                venue
            );

    }


    populateSeatLayoutCategoryControls();

}


/* =========================================================
   64. SAVE BUTTON STATE
   ========================================================= */

function setSeatLayoutSavingState(
    saving
) {

    const button =
        document.getElementById(
            "saveSeatLayoutButton"
        );


    if (!button) {

        return;

    }


    button.disabled =
        saving;


    button.innerHTML =
        saving
            ? `

                <span class="admin-button-spinner"></span>

                Saving...

            `
            : `

                <i data-lucide="save"></i>

                Save Layout

            `;


    refreshSeatLayoutIcons();

}


/* =========================================================
   65. BUTTON STATES
   ========================================================= */

function updateSeatLayoutButtons() {

    const save =
        document.getElementById(
            "saveSeatLayoutButton"
        );


    const reset =
        document.getElementById(
            "resetSeatLayoutButton"
        );


    if (save) {

        save.disabled =
            !adminSeatLayoutState
                .currentVenue ||
            !adminSeatLayoutState
                .dirty;

    }


    if (reset) {

        reset.disabled =
            !adminSeatLayoutState
                .dirty;

    }

}


/* =========================================================
   66. BUILDER DISABLE
   ========================================================= */

function setSeatLayoutBuilderDisabled(
    disabled
) {

    const form =
        document.getElementById(
            "seatRowGeneratorForm"
        );


    if (!form) {

        return;

    }


    form
        .querySelectorAll(
            "input, select, button"
        )
        .forEach(
            (control) => {

                control.disabled =
                    disabled;

            }
        );

}


/* =========================================================
   67. ROW ERRORS
   ========================================================= */

function setSeatRowGeneratorError(
    field,
    message
) {

    const config = {

        row: {

            control:
                "seatRowStart",

            error:
                "seatRowStartError"

        },

        category: {

            control:
                "seatRowCategory",

            error:
                "seatRowCategoryError"

        }

    }[
        field
    ];


    if (!config) {

        return;

    }


    const control =
        document.getElementById(
            config.control
        );


    control
        ?.closest(
            ".admin-input-control, .admin-select-control"
        )
        ?.classList
        .add(
            "is-invalid"
        );


    const error =
        document.getElementById(
            config.error
        );


    if (error) {

        error.textContent =
            message;


        error.hidden =
            false;

    }

}


/* =========================================================
   68. CLEAR ROW ERRORS
   ========================================================= */

function clearSeatRowGeneratorErrors() {

    [
        {
            control:
                "seatRowStart",
            error:
                "seatRowStartError"
        },

        {
            control:
                "seatRowCategory",
            error:
                "seatRowCategoryError"
        }

    ]
        .forEach(
            (config) => {

                document
                    .getElementById(
                        config.control
                    )
                    ?.closest(
                        ".admin-input-control, .admin-select-control"
                    )
                    ?.classList
                    .remove(
                        "is-invalid"
                    );


                const error =
                    document.getElementById(
                        config.error
                    );


                if (error) {

                    error.hidden =
                        true;


                    error.textContent =
                        "";

                }

            }
        );

}


/* =========================================================
   69. CATEGORY LOOKUP
   ========================================================= */

function getSeatLayoutCategoryById(
    categoryId
) {

    return adminSeatLayoutState
        .currentVenue
        ?.categories
        ?.find(
            (category) =>
                category.id ===
                categoryId
        ) ||
        null;

}


/* =========================================================
   70. LINKS
   ========================================================= */

function updateSeatLayoutLinks() {

    updateSeatLayoutCategoryLinks();


    const venueId =
        adminSeatLayoutState
            .currentVenueId;


    const emptyLink =
        document.getElementById(
            "seatLayoutEmptyCategoriesLink"
        );


    if (emptyLink) {

        emptyLink.href =
            venueId
                ? `./seat-categories.html?venue=${
                    encodeURIComponent(
                        venueId
                    )
                }`
                : "./seat-categories.html";

    }

}


/* =========================================================
   71. CATEGORY LINKS
   ========================================================= */

function updateSeatLayoutCategoryLinks() {

    const venueId =
        adminSeatLayoutState
            .currentVenueId;


    const link =
        document.getElementById(
            "topbarSeatCategoriesLink"
        );


    if (link) {

        link.href =
            venueId
                ? `./seat-categories.html?venue=${
                    encodeURIComponent(
                        venueId
                    )
                }`
                : "./seat-categories.html";

    }

}


/* =========================================================
   72. UPDATE URL
   ========================================================= */

function updateSeatLayoutURL(
    venueId
) {

    if (!venueId) {

        return;

    }


    const url =
        new URL(
            window.location.href
        );


    url.searchParams.set(
        "venue",
        venueId
    );


    window.history.replaceState(
        {},
        "",
        url
    );

}


/* =========================================================
   73. TOPBAR SEARCH
   ========================================================= */

function initializeSeatLayoutTopSearch() {

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


                window.location.href =
                    `./venues.html?search=${
                        encodeURIComponent(
                            query
                        )
                    }`;

            }
        );

}


/* =========================================================
   74. PHYSICAL SEAT ID
   ========================================================= */

function createPhysicalSeatId(
    venueId,
    row,
    number
) {

    const venueSlug =
        String(
            venueId ||
            "venue"
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "_"
            );


    return `seat_${venueSlug}_${row}_${number}`;

}


/* =========================================================
   75. ROW LABEL NORMALIZATION
   ========================================================= */

function normalizeSeatRowLabel(
    value
) {

    return String(
        value ||
        ""
    )
        .trim()
        .toUpperCase()
        .replace(
            /[^A-Z]/g,
            ""
        )
        .slice(
            0,
            3
        );

}


/* =========================================================
   76. ROW LABEL → NUMBER
   A = 1
   B = 2
   Z = 26
   AA = 27
   ========================================================= */

function seatRowLabelToNumber(
    label
) {

    const value =
        normalizeSeatRowLabel(
            label
        );


    if (!value) {

        return 0;

    }


    let result =
        0;


    for (
        let index = 0;
        index < value.length;
        index++
    ) {

        result =
            result *
            26 +
            (
                value.charCodeAt(
                    index
                ) -
                64
            );

    }


    return result;

}


/* =========================================================
   77. NUMBER → ROW LABEL
   ========================================================= */

function numberToSeatRowLabel(
    value
) {

    let number =
        Math.max(
            1,
            Number(
                value
            ) ||
            1
        );


    let label =
        "";


    while (
        number >
        0
    ) {

        number--;


        label =
            String.fromCharCode(
                65 +
                (
                    number %
                    26
                )
            ) +
            label;


        number =
            Math.floor(
                number /
                26
            );

    }


    return label;

}


/* =========================================================
   78. SEAT COMPARATOR
   ========================================================= */

function comparePhysicalSeats(
    first,
    second
) {

    const firstRow =
        seatRowLabelToNumber(
            first.row
        );


    const secondRow =
        seatRowLabelToNumber(
            second.row
        );


    if (
        firstRow !==
        secondRow
    ) {

        return (
            firstRow -
            secondRow
        );

    }


    return (
        first.number -
        second.number
    );

}


/* =========================================================
   79. GET INPUT VALUE
   ========================================================= */

function getSeatLayoutInputValue(
    id
) {

    return document
        .getElementById(
            id
        )
        ?.value ||
        "";

}


/* =========================================================
   80. SET INPUT VALUE
   ========================================================= */

function setSeatLayoutInputValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value ??
            "";

    }

}


/* =========================================================
   81. NUMBER FORMAT
   ========================================================= */

function formatSeatLayoutNumber(
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
   82. SET TEXT
   ========================================================= */

function setSeatLayoutText(
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
   83. INITIALS
   ========================================================= */

function createSeatLayoutInitials(
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
   84. CLONE
   ========================================================= */

function cloneSeatLayoutData(
    value
) {

    try {

        return structuredClone(
            value
        );

    } catch {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    }

}


/* =========================================================
   85. ESCAPE HTML
   ========================================================= */

function escapeSeatLayoutHTML(
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
   86. TOAST
   ========================================================= */

function showSeatLayoutToast(
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
   87. ICONS
   ========================================================= */

function refreshSeatLayoutIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   88. PUBLIC PAGE API
   ========================================================= */

window.SKYRA_ADMIN_SEAT_LAYOUT_PAGE = {

    getVenue:
        () =>
            adminSeatLayoutState
                .currentVenue
                ? cloneSeatLayoutData(
                    adminSeatLayoutState
                        .currentVenue
                )
                : null,

    getSeats:
        () =>
            cloneSeatLayoutData(
                adminSeatLayoutState
                    .seats
            ),

    getSelectedSeats:
        () =>
            adminSeatLayoutState
                .seats
                .filter(
                    (seat) =>
                        adminSeatLayoutState
                            .selectedSeatIds
                            .has(
                                seat.id
                            )
                )
                .map(
                    (seat) => ({
                        ...seat
                    })
                ),

    selectVenue:
        selectSeatLayoutVenue,

    save:
        saveSeatLayout,

    refresh:
        loadSeatLayoutVenues

};


/* =========================================================
   END SKYRA ADMIN SEAT LAYOUT
   ========================================================= */