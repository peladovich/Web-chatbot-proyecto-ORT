# Second Thought

Espacio de pensamiento con 3 modos — **Cuestionar**, **Resolver**, **Imaginar** —
conectados en vivo a la API de OpenAI. Diseño basado en el export de Google
Stitch (`design/`), implementado con Node.js + Express.

## 🧩 Cómo funciona

1. Entrás con cualquier usuario/contraseña no vacíos (el login es una puerta
   temática, no autenticación real — ver nota abajo).
2. Elegís uno de los 3 modos en el selector.
3. Escribís tu mensaje. El frontend manda `{ mode, userInput, history }` al backend.
4. El backend arma el mensaje real (`system prompt` del modo + historial + tu
   mensaje) y llama a la API de OpenAI **usando tu clave, que nunca se expone
   al navegador**.
5. La respuesta aparece en el flujo de conversación, con memoria real
   (multi-turno) mientras te quedás en el mismo modo.

## 🚀 Cómo correrlo en tu compu

1. Instalá [Node.js](https://nodejs.org/) (versión 18 o superior).
2. Instalá las dependencias:
   ```bash
   npm install
   ```
3. Copiá `.env.example` a `.env` y pegá tu clave de OpenAI:
   ```bash
   cp .env.example .env
   ```
4. Arrancá el servidor:
   ```bash
   npm start
   ```
5. Abrí http://localhost:3000

Sin `.env`, el sitio funciona igual (diseño, navegación, login, el ejemplo
fijo de cada modo) pero `/api/generate` devuelve un error controlado hasta
que cargues la clave real.

## ✏️ Cómo editar los 3 modos

Editá `modes.js` en la raíz. Cada modo tiene:
- `title`, `eyebrow`, `heading`, `subtext`, `placeholder`: textos que ve el usuario.
- `systemPrompt`: **el prompt real** que le da personalidad e instrucciones al
  modelo. Fue redactado a partir de la metodología ya definida en el diseño
  (`design/DESIGN.md` y el Manifiesto dentro de `public/index.html`) — es un
  primer borrador, editalo con confianza.

A diferencia de otros proyectos similares, acá **el `systemPrompt` nunca se
manda al navegador** — `/api/modes` solo expone los textos de UI.

No hace falta tocar `server.js`, `public/index.html` ni `public/app.js` para
cambiar el contenido de los modos.

## 🔐 Sobre el login

El formulario de acceso acepta cualquier usuario/contraseña no vacíos — es
parte de la experiencia narrativa del producto ("acceder" al espacio de
pensamiento), no un control de seguridad real. Si en algún momento necesitás
proteger el acceso de verdad (por ejemplo, para que no cualquiera use tu
cuota de API), avisá y se agrega autenticación real en el backend.

## 🌐 Cómo desplegarlo gratis

**Opción recomendada: [Render](https://render.com)**
1. Subí el proyecto a un repositorio de GitHub (`.env` está en `.gitignore`).
2. En Render: "New" → "Web Service" → conectá tu repo.
3. Build command: `npm install` — Start command: `npm start`.
4. En "Environment", agregá `OPENAI_API_KEY` con tu clave real.
5. Deploy.

## 💸 Costos

Usa el modelo `gpt-5.6-luna` (configurado en `server.js`). Es un modelo de
razonamiento: no acepta `temperature` personalizada (siempre 1) y usa
`max_completion_tokens` en vez de `max_tokens`. Revisá el precio de este
modelo en tu cuenta de OpenAI para estimar el costo real de uso.

## 🔒 Seguridad ya incluida

- La API key vive solo en el servidor (`.env`), nunca en el navegador.
- Límite de 15 peticiones por minuto por IP.
- Límite de longitud del mensaje y del historial de conversación.

## 📁 Estructura

```
Proyecto ORT/
├── server.js       # API Express (/api/modes, /api/generate)
├── modes.js         # ← acá están (y se editan) los 3 system prompts reales
├── public/
│   ├── index.html    # el diseño exportado de Stitch, tal cual
│   └── app.js         # routing + conexión real al backend
├── design/            # DESIGN.md y screenshot originales del export, de referencia
└── README.md
```
