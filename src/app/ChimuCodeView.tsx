'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, RotateCw, Copy, Check, Terminal,
  Eye, Smartphone, Monitor, ExternalLink,
  Download, Code, X, CornerDownLeft, ChevronDown, Check as CheckIcon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { CHIMUCODE_STARTER_SNIPPETS, detectCodeLanguage } from '../lib/chimucode';
import type { ChimuCodeSession, ChimuCodeMessage } from '../lib/sandbox-types';
import { CLIENT_MODEL_FLASH, CLIENT_MODEL_UNCENSORED } from '../lib/models';

const ALL_MODELS = [
  { id: CLIENT_MODEL_FLASH, shortName: 'Flash' },
  { id: CLIENT_MODEL_UNCENSORED, shortName: 'Sin censura' }
];
const CHIMUCODE_DEFAULT_MODEL = CLIENT_MODEL_FLASH;

interface ChimuCodeViewProps {
  onBackToChat: () => void;
  activeSessionId: string | null;
  onSaveSession: (session: ChimuCodeSession) => void;
  initialSessionData?: ChimuCodeSession;
  model: string;
  setModel: (m: string) => void;
}

export function ChimuCodeView({ onBackToChat, activeSessionId, onSaveSession, initialSessionData, model, setModel }: ChimuCodeViewProps) {
  const [messages, setMessages] = useState<ChimuCodeMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [sessionTitle, setSessionTitle] = useState<string>('Nueva sesión de código');

  const [activeCode, setActiveCode] = useState<string>(CHIMUCODE_STARTER_SNIPPETS[0].code);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'code' | 'console'>('preview');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);

  const [panelWidthPercent, setPanelWidthPercent] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const detectedLang = detectCodeLanguage(activeCode);
  const isHtml = detectedLang === 'html';

  // Sincronizar estado inicial al cambiar sesión
  useEffect(() => {
    if (activeSessionId && initialSessionData) {
      setMessages(initialSessionData.messages || []);
      setSessionTitle(initialSessionData.title || 'Sesión de código');
      setActiveCode(initialSessionData.activeCode || '');
      setConsoleOutput(initialSessionData.consoleOutput || null);
      if (initialSessionData.activeCode) setShowRightPanel(true);
    } else {
      // Reset
      setMessages([]);
      setSessionTitle('Nueva sesión de código');
      setActiveCode(CHIMUCODE_STARTER_SNIPPETS[0].code);
      setConsoleOutput(null);
      setShowRightPanel(false);
    }
  }, [activeSessionId, initialSessionData]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newWidthPercent = ((rect.right - e.clientX) / rect.width) * 100;
    setPanelWidthPercent(Math.min(90, Math.max(10, newWidthPercent)));
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const saveCurrentState = (msgs: ChimuCodeMessage[], title: string, code: string, out: string | null) => {
    const sId = activeSessionId || `code-${Date.now()}`;
    const newSession: ChimuCodeSession = {
      id: sId,
      title: title,
      messages: msgs,
      activeCode: code,
      language: detectCodeLanguage(code),
      consoleOutput: out,
      updatedAt: Date.now()
    };
    onSaveSession(newSession);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || isGenerating) return;

    const userMsg: ChimuCodeMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setIsGenerating(true);

    let newTitle = sessionTitle;
    if (activeSessionId == null && sessionTitle === 'Nueva sesión de código') {
      newTitle = promptText.slice(0, 36);
      setSessionTitle(newTitle);
    }
    
    saveCurrentState(newMsgs, newTitle, activeCode, consoleOutput);

    try {
      const res = await fetch('/api/chimucode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          currentCode: activeCode,
          language: detectedLang,
          model: model || CHIMUCODE_DEFAULT_MODEL
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error en la respuesta del agente');
      }

      const assistantMsg: ChimuCodeMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.rawExplanation || 'Aquí tienes el código:',
        codeSnippet: data.code,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMsgs = [...newMsgs, assistantMsg];
      setMessages(finalMsgs);
      
      let finalCode = activeCode;
      if (data.code) {
        finalCode = data.code;
        setActiveCode(finalCode);
        setShowRightPanel(true);
        setActiveRightTab(data.language === 'html' ? 'preview' : 'console');
      }
      
      saveCurrentState(finalMsgs, newTitle, finalCode, consoleOutput);
      
    } catch (err: any) {
      const errorMsg: ChimuCodeMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error al ejecutar con ChimuCode: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const errMsgs = [...newMsgs, errorMsg];
      setMessages(errMsgs);
      saveCurrentState(errMsgs, newTitle, activeCode, consoleOutput);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunCode = async () => {
    setConsoleOutput(null);
    let newOut = null;
    if (isHtml) {
      setActiveRightTab('preview');
      newOut = 'Aplicación HTML actualizada en el sandbox.';
      setConsoleOutput(newOut);
    } else if (detectedLang === 'javascript') {
      setActiveRightTab('console');
      const res = await executeBrowserJS(activeCode);
      newOut = res.output || res.error || 'Ejecutado sin salida.';
      setConsoleOutput(newOut);
    } else {
      setActiveRightTab('console');
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeCode, language: detectedLang }),
      });
      const data = await res.json();
      newOut = data.output || data.error || 'Ejecutado sin salida.';
      setConsoleOutput(newOut);
    }
    saveCurrentState(messages, sessionTitle, activeCode, newOut);
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

  const currentModelData = ALL_MODELS.find(m => m.id === model) || ALL_MODELS.find(m => m.id === CHIMUCODE_DEFAULT_MODEL);

  return (
    <div className="chimucode-fullscreen-root">
      {/* ── Main Area ── */}
      <div className="chimucode-main-area">
        {/* Top Bar */}
        <div className="chimucode-top-bar">
          <div className="chimucode-top-left">
            <button className="c-btn-secondary" onClick={onBackToChat}>
              Volver al Chat
            </button>
            <div className="c-session-title">
              {sessionTitle}
            </div>
          </div>
          
          <div className="chimucode-top-center">
            <div className="c-model-selector" onClick={() => setShowModelDropdown(!showModelDropdown)}>
              Chimuelo <span className="c-model-highlight">{currentModelData?.shortName || 'Flash'}</span> <ChevronDown size={14} />
            </div>
            {showModelDropdown && (
              <div className="c-model-dropdown">
                {ALL_MODELS.map(m => (
                  <button 
                    key={m.id} 
                    className={`c-model-option ${model === m.id ? 'active' : ''}`}
                    onClick={() => {
                      setModel(m.id);
                      setShowModelDropdown(false);
                    }}
                  >
                    <span>Chimuelo {m.shortName}</span>
                    {model === m.id && <CheckIcon size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="chimucode-top-actions">
            <button className="c-icon-btn" onClick={handleDownload} title="Descargar"><Download size={15} /></button>
            <button className="c-icon-btn" onClick={handleRunCode} title="Ejecutar"><Play size={15} /></button>
            <button className="c-icon-btn" onClick={() => setShowRightPanel(!showRightPanel)} title="Alternar panel"><Code size={15} /></button>
          </div>
        </div>

        <div className="chimucode-content-split" ref={containerRef}>
          {/* Chat Column */}
          <div className="chimucode-chat-column" style={{ width: showRightPanel ? `${100 - panelWidthPercent}%` : '100%' }}>
            
            <div className="chimucode-messages-area">
              {messages.length === 0 ? (
                <div className="chimucode-empty-state">
                  <Terminal size={48} style={{ color: '#444', marginBottom: '16px' }} />
                  <h3>ChimuCode Dev</h3>
                  <p>Describe la aplicación o script que deseas construir.</p>
                </div>
              ) : (
                <div className="chimucode-messages-list">
                  {messages.map((m) => (
                    <div key={m.id} className={`c-message ${m.role}`}>
                      <div className="c-message-bubble">
                        <div className="c-message-content">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                        {m.codeSnippet && (
                          <div className="c-message-code-card">
                            <div className="c-code-info">
                              <Code size={14} /> <span>Código generado</span>
                            </div>
                            <div className="c-code-actions">
                              <button className="c-btn-secondary" onClick={() => {
                                setActiveCode(m.codeSnippet!);
                                setShowRightPanel(true);
                                setActiveRightTab('code');
                              }}>
                                <Code size={13} /> Ver
                              </button>
                              <button className="c-btn-secondary primary" onClick={() => {
                                setActiveCode(m.codeSnippet!);
                                setShowRightPanel(true);
                                setActiveRightTab(detectCodeLanguage(m.codeSnippet!) === 'html' ? 'preview' : 'console');
                                // Give it a tick to set the state before running
                                setTimeout(() => handleRunCode(), 50);
                              }}>
                                <Play size={13} /> Ejecutar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isGenerating && (
                    <div className="c-typing-indicator">
                      <RotateCw size={14} className="animate-spin" /> Escribiendo...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="chimucode-input-area">
              <div className="c-input-box-modern">
                <textarea 
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ej. haz un contador en HTML..."
                  disabled={isGenerating}
                  rows={1}
                />
                <button 
                  className="c-send-btn-modern" 
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isGenerating}
                >
                  <CornerDownLeft size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Resizer */}
          {showRightPanel && (
            <div
              className={`chimucode-resizer-bar ${isResizing ? 'active' : ''}`}
              onMouseDown={handleMouseDown}
            />
          )}

          {/* Right Preview Panel */}
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
                        title="Modo móvil"
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
                        title="Abrir en nueva pestaña"
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
                    onClick={() => setShowRightPanel(false)}
                    title="Cerrar panel"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Content */}
              {activeRightTab === 'preview' && isHtml ? (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#ffffff', justifyContent: isMobileMode ? 'center' : 'flex-start' }}>
                  <iframe
                    srcDoc={activeCode}
                    title="ChimuCode Live Preview"
                    sandbox="allow-scripts allow-modals allow-forms allow-popups"
                    className={`chimucode-live-iframe ${isMobileMode ? 'mobile-view' : ''}`}
                    style={isMobileMode ? { width: '375px', height: '667px', border: '1px solid #ddd', marginTop: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } : {}}
                  />
                </div>
              ) : activeRightTab === 'code' ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0e0e10' }}>
                  <textarea
                    className="chimucode-code-textarea"
                    value={activeCode}
                    onChange={(e) => setActiveCode(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="chimucode-console-view">
                  {consoleOutput ? (
                    <span style={{ color: '#e2e8f0' }}>{consoleOutput}</span>
                  ) : (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                      Sin salida. Presiona Ejecutar para correr el código activo.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
