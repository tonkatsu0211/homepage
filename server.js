"use strict";
const express = require("express");
const app = express();
const path = require("path");
const cookieParser = require("cookie-parser");
const http = require("http").createServer(app);
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs");
const { Server } = require("socket.io");
const io = new Server(http);
const historyPath = path.join(__dirname, "chatHistory.json");
const { v4: uuidv4 } = require("uuid");
const adminUsers = new Set();
const usersPath = path.join(__dirname, "users.json");
const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
const uploadPath = path.join(__dirname, "public", "uploads");
const { version } = require(path.join(__dirname, ".", "package.json"))
const multer = require("multer");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
const bannedUsersPath = path.join(__dirname, "bannedUsers.json");
global.render = require('./render');

function loadBannedUsers() {
  try {
    const data = fs.readFileSync(bannedUsersPath, "utf8");
    return new Set(JSON.parse(data).users);
  } catch (e) {
    return new Set();
  }
}

let bannedUsers = loadBannedUsers();

io.use((socket, next) => {
  const username = socket.handshake.auth.username;
  if (bannedUsers.has(username)) {
    return next(new Error("あなたはBANされています"));
  }
  next();
});

function deleteAttachedFilesFromMessage(message) {
  const uploadsDir = path.join(__dirname, "public", "uploads");

  const regex = /\/uploads\/([\w\-]+\.(png|jpg|jpeg|gif|mp4|mov))/gi;
  const matches = [...message.matchAll(regex)];

  for (const match of matches) {
    const filename = match[1];
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error("ファイル削除失敗:", filePath, err);
        else console.log("ファイル削除:", filePath);
      });
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, last] of Object.entries(lastPing)) {
    if (now - last > 10000) {
      const socket = io.sockets.sockets.get(id);
      if (socket) {
        socket.disconnect(true);
      }
    }
  }
}, 500);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename =
      Date.now() + "-" + Math.random().toString(36).substring(2) + ext;
    cb(null, filename);
  },
});

const upload = multer({ storage });
for (const [username, info] of Object.entries(usersData.users)) {
  if (info.isAdmin === "true") {
    adminUsers.add(username);
  }
}
const users = {};

let chatHistory = [];

const webPush = require("web-push");

function saveBannedUsers(set) {
  fs.writeFileSync(bannedUsersPath, JSON.stringify({ ips: [...set] }, null, 2));
}

function base64urlToBase64(str) {
  return str
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(str.length / 4) * 4, "=");
}

const publicKey =
  "BBmY-u5pSnhmOhOLWG5w_4MN2wPWloZRzIzp2iXuJBYCJQ48_Qmw5-_vl0vEI4PDzjDBa9lPokKBSVg-V0SL8JE";
const privateKey = "mGbOvFaAMXRMoFIKrJg44gqTJFOPJMLJkKpH5gd-UwM";

webPush.setVapidDetails("mailto:example@example.com", publicKey, privateKey);

const subscriptions = [];

const chatMaxLength = 200;

app.set("trust proxy", true);

app.post("/subscribe", (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({});
});

function sendPushNotification(title, body) {
  const payload = JSON.stringify({ title, body });
  subscriptions.forEach((sub) => {
    webPush.sendNotification(sub, payload).catch((err) => console.error(err));
  });
}

try {
  const data = fs.readFileSync(historyPath, "utf-8");
  chatHistory = JSON.parse(data);
} catch (err) {
  console.error("チャット履歴の読み込みに失敗しました:", err);
}

const lastPing = {};

const lastConnectTime = {};
const lastDisconnectTime = {};
const RECONNECT_THRESHOLD = 5000;
const MIN_CONNECT_INTERVAL = 10000;

function updateAdminList() {
  const onlineUsers = new Set(Object.values(users));
  io.emit("admin list", Array.from(adminUsers), Array.from(onlineUsers));
}

io.on("connection", (socket) => {
  
  const username = socket.handshake.auth.username;
  users[socket.id] = username;
  lastPing[socket.id] = Date.now();

  updateAdminList();

  const now = Date.now();
  const lastDisc = lastDisconnectTime[username] || 0;

  if (
    !lastConnectTime[username] ||
    now - lastConnectTime[username] > MIN_CONNECT_INTERVAL
  ) {
    let message;
    if (now - lastDisc <= RECONNECT_THRESHOLD) {
      message = `${username}が再接続しました`;
    } else {
      message = `${username}が接続しました`;
    }

    const connectMsg = {
      id: uuidv4(),
      username: "systemC2",
      message: message,
      timestamp: new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date()),
    };

    io.emit("chat update", connectMsg);
    chatHistory.push(connectMsg);
    if (chatHistory.length > chatMaxLength) chatHistory.shift();

    lastConnectTime[username] = now;
  }

  io.emit("user count", Object.keys(users).length);
  io.emit("user list", Object.values(users));

  socket.on("client ping", () => {
    lastPing[socket.id] = Date.now();
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    delete lastPing[socket.id];
    io.emit("user count", Object.keys(users).length);
    io.emit("user list", Object.values(users));

    const now = Date.now();
    lastDisconnectTime[username] = now;

    const disconnectMsg = {
      id: uuidv4(),
      username: "systemC2",
      message: `${username}が切断しました`,
      timestamp: new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date()),
    };

    io.emit("chat update", disconnectMsg);
    chatHistory.push(disconnectMsg);
    if (chatHistory.length > chatMaxLength) chatHistory.shift();
    updateAdminList();
  });

  socket.data.username = username;
  socket.data.isAdmin = adminUsers.has(username);

  users[socket.id] = username;

  io.emit("user count", Object.keys(users).length);
  io.emit("user list", Object.values(users));

  socket.emit("chat history", chatHistory);

  socket.on("requestHistory", () => {
    console.log("on requestHistory")
    socket.emit("chat history", chatHistory)
  });
  
  socket.on("chat message", (data) => {
    const { message, replyTo = null } = data;
    const user = socket.data.username;
  
    if (message.trim() === "/delete" && socket.data.isAdmin) {
      for (const m of chatHistory) {
        deleteAttachedFilesFromMessage(m.message);
      }
      chatHistory = [];
      io.emit("chat history", chatHistory);
      fs.writeFileSync(historyPath, JSON.stringify(chatHistory, null, 2));
      return;
    }
  
    if (message.startsWith("/ban ") && socket.data.isAdmin) {
      const target = message.slice(5).trim();
      if (!target) return;
      if (target === "_tonkatsu_" && user != "_tonkatsu_") {
        bannedUsers.add(user);
        const sysMsg = {
          id: uuidv4(),
          username: "system",
          message: `${user} が製作者のBANを試みたため、BANされました`,
          timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
        };
        chatHistory.push(sysMsg);
        if (chatHistory.length > chatMaxLength) chatHistory.shift();
        io.emit("chat update", sysMsg);
        io.emit("reload", user, "あなたはBANされました");
        updateAdminList();
        fs.writeFileSync(bannedUsersPath, JSON.stringify({ users: [...bannedUsers] }, null, 2));
        return;
      } else if (target == user) {
        const sysMsg = {
          id: uuidv4(),
          username: "system",
          message: `${user} が自己のBANを試みました`,
          timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
        };
        chatHistory.push(sysMsg);
        if (chatHistory.length > chatMaxLength) chatHistory.shift();
        io.emit("chat update", sysMsg);
        return;
      } else if (usersData.users[target].isAdmin == "true" && user != "_tonkatsu_") {
        const sysMsg = {
          id: uuidv4(),
          username: "system",
          message: `${user} が管理者 ${target} のBANを試みました(管理者は製作者のみBANできます)`,
          timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
        };
        chatHistory.push(sysMsg);
        if (chatHistory.length > chatMaxLength) chatHistory.shift();
        io.emit("chat update", sysMsg);
        return;
      };
      bannedUsers.add(target);
      const sysMsg = {
        id: uuidv4(),
        username: "system",
        message: `${user}が${target}をBANしました`,
        timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
      };
      chatHistory.push(sysMsg);
      if (chatHistory.length > chatMaxLength) chatHistory.shift();
      io.emit("chat update", sysMsg);
      io.emit("reload", target, "あなたはBANされました");
      updateAdminList();
      fs.writeFileSync(bannedUsersPath, JSON.stringify({ users: [...bannedUsers] }, null, 2));
      return;
    }
  
    if (message.startsWith("/unban ") && socket.data.isAdmin) {
      const target = message.slice(7).trim();
      bannedUsers.delete(target);
      const sysMsg = {
        id: uuidv4(),
        username: "system",
        message: `${user} が ${target} のBANを解除しました`,
        timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
      };
      chatHistory.push(sysMsg);
      if (chatHistory.length > chatMaxLength) chatHistory.shift();
      io.emit("chat update", sysMsg);
      io.emit("reload", target, "BANが解除されました");
      updateAdminList();
      fs.writeFileSync(bannedUsersPath, JSON.stringify({ users: [...bannedUsers] }, null, 2));
      return;
    }

    if (message.startsWith("/admin ") && socket.data.isAdmin) {
      const target = message.slice(7).trim();
      if (!target) return;
      
      adminUsers.add(target);
      if (!usersData.users[target]) {
        usersData.users[target] = {};
      }
      usersData.users[target].isAdmin = "true";
      
      fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
      const sysMsg = {
        id: uuidv4(),
        username: "system",
        message: `${user} が ${target} に管理者権限を付与しました`,
        timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      };
      chatHistory.push(sysMsg);
      if (chatHistory.length > chatMaxLength) chatHistory.shift();
      updateAdminList();
      io.emit("chat update", sysMsg);
      io.emit("reload", target, "管理者権限が付与されました。再読み込みします。");
      return;
    }
    
    if (message.startsWith("/unadmin ") && socket.data.isAdmin) {
      const target = message.slice(9).trim();
      if (!target) return;
      
      if (target === "_tonkatsu_" && user != "_tonkatsu_") {
        bannedUsers.add(user);
        fs.writeFileSync(bannedUsersPath, JSON.stringify({ users: [...bannedUsers] }, null, 2));
        const sysMsg = {
          id: uuidv4(),
          username: "system",
          message: `${user} が製作者の管理者権限削除を試みたため、BANされました`,
          timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
        };
        chatHistory.push(sysMsg);
        io.emit("chat update", sysMsg);
        io.emit("reload", user, "あなたはBANされました");
        updateAdminList();
        return;
      } else if (target == user) {
        const sysMsg = {
          id: uuidv4(),
          username: "system",
          message: `${user} が自己の管理者権限削除を試みました`,
          timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
        };
        chatHistory.push(sysMsg);
        if (chatHistory.length > chatMaxLength) chatHistory.shift();
        io.emit("chat update", sysMsg);
        return;
      }
      adminUsers.delete(target);
      if (!usersData.users[target]) {
        usersData.users[target] = {};
      }
      usersData.users[target].isAdmin = "false";
  
      fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
      const sysMsg = {
        id: uuidv4(),
        username: "system",
        message: `${user} が ${target} の管理者権限を削除しました`,
        timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      };
      chatHistory.push(sysMsg);
      if (chatHistory.length > chatMaxLength) chatHistory.shift();
      updateAdminList();
      io.emit("chat update", sysMsg);
      io.emit("reload", target, "管理者権限が削除されました。再読み込みします。");
      return;
    }
    
    if (message.startsWith("/password ")) {
      const newPassword = message.slice(10).trim();
      bcrypt.hash(newPassword, 10).then((hash) => {
        usersData.users[user].passwordHash = hash;
        fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
        socket.emit("password changed", user);
      }).catch((err) => {
        console.error("パスワード変更失敗:", err);
        socket.emit("password change failed", user);
      });
      return;
    }
    
    if (message.startsWith("/color ")) {
      const color = message.slice(7).trim();
      if (!/^#[0-9a-fA-F]{3}$/.test(color) && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        socket.emit("chat update", "無効なカラーコードです");
        return;
      }      
      usersData.users[user].color = color;
      fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
      const sysMsg = {
        id: uuidv4(),
        username: "system",
        message: `${user} が名前の色を ${color} に変更しました`,
        timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
      };
      chatHistory.push(sysMsg);
      if (chatHistory.length > chatMaxLength) chatHistory.shift();
      io.emit("chat update", sysMsg);
      return;
    }
  
    if (message.startsWith("/name ")) {
      const newName = message.slice(6).trim();
      if (!newName || usersData.users[newName]) {
        socket.emit("chat update", "その名前は使用できません");
        return;
      }
      usersData.users[newName] = usersData.users[user];
      delete usersData.users[user];
      fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
      socket.data.username = newName;
      users[socket.id] = newName;
      const sysMsg = {
        id: uuidv4(),
        username: "system",
        message: `${user} が ${newName} に名前を変更しました`,
        timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
      };
      chatHistory.push(sysMsg);
      if (chatHistory.length > chatMaxLength) chatHistory.shift();
      io.emit("chat update", sysMsg);
      return;
    }
    
    const forwarded = socket.request.headers["x-forwarded-for"];
    const rawIP = forwarded
      ? forwarded.split(",")[0].trim()
      : socket.handshake.address;
  
    const ipRaw =
      socket.handshake.headers["x-forwarded-for"] ||
      socket.handshake.address ||
      "";
    const ipList = ipRaw.split(",").map((ip) => ip.trim());
  
    let ipv4 =
      ipList.find((ip) => /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(ip)) || "";
    let ipv6 =
      ipList.find((ip) => /^[a-fA-F0-9:]+$/.test(ip) && !ip.includes(".")) || "";
  
    if (rawIP.startsWith("::ffff:")) {
      ipv4 = rawIP.replace("::ffff:", "");
      ipv6 = "";
    } else if (rawIP === "::1") {
      ipv4 = "127.0.0.1";
      ipv6 = "::1";
    }
  
    socket.ipv4 = ipv4;
    socket.ipv6 = ipv6;
    
    const replyMsg = replyTo
  ? (chatHistory.find(m => m.id === replyTo)?.message || null)
  : null;

    const messageData = {
      id: uuidv4(),
      username: user,
      message: message,
      timestamp: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      ipv4: socket.ipv4,
      ipv6: socket.ipv6,
      isAdmin: socket.data.isAdmin,
      replyTo: replyTo || null,
      replyMsg: replyMsg
    };
    
    updateAdminList();
    
    console.log("message:", messageData);

    chatHistory.push(messageData);
    if (chatHistory.length > chatMaxLength) chatHistory.shift();
    
    fs.writeFile(historyPath, JSON.stringify(chatHistory, null, 2), (err) => {
      if (err) console.error("チャット履歴の保存に失敗:", err);
    });
    
    io.emit("chat update", messageData);
    sendPushNotification(messageData.username, messageData.message);
  });  
  
  socket.on("delete message", (id) => {
    const index = chatHistory.findIndex((msg) => msg.id === id);
    console.log("delete:", chatHistory[index])
    if (index !== -1) {
      const message = chatHistory[index];
      if (message.username === socket.data.username || socket.data.isAdmin) {
        deleteAttachedFilesFromMessage(message.message);
        chatHistory.splice(index, 1);
        fs.writeFileSync(historyPath, JSON.stringify(chatHistory, null, 2));
        io.emit("chat history noScroll", chatHistory);
      }
    }
  });
});

const bbsIO = io.of("/bbs");
bbsIO.on("connection", (socket) => {
  socket.on("join_thread", (threadId) => {
    socket.join(`thread_${threadId}`);

    const db = getDB();
    db.all("SELECT * FROM posts WHERE thread_id=? ORDER BY id ASC", [threadId], (err, posts) => {
      if (!err) {
        socket.emit("thread_history", posts);
      }
      db.close();
    });
  });

  socket.on("new_post", (data) => {
    const db = getDB();
    const created_at = new Date().toISOString();
    db.run(
      "INSERT INTO posts (thread_id, username, message, reply_to, created_at) VALUES (?,?,?,?,?)",
      [data.thread_id, data.username, data.message, data.reply_to || null, created_at],
      function(err) {
        if (!err) {
          db.get("SELECT * FROM posts WHERE id=?", [this.lastID], (err2, post) => {
            if (!err2) {
              bbsIO.to(`thread_${data.thread_id}`).emit("new_post", post);
            }
          });
        }
        db.close();
      }
    );
  });
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "ファイルがアップロードされていません" });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

app.use(
  session({
    secret: "tonkatsu-0211",
    resave: false,
    saveUninitialized: false,
  })
);

app.get("/users", (req, res) => {
  fs.readFile(usersPath, "utf8", (err, data) => {
    if (err) {
      console.error("users.json 読み込みエラー:", err);
      return res.status(500).json({ error: "サーバーエラー" });
    }

    try {
      const json = JSON.parse(data);
      if (!json.users) {
        return res.status(500).json({ error: "usersフィールドが存在しません" });
      }
      res.json(json.users);
    } catch (parseErr) {
      console.error("users.json パースエラー:", parseErr);
      res.status(500).json({ error: "JSONパースエラー" });
    }
  });
});

app.use(cookieParser());

app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "pcViews"));

app.use(express.json());

app.post("/log", (req, res) => {
  console.log(req.body.message);
  res.json({ status: "ok" });
});

app.post(["/chat/logout", "/chat/logout.html"], (req, res) => {
  console.log("logout: ", req.cookies.user);
  res.clearCookie("user");
  res.clearCookie("isAdmin");
  req.session.destroy(() => {
    res.redirect("/chat/login?f=logout");
  });
});

app.use("/games", require("./routes/games"));
app.use("/chat", require("./routes/chat"));
app.use("/bbs", require("./routes/bbs"));
app.use("/service", require("./routes/service"));
app.use("/uploads", require("./routes/uploads"));

app.get(["/", "/index", "/top", "/index.html"], (req, res) => {
  const from = req.query.f || "";
  render(req, res, "index", {
    from,
    title: "_tonkatsu_のページ",
    page: "index",
    top: "_tonkatsu_ / tonkatsu0211のページにようこそ!!",
  });
});

app.get(["/wakame", "/wakame.html"], (req, res) => {
  render(req, res, "wakame", {
    page: "wakame"
  });
});

app.get(["/my", "/my.html"], (req, res) => {
  render(req, res, "my", {
    title: "自己紹介(事故紹介)",
    page: "my",
    top: "自己紹介(事故紹介)",
  });
});

app.get(["/projects", "/projects.html"], (req, res) => {
  render(req, res, "projects", {
    title: "作品",
    page: "projects",
    top: "Scratchの作品",
  });
});

app.get(["/constructing", "/const", "/constructing.html"], (req, res) => {
  render(req, res, "constructing", {
    title: "建設中のページ",
    page: "constructing",
    top: "建設中",
  });
});

app.get(["/constructing1", "/const1", "/constructing1.html"], (req, res) => {
  render(req, res, "constructing1", {
    title: "建設中のページ",
    page: "constructing1",
    top: "建設中",
  });
});

app.get(["/contact", "/contact.html"], (req, res) => {
  render(req, res, "contact", {
    title: "お問い合わせ",
    page: "contact",
    top: "お問い合わせ",
  });
});

app.get(["/beforeBreak", "/beforeBreak.html", "/break", "/break.html"], (req, res) => {
  render(req, res, "break", {
    title: "_tonkatsu_のページ",
    page: "break",
    top: "履歴破壊",
  });
});

app.get(["/updates", "/updates.html"], (req, res) => {
  render(req, res, "updates", {
    title: "ページ更新履歴",
    page: "updates",
    top: "ページ更新履歴",
  });
});

app.get(["/youtube", "/youtube.html"], (req, res) => {
  render(req, res, "youtube", {
    title: "_tonkatsu_のページ",
    page: "youtube",
    top: "Youtubeプレビュー",
  });
});

app.get(["/error", "/error.html"], (req, res) => {
  render(req, res, "error", {
    title: "404 Not Found",
    page: "error",
    ec: "none",
  });
});

app.get(["/empass/games/snow", "/empass/games/snow.html"], (req, res) => {
  render(req, res, "snow", {}, "games");
});

app.use((req, res) => {
  const pageName = req.path.replace("/", "");
  console.log(`404 at /${pageName}`);
  res.status(404).render("error", {
    title: "404 Not Found",
    page: "error",
    ec: pageName,
    em: "false",
    version
  });
});

const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log("App listening on port", port, ", pid", process.pid);
});
