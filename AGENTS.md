<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Convenciones del proyecto Chimuelo

## Lógica compartida vive en `src/lib/` (NO duplicar en page.tsx)
- `src/lib/types.ts` — tipos `BaseMessage`, `Chat`, `StorageLike`
- `src/lib/chat-storage.ts` — `sanitizeChatsForStorage`, `safeSetChats`, `groupChatsByDate`
- `src/lib/backup.ts` — `BACKUP_KEYS_TO_CAPTURE` + snapshot/backup/import. **Si agregas una key `chimuelo_*` nueva a localStorage, agrégala también a esta whitelist** o no se respaldará.
- `src/lib/message-parsers.ts` — regexes canónicas de tags (`<think>`, `<sticker>`, `__MUSIC_PLAYER__`, `<set_reminder>`, imágenes markdown)
- `src/lib/gallery.ts` — extracción de creaciones para la vista Galería
- `src/lib/sandbox-worker.ts` — ejecución aislada client-side en Web Worker (JS sin servidor)
- `src/lib/sandbox-cloud.ts` — ejecución backend aislada (Node.js VM y Python con límites de timeout)
- `src/lib/chimucode.ts` — presets y lógica de ejecución para el entorno ChimuCode Dev

## Tests obligatorios antes de commitear
```
npm test && npm run build
```
Los tests viven en `src/lib/__tests__/`. Si tocas un módulo de `src/lib/`, corre los tests. Si agregas lógica pura nueva, agrégale test.

## Feedback obligatorio tras cada `git push`
Siempre reportar de forma explícita y detallada al usuario si el `git push` se completó con éxito o con errores:
- Hash del commit y rama (`origin/main`).
- Confirmación de que el árbol local está sincronizado con el remoto (`working tree clean`, `Your branch is up to date with 'origin/main'`).
- Alerta inmediata si ocurrió cualquier rechazo, conflicto o fallo en el push.

## Claves localStorage — cuidado con el naming
La app usa camelCase en algunas keys históricas: `chimuelo_bubbleStyle`, `chimuelo_density`, `chimuelo_fontSize`, `chimuelo_enterToSend`, `chimuelo_memoryEnabled`. El resto usa snake_case (`chimuelo_user_name`, `chimuelo_custom_instructions`). NO "corrijas" el naming — romperías los datos existentes de los usuarios.

**NUNCA hagas `localStorage.removeItem` de una key activa en el arranque** (hubo un bug que borraba las instrucciones personalizadas del usuario en cada apertura).

## Estilos
- `globals.css` es enorme (~8k líneas). Para features nuevas con muchas clases propias, prefiere un archivo CSS aparte (ej. `src/app/gallery.css`) importado desde `page.tsx`.

## Herramientas y Subagentes Favorecidos

**Navegación e Información:**
- `search_web` y `read_url_content`: Buscar en internet y extraer información de sitios web.

**Interacción y Utilidades:**
- `ask_question`: Desplegarte un menú de opciones múltiples en la interfaz para pedirte feedback sobre decisiones de diseño o aclarar requerimientos.
- `schedule`: Programar recordatorios (temporizadores) o "cron jobs" para revisar tareas más tarde.

**Habilidades (Skills) Favorecidas:**
- `tdd`: Protocolo estricto de Test-Driven Development (Red-Green-Refactor).
- `diagnose`: Bucle disciplinado para cazar bugs difíciles o regresiones de rendimiento.
- `caveman`: Modo de comunicación ultracorta para ahorrar tokens (ej. "habla como cavernícola").

**Desarrollo Web:**
- `modern-web-guidance`: Reglas obligatorias para usar CSS moderno, Container Queries, animaciones fluidas y buenas prácticas frontend.
- `chrome-devtools`: Integración directa para hacer debugging de red, inspeccionar elementos y cazar memory leaks en Chrome.
- `webapp-testing`: Herramientas para hacer pruebas end-to-end usando Playwright.

**Manejo de Documentos:**
- `pdf`, `docx`, `xlsx`, `pptx`: Capacidades avanzadas para leer, modificar, mezclar o crear documentos ofimáticos.

**Delegación a Subagentes:**
Puedo invocar "clones" o agentes especialistas para que trabajen en paralelo sin saturar nuestra conversación principal:
- `research`: Un agente con permisos solo de lectura que puedo enviar a investigar la web o leer docenas de archivos en tu base de código para buscar respuestas.
- `firestore-rules-author`: Un agente dedicado única y exclusivamente a escribir, refactorizar y endurecer reglas de seguridad de Firestore.
- `self`: Puedo clonarme para realizar tareas independientes mientras yo sigo hablando contigo.
