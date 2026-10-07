'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, RotateCw, Trash2, Copy, Check, Terminal,
  ChevronLeft, Eye, Smartphone, Monitor, ExternalLink,
  Download, Wand2, Sparkles, Code, ChevronRight, X,
  Folder, GitBranch, CheckSquare, CornerDownLeft, SplitSquareVertical
} from 'lucide-react';
import type { SandboxResult, MultiAgentStage } from '../lib/sandbox-types';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { CHIMUCODE_STARTER_SNIPPETS, detectCodeLanguage, extractCodeFromAiResponse } from '../lib/chimucode';

interface ChimuCodeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  code?: string;
  language?: string;
  timestamp: string;
}

interface ChimuCodeViewProps {
  onBackToChat: () => void;
}

export function ChimuCodeView({ onBackToChat }: ChimuCodeViewProps) {
  const [messages, setMessages] = useState<ChimuCodeMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [sessionTitle, setSessionTitle] = useState<string>('Nueva sesión de código');

  // Código activo en el panel lateral
  const [activeCode, setActiveCode] = useState<string>(CHIMUCODE_STARTER_SNIPPETS[0].code);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'code' | 'console'>('preview');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);

  // Redimensión horizontal del panel lateral derecho (porcentaje)
  const [panelWidthPercent, setPanelWidthPercent] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const detectedLang = detectCodeLanguage(activeCode);
  const isHtml = detectedLang === 'html';

  // Manejo del arrastre del divisor
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newWidthPercent = ((rect.right - e.clientX) / rect.width) * 100;
    setPanelWidthPercent(Math.min(80, Math.max(25, newWidthPercent)));
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Enviar prompt estilo Claude Code
  const handleSendMessage = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || isGenerating) return;

    const userMsg: ChimuCodeMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    if (sessionTitle === 'Nueva sesión de código') {
      setSessionTitle(promptText.slice(0, 36));
    }

    try {
      const res = await fetch('/api/chimucode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          currentCode: activeCode,
          language: detectedLang,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error en la respuesta del agente');
      }

      const assistantMsg: ChimuCodeMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.rawExplanation || 'Aquí tienes la aplicación construida:',
        code: data.code,
        language: data.language || 'html',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (data.code) {
        setActiveCode(data.code);
        setShowRightPanel(true);
        setActiveRightTab(data.language === 'html' ? 'preview' : 'console');
      }
    } catch (err: any) {
      const errorMsg: ChimuCodeMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error al ejecutar con ChimuCode: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunCode = async () => {
    setConsoleOutput(null);
    if (isHtml) {
      setActiveRightTab('preview');
      setConsoleOutput('Aplicación HTML actualizada en el sandbox.');
    } else if (detectedLang === 'javascript') {
      setActiveRightTab('console');
      const res = await executeBrowserJS(activeCode);
      setConsoleOutput(res.output || res.error || 'Ejecutado sin salida.');
    } else {
      setActiveRightTab('console');
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeCode, language: detectedLang }),
      });
      const data = await res.json();
      setConsoleOutput(data.output || data.error || 'Ejecutado sin salida.');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = isHtml ? 'html' : detectedLang === 'python' ? 'py' : 'js';
    const blob = new Blob([activeCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chimucode-app.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chimucode-fullscreen-root">
      {/* ── Cabecera Breadcrumb (Estilo Claude Code) ── */}
      <div className="chimucode-top-bar">
        <div className="chimucode-top-left">
          <button className="chimucode-back-link" onClick={onBackToChat} title="Volver a Chimuelo">
            <ChevronLeft size={16} />
            <span>Chat</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#94a3b8' }}>
            <Folder size={14} style={{ color: '#818cf8' }} />
            <span>chimuelo-code</span>
            <span>/</span>
            <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{sessionTitle}</span>
          </div>
        </div>

        <div className="chimucode-top-right">
          <button
            className="chimucode-icon-btn"
            onClick={() => setShowRightPanel(!showRightPanel)}
            title={showRightPanel ? "Ocultar panel lateral" : "Mostrar panel lateral"}
          >
            <SplitSquareVertical size={15} />
          </button>
          <button
            className="chimucode-btn-run"
            onClick={handleRunCode}
            title="Ejecutar en Sandbox (⌘↵)"
          >
            <Play size={13} />
            <span>Ejecutar</span>
          </button>
        </div>
      </div>

      {/* ── Área Principal Split (Chat + Panel Lateral) ── */}
      <div className="chimucode-main-split" ref={containerRef}>
        {/* Columna Izquierda: El Chat de Claude Code */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            width: showRightPanel ? `${100 - panelWidthPercent}%` : '100%',
            height: '100%',
            background: '#0d0e14',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Mensajes o Mascota Pixelada Vacía */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 ? (
              <div
                style={{
                  margin: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  userSelect: 'none',
                }}
              >
                {/* Mascota Pixel Art (Estilo Claude Code de la captura) */}
                <div
                  style={{
                    width: 72,
                    height: 52,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(9, 1fr)',
                    gridTemplateRows: 'repeat(7, 1fr)',
                    gap: 1.5,
                  }}
                >
                  {/* Matriz del monstruito pixel-art en color coral #e07a5f */}
                  {[
                    0,0,1,0,0,0,1,0,0,
                    1,0,1,1,1,1,1,0,1,
                    1,1,1,1,1,1,1,1,1,
                    1,1,0,1,1,1,0,1,1,
                    1,1,1,1,1,1,1,1,1,
                    0,1,1,1,1,1,1,1,0,
                    0,1,0,1,0,1,0,1,0,
                  ].map((pixel, i) => (
                    <div
                      key={i}
                      style={{
                        backgroundColor: pixel ? '#e07a5f' : 'transparent',
                        borderRadius: 1,
                      }}
                    />
                  ))}
                </div>

                <div style={{ color: '#64748b', fontSize: '0.86rem', textAlign: 'center', maxWidth: 360 }}>
                  ChimuCode está listo. Escribe en lenguaje natural qué aplicación, juego o script deseas crear.
                </div>

                {/* Chips de inicio rápido */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                  <button
                    className="chimucode-snippet-chip"
                    onClick={() => handleSendMessage('Construye un juego arcade Space Dodge en Canvas HTML5')}
                  >
                    🕹️ Space Dodge Arcade
                  </button>
                  <button
                    className="chimucode-snippet-chip"
                    onClick={() => handleSendMessage('Crea una app Pomodoro Timer con diseño Tailwind')}
                  >
                    ⏱️ Pomodoro Timer
                  </button>
                  <button
                    className="chimucode-snippet-chip"
                    onClick={() => handleSendMessage('Escribe un script de estadísticas numéricas en Python')}
                  >
                    🐍 Script de Python
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '92%',
                        background: m.role === 'user' ? '#1f2433' : '#141620',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 14,
                        padding: '12px 16px',
                        color: '#f1f5f9',
                        fontSize: '0.88rem',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>

                      {/* Tarjeta de código si el asistente generó uno */}
                      {m.code && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: '10px 14px',
                            background: '#090a0f',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#a5b4fc' }}>
                            <Code size={15} />
                            <span>Código {m.language?.toUpperCase() || 'APP'} generado</span>
                          </div>
                          <button
                            className="chimucode-btn chimucode-btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                            onClick={() => {
                              setActiveCode(m.code!);
                              setShowRightPanel(true);
                              setActiveRightTab(m.language === 'html' ? 'preview' : 'console');
                            }}
                          >
                            <Eye size={12} />
                            <span>Ver en Panel Lateral</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isGenerating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#a5b4fc', fontSize: '0.85rem' }}>
                    <RotateCw size={14} className="animate-spin" />
                    <span>ChimuCode pensando y escribiendo código...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* ── Barra de Entrada al estilo Claude Code (Pills + Input Pill) ── */}
          <div style={{ padding: '16px 20px', background: '#0d0e14', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {/* Tags contextuales superiores como en la captura */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: '0.75rem', color: '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <Folder size={11} />
                <span>Local</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <Folder size={11} />
                <span>app</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <GitBranch size={11} />
                <span>main</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                <CheckSquare size={11} />
                <span>auto-sandbox</span>
              </div>
            </div>

            {/* Input pill principal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#151722',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                padding: '4px 8px 4px 14px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              }}
            >
              <input
                type="text"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '0.88rem',
                  outline: 'none',
                  padding: '8px 0',
                }}
                placeholder="Escribe tu requerimiento de código..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                disabled={isGenerating}
              />
              <button
                style={{
                  background: input.trim() ? '#4f46e5' : 'rgba(255, 255, 255, 0.06)',
                  color: input.trim() ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: input.trim() ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isGenerating}
              >
                <CornerDownLeft size={15} />
              </button>
            </div>

            {/* Sub-barra footer: auto accept edits y modelo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: '0.74rem', color: '#64748b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Auto-sandbox activo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>ChimuCode 4.6 (Codex)</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Divisor Horizontal Arrastrable (Solo si el panel derecho está abierto) ── */}
        {showRightPanel && (
          <div
            className={`chimucode-resizer-bar ${isResizing ? 'active' : ''}`}
            onMouseDown={handleMouseDown}
            title="Arrastra horizontalmente para ajustar el tamaño del panel lateral"
          />
        )}

        {/* ── Columna Derecha: Panel Lateral de Vista Previa y Código ── */}
        {showRightPanel && (
          <div className="chimucode-preview-side" style={{ width: `${panelWidthPercent}%` }}>
            <div className="chimucode-preview-toolbar">
              <div className="chimucode-tab-pill-group">
                <button
                  className={`chimucode-tab-pill ${activeRightTab === 'preview' ? 'active' : ''}`}
                  onClick={() => setActiveRightTab('preview')}
                >
                  <Eye size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Vista Previa
                </button>
                <button
                  className={`chimucode-tab-pill ${activeRightTab === 'code' ? 'active' : ''}`}
                  onClick={() => setActiveRightTab('code')}
                >
                  <Code size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Código
                </button>
                <button
                  className={`chimucode-tab-pill ${activeRightTab === 'console' ? 'active' : ''}`}
                  onClick={() => setActiveRightTab('console')}
                >
                  <Terminal size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Consola
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {activeRightTab === 'preview' && isHtml && (
                  <>
                    <button
                      className="chimucode-icon-btn"
                      style={{ width: 28, height: 28 }}
                      onClick={() => setIsMobileMode(!isMobileMode)}
                      title={isMobileMode ? 'Vista Escritorio' : 'Vista Móvil'}
                    >
                      {isMobileMode ? <Monitor size={12} /> : <Smartphone size={12} />}
                    </button>
                    <button
                      className="chimucode-icon-btn"
                      style={{ width: 28, height: 28 }}
                      onClick={() => {
                        const blob = new Blob([activeCode], { type: 'text/html;charset=utf-8' });
                        window.open(URL.createObjectURL(blob), '_blank');
                      }}
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </>
                )}
                <button
                  className="chimucode-icon-btn"
                  style={{ width: 28, height: 28 }}
                  onClick={handleCopyCode}
                  title="Copiar código"
                >
                  {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
                </button>
                <button
                  className="chimucode-icon-btn"
                  style={{ width: 28, height: 28 }}
                  onClick={handleDownload}
                  title="Descargar archivo"
                >
                  <Download size={12} />
                </button>
                <button
                  className="chimucode-icon-btn"
                  style={{ width: 28, height: 28 }}
                  onClick={() => setShowRightPanel(false)}
                  title="Cerrar panel lateral"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Contenido según pestaña */}
            {activeRightTab === 'preview' && isHtml ? (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#0a0b10' }}>
                <iframe
                  srcDoc={activeCode}
                  title="ChimuCode Live Preview"
                  sandbox="allow-scripts allow-modals allow-forms allow-popups"
                  className={`chimucode-live-iframe ${isMobileMode ? 'mobile-view' : ''}`}
                />
              </div>
            ) : activeRightTab === 'code' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#090a0f' }}>
                <textarea
                  className="chimucode-code-textarea"
                  value={activeCode}
                  onChange={(e) => setActiveCode(e.target.value)}
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="chimucode-console-view">
                {consoleOutput || (
                  <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                    {isHtml
                      ? 'La app web se está ejecutando en vivo en la pestaña Vista Previa.'
                      : 'Presiona "Ejecutar" en la parte superior para ver la salida de la consola.'}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
