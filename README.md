# Second Thought

Espacio de pensamiento con 3 modos â€” **Cuestionar**, **Resolver**, **Imaginar** â€”
conectados en vivo a la API de OpenAI. DiseÃ±o basado en el export de Google
Stitch (`design/`), implementado con Node.js + Express.

## ðŸ§© CÃ³mo funciona

1. EntrÃ¡s con cualquier usuario/contraseÃ±a no vacÃ­os (el login es una puerta
   temÃ¡tica, no autenticaciÃ³n real â€” ver nota abajo).
2. ElegÃ­s uno de los 3 modos en el selector.
3. EscribÃ­s tu mensaje. El frontend manda `{ mode, userInput, history }` al backend.
4. El backend arma el mensaje real (`system prompt` del modo + historial + tu
   mensaje) y llama a la API de OpenAI **usando tu clave, que nunca se expone
   al navegador**.
5. La respuesta aparece en el flujo de conversaciÃ³n, con memoria real
   (multi-turno) mientras te quedÃ¡s en el mismo modo.

## ðŸš€ CÃ³mo correrlo en tu compu

1. InstalÃ¡ [Node.js](https://nodejs.org/) (versiÃ³n 18 o superior).
2. InstalÃ¡ las dependencias:
   ```bash
   npm install
   ```
3. CopiÃ¡ `.env.example` a `.env` y pegÃ¡ tu clave de OpenAI:
   ```bash
   cp .env.example .env
   ```
4. ArrancÃ¡ el servidor:
   ```bash
   npm start
   ```
5. AbrÃ­ http://localhost:3000

Sin `.env`, el sitio funciona igual (diseÃ±o, navegaciÃ³n, login, el ejemplo
fijo de cada modo) pero `/api/generate` devuelve un error controlado hasta
que cargues la clave real.

## âœï¸ CÃ³mo editar los 3 modos

Los prompts reales viven, tal cual fueron escritos, en la carpeta `prompts/`
(`question.txt`, `solve.txt`, `imagine.txt`). Para cambiar el comportamiento de
un modo, editÃ¡ ese archivo. `modes.js` los carga y define los textos de interfaz
de cada modo (`title`, `eyebrow`, `heading`, `subtext`, `placeholder`).

A diferencia de otros proyectos similares, acÃ¡ **el `systemPrompt` nunca se
manda al navegador** â€” `/api/modes` solo expone los textos de UI.

No hace falta tocar `server.js`, `public/index.html` ni `public/app.js` para
cambiar el contenido de los modos.

## ðŸ–¼ï¸ ImÃ¡genes y ðŸ”Š voz

- **Imaginar** acepta hasta 3 imÃ¡genes por mensaje (botÃ³n, arrastrar o pegar).
  Se reducen en el navegador antes de enviarse.
- Cada respuesta tiene un botÃ³n **Escuchar** que usa el texto a voz de OpenAI
  (`gpt-4o-mini-tts`) vÃ­a `/api/tts`. La voz se elige en la zona de entrada.


## ðŸ” Sobre el login

El formulario de acceso acepta cualquier usuario/contraseÃ±a no vacÃ­os â€” es
parte de la experiencia narrativa del producto ("acceder" al espacio de
pensamiento), no un control de seguridad real. Si en algÃºn momento necesitÃ¡s
proteger el acceso de verdad (por ejemplo, para que no cualquiera use tu
cuota de API), avisÃ¡ y se agrega autenticaciÃ³n real en el backend.

## ðŸŒ CÃ³mo desplegarlo gratis

**OpciÃ³n recomendada: [Render](https://render.com)**
1. SubÃ­ el proyecto a un repositorio de GitHub (`.env` estÃ¡ en `.gitignore`).
2. En Render: "New" â†’ "Web Service" â†’ conectÃ¡ tu repo.
3. Build command: `npm install` â€” Start command: `npm start`.
4. En "Environment", agregÃ¡ `OPENAI_API_KEY` con tu clave real.
5. Deploy.

## ðŸ’¸ Costos

Usa el modelo `gpt-5.6-luna` (configurado en `server.js`). Es un modelo de
razonamiento: no acepta `temperature` personalizada (siempre 1) y usa
`max_completion_tokens` en vez de `max_tokens`. RevisÃ¡ el precio de este
modelo en tu cuenta de OpenAI para estimar el costo real de uso.

## ðŸ”’ Seguridad ya incluida

- La API key vive solo en el servidor (`.env`), nunca en el navegador.
- LÃ­mite de 15 peticiones por minuto por IP.
- LÃ­mite de longitud del mensaje y del historial de conversaciÃ³n.

## ðŸ“ Estructura

```
Proyecto ORT/
â”œâ”€â”€ server.js       # API Express (/api/modes, /api/generate, /api/tts)
â”œâ”€â”€ modes.js         # carga los prompts y define los textos de cada modo
â”œâ”€â”€ prompts/         # â† los 3 system prompts reales (question, solve, imagine)
â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ index.html    # el diseÃ±o exportado de Stitch, tal cual
â”‚   â””â”€â”€ app.js         # routing + conexiÃ³n real al backend
â”œâ”€â”€ design/            # DESIGN.md y screenshot originales del export, de referencia
â””â”€â”€ README.md
```
