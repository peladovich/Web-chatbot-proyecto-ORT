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
    placeholder: "Pegá acá el texto o la afirmación que querés examinar...",
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
    placeholder: "Adjuntá una imagen (opcional: pedí un largo corto, medio o largo, y un registro cercano o formal)...",
    systemPrompt: IMAGINE_PROMPT,
  },
];

module.exports = modes;
