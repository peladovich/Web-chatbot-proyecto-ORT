// ============================================================
// SISTEMA DE CONTROL DE ESTADO, ROUTING Y CONVERSACIÓN
// ============================================================
let currentRoute = "inicio";
let currentMode = "solve";
let isSubmitting = false;
let isSending = false;
let history = []; // [{ role: "user"|"assistant", content }] — se resetea al cambiar de modo
const MAX_HISTORY_TURNS = 12;

const VIEWS = {
  inicio: "view-inicio",
  login: "view-login",
  selector: "view-selector",
  cuestionar: "view-modules",
  resolver: "view-modules",
  imaginar: "view-modules",
  modules: "view-modules",
  manifesto: "view-manifesto",
};

// Solo lo que es puramente de UI (no viene del backend): a qué botón de
// nav corresponde cada modo, y el ejemplo fijo que muestra "PROBAR UN EJEMPLO".
const MODE_UI = {
  question: {
    navId: "nav-btn-question",
    example: {
      userQuery:
        "Leí que tomar agua con limón en ayunas desintoxica el hígado y quema grasas. ¿Qué tan cierto es?",
    },
  },
  solve: {
    navId: "nav-btn-solve",
    example: {
      userQuery:
        "Una pelota se suelta desde un balcón a 20 metros de altura en caída libre. ¿Cuánto tiempo tarda exactamente en llegar al suelo?",
    },
  },
  imagine: {
    navId: "nav-btn-imagine",
    example: {
      userQuery: "Escribí una escena a partir de la atmósfera de esta estación en penumbra.",
    },
  },
};

// Se completa con /api/modes al cargar (code, title, eyebrow, heading,
// subtext, placeholder). El systemPrompt real nunca llega al navegador.
let MODES = {};

async function loadModes() {
  try {
    const res = await fetch("/api/modes");
    if (!res.ok) throw new Error("bad-response");
    const data = await res.json();
    data.forEach((m) => {
      MODES[m.id] = { ...m, ...MODE_UI[m.id] };
    });
  } catch (err) {
    console.error("No se pudieron cargar los modos:", err);
  }
}

// Enrutador fluído que conmuta de forma instantánea y limpia las vistas del SPA
function routeTo(viewName) {
  currentRoute = viewName;

  let targetId = VIEWS[viewName];
  if (!targetId) {
    if (viewName === "cuestionar") {
      targetId = "view-modules";
      setMode("question");
    } else if (viewName === "resolver") {
      targetId = "view-modules";
      setMode("solve");
    } else if (viewName === "imaginar") {
      targetId = "view-modules";
      setMode("imagine");
    } else if (viewName === "manifiesto" || viewName === "manifesto") {
      targetId = "view-manifesto";
    } else {
      targetId = "view-inicio";
    }
  }

  ["view-inicio", "view-login", "view-selector", "view-modules", "view-manifesto"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === targetId) {
      el.classList.remove("is-hidden");
      el.classList.add("is-active");
    } else {
      el.classList.add("is-hidden");
      el.classList.remove("is-active");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Navegar directamente a un módulo específico desde el selector o links
function routeToModule(modeKey) {
  setMode(modeKey);
  routeTo("modules");
}

// Configuración activa del módulo (Cuestionar, Resolver, Imaginar)
function setMode(modeKey) {
  currentMode = modeKey;
  const meta = MODES[modeKey];
  if (!meta) return;

  const codeEl = document.getElementById("header-mode-code");
  const titleEl = document.getElementById("header-mode-title");
  if (codeEl) codeEl.innerText = meta.code;
  if (titleEl) titleEl.innerText = meta.title;

  ["nav-btn-question", "nav-btn-solve", "nav-btn-imagine"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (id === meta.navId) {
      btn.className = "py-1 text-on-surface font-semibold border-b border-on-surface transition-colors cursor-pointer";
    } else {
      btn.className = "py-1 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer";
    }
  });

  const traceEl = document.getElementById("empty-mode-trace");
  const headingEl = document.getElementById("empty-mode-heading");
  const subtextEl = document.getElementById("empty-mode-subtext");
  const inputEl = document.getElementById("user-input");

  if (traceEl) traceEl.innerText = meta.eyebrow;
  if (headingEl) headingEl.innerText = meta.heading;
  if (subtextEl) subtextEl.innerText = meta.subtext;
  if (inputEl) inputEl.setAttribute("placeholder", meta.placeholder);

  const imgBar = document.getElementById("imagine-inline-bar");
  if (imgBar) {
    if (modeKey === "imagine") {
      imgBar.classList.remove("hidden");
    } else {
      imgBar.classList.add("hidden");
    }
  }

  clearConversation();
}

// Gestión del Formulario de Acceso — puerta temática, no autenticación real.
// Acepta cualquier usuario/contraseña no vacíos, igual que en el diseño original.
function handleLoginSubmit(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (isSubmitting) return;

  const usernameInput = document.getElementById("login-username");
  const passwordInput = document.getElementById("login-password");
  const feedback = document.getElementById("login-feedback");
  const btnText = document.getElementById("login-btn-text");
  const btnArrow = document.getElementById("login-btn-arrow");
  const submitBtn = document.getElementById("btn-login-submit");

  const userVal = usernameInput ? usernameInput.value.trim() : "";
  const passVal = passwordInput ? passwordInput.value.trim() : "";

  if (!userVal || !passVal) {
    if (feedback) {
      feedback.innerText = "POR FAVOR INGRESÁ USUARIO Y CONTRASEÑA";
      feedback.classList.remove("text-outline");
      feedback.classList.add("text-red-700", "font-semibold");
    }
    if (submitBtn) {
      submitBtn.classList.remove("shake-error");
      void submitBtn.offsetWidth;
      submitBtn.classList.add("shake-error");
    }
    return;
  }

  isSubmitting = true;
  if (feedback) {
    feedback.innerText = "ACCEDIENDO AL SELECTOR...";
    feedback.classList.remove("text-red-700");
    feedback.classList.add("text-outline");
  }
  if (btnText) btnText.innerText = "ENTRANDO";
  if (btnArrow) btnArrow.innerText = "→";
  if (submitBtn) submitBtn.style.opacity = "0.7";

  setTimeout(() => {
    isSubmitting = false;
    if (btnText) btnText.innerText = "ENTRAR";
    if (submitBtn) submitBtn.style.opacity = "1";
    routeTo("selector");
  }, 300);
}

// Limpieza de conversación (también resetea el historial que se manda al backend)
function clearConversation() {
  history = [];
  const stream = document.getElementById("conversation-stream");
  const emptyState = document.getElementById("empty-state-view");
  if (stream) {
    stream.innerHTML = "";
    stream.classList.add("hidden");
  }
  if (emptyState) {
    emptyState.classList.remove("hidden");
  }
  const input = document.getElementById("user-input");
  if (input) input.value = "";
}

// "Probá un ejemplo": muestra un caso fijo pre-armado para ilustrar el modo.
// Es una vidriera, no una consulta real — se mantiene con texto fijo a propósito.
function loadExampleScenario() {
  const emptyState = document.getElementById("empty-state-view");
  const stream = document.getElementById("conversation-stream");
  const meta = MODE_UI[currentMode];
  if (!meta) return;

  if (emptyState) emptyState.classList.add("hidden");
  if (stream) {
    stream.classList.remove("hidden");
    stream.innerHTML = "";
  }

  const userNode = document.createElement("div");
  userNode.className = "fade-enter pl-4 border-l border-on-surface/30";
  userNode.innerHTML = `
    <div class="text-[11px] uppercase tracking-wider text-outline mb-1 font-medium">Pregunta planteada</div>
    <p class="text-[18px] text-on-surface leading-snug font-medium">${escapeHtml(meta.example.userQuery)}</p>
  `;
  if (stream) stream.appendChild(userNode);

  setTimeout(() => {
    const responseNode = document.createElement("div");
    responseNode.className = "space-y-6 pt-2";

    let editorialHtml = "";

    if (currentMode === "question") {
      editorialHtml = `
        <div class="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Desglose Crítico</div>
        <div class="space-y-6 text-[15px] leading-relaxed text-on-surface">
          <div class="pb-3 border-b border-border-subtle">
            <span class="text-[12px] uppercase font-semibold text-outline block mb-1">Afirmación evaluada</span>
            <p class="italic text-on-surface">"Tomar agua con limón en ayunas desintoxica el hígado y disuelve tejido graso."</p>
          </div>
          <div>
            <span class="text-[12px] uppercase font-semibold text-on-surface block mb-1">Evidencia real</span>
            <p class="text-on-surface-variant">El agua con limón aporta hidratación y vitamina C. Sin embargo, la eliminación de metabolitos y toxinas endógenas corresponde exclusivamente a la filtración renal y al catabolismo hepático. Ningún componente químico del limón posee mecanismos catalizadores directos sobre la lipólisis o la detoxificación celular.</p>
          </div>
          <div>
            <span class="text-[12px] uppercase font-semibold text-on-surface block mb-1">Posible sesgo de percepción</span>
            <p class="text-on-surface-variant">Asociación inmediata entre la acidez sensorial y la sensación de pureza orofaríngea con una depuración biológica profunda que no ocurre a nivel de tejidos.</p>
          </div>
          <div>
            <span class="text-[12px] uppercase font-semibold text-on-surface block mb-1">Incertidumbre o matiz comprobable</span>
            <p class="text-on-surface-variant">El efecto beneficioso reside en el reemplazo de bebidas hipercalóricas y en el hábito saludable de beber agua al despertar, no en propiedades milagrosas de la fruta.</p>
          </div>
        </div>
      `;
    } else if (currentMode === "solve") {
      editorialHtml = `
        <div class="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Deducción Matemática y Cinemática</div>
        <div class="space-y-5 text-[15px] leading-relaxed">
          <div class="space-y-3 pb-4 border-b border-border-subtle">
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-1">
              <span class="text-[13px] font-semibold text-on-surface">1. Datos iniciales:</span>
              <span class="sm:col-span-3 text-on-surface-variant">Altura inicial (h) = 20 m · Velocidad inicial (v₀) = 0 m/s · Aceleración (g) = 9,8 m/s²</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-1">
              <span class="text-[13px] font-semibold text-on-surface">2. Ecuación:</span>
              <span class="sm:col-span-3 text-on-surface-variant">h = v₀ · t + ½ · g · t²</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-1">
              <span class="text-[13px] font-semibold text-on-surface">3. Procedimiento:</span>
              <span class="sm:col-span-3 text-on-surface-variant">20 = ½ · (9,8) · t²  →  20 = 4,9 · t²  →  t² = 20 / 4,9 ≈ 4,0816</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-1 pt-1">
              <span class="text-[13px] font-semibold text-on-surface">4. Solución:</span>
              <span class="sm:col-span-3 text-on-surface font-semibold text-[16px]">t = √4,0816 ≈ 2,02 segundos</span>
            </div>
          </div>
          <p class="text-[14px] text-on-surface-variant italic">¿Querés formular otra condición inicial o incorporar resistencia viscosa del aire?</p>
        </div>
      `;
    } else if (currentMode === "imagine") {
      editorialHtml = `
        <div class="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Narración Literaria</div>
        <div class="space-y-6">
          <figure class="my-3">
            <img
              src="https://lh3.googleusercontent.com/aida/AEtjO1XrjF3JBmFh_6UqHOPGNYydXHLi6BKkLr_AsUCgHggBkR3ygf3wqI9gX-vHRChb3kMS1ryfzakCK4tENC2VickHzmOCedAsJy0Ru05_AWC4xfWBPNycHBomR5PcCzpm4EybnngjQg2WkNRYqACAYo9mqfoKbhWTGseZ9svKbd5h8ZvX13QyofZdawZGQ6mHQLTXJCZjKEDGSPIQ__WI7wEY8ysVNSi_HSAdgzWw0Qw1Ax7XOcbR9unT6Q"
              alt="Fotografía documental de un andén de estación en penumbra y luz tenue"
              class="w-full h-auto max-h-[420px] object-cover filter contrast-[1.02]"
            />
            <figcaption class="mt-2 text-[12px] text-outline italic text-left">Andén exterior. Tarde serena previa a la partida.</figcaption>
          </figure>
          <div class="space-y-4 text-[16px] leading-[1.75] text-on-surface">
            <p>El andén olía a hierro frío y a ese vapor espeso que suele preceder a la noche. Elena no miraba el reloj del panel ni revisaba el equipaje apoyado junto al banco de madera; esperaba el silbido sordo de las seis y media no para partir, sino para tener la certeza de que el día concluía formalmente.</p>
            <p>A través de los cristales opacos de la garita, la luz caía oblicua sobre los rieles gastados. El convoy distante aminoró su marcha con un quejido mecánico, y en ese breve intervalo en que cesa toda prisa, la estación entera pareció quedar suspendida en un murmullo de aire tibio.</p>
          </div>
        </div>
      `;
    }

    responseNode.innerHTML = `
      <div class="flex items-center space-x-2 text-[13px] font-semibold text-on-surface uppercase tracking-wider">
        <span>SECOND THOUGHT</span>
      </div>
      ${editorialHtml}
    `;

    if (stream) {
      stream.appendChild(responseNode);
      responseNode.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, 180);
}

// Indicador de espera mínimo, en el mismo registro tipográfico que el resto
function appendThinkingNode() {
  const stream = document.getElementById("conversation-stream");
  if (!stream) return;
  const node = document.createElement("div");
  node.id = "thinking-node";
  node.className = "flex items-center space-x-2 text-[13px] font-medium text-on-surface-variant uppercase tracking-wider";
  node.innerHTML = `<span>SECOND THOUGHT</span><span class="thinking-dots text-on-surface" aria-hidden="true">···</span>`;
  stream.appendChild(node);
  node.scrollIntoView({ behavior: "smooth", block: "end" });
}

function removeThinkingNode() {
  document.getElementById("thinking-node")?.remove();
}

function appendErrorNode(message) {
  const stream = document.getElementById("conversation-stream");
  if (!stream) return;
  const node = document.createElement("div");
  node.setAttribute("role", "alert");
  node.className = "text-[14px] text-red-700 border-l border-red-700/40 pl-4";
  node.textContent = message;
  stream.appendChild(node);
  node.scrollIntoView({ behavior: "smooth", block: "end" });
}

function renderAiParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

// Envío y respuesta real (vía backend) de mensajes del usuario
async function handleSendMessage() {
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("btn-send");
  if (!input || isSending) return;
  const text = input.value.trim();
  if (!text) return;

  const emptyState = document.getElementById("empty-state-view");
  const stream = document.getElementById("conversation-stream");

  if (emptyState) emptyState.classList.add("hidden");
  if (stream) stream.classList.remove("hidden");

  const userNode = document.createElement("div");
  userNode.className = "pl-4 border-l border-on-surface/30";
  userNode.innerHTML = `
    <div class="text-[11px] uppercase tracking-wider text-outline mb-1 font-medium">Interrogante</div>
    <p class="text-[17px] text-on-surface leading-snug font-medium">${escapeHtml(text)}</p>
  `;
  if (stream) stream.appendChild(userNode);
  input.value = "";

  isSending = true;
  input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  appendThinkingNode();

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: currentMode,
        userInput: text,
        history: history.slice(-MAX_HISTORY_TURNS * 2),
      }),
    });

    const data = await res.json();
    removeThinkingNode();

    if (!res.ok) {
      throw new Error(data.error || "Error desconocido.");
    }

    const resp = document.createElement("div");
    resp.className = "space-y-4 pt-2";
    resp.innerHTML = `
      <div class="flex items-center space-x-2 text-[13px] font-semibold text-on-surface uppercase tracking-wider">
        <span>SECOND THOUGHT</span>
      </div>
      <div class="space-y-4 text-[15px] leading-relaxed text-on-surface">
        ${renderAiParagraphs(data.answer)}
      </div>
    `;
    if (stream) {
      stream.appendChild(resp);
      resp.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: data.answer });
  } catch (err) {
    removeThinkingNode();
    appendErrorNode(err.message || "No se pudo conectar con el servidor. Intentá de nuevo.");
  } finally {
    isSending = false;
    input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

function swapImageContext() {
  alert("En el modo Imaginar podés proponer cualquier escena o atmósfera literaria para abrir una nueva secuencia narrativa.");
}

// Inicializar listeners
document.addEventListener("DOMContentLoaded", () => {
  loadModes();

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  ["login-username", "login-password"].forEach((id) => {
    const field = document.getElementById(id);
    if (field) {
      field.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleLoginSubmit(e);
        }
      });
    }
  });

  const userInput = document.getElementById("user-input");
  if (userInput) {
    userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }
});

function escapeHtml(string) {
  const entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
  };
  return String(string).replace(/[&<>"'/]/g, (s) => entityMap[s]);
}
