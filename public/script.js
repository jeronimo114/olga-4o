// public/script.js — CLIENT SIDE
console.log("🌐 Client script loaded");

// --- Element references ---
const hiddenInput = document.getElementById("hiddenInput");
const btnSend = document.getElementById("btnSend");
const calendarBtn = document.getElementById("btnFetchCalendar");
const calendarList = document.getElementById("calendarEvents");

// --- Send text to /api/chat ---
btnSend?.addEventListener("click", async () => {
  const text = hiddenInput.value.trim();
  if (!text) return;

  // Clear input for UX
  hiddenInput.value = "";

  console.log("➡️ POST /api/chat", { message: text });

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    const { reply } = await res.json();
    console.log("✅ Chat reply:", reply);
    // Fetch TTS audio and play
    try {
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      if (ttsRes.ok) {
        const arrayBuf = await ttsRes.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
      } else {
        console.error("TTS fetch status", ttsRes.status);
      }
    } catch (ttsErr) {
      console.error("TTS fetch failed:", ttsErr);
    }
    // alert(reply || "Sin respuesta del asistente.");
  } catch (err) {
    console.error("❌ Chat request failed:", err);
    alert("Ocurrió un error al enviar el mensaje.");
  }
});

// --- Fetch calendar events ---
calendarBtn?.addEventListener("click", async () => {
  console.log("➡️ GET /api/calendar");
  try {
    const res = await fetch("/api/calendar");
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const events = await res.json();

    console.log("✅ Calendar events received:", events.length);

    calendarList.innerHTML = events
      .map(
        (e) =>
          `<li>${e.summary || "Sin título"} — ${
            e.start.dateTime || e.start.date
          }</li>`
      )
      .join("");
  } catch (err) {
    console.error("❌ Calendar request failed:", err);
    alert("No se pudieron cargar los eventos.");
  }
});
