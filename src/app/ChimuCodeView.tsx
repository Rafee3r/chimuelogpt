'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, RotateCw, Trash2, Copy, Check, Terminal,
  ChevronLeft, Eye, Smartphone, Monitor, ExternalLink,
  Download, Wand2, Sparkles, Code, ChevronRight, X,
  Folder, GitBranch, CheckSquare, CornerDownLeft, SplitSquareVertical,
  Bell, List, Plus, Clock, Briefcase, MessageSquare, Building, Sun, Mic
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

  const [activeCode, setActiveCode] = useState<string>(CHIMUCODE_STARTER_SNIPPETS[0].code);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'code' | 'console'>('preview');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);

  const [panelWidthPercent, setPanelWidthPercent] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const detectedLang = detectCodeLanguage(activeCode);
  const isHtml = detectedLang === 'html';

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

  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobileScreen) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#0E0E0E', padding: 20, textAlign: 'center' }}>
        <Terminal size={48} style={{ marginBottom: 16, color: '#A0A0A0' }} />
        <h2 style={{ fontSize: '1.2rem', marginBottom: 8, fontWeight: 600 }}>No disponible en celular</h2>
        <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: 24 }}>El entorno de desarrollo ChimuCode requiere una pantalla grande. Por favor, usa una computadora para acceder a esta función.</p>
        <button onClick={onBackToChat} className="chimucode-btn chimucode-btn-primary">Volver a Chimuelo</button>
      </div>
    );
  }

  return (
    <div className="chimucode-fullscreen-root">
      {/* ── Left Sidebar (Claude Code Style) ── */}
      <div className="chimucode-sidebar">
        <div className="chimucode-sidebar-top">
          <div className="chimucode-window-controls">
            <div className="mac-dot red" onClick={onBackToChat}></div>
            <div className="mac-dot yellow"></div>
            <div className="mac-dot green"></div>
          </div>
          <div className="chimucode-sidebar-actions">
            <button className="c-icon-btn"><Bell size={14} /></button>
            <button className="c-icon-btn"><List size={14} /></button>
            <button className="c-pill-btn active"><Code size={14} /> <span>Code</span></button>
          </div>
          
          <div className="chimucode-menu-list mt-4">
            <button className="c-menu-item" onClick={() => {
              setMessages([]);
              setSessionTitle('Nueva sesión de código');
              setShowRightPanel(false);
            }}>
              <Plus size={15} /> <span>New session</span>
            </button>
            <button className="c-menu-item"><Clock size={15} /> <span>Scheduled</span></button>
            <button className="c-menu-item"><Briefcase size={15} /> <span>Customize</span></button>
          </div>

          <div className="chimucode-menu-section">
            <div className="c-section-title">Pinned</div>
            <button className="c-menu-item active">
              <span className="c-item-dots">•••</span>
              <span className="c-item-text truncate">{sessionTitle}</span>
            </button>
          </div>

          <div className="chimucode-menu-section">
            <div className="c-section-title">Recents</div>
            <button className="c-menu-item">
              <span className="c-item-dots">•••</span>
              <span className="c-item-text truncate">Migrate API client to fetch with retries</span>
            </button>
            <button className="c-menu-item">
              <span className="c-item-dots">•••</span>
              <span className="c-item-text truncate">Fix race condition in upload queue</span>
            </button>
            <button className="c-menu-item">
              <span className="c-item-dots">•••</span>
              <span className="c-item-text truncate">Add keyboard shortcuts to command ...</span>
            </button>
          </div>
        </div>

        <div className="chimucode-sidebar-bottom">
          <button className="c-menu-item">
            <Building size={15} /> <span>Acme Co.</span>
          </button>
          <button className="c-icon-btn"><Sun size={15} /></button>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div className="chimucode-main-area">
        {/* Top Bar */}
        <div className="chimucode-top-bar">
          <div className="chimucode-breadcrumb">
            <Folder size={14} className="text-gray-400" />
            <span className="text-gray-400">acme-web</span>
            <span className="text-gray-600">/</span>
            <span className="text-white font-medium">{sessionTitle}</span>
          </div>
          
          <div className="chimucode-top-actions">
            <button className="c-icon-btn" onClick={handleDownload} title="Download"><Download size={15} /></button>
            <button className="c-icon-btn" onClick={handleRunCode} title="Run"><Play size={15} /></button>
            <button className="c-icon-btn" onClick={() => setShowRightPanel(!showRightPanel)} title="Toggle Preview Panel"><SplitSquareVertical size={15} /></button>
          </div>
        </div>

        <div className="chimucode-content-split" ref={containerRef}>
          {/* Chat / Canvas Area */}
          <div className="chimucode-chat-canvas" style={{ width: showRightPanel ? `${100 - panelWidthPercent}%` : '100%' }}>
            
            <div className="chimucode-messages-area">
              {messages.length === 0 ? (
                <div className="chimucode-empty-state">
                  <div className="chimucode-crab">
                    {[
                      0,0,0,1,1,1,1,1,0,0,0,
                      0,1,1,1,1,1,1,1,1,1,0,
                      1,1,1,1,1,1,1,1,1,1,1,
                      1,1,0,1,1,1,1,1,0,1,1,
                      1,1,1,1,1,1,1,1,1,1,1,
                      0,1,0,1,0,0,0,1,0,1,0,
                      0,1,0,1,0,0,0,1,0,1,0
                    ].map((pixel, i) => (
                      <div
                        key={i}
                        className={pixel ? 'crab-pixel' : 'crab-empty'}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="chimucode-messages-list">
                  {messages.map((m) => (
                    <div key={m.id} className={`c-message ${m.role}`}>
                      <div className="c-message-bubble">
                        <div className="c-message-content">{m.content}</div>
                        {m.code && (
                          <div className="c-message-code-card">
                            <div className="c-code-info">
                              <Code size={14} /> <span>Código {m.language?.toUpperCase() || 'APP'} generado</span>
                            </div>
                            <button className="c-btn-secondary" onClick={() => {
                              setActiveCode(m.code!);
                              setShowRightPanel(true);
                              setActiveRightTab(m.language === 'html' ? 'preview' : 'console');
                            }}>
                              <Eye size={13} /> Vista Previa
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isGenerating && (
                    <div className="c-typing-indicator">
                      <RotateCw size={14} className="animate-spin" /> ChimuCode escribiendo...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="chimucode-input-area">
              <div className="c-context-chips">
                <button className="c-chip"><Monitor size={12} /> Local</button>
                <button className="c-chip"><Folder size={12} /> app</button>
                <button className="c-chip"><GitBranch size={12} /> main</button>
                <button className="c-chip active"><CheckSquare size={12} /> worktree</button>
              </div>

              <div className="c-input-box">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="build the alignment grid demo"
                  disabled={isGenerating}
                />
                <button 
                  className="c-send-btn" 
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isGenerating}
                >
                  <CornerDownLeft size={16} />
                </button>
              </div>

              <div className="c-input-footer">
                <div className="c-auto-accept">
                  <span>Auto accept edits</span>
                  <button className="c-footer-icon"><List size={13} /></button>
                  <button className="c-footer-icon"><Plus size={13} /></button>
                  <button className="c-footer-icon"><Mic size={13} /></button>
                </div>
                <div className="c-model-info">
                  <span>Opus 4.6</span>
                  <div className="c-model-spinner"></div>
                </div>
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
                      >
                        <ExternalLink size={12} />
                      </button>
                    </>
                  )}
                  <button
                    className="chimucode-icon-btn"
                    style={{ width: 28, height: 28 }}
                    onClick={handleCopyCode}
                  >
                    {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
                  </button>
                  <button
                    className="chimucode-icon-btn"
                    style={{ width: 28, height: 28 }}
                    onClick={() => setShowRightPanel(false)}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Content */}
              {activeRightTab === 'preview' && isHtml ? (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#ffffff' }}>
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
    </div>
  );
}
