const path = require('path');
const packageJsonPath = path.join(__dirname, 'package.json');
const { version, last_update } = require(packageJsonPath);
const origin = "https://65yzth-3000.csb.app"
const assets = "https://y3sjh2.csb.app"

function render(req, res, view, data = {},  tag = "", locate = "") {
  const qE = req.query.e || "";
  if (view == "error" && qE) {
    console.log(`redirect by 404 to /error?e=${qE}`);
  }
  const name = locate ? `${locate}/${view}` : view;
  res.render(name, { ...data, em: "false", version, last_update, origin, tag, assets }, (err, html) => {
    if (err) {
      console.log(`404 at /${name} in render function.`);
      console.log(`ejs error message: ${err}`)
      res.status(404).render("error", {
        title: "404 Not Found",
        page: "error",
        ec: name,
        em: "false",
        version,
        last_update,
        origin,
        tag: "error",
        assets
      });
    } else {
      console.log(`access to /${name} ... OK`);
      res.send(html);
    }
  });
}

module.exports = render;