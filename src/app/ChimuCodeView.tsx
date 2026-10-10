'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Check,
  Download,
  Play,
  PanelRight,
  Eye,
  Code,
  Terminal,
  Copy,
  X,
  ExternalLink,
  Smartphone,
  Monitor,
  Sun,
  Moon,
  RotateCw,
  CornerDownLeft,
  FileCode,
  Globe,
  AlertCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import JSZip from 'jszip';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { stripMarkdown, copyTextToClipboard } from '../lib/chimucode';
import type { ChimuCodeSession, ChimuCodeMessage, ChimuCodeFile, ChimuCodeToolCall, ChimuCodePageContext } from '../lib/sandbox-types';
import { CLIENT_MODEL_FLASH, CLIENT_MODEL_UNCENSORED, isUncensoredModel } from '../lib/models';
import { loadChimuCodeSessions, getLastOpenedChimuSessionId, setLastOpenedChimuSessionId } from '../lib/chat-storage';

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
    if (!mountSession) return 'index.html';
    const sFiles = Array.isArray(mountSession.files) && mountSession.files.length > 0 ? mountSession.files : [];
    return mountSession.activePath || (sFiles[0]?.path ?? 'index.html');
  });

  const [showRightPanel, setShowRightPanel] = useState<boolean>(() => {
    const sFiles = mountSession && Array.isArray(mountSession.files) && mountSession.files.length > 0 ? mountSession.files : [];
    return sFiles.length > 0 || !!mountSession?.activeCode;
  });
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'code' | 'console'>('preview');
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

  // Model selector dropdown
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

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
        const resolvedPath = target.activePath || (sessionFiles[0]?.path ?? 'index.html');
        setActivePath(resolvedPath);
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

  // Listener para mensajes de navegación desde el iframe sandbox
  useEffect(() => {
    function handleIframeMessage(e: MessageEvent) {
      if (e.data && e.data.type === 'CHIMUCODE_NAVIGATE' && typeof e.data.href === 'string') {
        handleNavigateRelative(e.data.href);
      }
    }
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [handleNavigateRelative]);

  // Construir HTML autocontenido para la previsualización del archivo activo
  const previewHtml = useMemo(() => {
    if (!isHtml || !activeFile) return '';
    let html = activeFile.content;

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

    // Inyectar interceptor de clics en enlaces relativos
    const interceptorScript = `
<script id="__chimucode_nav_interceptor__">
(function() {
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
})();
</script>
`;

    if (html.includes('</body>')) {
      return html.replace('</body>', `${interceptorScript}</body>`);
    }
    return html + interceptorScript;
  }, [isHtml, activeFile, files]);

  // Blob URL para recargar limpiamente el iframe en cada cambio de HTML
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');
  const prevBlobUrlRef = useRef<string>('');

  useEffect(() => {
    if (!isHtml || !previewHtml) {
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
  }, [previewHtml, isHtml]);

  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
    };
  }, []);

  // Enviar mensaje al backend y procesar streaming SSE en vivo
  const handleSendMessage = async () => {
    if (isSendingRef.current || isGenerating) return;
    const promptText = input.trim();
    if (!promptText) return;

    isSendingRef.current = true;

    if (!currentSessionIdRef.current) {
      const newId = (activeSessionId && activeSessionId !== 'new') ? activeSessionId : `code-${Date.now()}`;
      currentSessionIdRef.current = newId;
      setCurrentLoadedId(newId);
      setLastOpenedChimuSessionId(newId);
    }

    const userMsg: ChimuCodeMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentClean = cleanMessages(messages);
    // Prevenir duplicación de la burbuja del usuario
    if (
      currentClean.length > 0 &&
      currentClean[currentClean.length - 1].role === 'user' &&
      currentClean[currentClean.length - 1].content.trim() === promptText
    ) {
      isSendingRef.current = false;
      return;
    }

    const nextMsgs = [...currentClean, userMsg];
    setMessages(nextMsgs);
    setInput('');

    // Resetear estados de streaming en vivo
    setLiveTools([]);
    setLiveStatusText('');
    setLiveExplanation('');
    setLiveFiles([]);
    setIsGenerating(true);

    let nextTitle = sessionTitle;
    if (sessionTitle === 'Nueva sesión' || !sessionTitle) {
      nextTitle = promptText.length > 32 ? promptText.slice(0, 32) + '…' : promptText;
      setSessionTitle(nextTitle);
    }

    persistSession(nextMsgs, nextTitle, files, activePath, consoleOutput, pageContext);

    let currentPageContext = pageContext;

    try {
      const res = await fetch('/api/chimucode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          files: files,
          currentCode: activeContent,
          language: detectedLang,
          model: model || CLIENT_MODEL_FLASH,
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
            } else if (event.type === 'file') {
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

              if (fileObj.language === 'html' || fileObj.path.endsWith('.html')) {
                finalActivePath = fileObj.path;
                setActivePath(fileObj.path);
                setShowRightPanel(true);
                setActiveRightTab('preview');
              } else {
                finalActivePath = fileObj.path;
                setActivePath(fileObj.path);
                setShowRightPanel(true);
                setActiveRightTab('code');
              }
            } else if (event.type === 'done') {
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

        const changedHtml = accumulatedFiles.find((f) => f.language === 'html' || f.path.endsWith('.html'));
        const nextActive = finalActivePath || (changedHtml ? changedHtml.path : accumulatedFiles[0].path);
        setActivePath(nextActive);
        setShowRightPanel(true);
        if (nextActive.endsWith('.html') || (changedHtml && nextActive === changedHtml.path)) {
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

  const currentModelData =
    REAL_MODELS.find((m) => m.id === model) ||
    (isUncensoredModel(model) ? REAL_MODELS[1] : REAL_MODELS[0]);

  return (
    <div className="chimucode-root">
      {/* ── 1. TOP BAR EXACTA (48px) ── */}
      <header className="chimucode-topbar">
        <div className="chimucode-topbar-left">
          <button
            type="button"
            className="chimucode-btn-back"
            onClick={onBackToChat}
            title="Volver a la conversación principal"
          >
            <ArrowLeft size={15} />
            <span>Volver al chat</span>
          </button>

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

          {/* Tema (Auto / Claro / Oscuro) */}
          <button
            type="button"
            className="chimucode-btn-action chimucode-theme-btn"
            onClick={() => {
              if (!setTheme) return;
              if (theme === 'system') setTheme('light');
              else if (theme === 'light') setTheme('dark');
              else setTheme('system');
            }}
            title={`Tema: ${theme === 'system' ? 'Auto (Sistema)' : theme === 'light' ? 'Claro' : 'Oscuro'} — Clic para alternar`}
          >
            {theme === 'light' ? (
              <Sun size={14} />
            ) : theme === 'dark' || theme === 'oled' ? (
              <Moon size={14} />
            ) : (
              <Monitor size={14} />
            )}
            <span className="chimucode-btn-text">
              {theme === 'system' ? 'Auto' : theme === 'light' ? 'Claro' : 'Oscuro'}
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
            className={`chimucode-btn-action ${showRightPanel ? 'active' : ''}`}
            onClick={() => setShowRightPanel(!showRightPanel)}
            title="Alternar panel de código y vista previa"
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
            {renderedMessages.length === 0 && !isGenerating ? (
              <div className="chimucode-empty-state">
                Describe lo que deseas construir: scripts de Python, automatizaciones, APIs, análisis de datos o aplicaciones web.
              </div>
            ) : (
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
                                const target = m.changedFiles?.find((f) => f.language === 'html' || f.path.endsWith('.html')) || m.changedFiles?.[0];
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
                          </div>
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

                      {/* Fila de status en vivo (ej. escribiendo index.html) */}
                      {liveStatusText && (
                        <div className="chimucode-live-status-row">
                          <RotateCw size={12} className="chimucode-spin" />
                          <span>{liveStatusText}…</span>
                        </div>
                      )}

                      {/* Texto del asistente que crece con cada delta */}
                      {liveExplanation && (
                        <div className="chimucode-markdown-body">
                          <ReactMarkdown>{liveExplanation}</ReactMarkdown>
                        </div>
                      )}

                      {/* Estado inicial mientras conecta */}
                      {!liveExplanation && !liveStatusText && liveTools.length === 0 && (
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
                                const target = liveFiles.find((f) => f.language === 'html' || f.path.endsWith('.html')) || liveFiles[0];
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
            <form
              className="chimucode-composer-box"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                className="chimucode-composer-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe qué quieres programar..."
                disabled={isGenerating}
                autoFocus
              />
              <button
                type="submit"
                className={`chimucode-composer-submit ${input.trim() && !isGenerating ? 'active' : ''}`}
                disabled={!input.trim() || isGenerating}
                title="Enviar mensaje (Enter)"
              >
                <CornerDownLeft size={16} />
              </button>
            </form>
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
                  onClick={() => setActiveRightTab('preview')}
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
                {activeRightTab === 'preview' && isHtml && (
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
                    if (f.language !== 'html' && !f.path.endsWith('.html') && activeRightTab === 'preview') {
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

            {/* Cuerpo del panel derecho según pestaña activa */}
            <div className="chimucode-panel-body">
              {activeRightTab === 'preview' && (
                isHtml ? (
                  <div className={`chimucode-iframe-container ${isMobileMode ? 'mobile-frame' : ''}`}>
                    <iframe
                      key={previewBlobUrl}
                      src={previewBlobUrl || 'about:blank'}
                      title="ChimuCode Live Preview"
                      sandbox="allow-scripts allow-modals allow-forms allow-popups"
                      className="chimucode-preview-iframe"
                      style={{ pointerEvents: isResizing ? 'none' : 'auto' }}
                    />
                  </div>
                ) : (
                  <div className="chimucode-preview-non-html">
                    <div className="chimucode-script-runner-card">
                      <div className="chimucode-script-badge">
                        <Terminal size={15} />
                        <span>{activePath} ({detectedLang.toUpperCase()})</span>
                      </div>
                      <p className="chimucode-script-desc">
                        {detectedLang === 'python' || activePath.endsWith('.py')
                          ? 'Script de Python listo para ejecutarse en el sandbox backend.'
                          : detectedLang === 'javascript' || activePath.endsWith('.js')
                          ? 'Script de JavaScript listo para ejecutarse en el sandbox.'
                          : detectedLang === 'sql' || activePath.endsWith('.sql')
                          ? 'Esquema y consultas SQL de base de datos.'
                          : detectedLang === 'bash' || activePath.endsWith('.sh')
                          ? 'Script Shell/Bash de automatización de sistema.'
                          : 'Archivo de código y configuración del proyecto.'}
                      </p>

                      <div className="chimucode-script-actions">
                        {(detectedLang === 'python' || detectedLang === 'javascript' || activePath.endsWith('.py') || activePath.endsWith('.js')) && (
                          <button
                            type="button"
                            className="chimucode-btn-run-primary"
                            onClick={() => handleRunCode()}
                            disabled={isRunning}
                          >
                            <Play size={13} fill="currentColor" />
                            <span>{isRunning ? 'Ejecutando en consola…' : 'Ejecutar script en consola'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="chimucode-btn-secondary"
                          onClick={() => setActiveRightTab('code')}
                        >
                          <Code size={13} />
                          <span>Ver y editar código</span>
                        </button>
                      </div>

                      {consoleOutput && (
                        <div
                          className="chimucode-script-output-preview"
                          onClick={() => setActiveRightTab('console')}
                          title="Hacer clic para ir a la consola completa"
                        >
                          <div className="chimucode-script-output-header">
                            <span>Última salida de ejecución:</span>
                            <span className="chimucode-script-output-link">Abrir Consola →</span>
                          </div>
                          <pre>{consoleOutput.slice(0, 320)}{consoleOutput.length > 320 ? '…' : ''}</pre>
                        </div>
                      )}
                    </div>
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
    </div>
  );
}
