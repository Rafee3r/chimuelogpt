"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo, useMemo } from "react";
import { MessageSquare, Plus, Settings, Send, Paperclip, Menu, X, Cat, XCircle, FileImage, ChevronDown, ChevronLeft, Smartphone, SquarePen, Download, ZoomIn, Book, Star, Search, ThumbsUp, ThumbsDown, RotateCw, Share2, Copy, MoreVertical, GraduationCap, Trash2, LogOut, Brain, Square, Check, Command, Palette, Zap, Sparkles, Mic, MicOff, Play, Pause, Music } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─────────── v2.0 Performance: Memoized markdown per message ─────────── */
const MemoizedMarkdown = memo(function MemoizedMarkdown({ content, imgRenderer, codeRenderer }: {
  content: string;
  imgRenderer: any;
  codeRenderer: any;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ img: imgRenderer, code: codeRenderer }}
    >
      {content}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);

/* ─────────── v2.0 Code block with copy button ─────────── */
function CodeBlock({ inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, "");
  if (inline) return <code className={className} {...props}>{children}</code>;
  return (
    <div className="code-block-wrapper">
      <button
        className={`code-copy-btn ${copied ? 'copied' : ''}`}
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        title="Copiar código"
      >
        {copied ? <Check size={14} key="check" /> : <Copy size={14} key="copy" />}
        <span>{copied ? "Copiado" : "Copiar"}</span>
      </button>
      <pre><code className={className} {...props}>{children}</code></pre>
    </div>
  );
}
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ─────────── Mascota: gatito negro complejo (9 poses) ───────────
   Estructura en 3 capas para evitar conflictos de transforms:
   - Layer 1 (wrapper): position + burbuja (NO afectada por flip/click)
   - Layer 2 (flip):    scaleX(-1) si camina a la izquierda
   - Layer 3 (cat):     poses, click, idle animations */
type CatPose = 'walk-right' | 'walk-left' | 'sit' | 'sleep' | 'stretch'
             | 'groom' | 'play' | 'look-up' | 'yawn';

function CatMascot() {
  const [pose, setPose] = useState<CatPose>('sit');
  const [pos, setPos] = useState(20);
  const [meowing, setMeowing] = useState(false);
  const meowTimerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let currentPos = 20;
    const actionPool: Array<{ pose: CatPose; duration: number; moves: boolean }> = [
      { pose: 'sit',        duration: 3500, moves: false },
      { pose: 'sit',        duration: 4500, moves: false },
      { pose: 'walk-right', duration: 4500, moves: true  },
      { pose: 'walk-left',  duration: 4500, moves: true  },
      { pose: 'stretch',    duration: 3000, moves: false },
      { pose: 'sleep',      duration: 7000, moves: false },
      { pose: 'groom',      duration: 4000, moves: false },
      { pose: 'play',       duration: 4500, moves: false },
      { pose: 'look-up',    duration: 3500, moves: false },
      { pose: 'yawn',       duration: 2500, moves: false },
    ];

    const next = () => {
      if (cancelled) return;
      const s = actionPool[Math.floor(Math.random() * actionPool.length)];
      setPose(s.pose);
      if (s.moves) {
        // Calcular posición destino según dirección
        let target;
        if (s.pose === 'walk-right') {
          target = Math.min(90, currentPos + 25 + Math.random() * 30);
        } else {
          target = Math.max(8, currentPos - 25 - Math.random() * 30);
        }
        currentPos = Math.round(target);
        setPos(currentPos);
      }
      const dur = s.duration + (Math.random() * 1000 - 200);
      setTimeout(next, dur);
    };
    next();
    return () => { cancelled = true; };
  }, []);

  const handleClick = () => {
    if (meowing) return;
    setMeowing(true);
    if (meowTimerRef.current) clearTimeout(meowTimerRef.current);
    meowTimerRef.current = setTimeout(() => setMeowing(false), 1600);
  };

  const flip = pose === 'walk-left';

  return (
    /* ── Capa 1 (wrapper): solo position + burbuja ── */
    <div className="cat-mascot-wrapper" style={{ left: `${pos}%` }}>
      {meowing && (
        <div className="cat-meow-bubble" aria-hidden="true">
          ¡Miau! 🐾
        </div>
      )}
      {/* ── Capa 2 (flip): solo scaleX cuando camina a la izquierda ── */}
      <div className="cat-mascot-flip" style={{ transform: flip ? 'scaleX(-1)' : 'scaleX(1)' }}>
        {/* ── Capa 3 (cat): poses + click + animaciones idle ── */}
        <div
          className={`cat-mascot pose-${pose} ${meowing ? 'meowing' : ''}`}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label="Tocar al gatito"
        >
          <svg viewBox="0 0 100 70" width="92" height="64" xmlns="http://www.w3.org/2000/svg">
            {pose === 'sleep' ? (
              <>
                {/* DURMIENDO: acurrucado en bolita */}
                <path d="M20 55 Q12 50 16 38 Q22 30 38 32" stroke="#0a0a0a" strokeWidth="6" fill="none" strokeLinecap="round" />
                <ellipse cx="55" cy="52" rx="32" ry="14" fill="#1a1a1a" />
                <ellipse cx="55" cy="50" rx="28" ry="12" fill="#252525" />
                <circle cx="75" cy="44" r="13" fill="#1a1a1a" />
                <circle cx="75" cy="44" r="11" fill="#222" />
                <path d="M67 35 L66 27 L73 32 Z" fill="#0a0a0a" />
                <path d="M68 32 L67 28 L71 31 Z" fill="#ff9eb5" />
                <path d="M77 32 L80 25 L84 32 Z" fill="#0a0a0a" />
                <path d="M78 31 L80 28 L82 31 Z" fill="#ff9eb5" />
                <path d="M70 44 Q72 46 74 44" stroke="#000" strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d="M76 44 Q78 46 80 44" stroke="#000" strokeWidth="1" fill="none" strokeLinecap="round" />
                <ellipse cx="75" cy="48" rx="3" ry="2" fill="#2a2a2a" />
                <path d="M75 47 L74 49 L75 49.5 L76 49 Z" fill="#ff9eb5" />
                <line x1="62" y1="48" x2="70" y2="48" stroke="#999" strokeWidth="0.5" />
                <line x1="80" y1="48" x2="88" y2="48" stroke="#999" strokeWidth="0.5" />
                <ellipse cx="42" cy="62" rx="4" ry="3" fill="#0a0a0a" />
                <ellipse cx="60" cy="63" rx="4" ry="3" fill="#0a0a0a" />
                <text x="20" y="22" fontSize="14" fill="#a5b4fc" fontWeight="bold" className="cat-z cat-z1">z</text>
                <text x="10" y="32" fontSize="11" fill="#a5b4fc" fontWeight="bold" className="cat-z cat-z2">z</text>
                <text x="4" y="40" fontSize="8" fill="#a5b4fc" fontWeight="bold" className="cat-z cat-z3">z</text>
              </>
            ) : pose === 'stretch' ? (
              <>
                {/* ESTIRÁNDOSE */}
                <path d="M12 50 Q4 42 8 28" stroke="#0a0a0a" strokeWidth="6" fill="none" strokeLinecap="round" />
                <ellipse cx="50" cy="48" rx="36" ry="10" fill="#1a1a1a" />
                <ellipse cx="50" cy="46" rx="32" ry="8" fill="#252525" />
                <circle cx="85" cy="40" r="11" fill="#1a1a1a" />
                <circle cx="85" cy="40" r="9" fill="#222" />
                <path d="M79 32 L77 24 L84 30 Z" fill="#0a0a0a" />
                <path d="M80 30 L79 26 L82 29 Z" fill="#ff9eb5" />
                <path d="M86 30 L89 23 L93 31 Z" fill="#0a0a0a" />
                <path d="M87 29 L89 26 L91 30 Z" fill="#ff9eb5" />
                <path d="M81 39 Q83 41 85 39" stroke="#000" strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d="M86 39 Q88 41 90 39" stroke="#000" strokeWidth="1" fill="none" strokeLinecap="round" />
                <ellipse cx="86" cy="44" rx="3" ry="3.5" fill="#2a0a14" />
                <rect x="80" y="52" width="6" height="14" fill="#0a0a0a" rx="3" />
                <rect x="72" y="52" width="6" height="14" fill="#0a0a0a" rx="3" />
                <rect x="18" y="50" width="6" height="14" fill="#0a0a0a" rx="3" />
                <rect x="28" y="50" width="6" height="14" fill="#0a0a0a" rx="3" />
              </>
            ) : (
              <>
                {/* SENTADO / CAMINANDO / GROOM / PLAY / LOOK-UP / YAWN */}
                {pose === 'play' && (
                  <circle className="cat-ball" cx="22" cy="62" r="4" fill="#ef4444" />
                )}
                <path
                  className="cat-tail"
                  d={
                    pose === 'walk-right' || pose === 'walk-left' ? 'M22 48 Q10 38 14 22' :
                    pose === 'play' ? 'M22 50 Q14 38 22 22' :
                    pose === 'look-up' ? 'M22 50 Q12 44 20 32' :
                    'M22 50 Q12 42 18 28'
                  }
                  stroke="#0a0a0a"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                />
                <ellipse cx="50" cy="48" rx="26" ry="14" fill="#1a1a1a" />
                <path d="M35 41 Q40 39 45 41" stroke="#2d2d2d" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.6" />
                <path d="M50 40 Q55 38 60 40" stroke="#2d2d2d" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.6" />
                <path d="M40 45 Q48 43 56 45" stroke="#2d2d2d" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.5" />
                <ellipse cx="50" cy="54" rx="14" ry="7" fill="#3a3a3a" />
                <ellipse cx="50" cy="55" rx="9" ry="4" fill="#4a4a4a" opacity="0.7" />
                <g className={pose === 'look-up' ? 'cat-head-up' : ''}>
                  <circle cx="72" cy="32" r="14" fill="#1a1a1a" />
                  <circle cx="72" cy="32" r="12" fill="#222" />
                  <ellipse cx="62" cy="36" rx="3" ry="2" fill="#2d2d2d" opacity="0.7" />
                  <ellipse cx="82" cy="36" rx="3" ry="2" fill="#2d2d2d" opacity="0.7" />
                  <path d="M72 22 L72 28" stroke="#0a0a0a" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
                  <path d="M63 22 L61 11 L70 18 Z" fill="#0a0a0a" />
                  <path d="M64 20 L63 14 L68 18 Z" fill="#ff9eb5" />
                  <path d="M75 18 L80 9 L84 20 Z" fill="#0a0a0a" />
                  <path d="M77 18 L80 13 L82 19 Z" fill="#ff9eb5" />
                  {pose === 'yawn' || pose === 'groom' ? (
                    <g className="cat-eyes">
                      <path d="M64.5 32 Q67 33.5 69.5 32" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                      <path d="M73.5 32 Q76 33.5 78.5 32" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                    </g>
                  ) : pose === 'play' ? (
                    <g className="cat-eyes">
                      <ellipse cx="67" cy="32" rx="3" ry="3.5" fill="#fde047" />
                      <ellipse cx="76" cy="32" rx="3" ry="3.5" fill="#fde047" />
                      <ellipse cx="67" cy="32" rx="2" ry="3" fill="#000" />
                      <ellipse cx="76" cy="32" rx="2" ry="3" fill="#000" />
                      <circle cx="67.6" cy="31" r="0.7" fill="#fff" />
                      <circle cx="76.6" cy="31" r="0.7" fill="#fff" />
                    </g>
                  ) : pose === 'look-up' ? (
                    <g className="cat-eyes">
                      <ellipse cx="67" cy="32" rx="2.8" ry="3.2" fill="#fde047" />
                      <ellipse cx="76" cy="32" rx="2.8" ry="3.2" fill="#fde047" />
                      <ellipse cx="67" cy="30.5" rx="0.9" ry="2.5" fill="#000" />
                      <ellipse cx="76" cy="30.5" rx="0.9" ry="2.5" fill="#000" />
                      <circle cx="67.7" cy="29.5" r="0.6" fill="#fff" />
                      <circle cx="76.7" cy="29.5" r="0.6" fill="#fff" />
                    </g>
                  ) : (
                    <g className="cat-eyes">
                      <ellipse cx="67" cy="32" rx="2.8" ry="3.2" fill="#fde047" />
                      <ellipse cx="76" cy="32" rx="2.8" ry="3.2" fill="#fde047" />
                      <ellipse cx="67" cy="32" rx="0.8" ry="2.8" fill="#000" />
                      <ellipse cx="76" cy="32" rx="0.8" ry="2.8" fill="#000" />
                      <circle cx="67.8" cy="31" r="0.6" fill="#fff" />
                      <circle cx="76.8" cy="31" r="0.6" fill="#fff" />
                    </g>
                  )}
                  <ellipse cx="72" cy="37" rx="3.5" ry="2.5" fill="#2a2a2a" />
                  <path d="M70.5 36 L73.5 36 L72 37.5 Z" fill="#ff9eb5" />
                  {pose === 'yawn' ? (
                    <ellipse cx="72" cy="40.5" rx="3" ry="3.5" fill="#2a0a14" />
                  ) : pose === 'groom' ? (
                    <>
                      <ellipse cx="72" cy="40" rx="2" ry="2" fill="#2a0a14" />
                      <ellipse cx="72" cy="41.5" rx="1.6" ry="2.2" fill="#ff7fa5" className="cat-tongue" />
                    </>
                  ) : pose === 'play' || meowing ? (
                    <>
                      <path d="M72 37.5 L72 39" stroke="#000" strokeWidth="0.6" />
                      <path d="M72 39 Q69 41.5 67 40.5" stroke="#000" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                      <path d="M72 39 Q75 41.5 77 40.5" stroke="#000" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                    </>
                  ) : (
                    <path d="M72 37.5 L72 39 M72 39 Q70.5 40 70 39.5 M72 39 Q73.5 40 74 39.5" stroke="#000" strokeWidth="0.6" fill="none" strokeLinecap="round" />
                  )}
                  <line x1="58" y1="36" x2="68" y2="36" stroke="#bbb" strokeWidth="0.5" />
                  <line x1="58" y1="38" x2="68" y2="37.5" stroke="#bbb" strokeWidth="0.5" />
                  <line x1="58" y1="40" x2="68" y2="39" stroke="#bbb" strokeWidth="0.5" />
                  <line x1="76" y1="36" x2="86" y2="36" stroke="#bbb" strokeWidth="0.5" />
                  <line x1="76" y1="37.5" x2="86" y2="38" stroke="#bbb" strokeWidth="0.5" />
                  <line x1="76" y1="39" x2="86" y2="40" stroke="#bbb" strokeWidth="0.5" />
                </g>
                {pose === 'groom' ? (
                  <>
                    <g className="cat-paw-up">
                      <rect x="62" y="38" width="5" height="14" fill="#0a0a0a" rx="2.5" transform="rotate(35, 64.5, 45)" />
                      <ellipse cx="62" cy="40" rx="3.5" ry="2.2" fill="#222" />
                    </g>
                    <g className="cat-leg">
                      <rect x="40" y="54" width="6" height="12" fill="#0a0a0a" rx="2.5" />
                      <ellipse cx="43" cy="66" rx="4" ry="2" fill="#222" />
                    </g>
                    <g className="cat-leg">
                      <rect x="52" y="54" width="6" height="12" fill="#0a0a0a" rx="2.5" />
                      <ellipse cx="55" cy="66" rx="4" ry="2" fill="#222" />
                    </g>
                  </>
                ) : pose === 'play' ? (
                  <>
                    <g className="cat-paw-play">
                      <rect x="24" y="54" width="6" height="14" fill="#0a0a0a" rx="2.5" transform="rotate(-25, 27, 60)" />
                      <ellipse cx="22" cy="62" rx="3.5" ry="2.2" fill="#222" />
                    </g>
                    <g className="cat-leg">
                      <rect x="46" y="54" width="6" height="12" fill="#0a0a0a" rx="2.5" />
                      <ellipse cx="49" cy="66" rx="4" ry="2" fill="#222" />
                    </g>
                    <g className="cat-leg">
                      <rect x="58" y="54" width="6" height="12" fill="#0a0a0a" rx="2.5" />
                      <ellipse cx="61" cy="66" rx="4" ry="2" fill="#222" />
                    </g>
                  </>
                ) : (
                  <>
                    <g className="cat-leg cat-leg-1">
                      <rect x="34" y="54" width="6" height="12" fill="#0a0a0a" rx="2.5" />
                      <ellipse cx="37" cy="66" rx="4" ry="2" fill="#222" />
                      <circle cx="35" cy="65.5" r="0.7" fill="#ff9eb5" />
                      <circle cx="37" cy="65.8" r="0.7" fill="#ff9eb5" />
                      <circle cx="39" cy="65.5" r="0.7" fill="#ff9eb5" />
                    </g>
                    <g className="cat-leg cat-leg-2">
                      <rect x="46" y="54" width="6" height="12" fill="#0a0a0a" rx="2.5" />
                      <ellipse cx="49" cy="66" rx="4" ry="2" fill="#222" />
                    </g>
                    <g className="cat-leg cat-leg-3">
                      <rect x="58" y="54" width="6" height="12" fill="#0a0a0a" rx="2.5" />
                      <ellipse cx="61" cy="66" rx="4" ry="2" fill="#222" />
                    </g>
                  </>
                )}
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}


type BaseMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePlaceholder?: string;
  imageData?: string;
  docPlaceholder?: string;
  reasoning?: string;
  model?: string;
};

/* ─────────── Helper: sanitizar chats antes de localStorage ───────────
   Quita imageData (base64 enorme) que revienta la cuota.
   Mantiene imagePlaceholder (solo el nombre) para que el usuario vea
   "[imagen.jpg]" en el historial. */
function sanitizeChatsForStorage(chats: any[]): any[] {
  return chats.map(c => ({
    ...c,
    messages: (c.messages || []).map((m: any) => {
      if (m.imageData) {
        const { imageData, ...rest } = m;
        return rest;
      }
      return m;
    })
  }));
}

function safeSetChats(chats: any[]): void {
  try {
    localStorage.setItem("chimuelo_chats", JSON.stringify(sanitizeChatsForStorage(chats)));
  } catch (e) {
    // Si igual revienta la cuota, intentar sin attachments del todo
    try {
      const stripped = chats.map(c => ({
        ...c,
        messages: (c.messages || []).map((m: any) => {
          const { imageData, docPlaceholder, ...rest } = m;
          return rest;
        })
      }));
      localStorage.setItem("chimuelo_chats", JSON.stringify(stripped));
    } catch {
      console.warn('localStorage lleno — chats no guardados en este turno.');
    }
  }
}

/* ─────────── SISTEMA DE BACKUP LOCAL ───────────
   Captura TODO el estado de la app y permite:
   1. Auto-respaldo rotativo (3 versiones, 1 cada 30 min)
   2. Export a archivo JSON descargable
   3. Import desde archivo JSON (restaura todo)
   Las 3 versiones rotativas viven en localStorage como un cinturón
   de seguridad: si las claves principales se corrompen o se borran
   accidentalmente, la app puede recuperarse desde la última válida.
   ─────────────────────────────────────────────── */

const BACKUP_KEYS_TO_CAPTURE = [
  'chimuelo_chats',
  'chimuelo_subjects',
  'chimuelo_active_subject',
  'chimuelo_current_chat',
  'chimuelo_memory',
  'chimuelo_memoryEnabled',
  'chimuelo_user_name',
  'chimuelo_onboarding_done',
  'chimuelo_model',
  'chimuelo_theme',
  'chimuelo_persona',
  'chimuelo_custom_instructions',
  'chimuelo_bubble_style',
  'chimuelo_message_density',
];

function captureAppSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const key of BACKUP_KEYS_TO_CAPTURE) {
    const v = localStorage.getItem(key);
    if (v !== null) snapshot[key] = v;
  }
  return snapshot;
}

function performAutoBackup() {
  try {
    const snapshot = captureAppSnapshot();
    if (Object.keys(snapshot).length === 0) return;
    const payload = JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      data: snapshot
    });
    // Rotación: backup_v1 (más reciente), v2, v3 (más antiguo)
    const v2 = localStorage.getItem('chimuelo_backup_v1');
    const v1 = localStorage.getItem('chimuelo_backup_v2');
    if (v1) localStorage.setItem('chimuelo_backup_v3', v1);
    if (v2) localStorage.setItem('chimuelo_backup_v2', v2);
    localStorage.setItem('chimuelo_backup_v1', payload);
    localStorage.setItem('chimuelo_last_backup_at', Date.now().toString());
  } catch (e) {
    console.warn('Auto-backup falló:', e);
  }
}

function downloadBackupFile() {
  const snapshot = captureAppSnapshot();
  const payload = {
    app: 'Chimuelo',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: snapshot
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fecha = new Date().toISOString().split('T')[0];
  a.download = `chimuelo-backup-${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importBackupFile(file: File): Promise<{ok: boolean; msg: string}> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed.data || typeof parsed.data !== 'object') {
      return { ok: false, msg: 'Archivo no válido (estructura incorrecta).' };
    }
    // Backup actual antes de sobrescribir
    performAutoBackup();
    // Restaurar
    let restored = 0;
    for (const [key, value] of Object.entries(parsed.data)) {
      if (BACKUP_KEYS_TO_CAPTURE.includes(key) && typeof value === 'string') {
        localStorage.setItem(key, value);
        restored++;
      }
    }
    return { ok: true, msg: `Restauradas ${restored} claves. Recargando…` };
  } catch (e: any) {
    return { ok: false, msg: 'Error: ' + (e?.message || 'archivo dañado') };
  }
}

type Chat = {
  id: string;
  title: string;
  messages: BaseMessage[];
  updatedAt: number;
  systemPrompt?: string;
  subjectId?: string;
  agentId?: string;
  pinned?: boolean;
};

/* ─────────── Agentes (estilo WhatsApp — familia) ─────────── */
type Agent = {
  id: string;
  name: string;
  emoji: string;
  bgColor: string;
  tagline: string;
  description: string;
  greeting: string;
  suggestions: string[];
  prompt: string;
  /* Score 0-100 — productividad respaldada por investigación.
     Mayor = más impacto documentado en familias según estudios. */
  score: number;
};

/* ─────────── 20 AGENTES rankeados por productividad familiar ───────────
   Score basado en literatura de productividad (Atomic Habits, Deep Work,
   Gottman Institute, USDA meal-planning research, Bloom 2-sigma problem,
   Cal Newport, BJ Fogg, Bogleheads, Marie Kondo studies, etc.) */
const AGENTS: Agent[] = [
  {
    id: 'planner', name: 'Planificador Semanal', emoji: '🗓️', bgColor: '#0ea5e9', score: 100,
    tagline: 'Tu agenda compartida sin pelearse',
    description: 'Te ayuda a planear la semana de toda la familia: reuniones, deportes, comidas, recados. Ahorra 4+ horas a la semana.',
    greeting: 'Hola, soy tu planner semanal. Cuéntame qué semana se viene y te armo el horario fácil. ¿Por dónde partimos?',
    suggestions: ['Plan de esta semana', 'Tengo mil cosas mañana', 'Reorganízame el lunes', 'Lista de pendientes'],
    prompt: 'Eres un planificador semanal experto basado en time-blocking de Cal Newport y GTD. Ayudas a familias a ordenar su semana: reuniones, deportes, comidas, recados. Preguntas qué hay que hacer y cuándo, luego propones un orden realista. Hablas claro y breve, sin recargar. Tono amigo cercano.'
  },
  {
    id: 'finance', name: 'Coach Financiero', emoji: '💰', bgColor: '#22c55e', score: 96,
    tagline: 'Presupuesto y ahorros sin estrés',
    description: 'Te enseña a presupuestar, ahorrar y salir de deudas. Familias con presupuesto ahorran 15-20% más.',
    greeting: 'Soy tu coach de finanzas. Te ayudo con presupuesto, deudas y ahorros sin sermones. ¿Cuál es tu mayor dolor de cabeza con la plata?',
    suggestions: ['Cómo armo mi presupuesto', 'Tengo deudas, ¿qué hago?', 'Quiero ahorrar 200 lucas', 'Gasto mucho en delivery'],
    prompt: 'Eres un coach financiero práctico basado en Dave Ramsey + I Will Teach You To Be Rich. Ayudas a familias chilenas con presupuesto, ahorros, deudas. NO juzgas. Das pasos concretos pequeños. Tono amigo confiable.'
  },
  {
    id: 'chef', name: 'Chef Estratégico', emoji: '🍳', bgColor: '#fb923c', score: 93,
    tagline: 'Menús semanales y lista de compras',
    description: 'Te arma menús con lo que tienes, reduce 27% el gasto en comida según USDA, evita el "qué cocino" diario.',
    greeting: '¡Qué hambre! Soy tu chef. Dime qué tenís en la pensa o cuántos son y te armo algo rico. ¿Qué vamos a comer?',
    suggestions: ['Menú para esta semana', 'Receta con lo que tengo', 'Lista de compras', 'Algo rápido y barato'],
    prompt: 'Eres un chef estratégico que usa meal-planning research (USDA). Pides qué hay disponible y cuántos comen, luego das recetas concretas paso a paso, conversacionalmente. Ayudas con listas de compras. Tono relajado, chileno.'
  },
  {
    id: 'sleep', name: 'Coach del Sueño', emoji: '😴', bgColor: '#6366f1', score: 90,
    tagline: 'Duerme mejor desde esta noche',
    description: 'Basado en Matthew Walker y Huberman: rutinas de sueño que mejoran ánimo, memoria y peso.',
    greeting: '¿Dormís bien o andai con sueño? Soy tu coach del sueño. Te ayudo a descansar mejor sin pastillas ni misterios.',
    suggestions: ['No puedo dormir', 'Me despierto cansado', 'Rutina antes de dormir', 'Mi guagua no duerme'],
    prompt: 'Eres un coach del sueño basado en "Why We Sleep" (Walker) y los protocolos de Huberman. Ayudas con higiene del sueño, rutinas, insomnio leve. Para problemas graves redirigís al médico. Tono cercano, basado en ciencia.'
  },
  {
    id: 'tutor', name: 'Tutor Académico', emoji: '📚', bgColor: '#3b82f6', score: 88,
    tagline: 'Te explico hasta que cache',
    description: 'Tutoría 1-a-1 estilo Bloom 2-sigma: mejora 2 desviaciones estándar sobre clase normal.',
    greeting: 'Soy tu profe particular. Dime qué materia y en qué curso estai, y te ayudo a entenderlo de verdad. ¿En qué te ayudo?',
    suggestions: ['Tengo prueba mañana', 'No entiendo álgebra', 'Cómo estudio mejor', 'Resumen rápido de…'],
    prompt: 'Eres un tutor académico paciente basado en Bloom 2-sigma problem. NUNCA das la respuesta directa: guías con preguntas socráticas. Adaptas tu lenguaje al nivel. Validas el esfuerzo. Tono amigo.'
  },
  {
    id: 'gottman', name: 'Comunicación Familiar', emoji: '🫂', bgColor: '#ec4899', score: 85,
    tagline: 'Conversa sin pelear',
    description: 'Técnicas del Gottman Institute (40 años de research): ratio 5:1 positivo/negativo predice relaciones sanas.',
    greeting: '¿Algún conflicto que se está volviendo bola? Te ayudo a hablarlo sin que termine en pelea.',
    suggestions: ['Pelea con mi pareja', 'Mi hijo no me escucha', 'Cómo decir algo difícil', 'Mi hermano y yo no nos hablamos'],
    prompt: 'Eres un coach de comunicación familiar basado en Gottman Institute. Enseñas: I-statements, validación emocional, ratio 5:1, "soft start-up". No diagnosticas. Tono empático y directo.'
  },
  {
    id: 'habits', name: 'Mentor de Hábitos', emoji: '🌱', bgColor: '#10b981', score: 83,
    tagline: 'Cambia 1% cada día',
    description: 'Atomic Habits (James Clear) + Tiny Habits (BJ Fogg). El cambio sostenido viene de hábitos chicos.',
    greeting: '¿Qué hábito quieres construir o cortar? Soy tu mentor. Te enseño a hacerlo sin fuerza de voluntad épica.',
    suggestions: ['Quiero hacer ejercicio', 'Dejar el celular en la cama', 'Leer más', 'Cómo arrancar de a poco'],
    prompt: 'Eres un mentor de hábitos basado en Atomic Habits (Clear) y Tiny Habits (BJ Fogg). Enseñas: stacking, ambiente, identidad. Pides empezar súper chico. NUNCA dices "fuerza de voluntad". Tono motivador realista.'
  },
  {
    id: 'doctor', name: 'Triage Médico', emoji: '🩺', bgColor: '#ef4444', score: 80,
    tagline: '¿Voy al doctor o me aguanto?',
    description: 'Primera evaluación de síntomas. Reduce visitas innecesarias 30%. SIEMPRE deriva si es serio.',
    greeting: 'Soy tu triage médico. Cuéntame qué síntomas tenís y te oriento si es algo casero o que requiere doctor. ¿Qué sentís?',
    suggestions: ['Me duele la cabeza hace días', 'Mi guagua tiene fiebre', 'Tengo tos rara', 'Acidez en el estómago'],
    prompt: 'Eres un triage médico basado en guías clínicas estándar (Mayo Clinic, NHS). NO diagnosticas, orientas. Pides síntomas, duración, edad. Indicas si es: casero / médico no urgente / urgencias YA. Tono claro, tranquilizador.'
  },
  {
    id: 'career', name: 'Coach de Carrera', emoji: '💼', bgColor: '#8b5cf6', score: 77,
    tagline: 'CV, entrevistas y networking',
    description: 'Estrategia de carrera + LinkedIn. Networking research muestra 70% de empleos vienen de contactos.',
    greeting: 'Soy tu coach de carrera. Te ayudo con CV, entrevistas, LinkedIn, cambio de pega. ¿En qué andai?',
    suggestions: ['Mejorá mi CV', 'Entrevista la otra semana', 'Quiero cambiarme de pega', 'Cómo hacer LinkedIn'],
    prompt: 'Eres un coach de carrera basado en "Designing Your Life" (Burnett) + LinkedIn research. Ayudas con CV, entrevistas, networking, transición. Tono cercano y estratégico.'
  },
  {
    id: 'invest', name: 'Mentor de Inversiones', emoji: '📈', bgColor: '#0891b2', score: 75,
    tagline: 'Fondos índice y largo plazo',
    description: 'Bogleheads + research: fondos índice baten 90% de fondos gestionados a largo plazo. Sin promesas mágicas.',
    greeting: 'Hola, soy tu mentor de inversiones. Te explico fondos, AFP, depósitos a plazo sin enredos ni promesas raras. ¿Qué quieres aprender?',
    suggestions: ['Cómo empiezo a invertir', 'Qué es un fondo índice', 'Mi AFP, ¿cuál elijo?', 'Tengo 500 lucas, ¿qué hago?'],
    prompt: 'Eres un mentor de inversiones basado en Bogleheads / Jack Bogle. Predicas índices, largo plazo, diversificación. NUNCA prometes retornos. Adaptas a contexto chileno (AFP, fondos). Tono honesto y educativo.'
  },
  {
    id: 'shopper', name: 'Asesor de Compras', emoji: '🛒', bgColor: '#f59e0b', score: 73,
    tagline: 'No te dejes estafar',
    description: 'Compara precios, calidad, alternativas. Evita compras impulsivas y rebajas falsas.',
    greeting: 'Antes de comprar algo, pregúntame. Soy tu asesor de compras. ¿Qué andai mirando?',
    suggestions: ['Voy a comprar un notebook', 'Refri nueva, ¿cuál?', '¿Vale la pena este celular?', 'Cómo comparar precios'],
    prompt: 'Eres un asesor de compras basado en Consumer Reports + Wirecutter. Comparas precio/calidad, advertes sobre rebajas falsas, sugieres alternativas. Tono directo, sin venderle nada al usuario.'
  },
  {
    id: 'declutter', name: 'Organizador del Hogar', emoji: '🧹', bgColor: '#06b6d4', score: 70,
    tagline: 'Ordena sin que te dé crisis',
    description: 'Método KonMari + research: el desorden eleva cortisol. Casas ordenadas reducen estrés 30%.',
    greeting: 'Soy tu organizador. Te ayudo a ordenar sin sentirte abrumado. ¿Por qué rincón empezamos?',
    suggestions: ['Mi closet es un caos', 'Cocina desordenada', 'Cómo guardo papeles', 'Mi escritorio explota'],
    prompt: 'Eres un organizador basado en Marie Kondo + research sobre clutter y cortisol. Enseñas por categorías no por habitaciones. Preguntas qué tiene la persona y le ayudas decidir qué se queda. Tono empático.'
  },
  {
    id: 'psicologo', name: 'Apoyo Emocional', emoji: '🌿', bgColor: '#84cc16', score: 67,
    tagline: 'Te escucho y te oriento',
    description: 'Técnicas de CBT validadas. NO reemplaza terapia profesional. Para cuando necesitas hablar.',
    greeting: 'Estoy aquí para escucharte. Cuéntame qué te tiene pensando o sintiendo así. No te juzgo.',
    suggestions: ['Me siento ansioso', 'No puedo dormir de pensar', 'Algo me tiene mal', 'Necesito desahogarme'],
    prompt: 'Eres un agente de apoyo emocional basado en CBT (Aaron Beck). Escuchas activamente, validas. NUNCA diagnosticas. Si detectás riesgo serio (autolesión, depresión profunda) sugerís ayuda profesional con calidez. Tono cálido.'
  },
  {
    id: 'crianza', name: 'Consejero de Crianza', emoji: '👶', bgColor: '#f472b6', score: 64,
    tagline: 'Crianza con respeto',
    description: 'Attachment theory (Bowlby) + crianza respetuosa. Mejora la conducta a largo plazo.',
    greeting: 'Soy tu consejero de crianza. Te ayudo con pataletas, sueño, límites, lo que sea. ¿Cuántos años tiene tu peque?',
    suggestions: ['Mi hijo tiene pataletas', 'Cómo poner límites', 'No quiere ir al colegio', 'Pelea con sus hermanos'],
    prompt: 'Eres un consejero de crianza basado en attachment theory + crianza respetuosa (Aletha Solter). NO castigos físicos. Validás emociones del niño. Edad-apropiado. Tono empático.'
  },
  {
    id: 'trainer', name: 'Personal Trainer', emoji: '💪', bgColor: '#22c55e', score: 60,
    tagline: 'Rutinas en casa, sin gimnasio',
    description: 'OMS: 150 min/sem de ejercicio moderado mejora salud cardiovascular y ánimo significativamente.',
    greeting: '¡Vamos! Soy tu trainer. Te armo rutinas en casa o donde sea. ¿Cuánto tiempo tenís hoy?',
    suggestions: ['Rutina de 20 min', 'Empezar a correr', 'Solo tengo pesas chicas', 'Quiero bajar de peso'],
    prompt: 'Eres un personal trainer basado en guidelines de la OMS y NSCA. Rutinas progresivas según nivel. NO presionas. Animas constancia sobre intensidad. Tono enérgico pero respetuoso.'
  },
  {
    id: 'mediator', name: 'Mediador de Conflictos', emoji: '🕊️', bgColor: '#a78bfa', score: 57,
    tagline: 'Resuelve peleas sin perdedores',
    description: 'Mediación familiar basada en Harvard Negotiation Project. Soluciones donde todos ceden y ganan.',
    greeting: '¿Algún conflicto que no logran resolver? Te ayudo a mediar sin que alguien quede mal. ¿Qué pasa?',
    suggestions: ['Pelea entre hermanos', 'Discusión con mi suegra', 'Mi pareja y yo no nos entendemos', 'Vecino conflictivo'],
    prompt: 'Eres un mediador basado en "Getting to Yes" (Fisher, Ury) del Harvard Negotiation Project. Separas personas del problema. Enfocas intereses no posiciones. Tono neutral y constructivo.'
  },
  {
    id: 'idiomas', name: 'Profesor de Idiomas', emoji: '🌐', bgColor: '#06b6d4', score: 53,
    tagline: 'Aprende inglés (u otro) sin academia',
    description: 'Método Krashen (input comprensible): exposición consistente > clases formales para fluidez.',
    greeting: 'Hi! Soy tu profe de idiomas. ¿Qué quieres aprender o practicar? Voy a tu ritmo.',
    suggestions: ['Quiero mejorar inglés', 'Cómo se dice…', 'Practicar conversación', 'Tengo entrevista en inglés'],
    prompt: 'Eres un profe de idiomas basado en hipótesis del input de Krashen. Usas input comprensible un nivel sobre el del alumno. Inglés mayormente pero adaptable. Tono motivador.'
  },
  {
    id: 'legal', name: 'Asistente Legal', emoji: '⚖️', bgColor: '#475569', score: 50,
    tagline: 'Lo legal sin abogado caro',
    description: 'Te explica contratos, derechos, trámites en lenguaje simple. NO reemplaza abogado para casos complejos.',
    greeting: 'Soy tu asistente legal básico. Te explico contratos, multas, derechos del consumidor sin enredos. ¿Qué necesitas?',
    suggestions: ['Me llegó una multa', 'Contrato de arriendo', 'Mis derechos en el trabajo', 'Garantía del producto'],
    prompt: 'Eres un asistente legal básico que conoce ley chilena estándar. Lenguaje simple. Para casos complejos derivas a abogado. NO eres reemplazo profesional. Tono claro.'
  },
  {
    id: 'mindful', name: 'Guía de Mindfulness', emoji: '🧘', bgColor: '#7c3aed', score: 45,
    tagline: 'Calma cuando todo va rápido',
    description: 'Meditación basada en MBSR (Kabat-Zinn). Reduce estrés, mejora foco. 10 min al día.',
    greeting: '¿Andai con la cabeza llena? Te ayudo a respirar y aterrizar. ¿Qué necesitas, calma o foco?',
    suggestions: ['Estoy ansioso ahora', 'Cómo medito 5 min', 'No me concentro', 'Antes de dormir'],
    prompt: 'Eres un guía de mindfulness basado en MBSR (Jon Kabat-Zinn). Das ejercicios cortos guiados (respiración 4-7-8, body scan). Tono calmado, sin pseudociencia.'
  },
  {
    id: 'storyteller', name: 'Cuentacuentos', emoji: '📖', bgColor: '#f97316', score: 40,
    tagline: 'Historias para los más chicos',
    description: 'Leer cuentos predice vocabulario, empatía y éxito escolar (Hart-Risley, Mol & Bus).',
    greeting: 'Hola peque, ¿quieres un cuento? Dime quién es el personaje y de qué va. ¡Vamos a inventar!',
    suggestions: ['Cuento de un dragón bueno', 'Princesa valiente', 'Astronauta gato', 'Cuento de 1 minuto'],
    prompt: 'Eres un cuentacuentos para niños. Historias breves, dulces, con valores (amistad, valentía). Adaptas edad. Tono cariñoso y juguetón.'
  },
];

type Subject = {
  id: string;
  name: string;
  baseMemory: string;
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<"wrong" | "old" | null>(null);
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  const [inputMessage, setInputMessage] = useState("");
  const [attachedImage, setAttachedImage] = useState<{base64: string, name: string, type?: string} | null>(null);
  const [attachedDoc, setAttachedDoc] = useState<File | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingTask, setThinkingTask] = useState<"image" | "document" | "code" | "general">("general");
  const [pendingImagePrompt, setPendingImagePrompt] = useState<string | null>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"chat" | "university" | "agents" | "settings" | "agents">("chat");
  const [agentSearch, setAgentSearch] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [uniInput, setUniInput] = useState('');
  const [uniAttachment, setUniAttachment] = useState<{base64: string, name: string, type?: string} | null>(null);
  const [subjectMenu, setSubjectMenu] = useState<{id: string, x: number, y: number} | null>(null);
  const [addingSubject, setAddingSubject] = useState(false);
  const [inlineSubjectName, setInlineSubjectName] = useState('');
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [artifactModal, setArtifactModal] = useState<string | null>(null);
  
  const [theme, setTheme] = useState<"system" | "light" | "dark" | "pink" | "orange" | "oled" | "snow">("system");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [persona, setPersona] = useState<"default" | "serio" | "cursi" | "chistoso" | "directo" | "amable" | "profesional">("default");
  const [model, setModel] = useState<"deepseek-v4-pro" | "deepseek-v4-flash">("deepseek-v4-flash");
  const [enterToSend, setEnterToSend] = useState<boolean>(true);
  const [bubbleStyle, setBubbleStyle] = useState<"bubbles" | "flat">("bubbles");
  const [messageDensity, setMessageDensity] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [userMemory, setUserMemory] = useState<{id: string; content: string; createdAt: number}[]>([]);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [userName, setUserName] = useState<string>("");
  const [editingName, setEditingName] = useState<boolean>(false);
  const [lastBackupAt, setLastBackupAt] = useState<number>(0);
  const [showVersionModal, setShowVersionModal] = useState<boolean>(false);
  const [showWelcomeOnboarding, setShowWelcomeOnboarding] = useState<boolean>(false);
  const [onboardingNameInput, setOnboardingNameInput] = useState<string>("");
  const [versionData, setVersionData] = useState<{version: string; date: string; changes: {icon: string; title: string; desc: string}[]}>({ version: '', date: '', changes: [] });
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [showVersionBanner, setShowVersionBanner] = useState(false);
  const [appReady, setAppReady] = useState(false);

  type SmartPill = { icon: string; label: string; message: string };
  const defaultPills: SmartPill[] = [
    { icon: '🎨', label: 'Crear Imagen', message: 'Genera una imagen de un paisaje cyberpunk en formato ultra realista' },
    { icon: '✉️', label: 'Redactar Correo', message: 'Escribe un correo formal para solicitar una reunión con un cliente' },
    { icon: '🧠', label: 'Explicar Concepto', message: 'Explícame de forma sencilla cómo funciona la gravedad cuántica' },
    { icon: '👋', label: 'Preséntate', message: 'Preséntate y cuéntame qué puedes hacer por mí. ¿Cómo funciona todo esto?' },
  ];
  const [smartPills, setSmartPills] = useState<SmartPill[]>(defaultPills);

  // Manual messages state (replaces useChat)
  const [displayMessages, setDisplayMessages] = useState<BaseMessage[]>([]);

  // v2.0 productivity state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [sidebarSearch, setSidebarSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  // Scroll architecture v4 — prevMaxScrollTop + useLayoutEffect.
  // The DOM is the single source of truth. Before each render, we know the
  // scroll container's max scrollTop. After the render (in useLayoutEffect),
  // we compare the user's CURRENT scrollTop against the previous max.
  // If they were at the old bottom → stick. If they scrolled up → leave alone.
  // No flags, no event handlers needed for the auto-scroll decision.
  const prevMaxScrollTop = useRef<number>(0);
  const forceScrollNext = useRef<boolean>(true);
  const skipAutoScrollRef = useRef<boolean>(false);
  const prevViewMode = useRef<"chat" | "university" | "agents">("chat");
  const abortControllerRef = useRef<AbortController | null>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const localStorageQueueRef = useRef<{ chats?: Chat[]; timer?: any }>({});
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const uniTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSystemHint = useRef('');
  const currentChatIdRef = useRef<string | null>(null);

  /* ─────────── Toast (Nivel 4 — Cambio 15) ─────────── */
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false });
  const toastTimerRef = useRef<any>(null);
  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, show: true });
    toastTimerRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 1800);
  };

  /* ─────────── Scroll-to-bottom (Nivel 3 — Cambio 12) ─────────── */
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  /* v2.0 — debounced localStorage write (chats only; called from streaming hot path) */
  const queueChatsToLS = useCallback((chats: Chat[]) => {
    localStorageQueueRef.current.chats = chats;
    if (localStorageQueueRef.current.timer) return;
    localStorageQueueRef.current.timer = setTimeout(() => {
      const pending = localStorageQueueRef.current.chats;
      localStorageQueueRef.current.timer = null;
      if (pending) {
        safeSetChats(pending);
      }
    }, 500);
  }, []);

  const flushChatsToLS = useCallback((chats: Chat[]) => {
    if (localStorageQueueRef.current.timer) {
      clearTimeout(localStorageQueueRef.current.timer);
      localStorageQueueRef.current.timer = null;
    }
    safeSetChats(chats);
    try { localStorage.setItem("chimuelo_last_active", Date.now().toString()); } catch {}
  }, []);

  /* v2.0 — Stop generation */
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /* Voice input — Web Speech API */
  const toggleVoiceInput = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta entrada de voz. Usa Chrome o Safari.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalTranscript = '';

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interim = t;
      }
      setInputMessage(finalTranscript + interim);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      // Auto-resize textarea after voice fill
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [isRecording]);

  const groupChatsByDate = (chats: Chat[]) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const unpinned = chats.filter(c => !c.pinned);
    return {
      pinned: chats.filter(c => c.pinned),
      hoy:    unpinned.filter(c => c.updatedAt >= today.getTime()),
      ayer:   unpinned.filter(c => c.updatedAt >= yesterday.getTime() && c.updatedAt < today.getTime()),
      semana: unpinned.filter(c => c.updatedAt >= weekAgo.getTime() && c.updatedAt < yesterday.getTime()),
      antes:  unpinned.filter(c => c.updatedAt < weekAgo.getTime()),
    };
  };

  const togglePinChat = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setChats(prev => {
      const updated = prev.map(c =>
        c.id === id ? { ...c, pinned: !c.pinned } : c
      );
      safeSetChats(updated);
      return updated;
    });
  }, []);

  const handleDeleteChat = useCallback((id: string) => {
    if (!window.confirm('¿Eliminar esta conversación? Esta acción no se puede deshacer.')) return;
    setChats(prev => {
      const updated = prev.filter(c => c.id !== id);
      safeSetChats(updated);
      return updated;
    });
    if (currentChatId === id) {
      setCurrentChatId(null);
      setDisplayMessages([]);
      localStorage.removeItem("chimuelo_current_chat");
    }
  }, [currentChatId]);

  const handleRenameChat = useCallback((id: string) => {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    const next = window.prompt('Nuevo nombre del chat:', chat.title);
    if (!next || !next.trim() || next.trim() === chat.title) return;
    setChats(prev => {
      const updated = prev.map(c =>
        c.id === id ? { ...c, title: next.trim() } : c
      );
      safeSetChats(updated);
      return updated;
    });
  }, [chats]);

  /* Chat context menu (right-click on PC, long-press on mobile) */
  const [chatMenu, setChatMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const [msgMenu, setMsgMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef<boolean>(false);
  const msgLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgLongPressFired = useRef<boolean>(false);

  const openMsgMenu = useCallback((msgId: string, x: number, y: number) => {
    const menuW = 200, menuH = 110;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.min(x, vw - menuW - 8);
    const top  = Math.min(y, vh - menuH - 8);
    setMsgMenu({ msgId, x: Math.max(8, left), y: Math.max(8, top) });
  }, []);

  const startMsgLongPress = useCallback((msgId: string, e: React.TouchEvent) => {
    msgLongPressFired.current = false;
    const touch = e.touches[0];
    const { clientX, clientY } = touch;
    if (msgLongPressTimer.current) clearTimeout(msgLongPressTimer.current);
    msgLongPressTimer.current = setTimeout(() => {
      msgLongPressFired.current = true;
      if ('vibrate' in navigator) {
        try { (navigator as any).vibrate(40); } catch {}
      }
      openMsgMenu(msgId, clientX, clientY);
    }, 480);
  }, [openMsgMenu]);

  const cancelMsgLongPress = useCallback(() => {
    if (msgLongPressTimer.current) {
      clearTimeout(msgLongPressTimer.current);
      msgLongPressTimer.current = null;
    }
  }, []);

  const openChatMenu = useCallback((chatId: string, x: number, y: number) => {
    // Clamp to viewport (menu is ~180px wide × ~150px tall)
    const menuW = 200, menuH = 160;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.min(x, vw - menuW - 8);
    const top  = Math.min(y, vh - menuH - 8);
    setChatMenu({ chatId, x: Math.max(8, left), y: Math.max(8, top) });
  }, []);

  const startLongPress = useCallback((chatId: string, e: React.TouchEvent) => {
    longPressFired.current = false;
    const touch = e.touches[0];
    const { clientX, clientY } = touch;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if ('vibrate' in navigator) {
        try { (navigator as any).vibrate(40); } catch {}
      }
      openChatMenu(chatId, clientX, clientY);
    }, 480);
  }, [openChatMenu]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /* Obtiene nombre: 1) state userName (del onboarding/edit) 2) extracción de memoria */
  const getUserName = useCallback((): string | null => {
    // Prioridad 1: nombre puesto explícitamente (onboarding o click en sidebar)
    if (userName && userName.trim()) return userName.trim();
    // Prioridad 2: fallback — extraer de conversaciones pasadas
    for (const m of userMemory) {
      const match = m.content.match(/(?:se llama|llamado|nombre es|nombre[:]\s*)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i);
      if (match && match[1]) return match[1];
    }
    return null;
  }, [userName, userMemory]);

  /* 30 variaciones de saludo (Claude/Gemini-style) divididos por hora del día */
  const greetingPool = useMemo(() => {
    const morning = [
      (n: string) => `Buenos días${n}. ¿Qué planeas hoy?`,
      (n: string) => `Buen día${n}. ¿Por dónde empezamos?`,
      (n: string) => `Hola${n}. Listo para arrancar el día`,
      (n: string) => `Buenos días${n}, ¿qué necesitas?`,
      (n: string) => `Buenas mañanas${n}, ¿en qué piensas?`,
      (n: string) => `Buen día${n}, ¿qué hay en la agenda?`,
      (n: string) => `Buenos días${n}. ¿Café listo? Manos a la obra`,
      (n: string) => `Hola${n}, ¿cómo amaneciste?`,
      (n: string) => `Buenos días${n}, ¿qué resolvemos primero?`,
      (n: string) => `${n ? n.replace(', ', '') + ', b' : 'B'}uen día. ¿Qué hacemos?`,
    ];
    const afternoon = [
      (n: string) => `Buenas tardes${n}. ¿En qué te ayudo?`,
      (n: string) => `Hola${n}, ¿cómo va la tarde?`,
      (n: string) => `Buenas${n}, ¿qué necesitas?`,
      (n: string) => `Hola${n}. ¿Dónde lo dejamos?`,
      (n: string) => `Buenas tardes${n}, ¿en qué piensas hoy?`,
      (n: string) => `¿Qué tal${n}? Cuéntame en qué te ayudo`,
      (n: string) => `Hola${n}, ¿algo entre manos?`,
      (n: string) => `Buenas tardes${n}, listo para lo que sigue`,
      (n: string) => `Tarde productiva${n}, ¿empezamos?`,
      (n: string) => `Hola${n}, ¿qué se cocina?`,
    ];
    const night = [
      (n: string) => `Buenas noches${n}. ¿En qué te ayudo?`,
      (n: string) => `Hola${n}, ¿cómo terminó tu día?`,
      (n: string) => `Buenas noches${n}, ¿qué necesitas?`,
      (n: string) => `Hola${n}, ¿algo antes de descansar?`,
      (n: string) => `Buenas${n}, ¿en qué andas?`,
      (n: string) => `Última hora del día${n}, ¿qué hacemos?`,
      (n: string) => `Hola${n}. Aquí estamos otra vez`,
      (n: string) => `Buenas noches${n}, ¿qué resuelvo?`,
      (n: string) => `¿Quemando aceite de medianoche${n}?`,
      (n: string) => `Buenas noches${n}. Cuéntame`,
    ];
    return { morning, afternoon, night };
  }, []);

  /* Índice aleatorio que se elige una sola vez por sesión */
  const [greetingIdx] = useState(() => Math.floor(Math.random() * 10));

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = getUserName();
    const suffix = name ? `, ${name}` : '';
    const pool =
      hour < 12 ? greetingPool.morning :
      hour < 19 ? greetingPool.afternoon :
      greetingPool.night;
    const fn = pool[greetingIdx % pool.length];
    return fn(suffix);
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem("chimuelo_auth");
    if (savedAuth === "true") setIsAuthenticated(true);

    const savedChats = localStorage.getItem("chimuelo_chats");
    if (savedChats) setChats(JSON.parse(savedChats));

    const savedTheme = localStorage.getItem("chimuelo_theme") as "system" | "light" | "dark" | "pink" | "orange" | "oled" | "snow";
    if (savedTheme) setTheme(savedTheme);

    const savedFontSize = localStorage.getItem("chimuelo_fontSize") as "small" | "medium" | "large";
    if (savedFontSize) setFontSize(savedFontSize);

    const savedPersona = localStorage.getItem("chimuelo_persona") as "default" | "serio" | "cursi" | "chistoso" | "directo" | "amable" | "profesional";
    if (savedPersona) setPersona(savedPersona);

    // Auto-wipe old bugged instructions from localStorage
    localStorage.removeItem("chimuelo_customInstructions");
    localStorage.removeItem("chimuelo_custom_instructions");

    const savedModel = localStorage.getItem("chimuelo_model") as "deepseek-v4-pro" | "deepseek-v4-flash";
    if (savedModel) setModel(savedModel);

    const savedEnterToSend = localStorage.getItem("chimuelo_enterToSend");
    if (savedEnterToSend !== null) setEnterToSend(savedEnterToSend === "true");

    const savedBubbleStyle = localStorage.getItem("chimuelo_bubbleStyle") as "bubbles" | "flat";
    if (savedBubbleStyle) setBubbleStyle(savedBubbleStyle);

    const savedDensity = localStorage.getItem("chimuelo_density") as "compact" | "comfortable" | "spacious";
    if (savedDensity) setMessageDensity(savedDensity);

    try {
      const savedMemory = localStorage.getItem("chimuelo_memory");
      if (savedMemory) {
        const parsed = JSON.parse(savedMemory);
        if (Array.isArray(parsed)) {
          // Migrate old string[] format to {id, content, createdAt}[]
          const normalized = parsed.map((m: any, i: number) =>
            typeof m === 'string'
              ? { id: `m_${i}`, content: m, createdAt: Date.now() }
              : m
          ).filter((m: any) => m && typeof m.content === 'string');
          setUserMemory(normalized);
          localStorage.setItem("chimuelo_memory", JSON.stringify(normalized));
        }
      }
    } catch {
      localStorage.removeItem("chimuelo_memory");
    }

    const savedMemoryEnabled = localStorage.getItem("chimuelo_memoryEnabled");
    if (savedMemoryEnabled !== null) setMemoryEnabled(savedMemoryEnabled === "true");

    const savedUserName = localStorage.getItem("chimuelo_user_name");
    if (savedUserName) setUserName(savedUserName);

    // ── Mostrar onboarding solo si NUNCA se ha completado y no hay nombre ──
    const onboardingDone = localStorage.getItem("chimuelo_onboarding_done") === "true";
    if (!savedUserName && !onboardingDone) {
      // Pequeño delay para que la app respire antes de mostrar el modal
      setTimeout(() => setShowWelcomeOnboarding(true), 800);
    }

    // ── Swipe gestures: abrir desde borde izq + cerrar arrastrando a la izq ──
    let touchStartX = 0;
    let touchStartY = 0;
    let gesture: 'none' | 'open' | 'close' = 'none';

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      const sidebarIsOpen = document.querySelector('.sidebar')?.classList.contains('sidebar-mobile-hidden') === false;
      if (!sidebarIsOpen && t.clientX <= 40) {
        // Borde izquierdo + sidebar cerrado → gesto de abrir
        gesture = 'open';
      } else if (sidebarIsOpen) {
        // Cualquier toque con sidebar abierto → posible cierre
        gesture = 'close';
      } else {
        gesture = 'none';
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (gesture === 'none') return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = Math.abs(t.clientY - touchStartY);
      if (dy > 60) { gesture = 'none'; return; } // es scroll vertical

      if (gesture === 'open' && dx > 35) {
        setSidebarOpen(true);
        gesture = 'none';
        try { (navigator as any).vibrate?.(8); } catch {}
      } else if (gesture === 'close' && dx < -50) {
        setSidebarOpen(false);
        gesture = 'none';
        try { (navigator as any).vibrate?.(6); } catch {}
      }
    };

    const onTouchEnd = () => { gesture = 'none'; };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    (window as any).__swipeCleanup = () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    const savedBackupAt = localStorage.getItem("chimuelo_last_backup_at");
    if (savedBackupAt) setLastBackupAt(parseInt(savedBackupAt, 10) || 0);

    // ── Auto-backup cada 30 minutos + uno al cargar si no hay ninguno ──
    const lastBackup = parseInt(localStorage.getItem("chimuelo_last_backup_at") || "0", 10);
    if (Date.now() - lastBackup > 30 * 60 * 1000) {
      setTimeout(() => { performAutoBackup(); setLastBackupAt(Date.now()); }, 8000);
    }
    const backupInterval = setInterval(() => {
      performAutoBackup();
      setLastBackupAt(Date.now());
    }, 30 * 60 * 1000);
    (window as any).__chimueloBackupInterval = backupInterval;

    const savedSubjects = localStorage.getItem("chimuelo_subjects");
    if (savedSubjects) setSubjects(JSON.parse(savedSubjects));
    
    const savedActiveSubject = localStorage.getItem("chimuelo_active_subject");
    if (savedActiveSubject) setActiveSubjectId(savedActiveSubject);

    // Si pasó más de 30 min desde la última actividad, abrir home (nuevo chat)
    const lastActive = parseInt(localStorage.getItem("chimuelo_last_active") || '0', 10);
    const idleMinutes = (Date.now() - lastActive) / 60000;
    const currentChat = localStorage.getItem("chimuelo_current_chat");
    if (currentChat && idleMinutes < 30) {
      setCurrentChatId(currentChat);
      if (savedChats) {
        const parsed = JSON.parse(savedChats);
        const active = parsed.find((c: Chat) => c.id === currentChat);
        if (active) {
          setDisplayMessages(active.messages);
        }
      }
    } else if (idleMinutes >= 30) {
      // Limpiar el chat actual para mostrar home
      localStorage.removeItem("chimuelo_current_chat");
    }

    const checkVersion = async () => {
      try {
        const res = await fetch("/version.json");
        if (res.ok) {
          const data = await res.json();
          const storedVersion = localStorage.getItem("chimuelo_version") || "1.0.0";
          if (data.version && data.version !== storedVersion) {
            setAppVersion(data.version);
            setVersionData(data);
            setShowVersionModal(true);
            localStorage.setItem("chimuelo_version", data.version);
          }
        }
      } catch (e) {
        console.error("Failed to check version", e);
      }
    };
    checkVersion();

    setTimeout(() => setAppReady(true), 1400);
  }, []);

  /* Fetch personalized smart pills — refresca cada vez que se vuelve al welcome
     screen pero con cache de 5 min para no abusar de la API */
  const fetchSmartPills = useCallback(() => {
    try {
      const lastFetch = parseInt(sessionStorage.getItem('chimuelo_pills_ts') || '0', 10);
      const ageMs = Date.now() - lastFetch;
      const cached = sessionStorage.getItem('chimuelo_pills_data');
      if (ageMs < 5 * 60 * 1000 && cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length === 4) {
            setSmartPills(parsed);
            return;
          }
        } catch {}
      }
      const savedChats = localStorage.getItem('chimuelo_chats');
      const chats: Chat[] = savedChats ? JSON.parse(savedChats) : [];
      const recentChats = chats.slice(0, 6).map((c: Chat) => c.title).filter(Boolean);
      const savedMem = localStorage.getItem('chimuelo_memory');
      const mem = savedMem ? JSON.parse(savedMem) : [];
      const memoryFacts = Array.isArray(mem) ? mem.map((m: any) => (typeof m === 'string' ? m : m.content)).filter(Boolean) : [];
      const savedPersona = localStorage.getItem('chimuelo_persona') || 'default';
      fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recentChats, memoryFacts, hour: new Date().getHours(), persona: savedPersona }),
      }).then(r => r.json()).then(({ suggestions }) => {
        if (suggestions?.length === 4) {
          setSmartPills(suggestions);
          sessionStorage.setItem('chimuelo_pills_ts', Date.now().toString());
          sessionStorage.setItem('chimuelo_pills_data', JSON.stringify(suggestions));
        }
      }).catch(() => {});
    } catch {}
  }, []);

  /* Refetch pills al entrar al welcome screen (sin chat activo o chat vacío) */
  useEffect(() => {
    const isWelcomeScreen = displayMessages.length === 0 && viewMode === 'chat';
    if (isWelcomeScreen) {
      const t = setTimeout(fetchSmartPills, 300);
      return () => clearTimeout(t);
    }
  }, [displayMessages.length, viewMode, fetchSmartPills]);

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem("chimuelo_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("chimuelo_fontSize", fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("chimuelo_persona", persona);
  }, [persona]);

  // ──────────── Scroll architecture v4 ────────────
  //
  // Why v3 failed: rAF-based scrolling has a race against user input events.
  // When a chunk arrives, useEffect schedules an rAF. Inside the rAF we check
  // userIntent. But if the user trackpadded in the SAME frame, their wheel
  // event might not be processed yet when the rAF fires — userIntent is stale.
  //
  // v4 reads the truth directly from the DOM in useLayoutEffect (synchronous,
  // pre-paint). By the time useLayoutEffect runs, the user's scroll position
  // already reflects whatever wheel/touch/scrollbar input happened before this
  // render committed. We compare scrollTop to the PREVIOUS render's max
  // scrollTop. If user was at (or near) the old bottom, stick to new bottom.
  // If they scrolled up, leave them alone.

  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;

    const currentMax = el.scrollHeight - el.clientHeight;

    // forceScrollNext is set on chat switch — siempre scroll al fondo
    if (forceScrollNext.current) {
      el.scrollTop = currentMax;
      forceScrollNext.current = false;
      prevMaxScrollTop.current = currentMax;
      return;
    }

    // skipAutoScrollRef se activa en send y mientras la IA streamea —
    // el usuario decide cuándo ir al fondo, no la app.
    if (skipAutoScrollRef.current) {
      prevMaxScrollTop.current = currentMax;
      return;
    }

    const wasAtBottom = el.scrollTop >= prevMaxScrollTop.current - 4;
    if (wasAtBottom) {
      el.scrollTop = currentMax;
    }

    prevMaxScrollTop.current = currentMax;
  }, [displayMessages, isThinking]);

  // Reset to force-scroll when switching chats
  useEffect(() => {
    forceScrollNext.current = true;
  }, [currentChatId]);

  // Keep ref in sync so stream handlers can read the live chat ID without stale closures
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const val = passwordInput.toLowerCase().trim();
    if (val === "chimuelo26") {
      setIsAuthenticated(true);
      localStorage.setItem("chimuelo_auth", "true");
      setAuthError(null);
    } else if (val === "chimuelo") {
      setAuthError("old");
    } else {
      setAuthError("wrong");
    }
  };

  const createNewChat = () => {
    stopGeneration();
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "Nuevo Chat",
      messages: [],
      updatedAt: Date.now()
    };
    setChats(prev => {
      const updated = [newChat, ...prev];
      safeSetChats(updated);
      return updated;
    });
    setCurrentChatId(newChat.id);
    localStorage.setItem("chimuelo_current_chat", newChat.id);
    setDisplayMessages([]);
    setSidebarOpen(false);
    setViewMode("chat");
    // Nuevo chat siempre empieza en modelo rápido
    setModel('deepseek-v4-flash');
    localStorage.setItem('chimuelo_model', 'deepseek-v4-flash');
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Compress to 0.7 quality to significantly reduce size
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const finalBase64 = await compressImage(reader.result as string);
        setAttachedImage({ base64: finalBase64, name: file.name, type: file.type });
      };
      reader.readAsDataURL(file);
    } else {
      setAttachedDoc(file);
    }
  };

  const handleCreateSubject = () => {
    if (!inlineSubjectName.trim()) return;
    const newSubject: Subject = {
      id: Date.now().toString(),
      name: inlineSubjectName.trim(),
      baseMemory: ''
    };
    const updated = [...subjects, newSubject];
    setSubjects(updated);
    localStorage.setItem("chimuelo_subjects", JSON.stringify(updated));
    setActiveSubjectId(newSubject.id);
    localStorage.setItem("chimuelo_active_subject", newSubject.id);
    setAddingSubject(false);
    setInlineSubjectName('');
  };

  const handleDeleteSubject = (id: string) => {
    const updated = subjects.filter(s => s.id !== id);
    setSubjects(updated);
    localStorage.setItem("chimuelo_subjects", JSON.stringify(updated));
    if (activeSubjectId === id) {
      setActiveSubjectId(null);
      localStorage.removeItem("chimuelo_active_subject");
    }
  };

  const UNI_TEMPLATES = [
    { key: 'essay',      icon: '✍️', label: 'Corregir texto',
      starter: 'Revisa este texto y mejora ortografía, gramática y argumentación. Explica QUÉ cambiaste y POR QUÉ:\n\n',
      systemHint: 'Eres editor académico nivel PhD. Si el texto sigue un formato específico (APA, MLA, etc.), respétalo; si no, sugiérelo. Corrige y explica.' },
    { key: 'solve',      icon: '🧮', label: 'Resolver ejercicio',
      starter: 'Resuelve este ejercicio paso a paso, explicando el razonamiento:\n\n',
      systemHint: 'Eres tutor de ciencias didáctico. Desglosa cada paso, usa fórmulas claras, explica las leyes detrás.' },
    { key: 'summarize',  icon: '📚', label: 'Resumir texto',
      starter: 'Resume este texto con los puntos clave para estudiar rápido:\n\n',
      systemHint: 'Eres analista de textos académicos. Extrae tesis central, argumentos y conclusiones. Salida en markdown estructurado.' },
    { key: 'examine',    icon: '🧠', label: 'Tomarme examen',
      starter: 'Hazme un examen oral progresivo sobre: ',
      systemHint: 'Eres profesor socrático. NO des respuestas. Haz preguntas crecientes en dificultad. Corrige amablemente.' },
    { key: 'explain',    icon: '💡', label: 'Explicar concepto',
      starter: 'Explícame de forma clara y con ejemplos: ',
      systemHint: 'Explica conceptos académicos con analogías concretas y ejemplos progresivos. Verifica entendimiento al final.' },
    { key: 'flashcards', icon: '📝', label: 'Hacer flashcards',
      starter: 'Genera flashcards (pregunta → respuesta) para memorizar:\n\n',
      systemHint: 'Genera 8-15 flashcards en formato "P: ... / R: ...". Cubre conceptos clave, fórmulas, fechas, definiciones.' },
  ];

  const applyTemplate = (tpl: typeof UNI_TEMPLATES[0]) => {
    setUniInput(prev => tpl.starter + (prev || ''));
    pendingSystemHint.current = tpl.systemHint;
    setTimeout(() => uniTextareaRef.current?.focus(), 0);
  };

  const sendFromUniDashboard = () => {
    const text = uniInput.trim();
    if (!text && !uniAttachment) return;
    const subject = subjects.find(s => s.id === activeSubjectId);
    let sysPrompt = '';
    if (subject?.baseMemory) sysPrompt += `[CONTEXTO DE LA MATERIA: ${subject.name}]\n${subject.baseMemory}\n\n`;
    if (pendingSystemHint.current) sysPrompt += pendingSystemHint.current;
    const newChatId = Date.now().toString();
    const newChat: Chat = {
      id: newChatId,
      title: text.slice(0, 40) || 'Chat académico',
      messages: [],
      updatedAt: Date.now(),
      systemPrompt: sysPrompt || undefined,
      subjectId: activeSubjectId || undefined,
    };
    setChats(prev => {
      const updated = [newChat, ...prev];
      safeSetChats(updated);
      return updated;
    });
    setCurrentChatId(newChatId);
    localStorage.setItem("chimuelo_current_chat", newChatId);
    setDisplayMessages([]);
    if (uniAttachment) setAttachedImage(uniAttachment);
    setViewMode('chat');
    setSidebarOpen(false);
    setUniInput('');
    setUniAttachment(null);
    pendingSystemHint.current = '';
    setTimeout(() => handleSendMessage(text), 50);
  };

  const openSubjectMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 170);
    setSubjectMenu({ id, x, y: rect.bottom + 4 });
  };

  const handleRenameSubject = (id: string) => {
    const s = subjects.find(sub => sub.id === id);
    if (!s) return;
    const name = window.prompt('Nuevo nombre:', s.name);
    if (name?.trim()) {
      const updated = subjects.map(sub => sub.id === id ? { ...sub, name: name.trim() } : sub);
      setSubjects(updated);
      localStorage.setItem("chimuelo_subjects", JSON.stringify(updated));
    }
    setSubjectMenu(null);
  };

  const handleSendMessage = async (customMessage?: string) => {
    const msgToSend = customMessage || inputMessage;
    if (!msgToSend.trim() && !attachedImage) return;

    const messageText = msgToSend.trim();

    // Helper: fire-and-forget memory extraction
    const tryExtractMemory = (msgText: string, content: string) => {
      if (!memoryEnabled || !msgText || !content) return;
      fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: msgText,
          assistantMessage: content,
          existingMemories: userMemory.map(m => m.content),
        }),
      }).then(r => r.json()).then(({ facts }) => {
        if (facts?.length > 0) {
          setUserMemory(prev => {
            const newEntries = facts.map((f: string) => ({
              id: Date.now().toString() + Math.random().toString(36).slice(2),
              content: f,
              createdAt: Date.now(),
            }));
            const updated = [...prev, ...newEntries];
            localStorage.setItem("chimuelo_memory", JSON.stringify(updated));
            return updated;
          });
        }
      }).catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Memory] Error extrayendo hechos:', err);
        }
      });
    };
    const imagePayload = attachedImage ? attachedImage.base64 : null;
    const imageName = attachedImage ? attachedImage.name : null;
    const docFile = attachedDoc ?? null;
    
    const lower = messageText.toLowerCase();
    if (lower.includes('imagen') || lower.includes('dibuja') || lower.includes('foto') || lower.includes('pint')) {
      setThinkingTask("image");
    } else if (lower.includes('pdf') || lower.includes('documento') || lower.includes('informe') || lower.includes('invita') || lower.includes('ensayo') || lower.includes('plantilla')) {
      setThinkingTask("document");
    } else if (lower.includes('codigo') || lower.includes('código') || lower.includes('programa') || lower.includes('script') || lower.includes('html')) {
      setThinkingTask("code");
    } else {
      setThinkingTask("general");
    }

    let targetChatId = currentChatId;
    if (!targetChatId) {
      const newChatId = Date.now().toString();
      targetChatId = newChatId;
      setCurrentChatId(newChatId);
      localStorage.setItem("chimuelo_current_chat", newChatId);
      
      setChats(prev => {
        const newChat: Chat = {
          id: newChatId,
          title: messageText ? messageText.slice(0, 30) : (imageName || "Nuevo Chat"),
          messages: [],
          updatedAt: Date.now()
        };
        return [newChat, ...prev];
      });
    }

    const userMsgId = Date.now().toString();
    const userMsg: BaseMessage = { 
      id: userMsgId, 
      role: "user", 
      content: messageText,
      ...(imageName ? { imagePlaceholder: imageName } : {}),
      ...(imagePayload && attachedImage?.type?.startsWith('image/') ? { imageData: attachedImage.base64 } : {}),
      ...(docFile ? { docPlaceholder: docFile.name } : {})
    };

    setChats(prev => {
      const updated = [...prev];
      const chatIndex = updated.findIndex(c => c.id === targetChatId);
      if (chatIndex !== -1) {
        updated[chatIndex] = {
          ...updated[chatIndex],
          messages: [...updated[chatIndex].messages, userMsg],
          updatedAt: Date.now(),
          title: updated[chatIndex].messages.length === 0 ? (messageText ? messageText.slice(0, 30) : "Imagen adjunta") : updated[chatIndex].title
        };
      }
      safeSetChats(updated);
      return updated;
    });

    setInputMessage("");
    setAttachedImage(null);
    setAttachedDoc(null);
    // NO forzar scroll al fondo. Llevar el mensaje del usuario al TOP del viewport
    // y bloquear el auto-scroll durante todo el streaming.
    skipAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-msg-id="${userMsgId}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setIsThinking(true);

    // Add user message to display immediately
    setDisplayMessages(prev => [...prev, userMsg]);

    // v2.0 — fresh AbortController for this stream
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let finalContent = messageText || (imagePayload ? 'Describe esta imagen.' : '');
      if (docFile) {
        try {
          const form = new FormData();
          form.append('file', docFile);
          const docRes = await fetch('/api/parse-doc', { method: 'POST', body: form });
          const docData = await docRes.json();
          if (!docRes.ok) throw new Error(docData.error || 'Error al procesar');
          finalContent = `[DOCUMENTO ADJUNTO: ${docFile.name}]\n${docData.text}\n[FIN DEL DOCUMENTO]\n\n${finalContent}`;
        } catch (err: any) {
          throw new Error('No se pudo leer el documento: ' + err.message);
        }
      }

      // Build messages history for the API
      const chatForApi = chats.find(c => c.id === targetChatId);
      const historyMsgs = (chatForApi?.messages || [])
        .filter(m => m.role && m.content)
        .map(m => ({ role: m.role, content: m.content }));
      historyMsgs.push({ role: 'user' as const, content: finalContent });

      let finalSystemPrompt = "";
      if (chatForApi) {
        if (chatForApi.systemPrompt) finalSystemPrompt = chatForApi.systemPrompt;
        if (chatForApi.subjectId) {
          const subject = subjects.find(s => s.id === chatForApi.subjectId);
          if (subject && subject.baseMemory) {
            finalSystemPrompt += `\n\n[SISTEMA DE MEMORIA ACTIVO]\nESTÁS EN EL CONTEXTO DE LA MATERIA: "${subject.name}".\nSyllabus o apuntes base obligatorios de esta clase:\n${subject.baseMemory}\n[FIN DE MEMORIA. Todo lo que respondas debe tener en cuenta este contexto estrictamente.]`;
          }
        }
      }
      // Inject persistent user memory
      if (memoryEnabled && userMemory.length > 0) {
        finalSystemPrompt += `\n\n[MEMORIA PERSISTENTE DEL USUARIO — PRIORIDAD ALTA]\nConoces estos datos del usuario de conversaciones anteriores. Úsalos para personalizar tus respuestas sin que te lo repita:\n${userMemory.map(m => `• ${m.content}`).join('\n')}\n[FIN DE MEMORIA PERSISTENTE]`;
      }

      // Flag para estilo WhatsApp (sin formato, casual, mensajes cortos)
      const isAgent = !!(chatForApi?.agentId);

      let res: Response;
      if (imagePayload) {
        // Use Claude Haiku vision endpoint
        res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyMsgs, imageBase64: imagePayload, persona, customInstructions: finalSystemPrompt, model, isAgent }),
          signal: controller.signal,
        });
      } else {
        // Use DeepSeek text endpoint
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyMsgs, model, persona, customInstructions: finalSystemPrompt, isAgent }),
          signal: controller.signal,
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Error desconocido del servidor' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      // Stream the response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const assistantId = (Date.now() + 1).toString();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Update the assistant message in real-time (hide reasoning + image tags during stream)
        const streamReasoning = fullText.match(/<think>([\s\S]*?)(<\/think>|$)/)?.[1];
        let streamContent = fullText.replace(/<think>[\s\S]*?(<\/think>|$)/, '').trim();
        // Hide generate_image tags during streaming
        if (streamContent.includes('<generate_image')) {
          streamContent = streamContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/i, '__IMG_LOADING__').trim();
        }
        // Hide generate_music tags during streaming
        if (streamContent.includes('<generate_music')) {
          streamContent = streamContent.replace(/<generate_music(?:[^>]*)>[\s\S]*?(?:<\/generate_music>|$)/i, '__MUSIC_LOADING__').trim();
        }
        // Hide search_web tags during streaming
        if (streamContent.includes('<search_web')) {
          streamContent = streamContent.replace(/<search_web(?:[^>]*)>[\s\S]*?(?:<\/search_web>|$)/i, '__WEB_SEARCHING__').trim();
        }
        const streamingMsg: BaseMessage = { id: assistantId, role: 'assistant', content: streamContent || (streamReasoning ? '' : ''), reasoning: streamReasoning || undefined, model };
        if (currentChatIdRef.current === targetChatId) {
          setDisplayMessages(prev => {
            const existing = prev.findIndex(m => m.id === assistantId);
            if (existing !== -1) {
              const updated = [...prev];
              updated[existing] = streamingMsg;
              return updated;
            }
            return [...prev, streamingMsg];
          });
        }
      }

      // Extract reasoning FIRST to avoid replacing tags inside the think block
      const reasoningMatch = fullText.match(/<think>([\s\S]*?)<\/think>/);
      const reasoning = reasoningMatch ? reasoningMatch[1] : undefined;
      let cleanContent = fullText.replace(/<think>[\s\S]*?<\/think>/, '').trim();

      // Post-process: intercept image generation tags on the clean content
      if (cleanContent.includes('<generate_image')) {
        const promptMatch = cleanContent.match(/<generate_image(?:[^>]*)>([\s\S]*?)(?:<\/generate_image>|$)/i);
        const modeMatch = cleanContent.match(/<generate_image[^>]*mode=["']([^"']+)["'][^>]*>/i);
        const isText2Img = modeMatch ? modeMatch[1] === 'text2img' : false;
        
        if (promptMatch && promptMatch[1]) {
          const imagePrompt = promptMatch[1].trim();
          // Update UI to show generating state
          if (currentChatIdRef.current === targetChatId) {
            setDisplayMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: cleanContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/ig, '__IMG_LOADING__') } : m));
          }
          try {
            // If user attached an image AND it's not a dramatic text2img structural change, use img2img
            const imgBody: any = { prompt: imagePrompt };
            if (imagePayload && !isText2Img) {
              imgBody.imageBase64 = imagePayload;
            }
            const imgRes = await fetch('/api/image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(imgBody)
            });
            if (imgRes.ok) {
              const imgData = await imgRes.json();
              cleanContent = cleanContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/ig, `\n\n![Imagen Generada](${imgData.url})\n\n`);
            } else {
              cleanContent = cleanContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/ig, '\n\n*(Error al generar la imagen)*\n\n');
            }
          } catch {
            cleanContent = cleanContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/ig, '\n\n*(Error de red al generar imagen)*\n\n');
          }
        }
      }

      // Post-process: intercept music generation tags
      if (cleanContent.includes('<generate_music')) {
        const musicMatch = cleanContent.match(/<generate_music(?:[^>]*)>([\s\S]*?)(?:<\/generate_music>|$)/i);
        if (musicMatch && musicMatch[1]) {
          const musicPrompt = musicMatch[1].trim();
          if (currentChatIdRef.current === targetChatId) {
            setDisplayMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: cleanContent.replace(/<generate_music(?:[^>]*)>[\s\S]*?(?:<\/generate_music>|$)/ig, '__MUSIC_LOADING__') } : m));
          }
          try {
            const musicRes = await fetch('/api/music', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: musicPrompt })
            });
            if (musicRes.ok) {
              const musicData = await musicRes.json();
              cleanContent = cleanContent.replace(/<generate_music(?:[^>]*)>[\s\S]*?(?:<\/generate_music>|$)/ig, `__MUSIC_PLAYER:${musicData.url}::${encodeURIComponent(musicPrompt)}__`);
            } else {
              const errData = await musicRes.json().catch(() => ({ error: 'desconocido' }));
              console.error('Music API failed:', musicRes.status, errData);
              const errMsg = (errData?.error || 'desconocido').toString().slice(0, 200);
              cleanContent = cleanContent.replace(/<generate_music(?:[^>]*)>[\s\S]*?(?:<\/generate_music>|$)/ig, `\n\n*(Error al generar música: ${errMsg})*\n\n`);
            }
          } catch {
            cleanContent = cleanContent.replace(/<generate_music(?:[^>]*)>[\s\S]*?(?:<\/generate_music>|$)/ig, '\n\n*(Error de red al generar música)*\n\n');
          }
        }
      }

      // Post-process: intercept web search tags
      if (cleanContent.includes('<search_web>')) {
        const searchMatch = cleanContent.match(/<search_web>([\s\S]*?)<\/search_web>/i);
        if (searchMatch?.[1]) {
          const searchQuery = searchMatch[1].trim();
          if (currentChatIdRef.current === targetChatId) {
            setDisplayMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: '__WEB_SEARCHING__' } : m));
          }
          try {
            const searchRes = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: searchQuery }),
              signal: controller.signal,
            });
            if (searchRes.ok) {
              const { results = [], answer } = await searchRes.json();
              const answerBlock = answer ? `RESPUESTA DIRECTA DE BÚSQUEDA: ${answer}\n\n` : '';
              const formattedResults = results.length > 0
                ? results.map((r: any, i: number) =>
                    `[${i+1}] ${r.title}\nURL: ${r.url}\n${(r.content || r.snippet || '').slice(0, 600)}`
                  ).join('\n\n---\n\n')
                : 'Sin resultados.';
              const searchMessages = [
                ...historyMsgs,
                { role: 'assistant' as const, content: `[Búsqueda web realizada: "${searchQuery}"]` },
                { role: 'user' as const, content: `${answerBlock}RESULTADOS DE BÚSQUEDA WEB:\n\n${formattedResults}\n\nINSTRUCCIONES: Responde la pregunta del usuario con base en estos resultados. Sé completo y detallado. Cita las fuentes con sus URLs al final.` }
              ];
              const searchApiRes = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: searchMessages, model, persona, customInstructions: finalSystemPrompt }),
                signal: controller.signal,
              });
              if (searchApiRes.ok) {
                const searchReader = searchApiRes.body!.getReader();
                const searchDecoder = new TextDecoder();
                let searchFull = '';
                while (true) {
                  const { done, value } = await searchReader.read();
                  if (done) break;
                  searchFull += searchDecoder.decode(value, { stream: true });
                  const streamPart = searchFull.replace(/<think>[\s\S]*?(<\/think>|$)/, '').trim();
                  if (currentChatIdRef.current === targetChatId && streamPart) {
                    setDisplayMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: '__WEB_BADGE__\n\n' + streamPart } : m));
                  }
                }
                cleanContent = '__WEB_BADGE__\n\n' + searchFull.replace(/<think>[\s\S]*?<\/think>/, '').trim();
              } else {
                cleanContent = '*(Error al generar respuesta con resultados de búsqueda)*';
              }
            } else {
              cleanContent = '*(No se pudo completar la búsqueda web)*';
            }
          } catch (searchErr: any) {
            if (searchErr?.name !== 'AbortError') {
              cleanContent = '*(Error de búsqueda web)*';
            }
          }
        }
      }

      // Only keep reasoning if the model that generated this message supports it
      const finalReasoning = model === 'deepseek-v4-pro' ? reasoning : undefined;
      const finalAssistantMsg: BaseMessage = { id: assistantId, role: 'assistant', content: cleanContent, reasoning: finalReasoning, model };

      // Update display only if still on the same chat
      if (currentChatIdRef.current === targetChatId) {
        setDisplayMessages(prev => prev.map(m => m.id === assistantId ? finalAssistantMsg : m));
      }

      // Save to chats/localStorage
      setChats(prev => {
        const updated = prev.map(chat => {
          if (chat.id === targetChatId) {
            return { ...chat, messages: [...chat.messages, finalAssistantMsg], updatedAt: Date.now() };
          }
          return chat;
        });
        safeSetChats(updated);
        return updated;
      });

      // Extract persistent memory facts (fire-and-forget)
      tryExtractMemory(messageText, cleanContent);

      // Generar título con DeepSeek Flash si es chat nuevo sin agente
      setChats(prevChats => {
        const ch = prevChats.find(c => c.id === targetChatId);
        if (ch && !ch.agentId && ch.messages.length <= 2 && cleanContent && messageText) {
          const looksAutoTitle = ch.title === messageText.slice(0, 30) || ch.title === 'Nuevo Chat' || ch.title === 'Imagen adjunta';
          if (looksAutoTitle) {
            // Fire-and-forget — actualiza el título cuando esté listo
            generateChatTitle(targetChatId, messageText, cleanContent);
          }
        }
        return prevChats;
      });

    } catch (e: any) {
      // v2.0 — user-triggered stop: persist whatever streamed so far, no error UI
      if (e?.name === 'AbortError' || controller.signal.aborted) {
        let partialContent = '';
        setDisplayMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.content) {
            partialContent = last.content;
            // Save the partial assistant reply
            const partial: BaseMessage = { ...last, content: last.content + ' ⏹' };
            const updatedDisplay = [...prev.slice(0, -1), partial];
            setChats(prevChats => {
              const updated = prevChats.map(chat =>
                chat.id === targetChatId
                  ? { ...chat, messages: [...chat.messages, partial], updatedAt: Date.now() }
                  : chat
              );
              flushChatsToLS(updated);
              return updated;
            });
            return updatedDisplay;
          }
          return prev;
        });
        // Extract memory from whatever was generated before the stop
        if (partialContent) tryExtractMemory(messageText, partialContent);
      } else {
        console.error("Stream error:", e);
        const errMsg: BaseMessage = { id: (Date.now() + 2).toString(), role: 'assistant', content: `*(Error de conexión: ${e.message})*` };
        if (currentChatIdRef.current === targetChatId) {
          setDisplayMessages(prev => [...prev, errMsg]);
        }
        setChats(prev => {
          const updated = prev.map(chat => {
            if (chat.id === targetChatId) {
              return { ...chat, messages: [...chat.messages, errMsg], updatedAt: Date.now() };
            }
            return chat;
          });
          safeSetChats(updated);
          return updated;
        });
      }
    } finally {
      setIsThinking(false);
      skipAutoScrollRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (e.key === "Enter" && !e.shiftKey && enterToSend && !isMobile) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearAllHistory = () => {
    if (window.confirm("¿Seguro que quieres borrar todas tus conversaciones y espacios de estudio? Esta acción no se puede deshacer.")) {
      setChats([]);
      setDisplayMessages([]);
      setCurrentChatId(null);
      setSubjects([]);
      setActiveSubjectId(null);
      localStorage.removeItem("chimuelo_chats");
      localStorage.removeItem("chimuelo_current_chat");
      localStorage.removeItem("chimuelo_subjects");
      localStorage.removeItem("chimuelo_active_subject");
      setViewMode('chat');
    }
  };

  /* ─────────── Abrir chat con un Agente (estilo WhatsApp) ─────────── */
  const openAgent = (agent: Agent) => {
    stopGeneration();
    try { (navigator as any).vibrate?.(8); } catch {}
    // 1. Busca un chat existente con este agente
    const existing = chats.find(c => c.agentId === agent.id);
    if (existing) {
      // Si el chat está vacío (ej. creado antes del feature), inyectar saludo
      let messages = existing.messages;
      if (messages.length === 0) {
        const greetingMsg: BaseMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: agent.greeting
        };
        messages = [greetingMsg];
        setChats(prev => {
          const updated = prev.map(c => c.id === existing.id ? { ...c, messages, updatedAt: Date.now() } : c);
          safeSetChats(updated);
          return updated;
        });
      }
      setCurrentChatId(existing.id);
      localStorage.setItem("chimuelo_current_chat", existing.id);
      setDisplayMessages(messages);
    } else {
      // 2. Crea un chat nuevo con el saludo del agente como primer mensaje
      const newId = Date.now().toString();
      const greetingMsg: BaseMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: agent.greeting
      };
      const newChat: Chat = {
        id: newId,
        title: agent.name,
        messages: [greetingMsg],
        updatedAt: Date.now(),
        agentId: agent.id,
        systemPrompt: agent.prompt
      };
      setChats(prev => {
        const updated = [newChat, ...prev];
        safeSetChats(updated);
        return updated;
      });
      setCurrentChatId(newId);
      localStorage.setItem("chimuelo_current_chat", newId);
      setDisplayMessages([greetingMsg]);
    }
    setViewMode('chat');
    setSidebarOpen(false);
  };

  /* ─────────── Generar título con DeepSeek Flash ───────────
     Después del primer intercambio (1 user + 1 assistant), llama
     a la IA para crear un título corto (3-5 palabras). Solo aplica
     a chats nuevos sin agente. */
  const generateChatTitle = async (chatId: string, userMsg: string, assistantMsg: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: `Pregunta del usuario: "${userMsg.slice(0, 200)}"\n\nRespuesta de la IA: "${assistantMsg.slice(0, 300)}"\n\nGenera un título MUY CORTO (máximo 5 palabras, sin comillas, sin emojis, sin punto final) que resuma el tema de esta conversación en español. Responde ÚNICAMENTE con el título, nada más.` }
          ],
          model: 'deepseek-v4-flash',
          persona: 'directo',
          customInstructions: 'Responde con el título EXACTO. Sin explicaciones, sin formato markdown, sin comillas, máximo 5 palabras.'
        })
      });
      if (!res.ok) return;
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let title = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        title += decoder.decode(value, { stream: true });
      }
      // Limpiar: quitar think tags, comillas, puntos finales, saltos
      title = title.replace(/<think>[\s\S]*?<\/think>/g, '')
                   .replace(/["'`]/g, '')
                   .replace(/\.$/, '')
                   .trim()
                   .split('\n')[0]
                   .slice(0, 50);
      if (!title) return;
      // Actualizar chat
      setChats(prev => {
        const updated = prev.map(c => c.id === chatId ? { ...c, title } : c);
        safeSetChats(updated);
        return updated;
      });
    } catch (e) {
      console.warn('No se pudo generar título:', e);
    }
  };

  const handleSwitchChat = (chatId: string | null) => {
    stopGeneration();
    try { navigator.vibrate?.(8); } catch {}
    if (chatId) {
      setCurrentChatId(chatId);
      localStorage.setItem("chimuelo_current_chat", chatId);
      const active = chats.find(c => c.id === chatId);
      if (active) {
        setDisplayMessages(active.messages);
      } else {
        setDisplayMessages([]);
      }
    } else {
      createNewChat();
    }
    setAttachedImage(null);
    setSidebarOpen(false);
    setViewMode("chat");
  };

  /* ─────────── v2.0 Command Palette items ─────────── */
  type PaletteItem = { id: string; icon: any; label: string; hint?: string; run: () => void };

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      { id: 'a_new', icon: SquarePen, label: 'Nuevo chat', hint: '⌘/', run: () => { handleSwitchChat(null); } },
      { id: 'a_uni', icon: GraduationCap, label: 'Modo Universitario', run: () => { prevViewMode.current = 'chat'; setViewMode('university'); } },
      { id: 'a_settings', icon: Settings, label: 'Configuración', hint: '⌘,', run: () => { prevViewMode.current = viewMode === 'settings' ? 'chat' : (viewMode as 'chat' | 'university'); setViewMode('settings'); } },
      { id: 'a_model_fast', icon: Zap, label: 'Modelo: ⚡ Rápido', run: () => { setModel('deepseek-v4-flash'); localStorage.setItem('chimuelo_model', 'deepseek-v4-flash'); } },
      { id: 'a_model_deep', icon: Brain, label: 'Modelo: 🧠 Pro', run: () => { setModel('deepseek-v4-pro'); localStorage.setItem('chimuelo_model', 'deepseek-v4-pro'); } },
      { id: 'a_theme_light', icon: Palette, label: 'Tema: Claro', run: () => setTheme('light') },
      { id: 'a_theme_dark', icon: Palette, label: 'Tema: Oscuro', run: () => setTheme('dark') },
      { id: 'a_theme_oled', icon: Palette, label: 'Tema: OLED', run: () => setTheme('oled') },
      { id: 'a_theme_pink', icon: Palette, label: 'Tema: Rosa', run: () => setTheme('pink') },
      { id: 'a_theme_orange', icon: Palette, label: 'Tema: Naranja', run: () => setTheme('orange') },
      { id: 'a_theme_snow', icon: Palette, label: 'Tema: Nieve', run: () => setTheme('snow') },
      { id: 'a_install', icon: Smartphone, label: 'Instalar como app', run: () => setPwaModalOpen(true) },
    ];
    const chatItems: PaletteItem[] = chats.slice(0, 50).map(c => ({
      id: `c_${c.id}`,
      icon: MessageSquare,
      label: c.title || 'Sin título',
      hint: 'Chat',
      run: () => { handleSwitchChat(c.id); },
    }));
    return [...actions, ...chatItems];
  }, [chats, viewMode]);

  const filteredPaletteItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return paletteItems;
    return paletteItems.filter(it => it.label.toLowerCase().includes(q));
  }, [paletteItems, paletteQuery]);

  useEffect(() => { setPaletteIndex(0); }, [paletteQuery, paletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setTimeout(() => paletteInputRef.current?.focus(), 30);
    }
  }, [paletteOpen]);

  /* ─────────── v2.0 Global keyboard shortcuts ─────────── */
  useEffect(() => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (e.key === 'Escape') {
        if (msgMenu) { setMsgMenu(null); e.preventDefault(); return; }
        if (chatMenu) { setChatMenu(null); e.preventDefault(); return; }
        if (paletteOpen) { setPaletteOpen(false); e.preventDefault(); return; }
        if (sidebarOpen) { setSidebarOpen(false); return; }
      }
      if (!mod) return;
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        handleSwitchChat(null);
        return;
      }
      if (e.key === '\\') {
        e.preventDefault();
        setSidebarOpen(s => !s);
        return;
      }
      if (e.key === ',') {
        e.preventDefault();
        prevViewMode.current = viewMode === 'settings' ? 'chat' : (viewMode as 'chat' | 'university');
        setViewMode(v => v === 'settings' ? prevViewMode.current : 'settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, sidebarOpen, viewMode, chatMenu]);

  const ImageRenderer = ({ node, ...props }: any) => {
    return (
      <div className="image-container">
        <img {...props} onClick={() => setLightboxImg(props.src || null)} />
        <div className="image-overlay">
          <button 
            className="image-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              const a = document.createElement('a');
              a.href = props.src;
              a.download = `chimuelo_imagen_${Date.now()}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
          >
          </button>
        </div>
      </div>
    );
  };

  const exportToAPA = (text: string) => {
    const doc = new jsPDF();
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    
    // Better markdown cleaning for APA
    let cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links but keep text
      .replace(/[*_#`>]/g, "") // Remove bold, italic, headings, blockquotes
      .replace(/<[^>]*>?/gm, ""); // Remove any stray HTML
      
    const lines = doc.splitTextToSize(cleanText, 160);
    let y = 25.4;
    const pageHeight = doc.internal.pageSize.height;
    
    for (let i = 0; i < lines.length; i++) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 25.4;
      }
      doc.text(lines[i], 25.4, y);
      y += 8.4;
    }
    doc.save("Documento_APA.pdf");
  };

  const InteractiveFlashcard = ({ q, a }: { q: string, a: string }) => {
    const [flipped, setFlipped] = useState(false);
    return (
      <div 
        className={`flashcard-container ${flipped ? 'flipped' : ''}`}
        onClick={() => setFlipped(!flipped)}
      >
        <div className="flashcard-inner">
          <div className="flashcard-front">
            <div className="flashcard-label">Pregunta</div>
            <div className="flashcard-text">{q}</div>
            <div className="flashcard-hint">Toca para voltear ↺</div>
          </div>
          <div className="flashcard-back">
            <div className="flashcard-label">Respuesta</div>
            <div className="flashcard-text">{a}</div>
          </div>
        </div>
      </div>
    );
  };

  const MusicPlayer = ({ url, prompt }: { url: string; prompt?: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const toggle = () => {
      if (!audioRef.current) return;
      if (playing) { audioRef.current.pause(); setPlaying(false); }
      else { audioRef.current.play(); setPlaying(true); }
    };
    const handleTimeUpdate = () => {
      if (!audioRef.current) return;
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 0;
      setCurrentTime(cur);
      setProgress(dur ? (cur / dur) * 100 : 0);
    };
    const handleLoaded = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
    const handleEnded = () => setPlaying(false);
    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * (audioRef.current.duration || 0);
    };
    const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

    return (
      <div className="music-player-card">
        <audio ref={audioRef} src={url} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoaded} onEnded={handleEnded} />
        <div className="music-player-art">
          <div className={`music-waveform ${playing ? 'playing' : ''}`}>
            {[...Array(14)].map((_, i) => (
              <div key={i} className="music-bar" style={{ animationDelay: `${(i * 0.08).toFixed(2)}s` }} />
            ))}
          </div>
        </div>
        <div className="music-player-body">
          <div className="music-player-title">{prompt ? prompt.slice(0, 38) + (prompt.length > 38 ? '…' : '') : 'Música generada'}</div>
          <div className="music-player-sub">IA generada · Chimuelo</div>
          <div className="music-player-controls">
            <button className="music-play-btn" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}>
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <div className="music-progress-track" onClick={handleSeek}>
              <div className="music-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="music-time">{fmt(currentTime)}<span className="music-time-sep">/</span>{fmt(duration)}</span>
          </div>
        </div>
        <a href={url} download="chimuelo-musica.mp3" className="music-dl-btn" title="Descargar">
          <Download size={15} />
        </a>
      </div>
    );
  };

  if (!appReady) {
    return (
      <div className="splash-screen">
        <div className="splash-wow">
          <div className="splash-ring splash-ring-1"></div>
          <div className="splash-ring splash-ring-2"></div>
          <div className="splash-ring splash-ring-3"></div>
          <div className="splash-orb-wow">
            <Cat size={48} strokeWidth={1.4} />
          </div>
          <div className="splash-particle splash-particle-1"></div>
          <div className="splash-particle splash-particle-2"></div>
          <div className="splash-particle splash-particle-3"></div>
          <div className="splash-particle splash-particle-4"></div>
          <div className="splash-particle splash-particle-5"></div>
          <div className="splash-particle splash-particle-6"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <form onSubmit={handleLogin} className="auth-box-v2">
          <div className="v2-orb-container auth-orb">
            <div className="glowing-orb"></div>
            <div className="glowing-orb-core">
              <Cat size={32} strokeWidth={1.6} />
            </div>
          </div>
          <h1 className="auth-title-v2">Chimuelo</h1>
          <p className="auth-subtitle-v2">Un gato que te regala 20 mil pesos de valor mensual por un churu.</p>
          <p className="auth-hint-v2">Ingresa la clave familiar para entrar</p>

          <div className="auth-field-v2">
            <input
              type="text"
              className="auth-input-v2"
              placeholder="Clave familiar..."
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setAuthError(null); }}
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {authError === "wrong" && (
            <p className="auth-error-v2">Clave incorrecta. Pídele la clave a Rafa.</p>
          )}
          {authError === "old" && (
            <p className="auth-error-v2 auth-error-old">La clave cambió. Pídele la nueva a Rafa 😄</p>
          )}

          <button type="submit" className="auth-submit-v2">Entrar</button>

          <p className="auth-footer-v2">Una app de Rafael Sotomayor · Tus chats solo se guardan en tu teléfono.</p>
        </form>
      </div>
    );
  }

  const activeChat = chats.find(c => c.id === currentChatId);
  const activeAgent = activeChat?.agentId ? AGENTS.find(a => a.id === activeChat.agentId) : null;


  return (
    <div className="app-layout" onClick={() => setModelDropdownOpen(false)}>

      {/* ── ONBOARDING DE BIENVENIDA (primer uso) ── */}
      {showWelcomeOnboarding && (
        <div className="modal-overlay welcome-onb-overlay">
          <div className="welcome-onb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="welcome-onb-glow"></div>
            <div className="welcome-onb-content">
              <div className="welcome-onb-emoji">🐈‍⬛</div>
              <h2 className="welcome-onb-title">¡Hola! Soy Chimuelo</h2>
              <p className="welcome-onb-sub">
                Voy a estar acompañándote. ¿Cómo te llamo?
              </p>
              <input
                type="text"
                className="welcome-onb-input"
                placeholder="Tu nombre"
                value={onboardingNameInput}
                onChange={(e) => setOnboardingNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onboardingNameInput.trim()) {
                    const name = onboardingNameInput.trim().slice(0, 20);
                    setUserName(name);
                    localStorage.setItem("chimuelo_user_name", name);
                    localStorage.setItem("chimuelo_onboarding_done", "true");
                    setShowWelcomeOnboarding(false);
                  }
                }}
                maxLength={20}
                autoFocus
              />
              <div className="welcome-onb-actions">
                <button
                  className="welcome-onb-btn-skip"
                  onClick={() => {
                    localStorage.setItem("chimuelo_onboarding_done", "true");
                    setShowWelcomeOnboarding(false);
                  }}
                >
                  Quizás después
                </button>
                <button
                  className="welcome-onb-btn-primary"
                  disabled={!onboardingNameInput.trim()}
                  onClick={() => {
                    const name = onboardingNameInput.trim().slice(0, 20);
                    if (!name) return;
                    setUserName(name);
                    localStorage.setItem("chimuelo_user_name", name);
                    localStorage.setItem("chimuelo_onboarding_done", "true");
                    setShowWelcomeOnboarding(false);
                  }}
                >
                  ¡Encantado!
                </button>
              </div>
              <p className="welcome-onb-foot">
                Tus datos solo viven en tu dispositivo. Nadie más los ve. 🔒
              </p>
            </div>
          </div>
        </div>
      )}

      {showVersionModal && (
        <div className="modal-overlay" onClick={() => setShowVersionModal(false)}>
          <div className="modal-content version-modal" onClick={e => e.stopPropagation()}>
            <div className="version-modal-header">
              <div className="version-modal-badge">✨ Novedad</div>
              <h2 className="version-modal-title">Chimuelo <span className="version-modal-num">v{versionData.version}</span></h2>
              <p className="version-modal-date">{versionData.date}</p>
            </div>
            <div className="version-modal-changes">
              {versionData.changes?.map((c, i) => (
                <div key={i} className="version-change-item">
                  <div className="version-change-icon">{c.icon}</div>
                  <div>
                    <div className="version-change-title">{c.title}</div>
                    <div className="version-change-desc">{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="version-modal-close-btn" onClick={() => setShowVersionModal(false)}>
              Entendido 🎉
            </button>
          </div>
        </div>
      )}

      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Lightbox" />
        </div>
      )}

      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-mobile-hidden'}`}>

        {/* ── SEARCH ── */}
        <div className="sb-search">
          <Search size={14} className="sb-search-icon" />
          <input
            type="text"
            placeholder="Buscar chats..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            aria-label="Buscar conversaciones"
          />
          {sidebarSearch && (
            <button className="sb-search-clear" onClick={() => setSidebarSearch('')} aria-label="Limpiar búsqueda">
              <X size={12} />
            </button>
          )}
        </div>

        {/* ── PRIMARY ACTION ── */}
        <button
          className="sb-row sb-row-primary"
          onClick={() => { createNewChat(); setSidebarOpen(false); }}
        >
          <SquarePen size={16} />
          <span>Nuevo chat</span>
        </button>

        {/* ── SCROLL: Materias + Chats ── */}
        <div className="sb-scroll">

          {/* MATERIAS (Subjects = Notebooks) */}
          {(() => {
            const q = sidebarSearch.trim().toLowerCase();
            const filteredSubjects = q
              ? subjects.filter(s => s.name.toLowerCase().includes(q))
              : subjects;
            if (filteredSubjects.length === 0) return null;
            return (
              <div className="sb-section">
                <div className="sb-section-label"><Book size={13} strokeWidth={2.2} />Materias</div>
                {filteredSubjects.map(s => (
                  <button
                    key={s.id}
                    className={`sb-row ${activeSubjectId === s.id && viewMode === 'university' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSubjectId(s.id);
                      localStorage.setItem('chimuelo_active_subject', s.id);
                      prevViewMode.current = 'chat';
                      setViewMode('university');
                      setSidebarOpen(false);
                    }}
                  >
                    <Book size={15} />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            );
          })()}

          {/* MODO UNIVERSITARIO (entrada sin subject seleccionado) */}
          <div className="sb-section">
            <div className="sb-section-label"><Zap size={13} strokeWidth={2.2} />Modos</div>
            <button
              className={`sb-row ${viewMode === 'university' && !activeSubjectId ? 'active' : ''}`}
              onClick={() => { prevViewMode.current = 'chat'; setViewMode('university'); setSidebarOpen(false); }}
            >
              <GraduationCap size={15} />
              <span>Modo Universitario</span>
            </button>
            <button
              className={`sb-row ${viewMode === 'agents' ? 'active' : ''}`}
              onClick={() => { prevViewMode.current = 'chat'; setViewMode('agents'); setSidebarOpen(false); }}
            >
              <Sparkles size={15} />
              <span>Agentes</span>
            </button>
          </div>

          {/* CHATS */}
          <div className="sb-section sb-section-chats">
            <div className="sb-section-label"><MessageSquare size={13} strokeWidth={2.2} />Chats</div>
            {(() => {
              const q = sidebarSearch.trim().toLowerCase();
              const filtered = q
                ? chats.filter(c =>
                    (c.title || '').toLowerCase().includes(q) ||
                    c.messages.some(m => (m.content || '').toLowerCase().includes(q))
                  )
                : chats;

              if (chats.length === 0) {
                return (
                  <div className="sb-empty sb-empty-v2">
                    <div className="sb-empty-icon">💬</div>
                    <p className="sb-empty-title">Tu primera conversación</p>
                    <small className="sb-empty-sub">Toca "Nuevo chat" arriba para empezar, o prueba uno de los 20 agentes.</small>
                  </div>
                );
              }
              if (filtered.length === 0) {
                return (
                  <div className="sb-empty sb-empty-v2">
                    <div className="sb-empty-icon">🔍</div>
                    <p className="sb-empty-title">Sin coincidencias</p>
                    <small className="sb-empty-sub">Prueba con otra palabra.</small>
                  </div>
                );
              }

              const g = groupChatsByDate(filtered);
              const renderGroup = (label: string | null, items: Chat[]) =>
                items.length === 0 ? null : (
                  <div key={label ?? 'pinned'}>
                    {label && <div className="sb-group-label">{label}</div>}
                    {items.map(chat => (
                      <div
                        key={chat.id}
                        className={`sb-row sb-row-chat ${currentChatId === chat.id ? 'active' : ''}`}
                        onClick={() => {
                          if (longPressFired.current) { longPressFired.current = false; return; }
                          handleSwitchChat(chat.id);
                          setSidebarOpen(false);
                        }}
                        onContextMenu={(e) => { e.preventDefault(); openChatMenu(chat.id, e.clientX, e.clientY); }}
                        onTouchStart={(e) => startLongPress(chat.id, e)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onTouchCancel={cancelLongPress}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { handleSwitchChat(chat.id); setSidebarOpen(false); }
                        }}
                      >
                        <span>{chat.title}</span>
                        {chat.pinned && (
                          <Star size={11} fill="currentColor" className="sb-pin-indicator" aria-label="Fijado" />
                        )}
                        <button
                          className="sb-row-menu-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            openChatMenu(chat.id, r.right, r.bottom);
                          }}
                          aria-label="Opciones del chat"
                          title="Opciones"
                          type="button"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                );

              return (
                <>
                  {renderGroup(null, g.pinned)}
                  {renderGroup('Hoy', g.hoy)}
                  {renderGroup('Ayer', g.ayer)}
                  {renderGroup('Esta semana', g.semana)}
                  {renderGroup('Antes', g.antes)}
                </>
              );
            })()}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="sb-footer sb-footer-profile">
          <div className="sb-profile-card">
            <div className="sb-profile-avatar">
              {userName ? userName.charAt(0).toUpperCase() : '🐾'}
            </div>
            <div className="sb-profile-info">
              {editingName ? (
                <input
                  className="sb-profile-name-input"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onBlur={() => {
                    setEditingName(false);
                    const trimmed = userName.trim().slice(0, 20);
                    setUserName(trimmed);
                    if (trimmed) localStorage.setItem("chimuelo_user_name", trimmed);
                    else localStorage.removeItem("chimuelo_user_name");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  placeholder="Tu nombre"
                  autoFocus
                  maxLength={20}
                />
              ) : (
                <button
                  className="sb-profile-name sb-profile-name-btn"
                  onClick={() => setEditingName(true)}
                  title="Toca para cambiar tu nombre"
                >
                  {userName || 'Tú'}
                </button>
              )}
              <div className="sb-profile-plan">
                <Sparkles size={10} /> Familia
              </div>
            </div>
            <button
              className="sb-profile-settings"
              onClick={() => {
                prevViewMode.current = viewMode as "chat" | "university" | "agents";
                setViewMode('settings');
                setSidebarOpen(false);
              }}
              aria-label="Ajustes"
              title="Ajustes"
            >
              <Settings size={16} />
              {memoryEnabled && userMemory.length > 0 && (
                <span className="sb-profile-badge">{userMemory.length}</span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Chat context menu (right-click / long-press) ── */}
      {msgMenu && (() => {
        const msg = displayMessages.find(m => m.id === msgMenu.msgId);
        if (!msg) return null;
        return (
          <>
            <div className="sb-menu-backdrop" onClick={() => setMsgMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMsgMenu(null); }} />
            <div className="sb-menu" style={{ left: msgMenu.x, top: msgMenu.y }}>
              <button onClick={() => {
                navigator.clipboard.writeText(msg.content || '');
                try { (navigator as any).vibrate?.(8); } catch {}
                setMsgMenu(null);
              }}>
                <Copy size={14} />
                <span>Copiar</span>
              </button>
              <div className="sb-menu-sep" />
              <button className="danger" onClick={() => {
                if (!confirm('¿Eliminar este mensaje?')) { setMsgMenu(null); return; }
                try { (navigator as any).vibrate?.(12); } catch {}
                setDisplayMessages(prev => prev.filter(m => m.id !== msgMenu.msgId));
                if (currentChatId) {
                  setChats(prev => {
                    const updated = prev.map(c => c.id === currentChatId
                      ? { ...c, messages: c.messages.filter(m => m.id !== msgMenu.msgId), updatedAt: Date.now() }
                      : c);
                    safeSetChats(updated);
                    return updated;
                  });
                }
                setMsgMenu(null);
              }}>
                <Trash2 size={14} />
                <span>Eliminar</span>
              </button>
            </div>
          </>
        );
      })()}

      {chatMenu && (() => {
        const chat = chats.find(c => c.id === chatMenu.chatId);
        if (!chat) return null;
        return (
          <>
            <div className="sb-menu-backdrop" onClick={() => setChatMenu(null)} onContextMenu={(e) => { e.preventDefault(); setChatMenu(null); }} />
            <div className="sb-menu" style={{ left: chatMenu.x, top: chatMenu.y }}>
              <button onClick={() => { togglePinChat(chat.id); setChatMenu(null); }}>
                <Star size={14} fill={chat.pinned ? 'currentColor' : 'none'} />
                <span>{chat.pinned ? 'Desfijar' : 'Fijar arriba'}</span>
              </button>
              <button onClick={() => { handleRenameChat(chat.id); setChatMenu(null); }}>
                <SquarePen size={14} />
                <span>Renombrar</span>
              </button>
              <div className="sb-menu-sep" />
              <button className="danger" onClick={() => { handleDeleteChat(chat.id); setChatMenu(null); }}>
                <Trash2 size={14} />
                <span>Eliminar</span>
              </button>
            </div>
          </>
        );
      })()}

      <div className="main-content">
        <div className="mobile-header" style={{ display: viewMode === 'settings' ? 'none' : undefined }}>
          <button onClick={() => setSidebarOpen(true)} className="icon-btn">
            <Menu size={24} />
          </button>
          
          <div className="mobile-segmented-control d-md-none" style={{ display: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'none' : 'flex' }}>
            <button
              className={`segment-btn ${viewMode === 'chat' && !activeAgent ? 'active' : ''}`}
              onClick={() => {
                setViewMode('chat');
                setCurrentChatId(null);
                setDisplayMessages([]);
              }}
            >
              <MessageSquare size={14} /> Chat
            </button>
            <button
              className={`segment-btn ${viewMode === 'university' ? 'active' : ''}`}
              onClick={() => setViewMode('university')}
            >
              <GraduationCap size={14} /> Académico
            </button>
          </div>
          
          <div className="d-none d-md-flex" style={{ display: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'flex' : 'none', alignItems: 'center', gap: '8px' }}>
            <span>Chimuelo</span>
          </div>

          {!(currentChatId && displayMessages.length === 0) ? (
            <button onClick={() => createNewChat()} className="icon-btn" title="Nuevo chat">
              <Plus size={24} />
            </button>
          ) : (
            <span style={{ width: 40, display: 'inline-block' }} aria-hidden="true" />
          )}
        </div>

        {viewMode === "settings" && (
          <div className="settings-page">
            <div className="settings-page-header">
              <button className="settings-back-btn" onClick={() => setViewMode(prevViewMode.current)}>
                <ChevronLeft size={20} /> Volver
              </button>
              <h1 className="settings-page-title">Configuración</h1>
            </div>
            <div className="settings-page-body">

              {/* ── PLAN FAMILIA (siempre primero) ── */}
              <div className="fp-card-v2">
                <div className="fp-glow"></div>
                <div className="fp-content">
                  <div className="fp-header-row">
                    <div className="fp-badge">
                      <Sparkles size={11} strokeWidth={2.5} />
                      <span>PLAN ACTIVO</span>
                    </div>
                    <div className="fp-emoji-v2">💛</div>
                  </div>
                  <h2 className="fp-title-v2">Plan Familia</h2>
                  <p className="fp-sub-v2">Todas las funciones de Chimuelo, sin restricciones.</p>
                  <div className="fp-price-block">
                    <div className="fp-price-strike">
                      <span className="fp-old-price">$20.000</span>
                      <span className="fp-old-period">/mes</span>
                    </div>
                    <div className="fp-now-row">
                      <span className="fp-now-price">GRATIS</span>
                      <span className="fp-now-period">para siempre</span>
                    </div>
                  </div>
                  <div className="fp-features-v2">
                    <div className="fp-feature"><span className="fp-check">✓</span>20 agentes especialistas</div>
                    <div className="fp-feature"><span className="fp-check">✓</span>Modo Universitario completo</div>
                    <div className="fp-feature"><span className="fp-check">✓</span>Imágenes y música ilimitadas</div>
                    <div className="fp-feature"><span className="fp-check">✓</span>Respaldo automático en la nube local</div>
                    <div className="fp-feature"><span className="fp-check">✓</span>Sin anuncios, nunca</div>
                  </div>
                </div>
              </div>

              {/* Apariencia */}
              <div className="settings-card">
                <h3 className="settings-card-title">Apariencia</h3>
                <div className="settings-group">
                  <label className="settings-label">Tema Visual</label>
                  <div className="theme-selector" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {[
                      { id: 'system', name: 'Sistema', color: 'linear-gradient(135deg, #f0f0f0 50%, #1a1a1a 50%)' },
                      { id: 'light', name: 'Claro', color: '#f8fafc' },
                      { id: 'dark', name: 'Oscuro', color: '#0f172a' },
                      { id: 'pink', name: 'Rosa', color: '#fdf2f8' },
                      { id: 'orange', name: 'Naranja', color: '#fff7ed' },
                      { id: 'oled', name: 'OLED', color: '#000000' },
                      { id: 'snow', name: 'Nieve', color: '#ffffff' },
                    ].map(t => (
                      <button
                        key={t.id}
                        className={`theme-circle ${theme === t.id ? 'active' : ''}`}
                        title={t.name}
                        onClick={() => setTheme(t.id as any)}
                        style={{
                          width: '36px', height: '36px', borderRadius: '50%', background: t.color,
                          border: theme === t.id ? '3px solid #3b82f6' : '1px solid var(--border-color)',
                          cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="settings-group" style={{ marginTop: '1rem' }}>
                  <label className="settings-label">Tamaño de Texto del Chat</label>
                  <select className="settings-select" value={fontSize} onChange={(e) => setFontSize(e.target.value as any)}>
                    <option value="small">Pequeño</option>
                    <option value="medium">Mediano (Normal)</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
              </div>

              {/* Personalidad */}
              <div className="settings-card">
                <h3 className="settings-card-title">Cerebro de Chimuelo</h3>
                <div className="settings-group">
                  <label className="settings-label">Personalidad de la IA</label>
                  <select className="settings-select" value={persona} onChange={(e) => setPersona(e.target.value as any)}>
                    <option value="default">Normal (Amigable y útil)</option>
                    <option value="amable">Amable (Muy cálido y paciente)</option>
                    <option value="chistoso">Chistoso (Humor y sarcasmo)</option>
                    <option value="cursi">Cursi (Amoroso, muchos emojis 🥰)</option>
                    <option value="directo">Directo al grano (Respuestas cortas)</option>
                    <option value="serio">Serio (Formal, analítico)</option>
                    <option value="profesional">Profesional (Corporativo, de usted)</option>
                  </select>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Cambia cómo te habla y se comporta el asistente.</p>
                </div>
              </div>

              {/* Estilo del Chat */}
              <div className="settings-card">
                <h3 className="settings-card-title">Estilo del Chat</h3>
                <div className="settings-group">
                  <label className="settings-label">Burbujas</label>
                  <div className="settings-toggle-row">
                    <button className={`settings-toggle-btn ${bubbleStyle === 'bubbles' ? 'active' : ''}`} onClick={() => { setBubbleStyle('bubbles'); localStorage.setItem('chimuelo_bubbleStyle', 'bubbles'); }}>Clásico</button>
                    <button className={`settings-toggle-btn ${bubbleStyle === 'flat' ? 'active' : ''}`} onClick={() => { setBubbleStyle('flat'); localStorage.setItem('chimuelo_bubbleStyle', 'flat'); }}>Plano</button>
                  </div>
                </div>
                <div className="settings-group" style={{ marginTop: '1rem' }}>
                  <label className="settings-label">Densidad de mensajes</label>
                  <div className="settings-toggle-row">
                    {(['compact', 'comfortable', 'spacious'] as const).map(d => (
                      <button key={d} className={`settings-toggle-btn ${messageDensity === d ? 'active' : ''}`} onClick={() => { setMessageDensity(d); localStorage.setItem('chimuelo_density', d); }}>
                        {d === 'compact' ? 'Compacto' : d === 'comfortable' ? 'Normal' : 'Amplio'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Memoria */}
              <div className="settings-card">
                <h3 className="settings-card-title">🧠 Memoria Persistente</h3>
                <div className="settings-group">
                  <div className="settings-toggle-row" style={{ marginBottom: '12px' }}>
                    <button className={`settings-toggle-btn ${memoryEnabled ? 'active' : ''}`} onClick={() => { setMemoryEnabled(true); localStorage.setItem('chimuelo_memoryEnabled', 'true'); }}>Activa</button>
                    <button className={`settings-toggle-btn ${!memoryEnabled ? 'active' : ''}`} onClick={() => { setMemoryEnabled(false); localStorage.setItem('chimuelo_memoryEnabled', 'false'); }}>Pausada</button>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                    Chimuelo extrae datos de tus chats para recordarte entre conversaciones.
                  </p>
                  {userMemory.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Aún no hay recuerdos. Aparecerán aquí tras tus primeras conversaciones.
                    </p>
                  ) : (
                    <div className="memory-entries-list">
                      {userMemory.map(m => (
                        <div key={m.id} className="memory-entry">
                          <span className="memory-entry-text">{m.content}</span>
                          <button className="memory-entry-delete" title="Olvidar esto" onClick={() => { const updated = userMemory.filter(x => x.id !== m.id); setUserMemory(updated); localStorage.setItem('chimuelo_memory', JSON.stringify(updated)); }}><X size={12} /></button>
                        </div>
                      ))}
                      <button style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => { setUserMemory([]); localStorage.removeItem('chimuelo_memory'); }}>Borrar toda la memoria</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cuenta y Datos */}
              <div className="settings-card">
                <h3 className="settings-card-title">🛡️ Respaldo de tus datos</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 12px' }}>
                  Tus chats se respaldan automáticamente cada 30 minutos en tu dispositivo. También puedes descargar un archivo de respaldo o restaurar desde uno.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--input-bg)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    Último respaldo automático: <strong style={{ color: 'var(--text-primary)' }}>
                      {lastBackupAt ? new Date(lastBackupAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'aún ninguno'}
                    </strong>
                  </div>
                  <button onClick={() => { performAutoBackup(); setLastBackupAt(Date.now()); }} className="settings-action-btn">
                    <Download size={16} /> Crear respaldo ahora
                  </button>
                  <button onClick={() => { downloadBackupFile(); }} className="settings-action-btn">
                    <Download size={16} /> Descargar respaldo (.json)
                  </button>
                  <label className="settings-action-btn" style={{ cursor: 'pointer' }}>
                    <Plus size={16} /> Restaurar desde archivo
                    <input
                      type="file"
                      accept=".json,application/json"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const ok = confirm('Esto reemplazará TODOS tus datos actuales con los del archivo. Antes de hacerlo se crea un respaldo automático de seguridad. ¿Continuar?');
                        if (!ok) { e.target.value = ''; return; }
                        const result = await importBackupFile(f);
                        alert(result.msg);
                        if (result.ok) setTimeout(() => window.location.reload(), 600);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="settings-card danger">
                <h3 className="settings-card-title">Cuenta y Datos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={() => setPwaModalOpen(true)} className="settings-action-btn">
                    <Smartphone size={16} /> Instalar como App
                  </button>
                  <button onClick={clearAllHistory} className="settings-action-btn">
                    <Trash2 size={16} /> Borrar todos los chats
                  </button>
                  <button onClick={() => { localStorage.removeItem("chimuelo_auth"); window.location.reload(); }} className="settings-action-btn logout">
                    <LogOut size={16} /> Cerrar sesión
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Header WhatsApp del agente activo ── */}
        {activeAgent && viewMode === 'chat' && (
          <div className="wa-chat-header">
            <button
              className="wa-back-btn"
              onClick={() => { setCurrentChatId(null); setDisplayMessages([]); setViewMode('agents'); }}
              aria-label="Volver a agentes"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="wa-header-avatar" style={{ background: activeAgent.bgColor }}>
              <span>{activeAgent.emoji}</span>
            </div>
            <div className="wa-header-info">
              <div className="wa-header-name">{activeAgent.name}</div>
              <div className="wa-header-status">
                <span className="wa-online-dot" /> en línea
              </div>
            </div>
          </div>
        )}

        <div ref={chatScrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setShowScrollBtn(distFromBottom > 200 && displayMessages.length > 0);
          }}
          className={`chat-area style-${bubbleStyle} density-${messageDensity} ${activeAgent ? 'whatsapp-mode' : ''}`} style={{ display: viewMode === 'settings' ? 'none' : undefined, paddingBottom: viewMode === 'university' ? '20px' : (displayMessages.length === 0 ? '0' : undefined), paddingTop: displayMessages.length === 0 ? '0' : undefined }}>
          {viewMode === "agents" ? (
            /* ── AGENTES — estilo WhatsApp ── */
            <div className="agents-page">
              <div className="agents-page-header">
                <h1 className="agents-page-title">Agentes</h1>
                <p className="agents-page-sub">Tu familia Chimuelo lista para ayudarte.</p>
                <div className="agents-search-wrap">
                  <Search size={16} className="agents-search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar agente..."
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    className="agents-search-input"
                  />
                </div>
              </div>

              <div className="agents-list">
                {[...AGENTS]
                  .sort((a, b) => b.score - a.score)
                  .filter(a => !agentSearch.trim() ||
                    a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
                    a.tagline.toLowerCase().includes(agentSearch.toLowerCase()) ||
                    a.description.toLowerCase().includes(agentSearch.toLowerCase()))
                  .map(agent => {
                    const existingChat = chats.find(c => c.agentId === agent.id);
                    const lastMsg = existingChat?.messages?.[existingChat.messages.length - 1];
                    const hasHistory = !!existingChat && existingChat.messages.length > 0;
                    const previewText = hasHistory && lastMsg
                      ? (lastMsg.role === 'user' ? 'Tú: ' : '') + (lastMsg.content || '').slice(0, 70)
                      : agent.description;
                    const time = hasHistory && existingChat
                      ? new Date(existingChat.updatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <button
                        key={agent.id}
                        className="agent-row"
                        onClick={() => openAgent(agent)}
                      >
                        <div className="agent-avatar" style={{ background: agent.bgColor }}>
                          <span>{agent.emoji}</span>
                        </div>
                        <div className="agent-info">
                          <div className="agent-info-top">
                            <span className="agent-name">{agent.name}</span>
                            <span className="agent-score" title={`Productividad ${agent.score}/100`}>
                              {agent.score}
                            </span>
                            {time && <span className="agent-time">{time}</span>}
                          </div>
                          <div className="agent-tagline">{agent.tagline}</div>
                          <div className={`agent-preview ${hasHistory ? '' : 'is-desc'}`}>
                            {previewText}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : viewMode === "university" ? (
            /* ── CEREBRO ACADÉMICO v2 — chat-first ── */
            <div className="uni-v2-shell">
              <div className="uni-v2-header">
                <div className="uni-v2-title">Cerebro Académico</div>
                <div className="uni-v2-sub">Elige tu materia, escribe lo que necesitas y empieza al instante.</div>
              </div>

              {/* ── MATERIAS ── */}
              <div className="uni-v2-subjects">
                <div className="uni-v2-pills">
                  <button
                    className={`uni-v2-pill ${!activeSubjectId ? 'active' : ''}`}
                    onClick={() => { setActiveSubjectId(null); localStorage.removeItem('chimuelo_active_subject'); setSubjectMenu(null); }}
                  >
                    🌐 General
                  </button>
                  {subjects.map(s => (
                    <div key={s.id} className="uni-v2-pill-wrap">
                      <button
                        className={`uni-v2-pill ${activeSubjectId === s.id ? 'active' : ''}`}
                        onClick={() => { setActiveSubjectId(s.id); localStorage.setItem('chimuelo_active_subject', s.id); setSubjectMenu(null); }}
                      >
                        📖 {s.name}
                      </button>
                      <button className="uni-v2-pill-menu" onClick={(e) => openSubjectMenu(s.id, e)} title="Opciones">
                        <MoreVertical size={13} />
                      </button>
                    </div>
                  ))}
                  {addingSubject ? (
                    <div className="uni-v2-add-inline">
                      <input
                        className="uni-v2-add-input"
                        placeholder="Nombre del ramo…"
                        value={inlineSubjectName}
                        onChange={e => setInlineSubjectName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateSubject(); if (e.key === 'Escape') { setAddingSubject(false); setInlineSubjectName(''); } }}
                        autoFocus
                      />
                      <button className="uni-v2-add-confirm" onClick={handleCreateSubject} disabled={!inlineSubjectName.trim()}>✓</button>
                      <button className="uni-v2-add-cancel" onClick={() => { setAddingSubject(false); setInlineSubjectName(''); }}>✕</button>
                    </div>
                  ) : (
                    <button className="uni-v2-pill-new" onClick={() => setAddingSubject(true)} title="Agregar materia">
                      <Plus size={14} /> Ramo
                    </button>
                  )}
                </div>
              </div>

              {/* ── SUBJECT CONTEXT MENU ── */}
              {subjectMenu && (
                <>
                  <div className="sb-menu-backdrop" onClick={() => setSubjectMenu(null)} />
                  <div className="sb-menu" style={{ left: subjectMenu.x, top: subjectMenu.y }}>
                    <button onClick={() => handleRenameSubject(subjectMenu.id)}>
                      <SquarePen size={14} /><span>Renombrar</span>
                    </button>
                    <div className="sb-menu-sep" />
                    <button className="danger" onClick={() => { handleDeleteSubject(subjectMenu.id); setSubjectMenu(null); }}>
                      <Trash2 size={14} /><span>Eliminar</span>
                    </button>
                  </div>
                </>
              )}

              {/* ── NOTES FOR ACTIVE SUBJECT ── */}
              {activeSubjectId && (() => {
                const sub = subjects.find(s => s.id === activeSubjectId);
                if (!sub) return null;
                return (
                  <div className="uni-v2-notes">
                    <label className="uni-v2-notes-label">📝 Apuntes de {sub.name} <small>(Chimuelo los usará en cada respuesta)</small></label>
                    <textarea
                      className="uni-v2-notes-textarea"
                      placeholder="Pega el programa, reglas del profe, fórmulas clave…"
                      value={sub.baseMemory}
                      onChange={e => {
                        const updated = subjects.map(s => s.id === sub.id ? { ...s, baseMemory: e.target.value } : s);
                        setSubjects(updated);
                      }}
                      onBlur={() => {
                        localStorage.setItem('chimuelo_subjects', JSON.stringify(subjects));
                      }}
                      rows={3}
                    />
                  </div>
                );
              })()}

              {/* ── INPUT BOX ── */}
              <div className="uni-v2-input-box">
                {uniAttachment && (
                  <div className="image-preview-container">
                    <div className="image-preview-item">
                      {uniAttachment.type?.startsWith('image/') ? (
                        <img src={uniAttachment.base64} alt="Preview" className="image-preview-img" />
                      ) : (
                        <div style={{ padding: '8px', fontSize: '0.7rem', textAlign: 'center', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                          📄 {uniAttachment.name.length > 10 ? uniAttachment.name.substring(0, 10) + '...' : uniAttachment.name}
                        </div>
                      )}
                      <button className="image-preview-remove" onClick={() => setUniAttachment(null)}><XCircle size={16} fill="white" color="#333" /></button>
                    </div>
                  </div>
                )}
                <textarea
                  ref={uniTextareaRef}
                  className="uni-v2-textarea"
                  placeholder="¿Qué necesitas estudiar o resolver hoy?"
                  value={uniInput}
                  onChange={e => setUniInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFromUniDashboard(); } }}
                  rows={3}
                />
                <div className="uni-v2-toolbar">
                  <button className="uni-v2-tool-btn" title="Adjuntar archivo" onClick={() => {
                    const inp = document.createElement('input');
                    inp.type = 'file'; inp.accept = '*/*';
                    inp.onchange = async (ev: any) => {
                      const file = ev.target.files?.[0]; if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        let b64 = reader.result as string;
                        if (file.type.startsWith('image/')) b64 = await compressImage(b64);
                        setUniAttachment({ base64: b64, name: file.name, type: file.type });
                      };
                      reader.readAsDataURL(file);
                    };
                    inp.click();
                  }}>
                    <Paperclip size={16} />
                  </button>
                  <button
                    className={`uni-v2-send-btn ${uniInput.trim() || uniAttachment ? 'active' : ''}`}
                    disabled={!uniInput.trim() && !uniAttachment}
                    onClick={sendFromUniDashboard}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>

              {/* ── TEMPLATES ── */}
              <div className="uni-v2-templates">
                <div className="uni-v2-tpl-label">Plantillas rápidas</div>
                <div className="uni-v2-tpl-grid">
                  {UNI_TEMPLATES.map(tpl => (
                    <button key={tpl.key} className="uni-v2-tpl-btn" onClick={() => applyTemplate(tpl)}>
                      <span>{tpl.icon}</span> {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : displayMessages.length === 0 && !activeAgent ? (
            <div className="v2-empty-state">
              <div className="v2-orb-container">
                <div className="glowing-orb"></div>
                <div className="glowing-orb-core">
                  <Cat size={30} strokeWidth={1.6} />
                </div>
              </div>
              <h2 className="greeting-text-gradient">
                {getGreeting()}
              </h2>
              <div className="smart-pills-container">
                {smartPills.map((pill, i) => (
                  <button key={i} className="smart-pill" onClick={() => handleSendMessage(pill.message)}>
                    <span className="pill-icon">{pill.icon}</span>
                    <span className="pill-text">{pill.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            displayMessages.map((msg: any, i) => {
              const role = msg.role;
              const contentStr = msg.content || '';
              const reasoning = msg.model === 'deepseek-v4-pro' ? (msg.reasoning || contentStr.match(/<think>([\s\S]*?)<\/think>/)?.[1]) : undefined;
              const displayContent = contentStr.replace(/<think>[\s\S]*?<\/think>/, '').trim();

              return (
              <div
                key={msg.id}
                data-msg-id={msg.id}
                className={`message ${role}`}
                onContextMenu={role === 'user' ? (e) => { e.preventDefault(); openMsgMenu(msg.id, e.clientX, e.clientY); } : undefined}
                onTouchStart={role === 'user' ? (e) => startMsgLongPress(msg.id, e) : undefined}
                onTouchEnd={role === 'user' ? cancelMsgLongPress : undefined}
                onTouchMove={role === 'user' ? cancelMsgLongPress : undefined}
                onTouchCancel={role === 'user' ? cancelMsgLongPress : undefined}
              >
                <div className="message-content-wrapper">
                  {role === 'assistant' && (
                    <div className="avatar assistant">
                      <Cat size={24} />
                    </div>
                  )}
                  <div className="message-text">
                    {msg.docPlaceholder && (
                      <div className="attachment-placeholder doc-attachment-chip">
                        <span style={{ fontSize: '1rem' }}>📄</span>
                        <span>{msg.docPlaceholder}</span>
                      </div>
                    )}

                    {msg.imagePlaceholder && (
                      msg.imageData ? (
                        <div className="attachment-image-preview">
                          <img
                            src={msg.imageData}
                            alt={msg.imagePlaceholder}
                            className="msg-ref-img"
                            style={{ cursor: 'zoom-in' }}
                            onClick={() => setLightboxImg(msg.imageData!)}
                          />
                        </div>
                      ) : (
                        <div className="attachment-placeholder">
                          <FileImage size={16} />
                          <span>{msg.imagePlaceholder}</span>
                        </div>
                      )
                    )}
                    
                    {role === 'assistant' && reasoning && (() => {
                      const isStreaming = !displayContent;
                      return (
                        <div className={`reasoning-v3-card ${isStreaming ? 'streaming' : 'done'}`}>
                          <div className="reasoning-v3-header">
                            {isStreaming ? (
                              <>
                                <div className="thinking-v2-pill reasoning-v3-pill" />
                                <span className="reasoning-v3-title">Analizando tu pregunta…</span>
                              </>
                            ) : (
                              <details style={{ listStyle: 'none', width: '100%' }}>
                                <summary className="reasoning-v3-summary">
                                  <span className="reasoning-v3-title">Ver cómo lo pensé →</span>
                                </summary>
                                <div className="reasoning-v3-body">{reasoning}</div>
                              </details>
                            )}
                          </div>
                          {isStreaming && (
                            <div className="reasoning-v3-live">
                              <div className="reasoning-v3-live-text">{reasoning}</div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {role === 'assistant' && isThinking && i === displayMessages.length - 1 && !displayContent && !reasoning && (
                      <div className="thinking-v2">
                        <div className="thinking-v2-pill" />
                      </div>
                    )}

                    {displayContent && (() => {
                      const hasNewArtifact = displayContent.includes('<artifact>');
                      const hasOldArtifact = displayContent.includes('<artifact_html>') && !hasNewArtifact;
                      const hasImageTag = displayContent.includes('<generate_image');
                      
                      let currentBody = displayContent;
                      let artifactContent = '';
                      let artifactTitle = 'Diseño Generado';
                      let artifactDesc = 'Haz clic para previsualizar y descargar PDF';
                      let flashcards: {q: string, a: string}[] | null = null;
                      
                      const jsonMatch = currentBody.match(/```(?:json)?\n([\s\S]*?)\n```/);
                      if (jsonMatch) {
                        try {
                          const parsed = JSON.parse(jsonMatch[1]);
                          if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
                            flashcards = parsed.flashcards;
                            currentBody = currentBody.replace(jsonMatch[0], '').trim();
                          }
                        } catch(e) {}
                      }
                      
                      if (hasImageTag) {
                        currentBody = currentBody.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/i, '__IMG_LOADING__').trim();
                      }

                      if (hasNewArtifact) {
                        const matchHtml = displayContent.match(/<artifact_html>([\s\S]*?)(?:<\/artifact_html>|$)/i);
                        const matchTitle = displayContent.match(/<artifact_title>([\s\S]*?)(?:<\/artifact_title>|$)/i);
                        const matchDesc = displayContent.match(/<artifact_desc>([\s\S]*?)(?:<\/artifact_desc>|$)/i);
                        
                        if (matchHtml && matchHtml[1]) artifactContent = matchHtml[1].trim();
                        if (matchTitle && matchTitle[1]) artifactTitle = matchTitle[1].replace(/<\/artifact_title>/, '').trim();
                        if (matchDesc && matchDesc[1]) artifactDesc = matchDesc[1].replace(/<\/artifact_desc>/, '').trim();
                        
                        currentBody = currentBody.replace(/<artifact>[\s\S]*?(?:<\/artifact>|$)/i, '').trim();
                      } else if (hasOldArtifact) {
                        const match = displayContent.match(/<artifact_html>([\s\S]*?)(?:<\/artifact_html>|$)/i);
                        if (match && match[1]) {
                          artifactContent = match[1].trim();
                          currentBody = currentBody.replace(/<artifact_html>[\s\S]*?(?:<\/artifact_html>|$)/i, '').trim();
                        }
                      } else {
                        // fallback for old pdf
                        currentBody = currentBody.replace(/<pdf_content>[\s\S]*?(?:<\/pdf_content>|$)/i, '').trim();
                      }
                      
                      const showArtifact = hasNewArtifact || hasOldArtifact;
                      const isArtifactComplete = displayContent.includes('</artifact>') || displayContent.includes('</artifact_html>');
                      const isLastMsg = i === displayMessages.length - 1;
                      const isReady = !isThinking || !isLastMsg;
                      const showActions = msg.role === 'assistant' && isReady && (!showArtifact || isArtifactComplete);
                      
                      const hasImgLoading = currentBody.includes('__IMG_LOADING__');
                      const [bodyBefore, bodyAfter] = hasImgLoading
                        ? currentBody.split('__IMG_LOADING__')
                        : [currentBody, ''];

                      const hasMusicLoading = currentBody.includes('__MUSIC_LOADING__');
                      const musicPlayerMatch = currentBody.match(/__MUSIC_PLAYER:(https?:\/\/[^:]+)::([^_]*)__/);
                      const hasMusicPlayer = !!musicPlayerMatch;
                      const musicPlayerUrl = musicPlayerMatch?.[1] || '';
                      const musicPlayerPrompt = musicPlayerMatch ? decodeURIComponent(musicPlayerMatch[2]) : '';
                      const bodyWithoutMusic = hasMusicPlayer && musicPlayerMatch
                        ? currentBody.replace(`__MUSIC_PLAYER:${musicPlayerUrl}::${musicPlayerMatch[2]}__`, '').trim()
                        : currentBody;

                      const hasWebSearching = currentBody.includes('__WEB_SEARCHING__');
                      const hasWebBadge = currentBody.startsWith('__WEB_BADGE__');
                      const webBadgeBody = hasWebBadge ? currentBody.replace('__WEB_BADGE__', '').trim() : currentBody;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div className={`markdown-body font-${fontSize}`}>
                            {isThinking && isLastMsg && !currentBody.trim() && !reasoning ? (
                              <div className="thinking-v2">
                                <div className="thinking-v2-pill" />
                              </div>
                            ) : hasImgLoading ? (
                              <>
                                {bodyBefore.trim() && (
                                  <MemoizedMarkdown content={bodyBefore} imgRenderer={ImageRenderer} codeRenderer={CodeBlock} />
                                )}
                                <div className="neon-image-card">
                                  <div className="neon-image-frame">
                                    <div className="neon-image-scan" />
                                    <div className="neon-image-grid" />
                                  </div>
                                  <div className="neon-image-label">
                                    <span className="neon-image-title">Generando imagen</span>
                                    <span className="neon-image-sub">La IA está creando tu visión</span>
                                  </div>
                                </div>
                                {bodyAfter?.trim() && (
                                  <MemoizedMarkdown content={bodyAfter} imgRenderer={ImageRenderer} codeRenderer={CodeBlock} />
                                )}
                              </>
                            ) : hasMusicLoading ? (
                              <>
                                {currentBody.split('__MUSIC_LOADING__')[0].trim() && (
                                  <MemoizedMarkdown content={currentBody.split('__MUSIC_LOADING__')[0]} imgRenderer={ImageRenderer} codeRenderer={CodeBlock} />
                                )}
                                <div className="neon-music-card">
                                  <div className="neon-music-bars">
                                    {[...Array(20)].map((_, idx) => (
                                      <div key={idx} className="neon-music-bar" style={{ animationDelay: `${(idx * 0.07).toFixed(2)}s` }} />
                                    ))}
                                  </div>
                                  <div className="neon-music-info">
                                    <span className="neon-music-title">Componiendo tu música</span>
                                    <span className="neon-music-sub">Puede tomar hasta 30 segundos</span>
                                  </div>
                                </div>
                                {currentBody.split('__MUSIC_LOADING__')[1]?.trim() && (
                                  <MemoizedMarkdown content={currentBody.split('__MUSIC_LOADING__')[1]} imgRenderer={ImageRenderer} codeRenderer={CodeBlock} />
                                )}
                              </>
                            ) : hasMusicPlayer ? (
                              <>
                                {bodyWithoutMusic && (
                                  <MemoizedMarkdown content={bodyWithoutMusic} imgRenderer={ImageRenderer} codeRenderer={CodeBlock} />
                                )}
                                <MusicPlayer url={musicPlayerUrl} prompt={musicPlayerPrompt} />
                              </>
                            ) : hasWebSearching ? (
                              <div className="web-search-loading">
                                <div className="web-search-loading-dots">
                                  <span /><span /><span />
                                </div>
                                <span className="web-search-loading-text">Buscando en internet...</span>
                              </div>
                            ) : hasWebBadge ? (
                              <>
                                <div className="web-search-badge">
                                  <Search size={12} />
                                  <span>Resultado de búsqueda web</span>
                                </div>
                                <MemoizedMarkdown content={webBadgeBody} imgRenderer={ImageRenderer} codeRenderer={CodeBlock} />
                              </>
                            ) : currentBody.match(/<sticker>([^<]+)<\/sticker>/) ? (
                              /* Sticker: emoji grande estilo WhatsApp */
                              (() => {
                                const match = currentBody.match(/<sticker>([^<]+)<\/sticker>/);
                                const stickerEmoji = match?.[1]?.trim() || '';
                                const restText = currentBody.replace(/<sticker>[^<]*<\/sticker>/, '').trim();
                                return (
                                  <>
                                    {restText && <MemoizedMarkdown content={restText} imgRenderer={ImageRenderer} codeRenderer={CodeBlock} />}
                                    <div className="wa-sticker">{stickerEmoji}</div>
                                  </>
                                );
                              })()
                            ) : (
                              <MemoizedMarkdown
                                content={currentBody}
                                imgRenderer={ImageRenderer}
                                codeRenderer={CodeBlock}
                              />
                            )}
                            {msg.role === 'assistant' && activeChat?.subjectId && (
                               <div className="apa-export-bar" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                                  <button className="download-btn" onClick={() => exportToAPA(currentBody)}>
                                    <Download size={14} style={{ marginRight: '6px' }} /> Exportar a PDF (Formato APA)
                                  </button>
                               </div>
                            )}
                            
                            {flashcards && flashcards.length > 0 && (
                              <div className="flashcards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                {flashcards.map((fc, idx) => (
                                  <InteractiveFlashcard key={idx} q={fc.q} a={fc.a} />
                                ))}
                              </div>
                            )}
                            
                            {msg.role === 'assistant' && showArtifact && (
                              <div 
                                className={`artifact-card ${isArtifactComplete ? '' : 'loading'}`}
                                onClick={() => isArtifactComplete && setArtifactModal(artifactContent)}
                                style={{ opacity: isArtifactComplete ? 1 : 0.6, cursor: isArtifactComplete ? 'pointer' : 'wait' }}
                              >
                                <div className="artifact-icon">{thinkingTask === 'document' || artifactTitle.toLowerCase().includes('informe') ? '📄' : '✨'}</div>
                                <div className="artifact-info">
                                  <strong>{isArtifactComplete ? artifactTitle : 'Renderizando Diseño...'}</strong>
                                  <span>{isArtifactComplete ? artifactDesc : 'Pintando interfaz gráfica'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {showActions && (
                            <div className="message-actions" style={{ display: 'flex', gap: '12px', marginTop: '4px', opacity: 0.7 }}>
                              <button className="action-btn hover-bg" title="Me gusta" onClick={(e) => { e.currentTarget.style.color = '#10b981'; }}><ThumbsUp size={16} /></button>
                              <button className="action-btn hover-bg" title="No me gusta" onClick={(e) => { e.currentTarget.style.color = '#ef4444'; }}><ThumbsDown size={16} /></button>
                              
                              {/* Download button for images or artifacts */}
                              {(displayContent.includes('![Imagen') || showArtifact) && (
                                <button className="action-btn hover-bg" title="Descargar" onClick={() => {
                                  const imgMatch = displayContent.match(/!\[.*?\]\((.*?)\)/);
                                  if (imgMatch && imgMatch[1]) {
                                    // It's an image
                                    window.open(imgMatch[1], '_blank');
                                  } else if (showArtifact && isArtifactComplete) {
                                    // It's an artifact, open the modal to preview/download
                                    setArtifactModal(artifactContent);
                                  }
                                }}><Download size={16} /></button>
                              )}

                              {/* Only show regenerate for the last assistant message */}
                              {displayMessages.length > 0 && msg.id === displayMessages[displayMessages.length - 1].id && (
                                <button className="action-btn hover-bg" title="Regenerar respuesta" onClick={() => {
                                  // Find the last user message
                                  const lastUserMsg = displayMessages.slice().reverse().find(m => m.role === 'user');
                                  if (lastUserMsg && currentChatId) {
                                    // Remove the last assistant message
                                    setChats(prev => {
                                      const updated = [...prev];
                                      const chatIndex = updated.findIndex(c => c.id === currentChatId);
                                      if (chatIndex !== -1) {
                                        updated[chatIndex].messages = updated[chatIndex].messages.slice(0, -1);
                                      }
                                      return updated;
                                    });
                                    setDisplayMessages(prev => prev.slice(0, -1));
                                    // Trigger send again
                                    handleSendMessage(lastUserMsg.content);
                                  }
                                }}><RotateCw size={16} /></button>
                              )}
                              
                              <button className="action-btn hover-bg" title="Compartir" onClick={() => {
                                if (navigator.share) {
                                  navigator.share({ title: 'Chimuelo', text: displayContent }).catch(() => {});
                                } else {
                                  navigator.clipboard.writeText(displayContent);
                                  showToast('Copiado al portapapeles');
                                }
                              }}><Share2 size={16} /></button>
                              <button className="action-btn hover-bg" title="Copiar" onClick={() => {
                                navigator.clipboard.writeText(displayContent);
                                showToast('Copiado al portapapeles');
                              }}><Copy size={16} /></button>
                            </div>
                          )}

                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              );
            })
          )}

          {isThinking && (displayMessages.length === 0 || displayMessages[displayMessages.length - 1]?.role !== 'assistant') && (
            activeAgent ? (
              /* Indicador "Escribiendo..." estilo WhatsApp para agentes */
              <div className="message assistant">
                <div className="message-content-wrapper">
                  <div className="message-text wa-typing-bubble">
                    <span className="wa-typing-text">Escribiendo</span>
                    <span className="wa-typing-dots">
                      <span></span><span></span><span></span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="message assistant">
                <div className="message-content-wrapper">
                  <div className="avatar assistant">
                    <Cat size={24} />
                  </div>
                  <div className="message-text">
                    <div className="thinking-v2">
                      <div className="thinking-v2-pill" />
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
          {/* Sugerencias del agente como respuestas rápidas dentro del chat */}
          {activeAgent && displayMessages.length === 1 && displayMessages[0]?.role === 'assistant' && !isThinking && (
            <div className="wa-quick-replies">
              {activeAgent.suggestions.map((s, i) => (
                <button
                  key={i}
                  className="wa-quick-reply-bubble"
                  onClick={() => handleSendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {viewMode === "chat" && (
          <div className="v2-input-area">
            {/* Mascota Chimuelo paseando arriba del input (oculta en chat de agente) */}
            {!activeAgent && (
              <div className="cat-mascot-shelf" aria-hidden="true">
                <CatMascot />
              </div>
            )}
            <div className="v2-model-selector">
              <button
                className={`v2-model-btn ${model === 'deepseek-v4-flash' ? 'active' : ''}`}
                onClick={() => { setModel('deepseek-v4-flash'); localStorage.setItem('chimuelo_model', 'deepseek-v4-flash'); }}
              >
                Rápido
              </button>
              <button
                className={`v2-model-btn ${model === 'deepseek-v4-pro' ? 'active' : ''}`}
                onClick={() => { setModel('deepseek-v4-pro'); localStorage.setItem('chimuelo_model', 'deepseek-v4-pro'); }}
              >
                Pro
              </button>
            </div>

            <div className="v2-input-container">
              {attachedImage && (
                <div className="image-preview-container">
                  <div className="image-preview-item" style={{ background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={attachedImage.base64} alt="Preview" className="image-preview-img" />
                    <button className="image-preview-remove" onClick={() => setAttachedImage(null)}>
                      <XCircle size={16} fill="white" color="#333" />
                    </button>
                  </div>
                </div>
              )}

              {attachedDoc && (
                <div className="image-preview-container">
                  <div className="doc-preview-chip">
                    <span className="doc-preview-icon">📄</span>
                    <span className="doc-preview-name">{attachedDoc.name.length > 22 ? attachedDoc.name.slice(0, 22) + '…' : attachedDoc.name}</span>
                    <button className="image-preview-remove" style={{ position: 'static', marginLeft: 4 }} onClick={() => setAttachedDoc(null)}>
                      <XCircle size={15} fill="white" color="#555" />
                    </button>
                  </div>
                </div>
              )}

              <input type="file" accept="image/*,.pdf,.docx,.txt,.md,.csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
              
              <div className="v2-input-row">
                <button className="v2-attach-btn" title="Subir imagen o documento" onClick={() => fileInputRef.current?.click()}>
                  <div className="v2-attach-icon-wrapper">
                    <Plus size={20} />
                  </div>
                </button>
                
                <textarea
                  ref={textareaRef}
                  className="v2-input-textarea"
                  placeholder="Escribe o pregunta..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />

                {(() => {
                  const hasInput = !!(inputMessage.trim() || attachedImage || attachedDoc);
                  if (isThinking) {
                    return (
                      <button
                        className="v2-send-btn stop active"
                        onClick={stopGeneration}
                        title="Detener generación"
                      >
                        <Square size={16} fill="currentColor" />
                      </button>
                    );
                  }
                  // Sin texto: solo mic. Con texto: solo send.
                  return hasInput ? (
                    <button
                      className="v2-send-btn active"
                      onClick={() => handleSendMessage()}
                      title="Enviar mensaje"
                    >
                      <Send size={18} />
                    </button>
                  ) : (
                    <button
                      className={`v2-mic-btn solo ${isRecording ? 'recording' : ''}`}
                      onClick={toggleVoiceInput}
                      title={isRecording ? 'Detener grabación' : 'Mensaje de voz'}
                      type="button"
                    >
                      {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  );
                })()}
              </div>
            </div>
            
          </div>
        )}
      </div>

      {/* PWA Instructions Modal */}
      {pwaModalOpen && (
        <div className="modal-overlay" onClick={() => setPwaModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={24} /> Agrégame a tu Celu
              </h2>
              <button onClick={() => setPwaModalOpen(false)} className="modal-close">
                <X size={24} />
              </button>
            </div>
            
            <div style={{ marginTop: '1rem' }}>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Puedes instalar Chimuelo como una app en tu teléfono para entrar más rápido, como si fuera WhatsApp. ¡Es muy fácil!
              </p>
              
              <div style={{ backgroundColor: 'var(--input-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🍎 Si usas iPhone (Safari)
                </h3>
                <ol style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  <li>Toca el botón de <strong>Compartir</strong> (es un cuadrito con una flecha hacia arriba que está en la barra de abajo).</li>
                  <li>Desliza hacia abajo en ese menú hasta encontrar <strong>"Agregar a inicio"</strong> o <strong>"Add to Home Screen"</strong> y tócalo.</li>
                  <li>Toca <strong>"Agregar"</strong> arriba a la derecha. ¡Listo! Ya aparecerá el ícono en tu teléfono.</li>
                </ol>
              </div>

              <div style={{ backgroundColor: 'var(--input-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🤖 Si usas Android (Chrome)
                </h3>
                <ol style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  <li>Toca los <strong>tres puntitos</strong> que están arriba a la derecha en el navegador.</li>
                  <li>Busca la opción <strong>"Agregar a la pantalla principal"</strong> o <strong>"Instalar aplicación"</strong> y tócala.</li>
                  <li>Confirma tocando <strong>"Agregar"</strong> o <strong>"Instalar"</strong>. ¡Ya lo tienes como app!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <div className="lightbox-actions" onClick={e => e.stopPropagation()}>
            <button 
              className="image-action-btn"
              onClick={() => {
                const a = document.createElement('a');
                a.href = lightboxImg;
                a.download = `chimuelo_imagen_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
              <Download size={20} />
            </button>
            <button className="image-action-btn" onClick={() => setLightboxImg(null)}>
              <X size={20} />
            </button>
          </div>
          <img src={lightboxImg} className="lightbox-img" alt="Ampliación" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Artifact Modal */}
      {artifactModal && (
        <div className="modal-overlay" onClick={() => setArtifactModal(null)}>
          <div className="artifact-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '1rem' }}>
              <h2 className="modal-title">Previsualización del Diseño</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="danger-btn"
                  style={{ backgroundColor: '#1877F2', width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={async () => {
                    const iframe = document.getElementById('artifact-iframe') as HTMLIFrameElement;
                    if (iframe && iframe.contentDocument) {
                      const canvas = await html2canvas(iframe.contentDocument.body, { useCORS: true, allowTaint: true });
                      const imgData = canvas.toDataURL('image/png');
                      const pdf = new jsPDF({
                        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [canvas.width, canvas.height]
                      });
                      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                      pdf.save(`chimuelo_documento_${Date.now()}.pdf`);
                    }
                  }}
                >
                  <Download size={18} /> Descargar PDF
                </button>
                <button onClick={() => setArtifactModal(null)} className="icon-btn">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="artifact-preview-container">
              <iframe 
                id="artifact-iframe"
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <script src="https://cdn.tailwindcss.com"></script>
                      <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; box-sizing: border-box; }
                      </style>
                    </head>
                    <body>
                      ${artifactModal}
                    </body>
                  </html>
                `}
                title="Artifact Preview"
                className="artifact-iframe"
              />
            </div>
          </div>
        </div>
      )}

      {/* v2.0 — Command Palette (Cmd+K) */}
      {paletteOpen && (
        <div className="palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="palette-modal" onClick={(e) => e.stopPropagation()}>
            <div className="palette-search-row">
              <Search size={16} />
              <input
                ref={paletteInputRef}
                type="text"
                className="palette-input"
                placeholder="Buscar acción o chat..."
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setPaletteIndex(i => Math.min(i + 1, filteredPaletteItems.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setPaletteIndex(i => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const item = filteredPaletteItems[paletteIndex];
                    if (item) {
                      item.run();
                      setPaletteOpen(false);
                      setPaletteQuery('');
                    }
                  }
                }}
              />
              <kbd className="palette-kbd">esc</kbd>
            </div>
            <div className="palette-list">
              {filteredPaletteItems.length === 0 ? (
                <div className="palette-empty">Sin resultados</div>
              ) : (
                filteredPaletteItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      className={`palette-item ${i === paletteIndex ? 'active' : ''}`}
                      onMouseEnter={() => setPaletteIndex(i)}
                      onClick={() => {
                        item.run();
                        setPaletteOpen(false);
                        setPaletteQuery('');
                      }}
                    >
                      <Icon size={16} className="palette-item-icon" />
                      <span className="palette-item-label">{item.label}</span>
                      {item.hint && <span className="palette-item-hint">{item.hint}</span>}
                    </button>
                  );
                })
              )}
            </div>
            <div className="palette-footer">
              <span><kbd>↑↓</kbd> Navegar</span>
              <span><kbd>↵</kbd> Ejecutar</span>
              <span><kbd>esc</kbd> Cerrar</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Nivel 3 Cambio 12 — Scroll to bottom button ── */}
      {showScrollBtn && (
        <button
          className="scroll-to-bottom-btn"
          onClick={() => {
            const el = chatScrollRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          }}
          title="Bajar al final"
          aria-label="Bajar al final"
        >
          <ChevronDown size={20} />
        </button>
      )}

      {/* ── Nivel 4 Cambio 15 — Toast premium ── */}
      <div className={`chimuelo-toast ${toast.show ? 'visible' : ''}`} role="status">
        <Check size={16} />
        <span>{toast.msg}</span>
      </div>
    </div>
  );
}
