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

function renderRichText(text) {
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
function prepareSpeechText(raw) {
  let text = String(raw)
    .replace(/[*_`#>|]/g, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  if (text.length > 4000) {
    const cut = text.slice(0, 4000);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
    text = end > 1500 ? cut.slice(0, end + 1) : cut;
  }
  return text;
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
  let blobUrl = null;
  let cachedVoice = null;
  let audio = null;
  let busy = false;

  const reset = () => {
    btn.classList.remove("is-playing");
    label.textContent = "Escuchar";
    busy = false;
    if (audio) {
      audio.pause();
      audio = null;
    }
    if (stopActiveAudio === reset) stopActiveAudio = null;
  };

  btn.addEventListener("click", async () => {
    if (btn.classList.contains("is-playing") || busy) {
      reset();
      return;
    }
    if (stopActiveAudio) stopActiveAudio();

    const voice = document.getElementById("voice-select")?.value || "coral";
    busy = true;
    label.textContent = "Preparando voz…";
    try {
      if (!blobUrl || cachedVoice !== voice) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: prepareSpeechText(getText()), voice }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo generar el audio.");
        }
        blobUrl = URL.createObjectURL(await res.blob());
        cachedVoice = voice;
      }
      if (!busy) return; // el usuario canceló mientras se generaba
      audio = new Audio(blobUrl);
      audio.addEventListener("ended", reset);
      await audio.play();
      btn.classList.add("is-playing");
      label.textContent = "Detener";
      stopActiveAudio = reset;
    } catch (err) {
      reset();
      label.textContent = err.message || "No se pudo reproducir.";
      setTimeout(() => {
        if (!btn.classList.contains("is-playing") && !busy) label.textContent = "Escuchar";
      }, 3500);
    }
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

  const userNode = document.createElement("div");
  userNode.className = "msg-in pl-4 border-l border-on-surface/30";
  userNode.innerHTML = `
    <div class="text-[11px] uppercase tracking-wider text-outline mb-1 font-medium">${freshImages.length ? "Imagen y pedido" : "Interrogante"}</div>
    ${
      freshImages.length
        ? `<div class="flex flex-wrap gap-3 mb-2">${freshImages
            .map((s, n) => `<img alt="Imagen enviada ${n + 1}" class="h-28 max-w-[220px] object-cover border border-border-subtle" src="${s}" />`)
            .join("")}</div>`
        : ""
    }
    ${text ? `<p class="text-[17px] text-on-surface leading-snug font-medium whitespace-pre-wrap">${escapeHtml(text)}</p>` : ""}
  `;
  if (stream) stream.appendChild(userNode);
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

    const resp = document.createElement("div");
    resp.className = "space-y-4 pt-2";
    resp.innerHTML = `
      <div class="flex items-center space-x-2 text-[13px] font-semibold text-on-surface uppercase tracking-wider">
        <span>SECOND THOUGHT</span>
      </div>
      <div class="space-y-4 text-[15px] leading-relaxed text-on-surface" data-content>${renderRichText(data.answer)}</div>
    `;
    let revealIdx = revealElements([resp.firstElementChild], 0);
    revealIdx = revealElements(revealTargets(resp.querySelector("[data-content]")), revealIdx);
    if (currentMode === "imagine") {
      const listen = createListenControl(() => data.answer);
      revealElements([listen], revealIdx);
      resp.appendChild(listen);
    }
    if (stream) {
      stream.appendChild(resp);
      resp.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    history.push({ role: "user", content: [text, freshImages.length ? `[${freshImages.length} imagen(es) adjunta(s)]` : ""].filter(Boolean).join(" ") });
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

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  loadModes();
  renderAccordion();
  initVoicePicker();

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
