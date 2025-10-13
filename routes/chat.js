"use strict";
const express = require("express");
const app = express();
const router = express.Router();
const path = require("path");
const fs = require("fs");
const session = require("express-session")
const usersPath = path.join(__dirname, "..", "users.json");
let usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
const bcrypt = require("bcrypt");
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

app.use(session({
  secret: "tonkatsu0211_tonkatsuChat",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

console.log("chat.js loaded");

const bannedUsersPath = path.join(__dirname, "..", "bannedUsers.json");

function loadBannedUsers() {
  try {
    const data = fs.readFileSync(bannedUsersPath, "utf8");
    return new Set(JSON.parse(data).users);
  } catch (e) {
    return new Set();
  }
}

let bannedUsers = loadBannedUsers();

io.on("connection", (socket) => {
  const username = socket.handshake.auth.username;
  if (bannedUsers.has(username)) {
    socket.disconnect(true);
    socket.emit("redirect", "/chat/ban")
  }
});

router.post("/login", async (req, res) => {
  const { username, password, save} = req.body;
  const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  const users = usersData.users;

  if (!users[username]) {
    return render(
      req,
      res,
      "login",
      {
        title: "ログイン",
        page: "login",
        top: "チャットにログイン",
        err: "ユーザー名が存在しません",
      },
      "chat"
    );
  }

  const match = await bcrypt.compare(password, users[username].passwordHash);

  if (match) {
    if (bannedUsers.has(username)) {
      res.cookie("ban", "true", { httpOnly: false, path: "/" });
      return res.redirect("/chat/ban");
    }

    if (save) {
      res.cookie("user", username, { httpOnly: false, path: "/", maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.cookie(
        "isAdmin",
        usersData.users[username].isAdmin === "true" ? "true" : "false",
        { httpOnly: false, path: "/", maxAge: 365 * 24 * 60 * 60 * 1000 }
      );
      res.cookie("ban", "false", { httpOnly: false, path: "/", maxAge: 365 * 24 * 60 * 60 * 1000 });
      console.log(
        "Login:",
        username,
        "isAdmin:",
        usersData.users[username].isAdmin
      );
    } else {
      res.cookie("user", username, { httpOnly: false, path: "/", maxAge: 2000 });
      res.cookie(
        "isAdmin",
        usersData.users[username].isAdmin === "true" ? "true" : "false",
        { httpOnly: false, path: "/", maxAge: 2000 }
      );
      res.cookie("ban", "false", { httpOnly: false, path: "/", maxAge: 2000 });
      console.log(
        "Login:",
        username,
        "isAdmin:",
        usersData.users[username].isAdmin
      );
    }
    console.log("login success");
    return res.redirect("/chat/main");
  } else {
    return render(
      req,
      res,
      "login",
      {
        title: "ログイン",
        page: "login",
        top: "チャットにログイン",
        err: "パスワードが違います",
      },
      "chat"
    );
  }
});

router.post("/signup", async (req, res) => {
  const usersFilePath = path.join(__dirname, "..", "users.json");
  let allUsers;

  try {
    allUsers = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
  } catch (err) {
    console.error("users.json 読み込み失敗:", err);
    return res.status(500).send("ユーザーデータの読み込みに失敗しました。");
  }

  const users = allUsers.users;
  const { username, password, save } = req.body;

  if (users[username]) {
    return render(
      req,
      res,
      "signup",
      {
        title: "サインアップ",
        page: "signup",
        top: "サインアップ",
        err: "既に存在するユーザー名です",
      },
      "chat"
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const isAdmin = "false";
  users[username] = { passwordHash, isAdmin, color: "#aaa" };

  try {
    fs.writeFileSync(usersFilePath, JSON.stringify({ users }, null, 2));
    fs.writeFileSync(
      path.join(__dirname, "..", "usersBackup.json"),
      JSON.stringify({ users }, null, 2)
    );
    console.log("ユーザー登録＆バックアップ成功:", username);
  } catch (err) {
    console.error("ユーザーデータ保存失敗:", err);
    return res.status(500).send("ユーザーデータの保存に失敗しました。");
  }

  if (save) {
    res.cookie("user", username, { httpOnly: false, path: "/", maxAge: 365 * 24 * 60 * 60 * 1000 });
    res.cookie("isAdmin", "false", { httpOnly: false, path: "/", maxAge: 365 * 24 * 60 * 60 * 1000 });
  } else {
    res.cookie("user", username, { httpOnly: false, path: "/", maxAge: 2000 });
    res.cookie("isAdmin", "false", { httpOnly: false, path: "/", maxAge: 2000 });
  }
  res.redirect("/chat/main");
});

router.use((req, res, next) => {
  const skipPaths = ["/rules"];
  if (skipPaths.some((p) => req.path.startsWith(p))) return next();

  let ban = req.cookies.ban;
  const username = req.cookies.user || req.session.user || "noUser";

  const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  if (!ban) {
    res.cookie("ban", "false", { httpOnly: false, path: "/" });
    ban = "false";
  } else if (bannedUsers.has(req.cookies.user || req.session.user)) {
    res.cookie("ban", "true", { httpOnly: false, path: "/" });
  } else {
    res.cookie("ban", "false", { httpOnly: false, path: "/"});
    ban = "false";
  }
  console.log(req.cookies.user || req.session.user, ", ban: ", req.cookies.ban);
  if (bannedUsers.has(req.cookies.user)) {
    res.cookie("ban", "true", { httpOnly: false, path: "/" });
    return res.status(403).redirect("/chat/ban");
  } else {
    res.cookie("ban", "false", { httpOnly: false, path: "/" });
    next();
  }
});

router.get("/", (req, res) => {
  const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  const from = req.query.f || "";
  console.log("req.query.f: ", req.query.f);
  console.log("from: ", from);
  if (req.cookies.user || req.session.user) {
    if (bannedUsers.has(req.cookies.user || req.session.user)) {
      res.cookie("ban", "true", { httpOnly: false, path: "/" });
      return res.status(403).redirect("/chat/ban");
    } else {
      res.cookie("ban", "false", { httpOnly: false, path: "/" });
    }
    if (from == "ban") {
      res.redirect("/chat/main?f=ban");
    } else {
      res.redirect("/chat/main");
    }
  } else {
    render(
      req,
      res,
      "index",
      {
        title: "チャット",
        page: "chat",
        top: "tonkatsuチャットへようこそ",
        from,
      },
      "chat"
    );
  }
});

router.get(["/main", "/main.html"], (req, res) => {
  let usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  if (!req.cookies.user && !req.session.user) {
    return res.redirect("/chat/login?f=chat");
  }
  if (bannedUsers.has(req.cookies.user) || bannedUsers.has(req.session.user)) {
    res.cookie("ban", "true", { httpOnly: false, path: "/" });
    return res.status(403).redirect("/chat/ban");
  } else {
    res.cookie("ban", "false", { httpOnly: false, path: "/" });
  }
  const from = req.query.f || "undifined";
  console.log("req.query.f: ", req.query.f);
  console.log("from: ", from);
  const username = req.cookies.user || req.session.user;
  usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  const userInfo = usersData.users[username];
  const isAdminValue = userInfo.isAdmin === "true";
  res.cookie("isAdmin", isAdminValue, { httpOnly: false, path: "/" });
  res.cookie("color", usersData.users[username].color, {
    httpOnly: false,
    path: "/",
  });
  res.cookie("ban", "false", { httpOnly: false, path: "/" });
  render(
    req,
    res,
    "main",
    {
      title: "チャット",
      page: "chat/main",
      top: "tonkatsuチャット",
      username: username,
      isAdmin: isAdminValue,
      from,
    },
    "chat"
  );
});

router.get(["/login", "/login.html"], (req, res) => {
  render(
    req,
    res,
    "login",
    {
      title: "ログイン",
      page: "chat/login",
      top: "tonkatsuチャットにログイン",
      err: "none",
    },
    "chat"
  );
});

router.get(["/signup", "/signup.html"], (req, res) => {
  render(
    req,
    res,
    "signup",
    {
      title: "サインアップ",
      page: "chat/signup",
      top: "tonkatsuチャットにサインアップ",
      err: "none",
    },
    "chat"
  );
});

router.get(["/rules", "/rules.html"], (req, res) => {
  render(
    req,
    res,
    "rules",
    {
      title: "利用規約",
      page: "chat/rules",
      top: "tonkatsuチャット利用規約",
    },
    "chat"
  );
});

router.get(["/ban", "/ban.html"], (req, res) => {
  res.cookie("ban", "true", { httpOnly: false, path: "/" });
  render(
    req,
    res,
    "ban",
    {
      title: "あなたはBANされています",
      page: "chat/ban",
    },
    "chat"
  );
});

module.exports = router;
