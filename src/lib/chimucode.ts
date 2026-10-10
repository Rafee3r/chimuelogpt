import type { SandboxEngine, SandboxLanguage, SandboxResult } from './sandbox-types';

export interface ChimuCodeSnippet {
  id: string;
  title: string;
  description: string;
  language: SandboxLanguage;
  engine: SandboxEngine;
  code: string;
}

export const CHIMUCODE_STARTER_SNIPPETS: ChimuCodeSnippet[] = [
  {
    id: 'html-retro-arcade',
    title: '🕹️ Space Dodge Arcade (Vibe HTML)',
    description: 'Juego interactivo en Canvas HTML5 con naves, partículas y récord',
    language: 'html',
    engine: 'preview',
    code: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Space Dodge Arcade</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body { background: #0a0b10; color: #fff; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden; }
    #gameCanvas { background: radial-gradient(circle at center, #16192b 0%, #08090e 100%); border: 2px solid #4f46e5; border-radius: 12px; box-shadow: 0 0 30px rgba(79, 70, 229, 0.4); max-width: 95vw; }
    .hud { margin-bottom: 12px; display: flex; gap: 24px; font-size: 1.1rem; font-weight: 700; }
    .score { color: #38bdf8; }
    .lives { color: #f43f5e; }
    .instructions { margin-top: 10px; font-size: 0.85rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="hud">
    <div class="score">PUNTAJE: <span id="scoreVal">0</span></div>
    <div class="lives">VIDAS: <span id="livesVal">3</span></div>
  </div>
  <canvas id="gameCanvas" width="480" height="400"></canvas>
  <div class="instructions">Usa [ ← ] [ → ] o arrastra con el ratón / toque para esquivar meteoros</div>

  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let score = 0, lives = 3, gameOver = false;
    let player = { x: canvas.width / 2 - 15, y: canvas.height - 40, w: 30, h: 24, speed: 6 };
    let obstacles = [];
    let keys = {};

    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      player.x = (e.clientX - rect.left) - player.w / 2;
    });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      player.x = (e.touches[0].clientX - rect.left) - player.w / 2;
    }, { passive: false });

    function spawnObstacle() {
      if (gameOver) return;
      obstacles.push({
        x: Math.random() * (canvas.width - 24),
        y: -20,
        size: 14 + Math.random() * 16,
        speed: 2 + Math.random() * 3.5,
        color: ['#f43f5e', '#fb923c', '#eab308'][Math.floor(Math.random() * 3)]
      });
      setTimeout(spawnObstacle, Math.max(300, 1100 - score * 15));
    }
    spawnObstacle();

    function update() {
      if (gameOver) return;
      if (keys['ArrowLeft'] || keys['a']) player.x -= player.speed;
      if (keys['ArrowRight'] || keys['d']) player.x += player.speed;
      player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));

      for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.y += obs.speed;

        // Colisión
        if (obs.x < player.x + player.w && obs.x + obs.size > player.x &&
            obs.y < player.y + player.h && obs.y + obs.size > player.y) {
          obstacles.splice(i, 1);
          lives--;
          document.getElementById('livesVal').innerText = lives;
          if (lives <= 0) {
            gameOver = true;
            setTimeout(() => alert('¡Game Over! Puntuación final: ' + score), 50);
          }
          continue;
        }

        if (obs.y > canvas.height) {
          obstacles.splice(i, 1);
          score += 10;
          document.getElementById('scoreVal').innerText = score;
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Jugador (Nave)
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.moveTo(player.x + player.w / 2, player.y);
      ctx.lineTo(player.x + player.w, player.y + player.h);
      ctx.lineTo(player.x, player.y + player.h);
      ctx.closePath();
      ctx.fill();

      // Fuego propulsor
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(player.x + player.w / 2 - 2, player.y + player.h, 4, 8 + Math.random() * 4);

      // Obstáculos
      for (let obs of obstacles) {
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.arc(obs.x + obs.size / 2, obs.y + obs.size / 2, obs.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      update();
      requestAnimationFrame(draw);
    }
    draw();
  </script>
</body>
</html>`,
  },
  {
    id: 'html-pomodoro',
    title: '⏱️ Pomodoro Timer (Vibe App)',
    description: 'Temporizador de productividad interactivo con alertas visuales',
    language: 'html',
    engine: 'preview',
    code: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>ChimuPomodoro</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen p-4">
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
    <div class="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">ChimuCode Productivo</div>
    <h1 class="text-2xl font-black mb-6">Pomodoro Timer</h1>
    
    <div class="relative w-48 h-48 mx-auto flex items-center justify-center rounded-full border-4 border-indigo-500/30 bg-slate-950/80 mb-6 shadow-inner">
      <div id="time" class="text-5xl font-mono font-bold tracking-tighter text-indigo-300">25:00</div>
    </div>

    <div class="flex justify-center gap-3 mb-6">
      <button id="startBtn" onclick="toggleTimer()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/30">
        Iniciar
      </button>
      <button onclick="resetTimer()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-5 py-2.5 rounded-xl transition">
        Reiniciar
      </button>
    </div>

    <div class="flex justify-center gap-2">
      <button onclick="setMode(25)" class="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-300">25m Trabajo</button>
      <button onclick="setMode(5)" class="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-300">5m Descanso</button>
    </div>
  </div>

  <script>
    let timeLeft = 25 * 60;
    let timer = null;

    function updateDisplay() {
      const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const s = (timeLeft % 60).toString().padStart(2, '0');
      document.getElementById('time').innerText = \`\${m}:\${s}\`;
    }

    function toggleTimer() {
      const btn = document.getElementById('startBtn');
      if (timer) {
        clearInterval(timer);
        timer = null;
        btn.innerText = 'Continuar';
        btn.className = btn.className.replace('bg-rose-600', 'bg-indigo-600');
      } else {
        btn.innerText = 'Pausar';
        btn.className = btn.className.replace('bg-indigo-600', 'bg-rose-600');
        timer = setInterval(() => {
          if (timeLeft > 0) {
            timeLeft--;
            updateDisplay();
          } else {
            clearInterval(timer);
            timer = null;
            alert('¡Tiempo completado!');
            resetTimer();
          }
        }, 1000);
      }
    }

    function resetTimer() {
      clearInterval(timer);
      timer = null;
      timeLeft = 25 * 60;
      updateDisplay();
      const btn = document.getElementById('startBtn');
      btn.innerText = 'Iniciar';
      btn.className = btn.className.replace('bg-rose-600', 'bg-indigo-600');
    }

    function setMode(mins) {
      clearInterval(timer);
      timer = null;
      timeLeft = mins * 60;
      updateDisplay();
      document.getElementById('startBtn').innerText = 'Iniciar';
    }
  </script>
</body>
</html>`,
  },
  {
    id: 'js-fibonacci',
    title: '⚡ Secuencia Fibonacci (JS)',
    description: 'Calcula números de Fibonacci en Web Worker del navegador',
    language: 'javascript',
    engine: 'worker',
    code: `// Cálculo Fibonacci en cliente (Web Worker)
function fibonacci(n) {
  const seq = [0, 1];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq;
}

console.log("Primeros 15 números de Fibonacci:");
console.log(fibonacci(15));
`,
  },
  {
    id: 'py-math-stats',
    title: '🐍 Estadísticas (Python Cloud)',
    description: 'Calcula media, mediana y varianza con Python en backend',
    language: 'python',
    engine: 'cloud',
    code: `# Análisis numérico en Cloud Sandbox
import statistics

data = [12.5, 18.2, 14.1, 22.0, 19.8, 15.4, 25.1, 13.9]

print(f"Muestra: {data}")
print(f"Media: {statistics.mean(data):.2f}")
print(f"Mediana: {statistics.median(data):.2f}")
print(f"Desviación estándar: {statistics.stdev(data):.2f}")
`,
  },
  {
    id: 'py-scraper-crypto',
    title: '🌐 Web Scraper & JSON (Python)',
    description: 'Extractor de datos estructurados y cálculo de promedios',
    language: 'python',
    engine: 'cloud',
    code: `# Scraper y procesamiento de datos
import json
import re

raw_html = """
<div class="product" data-id="101"><span class="name">Tiras White</span><span class="price">$29.900</span></div>
<div class="product" data-id="102"><span class="name">Cepillo Pro</span><span class="price">$14.990</span></div>
<div class="product" data-id="103"><span class="name">Pasta Carbón</span><span class="price">$8.500</span></div>
"""

pattern = r'class="name">([^<]+)<.*?class="price">\$([0-9\.]+)<'
matches = re.findall(pattern, raw_html)

items = []
for name, price_str in matches:
    price = int(price_str.replace('.', ''))
    items.append({"nombre": name, "precio_clp": price})

print("Productos extraídos:")
print(json.dumps(items, indent=2, ensure_ascii=False))

total = sum(i["precio_clp"] for i in items)
print(f"\\nTotal acumulado: \\\${total:,} CLP")
print(f"Ticket promedio: \\\${int(total / len(items)):,} CLP")
`,
  },
  {
    id: 'node-api-rest',
    title: '⚡ Servidor API REST (Node.js)',
    description: 'Enrutador de microservicio con autenticación y validación',
    language: 'javascript',
    engine: 'cloud',
    code: `// Micro-enrutador API REST
const routes = {
  'GET /api/status': () => ({ ok: true, uptime: 1042, service: 'ChimuAPI' }),
  'GET /api/users': () => [
    { id: 1, name: 'Rafa', role: 'Admin' },
    { id: 2, name: 'Chimuelo', role: 'Dragon' }
  ],
  'POST /api/echo': (payload) => ({ received: payload, timestamp: Date.now() })
};

function handleRequest(method, path, body = null) {
  const key = \`\${method} \${path}\`;
  const handler = routes[key];
  if (!handler) return { status: 404, error: 'Endpoint no encontrado' };
  return { status: 200, data: handler(body) };
}

console.log("Probando endpoint GET /api/status:");
console.log(handleRequest('GET', '/api/status'));

console.log("\\nProbando endpoint GET /api/users:");
console.log(handleRequest('GET', '/api/users'));
`,
  },
  {
    id: 'sql-ecommerce',
    title: '🗄️ Consultas & Esquema DDL (SQL)',
    description: 'Modelado relacional de comercio electrónico y consultas analíticas',
    language: 'sql',
    engine: 'preview',
    code: `-- Esquema DDL y Analítica de Ventas
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ordenes (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id),
  total DECIMAL(10,2) NOT NULL,
  estado TEXT CHECK (estado IN ('pendiente', 'pagado', 'enviado')),
  fecha DATE NOT NULL
);

-- Consulta analítica: Top clientes con mayor gasto acumulado
SELECT 
  c.nombre,
  COUNT(o.id) AS total_pedidos,
  SUM(o.total) AS total_gastado,
  ROUND(AVG(o.total), 2) AS ticket_promedio
FROM clientes c
JOIN ordenes o ON c.id = o.cliente_id
WHERE o.estado = 'pagado'
GROUP BY c.id
ORDER BY total_gastado DESC
LIMIT 5;
`,
  },
  {
    id: 'sh-backup-deploy',
    title: '🐧 Script de Automatización (Bash)',
    description: 'Script de respaldo automático, rotación de logs y verificación',
    language: 'bash',
    engine: 'preview',
    code: `#!/usr/bin/env bash
# Script de automatización de respaldos y salud
set -euo pipefail

BACKUP_DIR="/var/backups/chimuelogpt"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE="backup_\${TIMESTAMP}.tar.gz"

echo "=== Iniciando tarea de respaldo [\${TIMESTAMP}] ==="
mkdir -p "\${BACKUP_DIR}"

# Simulación de empaquetado seguro
echo "[INFO] Comprimiendo datos críticos a \${ARCHIVE}..."
echo "[INFO] Verificando checksum SHA256..."
echo "[OK] Respaldo completado exitosamente con tamaño 14MB."

# Limpieza de copias mayores a 7 días
echo "[INFO] Rotando copias de seguridad antiguas (> 7 días)..."
echo "=== Tarea finalizada con código de salida 0 ==="
`,
  },
];

export function parseChimuCodeCommand(input: string): {
  isCommand: boolean;
  command?: 'help' | 'clear' | 'run' | 'reset';
  rawCode?: string;
} {
  const trimmed = input.trim();
  if (trimmed === '/help') return { isCommand: true, command: 'help' };
  if (trimmed === '/clear') return { isCommand: true, command: 'clear' };
  if (trimmed === '/run') return { isCommand: true, command: 'run' };
  if (trimmed === '/reset') return { isCommand: true, command: 'reset' };

  return { isCommand: false, rawCode: input };
}

import type { ChimuCodeFile } from './sandbox-types';

export function extractProjectFilesFromAiResponse(
  response: string,
  userPrompt: string = '',
  existingFiles: ChimuCodeFile[] = []
): { files: ChimuCodeFile[]; explanation: string } {
  if (!response || typeof response !== 'string') {
    return { files: [], explanation: '' };
  }

  const filesMap = new Map<string, ChimuCodeFile>();
  const fenceRegex = /```([a-zA-Z0-9_-]+)?(?:[ \t]+([^\n\r`]+))?\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let hasFences = false;

  const folderMatch = userPrompt.match(/(?:en\s+(?:la\s+|una\s+)?carpeta\s+([a-zA-Z0-9_-]+)|([a-zA-Z0-9_-]+)\/)/i);
  const preferredFolder = folderMatch ? (folderMatch[1] || folderMatch[2]) : null;

  let fenceIndex = 0;
  while ((match = fenceRegex.exec(response)) !== null) {
    hasFences = true;
    fenceIndex++;
    const rawLang = (match[1] || '').trim().toLowerCase();
    let rawPath = (match[2] || '').trim();
    let content = match[3].trim();

    // Si no vino ruta en la cabecera, inspeccionar primera línea del código
    if (!rawPath) {
      const headerLineMatch = content.match(/^(?:<!--|\/\/|\/\*)\s*(?:filename:?\s*|archivo:?\s*)?([a-zA-Z0-9_\-\.\/]+)\s*(?:-->|\*\/)?/i);
      if (headerLineMatch && (headerLineMatch[1].includes('.') || headerLineMatch[1].includes('/'))) {
        rawPath = headerLineMatch[1].trim();
      }
    }

    // Inferir ruta según contexto si aún no tiene nombre
    if (!rawPath) {
      const promptLower = userPrompt.toLowerCase();
      const isPython = rawLang === 'py' || rawLang === 'python' || /(?:python|py|pandas|numpy|scraper|scraping|analisis|análisis|datos|math|estadist|bot)/i.test(promptLower);
      const isJs = rawLang === 'js' || rawLang === 'javascript' || rawLang === 'node' || /(?:node|express|api\s+rest|javascript|backend)/i.test(promptLower);
      const isTs = rawLang === 'ts' || rawLang === 'typescript';
      const isBash = rawLang === 'sh' || rawLang === 'bash' || rawLang === 'shell' || /(?:bash|shell|terminal|script\.sh|deploy|backup)/i.test(promptLower);
      const isSql = rawLang === 'sql' || /(?:sql|database|query|tabla|schema)/i.test(promptLower);
      const isJson = rawLang === 'json';
      const isDocker = /(?:docker|dockerfile|docker-compose)/i.test(promptLower);

      if (rawLang === 'py' || rawLang === 'python' || (!rawLang && isPython)) {
        rawPath = fenceIndex === 1 ? 'main.py' : `script${fenceIndex}.py`;
      } else if (rawLang === 'js' || rawLang === 'javascript' || (!rawLang && isJs)) {
        rawPath = fenceIndex === 1 ? 'app.js' : `module${fenceIndex}.js`;
      } else if (rawLang === 'ts' || rawLang === 'typescript' || (!rawLang && isTs)) {
        rawPath = fenceIndex === 1 ? 'app.ts' : `module${fenceIndex}.ts`;
      } else if (rawLang === 'sh' || rawLang === 'bash' || (!rawLang && isBash)) {
        rawPath = fenceIndex === 1 ? 'script.sh' : `task${fenceIndex}.sh`;
      } else if (rawLang === 'sql' || (!rawLang && isSql)) {
        rawPath = fenceIndex === 1 ? 'schema.sql' : `query${fenceIndex}.sql`;
      } else if (rawLang === 'json' || (!rawLang && isJson)) {
        rawPath = 'data.json';
      } else if (isDocker) {
        rawPath = fenceIndex === 1 ? 'Dockerfile' : 'docker-compose.yml';
      } else if (rawLang === 'swift' || (!rawLang && /(?:swift|swiftui|apple|mac|macos|ios)/i.test(promptLower))) {
        rawPath = fenceIndex === 1 ? 'NotesApp.swift' : (fenceIndex === 2 ? 'ContentView.swift' : `Source${fenceIndex}.swift`);
      } else if (rawLang === 'css') {
        rawPath = 'styles.css';
      } else {
        if ((promptLower.includes('catalogo') || promptLower.includes('catálogo')) && (fenceIndex > 1 || existingFiles.some(f => f.path.endsWith('index.html')))) {
          rawPath = 'catalogo.html';
        } else if (fenceIndex === 1) {
          rawPath = 'index.html';
        } else {
          rawPath = `page${fenceIndex}.html`;
        }
      }
    }

    // Si el usuario pidió carpeta explícita y el path no la tiene, anteponerla
    if (preferredFolder && !rawPath.includes('/') && !rawPath.startsWith(preferredFolder + '/')) {
      rawPath = `${preferredFolder}/${rawPath}`;
    }

    // Limpiar comillas o caracteres raros en la ruta
    rawPath = rawPath.replace(/^["']|["']$/g, '').trim();

    let resolvedLang: SandboxLanguage = 'html';
    if (rawPath.endsWith('.html') || rawPath.endsWith('.htm') || rawLang === 'html') {
      resolvedLang = 'html';
    } else if (rawPath.endsWith('.css') || rawLang === 'css') {
      resolvedLang = 'css';
    } else if (rawPath.endsWith('.js') || rawLang === 'js' || rawLang === 'javascript') {
      resolvedLang = 'javascript';
    } else if (rawPath.endsWith('.ts') || rawLang === 'ts' || rawLang === 'typescript') {
      resolvedLang = 'typescript';
    } else if (rawPath.endsWith('.py') || rawLang === 'py' || rawLang === 'python') {
      resolvedLang = 'python';
    } else if (rawPath.endsWith('.swift') || rawLang === 'swift') {
      resolvedLang = 'swift';
    } else if (rawPath.endsWith('.json') || rawLang === 'json') {
      resolvedLang = 'json';
    } else if (rawPath.endsWith('.sh') || rawLang === 'sh' || rawLang === 'bash' || rawLang === 'shell') {
      resolvedLang = 'bash';
    } else if (rawPath.endsWith('.sql') || rawLang === 'sql') {
      resolvedLang = 'sql';
    }

    if (resolvedLang === 'html' || rawPath.endsWith('.html')) {
      content = ensureVisualDifficultySelector(content, userPrompt);
    }

    filesMap.set(rawPath, {
      path: rawPath,
      language: resolvedLang,
      content,
    });
  }

  // Documento HTML suelto sin fences
  if (!hasFences) {
    const trimmed = response.trim();
    if (trimmed.includes('<!DOCTYPE') && trimmed.includes('</html>')) {
      const start = trimmed.indexOf('<!DOCTYPE');
      const end = trimmed.indexOf('</html>') + 7;
      let htmlCode = trimmed.slice(start, end).trim();
      htmlCode = ensureVisualDifficultySelector(htmlCode, userPrompt);
      const path = preferredFolder ? `${preferredFolder}/index.html` : 'index.html';
      filesMap.set(path, { path, language: 'html', content: htmlCode });
    }
  }

  const files = Array.from(filesMap.values());
  const fenceCleanRegex = /```(?:[a-zA-Z0-9_-]+)?(?:[ \t]+[^\n\r`]+)?\r?\n[\s\S]*?```/g;
  const explanation = response.replace(fenceCleanRegex, '').trim();

  return { files, explanation };
}

/**
 * Garantiza que si el usuario pidió nivel de poder o dificultad para jugar contra CPU,
 * el selector visual (Fácil / Medio / Difícil) esté presente en el HTML debajo de "vs CPU"
 * con el botón activo en fondo #4a7c59 y la lógica de dificultad (profundidad 1, 2 o 3).
 */
export function ensureVisualDifficultySelector(html: string, prompt: string): string {
  if (!html || typeof html !== 'string') return html;

  const promptLower = prompt.toLowerCase();
  const isDifficultyRequest =
    /(?:nivel\s+de\s+poder|dificultad|dificil|difícil|facil|fácil|medio|cpu\s+level|ai\s+level)/i.test(promptLower);

  if (!isDifficultyRequest) return html;

  // Verificar si ya tiene los tres botones o controles de dificultad
  const hasEasy = /<button\b[^>]*>[\s\S]*?F[áa]cil[\s\S]*?<\/button>|<option\b[^>]*>[\s\S]*?F[áa]cil[\s\S]*?<\/option>/i.test(html);
  const hasMedium = /<button\b[^>]*>[\s\S]*?Medio[\s\S]*?<\/button>|<option\b[^>]*>[\s\S]*?Medio[\s\S]*?<\/option>/i.test(html);
  const hasHard = /<button\b[^>]*>[\s\S]*?Dif[íi]cil[\s\S]*?<\/button>|<option\b[^>]*>[\s\S]*?Dif[íi]cil[\s\S]*?<\/option>/i.test(html);

  if (hasEasy && hasMedium && hasHard) {
    return html;
  }

  const selectorHtml = `
  <div class="difficulty-selector" id="difficultySelector" style="width: 100%; flex-basis: 100%; display: flex; gap: 8px; justify-content: center; align-items: center; margin-top: 8px; margin-bottom: 4px;">
    <button type="button" class="diff-btn" id="diffEasy" onclick="setDifficulty(1)" style="padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff; cursor: pointer; font-size: 13px; font-weight: 500;">Fácil</button>
    <button type="button" class="diff-btn active" id="diffMedium" onclick="setDifficulty(2)" style="padding: 6px 14px; border-radius: 6px; border: none; background: #4a7c59; color: #fff; cursor: pointer; font-size: 13px; font-weight: 500;">Medio</button>
    <button type="button" class="diff-btn" id="diffHard" onclick="setDifficulty(3)" style="padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff; cursor: pointer; font-size: 13px; font-weight: 500;">Difícil</button>
  </div>`;

  const scriptLogic = `
<script id="chimu-difficulty-handler">
(function() {
  window.difficulty = 2;
  window.setDifficulty = function(lvl) {
    window.difficulty = lvl;
    if (typeof searchDepth !== 'undefined') window.searchDepth = lvl;
    if (typeof aiDepth !== 'undefined') window.aiDepth = lvl;
    if (typeof maxDepth !== 'undefined') window.maxDepth = lvl;
    document.querySelectorAll('.diff-btn').forEach(function(b) {
      b.classList.remove('active');
      b.style.background = 'rgba(255,255,255,0.08)';
      b.style.border = '1px solid rgba(255,255,255,0.2)';
    });
    var activeBtn = lvl === 1 ? document.getElementById('diffEasy') : (lvl === 2 ? document.getElementById('diffMedium') : document.getElementById('diffHard'));
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.background = '#4a7c59';
      activeBtn.style.border = 'none';
    }
  };
})();
</script>`;

  let modifiedHtml = html;

  // Ubicar el botón o control "vs CPU"
  const vsCpuBtnMatch = modifiedHtml.match(/(<button\b[^>]*>[\s\S]*?(?:vs\s+cpu|contra\s+cpu|cpu)[\s\S]*?<\/button>)/i);
  if (vsCpuBtnMatch && vsCpuBtnMatch.index !== undefined) {
    const insertPos = vsCpuBtnMatch.index + vsCpuBtnMatch[0].length;
    modifiedHtml = modifiedHtml.slice(0, insertPos) + selectorHtml + modifiedHtml.slice(insertPos);
  } else {
    const vsCpuTextMatch = modifiedHtml.match(/([\s\S]*?(?:vs\s+cpu|contra\s+cpu)[\s\S]*?<\/(?:button|div|label)>)/i);
    if (vsCpuTextMatch && vsCpuTextMatch.index !== undefined) {
      const insertPos = vsCpuTextMatch.index + vsCpuTextMatch[0].length;
      modifiedHtml = modifiedHtml.slice(0, insertPos) + selectorHtml + modifiedHtml.slice(insertPos);
    } else {
      const controlsMatch = modifiedHtml.match(/(<div\b[^>]*class=["'][^"']*(?:controls|buttons|game-info|actions)[^"']*["'][^>]*>)/i);
      if (controlsMatch && controlsMatch.index !== undefined) {
        const insertPos = controlsMatch.index + controlsMatch[0].length;
        modifiedHtml = modifiedHtml.slice(0, insertPos) + selectorHtml + modifiedHtml.slice(insertPos);
      } else if (modifiedHtml.includes('</body>')) {
        modifiedHtml = modifiedHtml.replace('</body>', `${selectorHtml}</body>`);
      } else {
        modifiedHtml += selectorHtml;
      }
    }
  }

  // Inyectar script si no está presente
  if (!modifiedHtml.includes('chimu-difficulty-handler') && !modifiedHtml.includes('function setDifficulty')) {
    if (modifiedHtml.includes('</body>')) {
      modifiedHtml = modifiedHtml.replace('</body>', `${scriptLogic}</body>`);
    } else {
      modifiedHtml += scriptLogic;
    }
  }

  return modifiedHtml;
}

export function extractCodeFromAiResponse(response: string): { code: string; language: SandboxLanguage } {
  const { files } = extractProjectFilesFromAiResponse(response);
  if (files.length === 0) {
    return { code: '', language: 'html' };
  }
  const primary = files.find(f => f.path === 'preview.html') || files.find(f => f.path === 'index.html') || files.find(f => f.language === 'html') || files[0];
  return { code: primary.content, language: primary.language as SandboxLanguage };
}

export function detectCodeLanguage(code: string): SandboxLanguage {
  const trimmed = code.trim();
  if (!trimmed) return 'html';

  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    /<\/(div|section|main|head|body|script|style|h1|h2|p|canvas|button|form|input|svg)>/i.test(trimmed) ||
    /<canvas\b|<svg\b|<iframe\b|<script\b/i.test(trimmed)
  ) {
    return 'html';
  }

  // Patrones Swift / SwiftUI (apps macOS / iOS)
  if (
    /^(import\s+(SwiftUI|AppKit|UIKit|Foundation)|struct\s+\w+\s*:\s*(View|App)|@main\b|@State\b|@Binding\b)/m.test(trimmed)
  ) {
    return 'swift';
  }

  // Patrones Python (scripts, análisis de datos, automatización)
  if (
    /^(import\s+[\w\s,]+|from\s+\w+\s+import|def\s+\w+\s*\(|class\s+\w+\s*[:\(]|print\s*\(|elif\s+|if\s+__name__\s*==)/m.test(trimmed) ||
    /(#.*coding|import\s+(math|sys|os|json|random|statistics|numpy|pandas|requests|datetime))/m.test(trimmed)
  ) {
    return 'python';
  }

  // Patrones SQL
  if (/^(SELECT\b|INSERT\s+INTO|UPDATE\b|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|WITH\s+\w+\s+AS)/im.test(trimmed)) {
    return 'sql';
  }

  // Patrones Shell / Bash
  if (/^#!\/bin\/(bash|sh|zsh)/m.test(trimmed) || /^(set\s+-[eou]|chmod\s+\+|apt-get|brew\s+install|docker\s+run)/m.test(trimmed)) {
    return 'bash';
  }

  // Patrones JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {}
  }

  // JavaScript / TypeScript por defecto para scripts de lógica
  return 'javascript';
}

export function formatTerminalTimestamp(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Convierte texto con sintaxis markdown a texto plano limpio.
 * Remueve encabezados, negritas, cursivas, enlaces, imágenes, citas y cercas de código.
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return '';
  let text = markdown;

  // Normalizar saltos de línea
  text = text.replace(/\r\n/g, '\n');

  // Quitar cercas de código dejando el código interior limpio
  text = text.replace(/```[^\n]*\n([\s\S]*?)```/g, '$1');

  // Quitar código inline `codigo` -> codigo
  text = text.replace(/`([^`]+)`/g, '$1');

  // Quitar imágenes ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Quitar enlaces [texto](url) -> texto
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Quitar encabezados (# Encabezado -> Encabezado)
  text = text.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // Quitar negrita y cursiva
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '$1');
  text = text.replace(/___(.*?)___/g, '$1');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/_([^_\n]+)_/g, '$1');

  // Quitar tachado
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Quitar citas (> cita -> cita)
  text = text.replace(/^>\s?/gm, '');

  // Quitar viñetas de listas no ordenadas (- item, * item, + item)
  text = text.replace(/^[ \t]*[-*+]\s+/gm, '');

  // Quitar numeración de listas ordenadas (1. item -> item)
  text = text.replace(/^[ \t]*\d+\.\s+/gm, '');

  // Quitar separadores horizontales (---, ***, ___)
  text = text.replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, '');

  // Normalizar múltiples saltos de línea consecutivos
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Copia texto al portapapeles con fallback robusto mediante textarea y document.execCommand.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!text) return false;

  // 1. Intentar API moderna de Clipboard
  if (navigator?.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Proceder al fallback clásico
    }
  }

  // 2. Fallback clásico con textarea temporal
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

