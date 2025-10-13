//games.js
"use strict";
const express = require("express");
const app = express();
const path = require("path");
const router = express.Router();
const cookieParser = require("cookie-parser");
const session = require("express-session");

router.get(["/"], (req, res) => {
  render(req, res, "games", {
    title: "_tonkatsu_のページ",
    page: "games",
    top: "ゲームをプレイ",
  });
});

router.get(["/:id", "/:id.html"], (req, res) => {
  let gameId = req.params.id;
  if (gameId.includes("tetrisneo2") || gameId == "tetrisbeta"){
    return render(req, res, gameId, {}, "games");
  }
  if (!gameId.endsWith(".html")) {
    if (gameId.endsWith(".ejs")) {
      gameId = gameId.replace(/\.ejs$/, ".html");
    } else {
      gameId = gameId + ".html";
    }
  }
  //gameId = gameId.replace(/\.(html|ejs)$/, "");
  //render(req, res, gameId, {}, "games");
  res.redirect(`https://vfpzs4.csb.app/${gameId}`);
});

module.exports = router;
