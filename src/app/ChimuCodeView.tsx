'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  Check,
  Download,
  Play,
  PanelRight,
  PanelLeft,
  Eye,
  Code,
  Terminal,
  Copy,
  X,
  ExternalLink,
  Smartphone,
  Monitor,
  RotateCw,
  CornerDownLeft,
  FileCode,
  Globe,
  AlertCircle,
  Paperclip,
  Square,
  GitBranch,
  GitPullRequest,
  FolderGit2,
  GitCommit,
  Trash2,
  ShieldCheck,
  Loader2,
  RefreshCw,
  HelpCircle,
  Send,
  CheckCircle2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import JSZip from 'jszip';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { stripMarkdown, copyTextToClipboard, buildChimuCodeFeedbackPrompt } from '../lib/chimucode';
import type {
  ChimuCodeSession,
  ChimuCodeMessage,
  ChimuCodeFile,
  ChimuCodeToolCall,
  ChimuCodePageContext,
  ChimuCodeAttachment,
} from '../lib/sandbox-types';
import { CLIENT_MODEL_FLASH, CLIENT_MODEL_UNCENSORED, isUncensoredModel } from '../lib/models';
import { loadChimuCodeSessions, getLastOpenedChimuSessionId, setLastOpenedChimuSessionId } from '../lib/chat-storage';
import {
  getStoredGitHubToken,
  saveStoredGitHubToken,
  clearStoredGitHubToken,
  getStoredGitHubUser,
  saveStoredGitHubUser,
  validateGitHubToken,
  listUserRepos,
  fetchRepoFiles,
  createRepoBranch,
  commitFilesToRepo,
  createPullRequest,
  type GitHubUser,
  type GitHubRepo,
} from '../lib/github';

function GithubIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

function cleanMessages(msgs: ChimuCodeMessage[]): ChimuCodeMessage[] {
  if (!Array.isArray(msgs)) return [];
  return msgs.filter((m) => {
    if (!m || !m.content || typeof m.content !== 'string') return false;
    const trimmed = m.content.trim();
    if (trimmed.startsWith('Error: Unexpected token') || trimmed.startsWith('⚠️ Error: Unexpected token')) {
      return false;
    }
    return true;
  });
}

function resolveSessionToLoad(
  requestedId: string | null | undefined,
  initialData?: ChimuCodeSession
): ChimuCodeSession | null {
  if (requestedId === 'new') {
    return null;
  }

  const allSessions = loadChimuCodeSessions();
  if (allSessions.length === 0) {
    return null;
  }

  // 1. Si se especificó un ID válido existente
  if (requestedId) {
    const found = allSessions.find((s) => s.id === requestedId);
    if (found) return found;
    if (initialData && initialData.id === requestedId) return initialData;
  }

  // 2. Si no hay ID solicitado, buscar el último ID abierto
  const lastId = getLastOpenedChimuSessionId();
  if (lastId) {
    const foundLast = allSessions.find((s) => s.id === lastId);
    if (foundLast) return foundLast;
  }

  // 3. Fallback a la sesión más reciente
  return allSessions[0] || null;
}

const REAL_MODELS = [
  { id: CLIENT_MODEL_FLASH, shortName: 'Flash', desc: 'DeepSeek Flash' },
  { id: CLIENT_MODEL_UNCENSORED, shortName: 'Sin censura', desc: 'ChatGPT 4o-mini' },
];

interface ChimuCodeViewProps {
  onBackToChat: () => void;
  activeSessionId: string | null;
  onSaveSession: (session: ChimuCodeSession) => void;
  initialSessionData?: ChimuCodeSession;
  model: string;
  setModel: (m: string) => void;
  theme?: "system" | "light" | "dark" | "pink" | "orange" | "oled" | "snow";
  setTheme?: (theme: any) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function ChimuCodeView({
  onBackToChat,
  activeSessionId,
  onSaveSession,
  initialSessionData,
  model,
  setModel,
  theme = "system",
  setTheme,
  isSidebarOpen = true,
  onToggleSidebar,
}: ChimuCodeViewProps) {
  // Sesión resuelta al montar desde chimucode-sessions-v1 (o initialSessionData)
  const initialSessionRef = useRef<ChimuCodeSession | null | undefined>(undefined);
  if (initialSessionRef.current === undefined) {
    initialSessionRef.current = resolveSessionToLoad(activeSessionId, initialSessionData);
  }
  const mountSession = initialSessionRef.current;

  // ID de la sesión actualmente cargada en el state
  const [currentLoadedId, setCurrentLoadedId] = useState<string | null>(() => {
    return mountSession ? mountSession.id : (activeSessionId === 'new' ? null : null);
  });

  const [messages, setMessages] = useState<ChimuCodeMessage[]>(() => {
    return mountSession ? cleanMessages(mountSession.messages || []) : [];
  });
  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [sessionTitle, setSessionTitle] = useState<string>(() => {
    return mountSession ? (mountSession.title || 'Sesión de código') : 'Nueva sesión';
  });

  // Contexto de página web detectada en la sesión (para no volver a parsear la misma URL)
  const [pageContext, setPageContext] = useState<ChimuCodePageContext | null>(() => {
    return mountSession?.pageContext || initialSessionData?.pageContext || null;
  });

  // Lock síncrono para prevenir duplicación de burbujas de usuario
  const isSendingRef = useRef<boolean>(false);

  // Estados de streaming en vivo estilo Claude Code
  const [liveTools, setLiveTools] = useState<ChimuCodeToolCall[]>([]);
  const [liveStatusText, setLiveStatusText] = useState<string>('');
  const [liveExplanation, setLiveExplanation] = useState<string>('');
  const [liveFiles, setLiveFiles] = useState<ChimuCodeFile[]>([]);

  // Proyecto multi-archivo
  const [files, setFiles] = useState<ChimuCodeFile[]>(() => {
    if (!mountSession) return [];
    if (Array.isArray(mountSession.files) && mountSession.files.length > 0) {
      return mountSession.files;
    }
    if (mountSession.activeCode) {
      return [{
        path: 'index.html',
        language: mountSession.language || 'html',
        content: mountSession.activeCode,
      }];
    }
    return [];
  });

  const [activePath, setActivePath] = useState<string>(() => {
    if (!mountSession) return 'preview.html';
    const sFiles = Array.isArray(mountSession.files) && mountSession.files.length > 0 ? mountSession.files : [];
    const previewFile = sFiles.find((f) => f.path === 'preview.html')
      || sFiles.find((f) => f.path === 'index.html')
      || sFiles.find((f) => f.language === 'html' || f.path.endsWith('.html') || f.path.endsWith('.htm'));
    return previewFile ? previewFile.path : (mountSession.activePath || (sFiles[0]?.path ?? 'preview.html'));
  });

  const [showRightPanel, setShowRightPanel] = useState<boolean>(() => {
    const sFiles = mountSession && Array.isArray(mountSession.files) && mountSession.files.length > 0 ? mountSession.files : [];
    return sFiles.length > 0 || !!mountSession?.activeCode;
  });
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'code' | 'console'>(() => {
    if (!mountSession) return 'preview';
    const sFiles = Array.isArray(mountSession.files) && mountSession.files.length > 0 ? mountSession.files : [];
    const hasHtml = sFiles.some((f) => f.language === 'html' || f.path.endsWith('.html') || f.path.endsWith('.htm')) || !!mountSession?.activeCode;
    return hasHtml ? 'preview' : 'code';
  });
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(() => {
    return mountSession?.consoleOutput || null;
  });

  const [copiedBubbleId, setCopiedBubbleId] = useState<string | null>(null);
  const [copiedCardMsgId, setCopiedCardMsgId] = useState<string | null>(null);
  const [copiedActiveCode, setCopiedActiveCode] = useState<boolean>(false);
  const [copiedConsole, setCopiedConsole] = useState<boolean>(false);

  const bubbleCopyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardCopyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeCodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consoleCopyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (bubbleCopyTimeoutRef.current) clearTimeout(bubbleCopyTimeoutRef.current);
      if (cardCopyTimeoutRef.current) clearTimeout(cardCopyTimeoutRef.current);
      if (activeCodeTimeoutRef.current) clearTimeout(activeCodeTimeoutRef.current);
      if (consoleCopyTimeoutRef.current) clearTimeout(consoleCopyTimeoutRef.current);
    };
  }, []);

  // Split resizer: default 42% for right panel
  const [panelWidthPercent, setPanelWidthPercent] = useState<number>(42);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Model selector dropdowns (topbar y dentro del input composer)
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [showInputModelDropdown, setShowInputModelDropdown] = useState<boolean>(false);
  const inputModelDropdownRef = useRef<HTMLDivElement>(null);

  // Archivos e imágenes adjuntos al prompt (con visión)
  const [attachments, setAttachments] = useState<ChimuCodeAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Streaming de código en vivo (file_delta)
  const [liveWritingFile, setLiveWritingFile] = useState<{
    path: string;
    language: string;
    totalBytes: number;
    code: string;
  } | null>(null);

  // Auto-scroll del visor de código en tiempo real
  const liveCodeContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (liveCodeContainerRef.current) {
      liveCodeContainerRef.current.scrollTop = liveCodeContainerRef.current.scrollHeight;
    }
  }, [liveWritingFile?.code]);

  // Feedbacker state ("¿Funciona?")
  const [feedbackMsgId, setFeedbackMsgId] = useState<string | null>(null);
  const [feedbackReaction, setFeedbackReaction] = useState<'works' | 'error' | 'missing' | 'retry' | null>(null);
  const [feedbackSelectedTag, setFeedbackSelectedTag] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackSuccess, setFeedbackSuccess] = useState<boolean>(false);

  // AbortController para detener la generación
  const abortControllerRef = useRef<AbortController | null>(null);

  // GitHub Modal & State
  const [showGitHubModal, setShowGitHubModal] = useState<boolean>(false);
  const [gitHubToken, setGitHubToken] = useState<string>(() => getStoredGitHubToken() || '');
  const [gitHubUser, setGitHubUser] = useState<GitHubUser | null>(() => getStoredGitHubUser() || null);
  const [gitHubActiveTab, setGitHubActiveTab] = useState<'status' | 'repos' | 'commit' | 'pr'>('status');
  const [gitHubRepos, setGitHubRepos] = useState<GitHubRepo[]>([]);
  const [gitHubSelectedRepo, setGitHubSelectedRepo] = useState<string>('');
  const [gitHubBranch, setGitHubBranch] = useState<string>('main');
  const [gitHubNewBranch, setGitHubNewBranch] = useState<string>('');
  const [gitHubCreateNewBranch, setGitHubCreateNewBranch] = useState<boolean>(false);
  const [gitHubCommitMsg, setGitHubCommitMsg] = useState<string>('');
  const [gitHubPrTitle, setGitHubPrTitle] = useState<string>('');
  const [gitHubPrBody, setGitHubPrBody] = useState<string>('');
  const [gitHubPrBase, setGitHubPrBase] = useState<string>('main');
  const [gitHubLoading, setGitHubLoading] = useState<boolean>(false);
  const [gitHubFeedback, setGitHubFeedback] = useState<{ type: 'success' | 'error'; message: string; url?: string } | null>(null);

  // ── Sincronización en el MISMO TICK durante el render ──
  // Si activeSessionId cambia por click en el sidebar, actualizamos el state inmediatamente
  const normalizedPropId = activeSessionId === 'new' ? null : (activeSessionId || null);
  if (normalizedPropId !== currentLoadedId && activeSessionId !== undefined) {
    setCurrentLoadedId(normalizedPropId);
    if (normalizedPropId) {
      const allSessions = loadChimuCodeSessions();
      const target = (initialSessionData && initialSessionData.id === normalizedPropId)
        ? initialSessionData
        : allSessions.find((s) => s.id === normalizedPropId);

      if (target) {
        setMessages(cleanMessages(target.messages || []));
        setSessionTitle(target.title || 'Sesión de código');
        setPageContext(target.pageContext || null);

        let sessionFiles: ChimuCodeFile[] = Array.isArray(target.files) && target.files.length > 0
          ? target.files
          : [];
        if (sessionFiles.length === 0 && target.activeCode) {
          sessionFiles = [{
            path: 'index.html',
            language: target.language || 'html',
            content: target.activeCode,
          }];
        }
        setFiles(sessionFiles);
        const previewFile = sessionFiles.find((f) => f.path === 'preview.html')
          || sessionFiles.find((f) => f.path === 'index.html')
          || sessionFiles.find((f) => f.language === 'html' || f.path.endsWith('.html') || f.path.endsWith('.htm'));
        const resolvedPath = previewFile ? previewFile.path : (target.activePath || (sessionFiles[0]?.path ?? 'preview.html'));
        setActivePath(resolvedPath);
        setActiveRightTab(previewFile ? 'preview' : 'code');
        setConsoleOutput(target.consoleOutput || null);
        setShowRightPanel(sessionFiles.length > 0);
        setLastOpenedChimuSessionId(target.id);
      }
    } else {
      // Usuario explícitamente abrió "Nueva sesión" limpia
      setMessages([]);
      setSessionTitle('Nueva sesión');
      setFiles([]);
      setActivePath('index.html');
      setConsoleOutput(null);
      setPageContext(null);
      setShowRightPanel(false);
      setLastOpenedChimuSessionId(null);
    }
  }

  // ID persistente de la sesión actual
  const currentSessionIdRef = useRef<string | null>(currentLoadedId);
  currentSessionIdRef.current = currentLoadedId;

  // Efecto reactivo con deps [activeSessionId, mountSession]
  useEffect(() => {
    if (activeSessionId && activeSessionId !== 'new') {
      setLastOpenedChimuSessionId(activeSessionId);
    } else if (mountSession && !activeSessionId) {
      setLastOpenedChimuSessionId(mountSession.id);
    }
  }, [activeSessionId, mountSession]);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  // Mensajes limpios para render (sin errores corruptos ni burbujas consecutivas duplicadas)
  const renderedMessages = useMemo(() => {
    return cleanMessages(messages).filter(
      (m, idx, arr) =>
        !(m.role === 'user' && idx > 0 && arr[idx - 1].role === 'user' && arr[idx - 1].content.trim() === m.content.trim())
    );
  }, [messages]);

  // Archivo actualmente activo
  const activeFile = useMemo(() => {
    return files.find((f) => f.path === activePath) || files[0] || null;
  }, [files, activePath]);

  const activeContent = activeFile ? activeFile.content : '';
  const detectedLang = activeFile ? activeFile.language : 'html';
  const isHtml = detectedLang === 'html' || activePath.endsWith('.html') || activePath.endsWith('.htm');

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
      if (inputModelDropdownRef.current && !inputModelDropdownRef.current.contains(e.target as Node)) {
        setShowInputModelDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll al final del chat cuando llegan mensajes o eventos en vivo
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, liveExplanation, liveFiles, liveStatusText]);

  // Manejador del divisor arrastrable
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !workspaceRef.current) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    const newWidthPercent = ((rect.right - e.clientX) / rect.width) * 100;
    setPanelWidthPercent(Math.min(75, Math.max(25, newWidthPercent)));
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) setIsResizing(false);
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Persistir sesión activa usando siempre el mismo ID
  const persistSession = (
    msgs: ChimuCodeMessage[],
    title: string,
    currentFiles: ChimuCodeFile[],
    currActivePath: string,
    output: string | null,
    overridePageContext?: ChimuCodePageContext | null
  ) => {
    if (!currentSessionIdRef.current) {
      const newId = (activeSessionId && activeSessionId !== 'new') ? activeSessionId : `code-${Date.now()}`;
      currentSessionIdRef.current = newId;
      setCurrentLoadedId(newId);
      setLastOpenedChimuSessionId(newId);
    }
    const sId = currentSessionIdRef.current;
    const currentActiveFile = currentFiles.find((f) => f.path === currActivePath) || currentFiles[0];
    const cleaned = cleanMessages(msgs);
    const sessionObj: ChimuCodeSession = {
      id: sId,
      title: title || 'Sesión de código',
      messages: cleaned,
      files: currentFiles,
      activePath: currActivePath,
      activeCode: currentActiveFile?.content || '',
      language: currentActiveFile?.language || 'html',
      consoleOutput: output,
      pageContext: overridePageContext !== undefined ? overridePageContext : pageContext,
      updatedAt: Date.now(),
    };
    onSaveSession(sessionObj);
    setLastOpenedChimuSessionId(sessionObj.id);
  };

  // Interceptar navegación interna del iframe (<a href="catalogo.html"> cambia el archivo activo)
  const handleNavigateRelative = useCallback((href: string) => {
    if (!href) return;
    const cleanHref = href.replace(/^\.\//, '').replace(/^\//, '');

    // 1. Coincidencia exacta
    let target = files.find((f) => f.path === cleanHref);

    // 2. Coincidencia relativa a la carpeta del archivo activo
    if (!target && activePath.includes('/')) {
      const dir = activePath.slice(0, activePath.lastIndexOf('/') + 1);
      target = files.find((f) => f.path === dir + cleanHref);
    }

    // 3. Coincidencia por nombre de archivo base (ej: catalogo.html)
    if (!target) {
      const baseName = cleanHref.split('/').pop()?.split('?')[0];
      target = files.find((f) => f.path.split('/').pop() === baseName);
    }

    if (target) {
      setActivePath(target.path);
      if (target.language === 'html' || target.path.endsWith('.html')) {
        setActiveRightTab('preview');
      } else {
        setActiveRightTab('code');
      }
    }
  }, [files, activePath]);

  // Listener para mensajes de navegación y consola desde el iframe sandbox
  useEffect(() => {
    function handleIframeMessage(e: MessageEvent) {
      if (!e.data) return;
      if (e.data.type === 'CHIMUCODE_NAVIGATE' && typeof e.data.href === 'string') {
        handleNavigateRelative(e.data.href);
      } else if (e.data.type === 'CHIMUCODE_CONSOLE') {
        const text = Array.isArray(e.data.args) ? e.data.args.join(' ') : String(e.data.args || '');
        const prefix = e.data.level === 'error' ? '❌ [Preview]: ' : 'ℹ️ [Preview]: ';
        setConsoleOutput((prev) => (prev ? `${prev}\n${prefix}${text}` : `${prefix}${text}`));
      }
    }
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [handleNavigateRelative]);

  // Archivo HTML previsualizable en el proyecto (preview.html, index.html o cualquier .html)
  const projectPreviewHtmlFile = useMemo(() => {
    return (
      files.find((f) => f.path === 'preview.html') ||
      files.find((f) => f.path === 'index.html') ||
      files.find((f) => f.language === 'html' || f.path.endsWith('.html') || f.path.endsWith('.htm')) ||
      null
    );
  }, [files]);

  const fileToPreview = isHtml ? activeFile : projectPreviewHtmlFile;
  const hasPreviewableHtml = !!fileToPreview;

  // Construir HTML autocontenido para la previsualización del archivo activo o de preview.html
  const previewHtml = useMemo(() => {
    if (!fileToPreview) return '';
    let html = fileToPreview.content;

    // Inyectar archivos CSS locales referenciados por <link rel="stylesheet" href="...">
    html = html.replace(/<link\b[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi, (tag, href) => {
      const cssFileName = href.split('/').pop()?.split('?')[0];
      const match = files.find((f) => f.path.split('/').pop() === cssFileName || f.path === href);
      if (match) {
        return `<style data-chimucode-file="${match.path}">\n${match.content}\n</style>`;
      }
      return tag;
    });

    // Inyectar scripts locales referenciados por <script src="...">
    html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*><\/script>/gi, (tag, src) => {
      if (src.startsWith('http://') || src.startsWith('https://')) return tag;
      const jsFileName = src.split('/').pop()?.split('?')[0];
      const match = files.find((f) => f.path.split('/').pop() === jsFileName || f.path === src);
      if (match) {
        return `<script data-chimucode-file="${match.path}">\n${match.content}\n</script>`;
      }
      return tag;
    });

    // Inyectar runtime helper para juegos, errores de consola y navegación
    const runtimeHelperScript = `
<script id="__chimucode_runtime_helper__">
(function() {
  // Capturar errores no controlados y enviar a la consola de ChimuCode
  window.addEventListener('error', function(e) {
    try {
      window.parent.postMessage({
        type: 'CHIMUCODE_CONSOLE',
        level: 'error',
        args: [e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '')]
      }, '*');
    } catch(_) {}
  });
  window.addEventListener('unhandledrejection', function(e) {
    try {
      window.parent.postMessage({
        type: 'CHIMUCODE_CONSOLE',
        level: 'error',
        args: ['Unhandled Promise: ' + (e.reason ? (e.reason.message || String(e.reason)) : 'error')]
      }, '*');
    } catch(_) {}
  });

  // Reenviar console.log y console.error
  var _origLog = console.log;
  console.log = function() {
    try {
      var s = Array.prototype.slice.call(arguments).map(function(a) {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      window.parent.postMessage({ type: 'CHIMUCODE_CONSOLE', level: 'log', args: [s] }, '*');
    } catch(_) {}
    if (_origLog) _origLog.apply(console, arguments);
  };
  var _origErr = console.error;
  console.error = function() {
    try {
      var s = Array.prototype.slice.call(arguments).map(function(a) {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      window.parent.postMessage({ type: 'CHIMUCODE_CONSOLE', level: 'error', args: [s] }, '*');
    } catch(_) {}
    if (_origErr) _origErr.apply(console, arguments);
  };

  // Interceptar navegación por enlaces relativos
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    window.parent.postMessage({ type: 'CHIMUCODE_NAVIGATE', href: href }, '*');
  }, true);

  // Prevenir que las teclas de flechas o espacio desplacen la ventana padre durante juegos
  window.addEventListener('keydown', function(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) !== -1) {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) === -1) {
        e.preventDefault();
      }
    }
  }, false);

  try { window.focus(); } catch(_) {}
})();
</script>
`;

    if (html.includes('</body>')) {
      return html.replace('</body>', `${runtimeHelperScript}</body>`);
    }
    return html + runtimeHelperScript;
  }, [fileToPreview, files]);

  // Blob URL para recargar limpiamente el iframe en cada cambio de HTML
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');
  const prevBlobUrlRef = useRef<string>('');

  useEffect(() => {
    if (!hasPreviewableHtml || !previewHtml) {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = '';
      }
      setPreviewBlobUrl('');
      return;
    }

    const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
    }
    prevBlobUrlRef.current = url;
    setPreviewBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewHtml, hasPreviewableHtml]);

  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
    };
  }, []);

  // ── Manejo de Archivos e Imágenes Adjuntas (Visión) ──
  const processSelectedFiles = (selectedFiles: File[]) => {
    for (const file of selectedFiles) {
      const isImg = file.type.startsWith('image/');
      const reader = new FileReader();
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (isImg) {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              type: 'image',
              size: file.size,
              content: `[Imagen adjunta: ${file.name}]`,
              dataUrl,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          const content = (reader.result as string) || '';
          setAttachments((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              type: 'file',
              size: file.size,
              content,
            },
          ]);
        };
        reader.readAsText(file);
      }
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    processSelectedFiles(Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  // ── Pegar imágenes y capturas desde el portapapeles (Ctrl+V / Cmd+V) ──
  const handleClipboardPaste = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
    const clipboardData = ('clipboardData' in e) ? e.clipboardData : null;
    if (!clipboardData) return;

    const filesToProcess: File[] = [];

    // 1. Archivos directos en el clipboard
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file.type.startsWith('image/')) {
          filesToProcess.push(file);
        }
      }
    }

    // 2. Items del portapapeles (capturas de pantalla, Cmd+Shift+4, print screen, etc.)
    if (filesToProcess.length === 0 && clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const fileName = blob.name && blob.name !== 'image.png'
              ? blob.name
              : `captura-${Date.now()}.png`;
            const file = new File([blob], fileName, { type: blob.type || 'image/png' });
            filesToProcess.push(file);
          }
        }
      }
    }

    if (filesToProcess.length > 0) {
      e.preventDefault();
      processSelectedFiles(filesToProcess);
    }
  }, []);

  // Listener global de paste para capturas con Ctrl+V / Cmd+V en cualquier parte de ChimuCode
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl as HTMLElement).classList.contains('chimucode-title-input')) {
        const hasImages = Array.from(e.clipboardData?.items || []).some((item) => item.type.startsWith('image/'));
        if (!hasImages) return;
      }
      handleClipboardPaste(e);
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [handleClipboardPaste]);

  // ── Detener Generación (AbortController) ──
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    isSendingRef.current = false;
    setLiveWritingFile(null);
    setLiveStatusText('');
  };

  // ── GitHub: Operaciones y Control ──
  const handleConnectGitHub = async () => {
    if (!gitHubToken.trim()) return;
    setGitHubLoading(true);
    setGitHubFeedback(null);
    try {
      const res = await validateGitHubToken(gitHubToken.trim());
      if (res.ok && res.user) {
        setGitHubUser(res.user);
        saveStoredGitHubToken(gitHubToken.trim());
        saveStoredGitHubUser(res.user);
        setGitHubFeedback({
          type: 'success',
          message: `¡Conectado exitosamente como @${res.user.login}! Permisos concedidos: ${res.scopes?.join(', ') || 'repo'}.`,
        });
        const reposRes = await listUserRepos(gitHubToken.trim());
        if (reposRes.ok && reposRes.repos) {
          setGitHubRepos(reposRes.repos);
          if (reposRes.repos[0]) {
            setGitHubSelectedRepo(reposRes.repos[0].full_name);
            setGitHubBranch(reposRes.repos[0].default_branch || 'main');
            setGitHubPrBase(reposRes.repos[0].default_branch || 'main');
          }
        }
      } else {
        setGitHubFeedback({
          type: 'error',
          message: res.error || 'Token de GitHub inválido. Verifica los permisos mínimos (repo).',
        });
      }
    } catch (err: any) {
      setGitHubFeedback({
        type: 'error',
        message: err.message || 'Error al conectar con GitHub.',
      });
    } finally {
      setGitHubLoading(false);
    }
  };

  const handleDisconnectGitHub = () => {
    clearStoredGitHubToken();
    setGitHubUser(null);
    setGitHubToken('');
    setGitHubRepos([]);
    setGitHubFeedback({ type: 'success', message: 'Cuenta de GitHub desconectada con éxito.' });
  };

  const handleListRepos = async () => {
    if (!gitHubToken) return;
    setGitHubLoading(true);
    try {
      const reposRes = await listUserRepos(gitHubToken);
      if (reposRes.ok && reposRes.repos) {
        setGitHubRepos(reposRes.repos);
      } else {
        setGitHubFeedback({ type: 'error', message: reposRes.error || 'Error al listar repositorios.' });
      }
    } catch (err: any) {
      setGitHubFeedback({ type: 'error', message: err.message || 'Error al listar repositorios.' });
    } finally {
      setGitHubLoading(false);
    }
  };

  const handleImportRepo = async () => {
    if (!gitHubToken || !gitHubSelectedRepo) return;
    setGitHubLoading(true);
    setGitHubFeedback(null);
    try {
      const [owner, repo] = gitHubSelectedRepo.split('/');
      const repoRes = await fetchRepoFiles(gitHubToken, owner, repo, gitHubBranch);
      if (!repoRes.ok || !repoRes.files || repoRes.files.length === 0) {
        setGitHubFeedback({ type: 'error', message: repoRes.error || 'No se encontraron archivos en la rama seleccionada.' });
        return;
      }
      const repoFiles = repoRes.files;
      setFiles(repoFiles);
      const previewHtml = repoFiles.find((f) => f.path === 'preview.html')
        || repoFiles.find((f) => f.path === 'index.html')
        || repoFiles.find((f) => f.language === 'html' || f.path.endsWith('.html'));
      const nextActive = previewHtml ? previewHtml.path : repoFiles[0].path;
      setActivePath(nextActive);
      setShowRightPanel(true);
      setActiveRightTab(previewHtml ? 'preview' : 'code');
      persistSession(messages, sessionTitle || `Repo: ${repo}`, repoFiles, nextActive, consoleOutput);
      setGitHubFeedback({
        type: 'success',
        message: `¡${repoFiles.length} archivos importados exitosamente desde ${gitHubSelectedRepo}!`,
      });
    } catch (err: any) {
      setGitHubFeedback({ type: 'error', message: err.message || 'Error al importar repositorio.' });
    } finally {
      setGitHubLoading(false);
    }
  };

  const handleCommitAndPush = async () => {
    if (!gitHubToken || !gitHubSelectedRepo || files.length === 0) return;
    setGitHubLoading(true);
    setGitHubFeedback(null);
    try {
      const [owner, repo] = gitHubSelectedRepo.split('/');
      let targetBranch = gitHubBranch;

      if (gitHubCreateNewBranch && gitHubNewBranch.trim()) {
        targetBranch = gitHubNewBranch.trim();
        const branchRes = await createRepoBranch(gitHubToken, owner, repo, gitHubBranch, targetBranch);
        if (!branchRes.ok) {
          throw new Error(branchRes.error || 'No se pudo crear la nueva rama en GitHub.');
        }
      }

      const commitMsg = gitHubCommitMsg.trim() || `Update from ChimuCode: ${sessionTitle}`;
      const res = await commitFilesToRepo(gitHubToken, owner, repo, targetBranch, files, commitMsg);
      if (res.ok) {
        setGitHubFeedback({
          type: 'success',
          message: `¡Commit y Push completados en la rama ${targetBranch}!`,
          url: res.commitUrl,
        });
        setGitHubBranch(targetBranch);
        setGitHubCreateNewBranch(false);
      } else {
        throw new Error(res.error || 'Error al realizar el commit.');
      }
    } catch (err: any) {
      setGitHubFeedback({ type: 'error', message: err.message || 'Error al realizar commit y push.' });
    } finally {
      setGitHubLoading(false);
    }
  };

  const handleCreatePullRequest = async () => {
    if (!gitHubToken || !gitHubSelectedRepo) return;
    setGitHubLoading(true);
    setGitHubFeedback(null);
    try {
      const [owner, repo] = gitHubSelectedRepo.split('/');
      const title = gitHubPrTitle.trim() || `ChimuCode: ${sessionTitle}`;
      const body = gitHubPrBody.trim() || `Pull request generado desde ChimuCode.\n\nArchivos modificados: ${files.map(f => f.path).join(', ')}`;
      const res = await createPullRequest(gitHubToken, owner, repo, gitHubBranch, gitHubPrBase || 'main', title, body);
      if (res.ok) {
        setGitHubFeedback({
          type: 'success',
          message: `¡Pull Request #${res.prNumber || ''} creado con éxito!`,
          url: res.prUrl,
        });
      } else {
        throw new Error(res.error || 'Error al crear Pull Request.');
      }
    } catch (err: any) {
      setGitHubFeedback({ type: 'error', message: err.message || 'Error al crear Pull Request.' });
    } finally {
      setGitHubLoading(false);
    }
  };

  // Manejo del Feedbacker ("¿Funciona?")
  const handleSubmitFeedback = (targetMsgId?: string) => {
    if (!feedbackReaction) return;
    if (feedbackReaction === 'works') {
      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackSuccess(false);
        setFeedbackMsgId(null);
        setFeedbackReaction(null);
      }, 2500);
      return;
    }

    const prompt = buildChimuCodeFeedbackPrompt({
      reaction: feedbackReaction,
      tag: feedbackSelectedTag || undefined,
      comment: feedbackComment,
    });

    setFeedbackMsgId(null);
    setFeedbackReaction(null);
    setFeedbackSelectedTag(null);
    setFeedbackComment('');
    handleSendMessage(prompt);
  };

  // Enviar mensaje al backend y procesar streaming SSE en vivo
  const handleSendMessage = async (overridePrompt?: string | React.SyntheticEvent) => {
    if (isSendingRef.current || isGenerating) return;
    let promptText = (typeof overridePrompt === 'string' ? overridePrompt : input).trim();
    if (!promptText && attachments.length === 0) return;
    if (!promptText && attachments.length > 0) {
      promptText = 'Analiza los archivos adjuntos y asísteme con el código.';
    }

    isSendingRef.current = true;

    if (!currentSessionIdRef.current) {
      const newId = (activeSessionId && activeSessionId !== 'new') ? activeSessionId : `code-${Date.now()}`;
      currentSessionIdRef.current = newId;
      setCurrentLoadedId(newId);
      setLastOpenedChimuSessionId(newId);
    }

    const currentAttachments = [...attachments];
    const userMsg: ChimuCodeMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: promptText,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentClean = cleanMessages(messages);
    // Prevenir duplicación de la burbuja del usuario
    if (
      currentClean.length > 0 &&
      currentClean[currentClean.length - 1].role === 'user' &&
      currentClean[currentClean.length - 1].content.trim() === promptText &&
      currentAttachments.length === 0
    ) {
      isSendingRef.current = false;
      return;
    }

    const nextMsgs = [...currentClean, userMsg];
    setMessages(nextMsgs);
    if (typeof overridePrompt !== 'string') {
      setInput('');
      setAttachments([]);
    }

    // Resetear estados de streaming en vivo
    setLiveTools([]);
    setLiveStatusText('');
    setLiveExplanation('');
    setLiveFiles([]);
    setLiveWritingFile(null);
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let nextTitle = sessionTitle;
    if (sessionTitle === 'Nueva sesión' || !sessionTitle) {
      nextTitle = promptText.length > 32 ? promptText.slice(0, 32) + '…' : promptText;
      setSessionTitle(nextTitle);
    }

    persistSession(nextMsgs, nextTitle, files, activePath, consoleOutput, pageContext);

    let currentPageContext = pageContext;

    try {
      const imagesToSend = currentAttachments
        .filter((a) => a.dataUrl)
        .map((a) => a.dataUrl!);

      const attachmentsToSend = currentAttachments
        .filter((a) => !a.dataUrl && (a.content || a.textContent))
        .map((a) => ({ name: a.name, content: a.content || a.textContent || '' }));

      const res = await fetch('/api/chimucode/generate', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          files: files,
          currentCode: activeContent,
          language: detectedLang,
          model: model || CLIENT_MODEL_FLASH,
          images: imagesToSend.length > 0 ? imagesToSend : undefined,
          attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
          messages: nextMsgs.slice(-12).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          pageContext: pageContext,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Error ${res.status}: ${errText || 'Fallo de conexión'}`);
      }

      if (!res.body) {
        throw new Error('No se recibió stream de respuesta.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';
      let accumulatedExplanation = '';
      let accumulatedFiles: ChimuCodeFile[] = [];
      let accumulatedTools: ChimuCodeToolCall[] = [];
      let finalActivePath = activePath;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const parts = streamBuffer.split('\n\n');
        streamBuffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;

            let event: any = null;
            try {
              event = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (event.type === 'tool') {
              if (event.status === 'start') {
                const newTool: ChimuCodeToolCall = {
                  name: event.name,
                  status: 'start',
                  input: event.input,
                };
                accumulatedTools = [...accumulatedTools, newTool];
                setLiveTools([...accumulatedTools]);
              } else if (event.status === 'done') {
                accumulatedTools = accumulatedTools.map((t) =>
                  t.name === event.name
                    ? { ...t, status: 'done', preview: event.preview }
                    : t
                );
                setLiveTools([...accumulatedTools]);
              } else if (event.status === 'error') {
                accumulatedTools = accumulatedTools.map((t) =>
                  t.name === event.name
                    ? { ...t, status: 'error', error: event.error, preview: event.preview }
                    : t
                );
                setLiveTools([...accumulatedTools]);
              }
            } else if (event.type === 'pageContext') {
              if (event.pageContext) {
                currentPageContext = event.pageContext;
                setPageContext(event.pageContext);
              }
            } else if (event.type === 'status') {
              setLiveStatusText(event.text || '');
            } else if (event.type === 'delta') {
              accumulatedExplanation += event.text;
              setLiveExplanation(accumulatedExplanation);
            } else if (event.type === 'file_delta') {
              const deltaChunk = event.chunk || event.delta || '';
              const fullCode = event.fullContent ?? ((liveWritingFile && liveWritingFile.path === event.path ? liveWritingFile.code : '') + deltaChunk);
              const bytes = event.totalBytes || event.totalLength || fullCode.length;

              setLiveStatusText(`Escribiendo ${event.path}…`);
              setLiveWritingFile({
                path: event.path,
                language: event.language || 'html',
                totalBytes: bytes,
                code: fullCode,
              });

              // Actualizar el espacio de trabajo en vivo para que el código y preview crezcan en tiempo real
              setFiles((prev) => {
                const map = new Map<string, ChimuCodeFile>(prev.map((f) => [f.path, f]));
                map.set(event.path, {
                  path: event.path,
                  language: event.language || map.get(event.path)?.language || 'html',
                  content: fullCode,
                });
                return Array.from(map.values());
              });
            } else if (event.type === 'file') {
              setLiveStatusText('');
              setLiveWritingFile(null);
              const fileObj: ChimuCodeFile = {
                path: event.path,
                language: event.language,
                content: event.content || '',
              };
              if (!accumulatedFiles.some((f) => f.path === fileObj.path)) {
                accumulatedFiles = [...accumulatedFiles, fileObj];
              } else {
                accumulatedFiles = accumulatedFiles.map((f) => (f.path === fileObj.path ? fileObj : f));
              }
              setLiveFiles([...accumulatedFiles]);

              // Actualizar el espacio de trabajo en vivo
              setFiles((prev) => {
                const map = new Map<string, ChimuCodeFile>(prev.map((f) => [f.path, f]));
                map.set(fileObj.path, fileObj);
                return Array.from(map.values());
              });

              const isEventHtml = fileObj.path === 'preview.html' || fileObj.path === 'index.html' || fileObj.language === 'html' || fileObj.path.endsWith('.html');
              if (isEventHtml) {
                finalActivePath = fileObj.path;
                setActivePath(fileObj.path);
                setShowRightPanel(true);
                setActiveRightTab('preview');
              } else {
                const hasHtmlSoFar = accumulatedFiles.some((f) => f.language === 'html' || f.path.endsWith('.html'));
                if (!hasHtmlSoFar) {
                  finalActivePath = fileObj.path;
                  setActivePath(fileObj.path);
                  setShowRightPanel(true);
                  setActiveRightTab('code');
                }
              }
            } else if (event.type === 'done') {
              setLiveWritingFile(null);
              if (Array.isArray(event.files) && event.files.length > 0) {
                accumulatedFiles = event.files;
              }
              if (event.activePath) {
                finalActivePath = event.activePath;
              }
              if (event.pageContext) {
                currentPageContext = event.pageContext;
                setPageContext(event.pageContext);
              }
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Error reportado por el servidor');
            }
          }
        }
      }

      // Merge final de archivos
      let updatedFiles = [...files];
      if (accumulatedFiles.length > 0) {
        const map = new Map<string, ChimuCodeFile>();
        for (const f of updatedFiles) map.set(f.path, f);
        for (const f of accumulatedFiles) map.set(f.path, f);
        updatedFiles = Array.from(map.values());
        setFiles(updatedFiles);

        const previewHtml = updatedFiles.find((f) => f.path === 'preview.html')
          || updatedFiles.find((f) => f.path === 'index.html')
          || updatedFiles.find((f) => f.language === 'html' || f.path.endsWith('.html'));

        const nextActive = previewHtml ? previewHtml.path : (finalActivePath || updatedFiles[0]?.path);
        setActivePath(nextActive);
        setShowRightPanel(true);
        if (previewHtml) {
          setActiveRightTab('preview');
        } else {
          setActiveRightTab('code');
        }
      }

      const assistantMsg: ChimuCodeMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content:
          accumulatedExplanation.trim() ||
          (accumulatedFiles.length > 0
            ? 'Archivos del proyecto actualizados:'
            : '¿Qué aplicación o script te gustaría programar?'),
        changedFiles: accumulatedFiles.length > 0 ? accumulatedFiles : undefined,
        tools: accumulatedTools.length > 0 ? accumulatedTools : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMsgs = [...nextMsgs, assistantMsg];
      setMessages(cleanMessages(finalMsgs));
      persistSession(finalMsgs, nextTitle, updatedFiles, finalActivePath || activePath, consoleOutput, currentPageContext);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Generación cancelada por el usuario
        return;
      }
      if (!err?.message?.includes('Unexpected token')) {
        const errorMsg: ChimuCodeMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error: ${err.message || 'No se pudo generar el código'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        const finalMsgs = [...nextMsgs, errorMsg];
        setMessages(cleanMessages(finalMsgs));
        persistSession(finalMsgs, nextTitle, files, activePath, consoleOutput, currentPageContext);
      }
    } finally {
      isSendingRef.current = false;
      setIsGenerating(false);
      abortControllerRef.current = null;
      setLiveWritingFile(null);
      setLiveTools([]);
      setLiveStatusText('');
      setLiveExplanation('');
      setLiveFiles([]);
    }
  };

  // Ejecutar código según lenguaje
  const handleRunCode = async (overrideCode?: string) => {
    const codeToRun = overrideCode || activeContent;
    if (!codeToRun || isRunning) return;

    setIsRunning(true);
    const lang = detectedLang;

    if (lang === 'html' || activePath.endsWith('.html')) {
      setActiveRightTab('preview');
      setShowRightPanel(true);
      const out = `Archivo HTML "${activePath}" renderizado en vivo en el sandbox.`;
      setConsoleOutput(out);
      persistSession(messages, sessionTitle, files, activePath, out);
      setIsRunning(false);
      return;
    }

    setShowRightPanel(true);
    setActiveRightTab('console');

    if (lang === 'javascript' || activePath.endsWith('.js')) {
      try {
        const res = await executeBrowserJS(codeToRun);
        const out = res.ok
          ? (res.output || 'Ejecutado con éxito (sin salida por consola).')
          : `Error de ejecución: ${res.error || 'Fallo desconocido'}`;
        setConsoleOutput(out);
        persistSession(messages, sessionTitle, files, activePath, out);
      } catch (e: any) {
        const out = `Error en worker: ${e.message || String(e)}`;
        setConsoleOutput(out);
        persistSession(messages, sessionTitle, files, activePath, out);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // Python u otros a /api/sandbox
    try {
      const sandboxLang = (lang === 'py' || lang === 'python' || activePath.endsWith('.py')) ? 'python' : lang;
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToRun, language: sandboxLang }),
      });
      const data = await res.json();
      const out = data.ok
        ? (data.output || 'Ejecutado con éxito (sin salida).')
        : `Error de sandbox: ${data.error || 'Fallo de ejecución'}`;
      setConsoleOutput(out);
      persistSession(messages, sessionTitle, files, activePath, out);
    } catch (e: any) {
      const out = `Error de conexión con sandbox: ${e.message || String(e)}`;
      setConsoleOutput(out);
      persistSession(messages, sessionTitle, files, activePath, out);
    } finally {
      setIsRunning(false);
    }
  };

  // Copiar texto plano de burbuja sin markdown crudo
  const handleCopyBubble = async (msgId: string, content: string) => {
    const plain = stripMarkdown(content);
    const ok = await copyTextToClipboard(plain);
    if (ok) {
      if (bubbleCopyTimeoutRef.current) clearTimeout(bubbleCopyTimeoutRef.current);
      setCopiedBubbleId(msgId);
      bubbleCopyTimeoutRef.current = setTimeout(() => {
        setCopiedBubbleId(null);
      }, 1200);
    }
  };

  // Copiar código del archivo activo desde la tarjeta (solo el archivo, sin explicación)
  const handleCopyCard = async (msgId: string, filesInMsg?: ChimuCodeFile[]) => {
    const fileList = filesInMsg && filesInMsg.length > 0 ? filesInMsg : files;
    const target =
      fileList.find((f) => f.path === activePath) ||
      fileList.find((f) => f.language === 'html' || f.path.endsWith('.html')) ||
      fileList[0];
    const codeToCopy = target?.content || '';
    const ok = await copyTextToClipboard(codeToCopy);
    if (ok) {
      if (cardCopyTimeoutRef.current) clearTimeout(cardCopyTimeoutRef.current);
      setCopiedCardMsgId(msgId);
      cardCopyTimeoutRef.current = setTimeout(() => {
        setCopiedCardMsgId(null);
      }, 1200);
    }
  };

  // Copiar código del archivo activo (textarea del panel Código)
  const handleCopyActiveCode = async () => {
    if (!activeContent) return;
    const ok = await copyTextToClipboard(activeContent);
    if (ok) {
      if (activeCodeTimeoutRef.current) clearTimeout(activeCodeTimeoutRef.current);
      setCopiedActiveCode(true);
      activeCodeTimeoutRef.current = setTimeout(() => {
        setCopiedActiveCode(false);
      }, 1200);
    }
  };

  // Copiar salida de consola
  const handleCopyConsole = async () => {
    if (!consoleOutput) return;
    const ok = await copyTextToClipboard(consoleOutput);
    if (ok) {
      if (consoleCopyTimeoutRef.current) clearTimeout(consoleCopyTimeoutRef.current);
      setCopiedConsole(true);
      consoleCopyTimeoutRef.current = setTimeout(() => {
        setCopiedConsole(false);
      }, 1200);
    }
  };


  // Descargar: 1 archivo = ese archivo. 2 o más = zip con las carpetas
  const handleDownload = async () => {
    if (files.length === 0) return;

    const cleanTitle = (sessionTitle || 'proyecto')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 30);

    if (files.length === 1) {
      const singleFile = files[0];
      const blob = new Blob([singleFile.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = singleFile.path.split('/').pop() || `${cleanTitle}.html`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // 2 o más archivos: crear ZIP preservando rutas de carpetas (ej. petra/index.html)
    try {
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.path, file.content);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanTitle}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error al generar ZIP: ${err.message || String(err)}`);
    }
  };

  // Renderizado del componente interactivo Feedbacker ("¿Funciona?")
  const renderFeedbackBox = (targetMsgId: string) => {
    return (
      <div className="chimucode-feedbacker-container">
        {feedbackSuccess ? (
          <div className="chimucode-feedback-success-banner">
            <CheckCircle2 size={14} color="#4ade80" />
            <span>¡Excelente! Tu proyecto funciona correctamente.</span>
          </div>
        ) : (
          <>
            <div className="chimucode-feedback-header-row">
              <span className="chimucode-feedback-prompt-label">¿Cómo funciona la aplicación o código?</span>
              <button
                type="button"
                className="chimucode-fb-close-btn"
                onClick={() => setFeedbackMsgId(null)}
                title="Cerrar panel de feedback"
              >
                <X size={12} />
              </button>
            </div>
            <div className="chimucode-feedback-reactions-grid">
              <button
                type="button"
                className={`chimucode-fb-reaction-btn ${feedbackReaction === 'works' ? 'selected' : ''}`}
                onClick={() => {
                  setFeedbackReaction('works');
                  handleSubmitFeedback(targetMsgId);
                }}
              >
                <span>🎉 Funciona perfecto</span>
              </button>
              <button
                type="button"
                className={`chimucode-fb-reaction-btn ${feedbackReaction === 'error' ? 'selected' : ''}`}
                onClick={() => setFeedbackReaction('error')}
              >
                <span>⚠️ Tiene un error</span>
              </button>
              <button
                type="button"
                className={`chimucode-fb-reaction-btn ${feedbackReaction === 'missing' ? 'selected' : ''}`}
                onClick={() => setFeedbackReaction('missing')}
              >
                <span>✏️ Falta algo</span>
              </button>
              <button
                type="button"
                className={`chimucode-fb-reaction-btn ${feedbackReaction === 'retry' ? 'selected' : ''}`}
                onClick={() => setFeedbackReaction('retry')}
              >
                <span>🔄 Reintentar</span>
              </button>
            </div>

            {feedbackReaction && feedbackReaction !== 'works' && (
              <div className="chimucode-feedback-details-box">
                <div className="chimucode-fb-tags-wrap">
                  {[
                    'No responde a clics',
                    'Error en consola',
                    'Falta un botón / opción',
                    'Diseño roto',
                    'La IA o lógica no responde',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`chimucode-fb-tag-pill ${feedbackSelectedTag === tag ? 'active' : ''}`}
                      onClick={() => setFeedbackSelectedTag(feedbackSelectedTag === tag ? null : tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <div className="chimucode-fb-input-wrap">
                  <input
                    type="text"
                    className="chimucode-fb-text-input"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmitFeedback(targetMsgId);
                      }
                    }}
                    placeholder={
                      feedbackReaction === 'error'
                        ? 'Describe el error o problema...'
                        : feedbackReaction === 'missing'
                        ? '¿Qué elemento o funcionalidad falta?'
                        : '¿Qué debería rehacer o cambiar?'
                    }
                  />
                  <button
                    type="button"
                    className="chimucode-fb-submit-btn"
                    onClick={() => handleSubmitFeedback(targetMsgId)}
                    disabled={isGenerating}
                    title="Enviar corrección al agente"
                  >
                    <Send size={13} />
                    <span>Corregir</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const currentModelData =
    REAL_MODELS.find((m) => m.id === model) ||
    (isUncensoredModel(model) ? REAL_MODELS[1] : REAL_MODELS[0]);

  return (
    <div className="chimucode-root">
      {/* ── 1. TOP BAR EXACTA (44px) ── */}
      <header className="chimucode-topbar">
        <div className="chimucode-topbar-left">
          {onToggleSidebar && (
            <button
              type="button"
              className={`chimucode-sidebar-toggle-btn ${!isSidebarOpen ? 'sidebar-hidden' : ''}`}
              onClick={onToggleSidebar}
              title={isSidebarOpen ? "Ocultar panel lateral de sesiones" : "Mostrar panel lateral de sesiones"}
              aria-label={isSidebarOpen ? "Ocultar panel lateral de sesiones" : "Mostrar panel lateral de sesiones"}
            >
              <PanelLeft size={16} />
            </button>
          )}

          <div className="chimucode-title-wrap">
            <input
              type="text"
              className="chimucode-title-input"
              value={sessionTitle}
              onChange={(e) => {
                setSessionTitle(e.target.value);
                persistSession(messages, e.target.value, files, activePath, consoleOutput);
              }}
              placeholder="Título de la sesión..."
              title="Haz clic para editar el título"
            />
          </div>
        </div>

        <div className="chimucode-topbar-right">
          {/* Selector de modelo real */}
          <div className="chimucode-model-dropdown-wrap" ref={modelDropdownRef}>
            <button
              type="button"
              className="chimucode-model-btn"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              title="Cambiar modelo de IA"
            >
              <span className="chimucode-model-dot" />
              <span>{currentModelData.shortName}</span>
              <ChevronDown size={13} />
            </button>

            {showModelDropdown && (
              <div className="chimucode-model-menu">
                {REAL_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`chimucode-model-item ${model === m.id ? 'active' : ''}`}
                    onClick={() => {
                      setModel(m.id);
                      setShowModelDropdown(false);
                    }}
                  >
                    <span>{m.shortName}</span>
                    <span className="chimucode-model-sub">{m.desc}</span>
                    {model === m.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GitHub */}
          <button
            type="button"
            className={`chimucode-btn-action ${gitHubUser ? 'connected' : ''}`}
            onClick={() => {
              setShowGitHubModal(true);
              setGitHubFeedback(null);
            }}
            title={gitHubUser ? `Conectado a GitHub como @${gitHubUser.login}` : 'Conectar y gestionar con GitHub'}
          >
            <GithubIcon size={14} />
            <span className="chimucode-btn-text">
              {gitHubUser ? gitHubUser.login : 'GitHub'}
            </span>
          </button>

          {/* Descargar */}
          <button
            type="button"
            className="chimucode-btn-action"
            onClick={handleDownload}
            disabled={files.length === 0}
            title={files.length > 1 ? `Descargar proyecto completo en ZIP (${files.length} archivos)` : 'Descargar archivo'}
          >
            <Download size={14} />
            <span className="chimucode-btn-text">
              {files.length > 1 ? 'Descargar .zip' : 'Descargar'}
            </span>
          </button>

          {/* Ejecutar */}
          <button
            type="button"
            className="chimucode-btn-action chimucode-btn-run"
            onClick={() => handleRunCode()}
            disabled={!activeContent || isRunning}
            title="Ejecutar archivo activo"
          >
            {isRunning ? (
              <RotateCw size={14} className="chimucode-spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            <span className="chimucode-btn-text">{isRunning ? 'Ejecutando…' : 'Ejecutar'}</span>
          </button>

          {/* Panel */}
          <button
            type="button"
            className={`chimucode-btn-action ${showRightPanel && files.length > 0 ? 'active' : ''}`}
            onClick={() => setShowRightPanel(!showRightPanel)}
            disabled={files.length === 0}
            title={files.length === 0 ? 'No hay archivos para mostrar' : 'Alternar panel de código y vista previa'}
          >
            <PanelRight size={14} />
            <span className="chimucode-btn-text">Panel</span>
          </button>
        </div>
      </header>

      {/* ── 2. FILA FLEX 1FR (Workspace) ── */}
      <div className="chimucode-workspace" ref={workspaceRef}>
        {/* COLUMNA CHAT */}
        <div
          className="chimucode-chat-panel"
          style={{
            flex: showRightPanel && files.length > 0 ? `0 0 ${100 - panelWidthPercent}%` : '1 1 100%',
            maxWidth: showRightPanel && files.length > 0 ? `${100 - panelWidthPercent}%` : '100%',
          }}
        >
          {/* Mensajes (min 0, overflow auto, alto restante) */}
          <div className="chimucode-messages-scroll" ref={messagesScrollRef}>
            {renderedMessages.length === 0 && !isGenerating ? null : (
              <div className="chimucode-messages-list">
                {renderedMessages.map((m) => (
                  <div key={m.id} className={`chimucode-msg chimucode-msg-${m.role}`}>
                    <div className="chimucode-msg-bubble">
                      {/* Botón copiar al hover (user y assistant) con texto plano */}
                      <button
                        type="button"
                        className={`chimucode-bubble-copy-btn ${copiedBubbleId === m.id ? 'copied' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyBubble(m.id, m.content);
                        }}
                        title="Copiar texto del mensaje"
                        aria-label="Copiar texto del mensaje"
                      >
                        {copiedBubbleId === m.id ? (
                          <>
                            <Check size={11} color="#4ade80" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>

                      {/* Herramientas ejecutadas en este mensaje estilo Claude Code */}
                      {m.tools && m.tools.length > 0 && (
                        <div className="chimucode-tools-log">
                          {m.tools.map((t, idx) => (
                            <div key={idx} className="chimucode-tool-item">
                              <div className="chimucode-tool-row">
                                <span className="chimucode-tool-icon">
                                  <Globe size={13} />
                                </span>
                                <span className="chimucode-tool-name">{t.name}</span>
                                {t.input && <span className="chimucode-tool-input">{t.input}</span>}
                                <div className={`chimucode-tool-status ${t.status}`}>
                                  {t.status === 'done' && <Check size={12} color="#4ade80" />}
                                  {t.status === 'error' && <AlertCircle size={12} color="#f87171" />}
                                </div>
                              </div>
                              {t.preview && <div className="chimucode-tool-preview">{t.preview}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Archivos e imágenes adjuntos al mensaje del usuario */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="chimucode-msg-attachments">
                          {m.attachments.map((att) => (
                            <div key={att.id} className="chimucode-msg-att-item">
                              {att.dataUrl ? (
                                <img src={att.dataUrl} alt={att.name} className="chimucode-msg-att-img" />
                              ) : (
                                <div className="chimucode-msg-att-file">
                                  <FileCode size={13} />
                                  <span>{att.name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="chimucode-markdown-body">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>

                      {/* Card de archivos generados en este turno */}
                      {m.changedFiles && m.changedFiles.length > 0 && (
                        <div className="chimucode-code-card">
                          <div className="chimucode-code-card-files">
                            {m.changedFiles.map((f) => (
                              <div
                                key={f.path}
                                className="chimucode-card-file-item"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setActivePath(f.path);
                                  setShowRightPanel(true);
                                  setActiveRightTab(f.language === 'html' || f.path.endsWith('.html') ? 'preview' : 'code');
                                }}
                              >
                                <span className="chimucode-file-badge">{f.language.toUpperCase()}</span>
                                <span className="chimucode-file-name">{f.path}</span>
                              </div>
                            ))}
                          </div>

                          <div className="chimucode-code-card-actions">
                            <button
                              type="button"
                              className="chimucode-card-btn"
                              onClick={() => {
                                const target = m.changedFiles?.find((f) => f.path === 'preview.html')
                                  || m.changedFiles?.find((f) => f.path === 'index.html')
                                  || m.changedFiles?.find((f) => f.language === 'html' || f.path.endsWith('.html'))
                                  || m.changedFiles?.[0];
                                if (target) {
                                  setActivePath(target.path);
                                  setShowRightPanel(true);
                                  setActiveRightTab(target.language === 'html' || target.path.endsWith('.html') ? 'preview' : 'code');
                                }
                              }}
                            >
                              <Eye size={12} />
                              <span>Vista previa</span>
                            </button>

                            <button
                              type="button"
                              className="chimucode-card-btn"
                              onClick={() => {
                                handleCopyCard(m.id, m.changedFiles);
                              }}
                              title="Copiar código del archivo activo"
                            >
                              {copiedCardMsgId === m.id ? (
                                <Check size={12} color="#4ade80" />
                              ) : (
                                <Copy size={12} />
                              )}
                              <span>{copiedCardMsgId === m.id ? 'Copiado' : 'Copiar'}</span>
                            </button>

                            <button
                              type="button"
                              className={`chimucode-card-btn chimucode-feedback-trigger-btn ${feedbackMsgId === m.id ? 'active' : ''}`}
                              onClick={() => {
                                if (feedbackMsgId === m.id) {
                                  setFeedbackMsgId(null);
                                } else {
                                  setFeedbackMsgId(m.id);
                                  setFeedbackReaction(null);
                                  setFeedbackSelectedTag(null);
                                  setFeedbackComment('');
                                  setFeedbackSuccess(false);
                                }
                              }}
                              title="Evaluar funcionamiento o solicitar corrección al agente"
                            >
                              <HelpCircle size={12} />
                              <span>¿Funciona?</span>
                            </button>
                          </div>

                          {/* Panel interactivo del Feedbacker */}
                          {feedbackMsgId === m.id && renderFeedbackBox(m.id)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isGenerating && (
                  <div className="chimucode-msg chimucode-msg-assistant">
                    <div className="chimucode-msg-bubble">
                      {/* Log vivo de herramientas estilo Claude Code */}
                      {liveTools.length > 0 && (
                        <div className="chimucode-tools-log">
                          {liveTools.map((t, idx) => (
                            <div key={idx} className="chimucode-tool-item">
                              <div className="chimucode-tool-row">
                                <span className="chimucode-tool-icon">
                                  <Globe size={13} />
                                </span>
                                <span className="chimucode-tool-name">{t.name}</span>
                                {t.input && <span className="chimucode-tool-input">{t.input}</span>}
                                <div className={`chimucode-tool-status ${t.status}`}>
                                  {t.status === 'start' && <RotateCw size={12} className="chimucode-spin" />}
                                  {t.status === 'done' && <Check size={12} color="#4ade80" />}
                                  {t.status === 'error' && <AlertCircle size={12} color="#f87171" />}
                                </div>
                              </div>
                              {t.preview && <div className="chimucode-tool-preview">{t.preview}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Fila de status en vivo (ej. escribiendo index.html). Desaparece al llegar la card */}
                      {liveStatusText && !liveWritingFile && liveFiles.length === 0 && (
                        <div className="chimucode-live-status-row">
                          <RotateCw size={12} className="chimucode-spin" />
                          <span>{liveStatusText}</span>
                        </div>
                      )}

                      {/* Tarjeta de escritura de código en vivo (streaming delta) */}
                      {liveWritingFile && (
                        <div className="chimucode-live-writing-card">
                          <div className="chimucode-live-writing-header">
                            <div className="chimucode-live-writing-title">
                              <span className="chimucode-live-pulse-dot" />
                              <span className="chimucode-live-writing-path">{liveWritingFile.path}</span>
                            </div>
                            <div className="chimucode-live-writing-stats">
                              <span>{(liveWritingFile.totalBytes / 1024).toFixed(1)} KB</span>
                              <span className="chimucode-live-badge">{liveWritingFile.language.toUpperCase()}</span>
                            </div>
                          </div>
                          <div className="chimucode-live-code-preview" ref={liveCodeContainerRef}>
                            <pre><code>{liveWritingFile.code || `// Generando ${liveWritingFile.path}...`}</code><span className="chimucode-live-cursor">▋</span></pre>
                          </div>
                        </div>
                      )}

                      {/* Texto del asistente que crece con cada delta */}
                      {liveExplanation && (
                        <div className="chimucode-markdown-body">
                          <ReactMarkdown>{liveExplanation}</ReactMarkdown>
                        </div>
                      )}

                      {/* Estado inicial mientras conecta */}
                      {!liveExplanation && !liveStatusText && !liveWritingFile && liveTools.length === 0 && (
                        <div className="chimucode-generating-bubble">
                          <RotateCw size={14} className="chimucode-spin" />
                          <span>Conectando con ChimuCode…</span>
                        </div>
                      )}

                      {/* Tarjetas de archivos a medida que van cerrando los fences */}
                      {liveFiles.length > 0 && (
                        <div className="chimucode-code-card">
                          <div className="chimucode-code-card-files">
                            {liveFiles.map((f) => (
                              <div
                                key={f.path}
                                className="chimucode-card-file-item"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setActivePath(f.path);
                                  setShowRightPanel(true);
                                  setActiveRightTab(
                                    f.language === 'html' || f.path.endsWith('.html') ? 'preview' : 'code'
                                  );
                                }}
                              >
                                <span className="chimucode-file-badge">{f.language.toUpperCase()}</span>
                                <span className="chimucode-file-name">{f.path}</span>
                              </div>
                            ))}
                          </div>

                          <div className="chimucode-code-card-actions">
                            <button
                              type="button"
                              className="chimucode-card-btn"
                              onClick={() => {
                                const target = liveFiles.find((f) => f.path === 'preview.html')
                                  || liveFiles.find((f) => f.path === 'index.html')
                                  || liveFiles.find((f) => f.language === 'html' || f.path.endsWith('.html'))
                                  || liveFiles[0];
                                if (target) {
                                  setActivePath(target.path);
                                  setShowRightPanel(true);
                                  setActiveRightTab(target.language === 'html' || target.path.endsWith('.html') ? 'preview' : 'code');
                                }
                              }}
                            >
                              <Eye size={12} />
                              <span>Vista previa</span>
                            </button>

                            <button
                              type="button"
                              className="chimucode-card-btn"
                              onClick={() => {
                                handleCopyCard('live', liveFiles);
                              }}
                              title="Copiar código del archivo activo"
                            >
                              {copiedCardMsgId === 'live' ? (
                                <Check size={12} color="#4ade80" />
                              ) : (
                                <Copy size={12} />
                              )}
                              <span>{copiedCardMsgId === 'live' ? 'Copiado' : 'Copiar'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* COMPOSER PEGADO ABAJO, FUERA DEL SCROLL */}
          <div className="chimucode-composer-wrap">
            {/* Input oculto para adjuntar archivos e imágenes */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFilesSelected}
              style={{ display: 'none' }}
              accept="image/*,.js,.jsx,.ts,.tsx,.html,.css,.json,.py,.md,.txt,.svg"
            />

            <div
              className={`chimucode-composer-box ${isDraggingOver ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  processSelectedFiles(Array.from(e.dataTransfer.files));
                }
              }}
              onPaste={handleClipboardPaste}
            >
              {/* Chips de archivos adjuntos */}
              {attachments.length > 0 && (
                <div className="chimucode-composer-attachments-bar">
                  {attachments.map((att) => (
                    <div key={att.id} className="chimucode-attachment-chip">
                      {att.dataUrl ? (
                        <img src={att.dataUrl} alt={att.name} className="chimucode-att-chip-thumb" />
                      ) : (
                        <FileCode size={12} className="chimucode-att-chip-icon" />
                      )}
                      <span className="chimucode-att-chip-name">{att.name}</span>
                      <span className="chimucode-att-chip-size">
                        {att.size < 1024 ? `${att.size}B` : `${Math.round(att.size / 1024)}KB`}
                      </span>
                      <button
                        type="button"
                        className="chimucode-att-chip-remove"
                        onClick={() => handleRemoveAttachment(att.id)}
                        title="Quitar archivo adjunto"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea multilínea con Enter para enviar y Shift+Enter para salto de línea */}
              <textarea
                className="chimucode-composer-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handleClipboardPaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  isDraggingOver
                    ? 'Suelta los archivos aquí para adjuntarlos...'
                    : 'Describe qué quieres programar... (Enter para enviar, Shift+Enter para nueva línea)'
                }
                disabled={isGenerating}
                rows={1}
                autoFocus
              />

              {/* Barra inferior de herramientas dentro del composer */}
              <div className="chimucode-composer-bottom-bar">
                <div className="chimucode-composer-tools-left">
                  {/* Botón Adjuntar Archivo o Imagen */}
                  <button
                    type="button"
                    className="chimucode-composer-icon-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    title="Adjuntar imágenes o archivos de código (soporte visión)"
                  >
                    <Paperclip size={14} />
                  </button>

                  {/* Selector de Modelo dentro del input */}
                  <div className="chimucode-input-model-wrap" ref={inputModelDropdownRef}>
                    <button
                      type="button"
                      className="chimucode-input-model-pill"
                      onClick={() => setShowInputModelDropdown(!showInputModelDropdown)}
                      title="Cambiar modelo de IA"
                    >
                      <span className="chimucode-model-dot" />
                      <span>{currentModelData.shortName}</span>
                      <ChevronDown size={11} />
                    </button>

                    {showInputModelDropdown && (
                      <div className="chimucode-input-model-menu">
                        {REAL_MODELS.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`chimucode-input-model-item ${model === m.id ? 'active' : ''}`}
                            onClick={() => {
                              setModel(m.id);
                              setShowInputModelDropdown(false);
                            }}
                          >
                            <div className="chimucode-input-model-item-title">
                              <span>{m.shortName}</span>
                              {model === m.id && <Check size={13} />}
                            </div>
                            <span className="chimucode-input-model-item-desc">{m.desc} · Visión</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Botón de GitHub en el input */}
                  <button
                    type="button"
                    className={`chimucode-composer-tool-btn ${gitHubUser ? 'connected' : ''}`}
                    onClick={() => {
                      setShowGitHubModal(true);
                      setGitHubFeedback(null);
                    }}
                    title={gitHubUser ? `GitHub: Conectado como @${gitHubUser.login}` : 'Conectar GitHub'}
                  >
                    <GithubIcon size={13} />
                    <span>{gitHubUser ? gitHubUser.login : 'GitHub'}</span>
                  </button>
                </div>

                <div className="chimucode-composer-tools-right">
                  {isGenerating ? (
                    <button
                      type="button"
                      className="chimucode-composer-stop-btn"
                      onClick={handleStopGeneration}
                      title="Detener generación"
                    >
                      <Square size={12} fill="currentColor" />
                      <span>Detener</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`chimucode-composer-submit ${(input.trim() || attachments.length > 0) ? 'active' : ''}`}
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim() && attachments.length === 0}
                      title="Enviar mensaje (Enter)"
                    >
                      <CornerDownLeft size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DIVISOR ARRASTRABLE (6px) */}
        {showRightPanel && files.length > 0 && (
          <div
            className={`chimucode-resizer-handle ${isResizing ? 'dragging' : ''}`}
            onMouseDown={handleMouseDown}
            title="Arrastra para cambiar el ancho del panel"
          />
        )}

        {/* PANEL DERECHO (Multi-archivo con lista arriba) */}
        {showRightPanel && files.length > 0 && (
          <div
            className="chimucode-right-panel"
            style={{
              flex: `0 0 ${panelWidthPercent}%`,
              maxWidth: `${panelWidthPercent}%`,
            }}
          >
            {/* Header del panel derecho con pestañas de modo */}
            <div className="chimucode-panel-header">
              <div className="chimucode-panel-tabs">
                <button
                  type="button"
                  className={`chimucode-tab-btn ${activeRightTab === 'preview' ? 'active' : ''}`}
                  onClick={() => {
                    if (projectPreviewHtmlFile && !isHtml) {
                      setActivePath(projectPreviewHtmlFile.path);
                    }
                    setActiveRightTab('preview');
                  }}
                >
                  <Eye size={13} />
                  <span>Vista previa</span>
                </button>
                <button
                  type="button"
                  className={`chimucode-tab-btn ${activeRightTab === 'code' ? 'active' : ''}`}
                  onClick={() => setActiveRightTab('code')}
                >
                  <Code size={13} />
                  <span>Código</span>
                </button>
                <button
                  type="button"
                  className={`chimucode-tab-btn ${activeRightTab === 'console' ? 'active' : ''}`}
                  onClick={() => setActiveRightTab('console')}
                >
                  <Terminal size={13} />
                  <span>Consola</span>
                </button>
              </div>

              <div className="chimucode-panel-actions">
                {activeRightTab === 'preview' && hasPreviewableHtml && (
                  <>
                    <button
                      type="button"
                      className="chimucode-panel-icon-btn"
                      onClick={() => setIsMobileMode(!isMobileMode)}
                      title={isMobileMode ? 'Vista escritorio' : 'Vista móvil (375px)'}
                    >
                      {isMobileMode ? <Monitor size={14} /> : <Smartphone size={14} />}
                    </button>
                    <button
                      type="button"
                      className="chimucode-panel-icon-btn"
                      onClick={() => {
                        const blob = new Blob([previewHtml || activeContent], { type: 'text/html;charset=utf-8' });
                        window.open(URL.createObjectURL(blob), '_blank');
                      }}
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="chimucode-panel-icon-btn"
                  onClick={() => {
                    if (activeRightTab === 'console') {
                      handleCopyConsole();
                    } else {
                      handleCopyActiveCode();
                    }
                  }}
                  title={
                    activeRightTab === 'console'
                      ? 'Copiar salida de consola'
                      : 'Copiar código del archivo activo'
                  }
                >
                  {(activeRightTab === 'console' ? copiedConsole : copiedActiveCode) ? (
                    <Check size={14} color="#4ade80" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
                <button
                  type="button"
                  className={`chimucode-panel-icon-btn ${feedbackMsgId === 'panel' ? 'active' : ''}`}
                  onClick={() => {
                    if (feedbackMsgId === 'panel') {
                      setFeedbackMsgId(null);
                    } else {
                      setFeedbackMsgId('panel');
                      setFeedbackReaction(null);
                      setFeedbackSelectedTag(null);
                      setFeedbackComment('');
                      setFeedbackSuccess(false);
                    }
                  }}
                  title="¿Funciona el proyecto? Evaluar o corregir"
                >
                  <HelpCircle size={14} />
                </button>
                <button
                  type="button"
                  className="chimucode-panel-icon-btn"
                  onClick={() => setShowRightPanel(false)}
                  title="Cerrar panel derecho"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Lista de archivos arriba (click cambia el archivo activo) */}
            <div className="chimucode-file-tabs-strip">
              {files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  className={`chimucode-file-tab ${f.path === activePath ? 'active' : ''}`}
                  onClick={() => {
                    setActivePath(f.path);
                    if (f.language === 'html' || f.path.endsWith('.html') || f.path.endsWith('.htm')) {
                      setActiveRightTab('preview');
                    } else {
                      setActiveRightTab('code');
                    }
                  }}
                  title={f.path}
                >
                  <FileCode size={13} style={{ opacity: f.path === activePath ? 1 : 0.6 }} />
                  <span>{f.path}</span>
                </button>
              ))}
            </div>

            {/* Panel de feedback desplegado desde el panel derecho */}
            {feedbackMsgId === 'panel' && renderFeedbackBox('panel')}

            {/* Cuerpo del panel derecho según pestaña activa */}
            <div className="chimucode-panel-body">
              {activeRightTab === 'preview' && (
                hasPreviewableHtml ? (
                  <div className={`chimucode-iframe-container ${isMobileMode ? 'mobile-frame' : ''}`}>
                    <iframe
                      key={previewBlobUrl}
                      src={previewBlobUrl || 'about:blank'}
                      title="ChimuCode Live Preview"
                      sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"
                      className="chimucode-preview-iframe"
                      style={{ pointerEvents: isResizing ? 'none' : 'auto' }}
                    />
                  </div>
                ) : (
                  <div className="chimucode-preview-no-ui">
                    <span>Sin UI</span>
                  </div>
                )
              )}

              {activeRightTab === 'code' && (
                <textarea
                  className="chimucode-code-editor"
                  value={activeContent}
                  wrap="off"
                  onChange={(e) => {
                    const newContent = e.target.value;
                    const updatedFiles = files.map((f) =>
                      f.path === activePath ? { ...f, content: newContent } : f
                    );
                    setFiles(updatedFiles);
                    persistSession(messages, sessionTitle, updatedFiles, activePath, consoleOutput);
                  }}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                />
              )}

              {activeRightTab === 'console' && (
                <div className="chimucode-console-terminal">
                  {consoleOutput ? (
                    <div className="chimucode-console-wrap">
                      <div className="chimucode-console-toolbar">
                        <span className="chimucode-console-title">Salida de consola</span>
                        <button
                          type="button"
                          className="chimucode-card-btn"
                          onClick={handleCopyConsole}
                          title="Copiar salida de consola"
                        >
                          {copiedConsole ? (
                            <Check size={12} color="#4ade80" />
                          ) : (
                            <Copy size={12} />
                          )}
                          <span>{copiedConsole ? 'Copiado' : 'Copiar consola'}</span>
                        </button>
                      </div>
                      <pre className="chimucode-console-output">{consoleOutput}</pre>
                    </div>
                  ) : (
                    <div className="chimucode-console-empty">
                      Sin salida aún. Presiona Ejecutar para correr el código.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. MODAL DE GITHUB ── */}
      {showGitHubModal && (
        <div className="chimucode-modal-overlay" onClick={() => setShowGitHubModal(false)}>
          <div className="chimucode-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="chimucode-modal-header">
              <div className="chimucode-modal-title">
                <GithubIcon size={18} />
                <span>Integración GitHub</span>
              </div>
              <button
                type="button"
                className="chimucode-modal-close"
                onClick={() => setShowGitHubModal(false)}
                title="Cerrar modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs del modal */}
            <div className="chimucode-modal-tabs">
              <button
                type="button"
                className={`chimucode-modal-tab ${gitHubActiveTab === 'status' ? 'active' : ''}`}
                onClick={() => { setGitHubActiveTab('status'); setGitHubFeedback(null); }}
              >
                <ShieldCheck size={14} />
                <span>Cuenta</span>
              </button>
              <button
                type="button"
                className={`chimucode-modal-tab ${gitHubActiveTab === 'repos' ? 'active' : ''}`}
                onClick={() => {
                  setGitHubActiveTab('repos');
                  setGitHubFeedback(null);
                  if (gitHubToken && gitHubRepos.length === 0) handleListRepos();
                }}
                disabled={!gitHubUser}
              >
                <FolderGit2 size={14} />
                <span>Importar</span>
              </button>
              <button
                type="button"
                className={`chimucode-modal-tab ${gitHubActiveTab === 'commit' ? 'active' : ''}`}
                onClick={() => { setGitHubActiveTab('commit'); setGitHubFeedback(null); }}
                disabled={!gitHubUser || files.length === 0}
              >
                <GitCommit size={14} />
                <span>Commit & Push</span>
              </button>
              <button
                type="button"
                className={`chimucode-modal-tab ${gitHubActiveTab === 'pr' ? 'active' : ''}`}
                onClick={() => { setGitHubActiveTab('pr'); setGitHubFeedback(null); }}
                disabled={!gitHubUser}
              >
                <GitPullRequest size={14} />
                <span>Pull Request</span>
              </button>
            </div>

            {/* Feedback / Alert banner */}
            {gitHubFeedback && (
              <div className={`chimucode-modal-alert ${gitHubFeedback.type}`}>
                <span>{gitHubFeedback.message}</span>
                {gitHubFeedback.url && (
                  <a
                    href={gitHubFeedback.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chimucode-modal-alert-link"
                  >
                    Abrir en GitHub <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            {/* Cuerpo del modal según tab */}
            <div className="chimucode-modal-body">
              {/* Tab 1: Estado y Conexión */}
              {gitHubActiveTab === 'status' && (
                <div className="chimucode-github-tab-status">
                  {gitHubUser ? (
                    <div className="chimucode-github-profile">
                      <div className="chimucode-github-profile-card">
                        <img
                          src={gitHubUser.avatar_url}
                          alt={gitHubUser.login}
                          className="chimucode-github-avatar"
                        />
                        <div className="chimucode-github-info">
                          <div className="chimucode-github-user-name">
                            <span>{gitHubUser.name || gitHubUser.login}</span>
                            <span className="chimucode-github-login">@{gitHubUser.login}</span>
                          </div>
                          <div className="chimucode-github-badge-row">
                            <span className="chimucode-github-badge connected">Conectado</span>
                            <span className="chimucode-github-badge-repo">Permisos: repo (Contents, PRs, Issues)</span>
                          </div>
                          <p className="chimucode-github-subtext">
                            {gitHubUser.public_repos} repositorios públicos. Tus commits y ramas se firmarán directamente con tu identidad de GitHub.
                          </p>
                        </div>
                      </div>
                      <div className="chimucode-modal-actions-right">
                        <button
                          type="button"
                          className="chimucode-btn-danger"
                          onClick={handleDisconnectGitHub}
                        >
                          <Trash2 size={13} />
                          <span>Desconectar cuenta</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="chimucode-github-connect-form">
                      <div className="chimucode-github-explainer">
                        <p>
                          Conecta tu cuenta de GitHub mediante un <strong>Personal Access Token</strong> para sincronizar código, importar proyectos y enviar Pull Requests desde ChimuCode.
                        </p>
                        <div className="chimucode-github-scopes-info">
                          <strong>Permisos mínimos solicitados:</strong>
                          <ul>
                            <li><code>repo</code>: Permite leer archivos, crear ramas y enviar Pull Requests.</li>
                          </ul>
                        </div>
                      </div>

                      <div className="chimucode-form-group">
                        <label htmlFor="gh-token-input">Personal Access Token (PAT)</label>
                        <input
                          id="gh-token-input"
                          type="password"
                          className="chimucode-modal-input"
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={gitHubToken}
                          onChange={(e) => setGitHubToken(e.target.value)}
                        />
                        <span className="chimucode-input-hint">
                          Genera un token clásico o fine-grained en GitHub → Settings → Developer Settings → Personal Access Tokens.
                        </span>
                      </div>

                      <button
                        type="button"
                        className="chimucode-btn-primary"
                        onClick={handleConnectGitHub}
                        disabled={!gitHubToken.trim() || gitHubLoading}
                      >
                        {gitHubLoading ? <Loader2 size={14} className="chimucode-spin" /> : <Check size={14} />}
                        <span>{gitHubLoading ? 'Validando token…' : 'Conectar con GitHub'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Importar Repositorio */}
              {gitHubActiveTab === 'repos' && (
                <div className="chimucode-github-tab-repos">
                  <div className="chimucode-repos-header">
                    <span>Selecciona un repositorio para clonar en la sesión virtual:</span>
                    <button
                      type="button"
                      className="chimucode-card-btn"
                      onClick={handleListRepos}
                      disabled={gitHubLoading}
                      title="Refrescar repositorios"
                    >
                      <RefreshCw size={12} className={gitHubLoading ? 'chimucode-spin' : ''} />
                      <span>Actualizar</span>
                    </button>
                  </div>

                  <div className="chimucode-repos-list">
                    {gitHubRepos.length === 0 && !gitHubLoading && (
                      <div className="chimucode-empty-hint">
                        No se encontraron repositorios o presiona Actualizar para cargarlos.
                      </div>
                    )}
                    {gitHubRepos.map((r) => (
                      <div
                        key={r.id}
                        className={`chimucode-repo-item ${gitHubSelectedRepo === r.full_name ? 'selected' : ''}`}
                        onClick={() => {
                          setGitHubSelectedRepo(r.full_name);
                          setGitHubBranch(r.default_branch || 'main');
                          setGitHubPrBase(r.default_branch || 'main');
                        }}
                      >
                        <div className="chimucode-repo-main">
                          <span className="chimucode-repo-name">{r.full_name}</span>
                          {r.private && <span className="chimucode-repo-private">Privado</span>}
                        </div>
                        {r.description && <div className="chimucode-repo-desc">{r.description}</div>}
                        <div className="chimucode-repo-meta">Rama principal: {r.default_branch}</div>
                      </div>
                    ))}
                  </div>

                  {gitHubSelectedRepo && (
                    <div className="chimucode-repo-actions-bottom">
                      <span>Seleccionado: <strong>{gitHubSelectedRepo}</strong></span>
                      <button
                        type="button"
                        className="chimucode-btn-primary"
                        onClick={handleImportRepo}
                        disabled={gitHubLoading}
                      >
                        {gitHubLoading ? <Loader2 size={14} className="chimucode-spin" /> : <Download size={14} />}
                        <span>Importar archivos a ChimuCode</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Commit & Push */}
              {gitHubActiveTab === 'commit' && (
                <div className="chimucode-github-tab-commit">
                  <div className="chimucode-form-group">
                    <label>Repositorio destino (owner/repo)</label>
                    <input
                      type="text"
                      className="chimucode-modal-input"
                      placeholder="usuario/nombre-repositorio"
                      value={gitHubSelectedRepo}
                      onChange={(e) => setGitHubSelectedRepo(e.target.value)}
                    />
                  </div>

                  <div className="chimucode-form-group">
                    <label>Rama (branch)</label>
                    <div className="chimucode-branch-row">
                      <input
                        type="text"
                        className="chimucode-modal-input"
                        placeholder="ej: main o chimucode-patch"
                        value={gitHubCreateNewBranch ? gitHubNewBranch : gitHubBranch}
                        onChange={(e) => {
                          if (gitHubCreateNewBranch) setGitHubNewBranch(e.target.value);
                          else setGitHubBranch(e.target.value);
                        }}
                      />
                      <button
                        type="button"
                        className={`chimucode-card-btn ${gitHubCreateNewBranch ? 'active' : ''}`}
                        onClick={() => setGitHubCreateNewBranch(!gitHubCreateNewBranch)}
                      >
                        <GitBranch size={12} />
                        <span>{gitHubCreateNewBranch ? 'Nueva rama: Sí' : 'Nueva rama'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="chimucode-form-group">
                    <label>Mensaje del Commit</label>
                    <input
                      type="text"
                      className="chimucode-modal-input"
                      placeholder={`Update from ChimuCode: ${sessionTitle}`}
                      value={gitHubCommitMsg}
                      onChange={(e) => setGitHubCommitMsg(e.target.value)}
                    />
                  </div>

                  <div className="chimucode-commit-summary">
                    Se commitearán <strong>{files.length} archivos</strong> del proyecto virtual a GitHub.
                  </div>

                  <button
                    type="button"
                    className="chimucode-btn-primary"
                    onClick={handleCommitAndPush}
                    disabled={!gitHubSelectedRepo.trim() || files.length === 0 || gitHubLoading}
                  >
                    {gitHubLoading ? <Loader2 size={14} className="chimucode-spin" /> : <GitCommit size={14} />}
                    <span>{gitHubLoading ? 'Haciendo Push…' : 'Hacer Commit y Push'}</span>
                  </button>
                </div>
              )}

              {/* Tab 4: Pull Request */}
              {gitHubActiveTab === 'pr' && (
                <div className="chimucode-github-tab-pr">
                  <div className="chimucode-form-group">
                    <label>Repositorio (owner/repo)</label>
                    <input
                      type="text"
                      className="chimucode-modal-input"
                      placeholder="usuario/nombre-repositorio"
                      value={gitHubSelectedRepo}
                      onChange={(e) => setGitHubSelectedRepo(e.target.value)}
                    />
                  </div>

                  <div className="chimucode-branch-compare-row">
                    <div className="chimucode-form-group" style={{ flex: 1 }}>
                      <label>Rama base (destino)</label>
                      <input
                        type="text"
                        className="chimucode-modal-input"
                        placeholder="main"
                        value={gitHubPrBase}
                        onChange={(e) => setGitHubPrBase(e.target.value)}
                      />
                    </div>
                    <div className="chimucode-form-group" style={{ flex: 1 }}>
                      <label>Rama origen (head)</label>
                      <input
                        type="text"
                        className="chimucode-modal-input"
                        placeholder="tu-rama"
                        value={gitHubBranch}
                        onChange={(e) => setGitHubBranch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="chimucode-form-group">
                    <label>Título del Pull Request</label>
                    <input
                      type="text"
                      className="chimucode-modal-input"
                      placeholder={`ChimuCode: ${sessionTitle}`}
                      value={gitHubPrTitle}
                      onChange={(e) => setGitHubPrTitle(e.target.value)}
                    />
                  </div>

                  <div className="chimucode-form-group">
                    <label>Descripción del Pull Request</label>
                    <textarea
                      className="chimucode-modal-textarea"
                      rows={3}
                      placeholder="Describe los cambios y funcionalidades añadidas..."
                      value={gitHubPrBody}
                      onChange={(e) => setGitHubPrBody(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="chimucode-btn-primary"
                    onClick={handleCreatePullRequest}
                    disabled={!gitHubSelectedRepo.trim() || !gitHubBranch.trim() || gitHubLoading}
                  >
                    {gitHubLoading ? <Loader2 size={14} className="chimucode-spin" /> : <GitPullRequest size={14} />}
                    <span>{gitHubLoading ? 'Creando PR…' : 'Crear Pull Request'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
