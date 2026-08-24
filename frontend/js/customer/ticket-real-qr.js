/* =========================================================
   SKYRA - REAL QR BROWSER FIX
   File: frontend/js/customer/ticket-real-qr.js

   Purpose:
   - Fetch the real QR PNG from:
       GET /api/bookings/:bookingId/ticket
   - Replace the old decorative/fake QR in ticket.html.
   - Run AFTER the existing ticket.js so this real QR wins.
   ========================================================= */

"use strict";

(() => {
    const TAG = "[SKYRA REAL QR]";
    let currentQrDataUrl = "";
    let currentReference = "";
    let observer = null;

    function getBookingId() {
        const params = new URLSearchParams(window.location.search || "");
        return String(
            params.get("booking") ||
            params.get("bookingId") ||
            params.get("id") ||
            ""
        ).trim();
    }

    function isRealQrDataUrl(value) {
        return /^data:image\/png;base64,/i.test(String(value || ""));
    }

    function getStoredToken() {
        return (
            localStorage.getItem("skyra_token") ||
            sessionStorage.getItem("skyra_token") ||
            ""
        );
    }

    async function fetchTicket(bookingId) {
        // Prefer SKYRA's existing API helper.
        if (window.SKYRA_API?.getBookingTicket) {
            return window.SKYRA_API.getBookingTicket(bookingId);
        }

        if (window.SKYRA_API?.request) {
            return window.SKYRA_API.request(
                `/bookings/${encodeURIComponent(bookingId)}/ticket`,
                { method: "GET" }
            );
        }

        // Safe fallback for local development.
        const apiBase =
            window.SKYRA_CONFIG?.API_BASE_URL ||
            "http://localhost:5000/api";

        const token = getStoredToken();

        const response = await fetch(
            `${apiBase}/bookings/${encodeURIComponent(bookingId)}/ticket`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    ...(token
                        ? { Authorization: `Bearer ${token}` }
                        : {})
                }
            }
        );

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                payload?.message ||
                `Ticket request failed (${response.status}).`
            );
        }

        return payload;
    }

    function makeImage(qrDataUrl, reference) {
        const img = document.createElement("img");

        img.id = "skyraRealTicketQrImage";
        img.dataset.skyraRealQr = "true";
        img.src = qrDataUrl;
        img.alt = `SKYRA QR ticket ${reference}`.trim();

        // Important for mobile-camera scanning.
        Object.assign(img.style, {
            display: "block",
            width: "230px",
            maxWidth: "100%",
            height: "230px",
            maxHeight: "100%",
            objectFit: "contain",
            margin: "0 auto",
            padding: "8px",
            background: "#ffffff",
            borderRadius: "10px",
            imageRendering: "auto"
        });

        return img;
    }

    function findExplicitTarget() {
        const selectors = [
            "#ticketQrImage",
            "#ticketQRCode",
            "#ticketQrCode",
            "#qrCodeImage",
            "#qrImage",
            "#ticketQr",
            "[data-ticket-qr]",
            ".ticket-qr-image",
            ".ticket-qr-code",
            ".entry-qr-code",
            ".ticket-qr",
            ".qr-pattern",
            ".ticket-qr-pattern",
            "[class*='qr-pattern']",
            ".qr-code",
            ".qr-box",
            ".ticket-qr-box",
            ".ticket-qr-visual"
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (!el) continue;

            // Never replace a lucide QR icon.
            if (
                el.matches("i, svg") ||
                el.hasAttribute("data-lucide")
            ) {
                continue;
            }

            return el;
        }

        return null;
    }

    function findHeuristicQrTarget() {
        const roots = [
            document.querySelector(".ticket-card"),
            document.querySelector(".ticket-main"),
            document.querySelector(".ticket-content"),
            document.querySelector("main"),
            document.body
        ].filter(Boolean);

        const candidates = [];

        for (const root of roots) {
            for (const el of root.querySelectorAll("div, figure")) {
                if (el.querySelector('img[data-skyra-real-qr="true"]')) {
                    continue;
                }

                const identity = `${el.id || ""} ${el.className || ""}`.toLowerCase();

                if (!identity.includes("qr")) {
                    continue;
                }

                if (el.querySelector("[data-lucide='qr-code']") && el.children.length <= 2) {
                    continue;
                }

                const text = (el.textContent || "").trim();
                const rect = el.getBoundingClientRect();

                let score = 0;

                if (identity.includes("pattern")) score += 10;
                if (identity.includes("code")) score += 7;
                if (identity.includes("ticket")) score += 4;
                if (identity.includes("entry")) score += 3;

                if (rect.width >= 90 && rect.width <= 380) score += 4;
                if (rect.height >= 90 && rect.height <= 380) score += 4;

                if (rect.width && rect.height) {
                    const ratio = rect.width / rect.height;
                    if (ratio >= 0.65 && ratio <= 1.35) score += 5;
                }

                // A fake block QR normally has almost no readable text.
                if (text.length <= 12) score += 5;
                if (el.children.length >= 3) score += 2;

                candidates.push({ el, score });
            }

            if (candidates.length) break;
        }

        candidates.sort((a, b) => b.score - a.score);

        return candidates[0]?.score >= 8
            ? candidates[0].el
            : null;
    }

    function installQr() {
        if (!isRealQrDataUrl(currentQrDataUrl)) {
            return false;
        }

        const existing = document.querySelector(
            'img[data-skyra-real-qr="true"]'
        );

        if (existing) {
            if (existing.src !== currentQrDataUrl) {
                existing.src = currentQrDataUrl;
            }
            return true;
        }

        const target =
            findExplicitTarget() ||
            findHeuristicQrTarget();

        if (!target) {
            return false;
        }

        if (target.tagName === "IMG") {
            target.src = currentQrDataUrl;
            target.alt = `SKYRA QR ticket ${currentReference}`.trim();
            target.dataset.skyraRealQr = "true";
            target.removeAttribute("srcset");
            Object.assign(target.style, {
                display: "block",
                width: "230px",
                maxWidth: "100%",
                height: "230px",
                objectFit: "contain",
                margin: "0 auto",
                padding: "8px",
                background: "#ffffff"
            });
        } else {
            const img = makeImage(
                currentQrDataUrl,
                currentReference
            );

            target.replaceChildren(img);
            target.dataset.skyraRealQrContainer = "true";

            // Ensure the container is large enough for reliable scanning.
            if (target.getBoundingClientRect().width < 180) {
                target.style.width = "246px";
            }
            if (target.getBoundingClientRect().height < 180) {
                target.style.minHeight = "246px";
            }

            target.style.display = "flex";
            target.style.alignItems = "center";
            target.style.justifyContent = "center";
            target.style.background = "#ffffff";
        }

        console.log(
            TAG,
            "Real QR installed.",
            currentReference
        );

        return true;
    }

    function keepRealQrInstalled() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(() => {
            // ticket.js may redraw the ticket area.
            // Reinstall the real QR whenever that happens.
            if (
                currentQrDataUrl &&
                !document.querySelector(
                    'img[data-skyra-real-qr="true"]'
                )
            ) {
                installQr();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Extra retries cover delayed rendering.
        [0, 100, 300, 700, 1200, 2000, 3500, 5000].forEach((delay) => {
            window.setTimeout(installQr, delay);
        });
    }

    async function initializeRealQr() {
        const bookingId = getBookingId();

        if (!bookingId) {
            console.error(TAG, "Booking ID missing in URL.");
            return;
        }

        try {
            const response = await fetchTicket(bookingId);

            const qrDataUrl = response?.data?.qrDataUrl;
            const ticket = response?.data?.ticket || {};

            if (!isRealQrDataUrl(qrDataUrl)) {
                throw new Error(
                    "Backend response does not contain a real PNG QR data URL."
                );
            }

            currentQrDataUrl = qrDataUrl;
            currentReference = String(
                ticket.reference || ticket.qrPayload || ""
            ).trim();

            installQr();
            keepRealQrInstalled();

            // Expose a tiny debug helper.
            window.SKYRA_REAL_QR = {
                bookingId,
                reference: currentReference,
                reload: initializeRealQr,
                getImage: () =>
                    document.querySelector(
                        'img[data-skyra-real-qr="true"]'
                    )
            };
        } catch (error) {
            console.error(
                TAG,
                error
            );

            if (window.SKYRA_COMMON?.showToast) {
                window.SKYRA_COMMON.showToast(
                    error?.message ||
                    "Unable to load the real QR ticket.",
                    "error",
                    "QR Ticket"
                );
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeRealQr,
            { once: true }
        );
    } else {
        initializeRealQr();
    }
})();
