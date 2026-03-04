const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const htmlPath = path.join(__dirname, "../public/temp.html");

const user_agent = 
    process.env.USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36";

router.get("/api/utopia/*path", async (req, res) => {
    const path = (req.params.path || []).join("/");
    console.log(path);
    try{
        const r = await fetch(
            //"https://www.kyoshin.bosai.go.jp/kyoshin/webservice/real_time.json",
            `https://nana.utopia.drciocan.ro/${path || ""}`,
            //"https://www.data.jma.go.jp/svd/eqev/data/real_time/intensity.json%0A",
            {
                headers: {
                    "User-Agent": user_agent
                    //"Accept": "application/json"
                }
            }
        );

        const text = await r.text();

        if (path == "js/all.js") fs.writeFileSync(htmlPath, text);

        //const data = JSON.parse(text);
        res.send(text);
    } catch (e) {
        console.error(e.message);
        res.send(e);
    }
});

router.get("/api/utopia", async (req, res) => {
    try{
        const r = await fetch(
            //"https://www.kyoshin.bosai.go.jp/kyoshin/webservice/real_time.json",
            `https://nana.utopia.drciocan.ro`,
            //"https://www.data.jma.go.jp/svd/eqev/data/real_time/intensity.json%0A",
            {
                headers: {
                    "User-Agent": user_agent
                    //"Accept": "application/json"
                }
            }
        );

        const text = await r.text();

        fs.writeFileSync(htmlPath, text);

        //const data = JSON.parse(text);
        res.send(text);
    } catch (e) {
        console.error(e.message);
        res.send(e);
    }
});

router.get("/api/5000generator/*path", async (req, res) => {
    const path = (req.params.path || []).join("/");
    console.log(path);
    try{
        const r = await fetch(
            //"https://www.kyoshin.bosai.go.jp/kyoshin/webservice/real_time.json",
            `https://5000generator.auriga.dev/${path || ""}`,
            //"https://www.data.jma.go.jp/svd/eqev/data/real_time/intensity.json%0A",
            {
                headers: {
                    "User-Agent": user_agent
                    //"Accept": "application/json"
                }
            }
        );

        const text = await r.text();

        fs.writeFileSync(htmlPath, text);

        //const data = JSON.parse(text);
        res.send(text);
    } catch (e) {
        console.error(e.message);
        res.send(e);
    }
});

router.get("/gitlab/tetris/*path", async (req, res) => {
    const path = (req.params.path || []).join("/");
    console.log(path);
    try{
        const r = await fetch(
            //"https://www.kyoshin.bosai.go.jp/kyoshin/webservice/real_time.json",
            `https://tetris-053217.gitlab.io/${path || ""}`,
            //"https://www.data.jma.go.jp/svd/eqev/data/real_time/intensity.json%0A",
            {
                headers: {
                    "User-Agent": user_agent
                    //"Accept": "application/json"
                }
            }
        );

        const text = await r.text();

        fs.writeFileSync(htmlPath, text);

        //const data = JSON.parse(text);
        res.send(text);
    } catch (e) {
        console.error(e.message);
        res.send(e);
    }
});

router.get("/api/5000generator", async (req, res) => {
    try{
        const r = await fetch(
            //"https://www.kyoshin.bosai.go.jp/kyoshin/webservice/real_time.json",
            `https://5000generator.auriga.dev/`,
            //"https://www.data.jma.go.jp/svd/eqev/data/real_time/intensity.json%0A",
            {
                headers: {
                    "User-Agent": user_agent
                    //"Accept": "application/json"
                }
            }
        );

        //const text = await r.text();

        //fs.writeFileSync(htmlPath, r);

        //const data = JSON.parse(text);
        //res.pipe(r);
        const arrayBuffer = await r.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Length", buffer.length);
        res.setHeader("Cache-Control", "public, max-age=86400");

        res.end(buffer);
    } catch (e) {
        console.error(e.message);
        res.send(e);
    }
});


module.exports = router;