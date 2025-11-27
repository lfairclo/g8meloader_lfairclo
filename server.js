const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.get("/", async (req, res) => {

  const url = req.query.url;
  if (!url) return res.status(400).send("Missing ?url=");

  try {
    const response = await fetch(url);
    let body = await response.text();

    const headers = {};
    response.headers.forEach((value, key) => {
      if (
        key !== "x-frame-options" &&
        key !== "content-security-policy"
      ) {
        headers[key] = value;
      }
    });

    res.set(headers);
    res.send(body);

  } catch (err) {
    res.status(500).send("Error: " + err.toString());
  }
});

app.listen(3000, () => {
  console.log("Proxy server running on port 3000");
});
