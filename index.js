// index.js — Node server for “mi‑asistente”
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const OpenAI = require("openai").default;
const { google } = require("googleapis");

console.log("🚀 Server starting…", process.env.NODE_ENV || "development");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Global request logger
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  next();
});

// Simple health check
app.get("/", (req, res) => {
  res.send("Servidor corriendo correctamente.");
});

/* ------------ Google Calendar helper ------------ */
function getCalendarClient() {
  return google.calendar({
    version: "v3",
    auth: new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // Render conserva saltos de línea reales; en local convertimos \n literales
        private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(
          /\\n/g,
          "\n"
        ),
      },
      scopes: ["https://www.googleapis.com/auth/calendar"], // lectura y escritura
    }),
  });
}

async function getGoogleCalendarEvents() {
  console.log("[GoogleCalendar] Fetching events…");
  const calendar = getCalendarClient();

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
  });

  console.log(
    "[GoogleCalendar] Retrieved",
    res.data.items?.length || 0,
    "events"
  );
  return res.data.items || [];
}

/* ------------ Endpoints ------------ */
app.get("/api/calendar", async (req, res) => {
  console.log("[/api/calendar] GET");
  try {
    const events = await getGoogleCalendarEvents();
    console.log("[/api/calendar] Sending", events.length, "events");
    res.json(events);
  } catch (err) {
    console.error("Calendar error:", err);
    res.status(500).json({ error: "Failed to fetch Google Calendar events" });
  }
});

app.post("/api/calendar/add", async (req, res) => {
  const { summary, description = "", startISO, endISO } = req.body;
  if (!summary || !startISO || !endISO) {
    return res
      .status(400)
      .json({ error: "summary, startISO y endISO son requeridos" });
  }

  try {
    const calendar = getCalendarClient();
    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
      requestBody: {
        summary,
        description,
        start: { dateTime: startISO },
        end: { dateTime: endISO },
      },
    });
    console.log("[/api/calendar/add] Evento creado:", event.data.id);
    res.json({ success: true, event: event.data });
  } catch (err) {
    console.error("Error insertando evento:", err);
    res.status(500).json({ error: "No se pudo crear el evento" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  console.log("[/api/chat] Incoming message:", message);
  console.log("[/api/chat] Body:", req.body);

  if (!message) return res.status(400).json({ error: "Message is required" });

  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️  OPENAI_API_KEY is not set in .env");
  }

  try {
    const upcomingEvents = await getGoogleCalendarEvents();
    const eventsPreview =
      upcomingEvents
        .slice(0, 5)
        .map(
          (e) =>
            `• ${e.summary || "Sin título"} — ${
              e.start.dateTime || e.start.date
            }`
        )
        .join("\n") || "No hay eventos próximos.";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres Olga, la Asistente personal de Luis Carlos Giraldo. No excedas 150 palabras en tus respuestas.\n\nAgenda próxima semana:\n${eventsPreview}`,
        },
        { role: "user", content: message },
      ],
      max_tokens: 200,
    });

    const reply = completion.choices[0].message.content;
    console.log("[/api/chat] Reply:", reply);
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Error processing request" });
  }
});

/* ------------ ElevenLabs TTS endpoint ------------ */
app.post("/api/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });

  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.9, speed: 1.2 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs error ${response.status}: ${errText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    return res.send(audioBuffer);
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: "Failed to synthesize speech" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});
