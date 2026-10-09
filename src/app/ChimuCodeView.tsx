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
  RotateCw,
  CornerDownLeft,
  FileCode,
  Globe,
  AlertCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import JSZip from 'jszip';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { detectCodeLanguage } from '../lib/chimucode';
import type { ChimuCodeSession, ChimuCodeMessage, ChimuCodeFile, ChimuCodeToolCall } from '../lib/sandbox-types';
import { CLIENT_MODEL_FLASH, CLIENT_MODEL_UNCENSORED, isUncensoredModel } from '../lib/models';

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
}

export function ChimuCodeView({
  onBackToChat,
  activeSessionId,
  onSaveSession,
  initialSessionData,
  model,
  setModel,
}: ChimuCodeViewProps) {
  const [messages, setMessages] = useState<ChimuCodeMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [sessionTitle, setSessionTitle] = useState<string>('Nueva sesión');

  // Estados de streaming en vivo estilo Claude Code
  const [liveTools, setLiveTools] = useState<ChimuCodeToolCall[]>([]);
  const [liveStatusText, setLiveStatusText] = useState<string>('');
  const [liveExplanation, setLiveExplanation] = useState<string>('');
  const [liveFiles, setLiveFiles] = useState<ChimuCodeFile[]>([]);

  // Proyecto multi-archivo
  const [files, setFiles] = useState<ChimuCodeFile[]>([]);
  const [activePath, setActivePath] = useState<string>('index.html');

  const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'code' | 'console'>('preview');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);

  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [copiedActiveCode, setCopiedActiveCode] = useState<boolean>(false);

  // Split resizer: default 42% for right panel
  const [panelWidthPercent, setPanelWidthPercent] = useState<number>(42);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Model selector dropdown
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // ID persistente de la sesión actual
  const currentSessionIdRef = useRef<string | null>(activeSessionId);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  // Archivo actualmente activo
  const activeFile = useMemo(() => {
    return files.find((f) => f.path === activePath) || files[0] || null;
  }, [files, activePath]);

  const activeContent = activeFile ? activeFile.content : '';
  const detectedLang = activeFile ? activeFile.language : 'html';
  const isHtml = detectedLang === 'html' || activePath.endsWith('.html') || activePath.endsWith('.htm');

  // Sincronizar estado al montar o cambiar de sesión
  useEffect(() => {
    if (activeSessionId !== currentSessionIdRef.current) {
      currentSessionIdRef.current = activeSessionId;
      if (activeSessionId && initialSessionData) {
        setMessages(initialSessionData.messages || []);
        setSessionTitle(initialSessionData.title || 'Sesión de código');

        let sessionFiles: ChimuCodeFile[] = Array.isArray(initialSessionData.files) && initialSessionData.files.length > 0
          ? initialSessionData.files
          : [];

        if (sessionFiles.length === 0 && initialSessionData.activeCode) {
          sessionFiles = [{
            path: 'index.html',
            language: initialSessionData.language || 'html',
            content: initialSessionData.activeCode,
          }];
        }

        setFiles(sessionFiles);
        const resolvedPath = initialSessionData.activePath || (sessionFiles[0]?.path ?? 'index.html');
        setActivePath(resolvedPath);
        setConsoleOutput(initialSessionData.consoleOutput || null);
        setShowRightPanel(sessionFiles.length > 0);
      } else if (!activeSessionId) {
        // Nueva sesión limpia
        setMessages([]);
        setSessionTitle('Nueva sesión');
        setFiles([]);
        setActivePath('index.html');
        setConsoleOutput(null);
        setShowRightPanel(false);
      }
    }
  }, [activeSessionId, initialSessionData]);

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
    output: string | null
  ) => {
    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = activeSessionId || `code-${Date.now()}`;
    }
    const sId = currentSessionIdRef.current;
    const currentActiveFile = currentFiles.find((f) => f.path === currActivePath) || currentFiles[0];
    const sessionObj: ChimuCodeSession = {
      id: sId,
      title: title || 'Sesión de código',
      messages: msgs,
      files: currentFiles,
      activePath: currActivePath,
      activeCode: currentActiveFile?.content || '',
      language: currentActiveFile?.language || 'html',
      consoleOutput: output,
      updatedAt: Date.now(),
    };
    onSaveSession(sessionObj);
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

  // Enviar mensaje al backend y procesar streaming SSE en vivo
  const handleSendMessage = async () => {
    const promptText = input.trim();
    if (!promptText || isGenerating) return;

    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = activeSessionId || `code-${Date.now()}`;
    }

    const userMsg: ChimuCodeMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMsgs = [...messages, userMsg];
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

    persistSession(nextMsgs, nextTitle, files, activePath, consoleOutput);

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
              } else if (accumulatedFiles.length === 1) {
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
        if (nextActive.endsWith('.html') || changedHtml?.language === 'html') {
          setActiveRightTab('preview');
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
      setMessages(finalMsgs);
      persistSession(finalMsgs, nextTitle, updatedFiles, finalActivePath || activePath, consoleOutput);
    } catch (err: any) {
      const errorMsg: ChimuCodeMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error: ${err.message || 'No se pudo generar el código'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const finalMsgs = [...nextMsgs, errorMsg];
      setMessages(finalMsgs);
      persistSession(finalMsgs, nextTitle, files, activePath, consoleOutput);
    } finally {
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
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToRun, language: lang }),
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

  // Copiar contenido
  const handleCopySnippet = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(snippet);
    setTimeout(() => setCopiedSnippet(null), 1500);
  };

  // Copiar código del archivo activo
  const handleCopyActiveCode = () => {
    if (!activeContent) return;
    navigator.clipboard.writeText(activeContent);
    setCopiedActiveCode(true);
    setTimeout(() => setCopiedActiveCode(false), 1500);
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
            {messages.length === 0 ? (
              <div className="chimucode-empty-state">
                Describe la aplicación o script que deseas construir.
              </div>
            ) : (
              <div className="chimucode-messages-list">
                {messages.map((m) => (
                  <div key={m.id} className={`chimucode-msg chimucode-msg-${m.role}`}>
                    <div className="chimucode-msg-bubble">
                      {/* Herramientas ejecutadas en este mensaje estilo Claude Code */}
                      {m.tools && m.tools.length > 0 && (
                        <div className="chimucode-tools-log">
                          {m.tools.map((t, idx) => (
                            <div key={idx} className="chimucode-tool-row">
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
                                const fullCode = m.changedFiles?.map((f) => `/* --- ${f.path} --- */\n` + f.content).join('\n\n') || '';
                                handleCopySnippet(fullCode);
                              }}
                            >
                              {copiedSnippet ? (
                                <Check size={12} color="#4ade80" />
                              ) : (
                                <Copy size={12} />
                              )}
                              <span>{copiedSnippet ? 'Copiado' : 'Copiar'}</span>
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
                            <div key={idx} className="chimucode-tool-row">
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
                  onClick={handleCopyActiveCode}
                  title="Copiar código del archivo activo"
                >
                  {copiedActiveCode ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
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
                      srcDoc={previewHtml}
                      title="ChimuCode Live Preview"
                      sandbox="allow-scripts allow-modals allow-forms allow-popups"
                      className="chimucode-preview-iframe"
                    />
                  </div>
                ) : (
                  <div className="chimucode-preview-non-html">
                    <p>El archivo activo es {activePath} ({detectedLang.toUpperCase()}).</p>
                    <button
                      type="button"
                      className="chimucode-btn-secondary"
                      onClick={() => setActiveRightTab('code')}
                    >
                      <Code size={14} />
                      <span>Ver y editar código</span>
                    </button>
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
                    <pre className="chimucode-console-output">{consoleOutput}</pre>
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
