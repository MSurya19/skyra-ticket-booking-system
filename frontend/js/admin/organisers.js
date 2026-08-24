/* =========================================================
   SKYRA - ADMIN ORGANISERS
   File:
   frontend/js/admin/organisers.js

   Scope:
   - Organiser accounts only
   - Search/filter/sort
   - View organiser details
   - Suspend/reactivate organiser access
   - Preserve events/bookings
   - No role conversion
   - No manual organiser creation

   Important:
   Public registration creates ORGANISER accounts.

   Future backend:
   GET   /api/admin/organisers
   GET   /api/admin/organisers/:id
   PATCH /api/admin/organisers/:id/status

   ========================================================= */

"use strict";


/* =========================================================
   1-3. BACKEND-ONLY INITIAL STATE
   ========================================================= */
const SKYRA_ADMIN_ORGANISER_SUMMARY = { total: 0, active: 0, suspended: 0, verified: 0 };

/* =========================================================
   4. STATE
   ========================================================= */

const adminOrganisersState = {

    organisers:
        [],

    filteredOrganisers:
        [],

    summary: {
        ...SKYRA_ADMIN_ORGANISER_SUMMARY
    },

    statusFilter:
        "ALL",

    verificationFilter:
        "ALL",

    sort:
        "NEWEST",

    search:
        "",

    selectedOrganiserId:
        null,

    pendingStatusOrganiserId:
        null,

    pendingStatus:
        null,

    loading:
        false,

    updating:
        false

};


/* =========================================================
   5. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeAdminOrganisersPage();

    }
);


/* =========================================================
   6. INITIALIZE PAGE
   ========================================================= */

async function initializeAdminOrganisersPage() {

    initializeAdminOrganiserCurrentAdmin();

    initializeAdminOrganiserNavigation();

    initializeAdminOrganiserControls();

    initializeAdminOrganiserDetailsModal();

    initializeAdminOrganiserStatusModal();

    initializeAdminOrganiserTopSearch();


    await loadAdminOrganisers();


    refreshAdminOrganiserIcons();

}


/* =========================================================
   7. CURRENT ADMIN
   ========================================================= */

function initializeAdminOrganiserCurrentAdmin() {

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
        createAdminOrganiserInitials(
            name
        );


    setAdminOrganiserText(
        "sidebarUserName",
        name
    );


    setAdminOrganiserText(
        "sidebarUserInitials",
        initials
    );


    setAdminOrganiserText(
        "topbarUserName",
        name
    );


    setAdminOrganiserText(
        "topbarUserInitials",
        initials
    );


    setAdminOrganiserText(
        "dropdownUserName",
        name
    );


    setAdminOrganiserText(
        "dropdownUserInitials",
        initials
    );


    setAdminOrganiserText(
        "dropdownUserEmail",
        admin.email ||
        ""
    );

}


/* =========================================================
   8. NAVIGATION
   ========================================================= */

function initializeAdminOrganiserNavigation() {

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
                    "./organisers.html";


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
   9. LOAD ORGANISERS
   ========================================================= */

async function loadAdminOrganisers() {

    adminOrganisersState.loading =
        true;


    try {

        const source =
            await fetchAdminOrganiserSource();


        adminOrganisersState.organisers =
            source.organisers
                .map(
                    normalizeAdminOrganiser
                )
                .filter(
                    (organiser) =>
                        organiser.id &&
                        organiser.role ===
                        "ORGANISER"
                );


        if (
            source.summary
        ) {

            adminOrganisersState.summary =
                normalizeAdminOrganiserSummary(
                    source.summary
                );

        }


        renderAdminOrganiserSummary();

        renderAdminOrganiserSidebarCount();

        applyAdminOrganiserFilters();

    } catch (error) {

        console.error(
            "Unable to load organisers:",
            error
        );


        adminOrganisersState.organisers =
            [];


        renderAdminOrganiserSummary();

        applyAdminOrganiserFilters();


        showAdminOrganiserToast(
            "Unable to load organiser records.",
            "error",
            "Organisers Unavailable"
        );

    } finally {

        adminOrganisersState.loading =
            false;

    }

}


/* =========================================================
   10. FETCH SOURCE
   ========================================================= */

async function fetchAdminOrganiserSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getAdminOrganisers !==
            "function"
    ) {

        throw new Error(
            "Admin organisers API client is unavailable."
        );

    }


    const response =
        await window.SKYRA_API
            .getAdminOrganisers();


    const organisers =
        response?.data?.organisers ||
        response?.organisers ||
        (
            Array.isArray(
                response?.data
            )
                ? response.data
                : null
        );


    const summary =
        response?.data?.summary ||
        response?.summary ||
        null;


    if (
        !Array.isArray(
            organisers
        )
    ) {

        throw new Error(
            "Admin organisers API returned an invalid response."
        );

    }


    return {

        organisers,
        summary

    };

}

/* =========================================================
   11. NORMALIZE ORGANISER
   ========================================================= */

function normalizeAdminOrganiser(
    raw,
    index = 0
) {

    return {

        id:
            String(
                raw.id ||
                raw._id ||
                `organiser_${index}`
            ),

        name:
            String(
                raw.name ||
                raw.companyName ||
                raw.organiserName ||
                "Organiser"
            ),

        contactPerson:
            String(
                raw.contactPerson ||
                raw.ownerName ||
                raw.representative ||
                ""
            ),

        email:
            String(
                raw.email ||
                ""
            ),

        phone:
            String(
                raw.phone ||
                raw.phoneNumber ||
                ""
            ),

        city:
            String(
                raw.city ||
                raw.address?.city ||
                ""
            ),

        state:
            String(
                raw.state ||
                raw.address?.state ||
                ""
            ),

        role:
            String(
                raw.role ||
                "ORGANISER"
            )
                .trim()
                .toUpperCase(),

        emailVerified:
            Boolean(
                raw.emailVerified ??
                raw.isEmailVerified ??
                raw.verified ??
                false
            ),

        status:
            normalizeAdminOrganiserStatus(
                raw.status ||
                (
                    raw.active ===
                    false
                        ? "SUSPENDED"
                        : "ACTIVE"
                )
            ),

        eventCount:
            Math.max(
                0,
                Number(
                    raw.eventCount ??
                    raw.totalEvents ??
                    0
                ) ||
                0
            ),

        showCount:
            Math.max(
                0,
                Number(
                    raw.showCount ??
                    raw.totalShows ??
                    0
                ) ||
                0
            ),

        joinedAt:
            raw.joinedAt ||
            raw.createdAt ||
            null,

        lastLoginAt:
            raw.lastLoginAt ||
            null

    };

}


/* =========================================================
   12. NORMALIZE SUMMARY
   ========================================================= */

function normalizeAdminOrganiserSummary(
    summary
) {

    return {

        total:
            Math.max(
                0,
                Number(
                    summary.total ??
                    summary.totalOrganisers ??
                    0
                ) ||
                0
            ),

        active:
            Math.max(
                0,
                Number(
                    summary.active ??
                    summary.activeOrganisers ??
                    0
                ) ||
                0
            ),

        suspended:
            Math.max(
                0,
                Number(
                    summary.suspended ??
                    summary.suspendedOrganisers ??
                    0
                ) ||
                0
            ),

        verified:
            Math.max(
                0,
                Number(
                    summary.verified ??
                    summary.verifiedOrganisers ??
                    0
                ) ||
                0
            )

    };

}




/* =========================================================
   15. INITIALIZE CONTROLS
   ========================================================= */

function initializeAdminOrganiserControls() {

    /*
       SEARCH
    */

    document
        .getElementById(
            "adminOrganisersSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                adminOrganisersState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyAdminOrganiserFilters();

            }
        );


    /*
       STATUS TABS
    */

    document
        .querySelectorAll(
            "[data-organiser-status]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        adminOrganisersState.statusFilter =
                            button.dataset
                                .organiserStatus ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-organiser-status]"
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


                        applyAdminOrganiserFilters();

                    }
                );

            }
        );


    /*
       VERIFICATION
    */

    document
        .getElementById(
            "adminOrganisersVerificationFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminOrganisersState.verificationFilter =
                    event.target.value ||
                    "ALL";


                applyAdminOrganiserFilters();

            }
        );


    /*
       SORT
    */

    document
        .getElementById(
            "adminOrganisersSort"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminOrganisersState.sort =
                    event.target.value ||
                    "NEWEST";


                applyAdminOrganiserFilters();

            }
        );


    /*
       CLEAR FILTERS
    */

    document
        .getElementById(
            "adminOrganisersClearFilters"
        )
        ?.addEventListener(
            "click",
            clearAdminOrganiserFilters
        );


    document
        .getElementById(
            "adminOrganisersEmptyClearFilters"
        )
        ?.addEventListener(
            "click",
            clearAdminOrganiserFilters
        );

}


/* =========================================================
   16. APPLY FILTERS
   ========================================================= */

function applyAdminOrganiserFilters() {

    let organisers =
        adminOrganisersState
            .organisers
            .filter(
                (organiser) => {

                    /*
                       STATUS
                    */

                    if (
                        adminOrganisersState
                            .statusFilter !==
                            "ALL" &&
                        organiser.status !==
                            adminOrganisersState
                                .statusFilter
                    ) {

                        return false;

                    }


                    /*
                       VERIFICATION
                    */

                    if (
                        adminOrganisersState
                            .verificationFilter ===
                            "VERIFIED" &&
                        !organiser.emailVerified
                    ) {

                        return false;

                    }


                    if (
                        adminOrganisersState
                            .verificationFilter ===
                            "UNVERIFIED" &&
                        organiser.emailVerified
                    ) {

                        return false;

                    }


                    /*
                       SEARCH
                    */

                    if (
                        !adminOrganisersState
                            .search
                    ) {

                        return true;

                    }


                    const searchable =
                        [

                            organiser.name,
                            organiser.contactPerson,
                            organiser.email,
                            organiser.phone,
                            organiser.city,
                            organiser.state,
                            organiser.id

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        adminOrganisersState
                            .search
                    );

                }
            );


    organisers =
        sortAdminOrganisers(
            organisers,
            adminOrganisersState
                .sort
        );


    adminOrganisersState.filteredOrganisers =
        organisers;


    renderAdminOrganisersTable();

    renderAdminOrganisersResultCount();

    updateAdminOrganisersClearFilters();

}


/* =========================================================
   17. SORT
   ========================================================= */

function sortAdminOrganisers(
    organisers,
    sort
) {

    const result = [
        ...organisers
    ];


    switch (sort) {

        case "OLDEST":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getAdminOrganiserTimestamp(
                        first.joinedAt
                    ) -
                    getAdminOrganiserTimestamp(
                        second.joinedAt
                    )
            );


        case "NAME_ASC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    first.name.localeCompare(
                        second.name
                    )
            );


        case "EVENTS_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.eventCount -
                    first.eventCount
            );


        case "NEWEST":
        default:

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getAdminOrganiserTimestamp(
                        second.joinedAt
                    ) -
                    getAdminOrganiserTimestamp(
                        first.joinedAt
                    )
            );

    }

}


/* =========================================================
   18. SUMMARY
   ========================================================= */

function renderAdminOrganiserSummary() {

    const summary =
        adminOrganisersState
            .summary;


    setAdminOrganiserText(
        "adminOrganisersTotalCount",
        formatAdminOrganiserNumber(
            summary.total
        )
    );


    setAdminOrganiserText(
        "adminOrganisersActiveCount",
        formatAdminOrganiserNumber(
            summary.active
        )
    );


    setAdminOrganiserText(
        "adminOrganisersSuspendedCount",
        formatAdminOrganiserNumber(
            summary.suspended
        )
    );


    setAdminOrganiserText(
        "adminOrganisersVerifiedCount",
        formatAdminOrganiserNumber(
            summary.verified
        )
    );

}


/* =========================================================
   19. SIDEBAR COUNT
   ========================================================= */

function renderAdminOrganiserSidebarCount() {

    setAdminOrganiserText(
        "sidebarOrganiserCount",
        formatAdminOrganiserNumber(
            adminOrganisersState
                .summary
                .total
        )
    );

}


/* =========================================================
   20. TABLE
   ========================================================= */

function renderAdminOrganisersTable() {

    const body =
        document.getElementById(
            "adminOrganisersTableBody"
        );


    const wrapper =
        document.getElementById(
            "adminOrganisersTableWrapper"
        );


    const empty =
        document.getElementById(
            "adminOrganisersEmpty"
        );


    if (
        !body ||
        !wrapper ||
        !empty
    ) {

        return;

    }


    const organisers =
        adminOrganisersState
            .filteredOrganisers;


    if (!organisers.length) {

        body.innerHTML =
            "";


        wrapper.hidden =
            true;


        empty.hidden =
            false;


        refreshAdminOrganiserIcons();

        return;

    }


    wrapper.hidden =
        false;


    empty.hidden =
        true;


    body.innerHTML =
        organisers
            .map(
                createAdminOrganiserRowHTML
            )
            .join("");


    bindAdminOrganiserRowActions();

    refreshAdminOrganiserIcons();

}


/* =========================================================
   21. ORGANISER ROW
   ========================================================= */

function createAdminOrganiserRowHTML(
    organiser
) {

    const initials =
        createAdminOrganiserInitials(
            organiser.name
        );


    const location =
        [

            organiser.city,
            organiser.state

        ]
            .filter(Boolean)
            .join(", ");


    const active =
        organiser.status ===
        "ACTIVE";


    return `

        <tr
            data-organiser-id="${
                escapeAdminOrganiserHTML(
                    organiser.id
                )
            }"
        >


            <!-- ORGANISER -->

            <td>

                <div class="admin-organiser-name-cell">


                    <div class="admin-organiser-table-avatar">

                        ${
                            escapeAdminOrganiserHTML(
                                initials
                            )
                        }

                    </div>


                    <div>

                        <strong>

                            ${
                                escapeAdminOrganiserHTML(
                                    organiser.name
                                )
                            }

                        </strong>


                        <small>

                            ${
                                escapeAdminOrganiserHTML(
                                    organiser.contactPerson ||
                                    organiser.id
                                )
                            }

                        </small>

                    </div>

                </div>

            </td>



            <!-- CONTACT -->

            <td>

                <div class="admin-organiser-contact-cell">

                    <strong>

                        ${
                            escapeAdminOrganiserHTML(
                                organiser.email ||
                                "Email unavailable"
                            )
                        }

                    </strong>


                    <small>

                        ${
                            escapeAdminOrganiserHTML(
                                organiser.phone ||
                                location ||
                                "Contact unavailable"
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- JOINED -->

            <td>

                <div class="admin-organiser-date-cell">

                    <strong>

                        ${
                            escapeAdminOrganiserHTML(
                                formatAdminOrganiserDate(
                                    organiser.joinedAt
                                )
                            )
                        }

                    </strong>


                    <small>

                        ${
                            escapeAdminOrganiserHTML(
                                location ||
                                "Location unavailable"
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- EVENTS -->

            <td>

                <div class="admin-organiser-event-count">

                    <strong>

                        ${
                            formatAdminOrganiserNumber(
                                organiser.eventCount
                            )
                        }

                    </strong>


                    <small>

                        ${
                            formatAdminOrganiserNumber(
                                organiser.showCount
                            )
                        } shows

                    </small>

                </div>

            </td>



            <!-- VERIFICATION -->

            <td>

                <span
                    class="
                        admin-organiser-verification-status
                        ${
                            organiser.emailVerified
                                ? "verified"
                                : "unverified"
                        }
                    "
                >

                    <i
                        data-lucide="${
                            organiser.emailVerified
                                ? "badge-check"
                                : "circle-alert"
                        }"
                    ></i>

                    ${
                        organiser.emailVerified
                            ? "Verified"
                            : "Unverified"
                    }

                </span>

            </td>



            <!-- STATUS -->

            <td>

                <span
                    class="
                        admin-organiser-account-status
                        ${
                            active
                                ? "active"
                                : "suspended"
                        }
                    "
                >

                    <span></span>

                    ${
                        active
                            ? "Active"
                            : "Suspended"
                    }

                </span>

            </td>



            <!-- ACTIONS -->

            <td>

                <div class="admin-organiser-actions">


                    <button
                        type="button"
                        class="admin-organiser-action-button"
                        data-view-organiser="${
                            escapeAdminOrganiserHTML(
                                organiser.id
                            )
                        }"
                        title="View organiser"
                        aria-label="View ${
                            escapeAdminOrganiserHTML(
                                organiser.name
                            )
                        }"
                    >

                        <i data-lucide="eye"></i>

                    </button>


                    <button
                        type="button"
                        class="
                            admin-organiser-action-button
                            ${
                                active
                                    ? "suspend"
                                    : "activate"
                            }
                        "
                        data-toggle-organiser-status="${
                            escapeAdminOrganiserHTML(
                                organiser.id
                            )
                        }"
                        title="${
                            active
                                ? "Suspend organiser"
                                : "Reactivate organiser"
                        }"
                        aria-label="${
                            active
                                ? "Suspend"
                                : "Reactivate"
                        } ${
                            escapeAdminOrganiserHTML(
                                organiser.name
                            )
                        }"
                    >

                        <i
                            data-lucide="${
                                active
                                    ? "shield-x"
                                    : "shield-check"
                            }"
                        ></i>

                    </button>

                </div>

            </td>

        </tr>

    `;

}


/* =========================================================
   22. BIND ROW ACTIONS
   ========================================================= */

function bindAdminOrganiserRowActions() {

    document
        .querySelectorAll(
            "[data-view-organiser]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openAdminOrganiserDetails(
                            button.dataset
                                .viewOrganiser
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            "[data-toggle-organiser-status]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        requestAdminOrganiserStatusChange(
                            button.dataset
                                .toggleOrganiserStatus
                        );

                    }
                );

            }
        );

}


/* =========================================================
   23. RESULT COUNT
   ========================================================= */

function renderAdminOrganisersResultCount() {

    setAdminOrganiserText(
        "adminOrganisersResultCount",
        formatAdminOrganiserNumber(
            adminOrganisersState
                .filteredOrganisers
                .length
        )
    );

}


/* =========================================================
   24. CLEAR FILTER BUTTON
   ========================================================= */

function updateAdminOrganisersClearFilters() {

    const active =
        Boolean(
            adminOrganisersState
                .search
        ) ||
        adminOrganisersState
            .statusFilter !==
            "ALL" ||
        adminOrganisersState
            .verificationFilter !==
            "ALL" ||
        adminOrganisersState
            .sort !==
            "NEWEST";


    const button =
        document.getElementById(
            "adminOrganisersClearFilters"
        );


    if (button) {

        button.hidden =
            !active;

    }

}


/* =========================================================
   25. CLEAR FILTERS
   ========================================================= */

function clearAdminOrganiserFilters() {

    adminOrganisersState.search =
        "";


    adminOrganisersState.statusFilter =
        "ALL";


    adminOrganisersState.verificationFilter =
        "ALL";


    adminOrganisersState.sort =
        "NEWEST";


    setAdminOrganiserInputValue(
        "adminOrganisersSearch",
        ""
    );


    setAdminOrganiserInputValue(
        "adminOrganisersVerificationFilter",
        "ALL"
    );


    setAdminOrganiserInputValue(
        "adminOrganisersSort",
        "NEWEST"
    );


    document
        .querySelectorAll(
            "[data-organiser-status]"
        )
        .forEach(
            (button) => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .organiserStatus ===
                        "ALL"
                );

            }
        );


    applyAdminOrganiserFilters();

}


/* =========================================================
   26. DETAILS MODAL
   ========================================================= */

function initializeAdminOrganiserDetailsModal() {

    document
        .getElementById(
            "closeAdminOrganiserDetailsModal"
        )
        ?.addEventListener(
            "click",
            closeAdminOrganiserDetails
        );


    document
        .getElementById(
            "adminOrganiserDetailsCloseButton"
        )
        ?.addEventListener(
            "click",
            closeAdminOrganiserDetails
        );


    const modal =
        document.getElementById(
            "adminOrganiserDetailsModal"
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                closeAdminOrganiserDetails();

            }

        }
    );

}


/* =========================================================
   27. OPEN DETAILS
   ========================================================= */

async function openAdminOrganiserDetails(
    organiserId
) {

    let organiser =
        adminOrganisersState
            .organisers
            .find(
                (item) =>
                    item.id ===
                    organiserId
            );


    if (!organiser) {

        return;

    }


    if (
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .getAdminOrganiser ===
            "function"
    ) {

        try {

            const response =
                await window.SKYRA_API
                    .getAdminOrganiser(
                        organiserId
                    );


            const fresh =
                response?.data?.organiser ||
                response?.organiser ||
                response?.data ||
                null;


            if (fresh) {

                organiser =
                    normalizeAdminOrganiser(
                        fresh
                    );


                const index =
                    adminOrganisersState
                        .organisers
                        .findIndex(
                            (item) =>
                                item.id ===
                                organiser.id
                        );


                if (index >= 0) {

                    adminOrganisersState
                        .organisers[index] =
                        organiser;

                }

            }

        } catch (error) {

            console.warn(
                "Unable to refresh organiser details:",
                error
            );

        }

    }


    adminOrganisersState.selectedOrganiserId =
        organiser.id;


    setAdminOrganiserText(
        "adminOrganiserModalInitials",
        createAdminOrganiserInitials(
            organiser.name
        )
    );


    setAdminOrganiserText(
        "adminOrganiserDetailsTitle",
        organiser.name
    );


    setAdminOrganiserText(
        "adminOrganiserModalEmail",
        organiser.email ||
        "Email unavailable"
    );


    setAdminOrganiserText(
        "adminOrganiserModalId",
        organiser.id
    );


    setAdminOrganiserText(
        "adminOrganiserModalName",
        organiser.name
    );


    setAdminOrganiserText(
        "adminOrganiserModalContactPerson",
        organiser.contactPerson ||
        "Not provided"
    );


    setAdminOrganiserText(
        "adminOrganiserModalPhone",
        organiser.phone ||
        "Not provided"
    );


    setAdminOrganiserText(
        "adminOrganiserModalLocation",
        [
            organiser.city,
            organiser.state
        ]
            .filter(Boolean)
            .join(", ") ||
        "Not provided"
    );


    setAdminOrganiserText(
        "adminOrganiserModalJoined",
        formatAdminOrganiserDateTime(
            organiser.joinedAt
        )
    );


    setAdminOrganiserText(
        "adminOrganiserModalEvents",
        formatAdminOrganiserNumber(
            organiser.eventCount
        )
    );


    setAdminOrganiserText(
        "adminOrganiserModalShows",
        formatAdminOrganiserNumber(
            organiser.showCount
        )
    );


    setAdminOrganiserText(
        "adminOrganiserModalVerification",
        organiser.emailVerified
            ? "Verified"
            : "Unverified"
    );


    setAdminOrganiserText(
        "adminOrganiserModalStatus",
        organiser.status ===
            "ACTIVE"
            ? "Active"
            : "Suspended"
    );


    const bookingsLink =
        document.getElementById(
            "adminOrganiserBookingsLink"
        );


    if (bookingsLink) {

        bookingsLink.href =
            `./bookings.html?organiser=${
                encodeURIComponent(
                    organiser.id
                )
            }`;

    }


    const modal =
        document.getElementById(
            "adminOrganiserDetailsModal"
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
   28. CLOSE DETAILS
   ========================================================= */

function closeAdminOrganiserDetails() {

    const modal =
        document.getElementById(
            "adminOrganiserDetailsModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );


    adminOrganisersState.selectedOrganiserId =
        null;

}


/* =========================================================
   29. STATUS MODAL INIT
   ========================================================= */

function initializeAdminOrganiserStatusModal() {

    document
        .getElementById(
            "closeAdminOrganiserStatusModal"
        )
        ?.addEventListener(
            "click",
            closeAdminOrganiserStatusModal
        );


    document
        .getElementById(
            "cancelAdminOrganiserStatusButton"
        )
        ?.addEventListener(
            "click",
            closeAdminOrganiserStatusModal
        );


    document
        .getElementById(
            "confirmAdminOrganiserStatusButton"
        )
        ?.addEventListener(
            "click",
            confirmAdminOrganiserStatusChange
        );


    const modal =
        document.getElementById(
            "adminOrganiserStatusModal"
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                closeAdminOrganiserStatusModal();

            }

        }
    );

}


/* =========================================================
   30. REQUEST STATUS CHANGE
   ========================================================= */

function requestAdminOrganiserStatusChange(
    organiserId
) {

    const organiser =
        adminOrganisersState
            .organisers
            .find(
                (item) =>
                    item.id ===
                    organiserId
            );


    if (!organiser) {

        return;

    }


    const nextStatus =
        organiser.status ===
            "ACTIVE"
            ? "SUSPENDED"
            : "ACTIVE";


    const suspending =
        nextStatus ===
        "SUSPENDED";


    adminOrganisersState.pendingStatusOrganiserId =
        organiser.id;


    adminOrganisersState.pendingStatus =
        nextStatus;


    setAdminOrganiserText(
        "adminOrganiserStatusModalTitle",
        suspending
            ? `Suspend ${organiser.name}?`
            : `Reactivate ${organiser.name}?`
    );


    setAdminOrganiserText(
        "adminOrganiserStatusModalDescription",
        suspending
            ? "Organiser access to event and show management will be restricted. Existing events, shows and bookings remain preserved."
            : "Organiser access to the platform will be restored."
    );


    const icon =
        document.getElementById(
            "adminOrganiserStatusModalIcon"
        );


    if (icon) {

        icon.className =
            `admin-organiser-status-modal-icon ${
                suspending
                    ? "suspend"
                    : "activate"
            }`;


        icon.innerHTML = `

            <i
                data-lucide="${
                    suspending
                        ? "shield-x"
                        : "shield-check"
                }"
            ></i>

        `;

    }


    const confirm =
        document.getElementById(
            "confirmAdminOrganiserStatusButton"
        );


    if (confirm) {

        confirm.className =
            suspending
                ? "btn btn-danger"
                : "btn btn-primary";


        confirm.innerHTML = `

            <i
                data-lucide="${
                    suspending
                        ? "shield-x"
                        : "shield-check"
                }"
            ></i>

            ${
                suspending
                    ? "Suspend Organiser"
                    : "Reactivate Organiser"
            }

        `;

    }


    const modal =
        document.getElementById(
            "adminOrganiserStatusModal"
        );


    if (modal) {

        modal.hidden =
            false;


        document.body.classList.add(
            "modal-open"
        );

    }


    refreshAdminOrganiserIcons();

}


/* =========================================================
   31. CONFIRM STATUS CHANGE
   ========================================================= */

async function confirmAdminOrganiserStatusChange() {

    const organiserId =
        adminOrganisersState
            .pendingStatusOrganiserId;


    const status =
        adminOrganisersState
            .pendingStatus;


    if (
        !organiserId ||
        !status ||
        adminOrganisersState
            .updating
    ) {

        return;

    }


    const existing =
        adminOrganisersState
            .organisers
            .find(
                (organiser) =>
                    organiser.id ===
                    organiserId
            );


    if (!existing) {

        closeAdminOrganiserStatusModal();

        return;

    }


    adminOrganisersState.updating =
        true;


    setAdminOrganiserStatusUpdating(
        true
    );


    try {

        const updated =
            await updateAdminOrganiserStatus(
                organiserId,
                status
            );


        const normalized =
            normalizeAdminOrganiser(
                updated
            );


        const index =
            adminOrganisersState
                .organisers
                .findIndex(
                    (organiser) =>
                        organiser.id ===
                        organiserId
                );


        if (
            index >=
            0
        ) {

            adminOrganisersState
                .organisers[
                    index
                ] =
                normalized;

        }


        updateAdminOrganiserSummaryAfterStatusChange(
            existing.status,
            normalized.status
        );


        closeAdminOrganiserStatusModal();

        renderAdminOrganiserSummary();

        applyAdminOrganiserFilters();


        showAdminOrganiserToast(
            normalized.status ===
                "ACTIVE"
                ? `${normalized.name} was reactivated.`
                : `${normalized.name} was suspended.`,
            "success",
            "Organiser Updated"
        );

    } catch (error) {

        console.error(
            "Unable to update organiser:",
            error
        );


        showAdminOrganiserToast(
            error?.message ||
            "Unable to update the organiser account.",
            "error",
            "Update Failed"
        );

    } finally {

        adminOrganisersState.updating =
            false;


        setAdminOrganiserStatusUpdating(
            false
        );

    }

}


/* =========================================================
   32. UPDATE ORGANISER STATUS
   ========================================================= */

async function updateAdminOrganiserStatus(
    organiserId,
    status
) {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .updateAdminOrganiserStatus !==
            "function"
    ) {

        throw new Error(
            "Admin organiser status API client is unavailable."
        );

    }


    const response =
        await window.SKYRA_API
            .updateAdminOrganiserStatus(
                organiserId,
                {
                    status
                }
            );


    const organiser =
        response?.data?.organiser ||
        response?.organiser ||
        response?.data ||
        null;


    if (!organiser) {

        throw new Error(
            "Backend did not return the updated organiser."
        );

    }


    return organiser;

}

/* =========================================================
   33. UPDATE SUMMARY
   ========================================================= */

function updateAdminOrganiserSummaryAfterStatusChange(
    previousStatus,
    nextStatus
) {

    if (
        previousStatus ===
        nextStatus
    ) {

        return;

    }


    const summary =
        adminOrganisersState
            .summary;


    if (
        previousStatus ===
            "ACTIVE" &&
        nextStatus ===
            "SUSPENDED"
    ) {

        summary.active =
            Math.max(
                0,
                summary.active -
                1
            );


        summary.suspended =
            summary.suspended +
            1;

    }


    if (
        previousStatus ===
            "SUSPENDED" &&
        nextStatus ===
            "ACTIVE"
    ) {

        summary.suspended =
            Math.max(
                0,
                summary.suspended -
                1
            );


        summary.active =
            summary.active +
            1;

    }

}


/* =========================================================
   34. UPDATING UI
   ========================================================= */

function setAdminOrganiserStatusUpdating(
    updating
) {

    const button =
        document.getElementById(
            "confirmAdminOrganiserStatusButton"
        );


    if (!button) {

        return;

    }


    button.disabled =
        updating;


    if (updating) {

        button.innerHTML = `

            <span class="admin-button-spinner"></span>

            Updating...

        `;

    } else {

        const suspending =
            adminOrganisersState
                .pendingStatus ===
                "SUSPENDED";


        button.innerHTML = `

            <i
                data-lucide="${
                    suspending
                        ? "shield-x"
                        : "shield-check"
                }"
            ></i>

            ${
                suspending
                    ? "Suspend Organiser"
                    : "Reactivate Organiser"
            }

        `;

    }


    refreshAdminOrganiserIcons();

}


/* =========================================================
   35. CLOSE STATUS MODAL
   ========================================================= */

function closeAdminOrganiserStatusModal() {

    const modal =
        document.getElementById(
            "adminOrganiserStatusModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );


    adminOrganisersState.pendingStatusOrganiserId =
        null;


    adminOrganisersState.pendingStatus =
        null;

}


/* =========================================================
   36. TOPBAR SEARCH
   ========================================================= */

function initializeAdminOrganiserTopSearch() {

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


                setAdminOrganiserInputValue(
                    "adminOrganisersSearch",
                    query
                );


                adminOrganisersState.search =
                    query.toLowerCase();


                applyAdminOrganiserFilters();

            }
        );

}


/* =========================================================
   37. STATUS NORMALIZATION
   ========================================================= */

function normalizeAdminOrganiserStatus(
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
            "SUSPENDED",
            "BLOCKED",
            "DISABLED",
            "INACTIVE"
        ].includes(
            status
        )
    ) {

        return "SUSPENDED";

    }


    return "ACTIVE";

}


/* =========================================================
   38. DATE
   ========================================================= */

function formatAdminOrganiserDate(
    value
) {

    if (!value) {

        return "—";

    }


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
   39. DATE TIME
   ========================================================= */

function formatAdminOrganiserDateTime(
    value
) {

    if (!value) {

        return "—";

    }


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
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"

        }
    ).format(
        date
    );

}


/* =========================================================
   40. TIMESTAMP
   ========================================================= */

function getAdminOrganiserTimestamp(
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
   41. NUMBER
   ========================================================= */

function formatAdminOrganiserNumber(
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
   42. INITIALS
   ========================================================= */

function createAdminOrganiserInitials(
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
   43. SET INPUT
   ========================================================= */

function setAdminOrganiserInputValue(
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
   44. SET TEXT
   ========================================================= */

function setAdminOrganiserText(
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
   45. ESCAPE HTML
   ========================================================= */

function escapeAdminOrganiserHTML(
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
   46. TOAST
   ========================================================= */

function showAdminOrganiserToast(
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
   47. ICONS
   ========================================================= */

function refreshAdminOrganiserIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   48. PUBLIC PAGE API
   ========================================================= */

window.SKYRA_ADMIN_ORGANISERS_PAGE = {

    getOrganisers:
        () =>
            adminOrganisersState
                .organisers
                .map(
                    (organiser) => ({
                        ...organiser
                    })
                ),

    getFilteredOrganisers:
        () =>
            adminOrganisersState
                .filteredOrganisers
                .map(
                    (organiser) => ({
                        ...organiser
                    })
                ),

    getOrganiserById:
        (organiserId) =>
            adminOrganisersState
                .organisers
                .find(
                    (organiser) =>
                        organiser.id ===
                        organiserId
                ) ||
            null,

    refresh:
        loadAdminOrganisers

};


/* =========================================================
   END SKYRA ADMIN ORGANISERS
   ========================================================= */