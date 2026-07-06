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

## Tests obligatorios antes de commitear
```
npm test && npm run build
```
Los tests viven en `src/lib/__tests__/`. Si tocas un módulo de `src/lib/`, corre los tests. Si agregas lógica pura nueva, agrégale test.

## Claves localStorage — cuidado con el naming
La app usa camelCase en algunas keys históricas: `chimuelo_bubbleStyle`, `chimuelo_density`, `chimuelo_fontSize`, `chimuelo_enterToSend`, `chimuelo_memoryEnabled`. El resto usa snake_case (`chimuelo_user_name`, `chimuelo_custom_instructions`). NO "corrijas" el naming — romperías los datos existentes de los usuarios.

**NUNCA hagas `localStorage.removeItem` de una key activa en el arranque** (hubo un bug que borraba las instrucciones personalizadas del usuario en cada apertura).

## Estilos
- `globals.css` es enorme (~8k líneas). Para features nuevas con muchas clases propias, prefiere un archivo CSS aparte (ej. `src/app/gallery.css`) importado desde `page.tsx`.
