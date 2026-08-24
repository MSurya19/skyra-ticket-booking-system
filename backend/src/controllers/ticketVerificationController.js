"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ticketVerificationService = require("../services/ticketVerificationService");

function query(req) {
    return req.query || {};
}

const verifyTicketHtml = asyncHandler(async (req, res) => {
    const { ref, sig } = query(req);
    const ticket = await ticketVerificationService.verifyTicket(ref, sig);

    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");

    return res
        .status(200)
        .type("html")
        .send(ticketVerificationService.renderVerificationHtml(ticket));
});

const verifyTicketJson = asyncHandler(async (req, res) => {
    const { ref, sig } = query(req);
    const ticket = await ticketVerificationService.verifyTicket(ref, sig);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
        success: true,
        message: "SKYRA ticket verified successfully.",
        data: { ticket }
    });
});

module.exports = {
    verifyTicketHtml,
    verifyTicketJson
};
