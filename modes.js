/**
 * LOS 3 MODOS DE SECOND THOUGHT
 *
 * Los prompts reales viven, tal cual fueron escritos, en /prompts/*.txt.
 * Este archivo solo los carga y agrega el texto de interfaz de cada modo.
 * Los system prompts nunca se mandan al navegador.
 *
 * IMPORTANTE: `id` tiene que matchear los `modeKey` que usa public/app.js
 * ('question' | 'solve' | 'imagine').
 */
const fs = require("fs");
const path = require("path");

// Rutas literales a propósito: así el empaquetado de Vercel detecta los archivos.
const QUESTION_PROMPT = fs.readFileSync(path.join(__dirname, "prompts", "question.txt"), "utf8").trim();
const SOLVE_PROMPT = fs.readFileSync(path.join(__dirname, "prompts", "solve.txt"), "utf8").trim();
const IMAGINE_PROMPT = fs.readFileSync(path.join(__dirname, "prompts", "imagine.txt"), "utf8").trim();

// Instrucciones técnicas de la interfaz, separadas del prompt original.
const QUESTION_EXTRA = `

---
## INSTRUCCIONES DE EJECUCIÓN DE LA INTERFAZ

Cumplimiento estricto de fases, un paso por turno: las fases de este prompt (pedir contenido, preguntar nivel de audiencia, entregar el análisis) se ejecutan una por turno, nunca combinadas. Prohibido entregar el análisis en el mismo turno en que todavía no tenés el contenido o el nivel de audiencia confirmados por el usuario. Esperá siempre la respuesta del usuario antes de avanzar de fase.`;

const SOLVE_EXTRA = `

---
## INSTRUCCIONES DE EJECUCIÓN DE LA INTERFAZ

Cumplimiento estricto del diagnóstico, un paso por turno: nunca expliques el tema, muestres el plan ni resuelvas nada antes de completar el diagnóstico del Bloque 3, aunque el alumno pegue el ejercicio completo, pida que se lo expliques, diga que tiene apuro o que ya sabe lo que quiere. Tu primer mensaje es solo la pregunta del período educativo. Hacé las preguntas del diagnóstico en el orden del Bloque 3, sin saltearlas. Si el alumno ya informó por su cuenta algún dato del diagnóstico (por ejemplo su período o su nivel), no se lo repitas, pero seguí preguntando los que falten antes de explicar o resolver.

La interfaz no renderiza LaTeX. Escribí las fórmulas solo con caracteres de texto plano (×, ÷, √, ², ³, ≈, π), nunca con comandos como \\frac, \\( o \\[.`;

const modes = [
  {
    id: "question",
    code: "01",
    title: "CUESTIONAR",
    eyebrow: "AFIRMAR → CUESTIONAR → COMPROBAR",
    heading: "¿Qué certeza querés poner a prueba?",
    subtext:
      "Pegá un texto, una noticia o una afirmación. Analizamos sus fuentes, sesgos y fallas lógicas, y te decimos qué tan confiable es.",
    placeholder: "Primero escribí: Quiero analizar un texto",
    howto: [
      "Escribí «Quiero analizar un texto». La primera respuesta siempre es «Prompt procesado correctamente…»: es normal, significa que está listo.",
      "Pegá el texto, la noticia o la afirmación que querés examinar.",
      "Elegí el nivel de la respuesta: general, intermedio o especializado.",
    ],
    systemPrompt: QUESTION_PROMPT + QUESTION_EXTRA,
  },
  {
    id: "solve",
    code: "02",
    title: "RESOLVER",
    eyebrow: "DIAGNOSTICAR → GUIAR → COMPROBAR",
    heading: "¿Qué ejercicio querés resolver?",
    subtext:
      "Un tutor de matemática que no te da la respuesta: te acompaña con preguntas y pistas para que llegues vos.",
    placeholder: "Contame el tema o pegá el ejercicio de matemática...",
    systemPrompt: SOLVE_PROMPT + SOLVE_EXTRA,
  },
  {
    id: "imagine",
    code: "03",
    title: "IMAGINAR",
    eyebrow: "PERCIBIR → INFERIR → NARRAR",
    heading: "¿Qué imagen querés que te cuente?",
    subtext:
      "Adjuntá una foto y la convertimos en un relato hablado, fiel a lo que se ve, pensado para personas ciegas o con baja visión. Después podés escucharlo.",
    placeholder: "Opcional: nivel de detalle (normal, detallada, muy detallada) y registro (cercano, formal)...",
    systemPrompt: IMAGINE_PROMPT,
  },
];

module.exports = modes;
