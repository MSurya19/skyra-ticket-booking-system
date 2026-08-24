/* =========================================================
   SKYRA - SHARED DASHBOARD JAVASCRIPT
   File: frontend/js/common.js

   Shared by:
   - Customer pages
   - Organiser pages
   - Admin pages

   Handles:
   - Lucide icons
   - Sidebar collapse
   - Mobile sidebar
   - Profile dropdown
   - Current logged-in user display
   - Logout modal
   - Logout
   - Dashboard current year
   - Search keyboard shortcut
   - Toast notifications
   - Shared storage helpers
   - Phase 7 Organiser Event API client
   ========================================================= */

"use strict";


/* =========================================================
   1. STORAGE KEYS
   ========================================================= */

const SKYRA_COMMON_STORAGE_KEYS = {

    TOKEN:
        "skyra_token",

    USER:
        "skyra_user",

    CUSTOMER_PROFILE:
        "skyra_customer_profile",

    SIDEBAR_COLLAPSED:
        "skyra_sidebar_collapsed"

};


/* =========================================================
   AUTH / API CONFIGURATION
   ========================================================= */

const SKYRA_COMMON_API_BASE_URL =
    window.SKYRA_CONFIG?.API_BASE_URL ||
    "http://localhost:5000/api";


const SKYRA_COMMON_REALTIME_BASE_URL =
    window.SKYRA_CONFIG?.REALTIME_BASE_URL ||
    (() => {

        try {

            return new URL(
                SKYRA_COMMON_API_BASE_URL
            ).origin;

        } catch (error) {

            return "http://localhost:5000";

        }

    })();



/* =========================================================
   2. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
           Protect all Customer / Organiser / Admin pages before
           initializing the dashboard UI.
        */
        const accessAllowed =
            await protectSkyraDashboard();

        if (!accessAllowed) {
            return;
        }

        initializeCommonLucideIcons();

        initializeDashboardYear();

        initializeSidebarLabels();

        initializeSidebarState();

        initializeSidebarCollapse();

        initializeMobileSidebar();

        initializeProfileDropdown();

        initializeDashboardUser();

        refreshSkyraCustomerIndicators();

        initializeProfileUpdateSync();

        initializeLogoutSystem();

        initializeDashboardSearchShortcut();

        initializeEscapeKeyHandling();

    }
);


/* =========================================================
   3. LUCIDE ICONS
   ========================================================= */

function initializeCommonLucideIcons() {

    if (
        typeof lucide !== "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   4. CURRENT YEAR
   ========================================================= */

function initializeDashboardYear() {

    const yearElement =
        document.getElementById(
            "dashboardCurrentYear"
        );


    if (!yearElement) {
        return;
    }


    yearElement.textContent =
        new Date().getFullYear();

}


/* =========================================================
   5. SIDEBAR TOOLTIP LABELS

   dashboard.css supports:
   .sidebar-link[data-label]

   Instead of manually adding data-label to every HTML
   sidebar link, this function creates it automatically
   from .sidebar-link-text.
   ========================================================= */

function initializeSidebarLabels() {

    const sidebarLinks =
        document.querySelectorAll(
            ".sidebar-link"
        );


    sidebarLinks.forEach(
        (link) => {

            const textElement =
                link.querySelector(
                    ".sidebar-link-text"
                );


            if (!textElement) {
                return;
            }


            const label =
                textElement.textContent.trim();


            if (label) {

                link.setAttribute(
                    "data-label",
                    label
                );

            }

        }
    );

}


/* =========================================================
   6. RESTORE SIDEBAR STATE
   ========================================================= */

function initializeSidebarState() {

    const collapseButton =
        document.getElementById(
            "sidebarCollapseBtn"
        );


    /*
       Tablet / mobile always starts in the normal
       mobile-sidebar configuration.
    */

    if (
        window.innerWidth <= 1024
    ) {

        document.body.classList.remove(
            "sidebar-collapsed"
        );


        if (collapseButton) {

            updateSidebarCollapseButton(
                false
            );

        }


        return;

    }


    /*
       Restore desktop preference.
    */

    const savedState =
        localStorage.getItem(
            SKYRA_COMMON_STORAGE_KEYS
                .SIDEBAR_COLLAPSED
        );


    const collapsed =
        savedState === "true";


    document.body.classList.toggle(
        "sidebar-collapsed",
        collapsed
    );


    updateSidebarCollapseButton(
        collapsed
    );

}


/* =========================================================
   7. SIDEBAR COLLAPSE
   ========================================================= */

function initializeSidebarCollapse() {

    const collapseButton =
        document.getElementById(
            "sidebarCollapseBtn"
        );


    if (!collapseButton) {
        return;
    }


    collapseButton.addEventListener(
        "click",
        () => {

            /*
               On tablet/mobile this button is hidden.

               Still prevent desktop-collapse behaviour
               if screen size changes at an unusual moment.
            */

            if (
                window.innerWidth <= 1024
            ) {
                return;
            }


            const collapsed =
                document.body.classList.toggle(
                    "sidebar-collapsed"
                );


            localStorage.setItem(
                SKYRA_COMMON_STORAGE_KEYS
                    .SIDEBAR_COLLAPSED,

                String(collapsed)
            );


            updateSidebarCollapseButton(
                collapsed
            );

        }
    );


    /*
       Reconcile sidebar state if browser is resized.
    */

    window.addEventListener(
        "resize",
        handleDashboardResize
    );

}


/* =========================================================
   8. UPDATE SIDEBAR COLLAPSE BUTTON
   ========================================================= */

function updateSidebarCollapseButton(
    collapsed
) {

    const collapseButton =
        document.getElementById(
            "sidebarCollapseBtn"
        );


    if (!collapseButton) {
        return;
    }


    collapseButton.setAttribute(
        "aria-expanded",
        String(!collapsed)
    );


    collapseButton.setAttribute(
        "aria-label",
        collapsed
            ? "Expand sidebar"
            : "Collapse sidebar"
    );


    collapseButton.innerHTML =
        collapsed
            ? `<i data-lucide="panel-left-open"></i>`
            : `<i data-lucide="panel-left-close"></i>`;


    initializeCommonLucideIcons();

}


/* =========================================================
   9. DASHBOARD RESIZE
   ========================================================= */
function handleDashboardResize() {

    const savedState =
        localStorage.getItem(
            SKYRA_COMMON_STORAGE_KEYS
                .SIDEBAR_COLLAPSED
        );


    /*
       MOBILE / TABLET

       Desktop collapse must not interfere with the
       mobile off-canvas sidebar.
    */

    if (
        window.innerWidth <= 1024
    ) {

        closeMobileSidebar();


        document.body.classList.remove(
            "sidebar-collapsed"
        );


        updateSidebarCollapseButton(
            false
        );


        return;

    }


    /*
       DESKTOP
    */

    document.body.classList.remove(
        "mobile-sidebar-open"
    );


    document.body.style.overflow =
        "";


    const collapsed =
        savedState === "true";


    document.body.classList.toggle(
        "sidebar-collapsed",
        collapsed
    );


    updateSidebarCollapseButton(
        collapsed
    );

}

/* =========================================================
   10. MOBILE SIDEBAR
   ========================================================= */

function initializeMobileSidebar() {

    const openButton =
        document.getElementById(
            "mobileSidebarButton"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (openButton) {

        openButton.addEventListener(
            "click",
            () => {

                if (
                    document.body.classList.contains(
                        "mobile-sidebar-open"
                    )
                ) {

                    closeMobileSidebar();

                } else {

                    openMobileSidebar();

                }

            }
        );

    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeMobileSidebar
        );

    }


    /*
       Close sidebar when user selects a page.
    */

    const navigationLinks =
        document.querySelectorAll(
            ".sidebar-nav .sidebar-link"
        );


    navigationLinks.forEach(
        (link) => {

            link.addEventListener(
                "click",
                () => {

                    if (
                        window.innerWidth <= 1024
                    ) {

                        closeMobileSidebar();

                    }

                }
            );

        }
    );

}


/* =========================================================
   11. OPEN MOBILE SIDEBAR
   ========================================================= */

function openMobileSidebar() {

    document.body.classList.add(
        "mobile-sidebar-open"
    );


    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    const menuButton =
        document.getElementById(
            "mobileSidebarButton"
        );


    if (overlay) {

        overlay.setAttribute(
            "aria-hidden",
            "false"
        );

    }


    if (menuButton) {

        menuButton.setAttribute(
            "aria-expanded",
            "true"
        );

    }


    /*
       Prevent page content scrolling while
       mobile navigation is open.
    */

    document.body.style.overflow =
        "hidden";

}


/* =========================================================
   12. CLOSE MOBILE SIDEBAR
   ========================================================= */

function closeMobileSidebar() {

    document.body.classList.remove(
        "mobile-sidebar-open"
    );


    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    const menuButton =
        document.getElementById(
            "mobileSidebarButton"
        );


    if (overlay) {

        overlay.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    if (menuButton) {

        menuButton.setAttribute(
            "aria-expanded",
            "false"
        );

    }


    document.body.style.overflow =
        "";

}


/* =========================================================
   13. PROFILE DROPDOWN
   ========================================================= */

function initializeProfileDropdown() {

    const profileButton =
        document.getElementById(
            "profileMenuButton"
        );

    const profileDropdown =
        document.getElementById(
            "profileDropdown"
        );


    if (
        !profileButton ||
        !profileDropdown
    ) {
        return;
    }


    /* Toggle */

    profileButton.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();


            const currentlyOpen =
                !profileDropdown.hidden;


            if (currentlyOpen) {

                closeProfileDropdown();

            } else {

                openProfileDropdown();

            }

        }
    );


    /* Clicking dropdown itself shouldn't close it */

    profileDropdown.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

        }
    );


    /* Outside click */

    document.addEventListener(
        "click",
        () => {

            closeProfileDropdown();

        }
    );

}


/* =========================================================
   14. OPEN PROFILE DROPDOWN
   ========================================================= */

function openProfileDropdown() {

    const profileButton =
        document.getElementById(
            "profileMenuButton"
        );

    const profileDropdown =
        document.getElementById(
            "profileDropdown"
        );


    if (
        !profileButton ||
        !profileDropdown
    ) {
        return;
    }


    profileDropdown.hidden =
        false;


    profileButton.setAttribute(
        "aria-expanded",
        "true"
    );


    initializeCommonLucideIcons();

}


/* =========================================================
   15. CLOSE PROFILE DROPDOWN
   ========================================================= */

function closeProfileDropdown() {

    const profileButton =
        document.getElementById(
            "profileMenuButton"
        );

    const profileDropdown =
        document.getElementById(
            "profileDropdown"
        );


    if (
        !profileButton ||
        !profileDropdown
    ) {
        return;
    }


    profileDropdown.hidden =
        true;


    profileButton.setAttribute(
        "aria-expanded",
        "false"
    );

}


/* =========================================================
   16. DASHBOARD AUTH / ROLE PROTECTION
   ========================================================= */

function getSkyraRequiredRoleFromPath() {

    const path =
        window.location.pathname.toLowerCase();


    if (path.includes("/customer/")) {
        return "CUSTOMER";
    }


    if (path.includes("/organiser/")) {
        return "ORGANISER";
    }


    if (path.includes("/admin/")) {
        return "ADMIN";
    }


    return null;

}


function getSkyraDashboardPathForRole(role) {

    const normalizedRole =
        String(role || "").toUpperCase();


    if (normalizedRole === "CUSTOMER") {
        return "/customer/dashboard.html";
    }


    if (normalizedRole === "ORGANISER") {
        return "/organiser/dashboard.html";
    }


    if (normalizedRole === "ADMIN") {
        return "/admin/dashboard.html";
    }


    return "/login.html";

}


function clearSkyraAuthentication() {

    localStorage.removeItem(
        SKYRA_COMMON_STORAGE_KEYS.TOKEN
    );

    localStorage.removeItem(
        SKYRA_COMMON_STORAGE_KEYS.USER
    );


    sessionStorage.removeItem(
        SKYRA_COMMON_STORAGE_KEYS.TOKEN
    );

    sessionStorage.removeItem(
        SKYRA_COMMON_STORAGE_KEYS.USER
    );

}


function storeSkyraAuthenticatedUser(user) {

    const serializedUser =
        JSON.stringify(user);


    if (
        localStorage.getItem(
            SKYRA_COMMON_STORAGE_KEYS.TOKEN
        )
    ) {

        localStorage.setItem(
            SKYRA_COMMON_STORAGE_KEYS.USER,
            serializedUser
        );

        sessionStorage.removeItem(
            SKYRA_COMMON_STORAGE_KEYS.USER
        );

        return;

    }


    if (
        sessionStorage.getItem(
            SKYRA_COMMON_STORAGE_KEYS.TOKEN
        )
    ) {

        sessionStorage.setItem(
            SKYRA_COMMON_STORAGE_KEYS.USER,
            serializedUser
        );

        localStorage.removeItem(
            SKYRA_COMMON_STORAGE_KEYS.USER
        );

    }

}


async function protectSkyraDashboard() {

    const requiredRole =
        getSkyraRequiredRoleFromPath();


    if (!requiredRole) {
        return true;
    }


    const token =
        getSkyraAuthToken();


    if (!token) {

        clearSkyraAuthentication();

        window.location.replace(
            "/login.html"
        );

        return false;

    }


    try {

        const response =
            await fetch(
                `${SKYRA_COMMON_API_BASE_URL}/auth/me`,
                {
                    method:
                        "GET",

                    headers: {
                        Authorization:
                            `Bearer ${token}`,
                        Accept:
                            "application/json"
                    }
                }
            );


        let data =
            null;


        try {

            data =
                await response.json();

        } catch (error) {

            data =
                null;

        }


        if (!response.ok) {

            clearSkyraAuthentication();

            window.location.replace(
                "/login.html"
            );

            return false;

        }


        const payload =
            data?.data ||
            data;


        const user =
            payload?.user ||
            payload;


        const actualRole =
            String(
                user?.role ||
                ""
            ).toUpperCase();


        if (
            !user ||
            !["CUSTOMER", "ORGANISER", "ADMIN"]
                .includes(actualRole)
        ) {

            clearSkyraAuthentication();

            window.location.replace(
                "/login.html"
            );

            return false;

        }


        storeSkyraAuthenticatedUser(
            user
        );


        if (actualRole !== requiredRole) {

            window.location.replace(
                getSkyraDashboardPathForRole(
                    actualRole
                )
            );

            return false;

        }


        return true;

    } catch (error) {

        console.error(
            "Unable to verify SKYRA dashboard session:",
            error
        );


        clearSkyraAuthentication();

        window.location.replace(
            "/login.html"
        );

        return false;

    }

}


/* =========================================================
   17. GET AUTH TOKEN
   ========================================================= */

function getSkyraAuthToken() {

    return (
        localStorage.getItem(
            SKYRA_COMMON_STORAGE_KEYS.TOKEN
        )
        ||
        sessionStorage.getItem(
            SKYRA_COMMON_STORAGE_KEYS.TOKEN
        )
    );

}


/* =========================================================
   17. GET STORED USER
   Account data is synchronized from GET /api/auth/me by
   protectSkyraDashboard(). No customer profile override is
   merged into authentication data.
   ========================================================= */
function getSkyraStoredUser() {
    const storedUser =
        localStorage.getItem(SKYRA_COMMON_STORAGE_KEYS.USER) ||
        sessionStorage.getItem(SKYRA_COMMON_STORAGE_KEYS.USER);

    if (!storedUser) return null;

    try {
        return JSON.parse(storedUser);
    } catch (error) {
        console.warn("Unable to read SKYRA user data:", error);
        return null;
    }
}

/* =========================================================
   18. PROFILE UPDATE SYNC

   profile.js dispatches `skyra:profile-updated` after a
   successful save. Re-render the shared sidebar/topbar user
   immediately without requiring a page refresh.
   ========================================================= */

function initializeProfileUpdateSync() {

    window.addEventListener(
        "skyra:profile-updated",
        () => {

            initializeDashboardUser();

        }
    );

}


/* =========================================================
   18. INITIALIZE DASHBOARD USER
   ========================================================= */

function initializeDashboardUser() {

    const storedUser =
        getSkyraStoredUser();


    /*
       protectSkyraDashboard() already verifies the JWT and
       refreshes skyra_user before this function runs.
    */

    if (!storedUser) {
        return;
    }


    const name =
        String(
            storedUser.name ||
            storedUser.fullName ||
            "SKYRA User"
        ).trim();


    const email =
        String(
            storedUser.email ||
            ""
        ).trim();


    const initials =
        createUserInitials(
            name
        );


    const firstName =
        getUserFirstName(
            name
        );


    /* Sidebar */

    setTextContent(
        "sidebarUserName",
        name
    );


    setTextContent(
        "sidebarUserInitials",
        initials
    );


    /* Topbar */

    setTextContent(
        "topbarUserName",
        name
    );


    setTextContent(
        "topbarUserInitials",
        initials
    );


    /* Dropdown */

    setTextContent(
        "dropdownUserName",
        name
    );


    setTextContent(
        "dropdownUserInitials",
        initials
    );


    if (email) {

        setTextContent(
            "dropdownUserEmail",
            email
        );

    }


    /* Customer dashboard greeting */

    setTextContent(
        "dashboardFirstName",
        firstName
    );

}


/* =========================================================
   19. CREATE USER INITIALS
   ========================================================= */

function createUserInitials(
    name
) {

    const cleanedName =
        String(name || "")
            .trim();


    if (!cleanedName) {
        return "SK";
    }


    const parts =
        cleanedName
            .split(/\s+/)
            .filter(Boolean);


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
   20. GET FIRST NAME
   ========================================================= */

function getUserFirstName(
    name
) {

    const cleanedName =
        String(name || "")
            .trim();


    if (!cleanedName) {
        return "Customer";
    }


    return (
        cleanedName
            .split(/\s+/)[0]
    );

}


/* =========================================================
   21. SAFE TEXT SETTER
   ========================================================= */

function setTextContent(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {
        return;
    }


    element.textContent =
        value;

}


/* =========================================================
   22. LOGOUT SYSTEM
   ========================================================= */

function initializeLogoutSystem() {

    const sidebarLogout =
        document.getElementById(
            "sidebarLogoutButton"
        );

    const profileLogout =
        document.getElementById(
            "profileLogoutButton"
        );

    const closeModal =
        document.getElementById(
            "closeLogoutModal"
        );

    const cancelLogout =
        document.getElementById(
            "cancelLogoutButton"
        );

    const confirmLogout =
        document.getElementById(
            "confirmLogoutButton"
        );

    const modal =
        document.getElementById(
            "logoutModal"
        );


    sidebarLogout?.addEventListener(
        "click",
        openLogoutModal
    );


    profileLogout?.addEventListener(
        "click",
        () => {

            closeProfileDropdown();

            openLogoutModal();

        }
    );


    closeModal?.addEventListener(
        "click",
        closeLogoutModal
    );


    cancelLogout?.addEventListener(
        "click",
        closeLogoutModal
    );


    confirmLogout?.addEventListener(
        "click",
        performSkyraLogout
    );


    /*
       Clicking modal background closes modal.
    */

    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target === modal
            ) {

                closeLogoutModal();

            }

        }
    );

}


/* =========================================================
   23. OPEN LOGOUT MODAL
   ========================================================= */

function openLogoutModal() {

    const modal =
        document.getElementById(
            "logoutModal"
        );


    if (!modal) {

        /*
           Fallback if a future dashboard page
           doesn't include the confirmation modal.
        */

        performSkyraLogout();

        return;

    }


    closeProfileDropdown();

    closeMobileSidebar();


    modal.hidden =
        false;


    document.body.style.overflow =
        "hidden";


    initializeCommonLucideIcons();


    const cancelButton =
        document.getElementById(
            "cancelLogoutButton"
        );


    window.setTimeout(
        () => {

            cancelButton?.focus();

        },
        50
    );

}


/* =========================================================
   24. CLOSE LOGOUT MODAL
   ========================================================= */

function closeLogoutModal() {

    const modal =
        document.getElementById(
            "logoutModal"
        );


    if (!modal) {
        return;
    }


    modal.hidden =
        true;


    document.body.style.overflow =
        "";

}


/* =========================================================
   25. PERFORM LOGOUT
   ========================================================= */

function performSkyraLogout() {

    /*
       Remove only authentication information.

       We intentionally keep harmless user preferences
       such as sidebar collapse state.
    */

    clearSkyraAuthentication();


    closeLogoutModal();


    /*
       All Customer / Organiser / Admin pages are
       currently one folder below frontend/, so ../login.html
       correctly reaches the shared login page.
    */

    window.location.href =
        "/login.html";

}


/* =========================================================
   26. DASHBOARD SEARCH SHORTCUT
   Press "/" to focus search.
   ========================================================= */

function initializeDashboardSearchShortcut() {

    const searchInput =
        document.getElementById(
            "dashboardSearch"
        );


    if (!searchInput) {
        return;
    }


    document.addEventListener(
        "keydown",
        (event) => {

            /*
               Do not activate shortcut while user
               is already typing inside an input.
            */

            const activeElement =
                document.activeElement;


            const typingElement =
                activeElement &&
                (
                    activeElement.tagName === "INPUT"
                    ||
                    activeElement.tagName === "TEXTAREA"
                    ||
                    activeElement.tagName === "SELECT"
                    ||
                    activeElement.isContentEditable
                );


            if (typingElement) {
                return;
            }


            if (
                event.key === "/"
            ) {

                event.preventDefault();


                searchInput.focus();

            }

        }
    );

}


/* =========================================================
   27. ESCAPE KEY HANDLING
   ========================================================= */

function initializeEscapeKeyHandling() {

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key !== "Escape"
            ) {
                return;
            }


            closeProfileDropdown();


            if (
                document.body.classList.contains(
                    "mobile-sidebar-open"
                )
            ) {

                closeMobileSidebar();

            }


            const logoutModal =
                document.getElementById(
                    "logoutModal"
                );


            if (
                logoutModal &&
                !logoutModal.hidden
            ) {

                closeLogoutModal();

            }

        }
    );

}


/* =========================================================
   28. TOAST SYSTEM
   ========================================================= */

function showDashboardToast(
    message,
    type = "info",
    title = null,
    duration = 3200
) {

    let container =
        document.getElementById(
            "toastContainer"
        );


    if (!container) {

        container =
            document.createElement(
                "div"
            );


        container.id =
            "toastContainer";


        container.className =
            "toast-container";


        container.setAttribute(
            "aria-live",
            "polite"
        );


        document.body.appendChild(
            container
        );

    }


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `dashboard-toast ${type}`;


    const icon =
        getDashboardToastIcon(
            type
        );


    const toastTitle =
        title ||
        getDashboardToastTitle(
            type
        );


    toast.innerHTML = `

        <div class="dashboard-toast-icon">

            <i data-lucide="${icon}"></i>

        </div>


        <div class="dashboard-toast-content">

            <strong></strong>

            <span></span>

        </div>


        <button
            type="button"
            class="dashboard-toast-close"
            aria-label="Close notification"
        >

            <i data-lucide="x"></i>

        </button>

    `;


    const titleElement =
        toast.querySelector(
            ".dashboard-toast-content strong"
        );


    const messageElement =
        toast.querySelector(
            ".dashboard-toast-content span"
        );


    if (titleElement) {

        titleElement.textContent =
            toastTitle;

    }


    if (messageElement) {

        messageElement.textContent =
            message;

    }


    container.appendChild(
        toast
    );


    initializeCommonLucideIcons();


    const closeButton =
        toast.querySelector(
            ".dashboard-toast-close"
        );


    closeButton?.addEventListener(
        "click",
        () => {

            removeDashboardToast(
                toast
            );

        }
    );


    if (
        Number.isFinite(duration) &&
        duration > 0
    ) {

        window.setTimeout(
            () => {

                removeDashboardToast(
                    toast
                );

            },
            duration
        );

    }


    return toast;

}


/* =========================================================
   29. TOAST ICON
   ========================================================= */

function getDashboardToastIcon(
    type
) {

    const icons = {

        success:
            "circle-check",

        warning:
            "triangle-alert",

        error:
            "circle-x",

        info:
            "info"

    };


    return (
        icons[type] ||
        icons.info
    );

}


/* =========================================================
   30. TOAST TITLE
   ========================================================= */

function getDashboardToastTitle(
    type
) {

    const titles = {

        success:
            "Success",

        warning:
            "Attention",

        error:
            "Something went wrong",

        info:
            "SKYRA"

    };


    return (
        titles[type] ||
        titles.info
    );

}


/* =========================================================
   31. REMOVE TOAST
   ========================================================= */

function removeDashboardToast(
    toast
) {

    if (
        !toast ||
        !toast.isConnected
    ) {
        return;
    }


    toast.style.transition =
        "opacity 180ms ease, transform 180ms ease";


    toast.style.opacity =
        "0";


    toast.style.transform =
        "translateX(18px)";


    window.setTimeout(
        () => {

            toast.remove();

        },
        190
    );

}


/* =========================================================
   32. FORMAT CURRENCY

   Useful across customer, organiser and admin pages.
   ========================================================= */

function formatSkyraCurrency(
    amount
) {

    const numericAmount =
        Number(amount);


    if (
        !Number.isFinite(
            numericAmount
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
        numericAmount
    );

}


/* =========================================================
   33. FORMAT DATE
   ========================================================= */

function formatSkyraDate(
    dateValue,
    options = {}
) {

    if (!dateValue) {
        return "";
    }


    const date =
        new Date(
            dateValue
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(
            dateValue
        );

    }


    const defaultOptions = {

        day:
            "2-digit",

        month:
            "short",

        year:
            "numeric"

    };


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            ...defaultOptions,
            ...options
        }
    ).format(
        date
    );

}


/* =========================================================
   34. FORMAT DATE + TIME
   ========================================================= */

function formatSkyraDateTime(
    dateValue
) {

    if (!dateValue) {
        return "";
    }


    const date =
        new Date(
            dateValue
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(
            dateValue
        );

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
                "numeric",

            minute:
                "2-digit"

        }
    ).format(
        date
    );

}


/* =========================================================
   35. DEBOUNCE

   Useful for:
   - Search
   - Filters
   - API requests
   ========================================================= */

function debounceSkyra(
    callback,
    delay = 300
) {

    let timer = null;


    return function (
        ...args
    ) {

        clearTimeout(
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
   36. SAFE LOCAL STORAGE
   ========================================================= */

function setSkyraLocalStorage(
    key,
    value
) {

    try {

        localStorage.setItem(
            key,
            typeof value === "string"
                ? value
                : JSON.stringify(value)
        );


        return true;

    } catch (error) {

        console.warn(
            `Unable to save ${key}:`,
            error
        );


        return false;

    }

}


/* =========================================================
   37. SAFE STORAGE JSON READER
   ========================================================= */

function getSkyraLocalJSON(
    key,
    fallback = null
) {

    try {

        const value =
            localStorage.getItem(
                key
            );


        if (value === null) {

            return fallback;

        }


        return JSON.parse(
            value
        );

    } catch (error) {

        console.warn(
            `Unable to read ${key}:`,
            error
        );


        return fallback;

    }

}


/* =========================================================
   38. ACTIVE SIDEBAR NAVIGATION

   Automatically marks the sidebar link corresponding
   to the current HTML page.
   ========================================================= */

function updateActiveSidebarLink() {

    const links =
        document.querySelectorAll(
            ".sidebar-nav .sidebar-link[href]"
        );


    if (!links.length) {
        return;
    }


    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    links.forEach(
        (link) => {

            const href =
                link
                    .getAttribute("href")
                    ?.split("?")[0]
                    ?.split("#")[0]
                    ?.split("/")
                    .pop()
                    ?.toLowerCase();


            const active =
                href === currentPage;


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
   39. INITIALIZE ACTIVE LINK

   Run after DOM initialization.
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    updateActiveSidebarLink
);


/* =========================================================
   40. SKYRA API CLIENT

   Shared frontend -> backend communication layer.

   Current backend:
   http://localhost:5000/api

   Authentication:
   JWT is automatically read from the existing SKYRA
   authentication storage and attached as a Bearer token.

   Admin Venue pages already expect:
   window.SKYRA_API.getAdminVenues()
   window.SKYRA_API.getAdminVenue()
   window.SKYRA_API.createAdminVenue()
   window.SKYRA_API.updateAdminVenue()

   Phase 6 Seat Layout expects:
   window.SKYRA_API.getAdminVenueSeats()
   window.SKYRA_API.saveAdminVenueSeatLayout()

   Phase 7 Organiser Event pages expect:
   window.SKYRA_API.createEvent()
   window.SKYRA_API.getOrganiserEvents()
   window.SKYRA_API.getEvent()
   window.SKYRA_API.updateEvent()
   window.SKYRA_API.deleteEvent()

   Phase 8 Organiser Show pages expect:
   window.SKYRA_API.getOrganiserShowVenues()
   window.SKYRA_API.getOrganiserShowVenue()
   window.SKYRA_API.createShow()
   window.SKYRA_API.getOrganiserShows()
   window.SKYRA_API.getShow()
   window.SKYRA_API.updateShow()
   window.SKYRA_API.cancelShow()

   Phase 9 ShowSeat APIs expect:
   window.SKYRA_API.getShowSeats()
   window.SKYRA_API.generateShowSeats()

   Phase 10 Customer Event / Show APIs expect:
   window.SKYRA_API.getCustomerEvents()
   window.SKYRA_API.getCustomerEvent()
   window.SKYRA_API.getCustomerEventShows()
   window.SKYRA_API.getCustomerShow()
   window.SKYRA_API.getCustomerShowSeats()
   ========================================================= */


/* =========================================================
   40.1 SHARED API REQUEST HELPER
   ========================================================= */

async function skyraApiRequest(
    endpoint,
    options = {}
) {

    const token =
        getSkyraAuthToken();


    const requestOptions = {
        ...options
    };


    const headers = {
        Accept:
            "application/json",
        ...(options.headers || {})
    };


    /*
       Add JSON Content-Type only when a request body exists
       and the caller has not already supplied a content type.
    */
    if (
        requestOptions.body !== undefined &&
        requestOptions.body !== null &&
        !headers["Content-Type"] &&
        !headers["content-type"]
    ) {

        headers["Content-Type"] =
            "application/json";

    }


    /*
       Attach the currently logged-in user's JWT.
    */
    if (token) {

        headers.Authorization =
            `Bearer ${token}`;

    }


    requestOptions.headers =
        headers;


    const response =
        await fetch(
            `${SKYRA_COMMON_API_BASE_URL}${endpoint}`,
            requestOptions
        );


    /*
       SKYRA backend responses are JSON. Parse safely so a
       malformed/non-JSON server response still produces a
       useful frontend error.
    */
    let result =
        null;


    const responseText =
        await response.text();


    if (responseText) {

        try {

            result =
                JSON.parse(
                    responseText
                );

        } catch (error) {

            result = {
                message:
                    responseText
            };

        }

    }


    /*
       Convert all HTTP 4xx / 5xx responses into JavaScript
       errors while preserving backend validation details.
    */
    if (!response.ok) {

        const apiError =
            new Error(
                result?.message ||
                `Request failed with status ${response.status}.`
            );


        apiError.name =
            "SkyraApiError";


        apiError.status =
            response.status;


        apiError.errors =
            Array.isArray(
                result?.errors
            )
                ? result.errors
                : [];


        apiError.response =
            result;


        throw apiError;

    }


    return result;

}


/* =========================================================
   40.2 ADMIN VENUE API
   ========================================================= */


/*
   GET /api/admin/venues

   Optional query object:
   {
       search,
       status,
       type,
       city,
       page,
       limit
   }
*/
async function getAdminVenues(
    query = {}
) {

    const searchParams =
        new URLSearchParams();


    Object.entries(
        query || {}
    ).forEach(
        ([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                String(
                    value
                ).trim() !== ""
            ) {

                searchParams.set(
                    key,
                    String(
                        value
                    )
                );

            }

        }
    );


    const queryString =
        searchParams.toString();


    return skyraApiRequest(
        `/admin/venues${
            queryString
                ? `?${queryString}`
                : ""
        }`,
        {
            method:
                "GET"
        }
    );

}


/*
   GET /api/admin/venues/:venueId
*/
async function getAdminVenue(
    venueId
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/venues/${encodeURIComponent(
            normalizedVenueId
        )}`,
        {
            method:
                "GET"
        }
    );

}


/*
   POST /api/admin/venues
*/
async function createAdminVenue(
    venueData
) {

    if (
        !venueData ||
        typeof venueData !==
            "object"
    ) {

        throw new Error(
            "Venue data is required."
        );

    }


    return skyraApiRequest(
        "/admin/venues",
        {
            method:
                "POST",

            body:
                JSON.stringify(
                    venueData
                )
        }
    );

}


/*
   PATCH /api/admin/venues/:venueId
*/
async function updateAdminVenue(
    venueId,
    venueData
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    if (
        !venueData ||
        typeof venueData !==
            "object"
    ) {

        throw new Error(
            "Venue update data is required."
        );

    }


    return skyraApiRequest(
        `/admin/venues/${encodeURIComponent(
            normalizedVenueId
        )}`,
        {
            method:
                "PATCH",

            body:
                JSON.stringify(
                    venueData
                )
        }
    );

}


/*
   DELETE /api/admin/venues/:venueId

   The backend performs a soft delete.
*/
async function deleteAdminVenue(
    venueId
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/venues/${encodeURIComponent(
            normalizedVenueId
        )}`,
        {
            method:
                "DELETE"
        }
    );

}


/*
   GET /api/admin/venues/summary
*/
async function getAdminVenueSummary() {

    return skyraApiRequest(
        "/admin/venues/summary",
        {
            method:
                "GET"
        }
    );

}


/* =========================================================
   PHASE 5 - ADMIN SEAT CATEGORY API
   ========================================================= */


/*
   POST
   /api/admin/venues/:venueId/categories
*/
async function createAdminSeatCategory(
    venueId,
    categoryData
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    if (
        !categoryData ||
        typeof categoryData !==
            "object"
    ) {

        throw new Error(
            "Seat category data is required."
        );

    }


    return skyraApiRequest(
        `/admin/venues/${encodeURIComponent(
            normalizedVenueId
        )}/categories`,
        {
            method:
                "POST",

            body:
                JSON.stringify(
                    categoryData
                )
        }
    );

}


/*
   PATCH
   /api/admin/venues/:venueId/categories/:categoryId
*/
async function updateAdminSeatCategory(
    venueId,
    categoryId,
    categoryData
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    const normalizedCategoryId =
        String(
            categoryId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    if (!normalizedCategoryId) {

        throw new Error(
            "Seat category ID is required."
        );

    }


    if (
        !categoryData ||
        typeof categoryData !==
            "object"
    ) {

        throw new Error(
            "Seat category update data is required."
        );

    }


    return skyraApiRequest(
        `/admin/venues/${encodeURIComponent(
            normalizedVenueId
        )}/categories/${encodeURIComponent(
            normalizedCategoryId
        )}`,
        {
            method:
                "PATCH",

            body:
                JSON.stringify(
                    categoryData
                )
        }
    );

}


/*
   DELETE
   /api/admin/venues/:venueId/categories/:categoryId
*/
async function deleteAdminSeatCategory(
    venueId,
    categoryId
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    const normalizedCategoryId =
        String(
            categoryId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    if (!normalizedCategoryId) {

        throw new Error(
            "Seat category ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/venues/${encodeURIComponent(
            normalizedVenueId
        )}/categories/${encodeURIComponent(
            normalizedCategoryId
        )}`,
        {
            method:
                "DELETE"
        }
    );

}


/* =========================================================
   PHASE 6 - ADMIN PHYSICAL SEAT LAYOUT API
   ========================================================= */


/*
   GET
   /api/admin/venues/:venueId/seats

   Returns the permanent physical Seat records for one Venue.
*/
async function getAdminVenueSeats(
    venueId
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/venues/${encodeURIComponent(
            normalizedVenueId
        )}/seats`,
        {
            method:
                "GET"
        }
    );

}


/*
   PUT
   /api/admin/venues/:venueId/seat-layout

   The backend expects the COMPLETE desired physical layout.

   Example:

   [
       {
           row: "A",
           number: 1,
           label: "A1",
           categoryId: "...",
           active: true
       }
   ]

   Important:
   - [] intentionally clears the Venue layout.
   - The backend ignores client-generated Seat IDs.
   - Venue capacity/category capacities are recalculated by
     the backend from physical Seat records.
*/
async function saveAdminVenueSeatLayout(
    venueId,
    seats
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    if (
        !Array.isArray(
            seats
        )
    ) {

        throw new Error(
            "Seat layout must be an array."
        );

    }


    return skyraApiRequest(
        `/admin/venues/${encodeURIComponent(
            normalizedVenueId
        )}/seat-layout`,
        {
            method:
                "PUT",

            body:
                JSON.stringify(
                    seats
                )
        }
    );

}


/* =========================================================
   PHASE 7 - ORGANISER EVENT MANAGEMENT API

   Backend base:
   /api/organiser/events

   Event is separate from Show.
   Venue/date/time/pricing are handled in Phase 8.
   ========================================================= */


/*
   POST
   /api/organiser/events
*/
async function createEvent(
    eventData
) {

    if (
        !eventData ||
        typeof eventData !==
            "object" ||
        Array.isArray(
            eventData
        )
    ) {

        throw new Error(
            "Event data is required."
        );

    }


    return skyraApiRequest(
        "/organiser/events",
        {
            method:
                "POST",

            body:
                JSON.stringify(
                    eventData
                )
        }
    );

}


/*
   GET
   /api/organiser/events

   Optional query:
   {
       search,
       status,
       type,
       sort,
       page,
       limit
   }
*/
async function getOrganiserEvents(
    query = {}
) {

    const searchParams =
        new URLSearchParams();


    Object.entries(
        query || {}
    ).forEach(
        ([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                String(
                    value
                ).trim() !== ""
            ) {

                searchParams.set(
                    key,
                    String(
                        value
                    )
                );

            }

        }
    );


    const queryString =
        searchParams.toString();


    return skyraApiRequest(
        `/organiser/events${
            queryString
                ? `?${queryString}`
                : ""
        }`,
        {
            method:
                "GET"
        }
    );

}


/*
   GET
   /api/organiser/events/:eventId
*/
async function getEvent(
    eventId
) {

    const normalizedEventId =
        String(
            eventId || ""
        ).trim();


    if (!normalizedEventId) {

        throw new Error(
            "Event ID is required."
        );

    }


    return skyraApiRequest(
        `/organiser/events/${encodeURIComponent(
            normalizedEventId
        )}`,
        {
            method:
                "GET"
        }
    );

}


/*
   PATCH
   /api/organiser/events/:eventId
*/
async function updateEvent(
    eventId,
    eventData
) {

    const normalizedEventId =
        String(
            eventId || ""
        ).trim();


    if (!normalizedEventId) {

        throw new Error(
            "Event ID is required."
        );

    }


    if (
        !eventData ||
        typeof eventData !==
            "object" ||
        Array.isArray(
            eventData
        )
    ) {

        throw new Error(
            "Event update data is required."
        );

    }


    return skyraApiRequest(
        `/organiser/events/${encodeURIComponent(
            normalizedEventId
        )}`,
        {
            method:
                "PATCH",

            body:
                JSON.stringify(
                    eventData
                )
        }
    );

}


/*
   DELETE
   /api/organiser/events/:eventId

   Phase 7 backend performs a soft delete.
*/
async function deleteEvent(
    eventId
) {

    const normalizedEventId =
        String(
            eventId || ""
        ).trim();


    if (!normalizedEventId) {

        throw new Error(
            "Event ID is required."
        );

    }


    return skyraApiRequest(
        `/organiser/events/${encodeURIComponent(
            normalizedEventId
        )}`,
        {
            method:
                "DELETE"
        }
    );

}





/* =========================================================
   PHASE 8 - ORGANISER SHOW MANAGEMENT API

   Backend base:
   /api/organiser/shows

   Show = scheduled occurrence of a published Event.
   Venue/date/time/category pricing are configured here.
   ShowSeat generation remains Phase 9.
   ========================================================= */


/*
   GET
   /api/organiser/shows/venues
*/
async function getOrganiserShowVenues() {

    return skyraApiRequest(
        "/organiser/shows/venues",
        {
            method:
                "GET"
        }
    );

}


/*
   GET
   /api/organiser/shows/venues/:venueId
*/
async function getOrganiserShowVenue(
    venueId
) {

    const normalizedVenueId =
        String(
            venueId || ""
        ).trim();


    if (!normalizedVenueId) {

        throw new Error(
            "Venue ID is required."
        );

    }


    return skyraApiRequest(
        `/organiser/shows/venues/${encodeURIComponent(
            normalizedVenueId
        )}`,
        {
            method:
                "GET"
        }
    );

}


/*
   POST
   /api/organiser/shows
*/
async function createShow(
    showData
) {

    if (
        !showData ||
        typeof showData !==
            "object" ||
        Array.isArray(
            showData
        )
    ) {

        throw new Error(
            "Show data is required."
        );

    }


    return skyraApiRequest(
        "/organiser/shows",
        {
            method:
                "POST",

            body:
                JSON.stringify(
                    showData
                )
        }
    );

}


/*
   GET
   /api/organiser/shows

   Optional query:
   {
       search,
       status,
       eventId,
       venueId,
       sort,
       page,
       limit
   }
*/
async function getOrganiserShows(
    query = {}
) {

    const searchParams =
        new URLSearchParams();


    Object.entries(
        query || {}
    ).forEach(
        ([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                String(
                    value
                ).trim() !== ""
            ) {

                searchParams.set(
                    key,
                    String(
                        value
                    )
                );

            }

        }
    );


    const queryString =
        searchParams.toString();


    return skyraApiRequest(
        `/organiser/shows${
            queryString
                ? `?${queryString}`
                : ""
        }`,
        {
            method:
                "GET"
        }
    );

}


/*
   GET
   /api/organiser/shows/:showId
*/
async function getShow(
    showId
) {

    const normalizedShowId =
        String(
            showId || ""
        ).trim();


    if (!normalizedShowId) {

        throw new Error(
            "Show ID is required."
        );

    }


    return skyraApiRequest(
        `/organiser/shows/${encodeURIComponent(
            normalizedShowId
        )}`,
        {
            method:
                "GET"
        }
    );

}


/*
   PATCH
   /api/organiser/shows/:showId
*/
async function updateShow(
    showId,
    showData
) {

    const normalizedShowId =
        String(
            showId || ""
        ).trim();


    if (!normalizedShowId) {

        throw new Error(
            "Show ID is required."
        );

    }


    if (
        !showData ||
        typeof showData !==
            "object" ||
        Array.isArray(
            showData
        )
    ) {

        throw new Error(
            "Show update data is required."
        );

    }


    return skyraApiRequest(
        `/organiser/shows/${encodeURIComponent(
            normalizedShowId
        )}`,
        {
            method:
                "PATCH",

            body:
                JSON.stringify(
                    showData
                )
        }
    );

}


/*
   PATCH
   /api/organiser/shows/:showId/cancel
*/
async function cancelShow(
    showId,
    cancellationData = {}
) {

    const normalizedShowId =
        String(
            showId || ""
        ).trim();


    if (!normalizedShowId) {

        throw new Error(
            "Show ID is required."
        );

    }


    const body =
        (
            cancellationData &&
            typeof cancellationData ===
                "object" &&
            !Array.isArray(
                cancellationData
            )
        )
            ? cancellationData
            : {
                reason:
                    String(
                        cancellationData || ""
                    ).trim()
            };


    return skyraApiRequest(
        `/organiser/shows/${encodeURIComponent(
            normalizedShowId
        )}/cancel`,
        {
            method:
                "PATCH",

            body:
                JSON.stringify(
                    body
                )
        }
    );

}




/* =========================================================
   PHASE 9 - SHOWSEAT API

   Backend:
   GET  /api/organiser/shows/:showId/seats
   POST /api/organiser/shows/:showId/generate-seats

   Notes:
   - New Shows generate ShowSeats automatically in Phase 9.
   - generateShowSeats() is mainly for old Phase 8 Shows.
   ========================================================= */


/*
   GET
   /api/organiser/shows/:showId/seats
*/
async function getShowSeats(
    showId
) {

    const normalizedShowId =
        String(
            showId || ""
        ).trim();


    if (!normalizedShowId) {

        throw new Error(
            "Show ID is required."
        );

    }


    return skyraApiRequest(
        `/organiser/shows/${encodeURIComponent(
            normalizedShowId
        )}/seats`,
        {
            method:
                "GET"
        }
    );

}


/*
   POST
   /api/organiser/shows/:showId/generate-seats

   Compatibility/backfill API for Shows created before
   automatic Phase 9 ShowSeat generation.
*/
async function generateShowSeats(
    showId
) {

    const normalizedShowId =
        String(
            showId || ""
        ).trim();


    if (!normalizedShowId) {

        throw new Error(
            "Show ID is required."
        );

    }


    return skyraApiRequest(
        `/organiser/shows/${encodeURIComponent(
            normalizedShowId
        )}/generate-seats`,
        {
            method:
                "POST"
        }
    );

}


/* =========================================================
   PHASE 10 - CUSTOMER EVENT / SHOW API

   Public read-only discovery endpoints:

   GET /api/events
   GET /api/events/:eventId
   GET /api/events/:eventId/shows
   GET /api/shows/:showId
   GET /api/shows/:showId/seats

   These functions deliberately use customer-specific names so
   they do not collide with the organiser Event/Show functions.
   ========================================================= */


/*
   GET /api/events

   Supported query:
   {
       search,
       type,
       city,
       language,
       date,
       sort,
       page,
       limit
   }
*/
async function getCustomerEvents(
    query = {}
) {

    const searchParams =
        new URLSearchParams();


    Object.entries(
        query || {}
    ).forEach(
        ([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                String(
                    value
                ).trim() !== ""
            ) {

                searchParams.set(
                    key,
                    String(
                        value
                    )
                );

            }

        }
    );


    const queryString =
        searchParams.toString();


    return skyraApiRequest(
        `/events${
            queryString
                ? `?${queryString}`
                : ""
        }`,
        {
            method:
                "GET"
        }
    );

}


/*
   GET /api/events/:eventId
*/
async function getCustomerEvent(
    eventId
) {

    const normalizedEventId =
        String(
            eventId || ""
        ).trim();


    if (!normalizedEventId) {

        throw new Error(
            "Event ID is required."
        );

    }


    return skyraApiRequest(
        `/events/${encodeURIComponent(
            normalizedEventId
        )}`,
        {
            method:
                "GET"
        }
    );

}


/*
   GET /api/events/:eventId/shows
*/
async function getCustomerEventShows(
    eventId
) {

    const normalizedEventId =
        String(
            eventId || ""
        ).trim();


    if (!normalizedEventId) {

        throw new Error(
            "Event ID is required."
        );

    }


    return skyraApiRequest(
        `/events/${encodeURIComponent(
            normalizedEventId
        )}/shows`,
        {
            method:
                "GET"
        }
    );

}


/*
   GET /api/shows/:showId
*/
async function getCustomerShow(
    showId
) {

    const normalizedShowId =
        String(
            showId || ""
        ).trim();


    if (!normalizedShowId) {

        throw new Error(
            "Show ID is required."
        );

    }


    return skyraApiRequest(
        `/shows/${encodeURIComponent(
            normalizedShowId
        )}`,
        {
            method:
                "GET"
        }
    );

}


/*
   GET /api/shows/:showId/seats

   This is the CUSTOMER ShowSeat endpoint.
   It is intentionally different from Phase 9 getShowSeats(),
   which calls the organiser-only ShowSeat route.
*/
async function getCustomerShowSeats(
    showId
) {

    const normalizedShowId =
        String(
            showId || ""
        ).trim();


    if (!normalizedShowId) {

        throw new Error(
            "Show ID is required."
        );

    }


    return skyraApiRequest(
        `/shows/${encodeURIComponent(
            normalizedShowId
        )}/seats`,
        {
            method:
                "GET"
        }
    );

}


/* =========================================================
   PHASE 11 - CUSTOMER SEAT HOLD API
   ========================================================= */


/*
   POST /api/holds
   body: { showId, seatIds }
*/
async function createSeatHold(
    holdData
) {

    if (
        !holdData ||
        typeof holdData !==
            "object" ||
        Array.isArray(
            holdData
        )
    ) {

        throw new Error(
            "Seat hold data is required."
        );

    }


    return skyraApiRequest(
        "/holds",
        {
            method:
                "POST",

            body:
                JSON.stringify(
                    holdData
                )
        }
    );

}


/*
   GET /api/holds/active?showId=...
*/
async function getActiveSeatHold(
    showId = ""
) {

    const searchParams =
        new URLSearchParams();


    const normalizedShowId =
        String(
            showId || ""
        ).trim();


    if (normalizedShowId) {

        searchParams.set(
            "showId",
            normalizedShowId
        );

    }


    const queryString =
        searchParams.toString();


    return skyraApiRequest(
        `/holds/active${
            queryString
                ? `?${queryString}`
                : ""
        }`,
        {
            method:
                "GET"
        }
    );

}


/*
   GET /api/holds/:holdId
*/
async function getSeatHold(
    holdId
) {

    const normalizedHoldId =
        String(
            holdId || ""
        ).trim();


    if (!normalizedHoldId) {

        throw new Error(
            "SeatHold ID is required."
        );

    }


    return skyraApiRequest(
        `/holds/${encodeURIComponent(
            normalizedHoldId
        )}`,
        {
            method:
                "GET"
        }
    );

}


/*
   DELETE /api/holds/:holdId
*/
async function releaseSeatHold(
    holdId
) {

    const normalizedHoldId =
        String(
            holdId || ""
        ).trim();


    if (!normalizedHoldId) {

        throw new Error(
            "SeatHold ID is required."
        );

    }


    return skyraApiRequest(
        `/holds/${encodeURIComponent(
            normalizedHoldId
        )}`,
        {
            method:
                "DELETE"
        }
    );

}




/* =========================================================
   40.3 PHASE 13 - RAZORPAY PAYMENT API
   ========================================================= */

/*
   POST /api/payments/order
*/
async function createPaymentOrder(
    paymentData
) {

    if (
        !paymentData ||
        typeof paymentData !== "object" ||
        Array.isArray(paymentData)
    ) {
        throw new Error(
            "Payment order data is required."
        );
    }

    return skyraApiRequest(
        "/payments/order",
        {
            method: "POST",
            body: JSON.stringify(
                paymentData
            )
        }
    );
}


/*
   POST /api/payments/verify
*/
async function verifyPayment(
    verificationData
) {

    if (
        !verificationData ||
        typeof verificationData !== "object" ||
        Array.isArray(verificationData)
    ) {
        throw new Error(
            "Payment verification data is required."
        );
    }

    return skyraApiRequest(
        "/payments/verify",
        {
            method: "POST",
            body: JSON.stringify(
                verificationData
            )
        }
    );
}


/*
   GET /api/payments/:paymentId
*/
async function getPayment(
    paymentId
) {

    const normalizedPaymentId =
        String(
            paymentId || ""
        ).trim();

    if (!normalizedPaymentId) {
        throw new Error(
            "Payment ID is required."
        );
    }

    return skyraApiRequest(
        `/payments/${encodeURIComponent(
            normalizedPaymentId
        )}`,
        {
            method: "GET"
        }
    );
}


/*
   GET /api/payments/hold/:holdId
*/
async function getPaymentByHold(
    holdId
) {

    const normalizedHoldId =
        String(
            holdId || ""
        ).trim();

    if (!normalizedHoldId) {
        throw new Error(
            "SeatHold ID is required."
        );
    }

    return skyraApiRequest(
        `/payments/hold/${encodeURIComponent(
            normalizedHoldId
        )}`,
        {
            method: "GET"
        }
    );
}


/* =========================================================
   40.4 PHASE 14 - CUSTOMER BOOKING API
   ========================================================= */

async function createBooking(
    bookingData
) {

    if (
        !bookingData ||
        typeof bookingData !== "object" ||
        Array.isArray(bookingData)
    ) {
        throw new Error(
            "Booking data is required."
        );
    }

    return skyraApiRequest(
        "/bookings",
        {
            method: "POST",
            body: JSON.stringify(
                bookingData
            )
        }
    );
}


async function getBooking(
    bookingId
) {

    const normalizedBookingId =
        String(
            bookingId || ""
        ).trim();

    if (!normalizedBookingId) {
        throw new Error(
            "Booking ID is required."
        );
    }

    return skyraApiRequest(
        `/bookings/${encodeURIComponent(
            normalizedBookingId
        )}`,
        {
            method: "GET"
        }
    );
}


async function getBookingByReference(
    reference
) {

    const normalizedReference =
        String(
            reference || ""
        ).trim();

    if (!normalizedReference) {
        throw new Error(
            "Booking reference is required."
        );
    }

    return skyraApiRequest(
        `/bookings/reference/${encodeURIComponent(
            normalizedReference
        )}`,
        {
            method: "GET"
        }
    );
}



async function cancelBooking(
    bookingId,
    cancellationData = {}
) {

    const normalizedBookingId =
        String(
            bookingId || ""
        ).trim();

    if (!normalizedBookingId) {
        throw new Error(
            "Booking ID is required."
        );
    }

    return skyraApiRequest(
        `/bookings/${encodeURIComponent(
            normalizedBookingId
        )}/cancel`,
        {
            method: "POST",
            body: JSON.stringify(
                cancellationData &&
                typeof cancellationData === "object" &&
                !Array.isArray(
                    cancellationData
                )
                    ? cancellationData
                    : {}
            )
        }
    );
}


async function getCustomerBookings() {

    return skyraApiRequest(
        "/bookings",
        {
            method: "GET"
        }
    );

}


/* =========================================================
   40.5 PHASE 17 - CUSTOMER WAITLIST API
   ========================================================= */

async function getMyWaitlist() {

    return skyraApiRequest(
        "/waitlist/my",
        {
            method: "GET"
        }
    );
}


async function joinWaitlist(
    waitlistData
) {

    if (
        !waitlistData ||
        typeof waitlistData !== "object" ||
        Array.isArray(waitlistData)
    ) {
        throw new Error(
            "Waitlist data is required."
        );
    }

    return skyraApiRequest(
        "/waitlist",
        {
            method: "POST",
            body: JSON.stringify(
                waitlistData
            )
        }
    );
}


async function leaveWaitlist(
    waitlistId
) {

    const normalizedWaitlistId =
        String(
            waitlistId || ""
        ).trim();

    if (!normalizedWaitlistId) {
        throw new Error(
            "Waitlist ID is required."
        );
    }

    return skyraApiRequest(
        `/waitlist/${encodeURIComponent(
            normalizedWaitlistId
        )}`,
        {
            method: "DELETE"
        }
    );
}


async function claimWaitlistOffer(
    offerId
) {

    const normalizedOfferId =
        String(
            offerId || ""
        ).trim();

    if (!normalizedOfferId) {
        throw new Error(
            "Waitlist offer ID is required."
        );
    }

    return skyraApiRequest(
        `/waitlist/offers/${encodeURIComponent(
            normalizedOfferId
        )}/claim`,
        {
            method: "POST"
        }
    );
}


/* =========================================================
   40.6 PHASE 18 - CUSTOMER NOTIFICATIONS API
   ========================================================= */

async function getNotifications(
    options = {}
) {

    const params =
        new URLSearchParams();


    if (
        options &&
        typeof options === "object" &&
        !Array.isArray(options)
    ) {

        [
            "read",
            "status",
            "type",
            "limit"
        ].forEach(
            (key) => {

                const value =
                    options[key];


                if (
                    value !== undefined &&
                    value !== null &&
                    String(value).trim() !== ""
                ) {

                    params.set(
                        key,
                        String(value)
                    );

                }

            }
        );

    }


    const query =
        params.toString();


    return skyraApiRequest(
        `/notifications${
            query
                ? `?${query}`
                : ""
        }`,
        {
            method: "GET"
        }
    );

}


async function getNotificationUnreadCount() {

    return skyraApiRequest(
        "/notifications/unread-count",
        {
            method: "GET"
        }
    );

}


async function markNotificationRead(
    notificationId
) {

    const normalizedNotificationId =
        String(
            notificationId || ""
        ).trim();


    if (!normalizedNotificationId) {
        throw new Error(
            "Notification ID is required."
        );
    }


    return skyraApiRequest(
        `/notifications/${encodeURIComponent(
            normalizedNotificationId
        )}/read`,
        {
            method: "PATCH"
        }
    );

}


async function markAllNotificationsRead() {

    return skyraApiRequest(
        "/notifications/read-all",
        {
            method: "PATCH"
        }
    );

}


/* =========================================================
   40.4 EXPOSE API CLIENT

   Existing Admin page scripts can now call the real backend.
   ========================================================= */

window.SKYRA_API = {

    request:
        skyraApiRequest,


    /* =====================================================
       PHASE 4 - VENUES
       ===================================================== */

    getAdminVenues,

    getAdminVenue,

    createAdminVenue,

    updateAdminVenue,

    deleteAdminVenue,

    getAdminVenueSummary,


    /* =====================================================
       PHASE 5 - SEAT CATEGORIES
       ===================================================== */

    createAdminSeatCategory,

    updateAdminSeatCategory,

    deleteAdminSeatCategory,


    /* =====================================================
       PHASE 6 - PHYSICAL SEAT LAYOUT
       ===================================================== */

    getAdminVenueSeats,

    saveAdminVenueSeatLayout,


    /* =====================================================
       PHASE 7 - ORGANISER EVENT MANAGEMENT
       ===================================================== */

    createEvent,

    getOrganiserEvents,

    getEvent,

    updateEvent,

    deleteEvent,


    /* =====================================================
       PHASE 8 - ORGANISER SHOW MANAGEMENT
       ===================================================== */

    getOrganiserShowVenues,

    getOrganiserShowVenue,

    createShow,

    getOrganiserShows,

    getShow,

    updateShow,

    cancelShow,


    /* =====================================================
       PHASE 9 - SHOWSEAT
       ===================================================== */

    getShowSeats,

    generateShowSeats,


    /* =====================================================
       PHASE 10 - CUSTOMER EVENT / SHOW DISCOVERY
       ===================================================== */

    getCustomerEvents,

    getCustomerEvent,

    getCustomerEventShows,

    getCustomerShow,

    getCustomerShowSeats,


    /* =====================================================
       PHASE 11 - CUSTOMER SEAT HOLDS
       ===================================================== */

    createSeatHold,

    getActiveSeatHold,

    getSeatHold,

    releaseSeatHold,


    /* =====================================================
       PHASE 13 - RAZORPAY PAYMENT
       ===================================================== */

    createPaymentOrder,

    verifyPayment,

    getPayment,

    getPaymentByHold,


    /* =====================================================
       PHASE 14 - CUSTOMER BOOKINGS
       ===================================================== */

    createBooking,

    getBooking,

    getBookingByReference,

    getCustomerBookings,

    /*
       my-bookings.js historically called getMyBookings().
       Keep this compatibility alias while the backend endpoint
       remains GET /api/bookings.
    */
    getMyBookings:
        getCustomerBookings,

    cancelBooking,

    /* =====================================================
       PHASE 17 - CUSTOMER WAITLIST
       ===================================================== */

    getMyWaitlist,

    joinWaitlist,

    leaveWaitlist,

    claimWaitlistOffer,


    /* =====================================================
       PHASE 18 - CUSTOMER NOTIFICATIONS
       ===================================================== */

    getNotifications,

    getNotificationUnreadCount,

    markNotificationRead,

    markAllNotificationsRead

};


/* =========================================================
   PHASE 19 - SOCKET.IO CLIENT / REAL-TIME SEATS

   The Socket.IO browser client is loaded from the same backend
   that serves the API. This keeps the frontend independent of a
   CDN and automatically matches the backend Socket.IO version.
   ========================================================= */

let skyraSocketIoClientPromise =
    null;

let skyraRealtimeSocket =
    null;


function loadSkyraSocketIoClient() {

    if (
        typeof window.io ===
        "function"
    ) {

        return Promise.resolve(
            window.io
        );

    }


    if (skyraSocketIoClientPromise) {

        return skyraSocketIoClientPromise;

    }


    skyraSocketIoClientPromise =
        new Promise(
            (
                resolve,
                reject
            ) => {

                const existingScript =
                    document.getElementById(
                        "skyraSocketIoClient"
                    );


                const handleLoaded =
                    () => {

                        if (
                            typeof window.io ===
                            "function"
                        ) {

                            resolve(
                                window.io
                            );

                            return;

                        }


                        reject(
                            new Error(
                                "Socket.IO client loaded but window.io is unavailable."
                            )
                        );

                    };


                const handleError =
                    () => {

                        skyraSocketIoClientPromise =
                            null;

                        reject(
                            new Error(
                                "Unable to load the SKYRA Socket.IO client."
                            )
                        );

                    };


                if (existingScript) {

                    existingScript.addEventListener(
                        "load",
                        handleLoaded,
                        {
                            once: true
                        }
                    );

                    existingScript.addEventListener(
                        "error",
                        handleError,
                        {
                            once: true
                        }
                    );

                    return;

                }


                const script =
                    document.createElement(
                        "script"
                    );


                script.id =
                    "skyraSocketIoClient";

                script.src =
                    `${SKYRA_COMMON_REALTIME_BASE_URL}/socket.io/socket.io.js`;

                script.async =
                    true;

                script.addEventListener(
                    "load",
                    handleLoaded,
                    {
                        once: true
                    }
                );

                script.addEventListener(
                    "error",
                    handleError,
                    {
                        once: true
                    }
                );


                document.head.appendChild(
                    script
                );

            }
        );


    return skyraSocketIoClientPromise;

}


async function getSkyraRealtimeSocket() {

    if (skyraRealtimeSocket) {

        return skyraRealtimeSocket;

    }


    const ioFactory =
        await loadSkyraSocketIoClient();


    skyraRealtimeSocket =
        ioFactory(
            SKYRA_COMMON_REALTIME_BASE_URL,
            {
                transports: [
                    "websocket",
                    "polling"
                ],

                reconnection:
                    true,

                reconnectionAttempts:
                    Infinity,

                reconnectionDelay:
                    500,

                reconnectionDelayMax:
                    5000,

                timeout:
                    10000
            }
        );


    return skyraRealtimeSocket;

}


function getSkyraRealtimeBaseUrl() {

    return SKYRA_COMMON_REALTIME_BASE_URL;

}


/* =========================================================
   PHASE 22 - LIVE CUSTOMER SHELL INDICATORS
   Waitlist and notification badges come only from backend APIs.
   ========================================================= */
async function refreshSkyraCustomerIndicators() {
    const user = getSkyraStoredUser();
    if (String(user?.role || "").toUpperCase() !== "CUSTOMER") return;

    let activeWaitlist = 0;
    let unread = 0;

    const [waitlistResult, unreadResult] = await Promise.allSettled([
        window.SKYRA_API?.getMyWaitlist?.(),
        window.SKYRA_API?.getNotificationUnreadCount?.()
    ]);

    if (waitlistResult.status === "fulfilled") {
        const response = waitlistResult.value;
        const entries = response?.data?.waitlist || response?.waitlist || response?.data?.entries || response?.entries || [];
        if (Array.isArray(entries)) {
            activeWaitlist = entries.filter((entry) =>
                ["WAITING", "WAITLISTED", "ACTIVE", "OFFERED"].includes(
                    String(entry?.status || entry?.offer?.status || "").toUpperCase()
                )
            ).length;
        }
    }

    if (unreadResult.status === "fulfilled") {
        const response = unreadResult.value;
        unread = Number(
            response?.data?.unreadCount ?? response?.unreadCount ??
            response?.data?.count ?? response?.count ?? 0
        ) || 0;
    }

    const waitlistBadge = document.getElementById("sidebarWaitlistCount");
    if (waitlistBadge) {
        waitlistBadge.textContent = String(activeWaitlist);
        waitlistBadge.hidden = activeWaitlist === 0;
    }

    const notificationBadge = document.getElementById("sidebarNotificationCount");
    if (notificationBadge) {
        notificationBadge.textContent = String(unread);
        notificationBadge.hidden = unread === 0;
    }

    const dot = document.getElementById("topbarNotificationDot");
    if (dot) dot.hidden = unread === 0;

    return { activeWaitlist, unread };
}

/* =========================================================
   41. EXPOSE SHARED HELPERS

   Customer/Organiser/Admin page scripts can use:

   SKYRA_COMMON.showToast(...)
   SKYRA_COMMON.getUser()
   SKYRA_COMMON.getToken()
   SKYRA_COMMON.formatCurrency(...)
   ========================================================= */

window.SKYRA_COMMON = {

    getToken:
        getSkyraAuthToken,

    getUser:
        getSkyraStoredUser,

    createInitials:
        createUserInitials,

    getFirstName:
        getUserFirstName,

    showToast:
        showDashboardToast,

    formatCurrency:
        formatSkyraCurrency,

    formatDate:
        formatSkyraDate,

    formatDateTime:
        formatSkyraDateTime,

    debounce:
        debounceSkyra,

    setLocalStorage:
        setSkyraLocalStorage,

    getLocalJSON:
        getSkyraLocalJSON,

    openSidebar:
        openMobileSidebar,

    closeSidebar:
        closeMobileSidebar,

    getRealtimeSocket:
        getSkyraRealtimeSocket,

    getRealtimeBaseUrl:
        getSkyraRealtimeBaseUrl,

    refreshCustomerIndicators:
        refreshSkyraCustomerIndicators,

    logout:
        performSkyraLogout

};


/* =========================================================
   END OF SKYRA SHARED DASHBOARD JAVASCRIPT
   ========================================================= */

/* =========================================================
   SKYRA - PHASE 15 TICKET API HELPERS
   ========================================================= */

if (window.SKYRA_API) {
    window.SKYRA_API.getBookingTicket = function getBookingTicket(bookingId) {
        return window.SKYRA_API.request(`/bookings/${encodeURIComponent(bookingId)}/ticket`, {
            method: "GET"
        });
    };

    window.SKYRA_API.emailBookingTicket = function emailBookingTicket(bookingId) {
        return window.SKYRA_API.request(`/bookings/${encodeURIComponent(bookingId)}/email-ticket`, {
            method: "POST"
        });
    };
}


/* =========================================================
   PHASE 20 - ADMIN SYSTEM API HELPERS

   Real MongoDB-backed administration endpoints.
   No Phase 20 page should need mock data while these
   endpoints are available.
   ========================================================= */

function buildSkyraAdminQueryString(query = {}) {

    const params =
        new URLSearchParams();


    Object.entries(
        query || {}
    ).forEach(
        ([key, value]) => {

            if (
                value === undefined ||
                value === null ||
                String(value).trim() === ""
            ) {

                return;

            }


            params.set(
                key,
                String(value)
            );

        }
    );


    const queryString =
        params.toString();


    return queryString
        ? `?${queryString}`
        : "";

}


function getAdminDashboard() {

    return skyraApiRequest(
        "/admin/dashboard",
        {
            method:
                "GET"
        }
    );

}


function getAdminUsers(
    query = {}
) {

    return skyraApiRequest(
        `/admin/users${buildSkyraAdminQueryString(query)}`,
        {
            method:
                "GET"
        }
    );

}


function getAdminUser(
    userId
) {

    const id =
        String(
            userId || ""
        ).trim();


    if (!id) {

        throw new Error(
            "Customer ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/users/${encodeURIComponent(id)}`,
        {
            method:
                "GET"
        }
    );

}


function updateAdminUserStatus(
    userId,
    payload
) {

    const id =
        String(
            userId || ""
        ).trim();


    if (!id) {

        throw new Error(
            "Customer ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/users/${encodeURIComponent(id)}/status`,
        {
            method:
                "PATCH",

            body:
                JSON.stringify(
                    payload || {}
                )
        }
    );

}


function getAdminOrganisers(
    query = {}
) {

    return skyraApiRequest(
        `/admin/organisers${buildSkyraAdminQueryString(query)}`,
        {
            method:
                "GET"
        }
    );

}


function getAdminOrganiser(
    organiserId
) {

    const id =
        String(
            organiserId || ""
        ).trim();


    if (!id) {

        throw new Error(
            "Organiser ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/organisers/${encodeURIComponent(id)}`,
        {
            method:
                "GET"
        }
    );

}


function updateAdminOrganiserStatus(
    organiserId,
    payload
) {

    const id =
        String(
            organiserId || ""
        ).trim();


    if (!id) {

        throw new Error(
            "Organiser ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/organisers/${encodeURIComponent(id)}/status`,
        {
            method:
                "PATCH",

            body:
                JSON.stringify(
                    payload || {}
                )
        }
    );

}


function getAdminBookings(
    query = {}
) {

    return skyraApiRequest(
        `/admin/bookings${buildSkyraAdminQueryString(query)}`,
        {
            method:
                "GET"
        }
    );

}


function getAdminBooking(
    bookingId
) {

    const id =
        String(
            bookingId || ""
        ).trim();


    if (!id) {

        throw new Error(
            "Booking ID is required."
        );

    }


    return skyraApiRequest(
        `/admin/bookings/${encodeURIComponent(id)}`,
        {
            method:
                "GET"
        }
    );

}


if (window.SKYRA_API) {

    window.SKYRA_API.getAdminDashboard =
        getAdminDashboard;

    window.SKYRA_API.getAdminUsers =
        getAdminUsers;

    window.SKYRA_API.getAdminUser =
        getAdminUser;

    window.SKYRA_API.updateAdminUserStatus =
        updateAdminUserStatus;

    window.SKYRA_API.getAdminOrganisers =
        getAdminOrganisers;

    window.SKYRA_API.getAdminOrganiser =
        getAdminOrganiser;

    window.SKYRA_API.updateAdminOrganiserStatus =
        updateAdminOrganiserStatus;

    window.SKYRA_API.getAdminBookings =
        getAdminBookings;

    window.SKYRA_API.getAdminBooking =
        getAdminBooking;

}

/* =========================================================
   PHASE 21 - ORGANISER ANALYTICS API HELPERS

   Authenticated organiser endpoints. The backend derives the
   organiser identity from the JWT; callers never send an
   organiserId for dashboard/bookings/revenue access.
   ========================================================= */

function buildSkyraOrganiserQueryString(query = {}) {

    const params =
        new URLSearchParams();

    Object.entries(
        query || {}
    ).forEach(
        ([key, value]) => {

            if (
                value === undefined ||
                value === null ||
                String(value).trim() === ""
            ) {

                return;

            }

            params.set(
                key,
                String(value)
            );

        }
    );

    const queryString =
        params.toString();

    return queryString
        ? `?${queryString}`
        : "";

}


function getOrganiserDashboard() {

    return skyraApiRequest(
        "/organiser/dashboard",
        {
            method:
                "GET"
        }
    );

}


function getOrganiserBookings(
    query = {}
) {

    return skyraApiRequest(
        `/organiser/bookings${buildSkyraOrganiserQueryString(query)}`,
        {
            method:
                "GET"
        }
    );

}


function getOrganiserBooking(
    bookingId
) {

    const id =
        String(
            bookingId || ""
        ).trim();

    if (!id) {

        throw new Error(
            "Booking ID is required."
        );

    }

    return skyraApiRequest(
        `/organiser/bookings/${encodeURIComponent(id)}`,
        {
            method:
                "GET"
        }
    );

}


function getOrganiserRevenue(
    query = {}
) {

    return skyraApiRequest(
        `/organiser/revenue${buildSkyraOrganiserQueryString(query)}`,
        {
            method:
                "GET"
        }
    );

}


function getOrganiserRevenueEvents(
    query = {}
) {

    return skyraApiRequest(
        `/organiser/revenue/events${buildSkyraOrganiserQueryString(query)}`,
        {
            method:
                "GET"
        }
    );

}


function getOrganiserRevenueTransactions(
    query = {}
) {

    return skyraApiRequest(
        `/organiser/revenue/transactions${buildSkyraOrganiserQueryString(query)}`,
        {
            method:
                "GET"
        }
    );

}


if (window.SKYRA_API) {

    window.SKYRA_API.getOrganiserDashboard =
        getOrganiserDashboard;

    window.SKYRA_API.getOrganiserBookings =
        getOrganiserBookings;

    window.SKYRA_API.getOrganiserBooking =
        getOrganiserBooking;

    window.SKYRA_API.getOrganiserRevenue =
        getOrganiserRevenue;

    window.SKYRA_API.getOrganiserRevenueEvents =
        getOrganiserRevenueEvents;

    window.SKYRA_API.getOrganiserRevenueTransactions =
        getOrganiserRevenueTransactions;

}
