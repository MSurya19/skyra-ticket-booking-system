"use strict";

/* =========================================================
   SKYRA - RAZORPAY CONFIGURATION
   File: backend/src/config/razorpay.js

   IMPORTANT:
   - Key Secret is backend-only.
   - Nothing in this file exposes the secret to the browser.
   - Razorpay is loaded lazily so the API can still boot and
     show a useful message if the SDK has not been installed.
   ========================================================= */

let cachedClient = null;

function getRazorpayCredentials() {

    const keyId =
        String(
            process.env.RAZORPAY_KEY_ID ||
            ""
        ).trim();

    const keySecret =
        String(
            process.env.RAZORPAY_KEY_SECRET ||
            ""
        ).trim();

    if (!keyId || !keySecret) {
        const error = new Error(
            "Razorpay Test API keys are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env."
        );
        error.statusCode = 503;
        throw error;
    }

    return {
        keyId,
        keySecret
    };
}

function getRazorpayClient() {

    if (cachedClient) {
        return cachedClient;
    }

    let Razorpay;

    try {
        Razorpay = require("razorpay");
    } catch (error) {
        const missing = new Error(
            "Razorpay SDK is not installed. Run: npm install razorpay"
        );
        missing.statusCode = 503;
        throw missing;
    }

    const {
        keyId,
        keySecret
    } = getRazorpayCredentials();

    cachedClient =
        new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });

    return cachedClient;
}

function getRazorpayKeyId() {
    return getRazorpayCredentials().keyId;
}

function getRazorpayKeySecret() {
    return getRazorpayCredentials().keySecret;
}

module.exports = {
    getRazorpayClient,
    getRazorpayKeyId,
    getRazorpayKeySecret
};
