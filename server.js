require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const modes = require("./modes");

const app = express();
const PORT = process.env.PORT || 3000;

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

if (!hasApiKey) {
  console.warn(
    "⚠️  Falta OPENAI_API_KEY. El servidor arranca igual (para poder ver el diseño), " +
      "pero /api/generate y /api/tts devolverán un error controlado hasta que la configures."
  );
}

const openai = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: "Demasiadas solicitudes. Esperá un minuto e intentá de nuevo." },
});
const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Demasiadas solicitudes de audio. Esperá un minuto e intentá de nuevo." },
});

// Vercel corta los pedidos en ~4,5 MB: las imágenes llegan ya reducidas desde el navegador.
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "4mb" }));
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.use("/api/generate", generateLimiter);
app.use("/api/tts", ttsLimiter);

// --- Rutas ----------------------------------------------------

// Metadata pública de los modos. El `systemPrompt` nunca sale del servidor.
app.get("/api/modes", (req, res) => {
  const publicModes = modes.map(({ id, code, title, eyebrow, heading, subtext, placeholder, howto }) => ({
    id,
    code,
    title,
    eyebrow,
    heading,
    subtext,
    placeholder,
    howto: howto || [],
  }));
  res.json(publicModes);
});

const MAX_IMAGES = 3;
const MAX_IMAGE_CHARS = 1_300_000; // ~1 MB por imagen en base64
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const MAX_INPUT_CHARS = 6000;
const MAX_HISTORY_MESSAGES = 24;
const MAX_HISTORY_MSG_CHARS = 8000;
const MAX_HISTORY_CHARS = 40000;

app.post("/api/generate", async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: "El servidor todavía no tiene configurada la API key de OpenAI.",
      });
    }

    const { mode, userInput, history, images } = req.body;
    const noPrompt = req.body.noPrompt === true; // comparación: el modelo responde sin el prompt del modo
    const text = typeof userInput === "string" ? userInput.trim() : "";

    const selected = modes.find((m) => m.id === mode);
    if (!selected) {
      return res.status(404).json({ error: "Modo no encontrado." });
    }

    let safeImages = [];
    if (Array.isArray(images) && images.length) {
      if (mode !== "imagine") {
        return res.status(400).json({ error: "Solo el modo Imaginar acepta imágenes." });
      }
      if (images.length > MAX_IMAGES) {
        return res.status(400).json({ error: `Máximo ${MAX_IMAGES} imágenes por mensaje.` });
      }
      for (const img of images) {
        if (typeof img !== "string" || img.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(img)) {
          return res.status(400).json({ error: "Una de las imágenes no es válida o es demasiado pesada." });
        }
        safeImages.push(img);
      }
    }

    if (!text && !safeImages.length) {
      return res.status(400).json({ error: "Falta el mensaje o una imagen." });
    }
    if (text.length > MAX_INPUT_CHARS) {
      return res.status(400).json({ error: `El mensaje es demasiado largo (máx ${MAX_INPUT_CHARS} caracteres).` });
    }

    let safeHistory = [];
    if (Array.isArray(history)) {
      let charBudget = MAX_HISTORY_CHARS;
      for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
        const role = msg?.role === "assistant" ? "assistant" : msg?.role === "user" ? "user" : null;
        const content = typeof msg?.content === "string" ? msg.content.slice(0, MAX_HISTORY_MSG_CHARS) : "";
        if (!role || !content) continue;
        charBudget -= content.length;
        if (charBudget < 0) break;
        safeHistory.push({ role, content });
      }
    }

    const userContent = safeImages.length
      ? [
          { type: "text", text: text || "Te paso esta imagen para que me la cuentes." },
          ...safeImages.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : text;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      messages: [
        ...(noPrompt ? [] : [{ role: "system", content: selected.systemPrompt }]),
        ...safeHistory,
        { role: "user", content: userContent },
      ],
      // Techo alto: el modelo gasta parte en razonamiento interno antes de escribir.
      // Solo se cobra lo que realmente genera.
      max_completion_tokens: 6000,
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      return res.status(502).json({ error: "El modelo no devolvió texto. Probá de nuevo." });
    }
    res.json({ answer });
  } catch (err) {
    console.error("Error llamando a OpenAI:", err.message);
    res.status(500).json({ error: "Ocurrió un error generando la respuesta. Intenta de nuevo." });
  }
});

const VOICES = ["coral", "sage", "nova", "onyx", "echo", "alloy"];
const TTS_MAX_CHARS = 4000;

app.post("/api/tts", async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: "El servidor todavía no tiene configurada la API key de OpenAI." });
    }
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Falta el texto a leer." });
    if (text.length > TTS_MAX_CHARS) {
      return res.status(400).json({ error: `El texto es demasiado largo para leerlo (máx ${TTS_MAX_CHARS} caracteres).` });
    }
    const voice = VOICES.includes(req.body?.voice) ? req.body.voice : "coral";

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      instructions:
        "Hablá en español rioplatense, con voz cálida, pausada y natural, como alguien que le cuenta con cuidado una escena a otra persona.",
      response_format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": buffer.length, "Cache-Control": "no-store" });
    res.send(buffer);
  } catch (err) {
    console.error("Error generando audio:", err.message);
    res.status(500).json({ error: "No se pudo generar el audio. Intentá de nuevo." });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    if (!hasApiKey) {
      console.log("   (modo sin API key: la UI funciona, /api/generate responde 503 hasta configurar .env)");
    }
  });
}

module.exports = app;
