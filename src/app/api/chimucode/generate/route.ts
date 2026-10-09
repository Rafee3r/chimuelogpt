import { extractProjectFilesFromAiResponse } from '../../../../lib/chimucode';
import { isUncensoredModel } from '../../../../lib/models';
import type { ChimuCodeFile, ChimuCodePageContext } from '../../../../lib/sandbox-types';
import { extractUrlFromPrompt, scrapeUrlContent } from '../../../../lib/url-parser';

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

    // 1. Detectar si el prompt incluye alguna URL y verificar si ya existe en pageContext
    const detectedUrl = extractUrlFromPrompt(prompt);
    let activePageContext: ChimuCodePageContext | null = incomingPageContext || null;

    const normalizeUrl = (u: string) =>
      u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();

    let needsScrape = false;
    if (detectedUrl) {
      if (!activePageContext || !activePageContext.url || !activePageContext.text) {
        needsScrape = true;
      } else if (normalizeUrl(detectedUrl) !== normalizeUrl(activePageContext.url)) {
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

        // 2. Si detectamos una URL nueva que no tengamos en pageContext, scrapear
        if (needsScrape && detectedUrl) {
          sendEvent({
            type: 'tool',
            name: 'parse-url',
            status: 'start',
            input: detectedUrl,
          });

          try {
            const scrapeRes = await scrapeUrlContent(detectedUrl);
            if (scrapeRes.ok && scrapeRes.text) {
              const preview = scrapeRes.text.slice(0, 200);
              activePageContext = {
                url: detectedUrl,
                title: scrapeRes.title || 'Sitio Web',
                text: scrapeRes.text,
              };

              sendEvent({
                type: 'tool',
                name: 'parse-url',
                status: 'done',
                preview,
              });

              sendEvent({
                type: 'pageContext',
                pageContext: activePageContext,
              });
            } else {
              const errDetail = scrapeRes.error || 'No se pudo obtener el contenido.';
              sendEvent({
                type: 'tool',
                name: 'parse-url',
                status: 'error',
                preview: `Error: ${errDetail}`,
                error: errDetail,
              });

              verifiedBusinessContext = `
AVISO: Se intentó acceder a la URL ${detectedUrl} pero no fue posible (${errDetail}).
REGLAS:
- Menciona en la primera línea al usuario que no pudiste acceder a la página ${detectedUrl} (${errDetail}).
- PROHIBIDO inventar qué vende o cómo es el negocio sin tener los datos reales. Pídele al usuario los detalles o genera una estructura neutral indicando que faltan los datos reales.`;
            }
          } catch (scrapeErr: any) {
            const errDetail = scrapeErr?.message || 'Fallo de conexión.';
            sendEvent({
              type: 'tool',
              name: 'parse-url',
              status: 'error',
              preview: `Error: ${errDetail}`,
              error: errDetail,
            });
            verifiedBusinessContext = `
AVISO: No se pudo leer la URL ${detectedUrl}. Infórmale al usuario que no se pudo acceder y no inventes el negocio.`;
          }
        }

        // Si tenemos pageContext (ya sea previo o recién obtenido), inyectarlo en el system prompt
        if (activePageContext && activePageContext.text) {
          verifiedBusinessContext = `
DATOS VERÍDICOS DEL NEGOCIO / PÁGINA WEB (${activePageContext.url}):
Título: ${activePageContext.title}
Contenido real del sitio web:
${activePageContext.text.slice(0, 15000)}

REGLAS CRÍTICAS DE CONTENIDO Y NEGOCIO:
- PROHIBIDO PREGUNTAR "¿qué proyecto?" o "¿de qué tema es?" si el hilo o el contexto ya indican el sitio web (${activePageContext.url} - ${activePageContext.title}).
- PROHIBIDO INVENTAR EL GIRO O MODELO DE NEGOCIO. Si la página vende tiras de blanqueo dental (como White & Bright, sin peróxido, ~$29.900 CLP, despacho a Chile, etc.), la landing page DEBE ser estrictamente de tiras de blanqueo dental. NUNCA inventes que es una agencia de "experiencias digitales" ni inventes servicios que no están en el texto.
- Copia fielmente las ofertas reales, claims, beneficios clínicos, precios y llamados a la acción (CTA) auténticos del sitio web.`;
        }

        const systemPrompt = `Eres un asistente de desarrollo y programación de software multi-archivo para la plataforma ChimuCode.

REGLAS OBLIGATORIAS:
- SÍ PUEDES CREAR CARPETAS Y ARCHIVOS VIRTUALES. NUNCA digas "no puedo crear carpetas en tu sistema", "no tengo acceso a tu disco" ni "cópialo manualmente". En este entorno tú gestionas un proyecto virtual con múltiples archivos y carpetas.
- MÁXIMO UNA PREGUNTA, y SOLO si falta un dato indispensable que cambiaría drásticamente el código técnico.
- Si el usuario dice "con todo lo necesario", "hazlo completo", "con todo", "créalo", "continúa" o cualquier instrucción similar: DECIDE TÚ TODOS LOS DETALLES y ESCRIBE LOS ARCHIVOS DE CÓDIGO COMPLETOS EN ESTE TURNO. NUNCA respondas con "¿de qué tema?" o "dime qué secciones quieres". Escribe el código de inmediato.
- PROHIBIDO preguntar "¿qué proyecto?" si en el historial de mensajes o en los datos del negocio ya se mencionó el proyecto o sitio web (ej. vada.cl, blanqueamiento dental, etc.).
- Si te piden "en una carpeta" o "otra página" (ej. "en una carpeta petra", "catálogo en otra página"), responde entregando los archivos con sus rutas relativas en la cabecera de cada bloque markdown:
  \`\`\`html index.html
  <!DOCTYPE html>...
  \`\`\`
  \`\`\`html petra/catalogo.html
  <!DOCTYPE html>...
  \`\`\`
- Cada turno modifica el proyecto: devuelve los archivos que cambian o que se crean nuevos. El cliente hace merge automático por ruta (path).
- Responde con una sola línea de texto breve antes de los bloques de código (ej: "Listo, index.html con la landing page completa.").
- NUNCA des discursos de bienvenida ni te presentes como "Soy ChimuCode".
- Si el usuario solo saluda (ej. "hola") sin contexto previo ni pedido de código, responde con una sola pregunta de 1 línea invitándolo a construir.
- Los enlaces entre páginas deben ser relativos (ej. <a href="catalogo.html"> o <a href="petra/catalogo.html">).
- Escribe código HTML moderno, completo y estilizado con Tailwind CSS o CSS embebido según corresponda.

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

        // Si el último mensaje del historial no es el prompt actual, agregarlo
        if (cleanHistory.length === 0 || cleanHistory[cleanHistory.length - 1].content !== prompt) {
          cleanHistory.push({ role: 'user', content: prompt });
        }

        const llmMessages = [
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
                    let rawLang = (headerMatch ? headerMatch[1] : '')?.toLowerCase() || 'html';
                    let rawPath = (headerMatch ? headerMatch[2] : '')?.trim() || '';

                    // Inferencia de ruta si el bloque no trajo nombre explícito
                    if (!rawPath) {
                      const promptLower = prompt.toLowerCase();
                      if (rawLang === 'html') {
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
                      } else if (rawLang === 'css') {
                        rawPath = 'styles.css';
                      } else if (rawLang === 'js' || rawLang === 'javascript') {
                        rawPath = 'app.js';
                      } else if (rawLang === 'ts' || rawLang === 'typescript') {
                        rawPath = 'app.ts';
                      } else if (rawLang === 'py' || rawLang === 'python') {
                        rawPath = 'main.py';
                      } else {
                        rawPath = `file${fenceIndex}.txt`;
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
                      currentBody += remaining.slice(0, safeLen);
                      cursor += safeLen;
                      progress = true;
                    }
                  } else {
                    currentBody += remaining.slice(0, fencePos);
                    cursor += fencePos + 3; // saltar ```
                    const fileObj: ChimuCodeFile = {
                      path: currentFilePath,
                      language: currentFileLang,
                      content: currentBody.trim(),
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
            const fileObj: ChimuCodeFile = {
              path: currentFilePath,
              language: currentFileLang,
              content: currentBody.trim(),
            };
            completedFiles.push(fileObj);
            sendEvent({
              type: 'file',
              path: fileObj.path,
              language: fileObj.language,
              content: fileObj.content,
            });
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
          sendEvent({
            type: 'done',
            files: completedFiles,
            activePath: completedFiles.find((f) => f.language === 'html')?.path || completedFiles[0]?.path || 'index.html',
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
