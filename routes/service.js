//games.js
"use strict";
const express = require("express");
const app = express();
const path = require("path");
const router = express.Router();
const cookieParser = require("cookie-parser");
const session = require("express-session");

router.get(["/"], (req, res) => {
  render(req, res, "index", {
    title: "_tonkatsu_のページ",
    page: "service",
    top: "Webサービス"
  }, "service");
});

router.get(["/:id", "/:id.html"], (req, res) => {
  let serviceId = req.params.id;
  serviceId = serviceId.replace(/\.(html|ejs)$/, "");
  const serviceIds = ["upload", "android"];
  const serviceNames = ["画像アップロードサービス", "Androidエミュレーター"];
  const serviceNum = serviceIds.indexOf(serviceId);
  console.log("service.js: serviceNum: ", serviceNum)
  if (serviceNum < 0) return render(req, res, "error", {
    title: "404 Not Found",
    page: "error",
    ec: `service/${serviceId}`,
  });
  const serviceName = serviceNames[serviceNum]
  render(req, res, serviceId, {
    title: "_tonkatsu_のページ",
    page: `service/${serviceId}`,
    top: serviceName,
    error: null,
    url: null
  }, "service");
});

module.exports = router;