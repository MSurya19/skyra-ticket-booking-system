"use strict";

const express = require("express");
const {
    verifyTicketHtml,
    verifyTicketJson
} = require("../controllers/ticketVerificationController");

/*
   Public signed verification routes.
   No CUSTOMER login is required because possession of the signed QR is
   the verification credential. The HMAC signature prevents users from
   changing the booking reference in the URL.
*/
const htmlRouter = express.Router();
const apiRouter = express.Router();

htmlRouter.get("/verify", verifyTicketHtml);
apiRouter.get("/verify", verifyTicketJson);

module.exports = htmlRouter;
module.exports.apiRouter = apiRouter;
