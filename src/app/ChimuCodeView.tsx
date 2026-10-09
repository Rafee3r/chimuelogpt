'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { detectCodeLanguage, extractCodeFromAiResponse } from '../lib/chimucode';
import type { ChimuCodeSession, ChimuCodeMessage } from '../lib/sandbox-types';
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

  const [activeCode, setActiveCode] = useState<string>('');
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

  // ID persistente de la sesión actual para evitar duplicar entradas
  const currentSessionIdRef = useRef<string | null>(activeSessionId);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  const detectedLang = detectCodeLanguage(activeCode);
  const isHtml = detectedLang === 'html';

  // Sincronizar estado al cambiar de sesión en el sidebar
  useEffect(() => {
    if (activeSessionId !== currentSessionIdRef.current) {
      currentSessionIdRef.current = activeSessionId;
      if (activeSessionId && initialSessionData) {
        setMessages(initialSessionData.messages || []);
        setSessionTitle(initialSessionData.title || 'Sesión de código');
        const code = initialSessionData.activeCode || '';
        setActiveCode(code);
        setConsoleOutput(initialSessionData.consoleOutput || null);
        setShowRightPanel(!!code.trim());
      } else if (!activeSessionId) {
        // Nueva sesión limpia solicitada
        setMessages([]);
        setSessionTitle('Nueva sesión');
        setActiveCode('');
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

  // Auto-scroll al final del chat cuando llegan mensajes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

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
    code: string,
    output: string | null
  ) => {
    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = activeSessionId || `code-${Date.now()}`;
    }
    const sId = currentSessionIdRef.current;
    const sessionObj: ChimuCodeSession = {
      id: sId,
      title: title || 'Sesión de código',
      messages: msgs,
      activeCode: code,
      language: detectCodeLanguage(code),
      consoleOutput: output,
      updatedAt: Date.now(),
    };
    onSaveSession(sessionObj);
  };

  // Enviar mensaje al backend
  const handleSendMessage = async () => {
    const promptText = input.trim();
    if (!promptText || isGenerating) return;

    // Asegurar ID único y estable para la sesión antes del primer envío
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
    setIsGenerating(true);

    let nextTitle = sessionTitle;
    if (sessionTitle === 'Nueva sesión' || !sessionTitle) {
      nextTitle = promptText.length > 32 ? promptText.slice(0, 32) + '…' : promptText;
      setSessionTitle(nextTitle);
    }

    persistSession(nextMsgs, nextTitle, activeCode, consoleOutput);

    try {
      const res = await fetch('/api/chimucode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          currentCode: activeCode,
          language: detectedLang,
          model: model || CLIENT_MODEL_FLASH,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al generar código');
      }

      // Validar si la respuesta contiene código real extraído de fences
      let generatedCode: string | null = null;
      if (data.code && typeof data.code === 'string' && data.code.trim().length > 0) {
        generatedCode = data.code.trim();
      } else if (data.rawExplanation) {
        const extracted = extractCodeFromAiResponse(data.rawExplanation);
        if (extracted.code && extracted.code.trim().length > 0) {
          generatedCode = extracted.code.trim();
        }
      }

      const assistantMsg: ChimuCodeMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.rawExplanation || (generatedCode ? 'Aquí tienes el código solicitado:' : '¿Qué aplicación o script te gustaría programar?'),
        codeSnippet: generatedCode || undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMsgs = [...nextMsgs, assistantMsg];
      setMessages(finalMsgs);

      let finalCode = activeCode;
      if (generatedCode) {
        finalCode = generatedCode;
        setActiveCode(finalCode);
        setShowRightPanel(true);
        const codeLang = data.language || detectCodeLanguage(finalCode);
        if (codeLang === 'html') {
          setActiveRightTab('preview');
        } else {
          setActiveRightTab('code');
        }
      }

      persistSession(finalMsgs, nextTitle, finalCode, consoleOutput);
    } catch (err: any) {
      const errorMsg: ChimuCodeMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error: ${err.message || 'No se pudo generar el código'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const finalMsgs = [...nextMsgs, errorMsg];
      setMessages(finalMsgs);
      persistSession(finalMsgs, nextTitle, activeCode, consoleOutput);
    } finally {
      setIsGenerating(false);
    }
  };

  // Ejecutar código según lenguaje
  const handleRunCode = async (overrideCode?: string) => {
    const codeToRun = overrideCode || activeCode;
    if (!codeToRun || isRunning) return;

    setIsRunning(true);
    const lang = detectCodeLanguage(codeToRun);

    if (lang === 'html') {
      setActiveRightTab('preview');
      setShowRightPanel(true);
      const out = 'Aplicación HTML renderizada en vivo en el sandbox.';
      setConsoleOutput(out);
      persistSession(messages, sessionTitle, codeToRun, out);
      setIsRunning(false);
      return;
    }

    setShowRightPanel(true);
    setActiveRightTab('console');

    if (lang === 'javascript') {
      try {
        const res = await executeBrowserJS(codeToRun);
        const out = res.ok
          ? (res.output || 'Ejecutado con éxito (sin salida por consola).')
          : `Error de ejecución: ${res.error || 'Fallo desconocido'}`;
        setConsoleOutput(out);
        persistSession(messages, sessionTitle, codeToRun, out);
      } catch (e: any) {
        const out = `Error en worker: ${e.message || String(e)}`;
        setConsoleOutput(out);
        persistSession(messages, sessionTitle, codeToRun, out);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // Python u otros van a /api/sandbox
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
      persistSession(messages, sessionTitle, codeToRun, out);
    } catch (e: any) {
      const out = `Error de conexión con sandbox: ${e.message || String(e)}`;
      setConsoleOutput(out);
      persistSession(messages, sessionTitle, codeToRun, out);
    } finally {
      setIsRunning(false);
    }
  };

  // Copiar snippet desde la card del mensaje
  const handleCopySnippet = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(snippet);
    setTimeout(() => setCopiedSnippet(null), 1500);
  };

  // Copiar código activo
  const handleCopyActiveCode = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode);
    setCopiedActiveCode(true);
    setTimeout(() => setCopiedActiveCode(false), 1500);
  };

  // Descargar código activo
  const handleDownload = () => {
    if (!activeCode) return;
    const ext = isHtml ? 'html' : detectedLang === 'python' ? 'py' : 'js';
    const mime = isHtml ? 'text/html' : 'text/plain';
    const blob = new Blob([activeCode], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanTitle = (sessionTitle || 'codigo')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 30);
    a.download = `chimucode_${cleanTitle}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
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
                persistSession(messages, e.target.value, activeCode, consoleOutput);
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
            disabled={!activeCode}
            title="Descargar código como archivo"
          >
            <Download size={14} />
            <span className="chimucode-btn-text">Descargar</span>
          </button>

          {/* Ejecutar */}
          <button
            type="button"
            className="chimucode-btn-action chimucode-btn-run"
            onClick={() => handleRunCode()}
            disabled={!activeCode || isRunning}
            title="Ejecutar código activo"
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
            onClick={() => {
              if (!showRightPanel && !activeCode && messages.length > 0) {
                const lastSnippet = [...messages].reverse().find((m) => m.codeSnippet)?.codeSnippet;
                if (lastSnippet) setActiveCode(lastSnippet);
              }
              setShowRightPanel(!showRightPanel);
            }}
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
            flex: showRightPanel && activeCode ? `0 0 ${100 - panelWidthPercent}%` : '1 1 100%',
            maxWidth: showRightPanel && activeCode ? `${100 - panelWidthPercent}%` : '100%',
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
                      <div className="chimucode-markdown-body">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>

                      {m.codeSnippet && m.codeSnippet.trim().length > 0 && (
                        <div className="chimucode-code-card">
                          <div className="chimucode-code-card-header">
                            <Code size={14} />
                            <span className="chimucode-code-card-lang">
                              {detectCodeLanguage(m.codeSnippet).toUpperCase()}
                            </span>
                          </div>

                          <div className="chimucode-code-card-actions">
                            <button
                              type="button"
                              className="chimucode-card-btn"
                              onClick={() => {
                                setActiveCode(m.codeSnippet!);
                                setShowRightPanel(true);
                                const snippetLang = detectCodeLanguage(m.codeSnippet!);
                                setActiveRightTab(snippetLang === 'html' ? 'preview' : 'code');
                              }}
                            >
                              <Eye size={12} />
                              <span>Vista previa</span>
                            </button>

                            <button
                              type="button"
                              className="chimucode-card-btn"
                              onClick={() => handleCopySnippet(m.codeSnippet!)}
                            >
                              {copiedSnippet === m.codeSnippet ? (
                                <Check size={12} color="#4ade80" />
                              ) : (
                                <Copy size={12} />
                              )}
                              <span>
                                {copiedSnippet === m.codeSnippet ? 'Copiado' : 'Copiar'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isGenerating && (
                  <div className="chimucode-msg chimucode-msg-assistant">
                    <div className="chimucode-msg-bubble chimucode-generating-bubble">
                      <RotateCw size={14} className="chimucode-spin" />
                      <span>ChimuCode generando código...</span>
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
        {showRightPanel && activeCode && (
          <div
            className={`chimucode-resizer-handle ${isResizing ? 'dragging' : ''}`}
            onMouseDown={handleMouseDown}
            title="Arrastra para cambiar el ancho del panel"
          />
        )}

        {/* PANEL DERECHO (42% default, oculto hasta que haya código) */}
        {showRightPanel && activeCode && (
          <div
            className="chimucode-right-panel"
            style={{
              flex: `0 0 ${panelWidthPercent}%`,
              maxWidth: `${panelWidthPercent}%`,
            }}
          >
            {/* Header del panel derecho */}
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
                        const blob = new Blob([activeCode], { type: 'text/html;charset=utf-8' });
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
                  title="Copiar código activo"
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

            {/* Cuerpo del panel derecho según pestaña activa */}
            <div className="chimucode-panel-body">
              {activeRightTab === 'preview' && (
                isHtml ? (
                  <div className={`chimucode-iframe-container ${isMobileMode ? 'mobile-frame' : ''}`}>
                    <iframe
                      srcDoc={activeCode}
                      title="ChimuCode Live Preview"
                      sandbox="allow-scripts allow-modals allow-forms allow-popups"
                      className="chimucode-preview-iframe"
                    />
                  </div>
                ) : (
                  <div className="chimucode-preview-non-html">
                    <p>Este código es {detectedLang.toUpperCase()}.</p>
                    <button
                      type="button"
                      className="chimucode-btn-secondary"
                      onClick={() => handleRunCode()}
                    >
                      <Play size={14} />
                      <span>Ejecutar en consola</span>
                    </button>
                  </div>
                )
              )}

              {activeRightTab === 'code' && (
                <textarea
                  className="chimucode-code-editor"
                  value={activeCode}
                  wrap="off"
                  onChange={(e) => {
                    setActiveCode(e.target.value);
                    persistSession(messages, sessionTitle, e.target.value, consoleOutput);
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
