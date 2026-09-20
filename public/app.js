// ============================================================
// SISTEMA DE CONTROL DE ESTADO, ROUTING Y CONVERSACIÓN
// ============================================================
let currentRoute = "inicio";
let currentMode = "solve";
let isSubmitting = false;
let isSending = false;
let history = []; // [{ role: "user"|"assistant", content }] — se resetea al cambiar de modo
let pendingImages = []; // data URLs listas para enviar (solo modo Imaginar)
let lastImages = []; // últimas imágenes enviadas: viajan de nuevo si el usuario responde solo con texto
let stopActiveAudio = null;
let promptOn = true; // false = modo comparación: el modelo responde sin el prompt y el tema se invierte
const MAX_HISTORY_TURNS = 12;
const MAX_IMAGES = 3;
const MAX_IMAGE_CHARS = 1_200_000;

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

// Solo lo que es puramente de UI: a qué botón de nav corresponde cada modo.
const MODE_UI = {
  question: { navId: "nav-btn-question" },
  solve: { navId: "nav-btn-solve" },
  imagine: { navId: "nav-btn-imagine" },
};

// Contenido del selector desplegable
const ACCORDION = [
  {
    id: "question",
    code: "01",
    title: "CUESTIONAR",
    desc: "Examen crítico de una afirmación, una noticia o un texto: qué fuentes tiene, qué sesgos y qué fallas lógicas.",
    steps: [
      ["AFIRMACIÓN", "“El agua con limón elimina las toxinas.”"],
      ["CUESTIÓN", "¿Qué evidencia lo respalda?"],
      ["COMPROBACIÓN", "Sin fuentes identificables: confiabilidad BAJA"],
    ],
    features: ["Elegís el nivel: general, intermedio o especializado", "Veredicto ALTA, MEDIA o BAJA", "Guía para verificar por tu cuenta"],
  },
  {
    id: "solve",
    code: "02",
    title: "RESOLVER",
    desc: "Un tutor de matemática que no te da la respuesta: te guía con preguntas y pistas hasta que llegás vos.",
    steps: [
      ["DIAGNÓSTICO", "¿En qué nivel estás y qué te cuesta?"],
      ["PLAN", "El ejercicio dividido en pasos chicos"],
      ["PASO A PASO", "Vos hacés las cuentas, el tutor te acompaña"],
    ],
    features: ["Se adapta a tu nivel", "Nunca revela el resultado final", "Trabajás guiado o por tu cuenta"],
  },
  {
    id: "imagine",
    code: "03",
    title: "IMAGINAR",
    desc: "Convierte una foto en un relato hablado, fiel a lo que se ve, pensado para personas ciegas o con baja visión.",
    steps: [
      ["IMAGEN", "Adjuntás una foto"],
      ["OBSERVACIÓN", "Se registra solo lo que realmente se ve"],
      ["RELATO", "Una historia para escuchar, sin datos inventados"],
    ],
    features: ["Adjuntá hasta 3 imágenes", "Nivel de detalle: normal, detallada o muy detallada", "Escuchalo con voz de OpenAI"],
  },
];

// Se completa con /api/modes al cargar. El systemPrompt real nunca llega al navegador.
let MODES = {};

async function loadModes() {
  try {
    const res = await fetch("/api/modes");
    if (!res.ok) throw new Error("bad-response");
    const data = await res.json();
    data.forEach((m) => {
      MODES[m.id] = { ...m, ...MODE_UI[m.id] };
    });
    if (currentRoute === "modules") setMode(currentMode);
  } catch (err) {
    console.error("No se pudieron cargar los modos:", err);
  }
}

// Enrutador que conmuta las vistas del SPA
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

  if (targetId !== "view-modules" && !promptOn) {
    promptOn = true;
    updatePromptUI();
  }
  if (targetId === "view-modules") {
    const input = document.getElementById("user-input");
    if (input) autoGrow(input);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function routeToModule(modeKey) {
  setMode(modeKey);
  routeTo("modules");
}

// Configuración activa del módulo (Cuestionar, Resolver, Imaginar)
function setMode(modeKey) {
  currentMode = modeKey;
  if (!promptOn) {
    promptOn = true;
    updatePromptUI();
  }
  syncModeUI();
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

  const howtoEl = document.getElementById("mode-howto");
  if (howtoEl) {
    const steps = meta.howto || [];
    howtoEl.classList.toggle("hidden", !steps.length);
    howtoEl.innerHTML = steps
      .map(
        (t, i) =>
          `<li class="flex items-baseline gap-3 text-[14px] leading-relaxed text-on-surface-variant"><span class="font-mono text-[12px] text-outline">${String(i + 1).padStart(2, "0")}</span><span>${escapeHtml(t)}</span></li>`
      )
      .join("");
  }

  clearConversation();
}

// Imágenes y voz existen solo en el modo Imaginar
function setVisible(id, visible, displayClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden", !visible);
  if (displayClass) el.classList.toggle(displayClass, visible);
}

function syncModeUI() {
  const imagine = currentMode === "imagine";
  setVisible("imagine-inline-bar", imagine);
  setVisible("imagine-dropzone", imagine, "flex");
  setVisible("voice-wrap", imagine, "inline-flex");
}

// Formulario de acceso — puerta temática, no autenticación real.
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

// ============================================================
// SELECTOR DESPLEGABLE
// ============================================================
function renderAccordion() {
  const root = document.getElementById("mode-accordion");
  if (!root) return;

  root.innerHTML = ACCORDION.map(
    (m) => `
    <div class="acc-item px-2 sm:px-4 transition-colors hover:bg-surface-subtle/50" data-mode="${m.id}">
      <button aria-controls="acc-${m.id}" aria-expanded="false" class="acc-head w-full text-left py-7 sm:py-9 cursor-pointer" id="acc-btn-${m.id}" type="button">
        <div class="flex items-baseline justify-between gap-4">
          <div class="flex items-baseline space-x-4">
            <span class="text-[14px] font-mono text-outline">${m.code}</span>
            <h3 class="acc-title text-2xl sm:text-3xl font-semibold tracking-tight text-on-surface">${m.title}</h3>
          </div>
          <span aria-hidden="true" class="acc-icon text-[28px] leading-none text-on-surface font-light">+</span>
        </div>
        <p class="text-[14px] text-on-surface-variant mt-2 pl-9 max-w-xl">${m.desc}</p>
      </button>
      <div aria-labelledby="acc-btn-${m.id}" class="acc-panel" id="acc-${m.id}" inert role="region">
        <div>
          <div class="pl-9 pb-8 pt-1 space-y-6">
            <div class="acc-rule h-px bg-border-subtle"></div>
            <ol class="space-y-2.5">
              ${m.steps
                .map(
                  ([label, text], i) => `
                <li class="acc-step flex items-baseline gap-3 text-[13px]" style="--i:${i}">
                  <span aria-hidden="true" class="font-mono text-outline">↓</span>
                  <span class="text-[11px] uppercase tracking-wider text-outline w-28 shrink-0">${label}</span>
                  <span class="text-on-surface">${text}</span>
                </li>`
                )
                .join("")}
            </ol>
            <ul class="flex flex-wrap gap-2">
              ${m.features
                .map(
                  (f, i) =>
                    `<li class="acc-chip text-[12px] text-on-surface-variant border border-border-subtle px-3 py-1" style="--i:${i + m.steps.length}">${f}</li>`
                )
                .join("")}
            </ul>
            <div>
              <button class="acc-enter btn-cross-underline inline-flex items-center space-x-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface py-1.5 cursor-pointer" onclick="routeToModule('${m.id}')" style="--i:${m.steps.length + m.features.length}" type="button">
                <span>Entrar</span><span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`
  ).join("");

  root.querySelectorAll(".acc-head").forEach((head) => {
    head.addEventListener("click", () => toggleAccordion(head.closest(".acc-item")));
  });
}

function toggleAccordion(item) {
  const willOpen = !item.classList.contains("is-open");
  document.querySelectorAll("#mode-accordion .acc-item").forEach((other) => setAccordionState(other, false));
  if (willOpen) setAccordionState(item, true);
}

function setAccordionState(item, open) {
  item.classList.toggle("is-open", open);
  item.querySelector(".acc-head").setAttribute("aria-expanded", String(open));
  const panel = item.querySelector(".acc-panel");
  if (panel) panel.inert = !open;
}

// ============================================================
// CONVERSACIÓN
// ============================================================
function clearConversation() {
  currentConvoId = null;
  history = [];
  pendingImages = [];
  lastImages = [];
  renderAttachPreview();
  if (stopActiveAudio) stopActiveAudio();
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
  if (input) {
    input.value = "";
    autoGrow(input);
  }
}

// "Probar un ejemplo": muestra un caso fijo pre-armado para ilustrar el modo.
const EXAMPLES = {
  question: {
    label: "Pregunta planteada",
    query: "Leí que tomar agua con limón en ayunas desintoxica el hígado y quema grasas. ¿Qué tan cierto es?",
    html: `
      <div class="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Desglose crítico (ejemplo ilustrativo)</div>
      <div class="space-y-6 text-[15px] leading-relaxed text-on-surface">
        <div class="pb-3 border-b border-border-subtle">
          <span class="text-[12px] uppercase font-semibold text-outline block mb-1">Afirmación evaluada</span>
          <p class="italic">"Tomar agua con limón en ayunas desintoxica el hígado y disuelve tejido graso."</p>
        </div>
        <div>
          <span class="text-[12px] uppercase font-semibold block mb-1">Fuente</span>
          <p class="text-on-surface-variant">Sin fuente. No se cita ningún estudio ni dato que respalde la afirmación.</p>
        </div>
        <div>
          <span class="text-[12px] uppercase font-semibold block mb-1">Coherencia lógica</span>
          <p class="text-on-surface-variant">Salta de "el limón tiene vitamina C" a "desintoxica el hígado" sin explicar el mecanismo intermedio.</p>
        </div>
        <div>
          <span class="text-[12px] uppercase font-semibold block mb-1">Veredicto</span>
          <p class="text-on-surface font-semibold">Confiabilidad BAJA</p>
        </div>
      </div>`,
  },
  solve: {
    label: "Ejercicio planteado",
    query: "Quiero resolver 2x + 6 = 14.",
    html: `
      <div class="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Tutor socrático (ejemplo ilustrativo)</div>
      <div class="space-y-4 text-[15px] leading-relaxed text-on-surface">
        <p>¡Buenísimo, vamos a resolverlo juntos! Antes de empezar, ¿en qué período educativo estás?</p>
        <p class="text-on-surface-variant">Liceo ciclo básico</p>
        <p>Perfecto. Paso 1: queremos dejar la x sola de un lado. Para eso, primero hay que sacar el 6 que la acompaña. ¿Qué operación creés que nos sirve para "cancelar" ese + 6?</p>
      </div>`,
  },
  imagine: {
    label: "Imagen adjunta",
    query: "Andén de estación en penumbra.",
    html: `
      <div class="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Relato (ejemplo ilustrativo)</div>
      <div class="space-y-4 text-[16px] leading-[1.75] text-on-surface" data-speech>
        <p>El andén está casi vacío y la luz es baja, de esas que se sienten tibias en medio del frío. Los rieles se pierden a lo lejos, tan lejos que ningún ruido llega hasta acá.</p>
        <p>Todo parece quieto, como si la estación esperara algo. Queda la sensación de un silencio largo, de ese que aparece justo antes de que llegue un tren.</p>
      </div>`,
  },
};

function loadExampleScenario() {
  const emptyState = document.getElementById("empty-state-view");
  const stream = document.getElementById("conversation-stream");
  const ex = EXAMPLES[currentMode];
  if (!ex) return;

  if (emptyState) emptyState.classList.add("hidden");
  if (stream) {
    stream.classList.remove("hidden");
    stream.innerHTML = "";
  }

  const userNode = document.createElement("div");
  userNode.className = "msg-in pl-4 border-l border-on-surface/30";
  userNode.innerHTML = `
    <div class="text-[11px] uppercase tracking-wider text-outline mb-1 font-medium">${ex.label}</div>
    <p class="text-[18px] text-on-surface leading-snug font-medium">${escapeHtml(ex.query)}</p>
  `;
  if (stream) stream.appendChild(userNode);

  setTimeout(() => {
    const responseNode = document.createElement("div");
    responseNode.className = "space-y-6 pt-2";
    responseNode.innerHTML = `
      <div class="flex items-center space-x-2 text-[13px] font-semibold text-on-surface uppercase tracking-wider"><span>SECOND THOUGHT</span></div>
      ${ex.html}
    `;
    const speech = responseNode.querySelector("[data-speech]");
    if (speech) responseNode.appendChild(createListenControl(() => speech.innerText));
    revealElements(Array.from(responseNode.children));
    if (stream) {
      stream.appendChild(responseNode);
      responseNode.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, 180);
}

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
  node.className = "msg-in text-[14px] text-red-700 border-l border-red-700/40 pl-4";
  node.textContent = message;
  stream.appendChild(node);
  node.scrollIntoView({ behavior: "smooth", block: "end" });
}

// ============================================================
// FORMATO DE LAS RESPUESTAS (markdown básico → HTML seguro)
// ============================================================
function inlineFormat(raw) {
  return escapeHtml(raw)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)(?<!\s)\*(?=$|[\s).,;:!?])/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code class="font-mono text-[0.92em] bg-surface-subtle px-1">$1</code>');
}

// Pasa la notación LaTeX que a veces escribe el modelo sin prompt a texto legible.
function cleanMath(t) {
  return t
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => "\n\n" + m.trim() + "\n\n")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\\boxed\{([^}]*)\}/g, "$1")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\(?:text|mathrm)\{([^}]*)\}/g, "$1")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\approx/g, "≈")
    .replace(/\\neq/g, "≠")
    .replace(/\\leq?/g, "≤")
    .replace(/\\geq?/g, "≥")
    .replace(/\\pi/g, "π");
}

function renderRichText(text) {
  text = cleanMath(text);
  const lines = text.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;

  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l || "");
  const splitRow = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr class="border-border-subtle my-2" />');
      i++;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const size = h[1].length <= 2 ? "text-[17px]" : "text-[15px]";
      out.push(`<h4 class="${size} font-semibold text-on-surface pt-2">${inlineFormat(h[2])}</h4>`);
      i++;
      continue;
    }

    if (line.includes("|") && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        `<div class="overflow-x-auto"><table class="rich-table text-[14px] w-full"><thead><tr>${head
          .map((c) => `<th>${inlineFormat(c)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inlineFormat(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote class="border-l-2 border-on-surface/30 pl-4 text-on-surface-variant italic">${quote.map(inlineFormat).join("<br />")}</blockquote>`);
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        const indent = lines[i].match(/^\s*/)[0].length;
        items.push(`<li style="margin-left:${Math.min(indent, 8) * 6}px">${inlineFormat(lines[i].replace(/^\s*[-*•]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul class="list-disc pl-5 space-y-1.5">${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inlineFormat(lines[i].replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol class="list-decimal pl-5 space-y-1.5">${items.join("")}</ol>`);
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|\s*>|\s*[-*•]\s+|\s*\d+[.)]\s+|\s*(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i]) &&
      !(lines[i].includes("|") && isTableSep(lines[i + 1]))
    ) {
      para.push(inlineFormat(lines[i]));
      i++;
    }
    out.push(`<p>${para.join("<br />")}</p>`);
  }

  return out.join("");
}

// ============================================================
// APARICIÓN SECUENCIAL DE MENSAJES
// ============================================================
// Devuelve los elementos que entran uno por uno: cada hijo directo, y cada ítem de las listas.
function revealTargets(container) {
  const out = [];
  Array.from(container.children).forEach((el) => {
    if (el.tagName === "UL" || el.tagName === "OL") out.push(...el.children);
    else out.push(el);
  });
  return out;
}

function revealElements(els, start = 0) {
  let i = start;
  els.forEach((el) => {
    el.style.setProperty("--i", Math.min(i, 16));
    el.classList.add("reveal-item");
    i++;
  });
  return i;
}

// ============================================================
// SELECTOR DE VOZ (desplegable propio sobre el <select> oculto)
// ============================================================
function initVoicePicker() {
  const select = document.getElementById("voice-select");
  if (!select || select.dataset.enhanced) return;
  select.dataset.enhanced = "1";
  select.classList.add("sr-only");
  select.tabIndex = -1;

  const picker = document.createElement("div");
  picker.className = "voice-picker relative inline-block";
  picker.innerHTML = `
    <button aria-expanded="false" aria-haspopup="listbox" class="voice-btn inline-flex items-center gap-3 border border-border-subtle px-3.5 py-1.5 text-[12px] font-medium uppercase tracking-wide text-on-surface hover:border-on-surface transition-colors cursor-pointer" type="button">
      <span class="voice-current"></span><span aria-hidden="true" class="voice-chevron"></span>
    </button>
    <ul aria-label="Elegir voz" class="voice-menu absolute bottom-full left-0 mb-2 min-w-[168px] bg-background border border-border-subtle py-1.5 z-30" role="listbox"></ul>`;
  select.after(picker);

  const btn = picker.querySelector(".voice-btn");
  const menu = picker.querySelector(".voice-menu");
  const current = picker.querySelector(".voice-current");

  const options = Array.from(select.options).map((opt) => {
    const li = document.createElement("li");
    li.setAttribute("role", "presentation");
    li.innerHTML = `<button aria-selected="false" class="voice-option w-full flex items-center justify-between gap-6 px-4 py-2 text-left text-[12px] font-medium uppercase tracking-wide text-on-surface cursor-pointer" data-value="${opt.value}" role="option" tabindex="-1" type="button"><span>${opt.textContent}</span><span aria-hidden="true" class="voice-dot h-1.5 w-1.5 rounded-full bg-on-surface"></span></button>`;
    menu.appendChild(li);
    return li.firstElementChild;
  });

  const sync = () => {
    current.textContent = select.selectedOptions[0]?.textContent || "";
    options.forEach((o) => o.setAttribute("aria-selected", String(o.dataset.value === select.value)));
  };
  const setOpen = (open) => {
    picker.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) (options.find((o) => o.dataset.value === select.value) || options[0]).focus({ preventScroll: true });
  };

  btn.addEventListener("click", () => setOpen(!picker.classList.contains("is-open")));
  options.forEach((o) =>
    o.addEventListener("click", () => {
      select.value = o.dataset.value;
      select.dispatchEvent(new Event("change"));
      setOpen(false);
      btn.focus();
    })
  );
  picker.addEventListener("keydown", (e) => {
    const open = picker.classList.contains("is-open");
    if (e.key === "Escape" && open) {
      setOpen(false);
      btn.focus();
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && open) {
      e.preventDefault();
      const i = options.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (i + 1) % options.length : (i - 1 + options.length) % options.length;
      options[next].focus();
    } else if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  });
  document.addEventListener("click", (e) => {
    if (!picker.contains(e.target)) picker.classList.remove("is-open"), btn.setAttribute("aria-expanded", "false");
  });

  select.addEventListener("change", sync);
  sync();
  // el valor guardado se aplica después de crear el selector
  picker.syncVoice = sync;
  select.syncVoice = sync;
}

// ============================================================
// VOZ (texto a voz de OpenAI vía /api/tts)
// ============================================================
// Divide el texto en partes de hasta ~3000 caracteres cortando en fin de oración, para poder leerlo entero.
function splitForSpeech(raw, max = 3000) {
  const text = String(raw)
    .replace(/[*_`#>|]/g, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  const sentences = text.match(/[^.!?…\n]+(?:[.!?…]+|\n+|$)\s*/g) || [text];
  const parts = [];
  let cur = "";
  for (const raw of sentences) {
    let s = raw;
    while (s.length > max) {
      // frase larguísima: corte duro
      if (cur.trim()) {
        parts.push(cur.trim());
        cur = "";
      }
      parts.push(s.slice(0, max));
      s = s.slice(max);
    }
    if ((cur + s).length > max) {
      if (cur.trim()) parts.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.length ? parts : [text];
}

function createListenControl(getText) {
  const wrap = document.createElement("div");
  wrap.className = "pt-1";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "listen-btn inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-on-surface hover:opacity-60 transition-opacity border-b border-on-surface/40 pb-0.5 cursor-pointer";
  btn.innerHTML = `<span aria-hidden="true" class="eq"><i></i><i></i><i></i><i></i></span><span class="listen-label">Escuchar</span>`;
  wrap.appendChild(btn);

  const label = btn.querySelector(".listen-label");
  let audio = null;
  let run = 0; // cada reproducción tiene su número; al detener, las anteriores se descartan
  let busy = false;
  let cache = { voice: null, n: 0, parts: [] }; // audios ya generados (uno por parte)

  const stop = () => {
    run++;
    busy = false;
    btn.classList.remove("is-playing");
    label.textContent = "Escuchar";
    if (audio) {
      audio.pause();
      audio = null;
    }
    if (stopActiveAudio === stop) stopActiveAudio = null;
  };

  const fetchPart = (chunks, i, voice) => {
    if (!cache.parts[i]) {
      cache.parts[i] = fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunks[i], voice }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "No se pudo generar el audio.");
          }
          return URL.createObjectURL(await res.blob());
        })
        .catch((err) => {
          cache.parts[i] = null; // que un reintento vuelva a pedirlo
          throw err;
        });
    }
    return cache.parts[i];
  };

  const play = async () => {
    if (stopActiveAudio) stopActiveAudio();
    const token = ++run;
    const voice = document.getElementById("voice-select")?.value || "coral";
    const chunks = splitForSpeech(getText());
    if (cache.voice !== voice || cache.n !== chunks.length) {
      cache.parts.forEach((p) => p && p.then((u) => URL.revokeObjectURL(u)).catch(() => {}));
      cache = { voice, n: chunks.length, parts: [] };
    }
    busy = true;
    label.textContent = "Preparando voz…";
    try {
      for (let i = 0; i < chunks.length; i++) {
        const url = await fetchPart(chunks, i, voice);
        if (token !== run) return;
        if (i + 1 < chunks.length) fetchPart(chunks, i + 1, voice).catch(() => {}); // deja lista la siguiente parte mientras suena esta
        audio = new Audio(url);
        const ended = new Promise((resolve, reject) => {
          audio.addEventListener("ended", resolve);
          audio.addEventListener("error", () => reject(new Error("No se pudo reproducir el audio.")));
        });
        await audio.play();
        if (token !== run) return;
        btn.classList.add("is-playing");
        label.textContent = chunks.length > 1 ? "Detener · " + (i + 1) + "/" + chunks.length : "Detener";
        stopActiveAudio = stop;
        await ended;
        if (token !== run) return;
      }
      stop();
    } catch (err) {
      if (token !== run) return;
      stop();
      label.textContent = err.message || "No se pudo reproducir.";
      setTimeout(() => {
        if (!btn.classList.contains("is-playing") && !busy) label.textContent = "Escuchar";
      }, 3500);
    }
  };

  btn.addEventListener("click", () => {
    if (btn.classList.contains("is-playing") || busy) stop();
    else play();
  });

  return wrap;
}

// ============================================================
// IMÁGENES ADJUNTAS (modo Imaginar)
// ============================================================
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No pude leer esa imagen. Probá con JPG, PNG o WEBP."));
    };
    img.src = url;
  });
}

async function compressImage(file) {
  const img = await loadImageFile(file);
  let max = 1280;
  let quality = 0.82;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_IMAGE_CHARS) return dataUrl;
    max = Math.round(max * 0.75);
    quality = Math.max(0.6, quality - 0.08);
  }
  throw new Error("La imagen es demasiado pesada. Probá con otra más chica.");
}

function showAttachError(message) {
  let el = document.getElementById("attach-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "attach-error";
    el.setAttribute("role", "alert");
    el.className = "mt-2 text-[12px] text-red-700";
    document.getElementById("attach-preview")?.after(el);
  }
  el.textContent = message;
  clearTimeout(showAttachError.t);
  showAttachError.t = setTimeout(() => el.remove(), 5000);
}

async function addImageFiles(fileList) {
  if (currentMode !== "imagine") return;
  const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  if (!files.length) {
    if (fileList.length) showAttachError("Ese archivo no es una imagen.");
    return;
  }
  for (const file of files) {
    if (pendingImages.length >= MAX_IMAGES) {
      showAttachError(`Podés adjuntar hasta ${MAX_IMAGES} imágenes por mensaje.`);
      break;
    }
    try {
      pendingImages.push(await compressImage(file));
      renderAttachPreview();
    } catch (err) {
      showAttachError(err.message);
    }
  }
}

function renderAttachPreview() {
  const box = document.getElementById("attach-preview");
  if (!box) return;
  box.innerHTML = "";
  pendingImages.forEach((src, idx) => {
    const item = document.createElement("div");
    item.className = "thumb-in relative";
    item.innerHTML = `
      <img alt="Imagen adjunta ${idx + 1}" class="h-20 w-20 object-cover border border-border-subtle" src="${src}" />
      <button aria-label="Quitar imagen ${idx + 1}" class="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-on-surface text-background text-[11px] leading-none flex items-center justify-center cursor-pointer hover:opacity-70" type="button">×</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      pendingImages.splice(idx, 1);
      renderAttachPreview();
    });
    box.appendChild(item);
  });
}

// ============================================================
// ENVÍO Y RESPUESTA
// ============================================================
function autoGrow(el) {
  el.style.height = "auto";
  // Con el campo vacío, medimos usando el placeholder para que nunca quede cortado.
  const wasEmpty = !el.value;
  if (wasEmpty) el.value = el.placeholder;
  const h = el.scrollHeight;
  if (wasEmpty) el.value = "";
  if (!h) {
    el.style.height = "";
    return;
  }
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = Math.min(h + border, 224) + "px";
  el.style.overflowY = h > 224 ? "auto" : "hidden";
}

function buildUserNode({ text, images = [] }) {
  const node = document.createElement("div");
  node.className = "msg-in pl-4 border-l border-on-surface/30";
  node.innerHTML = `
    <div class="text-[11px] uppercase tracking-wider text-outline mb-1 font-medium">${images.length ? "Imagen y pedido" : "Interrogante"}</div>
    ${
      images.length
        ? `<div class="flex flex-wrap gap-3 mb-2">${images
            .map((src, n) => `<img alt="Imagen enviada ${n + 1}" class="h-28 max-w-[220px] object-cover border border-border-subtle" src="${src}" />`)
            .join("")}</div>`
        : ""
    }
    ${text ? `<p class="text-[17px] text-on-surface leading-snug font-medium whitespace-pre-wrap">${escapeHtml(text)}</p>` : ""}
  `;
  return node;
}

// animate = true: los bloques entran en secuencia. false: mensaje ya guardado, entra de una con un fundido.
function buildAssistantNode(answer, animate) {
  const resp = document.createElement("div");
  resp.className = animate ? "space-y-4 pt-2" : "msg-in space-y-4 pt-2";
  resp.innerHTML = `
    <div class="flex items-center space-x-2 text-[13px] font-semibold text-on-surface uppercase tracking-wider">
      <span>SECOND THOUGHT</span>
    </div>
    <div class="space-y-4 text-[15px] leading-relaxed text-on-surface" data-content>${renderRichText(answer)}</div>
  `;
  let idx = 0;
  if (animate) {
    idx = revealElements([resp.firstElementChild], 0);
    idx = revealElements(revealTargets(resp.querySelector("[data-content]")), idx);
  }
  if (currentMode === "imagine") {
    const listen = createListenControl(() => answer);
    if (animate) revealElements([listen], idx);
    resp.appendChild(listen);
  }
  return resp;
}

function makeThumb(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 160 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function handleSendMessage() {
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("btn-send");
  if (!input || isSending) return;
  const text = input.value.trim();
  const freshImages = currentMode === "imagine" ? pendingImages.slice() : [];
  // Si el modelo hizo una pregunta previa (nivel de detalle / registro) y el usuario
  // responde solo con texto, reenviamos la imagen para que el modelo siga viéndola.
  const reusedImages = currentMode === "imagine" && !freshImages.length && text ? lastImages.slice() : [];
  const images = freshImages.length ? freshImages : reusedImages;
  if (!text && !images.length) return;
  if (freshImages.length) lastImages = freshImages;

  const emptyState = document.getElementById("empty-state-view");
  const stream = document.getElementById("conversation-stream");

  if (emptyState) emptyState.classList.add("hidden");
  if (stream) stream.classList.remove("hidden");

  if (stream) stream.appendChild(buildUserNode({ text, images: freshImages }));
  input.value = "";
  autoGrow(input);
  pendingImages = [];
  renderAttachPreview();

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
        images,
        noPrompt: !promptOn,
        history: history.slice(-MAX_HISTORY_TURNS * 2),
      }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    removeThinkingNode();

    if (!res.ok) {
      throw new Error(data.error || (res.status === 413 ? "Las imágenes pesan demasiado. Probá con menos o más chicas." : "Error desconocido."));
    }

    const resp = buildAssistantNode(data.answer, true);
    if (stream) {
      stream.appendChild(resp);
      resp.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    history.push({ role: "user", content: [text, freshImages.length ? `[${freshImages.length} imagen(es) adjunta(s)]` : ""].filter(Boolean).join(" ") });
    history.push({ role: "assistant", content: data.answer });

    const thumbs = (await Promise.all(freshImages.map(makeThumb))).filter(Boolean);
    persistExchange({ role: "user", text, thumbs }, data.answer);
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

// ============================================================
// COMPARAR CON Y SIN EL PROMPT (tema invertido + círculo que se expande)
// ============================================================
function updatePromptUI() {
  document.documentElement.classList.toggle("theme-inverted", !promptOn);
  document.querySelectorAll("[data-toggle-prompt]").forEach((b) => {
    b.setAttribute("aria-pressed", String(!promptOn));
    b.classList.toggle("is-off", !promptOn);
    const label = b.querySelector(".prompt-toggle-label");
    if (label) label.textContent = promptOn ? "Probar sin el prompt" : "Volver a probar con el prompt";
  });
  document.getElementById("prompt-badge")?.classList.toggle("hidden", promptOn);
  const note = document.getElementById("compare-note");
  if (note) {
    note.classList.toggle("hidden", promptOn);
    note.textContent = promptOn
      ? ""
      : "Modo comparación: acá responde el modelo solo, sin el prompt de " + (MODES[currentMode]?.title || "este modo") + ". Enviá la misma consulta y compará las respuestas.";
  }
}

// Mensaje del usuario más largo de la conversación actual (es el que conviene repetir para comparar).
function longestUserText() {
  let best = "";
  history.forEach((m) => {
    if (m.role !== "user") return;
    const t = m.content.replace(/\s*\[[^\]]*imagen[^\]]*\]\s*$/i, "").trim();
    if (t.length > best.length) best = t;
  });
  return best;
}

// Círculo que crece desde (x, y) revelando el tema nuevo. Sin View Transitions o con "reducir movimiento", cambia directo.
function runCircleSpread(x, y, apply) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) {
    apply();
    return;
  }
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(apply);
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
        { duration: 750, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    })
    .catch(() => {});
}

// Deja lo que ya se conversó dentro de un globo con la paleta en la que se hizo (la contraria a la nueva).
function freezeConversation(wasPromptOn) {
  const stream = document.getElementById("conversation-stream");
  if (!stream) return false;
  const live = Array.from(stream.children).filter((el) => !el.classList.contains("convo-bubble"));
  if (!live.length) return false;

  const bubble = document.createElement("section");
  bubble.className = "convo-bubble space-y-8 " + (wasPromptOn ? "palette-light" : "palette-dark");
  bubble.setAttribute("aria-label", wasPromptOn ? "Conversación con el prompt" : "Conversación sin el prompt");
  const label = document.createElement("div");
  label.className = "text-[11px] uppercase tracking-[0.18em] font-medium text-outline";
  label.textContent = wasPromptOn ? "Con el prompt" : "Sin el prompt";
  bubble.appendChild(label);

  live.forEach((el) => {
    // sin animaciones de entrada: al mover el nodo se volverían a reproducir
    [el, ...el.querySelectorAll(".reveal-item, .msg-in")].forEach((n) => n.classList.remove("reveal-item", "msg-in"));
    el.style.opacity = "1";
    bubble.appendChild(el);
  });
  stream.appendChild(bubble);
  return true;
}

function switchPrompt(enable, x, y) {
  const prefill = longestUserText();
  const carriedImages = currentMode === "imagine" ? (lastImages.length ? lastImages.slice() : pendingImages.slice()) : [];
  const wasPromptOn = promptOn;
  runCircleSpread(x, y, () => {
    const frozen = freezeConversation(wasPromptOn);
    promptOn = enable;
    currentConvoId = null; // lo que sigue es una conversación nueva en el otro modo
    history = [];
    lastImages = [];
    if (stopActiveAudio) stopActiveAudio();
    if (frozen) {
      document.getElementById("empty-state-view")?.classList.add("hidden");
      document.getElementById("conversation-stream")?.classList.remove("hidden");
    }
    updatePromptUI();
    const input = document.getElementById("user-input");
    if (input && prefill && !input.value.trim()) {
      input.value = prefill; // misma consulta para poder comparar
      autoGrow(input);
    }
    pendingImages = carriedImages; // misma imagen en Imaginar
    renderAttachPreview();
    if (frozen) document.querySelector(".convo-bubble:last-of-type")?.scrollIntoView({ block: "nearest" });
  });
}

function initPromptToggle() {
  document.querySelectorAll("[data-toggle-prompt]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (isSending) return;
      const r = btn.getBoundingClientRect();
      const fromMouse = e.detail > 0 && (e.clientX || e.clientY);
      switchPrompt(!promptOn, fromMouse ? e.clientX : r.left + r.width / 2, fromMouse ? e.clientY : r.top + r.height / 2);
    });
  });
  updatePromptUI();
}

// ============================================================
// HISTORIAL (se guarda en este navegador, no en el servidor)
// ============================================================
const STORE_KEY = "st-history-v1";
const MAX_CONVOS = 40;
let currentConvoId = null;
let lastFocusBeforeHistory = null;

function readStore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeStore(list) {
  let l = list.slice(0, MAX_CONVOS);
  for (;;) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(l));
      return;
    } catch {
      if (l.length <= 1) return; // sin espacio o storage bloqueado: la app sigue funcionando sin guardar
      l = l.slice(0, -1); // descartamos la conversación más antigua y reintentamos
    }
  }
}

function newId() {
  return window.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Título: el mensaje más largo entre los primeros tres del usuario (el primero suele ser un saludo o una orden corta).
function makeTitle(messages) {
  const users = messages.filter((m) => m.role === "user").slice(0, 3);
  let best = null;
  users.forEach((m) => {
    if (!best || (m.text || "").length > (best.text || "").length) best = m;
  });
  const t = ((best && best.text) || "").replace(/\s+/g, " ").trim();
  if (t) return t.length > 70 ? t.slice(0, 67) + "…" : t;
  return users.some((m) => m.thumbs && m.thumbs.length) ? "Conversación con imagen" : "Conversación";
}

function persistExchange(userMsg, answer) {
  const now = Date.now();
  const list = readStore();
  let convo = list.find((c) => c.id === currentConvoId);
  if (convo) {
    list.splice(list.indexOf(convo), 1);
  } else {
    convo = { id: newId(), mode: currentMode, noPrompt: !promptOn, title: "", createdAt: now, updatedAt: now, messages: [] };
    currentConvoId = convo.id;
  }
  convo.messages.push(userMsg, { role: "assistant", text: answer });
  convo.title = makeTitle(convo.messages);
  convo.updatedAt = now;
  list.unshift(convo);
  writeStore(list);
  refreshHistoryUI();
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return "hace " + min + " min";
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return "hace " + hrs + (hrs === 1 ? " hora" : " horas");
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ayer";
  if (days < 7) return "hace " + days + " días";
  return new Date(ts).toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

function renderHistoryList() {
  const box = document.getElementById("history-list");
  if (!box) return;
  const list = readStore();
  if (!list.length) {
    box.innerHTML =
      '<p class="px-5 py-8 text-[13px] leading-relaxed text-on-surface-variant">Todavía no hay conversaciones. Las que tengas se guardan acá para que puedas retomarlas.</p>';
    return;
  }
  box.innerHTML = list
    .map((c, i) => {
      const meta = MODES[c.mode] || { code: "", title: "" };
      return (
        '<div class="history-item relative' + (c.id === currentConvoId ? " is-current" : "") + '" data-id="' + escapeHtml(c.id) + '" style="--i:' + Math.min(i, 12) + '">' +
        '<button class="history-row w-full text-left px-5 py-3.5 cursor-pointer" data-open="' + escapeHtml(c.id) + '" type="button">' +
        '<div class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-outline"><span>' + escapeHtml(meta.code + " · " + meta.title) + "</span><span>·</span><span>" + relativeTime(c.updatedAt) + "</span>" + (c.noPrompt ? "<span>·</span><span>SIN PROMPT</span>" : "") + "</div>" +
        '<div class="mt-1 pr-8 text-[14px] leading-snug text-on-surface line-clamp-2">' + escapeHtml(c.title || "Conversación") + "</div>" +
        "</button>" +
        '<button aria-label="Eliminar conversación" class="history-del absolute right-3 top-3.5 h-6 w-6 text-[18px] leading-none text-on-surface-variant hover:text-on-surface cursor-pointer" data-del="' + escapeHtml(c.id) + '" type="button">×</button>' +
        "</div>"
      );
    })
    .join("");
}

function refreshHistoryUI() {
  const n = readStore().length;
  document.querySelectorAll(".history-count").forEach((el) => {
    el.textContent = n ? "(" + n + ")" : "";
  });
  if (document.getElementById("history-drawer")?.classList.contains("is-open")) renderHistoryList();
}

function setHistoryOpen(open) {
  const drawer = document.getElementById("history-drawer");
  const panel = drawer?.querySelector(".history-panel");
  if (!drawer || !panel) return;
  if (open) {
    lastFocusBeforeHistory = document.activeElement;
    renderHistoryList();
    panel.inert = false;
    drawer.setAttribute("aria-hidden", "false");
    drawer.classList.add("is-open");
    setTimeout(() => panel.querySelector("[data-close-history]")?.focus({ preventScroll: true }), 60);
  } else {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    panel.inert = true;
    lastFocusBeforeHistory?.focus?.({ preventScroll: true });
  }
}

function openConversation(id) {
  const convo = readStore().find((c) => c.id === id);
  if (!convo) return;
  if (stopActiveAudio) stopActiveAudio();
  setMode(convo.mode); // limpia la pantalla y deja el modo listo
  routeTo("modules");
  if (convo.noPrompt) {
    promptOn = false;
    updatePromptUI();
  }
  currentConvoId = convo.id;
  history = convo.messages.map((m) => ({
    role: m.role,
    content: m.role === "user" ? [m.text, m.thumbs && m.thumbs.length ? "[imagen adjunta]" : ""].filter(Boolean).join(" ") : m.text,
  }));

  const emptyState = document.getElementById("empty-state-view");
  const stream = document.getElementById("conversation-stream");
  if (emptyState) emptyState.classList.add("hidden");
  if (stream) {
    stream.classList.remove("hidden");
    stream.innerHTML = "";
    convo.messages.forEach((m) => {
      stream.appendChild(m.role === "user" ? buildUserNode({ text: m.text, images: m.thumbs || [] }) : buildAssistantNode(m.text, false));
    });
  }
  setHistoryOpen(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteConversation(id) {
  const item = document.querySelector('.history-item[data-id="' + CSS.escape(id) + '"]');
  const finish = () => {
    writeStore(readStore().filter((c) => c.id !== id));
    if (currentConvoId === id) currentConvoId = null;
    refreshHistoryUI();
    renderHistoryList();
  };
  if (item) {
    item.classList.add("is-removing");
    setTimeout(finish, 300);
  } else {
    finish();
  }
}

function initHistory() {
  document.querySelectorAll("[data-open-history]").forEach((b) => b.addEventListener("click", () => setHistoryOpen(true)));
  document.querySelectorAll("[data-close-history]").forEach((b) => b.addEventListener("click", () => setHistoryOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("history-drawer")?.classList.contains("is-open")) setHistoryOpen(false);
  });
  document.getElementById("history-list")?.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      deleteConversation(del.dataset.del);
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) openConversation(open.dataset.open);
  });
  document.getElementById("history-new")?.addEventListener("click", () => {
    setHistoryOpen(false);
    if (currentRoute === "modules") clearConversation();
    else routeTo("selector");
  });
  document.getElementById("history-clear-all")?.addEventListener("click", () => {
    if (!readStore().length) return;
    if (confirm("¿Borrar todo el historial de este navegador? No se puede deshacer.")) {
      writeStore([]);
      currentConvoId = null;
      refreshHistoryUI();
      renderHistoryList();
    }
  });
  refreshHistoryUI();
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  loadModes();
  renderAccordion();
  initVoicePicker();
  initHistory();
  initPromptToggle();

  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);

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
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        handleSendMessage();
      }
    });
    userInput.addEventListener("input", () => autoGrow(userInput));
    window.addEventListener("resize", () => autoGrow(userInput));
    userInput.addEventListener("paste", (e) => {
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
      if (files.length && currentMode === "imagine") {
        e.preventDefault();
        addImageFiles(files);
      }
    });
  }

  const voice = document.getElementById("voice-select");
  if (voice) {
    try {
      const saved = localStorage.getItem("st-voice");
      if (saved) {
        voice.value = saved;
        voice.syncVoice?.();
      }
    } catch {}
    voice.addEventListener("change", () => {
      try {
        localStorage.setItem("st-voice", voice.value);
      } catch {}
    });
  }

  const fileInput = document.getElementById("file-input");
  document.getElementById("btn-attach")?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", () => {
    addImageFiles(fileInput.files);
    fileInput.value = "";
  });

  document.getElementById("imagine-dropzone")?.addEventListener("click", () => fileInput?.click());

  const zone = document.getElementById("view-modules");
  if (zone) {
    ["dragenter", "dragover"].forEach((ev) =>
      zone.addEventListener(ev, (e) => {
        if (currentMode !== "imagine") return;
        e.preventDefault();
        zone.classList.add("drop-active");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      zone.addEventListener(ev, (e) => {
        if (ev === "drop" && currentMode === "imagine") {
          e.preventDefault();
          addImageFiles(e.dataTransfer?.files || []);
        }
        zone.classList.remove("drop-active");
      })
    );
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
