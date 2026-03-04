//games.js

const express = require("express");
const router = express.Router();
const inv = ["https://8xxzdw-3000.csb.app", "https://k22gwc-3000.csb.app"];

async function getVideo(id) {
  for (let i = 0; i < 2; i++) {
    try{
      const r = await fetch(`${inv[i]}/api/v1/videos/${id}`);
      res = await r.json();
      if (!res.formatStreams) throw new Error("formatStreams not found");
      return res;
    } catch (e) {
      console.error(`error: ${e.message}`);
    }
  }
  throw new Error("fetch failed");
}

function sanitize(name) {
  return name
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .replace(/[\\/:*?"<>|;]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

router.get("/yt/videos/:id", async (req, res) => {
  const videoId = req.params.id;
  try{
    if (videoId.length != 11) throw new Error("videoId not vailed");
    const response = await getVideo(videoId);
    res.json(response);
  } catch (e) {
    return res.json(JSON.stringify(e, null, 2));
  }
});

router.get("/yt/download/:id", async (req, res) => {
  const info = await getVideo(req.params.id);
  const stream = await fetch(info.formatStreams[0].url);
  const safeTitle = sanitize(info.title);
  const encoded = encodeURIComponent(safeTitle)
  console.log([...safeTitle].map(c => c.charCodeAt(0)));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encoded}.mp4`
  );
  res.setHeader("Content-Type", "video/mp4");

  stream.body.pipe(res);
});


module.exports = router;