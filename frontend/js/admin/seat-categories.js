/* =========================================================
   SKYRA - ADMIN SEAT CATEGORIES
   File:
   frontend/js/admin/seat-categories.js

   Architecture:
   Venue
      └── categories[]
             └── physical Seat references category.id

   Important:
   - Category pricing is NOT stored here.
   - Organiser sets category pricing per Show.
   - category.capacity is treated as the number of
     physical seats currently assigned to that category.
   - Categories with assigned seats cannot be deleted.


   Future backend endpoints could be:
   GET    /api/admin/venues
   GET    /api/admin/venues/:venueId
   POST   /api/admin/venues/:venueId/categories
   PATCH  /api/admin/venues/:venueId/categories/:categoryId
   DELETE /api/admin/venues/:venueId/categories/:categoryId
   ========================================================= */

"use strict";


/* =========================================================
   1-2. BACKEND-ONLY SEAT CATEGORY DATA
   ========================================================= */

/* =========================================================
   3. STATE
   ========================================================= */

const adminSeatCategoryState = {

    venues:
        [],

    currentVenueId:
        null,

    currentVenue:
        null,

    categories:
        [],

    filteredCategories:
        [],

    statusFilter:
        "ALL",

    search:
        "",

    editingCategoryId:
        null,

    deletingCategoryId:
        null,

    codeTouched:
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

        initializeAdminSeatCategoriesPage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

async function initializeAdminSeatCategoriesPage() {

    initializeSeatCategoryAdminUser();

    initializeSeatCategoryNavigation();

    initializeSeatCategoryControls();

    initializeSeatCategoryModal();

    initializeSeatCategoryDeleteModal();

    initializeSeatCategoryTopSearch();


    await loadSeatCategoryVenues();


    refreshSeatCategoryIcons();

}


/* =========================================================
   6. ADMIN USER
   ========================================================= */

function initializeSeatCategoryAdminUser() {

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
        createSeatCategoryInitials(
            name
        );


    setSeatCategoryText(
        "sidebarUserName",
        name
    );


    setSeatCategoryText(
        "sidebarUserInitials",
        initials
    );


    setSeatCategoryText(
        "topbarUserName",
        name
    );


    setSeatCategoryText(
        "topbarUserInitials",
        initials
    );


    setSeatCategoryText(
        "dropdownUserName",
        name
    );


    setSeatCategoryText(
        "dropdownUserInitials",
        initials
    );


    setSeatCategoryText(
        "dropdownUserEmail",
        admin.email ||
        ""
    );

}


/* =========================================================
   7. NAVIGATION
   ========================================================= */

function initializeSeatCategoryNavigation() {

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
                    "./seat-categories.html";


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

async function loadSeatCategoryVenues() {

    try {

        let venues =
            await fetchSeatCategoryVenueSource();


        venues =
            venues
                .map(
                    normalizeSeatCategoryVenue
                )
                .filter(
                    (venue) =>
                        venue.id
                );


        adminSeatCategoryState.venues =
            mergeUniqueSeatCategoryVenues(
                venues
            );


        populateSeatCategoryVenueSelector();


        setSeatCategoryText(
            "sidebarVenueCount",
            adminSeatCategoryState
                .venues
                .length
        );


        selectInitialSeatCategoryVenue();

    } catch (error) {

        console.error(
            "Unable to load venues for seat categories:",
            error
        );


        showSeatCategoryToast(
            "Unable to load venue configuration.",
            "error",
            "Seat Categories"
        );

    }

}


/* =========================================================
   9. FETCH VENUE SOURCE - MONGODB ONLY
   ========================================================= */
async function fetchSeatCategoryVenueSource() {
    if (!window.SKYRA_API || typeof window.SKYRA_API.getAdminVenues !== "function") {
        throw new Error("Seat category venue API client is unavailable.");
    }
    const response = await window.SKYRA_API.getAdminVenues();
    const venues = response?.venues || response?.data?.venues || response?.data || response;
    if (!Array.isArray(venues)) throw new Error("Seat category venue response is invalid.");
    return venues;
}

/* =========================================================
   13. NORMALIZE VENUE
   ========================================================= */

function normalizeSeatCategoryVenue(
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
            ),

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

        categories:
            rawCategories.map(
                normalizeSeatCategory
            ),

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
            ).toUpperCase(),

        deleted:
            Boolean(
                raw.deleted
            )

    };

}


/* =========================================================
   14. NORMALIZE CATEGORY
   ========================================================= */

function normalizeSeatCategory(
    raw,
    index = 0
) {

    if (
        typeof raw ===
        "string"
    ) {

        return {

            id:
                `category_${index}`,

            name:
                raw,

            code:
                createSeatCategoryCode(
                    raw
                ),

            description:
                "",

            status:
                "ACTIVE",

            capacity:
                0

        };

    }


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
                createSeatCategoryCode(
                    name
                )
            )
                .toUpperCase(),

        description:
            String(
                raw.description ||
                ""
            ),

        status:
            normalizeSeatCategoryStatus(
                raw.status
            ),

        /*
           Read-only on this page.
           Represents seats assigned to this category.
        */

        capacity:
            Math.max(
                0,
                Number(
                    raw.capacity ??
                    raw.seatCount ??
                    raw.assignedSeats ??
                    0
                ) ||
                0
            )

    };

}


/* =========================================================
   15. MERGE UNIQUE VENUES
   ========================================================= */

function mergeUniqueSeatCategoryVenues(
    venues
) {

    const map =
        new Map();


    venues.forEach(
        (venue) => {

            if (
                venue.deleted ||
                map.has(
                    venue.id
                )
            ) {

                return;

            }


            map.set(
                venue.id,
                venue
            );

        }
    );


    return [
        ...map.values()
    ];

}


/* =========================================================
   16. POPULATE VENUE SELECTOR
   ========================================================= */

function populateSeatCategoryVenueSelector() {

    const select =
        document.getElementById(
            "seatCategoryVenueSelect"
        );


    if (!select) {

        return;

    }


    select.innerHTML =
        "";


    if (
        !adminSeatCategoryState
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


    adminSeatCategoryState
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

function selectInitialSeatCategoryVenue() {

    if (
        !adminSeatCategoryState
            .venues
            .length
    ) {

        clearSeatCategoryVenue();

        return;

    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    const requestedVenueId =
        params.get(
            "venue"
        );


    const requestedExists =
        requestedVenueId &&
        adminSeatCategoryState
            .venues
            .some(
                (venue) =>
                    venue.id ===
                    requestedVenueId
            );


    const venueId =
        requestedExists
            ? requestedVenueId
            : adminSeatCategoryState
                .venues[0]
                .id;


    const select =
        document.getElementById(
            "seatCategoryVenueSelect"
        );


    if (select) {

        select.value =
            venueId;

    }


    selectSeatCategoryVenue(
        venueId
    );

}


/* =========================================================
   18. SELECT VENUE
   ========================================================= */

function selectSeatCategoryVenue(
    venueId
) {

    const venue =
        adminSeatCategoryState
            .venues
            .find(
                (item) =>
                    item.id ===
                    venueId
            );


    if (!venue) {

        clearSeatCategoryVenue();

        return;

    }


    adminSeatCategoryState.currentVenueId =
        venue.id;


    adminSeatCategoryState.currentVenue =
        cloneSeatCategoryData(
            venue
        );


    adminSeatCategoryState.categories =
        venue.categories
            .map(
                (category) => ({
                    ...category
                })
            );


    adminSeatCategoryState.search =
        "";


    adminSeatCategoryState.statusFilter =
        "ALL";


    const search =
        document.getElementById(
            "seatCategorySearch"
        );


    if (search) {

        search.value =
            "";

    }


    resetSeatCategoryStatusTabs();


    renderSeatCategoryVenue();

    applySeatCategoryFilters();

    updateSeatCategoryURL(
        venue.id
    );

}


/* =========================================================
   19. CLEAR VENUE
   ========================================================= */

function clearSeatCategoryVenue() {

    adminSeatCategoryState.currentVenueId =
        null;


    adminSeatCategoryState.currentVenue =
        null;


    adminSeatCategoryState.categories =
        [];


    renderSeatCategoryVenue();

    applySeatCategoryFilters();

}


/* =========================================================
   20. RENDER VENUE CONTEXT
   ========================================================= */

function renderSeatCategoryVenue() {

    const venue =
        adminSeatCategoryState
            .currentVenue;


    if (!venue) {

        setSeatCategoryText(
            "selectedVenueName",
            "No venue available"
        );


        setSeatCategoryText(
            "selectedVenueLocation",
            "Create a venue before adding seat categories."
        );


        setSeatCategoryText(
            "seatCategoryTotalCount",
            "0"
        );


        setSeatCategoryText(
            "seatCategoryActiveCount",
            "0"
        );


        setSeatCategoryText(
            "seatCategoryAssignedSeats",
            "0"
        );


        setSeatCategoryText(
            "seatCategoryVenueCapacity",
            "0"
        );


        updateSeatCategoryLayoutLinks(
            null
        );


        setSeatCategoryAddButtonsDisabled(
            true
        );


        return;

    }


    setSeatCategoryText(
        "selectedVenueName",
        venue.name
    );


    const location =
        [
            venue.city,
            venue.state
        ]
            .filter(Boolean)
            .join(", ");


    setSeatCategoryText(
        "selectedVenueLocation",
        location ||
        venue.address ||
        "Location unavailable"
    );


    setSeatCategoryAddButtonsDisabled(
        false
    );


    renderSeatCategorySummary();

    updateSeatCategoryLayoutLinks(
        venue.id
    );

}


/* =========================================================
   21. SUMMARY
   ========================================================= */

function renderSeatCategorySummary() {

    const categories =
        adminSeatCategoryState
            .categories;


    const active =
        categories.filter(
            (category) =>
                category.status ===
                "ACTIVE"
        ).length;


    const assignedSeats =
        categories.reduce(
            (
                total,
                category
            ) =>
                total +
                category.capacity,
            0
        );


    setSeatCategoryText(
        "seatCategoryTotalCount",
        formatSeatCategoryNumber(
            categories.length
        )
    );


    setSeatCategoryText(
        "seatCategoryActiveCount",
        formatSeatCategoryNumber(
            active
        )
    );


    setSeatCategoryText(
        "seatCategoryAssignedSeats",
        formatSeatCategoryNumber(
            assignedSeats
        )
    );


    setSeatCategoryText(
        "seatCategoryVenueCapacity",
        formatSeatCategoryNumber(
            adminSeatCategoryState
                .currentVenue
                ?.capacity ||
            0
        )
    );

}


/* =========================================================
   22. CONTROLS
   ========================================================= */

function initializeSeatCategoryControls() {

    document
        .getElementById(
            "seatCategoryVenueSelect"
        )
        ?.addEventListener(
            "change",
            (event) => {

                selectSeatCategoryVenue(
                    event.target.value
                );

            }
        );


    document
        .getElementById(
            "seatCategorySearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                adminSeatCategoryState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applySeatCategoryFilters();

            }
        );


    document
        .querySelectorAll(
            "[data-category-status]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        adminSeatCategoryState.statusFilter =
                            button.dataset
                                .categoryStatus ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-category-status]"
                            )
                            .forEach(
                                (item) => {

                                    item.classList.toggle(
                                        "active",
                                        item ===
                                        button
                                    );

                                }
                            );


                        applySeatCategoryFilters();

                    }
                );

            }
        );


    [
        "addSeatCategoryButton",
        "addSeatCategoryPanelButton",
        "emptyAddSeatCategoryButton"
    ]
        .forEach(
            (id) => {

                document
                    .getElementById(
                        id
                    )
                    ?.addEventListener(
                        "click",
                        () => {

                            openSeatCategoryForm();

                        }
                    );

            }
        );

}


/* =========================================================
   23. FILTER CATEGORIES
   ========================================================= */

function applySeatCategoryFilters() {

    const search =
        adminSeatCategoryState
            .search;


    const status =
        adminSeatCategoryState
            .statusFilter;


    const filtered =
        adminSeatCategoryState
            .categories
            .filter(
                (category) => {

                    if (
                        status !==
                            "ALL" &&
                        category.status !==
                            status
                    ) {

                        return false;

                    }


                    if (!search) {

                        return true;

                    }


                    const searchable =
                        [

                            category.name,
                            category.code,
                            category.description

                        ]
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        search
                    );

                }
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    first.name.localeCompare(
                        second.name
                    )
            );


    adminSeatCategoryState.filteredCategories =
        filtered;


    renderSeatCategories();

}


/* =========================================================
   24. RENDER TABLE
   ========================================================= */

function renderSeatCategories() {

    const body =
        document.getElementById(
            "seatCategoryTableBody"
        );


    const wrapper =
        document.getElementById(
            "seatCategoryTableWrapper"
        );


    const empty =
        document.getElementById(
            "seatCategoryEmpty"
        );


    if (
        !body ||
        !wrapper ||
        !empty
    ) {

        return;

    }


    const categories =
        adminSeatCategoryState
            .filteredCategories;


    if (!categories.length) {

        body.innerHTML =
            "";


        wrapper.hidden =
            true;


        empty.hidden =
            false;


        const hasCategories =
            adminSeatCategoryState
                .categories
                .length >
            0;


        setSeatCategoryText(
            "seatCategoryEmptyTitle",
            hasCategories
                ? "No categories found"
                : "No seat categories"
        );


        setSeatCategoryText(
            "seatCategoryEmptyText",
            hasCategories
                ? "No categories match the current search or status filter."
                : "Create the first seat category for this venue before configuring the physical seat layout."
        );


        refreshSeatCategoryIcons();

        return;

    }


    wrapper.hidden =
        false;


    empty.hidden =
        true;


    body.innerHTML =
        categories
            .map(
                createSeatCategoryRow
            )
            .join("");


    bindSeatCategoryRowActions();

    refreshSeatCategoryIcons();

}


/* =========================================================
   25. CATEGORY ROW
   ========================================================= */

function createSeatCategoryRow(
    category
) {

    const assigned =
        category.capacity;


    return `

        <tr
            data-category-id="${
                escapeSeatCategoryHTML(
                    category.id
                )
            }"
        >


            <td>

                <div class="admin-seat-category-name-cell">

                    <div>

                        <i data-lucide="tag"></i>

                    </div>


                    <span>

                        <strong>

                            ${
                                escapeSeatCategoryHTML(
                                    category.name
                                )
                            }

                        </strong>


                        <small>

                            ${
                                escapeSeatCategoryHTML(
                                    category.description ||
                                    "No description"
                                )
                            }

                        </small>

                    </span>

                </div>

            </td>



            <td>

                <code class="admin-seat-category-code">

                    ${
                        escapeSeatCategoryHTML(
                            category.code
                        )
                    }

                </code>

            </td>



            <td>

                <div class="admin-seat-category-assigned">

                    <strong>

                        ${
                            formatSeatCategoryNumber(
                                assigned
                            )
                        }

                    </strong>

                    <small>
                        physical seats
                    </small>

                </div>

            </td>



            <td>

                <span
                    class="
                        admin-seat-category-status
                        ${
                            category.status ===
                            "ACTIVE"
                                ? "active"
                                : "inactive"
                        }
                    "
                >

                    <span></span>

                    ${
                        category.status ===
                        "ACTIVE"
                            ? "Active"
                            : "Inactive"
                    }

                </span>

            </td>



            <td>

                <div class="admin-seat-category-actions">


                    <button
                        type="button"
                        class="admin-seat-category-action edit"
                        data-edit-category="${
                            escapeSeatCategoryHTML(
                                category.id
                            )
                        }"
                        title="Edit category"
                        aria-label="Edit ${
                            escapeSeatCategoryHTML(
                                category.name
                            )
                        }"
                    >

                        <i data-lucide="pencil"></i>

                    </button>


                    <button
                        type="button"
                        class="admin-seat-category-action delete"
                        data-delete-category="${
                            escapeSeatCategoryHTML(
                                category.id
                            )
                        }"
                        title="${
                            assigned > 0
                                ? "Category has assigned seats"
                                : "Delete category"
                        }"
                        aria-label="Delete ${
                            escapeSeatCategoryHTML(
                                category.name
                            )
                        }"
                    >

                        <i data-lucide="trash-2"></i>

                    </button>

                </div>

            </td>

        </tr>

    `;

}


/* =========================================================
   26. ROW ACTIONS
   ========================================================= */

function bindSeatCategoryRowActions() {

    document
        .querySelectorAll(
            "[data-edit-category]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openSeatCategoryForm(
                            button.dataset
                                .editCategory
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            "[data-delete-category]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        requestSeatCategoryDelete(
                            button.dataset
                                .deleteCategory
                        );

                    }
                );

            }
        );

}


/* =========================================================
   27. CATEGORY FORM MODAL
   ========================================================= */

function initializeSeatCategoryModal() {

    const form =
        document.getElementById(
            "seatCategoryForm"
        );


    document
        .getElementById(
            "closeSeatCategoryModal"
        )
        ?.addEventListener(
            "click",
            closeSeatCategoryForm
        );


    document
        .getElementById(
            "cancelSeatCategoryButton"
        )
        ?.addEventListener(
            "click",
            closeSeatCategoryForm
        );


    document
        .getElementById(
            "seatCategoryName"
        )
        ?.addEventListener(
            "input",
            handleSeatCategoryNameInput
        );


    document
        .getElementById(
            "seatCategoryCode"
        )
        ?.addEventListener(
            "input",
            handleSeatCategoryCodeInput
        );


    document
        .getElementById(
            "seatCategoryDescription"
        )
        ?.addEventListener(
            "input",
            updateSeatCategoryDescriptionCounter
        );


    form?.addEventListener(
        "submit",
        handleSeatCategorySubmit
    );


    const modal =
        document.getElementById(
            "seatCategoryModal"
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                closeSeatCategoryForm();

            }

        }
    );

}


/* =========================================================
   28. OPEN CATEGORY FORM
   ========================================================= */

function openSeatCategoryForm(
    categoryId = null
) {

    if (
        !adminSeatCategoryState
            .currentVenue
    ) {

        showSeatCategoryToast(
            "Select a venue before creating a seat category.",
            "error",
            "Venue Required"
        );


        return;

    }


    clearSeatCategoryFormErrors();


    adminSeatCategoryState.editingCategoryId =
        categoryId;


    adminSeatCategoryState.codeTouched =
        Boolean(
            categoryId
        );


    const category =
        categoryId
            ? adminSeatCategoryState
                .categories
                .find(
                    (item) =>
                        item.id ===
                        categoryId
                )
            : null;


    setSeatCategoryInputValue(
        "seatCategoryName",
        category?.name ||
        ""
    );


    setSeatCategoryInputValue(
        "seatCategoryCode",
        category?.code ||
        ""
    );


    setSeatCategoryInputValue(
        "seatCategoryStatus",
        category?.status ||
        "ACTIVE"
    );


    setSeatCategoryInputValue(
        "seatCategoryDescription",
        category?.description ||
        ""
    );


    setSeatCategoryText(
        "seatCategoryModalTitle",
        category
            ? "Edit Seat Category"
            : "Add Seat Category"
    );


    setSeatCategoryText(
        "seatCategoryModalSubtitle",
        category
            ? "Update the category definition without changing its assigned physical seats."
            : "Create a category that physical seats can be assigned to."
    );


    const assignedInfo =
        document.getElementById(
            "seatCategoryAssignedInfo"
        );


    if (assignedInfo) {

        assignedInfo.hidden =
            !category;

    }


    if (category) {

        setSeatCategoryText(
            "seatCategoryAssignedInfoValue",
            `${formatSeatCategoryNumber(
                category.capacity
            )} ${
                category.capacity ===
                1
                    ? "seat"
                    : "seats"
            } assigned`
        );

    }


    updateSeatCategoryDescriptionCounter();


    const modal =
        document.getElementById(
            "seatCategoryModal"
        );


    if (modal) {

        modal.hidden =
            false;


        document.body.classList.add(
            "modal-open"
        );


        setTimeout(
            () => {

                document
                    .getElementById(
                        "seatCategoryName"
                    )
                    ?.focus();

            },
            0
        );

    }


    refreshSeatCategoryIcons();

}


/* =========================================================
   29. CLOSE CATEGORY FORM
   ========================================================= */

function closeSeatCategoryForm() {

    const modal =
        document.getElementById(
            "seatCategoryModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );


    adminSeatCategoryState.editingCategoryId =
        null;


    clearSeatCategoryFormErrors();

}


/* =========================================================
   30. NAME AUTO-CODE
   ========================================================= */

function handleSeatCategoryNameInput(
    event
) {

    clearSeatCategoryFieldError(
        "name"
    );


    if (
        adminSeatCategoryState
            .codeTouched
    ) {

        return;

    }


    const code =
        createSeatCategoryCode(
            event.target.value
        );


    setSeatCategoryInputValue(
        "seatCategoryCode",
        code
    );

}


/* =========================================================
   31. CODE INPUT
   ========================================================= */

function handleSeatCategoryCodeInput(
    event
) {

    adminSeatCategoryState.codeTouched =
        true;


    event.target.value =
        normalizeSeatCategoryCodeInput(
            event.target.value
        );


    clearSeatCategoryFieldError(
        "code"
    );

}


/* =========================================================
   32. FORM SUBMIT
   ========================================================= */

async function handleSeatCategorySubmit(
    event
) {

    event.preventDefault();


    if (
        adminSeatCategoryState.saving
    ) {

        return;

    }


    const category =
        collectSeatCategoryFormData();


    if (
        !validateSeatCategory(
            category
        )
    ) {

        return;

    }


    await saveSeatCategory(
        category
    );

}


/* =========================================================
   33. COLLECT CATEGORY DATA
   ========================================================= */

function collectSeatCategoryFormData() {

    return {

        name:
            cleanSeatCategoryText(
                getSeatCategoryInputValue(
                    "seatCategoryName"
                )
            ),

        code:
            normalizeSeatCategoryCodeInput(
                getSeatCategoryInputValue(
                    "seatCategoryCode"
                )
            ),

        status:
            normalizeSeatCategoryStatus(
                getSeatCategoryInputValue(
                    "seatCategoryStatus"
                )
            ),

        description:
            cleanSeatCategoryText(
                getSeatCategoryInputValue(
                    "seatCategoryDescription"
                )
            )

    };

}


/* =========================================================
   34. VALIDATION
   ========================================================= */

function validateSeatCategory(
    category
) {

    clearSeatCategoryFormErrors();


    let valid =
        true;


    if (!category.name) {

        setSeatCategoryFieldError(
            "name",
            "Category name is required."
        );


        valid =
            false;

    } else if (
        category.name.length <
        2
    ) {

        setSeatCategoryFieldError(
            "name",
            "Category name must contain at least 2 characters."
        );


        valid =
            false;

    }


    if (!category.code) {

        setSeatCategoryFieldError(
            "code",
            "Category code is required."
        );


        valid =
            false;

    } else if (
        !/^[A-Z0-9_]{2,30}$/.test(
            category.code
        )
    ) {

        setSeatCategoryFieldError(
            "code",
            "Use only uppercase letters, numbers and underscores."
        );


        valid =
            false;

    }


    const editingId =
        adminSeatCategoryState
            .editingCategoryId;


    const duplicateName =
        adminSeatCategoryState
            .categories
            .some(
                (item) => {

                    return (
                        item.id !==
                            editingId &&
                        normalizeSeatCategoryIdentity(
                            item.name
                        ) ===
                            normalizeSeatCategoryIdentity(
                                category.name
                            )
                    );

                }
            );


    if (duplicateName) {

        setSeatCategoryFieldError(
            "name",
            "A category with this name already exists for this venue."
        );


        valid =
            false;

    }


    const duplicateCode =
        adminSeatCategoryState
            .categories
            .some(
                (item) => {

                    return (
                        item.id !==
                            editingId &&
                        String(
                            item.code
                        ).toUpperCase() ===
                            category.code
                    );

                }
            );


    if (duplicateCode) {

        setSeatCategoryFieldError(
            "code",
            "This category code is already used in this venue."
        );


        valid =
            false;

    }


    return valid;

}


/* =========================================================
   35. SAVE CATEGORY
   ========================================================= */

async function saveSeatCategory(
    payload
) {

    const venueId =
        adminSeatCategoryState
            .currentVenueId;


    if (!venueId) {

        return;

    }


    adminSeatCategoryState.saving =
        true;


    setSeatCategorySaving(
        true
    );


    try {

        let savedCategory;


        if (
            adminSeatCategoryState
                .editingCategoryId
        ) {

            savedCategory =
                await updateSeatCategoryRecord(
                    venueId,
                    adminSeatCategoryState
                        .editingCategoryId,
                    payload
                );

        } else {

            savedCategory =
                await createSeatCategoryRecord(
                    venueId,
                    payload
                );

        }


        if (!savedCategory) {

            throw new Error(
                "Category save failed."
            );

        }


        applySavedSeatCategory(
            savedCategory
        );


        closeSeatCategoryForm();


        showSeatCategoryToast(
            adminSeatCategoryState
                .editingCategoryId
                ? "Seat category updated successfully."
                : "Seat category created successfully.",
            "success",
            "Seat Categories"
        );

    } catch (error) {

        console.error(
            "Unable to save seat category:",
            error
        );


        showSeatCategoryToast(
            error?.message ||
            "Unable to save the seat category.",
            "error",
            "Save Failed"
        );

    } finally {

        adminSeatCategoryState.saving =
            false;


        setSeatCategorySaving(
            false
        );

    }

}


/* =========================================================
   36. CREATE / UPDATE CATEGORY RECORD - BACKEND ONLY
   ========================================================= */
async function createSeatCategoryRecord(venueId, payload) {
    if (!window.SKYRA_API || typeof window.SKYRA_API.createAdminSeatCategory !== "function") {
        throw new Error("Create seat category API is unavailable.");
    }
    const response = await window.SKYRA_API.createAdminSeatCategory(venueId, payload);
    const category = response?.category || response?.data?.category || response?.data || response;
    return normalizeSeatCategory(category);
}

async function updateSeatCategoryRecord(venueId, categoryId, payload) {
    if (!window.SKYRA_API || typeof window.SKYRA_API.updateAdminSeatCategory !== "function") {
        throw new Error("Update seat category API is unavailable.");
    }
    const response = await window.SKYRA_API.updateAdminSeatCategory(venueId, categoryId, payload);
    const category = response?.category || response?.data?.category || response?.data || response;
    return normalizeSeatCategory(category);
}

/* =========================================================
   38. APPLY SAVED CATEGORY
   ========================================================= */

function applySavedSeatCategory(
    category
) {

    const normalized =
        normalizeSeatCategory(
            category
        );


    const existingIndex =
        adminSeatCategoryState
            .categories
            .findIndex(
                (item) =>
                    item.id ===
                    normalized.id
            );


    if (
        existingIndex >=
        0
    ) {

        adminSeatCategoryState
            .categories[
                existingIndex
            ] =
            normalized;

    } else {

        adminSeatCategoryState
            .categories
            .push(
                normalized
            );

    }


    syncSeatCategoryCurrentVenue();

    renderSeatCategorySummary();

    applySeatCategoryFilters();

}




/* =========================================================
   40. DELETE MODAL
   ========================================================= */

function initializeSeatCategoryDeleteModal() {

    document
        .getElementById(
            "closeDeleteSeatCategoryModal"
        )
        ?.addEventListener(
            "click",
            closeSeatCategoryDeleteModal
        );


    document
        .getElementById(
            "cancelDeleteSeatCategoryButton"
        )
        ?.addEventListener(
            "click",
            closeSeatCategoryDeleteModal
        );


    document
        .getElementById(
            "confirmDeleteSeatCategoryButton"
        )
        ?.addEventListener(
            "click",
            confirmSeatCategoryDelete
        );


    const modal =
        document.getElementById(
            "deleteSeatCategoryModal"
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                closeSeatCategoryDeleteModal();

            }

        }
    );

}


/* =========================================================
   41. REQUEST DELETE
   ========================================================= */

function requestSeatCategoryDelete(
    categoryId
) {

    const category =
        adminSeatCategoryState
            .categories
            .find(
                (item) =>
                    item.id ===
                    categoryId
            );


    if (!category) {

        return;

    }


    /*
       Protect category if physical seats use it.
    */

    if (
        category.capacity >
        0
    ) {

        showSeatCategoryToast(
            `${formatSeatCategoryNumber(
                category.capacity
            )} physical seats are assigned to ${category.name}. Reassign or remove those seats in Seat Layout first.`,
            "error",
            "Category In Use"
        );


        return;

    }


    adminSeatCategoryState.deletingCategoryId =
        category.id;


    setSeatCategoryText(
        "deleteSeatCategoryDescription",
        `${category.name} will be removed from ${adminSeatCategoryState.currentVenue?.name || "this venue"}.`
    );


    const modal =
        document.getElementById(
            "deleteSeatCategoryModal"
        );


    if (modal) {

        modal.hidden =
            false;


        document.body.classList.add(
            "modal-open"
        );

    }

}


/* =========================================================
   42. CONFIRM DELETE
   ========================================================= */

async function confirmSeatCategoryDelete() {

    const categoryId =
        adminSeatCategoryState
            .deletingCategoryId;


    const venueId =
        adminSeatCategoryState
            .currentVenueId;


    if (
        !categoryId ||
        !venueId
    ) {

        return;

    }


    const category =
        adminSeatCategoryState
            .categories
            .find(
                (item) =>
                    item.id ===
                    categoryId
            );


    if (!category) {

        closeSeatCategoryDeleteModal();

        return;

    }


    if (
        category.capacity >
        0
    ) {

        closeSeatCategoryDeleteModal();


        showSeatCategoryToast(
            "This category cannot be deleted while physical seats are assigned to it.",
            "error",
            "Category In Use"
        );


        return;

    }


    try {

        await deleteSeatCategoryRecord(
            venueId,
            categoryId
        );


        adminSeatCategoryState.categories =
            adminSeatCategoryState
                .categories
                .filter(
                    (item) =>
                        item.id !==
                        categoryId
                );


        syncSeatCategoryCurrentVenue();

        renderSeatCategorySummary();

        applySeatCategoryFilters();

        closeSeatCategoryDeleteModal();


        showSeatCategoryToast(
            `${category.name} was deleted.`,
            "success",
            "Category Deleted"
        );

    } catch (error) {

        console.error(
            "Unable to delete category:",
            error
        );


        showSeatCategoryToast(
            error?.message ||
            "Unable to delete the seat category.",
            "error",
            "Delete Failed"
        );

    }

}


/* =========================================================
   43. DELETE CATEGORY RECORD
   ========================================================= */

async function deleteSeatCategoryRecord(
    venueId,
    categoryId
) {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API.deleteAdminSeatCategory !== "function"
    ) {
        throw new Error("Seat category API is unavailable.");
    }

    await window.SKYRA_API.deleteAdminSeatCategory(
        venueId,
        categoryId
    );

}


/* =========================================================
   44. CLOSE DELETE
   ========================================================= */

function closeSeatCategoryDeleteModal() {

    const modal =
        document.getElementById(
            "deleteSeatCategoryModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );


    adminSeatCategoryState.deletingCategoryId =
        null;

}


/* =========================================================
   45. SYNC CURRENT VENUE
   ========================================================= */

function syncSeatCategoryCurrentVenue() {

    if (
        !adminSeatCategoryState
            .currentVenue
    ) {

        return;

    }


    adminSeatCategoryState.currentVenue.categories =
        adminSeatCategoryState
            .categories
            .map(
                (category) => ({
                    ...category
                })
            );


    const index =
        adminSeatCategoryState
            .venues
            .findIndex(
                (venue) =>
                    venue.id ===
                    adminSeatCategoryState
                        .currentVenueId
            );


    if (
        index >=
        0
    ) {

        adminSeatCategoryState
            .venues[
                index
            ].categories =
            adminSeatCategoryState
                .categories
                .map(
                    (category) => ({
                        ...category
                    })
                );

    }

}


/* =========================================================
   46. MODAL SAVING STATE
   ========================================================= */

function setSeatCategorySaving(
    saving
) {

    const button =
        document.getElementById(
            "saveSeatCategoryButton"
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

                Save Category

            `;


    refreshSeatCategoryIcons();

}


/* =========================================================
   47. FIELD ERRORS
   ========================================================= */

function setSeatCategoryFieldError(
    field,
    message
) {

    const config = {

        name: {

            input:
                "seatCategoryName",

            error:
                "seatCategoryNameError"

        },

        code: {

            input:
                "seatCategoryCode",

            error:
                "seatCategoryCodeError"

        }

    }[
        field
    ];


    if (!config) {

        return;

    }


    const input =
        document.getElementById(
            config.input
        );


    const error =
        document.getElementById(
            config.error
        );


    input
        ?.closest(
            ".admin-input-control"
        )
        ?.classList
        .add(
            "is-invalid"
        );


    if (error) {

        error.textContent =
            message;


        error.hidden =
            false;

    }

}


/* =========================================================
   48. CLEAR FIELD ERROR
   ========================================================= */

function clearSeatCategoryFieldError(
    field
) {

    const config = {

        name: {

            input:
                "seatCategoryName",

            error:
                "seatCategoryNameError"

        },

        code: {

            input:
                "seatCategoryCode",

            error:
                "seatCategoryCodeError"

        }

    }[
        field
    ];


    if (!config) {

        return;

    }


    document
        .getElementById(
            config.input
        )
        ?.closest(
            ".admin-input-control"
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


/* =========================================================
   49. CLEAR FORM ERRORS
   ========================================================= */

function clearSeatCategoryFormErrors() {

    clearSeatCategoryFieldError(
        "name"
    );


    clearSeatCategoryFieldError(
        "code"
    );

}


/* =========================================================
   50. DESCRIPTION COUNTER
   ========================================================= */

function updateSeatCategoryDescriptionCounter() {

    const textarea =
        document.getElementById(
            "seatCategoryDescription"
        );


    setSeatCategoryText(
        "seatCategoryDescriptionCount",
        `${
            textarea?.value.length ||
            0
        } / 180`
    );

}


/* =========================================================
   51. RESET STATUS TABS
   ========================================================= */

function resetSeatCategoryStatusTabs() {

    document
        .querySelectorAll(
            "[data-category-status]"
        )
        .forEach(
            (button) => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .categoryStatus ===
                        "ALL"
                );

            }
        );

}


/* =========================================================
   52. LAYOUT LINKS
   ========================================================= */

function updateSeatCategoryLayoutLinks(
    venueId
) {

    const ids = [

        "seatCategoryLayoutButton",
        "seatCategoryNextLayoutButton"

    ];


    ids.forEach(
        (id) => {

            const link =
                document.getElementById(
                    id
                );


            if (!link) {

                return;

            }


            link.href =
                venueId
                    ? `./seat-layout.html?venue=${
                        encodeURIComponent(
                            venueId
                        )
                    }`
                    : "./seat-layout.html";

        }
    );

}


/* =========================================================
   53. DISABLE ADD BUTTONS
   ========================================================= */

function setSeatCategoryAddButtonsDisabled(
    disabled
) {

    [

        "addSeatCategoryButton",
        "addSeatCategoryPanelButton",
        "emptyAddSeatCategoryButton"

    ]
        .forEach(
            (id) => {

                const button =
                    document.getElementById(
                        id
                    );


                if (button) {

                    button.disabled =
                        disabled;

                }

            }
        );

}


/* =========================================================
   54. UPDATE URL
   ========================================================= */

function updateSeatCategoryURL(
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
   55. TOP SEARCH
   ========================================================= */

function initializeSeatCategoryTopSearch() {

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
   56. CATEGORY CODE
   ========================================================= */

function createSeatCategoryCode(
    value
) {

    return String(
        value ||
        ""
    )
        .trim()
        .toUpperCase()
        .replace(
            /[^A-Z0-9]+/g,
            "_"
        )
        .replace(
            /^_+|_+$/g,
            ""
        )
        .slice(
            0,
            30
        );

}


/* =========================================================
   57. NORMALIZE CODE INPUT
   ========================================================= */

function normalizeSeatCategoryCodeInput(
    value
) {

    return String(
        value ||
        ""
    )
        .toUpperCase()
        .replace(
            /[^A-Z0-9_]/g,
            "_"
        )
        .replace(
            /_+/g,
            "_"
        )
        .replace(
            /^_+/g,
            ""
        )
        .slice(
            0,
            30
        );

}


/* =========================================================
   58. CATEGORY ID
   ========================================================= */

function createSeatCategoryId(
    name
) {

    const slug =
        String(
            name ||
            "category"
        )
            .trim()
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "_"
            )
            .replace(
                /^_+|_+$/g,
                ""
            )
            .slice(
                0,
                25
            );


    return `category_${
        slug ||
        "seat"
    }_${
        Date.now()
            .toString(36)
    }`;

}


/* =========================================================
   59. STATUS
   ========================================================= */

function normalizeSeatCategoryStatus(
    value
) {

    return String(
        value ||
        "ACTIVE"
    )
        .trim()
        .toUpperCase() ===
        "INACTIVE"
            ? "INACTIVE"
            : "ACTIVE";

}


/* =========================================================
   60. CLEAN TEXT
   ========================================================= */

function cleanSeatCategoryText(
    value
) {

    return String(
        value ||
        ""
    )
        .trim()
        .replace(
            /\s+/g,
            " "
        );

}


/* =========================================================
   61. IDENTITY
   ========================================================= */

function normalizeSeatCategoryIdentity(
    value
) {

    return String(
        value ||
        ""
    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        );

}


/* =========================================================
   62. INPUT VALUE
   ========================================================= */

function getSeatCategoryInputValue(
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
   63. SET INPUT VALUE
   ========================================================= */

function setSeatCategoryInputValue(
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
   64. SET TEXT
   ========================================================= */

function setSeatCategoryText(
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
   65. NUMBER FORMAT
   ========================================================= */

function formatSeatCategoryNumber(
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
   66. INITIALS
   ========================================================= */

function createSeatCategoryInitials(
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
   67. CLONE
   ========================================================= */

function cloneSeatCategoryData(
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
   68. ESCAPE HTML
   ========================================================= */

function escapeSeatCategoryHTML(
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
   69. TOAST
   ========================================================= */

function showSeatCategoryToast(
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
   70. ICONS
   ========================================================= */

function refreshSeatCategoryIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   71. PUBLIC PAGE API
   ========================================================= */

window.SKYRA_ADMIN_SEAT_CATEGORIES_PAGE = {

    getVenue:
        () =>
            adminSeatCategoryState
                .currentVenue
                ? cloneSeatCategoryData(
                    adminSeatCategoryState
                        .currentVenue
                )
                : null,

    getCategories:
        () =>
            adminSeatCategoryState
                .categories
                .map(
                    (category) => ({
                        ...category
                    })
                ),

    selectVenue:
        selectSeatCategoryVenue,

    refresh:
        loadSeatCategoryVenues

};


/* =========================================================
   END SKYRA ADMIN SEAT CATEGORIES
   ========================================================= */