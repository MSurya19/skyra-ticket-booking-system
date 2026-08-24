"use strict";

(() => {

    const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    const backendBaseUrl =
        isLocal
            ? "http://localhost:5000"
            : "https://skyra-backend-wpzm.onrender.com";

    window.SKYRA_CONFIG = Object.freeze({

        API_BASE_URL:
            backendBaseUrl + "/api",

        REALTIME_BASE_URL:
            backendBaseUrl

    });

})();
