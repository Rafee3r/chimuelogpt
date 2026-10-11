import { extractProjectFilesFromAiResponse, ensureVisualDifficultySelector } from '../../../../lib/chimucode';
import { isUncensoredModel } from '../../../../lib/models';
import type { ChimuCodeFile, ChimuCodePageContext } from '../../../../lib/sandbox-types';
import { extractUrlFromPrompt, readPage, scrapeUrlContent } from '../../../../lib/url-parser';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const {
      prompt,
      currentCode,
      language = 'html',
      model = 'deepseek-v4-flash',
      files = [],
      messages = [],
      pageContext: incomingPageContext,
      images = [],
      attachments = [],
    } = await req.json().catch(() => ({}));

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Debes proporcionar una instrucción para ChimuCode.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const useUncensored = isUncensoredModel(model);
    const apiKey = useUncensored
      ? process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
      : process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'API key no configurada en el servidor.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isOpenAi = useUncensored || (!process.env.DEEPSEEK_API_KEY && !!process.env.OPENAI_API_KEY);
    const apiEndpoint = isOpenAi ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
    const apiModel = isOpenAi ? 'gpt-4o-mini' : 'deepseek-chat';

    // 1. Detectar si el prompt incluye alguna URL o si es una petición de revisión de colores con contexto existente
    const detectedUrl = extractUrlFromPrompt(prompt);
    let activePageContext: ChimuCodePageContext | null = incomingPageContext || null;

    const normalizeUrl = (u: string) =>
      u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();

    const isColorOrReviewRequest =
      /(?:no\s+es\s+su\s+color|color(?:es)?|revisa|actualiza|paleta|estilo)/i.test(prompt);

    let targetUrl = detectedUrl;
    if (!targetUrl && isColorOrReviewRequest && activePageContext?.url) {
      targetUrl = activePageContext.url;
    }

    let needsScrape = false;
    if (targetUrl) {
      if (!activePageContext || !activePageContext.url || !activePageContext.text || !activePageContext.colors || activePageContext.colors.length === 0) {
        needsScrape = true;
      } else if (normalizeUrl(targetUrl) !== normalizeUrl(activePageContext.url)) {
        needsScrape = true;
      } else if (isColorOrReviewRequest) {
        needsScrape = true;
      }
    }

    // Preparar contexto de archivos existentes
    let existingProjectContext = '';
    if (files && Array.isArray(files) && files.length > 0) {
      existingProjectContext =
        `ARCHIVOS EXISTENTES EN ESTE PROYECTO:\n` +
        files.map((f: any) => `--- ${f.path} ---\n${(f.content || '').slice(0, 10000)}`).join('\n\n');
    } else if (currentCode) {
      existingProjectContext = `CÓDIGO ACTUAL EXISTENTE:\n\`\`\`\n${currentCode.slice(0, 12000)}\n\`\`\``;
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (eventData: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
          } catch {
            // Stream cerrado
          }
        };

        let verifiedBusinessContext = '';

        // 2. Si detectamos una URL o petición de revisión, llamar a read-page
        if (needsScrape && targetUrl) {
          sendEvent({
            type: 'tool',
            name: 'read-page',
            status: 'start',
            input: targetUrl,
          });

          try {
            const readRes = await readPage(targetUrl);
            if (readRes.ok && readRes.text) {
              const topColorsHex = (readRes.colors || []).slice(0, 5).map((c) => c.hex).join(', ');
              const previewParts: string[] = [];
              if (readRes.cta) previewParts.push(`CTA: ${readRes.cta}`);
              if (readRes.background) previewParts.push(`Fondo: ${readRes.background}`);
              if (topColorsHex) previewParts.push(`Colores: ${topColorsHex}`);
              const preview = previewParts.join(' | ') || (readRes.text ? readRes.text.slice(0, 150) : 'OK');

              activePageContext = {
                url: targetUrl,
                title: readRes.title || 'Sitio Web',
                text: readRes.text,
                colors: readRes.colors,
                background: readRes.background,
                cta: readRes.cta,
              };

              sendEvent({
                type: 'tool',
                name: 'read-page',
                status: 'done',
                preview,
              });

              sendEvent({
                type: 'pageContext',
                pageContext: activePageContext,
              });
            } else {
              const errDetail = readRes.error || 'No se pudo obtener el contenido.';
              sendEvent({
                type: 'tool',
                name: 'read-page',
                status: 'error',
                preview: `Error: ${errDetail}`,
                error: errDetail,
              });

              verifiedBusinessContext = `
AVISO: Se intentó acceder a la URL ${targetUrl} pero no fue posible (${errDetail}).
REGLAS:
- Menciona en la primera línea al usuario que no pudiste acceder a la página ${targetUrl} (${errDetail}).
- PROHIBIDO inventar qué vende o cómo es el negocio sin tener los datos reales. Pídele al usuario los detalles o genera una estructura neutral indicando que faltan los datos reales.`;
            }
          } catch (readErr: any) {
            const errDetail = readErr?.message || 'Fallo de conexión.';
            sendEvent({
              type: 'tool',
              name: 'read-page',
              status: 'error',
              preview: `Error: ${errDetail}`,
              error: errDetail,
            });
            verifiedBusinessContext = `
AVISO: No se pudo leer la URL ${targetUrl}. Infórmale al usuario que no se pudo acceder y no inventes el negocio.`;
          }
        }

        // Si tenemos pageContext (ya sea previo o recién obtenido), inyectarlo en el system prompt con su paleta de colores
        if (activePageContext && activePageContext.text && !verifiedBusinessContext.startsWith('AVISO:')) {
          let colorsContext = '';
          if (activePageContext.colors && activePageContext.colors.length > 0) {
            const paletteList = activePageContext.colors.slice(0, 8).map((c) => `${c.hex} (${c.count}x)`).join(', ');
            colorsContext = `
PALETA DE COLORES REAL EXTRAÍDA DE LA PÁGINA (${activePageContext.url}):
- Color del botón principal / Llamado a la acción (CTA): ${activePageContext.cta || '#8b44e9'}
- Fondo predominante (background): ${activePageContext.background || '#ffffff'}
- Colores detectados en CSS/estilos: ${paletteList}

REGLAS ESTRICTAS DE COLOR:
- OBLIGATORIO: Utiliza la paleta real extraída arriba para los botones, degradados, encabezados y fondos.
- PROHIBIDO INVENTAR colores como azul cielo (#0ea5e9, sky-500, blue-500), dorado (#d4a017) o amarillos si no vinieron en la paleta extraída del sitio web. En vada.cl el color de marca y de los botones es morado/púrpura (#8b44e9), NUNCA azul cielo ni dorado.
- Si el usuario dice "no es su color" o pide corregir colores, REEMPLAZA de inmediato todos los colores inventados por los colores reales extraídos (${activePageContext.cta || '#8b44e9'} para CTA/botones/acentos, ${activePageContext.background || '#ffffff'} para fondos).`;
          }

          verifiedBusinessContext = `
DATOS VERÍDICOS DEL NEGOCIO / PÁGINA WEB (${activePageContext.url}):
Título: ${activePageContext.title}
Contenido real del sitio web:
${activePageContext.text.slice(0, 15000)}
${colorsContext}

REGLAS CRÍTICAS DE CONTENIDO Y NEGOCIO:
- PROHIBIDO PREGUNTAR "¿qué proyecto?" o "¿de qué tema es?" si el hilo o el contexto ya indican el sitio web (${activePageContext.url} - ${activePageContext.title}).
- PROHIBIDO INVENTAR EL GIRO O MODELO DE NEGOCIO. Si la página vende tiras de blanqueo dental (como White & Bright, sin peróxido, ~$29.900 CLP, despacho a Chile, etc.), la landing page DEBE ser estrictamente de tiras de blanqueo dental. NUNCA inventes que es una agencia de "experiencias digitales" ni inventes servicios que no están en el texto.
- Copia fielmente las ofertas reales, claims, beneficios clínicos, precios y llamados a la acción (CTA) auténticos del sitio web.`;
        }

        const systemPrompt = `Eres ChimuCode, un agente de desarrollo e ingeniería de software universal de alta capacidad. PUEDES PROGRAMAR Y CONSTRUIR ABSOLUTAMENTE DE TODO:
- Scripts de automatización, web scrapers (BeautifulSoup/requests), bots, procesamiento de datos y matemáticas en Python (\`main.py\`, \`scraper.py\`, etc.).
- Backends, APIs REST, servidores Express, microservicios y utilidades en Node.js y TypeScript (\`server.js\`, \`api.ts\`, \`app.js\`).
- Aplicaciones web completas, herramientas interactivas, dashboards y juegos en HTML5, CSS moderno, Tailwind y JavaScript (\`index.html\`, etc.).
- Scripts de consola, DevOps, automatización de sistemas, Dockerfile, docker-compose.yml y Bash (\`script.sh\`, \`deploy.sh\`, \`Dockerfile\`).
- Bases de datos, modelos relacionales, esquemas DDL y consultas analíticas en SQL (\`schema.sql\`, \`query.sql\`).
- Algoritmos, estructuras de datos y resolución de problemas en cualquier lenguaje (Python, JS, TS, Go, Rust, C++, Java).
- Archivos de configuración y datos: JSON, YAML, TOML, CSV y documentación Markdown (\`config.json\`, \`data.csv\`, \`README.md\`).
- Tests unitarios y suites de prueba.

- REGLAS OBLIGATORIAS:
- REGLA SUPREMA DE APPS, UIs Y PROYECTOS VISUALES (SIEMPRE PREVISUALIZABLE):
  Si el usuario pide una app (ej. "app de notas para Mac", "app de notas", "app de tareas", "dashboard", "juego", "calculadora", app móvil o de escritorio), landing page o CUALQUIER proyecto con interfaz visual:
  EL PROYECTO DEBE INCLUIR SIEMPRE UN ARCHIVO PREVISUALIZABLE EN EL NAVEGADOR:
  * Si es web (HTML/CSS/JS): genera \`\`\`html index.html con toda la interfaz interactiva.
  * Si es nativa o de escritorio (Swift/SwiftUI para Mac/iOS, Python Tkinter/PyQt, Flutter, React Native, Java, C#, etc.):
    ADEMÁS de entregar todos los archivos de código fuente nativo necesarios (ej. \`\`\`swift NotesApp.swift y \`\`\`swift ContentView.swift),
    GENERA OBLIGATORIAMENTE en el mismo turno un archivo \`\`\`html preview.html con un mockup fiel, interactivo y completo de la UI (con la misma estructura, estética de ventana de macOS/iOS/escritorio, controles nativos simulados, barra lateral, lista de notas/ítems, editor y los mismos textos). El panel del entorno abrirá preview.html para mostrar la interfaz directamente.
  * PROHIBIDO PREGUNTAR "¿qué tipo de app?", "¿qué diseño prefieres?" o pedir aclaraciones cuando el pedido sea una app. Con decir "app de notas para mac" o similar ALCANZA: decide tú todas las funciones necesarias y entrega los archivos nativos (ej. .swift) Y el preview.html EN EL MISMO TURNO.
- SÍ PUEDES CREAR CARPETAS Y ARCHIVOS VIRTUALES. NUNCA digas "no puedo crear carpetas en tu sistema", "no tengo acceso a tu disco" ni "cópialo manualmente". En este entorno tú gestionas un proyecto virtual con múltiples archivos y carpetas.
- ADAPTA INTELIGENTEMENTE EL LENGUAJE Y LOS ARCHIVOS según la intención del usuario. NO ASUMAS SIEMPRE QUE ES UNA PÁGINA WEB:
  * Si piden automatización, scraper, cálculo, análisis de datos, bot o utilidades -> Genera scripts en Python ejecutables (ej. \`\`\`python main.py) listos para correr, con \`print(...)\` claros para que los resultados se vean directamente en la consola.
  * Si piden backend, API REST o utilidades JS -> Genera archivos Node.js / TypeScript (ej. \`\`\`javascript server.js o \`\`\`typescript api.ts).
  * Si piden app visual, interfaz interactiva, landing page o juego -> Genera archivos HTML/CSS/JS (ej. \`\`\`html index.html). Si piden app nativa (ej. Mac con Swift), genera los archivos .swift Y \`\`\`html preview.html.
  * Si piden tareas de terminal, despliegue o sysadmin -> Genera scripts Bash (\`\`\`bash script.sh) o Dockerfile/compose.
  * Si piden bases de datos -> Genera archivos SQL (\`\`\`sql schema.sql).
  * Si el proyecto requiere varios archivos (ej: un script Python que lee \`datos.csv\` o \`config.json\`), crea todos los archivos correspondientes en sus bloques markdown.
- CADA BLOQUE DE CÓDIGO DEBE INCLUIR EL LENGUAJE Y EL NOMBRE DE ARCHIVO EN LA CABECERA:
  \`\`\`python main.py
  # código...
  \`\`\`
  \`\`\`swift NotesApp.swift
  // código...
  \`\`\`
  \`\`\`swift ContentView.swift
  // código...
  \`\`\`
  \`\`\`html preview.html
  <!DOCTYPE html>...
  \`\`\`
  \`\`\`javascript server.js
  // código...
  \`\`\`
  \`\`\`html index.html
  <!DOCTYPE html>...
  \`\`\`
- MÁXIMO UNA PREGUNTA, y SOLO si falta un dato indispensable que cambiaría drásticamente el código técnico.
- Si el usuario dice "con todo lo necesario", "hazlo completo", "con todo", "créalo", "continúa" o cualquier instrucción similar: DECIDE TÚ TODOS LOS DETALLES y ESCRIBE LOS ARCHIVOS DE CÓDIGO COMPLETOS EN ESTE TURNO. NUNCA respondas con "¿de qué tema?" o "dime qué secciones quieres". Escribe el código de inmediato.
- PROHIBIDO preguntar "¿qué proyecto?" si en el historial de mensajes o en los datos del negocio ya se mencionó el proyecto o sitio web (ej. vada.cl, blanqueamiento dental, etc.).
- REGLA SUPREMA: LA PALABRA "LISTO" SOLO SE ESCRIBE SI EL CAMBIO PEDIDO ES VISIBLE EN EL HTML QUE ACABAS DE DEVOLVER:
  * Antes de responder, busca en el archivo el texto exacto del pedido. Si pediste o se pidió "Fácil", "Medio" o "Difícil" (o selector de dificultad / nivel de poder para jugar en CPU), TIENEN que estar como <button> o <option> en index.html. Si no están, NO digas Listo: sigue y añádelos al marcado y a la lógica.
  * Si el usuario pide nivel de poder para jugar en CPU (o dificultad de IA en ajedrez u otros juegos): el selector va DEBAJO de "vs CPU": tres botones Fácil, Medio, Difícil. El activo con fondo #4a7c59. Al click cambia una variable difficulty y la IA usa profundidad 1, 2 o 3.
  * Devuelve siempre el fence completo \`\`\`html index.html. El cliente recarga el iframe con el nuevo contenido.
  * ORDEN OBLIGATORIO: Genera PRIMERO el fence completo con el código (ej. \`\`\`html index.html), y SOLO después del fence escribe la línea breve de confirmación (ej. "Listo, añadido selector de nivel de dificultad (Fácil / Medio / Difícil) debajo de vs CPU."). NUNCA digas "Listo" antes del fence de código ni si los elementos no están físicamente presentes en el marcado.
- OBLIGATORIO: CADA TURNO QUE CAMBIA DISEÑO, ESTILOS O CÓDIGO DEBE DEVOLVER EL FENCE COMPLETO DEL ARCHIVO. Si no devuelves el fence con el código completo, ESTÁ ESTRICTAMENTE PROHIBIDO decir "Listo" o afirmar que hiciste el cambio, porque el cliente SÓLO actualiza el espacio de trabajo al recibir el fence de archivo.
- Si el usuario dice "no es su color" o pide corregir colores/estilos:
  * Aplica los colores de la paleta real extraída.
  * Devuelve el fence completo \`\`\`html index.html y al final responde con EXACTAMENTE UNA SOLA LÍNEA DE DIFF (ej. "Listo, ajustado el color principal a #8b44e9 y fondo a #ffffff en index.html.").
  * PROHIBIDO escribir ensayos, discursos o explicaciones largas.
- Si te piden "en una carpeta" o "otra página" (ej. "en una carpeta petra", "catálogo en otra página"), responde entregando los archivos con sus rutas relativas en la cabecera de cada bloque markdown.
- Cada turno modifica el proyecto: devuelve los archivos que cambian o que se crean nuevos. El cliente hace merge automático por ruta (path).
- NUNCA des discursos de bienvenida ni te presentes como "Soy ChimuCode".
- Si el usuario solo saluda (ej. "hola") sin contexto previo ni pedido de código, responde con una sola pregunta de 1 línea invitándolo a construir.
- Los enlaces entre páginas web deben ser relativos (ej. <a href="catalogo.html"> o <a href="petra/catalogo.html">).

${verifiedBusinessContext}

${existingProjectContext}`;

        // 3. Preparar el historial completo de mensajes para el modelo (últimos 12)
        const cleanHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        if (Array.isArray(messages)) {
          for (const m of messages) {
            if (!m || !m.content || typeof m.content !== 'string') continue;
            const contentTrimmed = m.content.trim();
            if (
              contentTrimmed.startsWith('Error: Unexpected token') ||
              contentTrimmed.startsWith('⚠️ Error: Unexpected token')
            ) {
              continue;
            }
            const role = m.role === 'assistant' ? 'assistant' : 'user';
            cleanHistory.push({ role, content: m.content });
          }
        }

        // Procesar archivos adjuntos de texto
        let attachedContext = '';
        if (Array.isArray(attachments) && attachments.length > 0) {
          attachedContext = '\n\nARCHIVOS ADJUNTOS POR EL USUARIO:\n' +
            attachments.map((a: any) => `--- Archivo: ${a.name} ---\n${(a.content || '').slice(0, 15000)}`).join('\n\n');
        }

        const fullPromptText = prompt + attachedContext;

        let userContentPayload: any = fullPromptText;
        if (Array.isArray(images) && images.length > 0) {
          userContentPayload = [
            { type: 'text', text: fullPromptText },
            ...images.slice(0, 10).map((imgUrl: string) => ({
              type: 'image_url',
              image_url: { url: imgUrl },
            })),
          ];
        }

        // Si el último mensaje del historial no es el prompt actual, agregarlo
        if (cleanHistory.length === 0 || cleanHistory[cleanHistory.length - 1].content !== prompt) {
          cleanHistory.push({ role: 'user', content: userContentPayload });
        } else {
          cleanHistory[cleanHistory.length - 1] = { role: 'user', content: userContentPayload };
        }

        const llmMessages: any[] = [
          { role: 'system', content: systemPrompt },
          ...cleanHistory.slice(-12),
        ];

        try {
          const aiRes = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: apiModel,
              messages: llmMessages,
              temperature: 0.2,
              stream: true,
            }),
          });

          if (!aiRes.ok || !aiRes.body) {
            const errText = await aiRes.text().catch(() => '');
            sendEvent({ type: 'error', error: `Error del modelo AI: ${aiRes.status} ${errText}` });
            controller.close();
            return;
          }

          // Parser de streaming SSE para separar explicaciones, status de archivos y bloques de código
          const folderMatch = prompt.match(/(?:en\s+(?:la\s+|una\s+)?carpeta\s+([a-zA-Z0-9_-]+)|([a-zA-Z0-9_-]+)\/)/i);
          const preferredFolder = folderMatch ? folderMatch[1] || folderMatch[2] : null;

          let mode: 'EXPLANATION' | 'FENCE_HEADER' | 'FENCE_BODY' = 'EXPLANATION';
          let cursor = 0;
          let fullText = '';
          let fenceIndex = 0;
          let currentFilePath = '';
          let currentFileLang = 'html';
          let currentBody = '';
          const completedFiles: ChimuCodeFile[] = [];

          const reader = aiRes.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = '';
          let isStreamDone = false;

          while (!isStreamDone) {
            const { value, done } = await reader.read();
            if (done) {
              isStreamDone = true;
              break;
            }

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') {
                isStreamDone = true;
                break;
              }

              let jsonChunk: any = null;
              try {
                jsonChunk = JSON.parse(dataStr);
              } catch {
                continue;
              }

              const tokenDelta = jsonChunk?.choices?.[0]?.delta?.content || '';
              if (!tokenDelta) continue;

              fullText += tokenDelta;

              // Procesar el texto acumulado según el estado de la máquina
              let progress = true;
              while (progress && cursor < fullText.length) {
                progress = false;

                if (mode === 'EXPLANATION') {
                  const remaining = fullText.slice(cursor);
                  const fencePos = remaining.indexOf('```');
                  if (fencePos === -1) {
                    let safeLen = remaining.length;
                    if (remaining.endsWith('``')) safeLen -= 2;
                    else if (remaining.endsWith('`')) safeLen -= 1;
                    if (safeLen > 0) {
                      const deltaText = remaining.slice(0, safeLen);
                      cursor += safeLen;
                      sendEvent({ type: 'delta', text: deltaText });
                      progress = true;
                    }
                  } else {
                    if (fencePos > 0) {
                      const deltaText = remaining.slice(0, fencePos);
                      cursor += fencePos;
                      sendEvent({ type: 'delta', text: deltaText });
                    }
                    cursor += 3; // saltar ```
                    mode = 'FENCE_HEADER';
                    progress = true;
                  }
                } else if (mode === 'FENCE_HEADER') {
                  const remaining = fullText.slice(cursor);
                  const newlinePos = remaining.indexOf('\n');
                  if (newlinePos !== -1) {
                    const headerLine = remaining.slice(0, newlinePos).trim();
                    cursor += newlinePos + 1;
                    fenceIndex++;

                    const headerMatch = headerLine.match(/^([a-zA-Z0-9_-]+)?(?:[ \t]+([^\n\r`]+))?$/);
                    let rawLang = (headerMatch ? headerMatch[1] : '')?.toLowerCase() || '';
                    let rawPath = (headerMatch ? headerMatch[2] : '')?.trim() || '';

                    // Inferencia de ruta inteligente según lenguaje y contexto
                    if (!rawPath) {
                      const promptLower = prompt.toLowerCase();
                      const isPython = rawLang === 'py' || rawLang === 'python' || /(?:python|py|pandas|numpy|scraper|scraping|analisis|análisis|datos|math|estadist|bot)/i.test(promptLower);
                      const isJs = rawLang === 'js' || rawLang === 'javascript' || rawLang === 'node' || /(?:node|express|api\s+rest|javascript|backend)/i.test(promptLower);
                      const isTs = rawLang === 'ts' || rawLang === 'typescript';
                      const isBash = rawLang === 'sh' || rawLang === 'bash' || rawLang === 'shell' || /(?:bash|shell|terminal|script\.sh|deploy|backup)/i.test(promptLower);
                      const isSql = rawLang === 'sql' || /(?:sql|database|query|tabla|schema)/i.test(promptLower);
                      const isJson = rawLang === 'json';
                      const isDocker = /(?:docker|dockerfile|docker-compose)/i.test(promptLower);

                      if (rawLang === 'py' || rawLang === 'python' || (!rawLang && isPython)) {
                        rawPath = fenceIndex === 1 ? 'main.py' : `script${fenceIndex}.py`;
                        rawLang = 'python';
                      } else if (rawLang === 'js' || rawLang === 'javascript' || (!rawLang && isJs)) {
                        rawPath = fenceIndex === 1 ? 'app.js' : `module${fenceIndex}.js`;
                        rawLang = 'javascript';
                      } else if (rawLang === 'ts' || rawLang === 'typescript' || (!rawLang && isTs)) {
                        rawPath = fenceIndex === 1 ? 'app.ts' : `module${fenceIndex}.ts`;
                        rawLang = 'typescript';
                      } else if (rawLang === 'sh' || rawLang === 'bash' || (!rawLang && isBash)) {
                        rawPath = fenceIndex === 1 ? 'script.sh' : `task${fenceIndex}.sh`;
                        rawLang = 'bash';
                      } else if (rawLang === 'sql' || (!rawLang && isSql)) {
                        rawPath = fenceIndex === 1 ? 'schema.sql' : `query${fenceIndex}.sql`;
                        rawLang = 'sql';
                      } else if (rawLang === 'json' || (!rawLang && isJson)) {
                        rawPath = 'data.json';
                        rawLang = 'json';
                      } else if (isDocker) {
                        rawPath = fenceIndex === 1 ? 'Dockerfile' : 'docker-compose.yml';
                        rawLang = 'docker';
                      } else if (rawLang === 'swift' || (!rawLang && /(?:swift|swiftui|apple|mac|macos|ios)/i.test(promptLower))) {
                        rawPath = fenceIndex === 1 ? 'NotesApp.swift' : (fenceIndex === 2 ? 'ContentView.swift' : `Source${fenceIndex}.swift`);
                        rawLang = 'swift';
                      } else if (rawLang === 'css') {
                        rawPath = 'styles.css';
                        rawLang = 'css';
                      } else {
                        if (
                          (promptLower.includes('catalogo') || promptLower.includes('catálogo')) &&
                          (fenceIndex > 1 || files.some((f: any) => f.path.endsWith('index.html')))
                        ) {
                          rawPath = 'catalogo.html';
                        } else if (fenceIndex === 1) {
                          rawPath = 'index.html';
                        } else {
                          rawPath = `page${fenceIndex}.html`;
                        }
                        rawLang = 'html';
                      }
                    }

                    if (preferredFolder && !rawPath.includes('/') && !rawPath.startsWith(preferredFolder + '/')) {
                      rawPath = `${preferredFolder}/${rawPath}`;
                    }

                    rawPath = rawPath.replace(/^["']|["']$/g, '').trim();

                    currentFileLang = rawLang;
                    currentFilePath = rawPath;
                    currentBody = '';
                    mode = 'FENCE_BODY';

                    sendEvent({ type: 'status', text: `escribiendo ${currentFilePath}` });
                    progress = true;
                  }
                } else if (mode === 'FENCE_BODY') {
                  const remaining = fullText.slice(cursor);
                  const fencePos = remaining.indexOf('```');
                  if (fencePos === -1) {
                    let safeLen = remaining.length;
                    if (remaining.endsWith('``')) safeLen -= 2;
                    else if (remaining.endsWith('`')) safeLen -= 1;
                    if (safeLen > 0) {
                      const deltaChunk = remaining.slice(0, safeLen);
                      currentBody += deltaChunk;
                      cursor += safeLen;
                      sendEvent({
                        type: 'file_delta',
                        path: currentFilePath,
                        language: currentFileLang,
                        delta: deltaChunk,
                        totalLength: currentBody.length,
                      });
                      progress = true;
                    }
                  } else {
                    currentBody += remaining.slice(0, fencePos);
                    cursor += fencePos + 3; // saltar ```
                    let processedContent = currentBody.trim();
                    if (currentFileLang === 'html' || currentFilePath.endsWith('.html')) {
                      processedContent = ensureVisualDifficultySelector(processedContent, prompt);
                    }
                    const fileObj: ChimuCodeFile = {
                      path: currentFilePath,
                      language: currentFileLang,
                      content: processedContent,
                    };
                    completedFiles.push(fileObj);

                    sendEvent({
                      type: 'file',
                      path: fileObj.path,
                      language: fileObj.language,
                      content: fileObj.content,
                    });
                    sendEvent({ type: 'status', text: '' });
                    mode = 'EXPLANATION';
                    progress = true;
                  }
                }
              }
            }
          }

          // Si quedó un fence abierto al cortar el stream, cerrarlo
          if (mode === 'FENCE_BODY' && currentBody.trim()) {
            let processedContent = currentBody.trim();
            if (currentFileLang === 'html' || currentFilePath.endsWith('.html')) {
              processedContent = ensureVisualDifficultySelector(processedContent, prompt);
            }
            const fileObj: ChimuCodeFile = {
              path: currentFilePath,
              language: currentFileLang,
              content: processedContent,
            };
            completedFiles.push(fileObj);
            sendEvent({
              type: 'file',
              path: fileObj.path,
              language: fileObj.language,
              content: fileObj.content,
            });
            sendEvent({ type: 'status', text: '' });
          }

          // Conciliación con extractProjectFilesFromAiResponse para garantizar integridad total
          const extracted = extractProjectFilesFromAiResponse(fullText, prompt, files);
          for (const extFile of extracted.files) {
            if (!completedFiles.some((f) => f.path === extFile.path)) {
              completedFiles.push(extFile);
              sendEvent({
                type: 'file',
                path: extFile.path,
                language: extFile.language,
                content: extFile.content,
              });
            }
          }

          // Emitir evento final de finalización con los archivos del proyecto y pageContext actualizado
          const previewFile = completedFiles.find((f) => f.path === 'preview.html')
            || completedFiles.find((f) => f.path === 'index.html')
            || completedFiles.find((f) => f.language === 'html' || f.path.endsWith('.html'));
          const resolvedDoneActivePath = previewFile?.path || completedFiles[0]?.path || files[0]?.path || 'main.py';

          sendEvent({
            type: 'done',
            files: completedFiles,
            activePath: resolvedDoneActivePath,
            pageContext: activePageContext,
          });
        } catch (err: any) {
          sendEvent({ type: 'error', error: err?.message || 'Error en la generación de código.' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error interno en ChimuCode' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
