import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { spawn } from "child_process";
import cloudinary from "cloudinary";
import OpenAI from "openai";
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "./prompt.js";

dotenv.config();

/* ================== APP ================== */
const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* ================== CLOUDINARY ================== */
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================== LLM CLIENTS ================== */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/* ================== JSON SANITIZER ================== */
function extractJSON(text) {
  if (typeof text !== "string") throw new Error("LLM output not string");

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("No JSON found in LLM output");
  }

  return cleaned.slice(start, end + 1);
}

/* ================== LLM FALLBACK ENGINE ================== */
async function generateJSON(messages) {
  const providers = [
    openAIProvider,
    groqProvider,
    geminiProvider,
    claudeProvider,
    xaiProvider,
    openRouterProvider,
  ];

  let lastError;

  for (const provider of providers) {
    try {
      console.log(`🔁 Trying ${provider.name}`);
      const raw = await provider(messages);
      const jsonText = extractJSON(raw);
      JSON.parse(jsonText);
      console.log(`✅ ${provider.name} success`);
      return jsonText;
    } catch (err) {
      console.warn(`⚠️ ${provider.name} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError;
}

/* ================== PROVIDERS ================== */

async function openAIProvider(messages) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI key missing");

  const r = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.2,
    messages,
  });

  return r.choices[0].message.content;
}

async function groqProvider(messages) {
  if (!process.env.GROQ_API_KEY) throw new Error("Groq key missing");

  const r = await groq.chat.completions.create({
    model: "llama-3.1-70b-chat",
    temperature: 0.2,
    messages,
  });

  return r.choices[0].message.content;
}

async function geminiProvider(messages) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Gemini key missing");

  const prompt = messages
    .map(m =>
      typeof m.content === "string"
        ? m.content
        : m.content?.[0]?.text || ""
    )
    .join("\n");

  const r = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return r.text;
}

async function claudeProvider(messages) {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new Error("Anthropic key missing");

  const prompt = messages
    .map(m =>
      typeof m.content === "string"
        ? m.content
        : m.content?.[0]?.text || ""
    )
    .join("\n");

  const r = await claude.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  return r.content[0].text;
}

async function xaiProvider(messages) {
  if (!process.env.XAI_API_KEY) throw new Error("xAI key missing");

  const r = await axios.post(
    "https://api.x.ai/v1/chat/completions",
    { model: "grok-2-latest", messages },
    {
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return r.data.choices[0].message.content;
}

async function openRouterProvider(messages) {
  if (!process.env.OPENROUTER_API_KEY)
    throw new Error("OpenRouter key missing");

  const r = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    { model: "openai/gpt-4o-mini", messages },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return r.data.choices[0].message.content;
}

/* ================== RENDERER ================== */
function runRenderer() {
  return new Promise((resolve, reject) => {
    const p = spawn("node", ["renderer.js"], { stdio: "inherit" });
    p.on("close", code =>
      code === 0 ? resolve() : reject(new Error("Renderer failed"))
    );
  });
}

async function uploadVideo() {
  return cloudinary.v2.uploader.upload("output.mp4", {
    resource_type: "video",
  });
}

/* ================== MAIN ENDPOINT ================== */
app.post("/generate", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt || "Generate physics animation";

    const messages = [{ role: "system", content: SYSTEM_PROMPT }];

    if (req.file) {
      const base64 = fs.readFileSync(req.file.path, "base64");
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: `data:image/png;base64,${base64}`,
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const jsonText = await generateJSON(messages);
    fs.writeFileSync("scene.json", jsonText);

    await runRenderer();
    const uploaded = await uploadVideo();

    if (req.file) fs.unlinkSync(req.file.path);

    res.json({ success: true, videoUrl: uploaded.secure_url });
  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================== HEALTH ================== */
app.get("/", (_, res) => {
  res.send("✅ Physics Animation Server running");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
