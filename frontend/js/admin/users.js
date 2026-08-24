/* =========================================================
   SKYRA - ADMIN USERS
   File:
   frontend/js/admin/users.js

   Scope:
   - Customer accounts only
   - Search/filter/sort
   - Customer details
   - Suspend/reactivate account
   - Preserve role and booking history

   Important:
   - ORGANISER accounts use organisers.html
   - ADMIN accounts are not managed here
   - Frontend status controls are UI only
   - Backend authorization is authoritative

   Future backend:
   GET   /api/admin/users?role=CUSTOMER
   GET   /api/admin/users/:id
   PATCH /api/admin/users/:id/status

   ========================================================= */

"use strict";


/* =========================================================
   1-3. BACKEND-ONLY INITIAL STATE
   ========================================================= */
const SKYRA_ADMIN_USER_SUMMARY = { total: 0, active: 0, suspended: 0, verified: 0 };

/* =========================================================
   4. STATE
   ========================================================= */

const adminUsersState = {

    users:
        [],

    filteredUsers:
        [],

    platformSummary:
        {
            ...SKYRA_ADMIN_USER_SUMMARY
        },

    statusFilter:
        "ALL",

    verificationFilter:
        "ALL",

    sort:
        "NEWEST",

    search:
        "",

    selectedUserId:
        null,

    pendingStatusUserId:
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

        initializeAdminUsersPage();

    }
);


/* =========================================================
   6. INITIALIZE
   ========================================================= */

async function initializeAdminUsersPage() {

    initializeAdminUsersCurrentAdmin();

    initializeAdminUsersNavigation();

    initializeAdminUsersControls();

    initializeAdminUsersDetailsModal();

    initializeAdminUsersStatusModal();

    initializeAdminUsersTopSearch();


    await loadAdminUsers();


    refreshAdminUsersIcons();

}


/* =========================================================
   7. CURRENT ADMIN PROFILE
   ========================================================= */

function initializeAdminUsersCurrentAdmin() {

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
        createAdminUsersInitials(
            name
        );


    setAdminUsersText(
        "sidebarUserName",
        name
    );


    setAdminUsersText(
        "sidebarUserInitials",
        initials
    );


    setAdminUsersText(
        "topbarUserName",
        name
    );


    setAdminUsersText(
        "topbarUserInitials",
        initials
    );


    setAdminUsersText(
        "dropdownUserName",
        name
    );


    setAdminUsersText(
        "dropdownUserInitials",
        initials
    );


    setAdminUsersText(
        "dropdownUserEmail",
        admin.email ||
        ""
    );

}


/* =========================================================
   8. NAVIGATION
   ========================================================= */

function initializeAdminUsersNavigation() {

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
                    "./users.html";


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
   9. LOAD USERS
   ========================================================= */

async function loadAdminUsers() {

    adminUsersState.loading =
        true;


    try {

        const source =
            await fetchAdminUsersSource();


        adminUsersState.users =
            source.users
                .map(
                    normalizeAdminUser
                )
                .filter(
                    (user) =>
                        user.id &&
                        user.role ===
                        "CUSTOMER"
                );


        if (
            source.summary
        ) {

            adminUsersState.platformSummary =
                normalizeAdminUsersSummary(
                    source.summary
                );

        }


        renderAdminUsersSummary();

        renderAdminUsersSidebarCount();

        applyAdminUsersFilters();

    } catch (error) {

        console.error(
            "Unable to load Admin users:",
            error
        );


        adminUsersState.users =
            [];


        renderAdminUsersSummary();

        applyAdminUsersFilters();


        showAdminUsersToast(
            "Unable to load customer records.",
            "error",
            "Users Unavailable"
        );

    } finally {

        adminUsersState.loading =
            false;

    }

}


/* =========================================================
   10. DATA SOURCE
   ========================================================= */

async function fetchAdminUsersSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getAdminUsers !==
            "function"
    ) {

        throw new Error(
            "Admin users API client is unavailable."
        );

    }


    const response =
        await window.SKYRA_API
            .getAdminUsers({
                role:
                    "CUSTOMER"
            });


    const users =
        response?.data?.users ||
        response?.users ||
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
            users
        )
    ) {

        throw new Error(
            "Admin users API returned an invalid response."
        );

    }


    return {

        users,
        summary

    };

}

/* =========================================================
   11. NORMALIZE USER
   ========================================================= */

function normalizeAdminUser(
    raw,
    index = 0
) {

    return {

        id:
            String(
                raw.id ||
                raw._id ||
                `customer_${index}`
            ),

        name:
            String(
                raw.name ||
                raw.fullName ||
                raw.displayName ||
                "Customer"
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
                "CUSTOMER"
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
            normalizeAdminUserStatus(
                raw.status ||
                (
                    raw.active ===
                    false
                        ? "SUSPENDED"
                        : "ACTIVE"
                )
            ),

        bookingCount:
            Math.max(
                0,
                Number(
                    raw.bookingCount ??
                    raw.totalBookings ??
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
   12. SUMMARY NORMALIZATION
   ========================================================= */

function normalizeAdminUsersSummary(
    summary
) {

    return {

        total:
            Math.max(
                0,
                Number(
                    summary.total ??
                    summary.totalUsers ??
                    summary.totalCustomers ??
                    0
                ) ||
                0
            ),

        active:
            Math.max(
                0,
                Number(
                    summary.active ??
                    summary.activeUsers ??
                    summary.activeCustomers ??
                    0
                ) ||
                0
            ),

        suspended:
            Math.max(
                0,
                Number(
                    summary.suspended ??
                    summary.suspendedUsers ??
                    0
                ) ||
                0
            ),

        verified:
            Math.max(
                0,
                Number(
                    summary.verified ??
                    summary.verifiedUsers ??
                    0
                ) ||
                0
            )

    };

}




/* =========================================================
   15. CONTROLS
   ========================================================= */

function initializeAdminUsersControls() {

    /*
       SEARCH
    */

    document
        .getElementById(
            "adminUsersSearch"
        )
        ?.addEventListener(
            "input",
            (event) => {

                adminUsersState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyAdminUsersFilters();

            }
        );


    /*
       STATUS TABS
    */

    document
        .querySelectorAll(
            "[data-user-status]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        adminUsersState.statusFilter =
                            button.dataset
                                .userStatus ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-user-status]"
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


                        applyAdminUsersFilters();

                    }
                );

            }
        );


    /*
       VERIFICATION
    */

    document
        .getElementById(
            "adminUsersVerificationFilter"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminUsersState.verificationFilter =
                    event.target.value ||
                    "ALL";


                applyAdminUsersFilters();

            }
        );


    /*
       SORT
    */

    document
        .getElementById(
            "adminUsersSort"
        )
        ?.addEventListener(
            "change",
            (event) => {

                adminUsersState.sort =
                    event.target.value ||
                    "NEWEST";


                applyAdminUsersFilters();

            }
        );


    /*
       CLEAR
    */

    document
        .getElementById(
            "adminUsersClearFilters"
        )
        ?.addEventListener(
            "click",
            clearAdminUsersFilters
        );


    document
        .getElementById(
            "adminUsersEmptyClearFilters"
        )
        ?.addEventListener(
            "click",
            clearAdminUsersFilters
        );

}


/* =========================================================
   16. FILTER USERS
   ========================================================= */

function applyAdminUsersFilters() {

    let users =
        adminUsersState
            .users
            .filter(
                (user) => {

                    /*
                       STATUS
                    */

                    if (
                        adminUsersState
                            .statusFilter !==
                            "ALL" &&
                        user.status !==
                            adminUsersState
                                .statusFilter
                    ) {

                        return false;

                    }


                    /*
                       VERIFICATION
                    */

                    if (
                        adminUsersState
                            .verificationFilter ===
                            "VERIFIED" &&
                        !user.emailVerified
                    ) {

                        return false;

                    }


                    if (
                        adminUsersState
                            .verificationFilter ===
                            "UNVERIFIED" &&
                        user.emailVerified
                    ) {

                        return false;

                    }


                    /*
                       SEARCH
                    */

                    if (
                        !adminUsersState
                            .search
                    ) {

                        return true;

                    }


                    const searchable =
                        [

                            user.name,
                            user.email,
                            user.phone,
                            user.city,
                            user.state,
                            user.id

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        adminUsersState
                            .search
                    );

                }
            );


    users =
        sortAdminUsers(
            users,
            adminUsersState
                .sort
        );


    adminUsersState.filteredUsers =
        users;


    renderAdminUsersTable();

    renderAdminUsersResultCount();

    updateAdminUsersClearButton();

}


/* =========================================================
   17. SORT USERS
   ========================================================= */

function sortAdminUsers(
    users,
    sort
) {

    const result = [
        ...users
    ];


    switch (sort) {

        case "OLDEST":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getAdminUsersTimestamp(
                        first.joinedAt
                    ) -
                    getAdminUsersTimestamp(
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


        case "BOOKINGS_DESC":

            return result.sort(
                (
                    first,
                    second
                ) =>
                    second.bookingCount -
                    first.bookingCount
            );


        case "NEWEST":
        default:

            return result.sort(
                (
                    first,
                    second
                ) =>
                    getAdminUsersTimestamp(
                        second.joinedAt
                    ) -
                    getAdminUsersTimestamp(
                        first.joinedAt
                    )
            );

    }

}


/* =========================================================
   18. RENDER SUMMARY
   ========================================================= */

function renderAdminUsersSummary() {

    const summary =
        adminUsersState
            .platformSummary;


    setAdminUsersText(
        "adminUsersTotalCount",
        formatAdminUsersNumber(
            summary.total
        )
    );


    setAdminUsersText(
        "adminUsersActiveCount",
        formatAdminUsersNumber(
            summary.active
        )
    );


    setAdminUsersText(
        "adminUsersSuspendedCount",
        formatAdminUsersNumber(
            summary.suspended
        )
    );


    setAdminUsersText(
        "adminUsersVerifiedCount",
        formatAdminUsersNumber(
            summary.verified
        )
    );

}


/* =========================================================
   19. SIDEBAR COUNT
   ========================================================= */

function renderAdminUsersSidebarCount() {

    const count =
        adminUsersState
            .platformSummary
            .total;


    const element =
        document.getElementById(
            "sidebarCustomerCount"
        );


    if (!element) {

        return;

    }


    if (
        count >=
        1000
    ) {

        element.textContent =
            `${
                (
                    count /
                    1000
                )
                    .toFixed(1)
                    .replace(
                        ".0",
                        ""
                    )
            }K`;

    } else {

        element.textContent =
            String(
                count
            );

    }

}


/* =========================================================
   20. RENDER TABLE
   ========================================================= */

function renderAdminUsersTable() {

    const body =
        document.getElementById(
            "adminUsersTableBody"
        );


    const wrapper =
        document.getElementById(
            "adminUsersTableWrapper"
        );


    const empty =
        document.getElementById(
            "adminUsersEmpty"
        );


    if (
        !body ||
        !wrapper ||
        !empty
    ) {

        return;

    }


    const users =
        adminUsersState
            .filteredUsers;


    if (!users.length) {

        body.innerHTML =
            "";


        wrapper.hidden =
            true;


        empty.hidden =
            false;


        refreshAdminUsersIcons();

        return;

    }


    wrapper.hidden =
        false;


    empty.hidden =
        true;


    body.innerHTML =
        users
            .map(
                createAdminUserRowHTML
            )
            .join("");


    bindAdminUserRowActions();

    refreshAdminUsersIcons();

}


/* =========================================================
   21. USER ROW
   ========================================================= */

function createAdminUserRowHTML(
    user
) {

    const initials =
        createAdminUsersInitials(
            user.name
        );


    const location =
        [
            user.city,
            user.state
        ]
            .filter(Boolean)
            .join(", ");


    const active =
        user.status ===
        "ACTIVE";


    return `

        <tr data-user-id="${
            escapeAdminUsersHTML(
                user.id
            )
        }">


            <!-- CUSTOMER -->

            <td>

                <div class="admin-user-name-cell">

                    <div class="admin-user-table-avatar">

                        ${
                            escapeAdminUsersHTML(
                                initials
                            )
                        }

                    </div>


                    <div>

                        <strong>

                            ${
                                escapeAdminUsersHTML(
                                    user.name
                                )
                            }

                        </strong>


                        <small>

                            ${
                                escapeAdminUsersHTML(
                                    user.id
                                )
                            }

                        </small>

                    </div>

                </div>

            </td>



            <!-- CONTACT -->

            <td>

                <div class="admin-user-contact-cell">

                    <strong>

                        ${
                            escapeAdminUsersHTML(
                                user.email ||
                                "No email"
                            )
                        }

                    </strong>


                    <small>

                        ${
                            escapeAdminUsersHTML(
                                user.phone ||
                                location ||
                                "Contact unavailable"
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- JOINED -->

            <td>

                <div class="admin-user-date-cell">

                    <strong>

                        ${
                            escapeAdminUsersHTML(
                                formatAdminUsersDate(
                                    user.joinedAt
                                )
                            )
                        }

                    </strong>


                    <small>

                        ${
                            escapeAdminUsersHTML(
                                location ||
                                "Location unavailable"
                            )
                        }

                    </small>

                </div>

            </td>



            <!-- BOOKINGS -->

            <td>

                <div class="admin-user-booking-count">

                    <strong>

                        ${
                            formatAdminUsersNumber(
                                user.bookingCount
                            )
                        }

                    </strong>


                    <small>
                        bookings
                    </small>

                </div>

            </td>



            <!-- VERIFICATION -->

            <td>

                <span
                    class="
                        admin-user-verification-status
                        ${
                            user.emailVerified
                                ? "verified"
                                : "unverified"
                        }
                    "
                >

                    <i
                        data-lucide="${
                            user.emailVerified
                                ? "badge-check"
                                : "circle-alert"
                        }"
                    ></i>

                    ${
                        user.emailVerified
                            ? "Verified"
                            : "Unverified"
                    }

                </span>

            </td>



            <!-- STATUS -->

            <td>

                <span
                    class="
                        admin-user-account-status
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

                <div class="admin-user-actions">


                    <button
                        type="button"
                        class="admin-user-action-button"
                        data-view-user="${
                            escapeAdminUsersHTML(
                                user.id
                            )
                        }"
                        title="View customer"
                        aria-label="View ${
                            escapeAdminUsersHTML(
                                user.name
                            )
                        }"
                    >

                        <i data-lucide="eye"></i>

                    </button>


                    <button
                        type="button"
                        class="
                            admin-user-action-button
                            ${
                                active
                                    ? "suspend"
                                    : "activate"
                            }
                        "
                        data-toggle-user-status="${
                            escapeAdminUsersHTML(
                                user.id
                            )
                        }"
                        title="${
                            active
                                ? "Suspend customer"
                                : "Reactivate customer"
                        }"
                        aria-label="${
                            active
                                ? "Suspend"
                                : "Reactivate"
                        } ${
                            escapeAdminUsersHTML(
                                user.name
                            )
                        }"
                    >

                        <i
                            data-lucide="${
                                active
                                    ? "user-x"
                                    : "user-check"
                            }"
                        ></i>

                    </button>

                </div>

            </td>

        </tr>

    `;

}


/* =========================================================
   22. ROW ACTIONS
   ========================================================= */

function bindAdminUserRowActions() {

    document
        .querySelectorAll(
            "[data-view-user]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openAdminUserDetails(
                            button.dataset
                                .viewUser
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            "[data-toggle-user-status]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        requestAdminUserStatusChange(
                            button.dataset
                                .toggleUserStatus
                        );

                    }
                );

            }
        );

}


/* =========================================================
   23. RESULT COUNT
   ========================================================= */

function renderAdminUsersResultCount() {

    setAdminUsersText(
        "adminUsersResultCount",
        formatAdminUsersNumber(
            adminUsersState
                .filteredUsers
                .length
        )
    );

}


/* =========================================================
   24. CLEAR FILTER BUTTON
   ========================================================= */

function updateAdminUsersClearButton() {

    const active =
        Boolean(
            adminUsersState.search
        ) ||
        adminUsersState.statusFilter !==
            "ALL" ||
        adminUsersState.verificationFilter !==
            "ALL" ||
        adminUsersState.sort !==
            "NEWEST";


    const button =
        document.getElementById(
            "adminUsersClearFilters"
        );


    if (button) {

        button.hidden =
            !active;

    }

}


/* =========================================================
   25. CLEAR FILTERS
   ========================================================= */

function clearAdminUsersFilters() {

    adminUsersState.search =
        "";


    adminUsersState.statusFilter =
        "ALL";


    adminUsersState.verificationFilter =
        "ALL";


    adminUsersState.sort =
        "NEWEST";


    setAdminUsersInputValue(
        "adminUsersSearch",
        ""
    );


    setAdminUsersInputValue(
        "adminUsersVerificationFilter",
        "ALL"
    );


    setAdminUsersInputValue(
        "adminUsersSort",
        "NEWEST"
    );


    document
        .querySelectorAll(
            "[data-user-status]"
        )
        .forEach(
            (button) => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .userStatus ===
                        "ALL"
                );

            }
        );


    applyAdminUsersFilters();

}


/* =========================================================
   26. DETAILS MODAL
   ========================================================= */

function initializeAdminUsersDetailsModal() {

    document
        .getElementById(
            "closeAdminUserDetailsModal"
        )
        ?.addEventListener(
            "click",
            closeAdminUserDetails
        );


    document
        .getElementById(
            "adminUserDetailsCloseButton"
        )
        ?.addEventListener(
            "click",
            closeAdminUserDetails
        );


    const modal =
        document.getElementById(
            "adminUserDetailsModal"
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                closeAdminUserDetails();

            }

        }
    );

}


/* =========================================================
   27. OPEN USER DETAILS
   ========================================================= */

async function openAdminUserDetails(
    userId
) {

    let user =
        adminUsersState
            .users
            .find(
                (item) =>
                    item.id ===
                    userId
            );


    if (!user) {

        return;

    }


    if (
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .getAdminUser ===
            "function"
    ) {

        try {

            const response =
                await window.SKYRA_API
                    .getAdminUser(
                        userId
                    );


            const fresh =
                response?.data?.user ||
                response?.user ||
                response?.data ||
                null;


            if (fresh) {

                user =
                    normalizeAdminUser(
                        fresh
                    );


                const index =
                    adminUsersState
                        .users
                        .findIndex(
                            (item) =>
                                item.id ===
                                user.id
                        );


                if (index >= 0) {

                    adminUsersState
                        .users[index] =
                        user;

                }

            }

        } catch (error) {

            console.warn(
                "Unable to refresh customer details:",
                error
            );

        }

    }


    adminUsersState.selectedUserId =
        user.id;


    setAdminUsersText(
        "adminUserModalInitials",
        createAdminUsersInitials(
            user.name
        )
    );


    setAdminUsersText(
        "adminUserDetailsTitle",
        user.name
    );


    setAdminUsersText(
        "adminUserModalEmail",
        user.email ||
        "Email unavailable"
    );


    setAdminUsersText(
        "adminUserModalId",
        user.id
    );


    setAdminUsersText(
        "adminUserModalName",
        user.name
    );


    setAdminUsersText(
        "adminUserModalPhone",
        user.phone ||
        "Not provided"
    );


    setAdminUsersText(
        "adminUserModalLocation",
        [
            user.city,
            user.state
        ]
            .filter(Boolean)
            .join(", ") ||
        "Not provided"
    );


    setAdminUsersText(
        "adminUserModalJoined",
        formatAdminUsersDateTime(
            user.joinedAt
        )
    );


    setAdminUsersText(
        "adminUserModalBookings",
        formatAdminUsersNumber(
            user.bookingCount
        )
    );


    setAdminUsersText(
        "adminUserModalVerification",
        user.emailVerified
            ? "Verified"
            : "Unverified"
    );


    setAdminUsersText(
        "adminUserModalStatus",
        user.status ===
            "ACTIVE"
            ? "Active"
            : "Suspended"
    );


    const bookingLink =
        document.getElementById(
            "adminUserBookingsLink"
        );


    if (bookingLink) {

        bookingLink.href =
            `./bookings.html?customer=${
                encodeURIComponent(
                    user.id
                )
            }`;

    }


    const modal =
        document.getElementById(
            "adminUserDetailsModal"
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

function closeAdminUserDetails() {

    const modal =
        document.getElementById(
            "adminUserDetailsModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );


    adminUsersState.selectedUserId =
        null;

}


/* =========================================================
   29. STATUS MODAL
   ========================================================= */

function initializeAdminUsersStatusModal() {

    document
        .getElementById(
            "closeAdminUserStatusModal"
        )
        ?.addEventListener(
            "click",
            closeAdminUserStatusModal
        );


    document
        .getElementById(
            "cancelAdminUserStatusButton"
        )
        ?.addEventListener(
            "click",
            closeAdminUserStatusModal
        );


    document
        .getElementById(
            "confirmAdminUserStatusButton"
        )
        ?.addEventListener(
            "click",
            confirmAdminUserStatusChange
        );


    const modal =
        document.getElementById(
            "adminUserStatusModal"
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                closeAdminUserStatusModal();

            }

        }
    );

}


/* =========================================================
   30. REQUEST STATUS CHANGE
   ========================================================= */

function requestAdminUserStatusChange(
    userId
) {

    const user =
        adminUsersState
            .users
            .find(
                (item) =>
                    item.id ===
                    userId
            );


    if (!user) {

        return;

    }


    const nextStatus =
        user.status ===
            "ACTIVE"
            ? "SUSPENDED"
            : "ACTIVE";


    adminUsersState.pendingStatusUserId =
        user.id;


    adminUsersState.pendingStatus =
        nextStatus;


    const suspending =
        nextStatus ===
        "SUSPENDED";


    setAdminUsersText(
        "adminUserStatusModalTitle",
        suspending
            ? `Suspend ${user.name}?`
            : `Reactivate ${user.name}?`
    );


    setAdminUsersText(
        "adminUserStatusModalDescription",
        suspending
            ? "Customer login and new booking access will be restricted. Existing booking records remain preserved."
            : "Customer account access will be restored."
    );


    const icon =
        document.getElementById(
            "adminUserStatusModalIcon"
        );


    if (icon) {

        icon.className =
            `admin-user-status-modal-icon ${
                suspending
                    ? "suspend"
                    : "activate"
            }`;


        icon.innerHTML = `

            <i
                data-lucide="${
                    suspending
                        ? "user-x"
                        : "user-check"
                }"
            ></i>

        `;

    }


    const confirm =
        document.getElementById(
            "confirmAdminUserStatusButton"
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
                        ? "user-x"
                        : "user-check"
                }"
            ></i>

            ${
                suspending
                    ? "Suspend Customer"
                    : "Reactivate Customer"
            }

        `;

    }


    const modal =
        document.getElementById(
            "adminUserStatusModal"
        );


    if (modal) {

        modal.hidden =
            false;


        document.body.classList.add(
            "modal-open"
        );

    }


    refreshAdminUsersIcons();

}


/* =========================================================
   31. CONFIRM STATUS CHANGE
   ========================================================= */

async function confirmAdminUserStatusChange() {

    const userId =
        adminUsersState
            .pendingStatusUserId;


    const status =
        adminUsersState
            .pendingStatus;


    if (
        !userId ||
        !status ||
        adminUsersState
            .updating
    ) {

        return;

    }


    const user =
        adminUsersState
            .users
            .find(
                (item) =>
                    item.id ===
                    userId
            );


    if (!user) {

        closeAdminUserStatusModal();

        return;

    }


    adminUsersState.updating =
        true;


    setAdminUserStatusUpdating(
        true
    );


    try {

        const updated =
            await updateAdminUserStatus(
                userId,
                status
            );


        const normalized =
            normalizeAdminUser(
                updated
            );


        const index =
            adminUsersState
                .users
                .findIndex(
                    (item) =>
                        item.id ===
                        userId
                );


        if (
            index >=
            0
        ) {

            adminUsersState
                .users[
                    index
                ] =
            normalized;

        }


        /*
           The visible summary is adjusted immediately so the cards
           remain visually synchronized.
        */

        updateAdminUsersSummaryAfterStatusChange(
            user.status,
            normalized.status
        );


        closeAdminUserStatusModal();

        renderAdminUsersSummary();

        applyAdminUsersFilters();


        showAdminUsersToast(
            normalized.status ===
                "ACTIVE"
                ? `${normalized.name} was reactivated.`
                : `${normalized.name} was suspended.`,
            "success",
            "Account Updated"
        );

    } catch (error) {

        console.error(
            "Unable to update customer status:",
            error
        );


        showAdminUsersToast(
            error?.message ||
            "Unable to update the customer account.",
            "error",
            "Update Failed"
        );

    } finally {

        adminUsersState.updating =
            false;


        setAdminUserStatusUpdating(
            false
        );

    }

}


/* =========================================================
   32. UPDATE STATUS RECORD
   ========================================================= */

async function updateAdminUserStatus(
    userId,
    status
) {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .updateAdminUserStatus !==
            "function"
    ) {

        throw new Error(
            "Admin customer status API client is unavailable."
        );

    }


    const response =
        await window.SKYRA_API
            .updateAdminUserStatus(
                userId,
                {
                    status
                }
            );


    const user =
        response?.data?.user ||
        response?.user ||
        response?.data ||
        null;


    if (!user) {

        throw new Error(
            "Backend did not return the updated customer."
        );

    }


    return user;

}

/* =========================================================
   33. UPDATE SUMMARY AFTER STATUS
   ========================================================= */

function updateAdminUsersSummaryAfterStatusChange(
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
        adminUsersState
            .platformSummary;


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
   34. STATUS UPDATING UI
   ========================================================= */

function setAdminUserStatusUpdating(
    updating
) {

    const button =
        document.getElementById(
            "confirmAdminUserStatusButton"
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
            adminUsersState
                .pendingStatus ===
                "SUSPENDED";


        button.innerHTML = `

            <i
                data-lucide="${
                    suspending
                        ? "user-x"
                        : "user-check"
                }"
            ></i>

            ${
                suspending
                    ? "Suspend Customer"
                    : "Reactivate Customer"
            }

        `;

    }


    refreshAdminUsersIcons();

}


/* =========================================================
   35. CLOSE STATUS MODAL
   ========================================================= */

function closeAdminUserStatusModal() {

    const modal =
        document.getElementById(
            "adminUserStatusModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );


    adminUsersState.pendingStatusUserId =
        null;


    adminUsersState.pendingStatus =
        null;

}


/* =========================================================
   36. TOPBAR SEARCH
   ========================================================= */

function initializeAdminUsersTopSearch() {

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


                setAdminUsersInputValue(
                    "adminUsersSearch",
                    query
                );


                adminUsersState.search =
                    query.toLowerCase();


                applyAdminUsersFilters();

            }
        );

}


/* =========================================================
   37. STATUS NORMALIZATION
   ========================================================= */

function normalizeAdminUserStatus(
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

function formatAdminUsersDate(
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

function formatAdminUsersDateTime(
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

function getAdminUsersTimestamp(
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
   41. NUMBER FORMAT
   ========================================================= */

function formatAdminUsersNumber(
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

function createAdminUsersInitials(
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

        return "CU";

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
   43. SET INPUT VALUE
   ========================================================= */

function setAdminUsersInputValue(
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

function setAdminUsersText(
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

function escapeAdminUsersHTML(
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

function showAdminUsersToast(
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

function refreshAdminUsersIcons() {

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

window.SKYRA_ADMIN_USERS_PAGE = {

    getUsers:
        () =>
            adminUsersState
                .users
                .map(
                    (user) => ({
                        ...user
                    })
                ),

    getFilteredUsers:
        () =>
            adminUsersState
                .filteredUsers
                .map(
                    (user) => ({
                        ...user
                    })
                ),

    getUserById:
        (userId) =>
            adminUsersState
                .users
                .find(
                    (user) =>
                        user.id ===
                        userId
                ) ||
            null,

    refresh:
        loadAdminUsers

};


/* =========================================================
   END SKYRA ADMIN USERS
   ========================================================= */