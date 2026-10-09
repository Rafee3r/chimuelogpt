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

export function extractCodeFromAiResponse(response: string): { code: string; language: SandboxLanguage } {
  if (!response || typeof response !== 'string') {
    return { code: '', language: 'html' };
  }

  // Regex para bloques de código delimitados por markdown ```lang ... ```
  const codeBlockRegex = /```(html|xml|javascript|js|typescript|ts|python|py)?\s*([\s\S]*?)```/i;
  const match = response.match(codeBlockRegex);

  if (match) {
    const rawLang = (match[1] || '').toLowerCase();
    const rawContent = match[2].trim();
    if (rawLang === 'html' || rawLang === 'xml' || rawContent.includes('<!DOCTYPE') || rawContent.includes('<html')) {
      return { code: rawContent, language: 'html' };
    }
    if (rawLang === 'python' || rawLang === 'py') {
      return { code: rawContent, language: 'python' };
    }
    if (rawLang === 'typescript' || rawLang === 'ts') {
      return { code: rawContent, language: 'typescript' };
    }
    return { code: rawContent, language: 'javascript' };
  }

  // Si no hay bloques de markdown con fences, verificar si es un documento HTML completo
  const trimmed = response.trim();
  if (trimmed.includes('<!DOCTYPE') && trimmed.includes('</html>')) {
    const start = trimmed.indexOf('<!DOCTYPE');
    const end = trimmed.indexOf('</html>') + 7;
    return { code: trimmed.slice(start, end).trim(), language: 'html' };
  }

  // Saludos, preguntas o texto conversacional SIN fence NO son código
  return { code: '', language: 'html' };
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

  // Patrones Python (Top 1 de Claude: scripts, análisis de datos, automatización)
  if (
    /^(import\s+[\w\s,]+|from\s+\w+\s+import|def\s+\w+\s*\(|class\s+\w+\s*[:\(]|print\s*\(|elif\s+|if\s+__name__\s*==)/m.test(trimmed) ||
    /(#.*coding|import\s+(math|sys|os|json|random|statistics|numpy|pandas|requests|datetime))/m.test(trimmed)
  ) {
    return 'python';
  }

  // Top 2 de Claude: JavaScript / TypeScript (Full-stack, DOM, React)
  return 'javascript';
}

export function formatTerminalTimestamp(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
