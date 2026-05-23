# Self-Review Loop — Log de iteraciones

**Sesión:** 2026-05-21
**Total iteraciones:** 16
**Bugs/mejoras hechas:** 18
**Verificaciones sin bug:** 7
**Builds rotos:** 0

## Hallazgos clave (ordenados por severidad)

### 🔴 Críticos

1. **La IA no sabía el nombre del usuario** (commit `6ad97ef`)
   El onboarding capturaba el nombre, pero nunca se inyectaba al system prompt.
   Si le preguntabas a Chimuelo "¿cómo me llamo?", respondía "no sé tu nombre".

### 🟡 Importantes

2. **`getUserName` ignoraba state del onboarding** (`5a8be30`)
   Solo leía de `userMemory` (regex de chats viejos), no del state `userName`.

3. **Stickers solo en texto, no en imágenes** (`a6e7c83`)
   `/api/chat` tenía reglas de stickers, `/api/vision` no.

4. **Backup incompleto** (`0baca2c`, `298d2bb`)
   Faltaban `chimuelo_onboarding_done` y `chimuelo_version`.

5. **`<html lang="en">` en app español** (`9b9a5d9`)
   SEO + accesibilidad rotos.

### 🟢 Polish

6. **Empty states planos** (`0baca2c`, `69a9e04`, `7713504`)
   Sidebar, agents search, Cerebro Académico ahora tienen empty states cálidos.

7. **Onboarding modal sin accesibilidad** (`647285c`)
   role="dialog", aria-modal, aria-labelledby, label invisible.

8. **No cleanup de intervals/listeners** (`3c5fa9a`)
   Memory leak en strict mode + hot-reload.

9. **`generateChatTitle` sin timeout** (`11c9abc`)
   Conexiones colgadas si la red fallaba.

10. **Escape no cerraba version modal** (`99ae26e`)
    UX estándar para modales informativos.

11. **Default pills muy nerd** (`fa742ca`)
    "Paisaje cyberpunk" → "Idea de cena". Más familia.

## Categorías de bugs encontrados

```
Disconnect entre features ────► 50% (los más críticos)
UX polish ────────────────────► 30%
A11y / SEO ──────────────────► 12%
Hardening (timeouts, leaks) ─► 8%
```

## Patrón observado

Los bugs MÁS valiosos no son los de lógica nueva — son los **gaps de
conexión entre features agregadas en momentos distintos**. Mientras yo
desarrollo en sesiones separadas, las features no se "saben de la otra".

Ejemplo: agregué onboarding → guardó nombre. Pero las APIs siguieron sin
pasarlo. El build no detectó. Los tests no existían. Solo una pasada de
review buscando "qué features conozco que se agregaron por separado"
encontró el disconnect.

## Trade-off del protocolo

✅ **Ventaja:** detecta disconnects que build/tests no detectan.
⚠️ **Limitación:** no veo bugs visuales sin screenshots tuyos.
⚠️ **Limitación:** la efectividad cae después de ~10-15 iteraciones (los
hallazgos se vuelven nicheados).

## Recomendación para próximas sesiones

Aplicar este protocolo de forma natural (no automática) después de:
- Agregar features que toquen múltiples áreas
- Conectar UI nueva con API existente
- Cambios que afecten state global / persistencia
