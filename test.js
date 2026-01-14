import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

const form = new FormData();
form.append("image", fs.createReadStream("./image.png"));

const res = await fetch("http://localhost:3000/generate", {
  method: "POST",
  body: form,
  headers: form.getHeaders()
});

const data = await res.json();
console.log(data.videoUrl);
