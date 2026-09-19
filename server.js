require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const modes = require("./modes");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Seguridad básica ---------------------------------------
const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

if (!hasApiKey) {
  console.warn(
    "⚠️  Falta OPENAI_API_KEY. El servidor arranca igual (para poder ver el diseño), " +
      "pero /api/generate devolverá un error controlado hasta que crees el archivo .env " +
      "(mirá .env.example) con tu clave real."
  );
}

const openai = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Límite de peticiones para no gastar de más si la app queda pública
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 15, // máx 15 solicitudes por minuto por IP
  message: { error: "Demasiadas solicitudes. Esperá un minuto e intentá de nuevo." },
});

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.use("/api/generate", limiter);

// --- Rutas ----------------------------------------------------

// Metadata pública de los 3 modos (título, textos de UI). El
// `systemPrompt` real NUNCA se manda al navegador — a diferencia del
// proyecto del concurso, acá no hay una vista "ver el prompt completo".
app.get("/api/modes", (req, res) => {
  const publicModes = modes.map(({ id, code, title, eyebrow, heading, subtext, placeholder }) => ({
    id,
    code,
    title,
    eyebrow,
    heading,
    subtext,
    placeholder,
  }));
  res.json(publicModes);
});

// Recibe { mode, userInput, history } y devuelve la respuesta de la IA
app.post("/api/generate", async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error:
          "El servidor todavía no tiene configurada la API key de OpenAI (falta .env). " +
          "El diseño y la navegación ya funcionan; la generación arranca apenas se cargue la clave.",
      });
    }

    const { mode, userInput, history } = req.body;

    if (!mode || !userInput || !userInput.trim()) {
      return res.status(400).json({ error: "Falta mode o userInput." });
    }

    const selected = modes.find((m) => m.id === mode);
    if (!selected) {
      return res.status(404).json({ error: "Modo no encontrado." });
    }

    // Límite simple de longitud para evitar abuso / costos inesperados
    if (userInput.length > 2000) {
      return res.status(400).json({ error: "El mensaje es demasiado largo (máx 2000 caracteres)." });
    }

    // El frontend manda su propio historial (sin sesiones en el servidor).
    // Se valida forma y se limita tamaño para evitar abuso de costos.
    const MAX_HISTORY_MESSAGES = 24; // 12 idas y vueltas
    const MAX_HISTORY_CHARS = 20000; // tope total del historial

    let safeHistory = [];
    if (Array.isArray(history)) {
      let charBudget = MAX_HISTORY_CHARS;
      for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
        const role = msg?.role === "assistant" ? "assistant" : msg?.role === "user" ? "user" : null;
        const content = typeof msg?.content === "string" ? msg.content.slice(0, 4000) : "";
        if (!role || !content) continue;
        charBudget -= content.length;
        if (charBudget < 0) break;
        safeHistory.push({ role, content });
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      messages: [
        { role: "system", content: selected.systemPrompt },
        ...safeHistory,
        { role: "user", content: userInput },
      ],
      // Alto a propósito: el modo Cuestionar pide desgloses largos (por
      // afirmación, con 5 campos cada una) y este modelo gasta parte del
      // límite en razonamiento interno antes de escribir la respuesta
      // visible. No tiene costo extra — solo se cobra lo que realmente
      // genera, esto es el techo de seguridad, no una reserva pre-pagada.
      max_completion_tokens: 6000,
    });

    const answer = completion.choices[0]?.message?.content ?? "(sin respuesta)";
    res.json({ answer });
  } catch (err) {
    console.error("Error llamando a OpenAI:", err.message);
    res.status(500).json({ error: "Ocurrió un error generando la respuesta. Intenta de nuevo." });
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
