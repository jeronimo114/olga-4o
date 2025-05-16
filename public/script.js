// public/script.js — CLIENT SIDE
console.log("🌐 Client script loaded");

// --- Element references ---
const hiddenInput = document.getElementById("hiddenInput");
const btnSend = document.getElementById("btnSend");
const btnVoice = document.getElementById("btnVoice");
const calendarBtn = document.getElementById("btnFetchCalendar");
const calendarList = document.getElementById("calendarEvents");

const listeningClass = "listening";

// --- Speech‑to‑Text (Web Speech API) ---
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "es-ES"; // change language if needed
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = ""; // mantiene la frase definitiva

  recognition.addEventListener("result", (event) => {
    let interim = "";
    // Recorre los resultados para capturar parciales y finales
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const res = event.results[i];
      if (res.isFinal) {
        finalTranscript += res[0].transcript;
      } else {
        interim += res[0].transcript;
      }
    }
    // Muestra en vivo lo que el usuario va diciendo
    hiddenInput.value = (finalTranscript + interim).trimStart();
    hiddenInput.focus();
  });

  recognition.addEventListener("audiostart", () => {
    btnVoice?.classList.add(listeningClass);
  });

  recognition.addEventListener("end", () => {
    btnVoice?.classList.remove(listeningClass);
    console.log("🎙️ STT sesión finalizada");
  });

  recognition.addEventListener("error", (e) => {
    console.error("STT error:", e.error);
    if (e.error === "network") {
      alert(
        "Sin conexión con el servicio de reconocimiento de voz. Revisa tu internet o inténtalo de nuevo más tarde."
      );
    } else if (e.error === "not-allowed") {
      alert(
        "Permiso de micrófono denegado. Actívalo en la configuración del navegador e inténtalo de nuevo."
      );
    }
  });
} else {
  console.warn("⚠️ Web Speech API is not supported in this browser.");
}

btnVoice?.addEventListener("click", () => {
  if (!recognition) return;
  try {
    hiddenInput.value = "";
    finalTranscript = "";
    recognition.abort(); // reinicia la sesión anterior si existe
    recognition.start();
  } catch (err) {
    console.error("STT start failed:", err);
  }
});

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
