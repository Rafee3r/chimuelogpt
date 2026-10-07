'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, RotateCw, Trash2, Copy, Check, Terminal,
  ChevronLeft, Eye, Smartphone, Monitor, ExternalLink,
  Download, Wand2, Sparkles, Code, ChevronDown
} from 'lucide-react';
import type { SandboxResult, MultiAgentStage } from '../lib/sandbox-types';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { CHIMUCODE_STARTER_SNIPPETS, detectCodeLanguage } from '../lib/chimucode';

interface ChimuCodeViewProps {
  onBackToChat: () => void;
}

export function ChimuCodeView({ onBackToChat }: ChimuCodeViewProps) {
  const [code, setCode] = useState<string>(CHIMUCODE_STARTER_SNIPPETS[0].code);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showSnippetsMenu, setShowSnippetsMenu] = useState<boolean>(false);

  // Detección automática en caliente del lenguaje
  const detectedLang = detectCodeLanguage(code);
  const isHtml = detectedLang === 'html';

  // Vibe Coding AI Prompt
  const [vibePrompt, setVibePrompt] = useState<string>('');
  const [agentStage, setAgentStage] = useState<MultiAgentStage>('idle');
  const [activeTab, setActiveTab] = useState<'preview' | 'console'>('preview');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);

  // Redimensión horizontal del panel lateral derecho (porcentaje)
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Arrastre horizontal del divisor
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newWidthPercent = ((rect.right - e.clientX) / rect.width) * 100;
    setSplitPercent(Math.min(80, Math.max(20, newWidthPercent)));
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

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setResult(null);

    try {
      if (isHtml) {
        setActiveTab('preview');
        setResult({
          ok: true,
          output: 'Vista previa actualizada en el sandbox.',
          durationMs: 5,
          engine: 'preview',
          language: 'html',
        });
      } else if (detectedLang === 'javascript') {
        setActiveTab('console');
        const res = await executeBrowserJS(code);
        setResult(res);
      } else {
        setActiveTab('console');
        const response = await fetch('/api/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language: detectedLang }),
        });
        const res = await response.json();
        setResult(res);
      }
    } catch (err: any) {
      setResult({
        ok: false,
        output: '',
        error: err?.message || 'Error al conectar con el sandbox',
        durationMs: 0,
        engine: 'worker',
        language: detectedLang,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleVibeGenerate = async () => {
    if (!vibePrompt.trim() || isRunning) return;
    setIsRunning(true);
    setAgentStage('developer');

    try {
      const res = await fetch('/api/chimucode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: vibePrompt,
          currentCode: code,
          language: detectedLang,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Fallo en la generación multiagente');
      }

      setAgentStage('ready');
      setCode(data.code);
      setVibePrompt('');

      const newLang = detectCodeLanguage(data.code);
      setActiveTab(newLang === 'html' ? 'preview' : 'console');
    } catch (err: any) {
      setAgentStage('error');
      alert(`Error al generar código: ${err.message}`);
    } finally {
      setIsRunning(false);
      setTimeout(() => setAgentStage('idle'), 4000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = isHtml ? 'html' : detectedLang === 'python' ? 'py' : 'js';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chimucode-app.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chimucode-fullscreen-root">
      {/* ── Barra Superior Ultra-Limpia (Estilo Claude) ── */}
      <div className="chimucode-top-bar">
        <div className="chimucode-top-left">
          <button className="chimucode-back-link" onClick={onBackToChat}>
            <ChevronLeft size={16} />
            <span>Chat</span>
          </button>
          <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>ChimuCode</span>
          <span className="chimucode-lang-pill">
            {isHtml && '🌐 HTML / App Web'}
            {detectedLang === 'python' && '🐍 Python 3'}
            {detectedLang === 'javascript' && '⚡ JavaScript'}
          </span>
        </div>

        <div className="chimucode-top-right">
          {/* Menú de Plantillas compacto */}
          <div style={{ position: 'relative' }}>
            <button
              className="chimucode-icon-btn"
              style={{ width: 'auto', padding: '0 10px', fontSize: '0.78rem', gap: 4 }}
              onClick={() => setShowSnippetsMenu(!showSnippetsMenu)}
            >
              <span>Ejemplos</span>
              <ChevronDown size={12} />
            </button>
            {showSnippetsMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  background: '#1a1d28',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  padding: 4,
                  minWidth: 200,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 50,
                }}
              >
                {CHIMUCODE_STARTER_SNIPPETS.map((snip) => (
                  <button
                    key={snip.id}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      color: '#cbd5e1',
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      setCode(snip.code);
                      setShowSnippetsMenu(false);
                      setActiveTab(snip.language === 'html' ? 'preview' : 'console');
                    }}
                  >
                    {snip.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="chimucode-icon-btn" onClick={handleCopy} title="Copiar código">
            {copied ? <Check size={14} style={{ color: '#4ade80' }} /> : <Copy size={14} />}
          </button>
          <button className="chimucode-icon-btn" onClick={handleDownload} title="Descargar archivo">
            <Download size={14} />
          </button>
          <button className="chimucode-btn-run" onClick={handleRun} disabled={isRunning}>
            {isRunning ? <RotateCw size={14} className="animate-spin" /> : <Play size={14} />}
            <span>Ejecutar</span>
          </button>
        </div>
      </div>

      {/* ── Área de Trabajo con Resizer Horizontal ── */}
      <div className="chimucode-main-split" ref={containerRef}>
        {/* Editor Izquierdo */}
        <div className="chimucode-editor-side" style={{ width: `${100 - splitPercent}%` }}>
          <textarea
            className="chimucode-code-textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="// Escribe aquí tu código..."
            spellCheck={false}
          />

          {/* Barra Flotante de Vibe Coding al pie del editor */}
          <div className="chimucode-floating-prompt">
            <Wand2 size={16} style={{ color: '#ec4899', flexShrink: 0 }} />
            <input
              type="text"
              className="chimucode-prompt-input"
              placeholder="Vibe Coding: 'Crea una calculadora...', 'Agrega un botón de pausa...', etc."
              value={vibePrompt}
              onChange={(e) => setVibePrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVibeGenerate()}
              disabled={isRunning}
            />
            <button
              className="chimucode-prompt-btn"
              onClick={handleVibeGenerate}
              disabled={isRunning || !vibePrompt.trim()}
            >
              {isRunning ? <RotateCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>Generar</span>
            </button>
          </div>
        </div>

        {/* Divisor Arrastrable (Handle) */}
        <div
          className={`chimucode-resizer-bar ${isResizing ? 'active' : ''}`}
          onMouseDown={handleMouseDown}
          title="Arrastra para cambiar el tamaño del panel lateral"
        />

        {/* Panel Lateral Derecho: Vista Previa y Consola */}
        <div className="chimucode-preview-side" style={{ width: `${splitPercent}%` }}>
          <div className="chimucode-preview-toolbar">
            <div className="chimucode-tab-pill-group">
              <button
                className={`chimucode-tab-pill ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                <Eye size={12} style={{ display: 'inline', marginRight: 4 }} />
                Vista Previa
              </button>
              <button
                className={`chimucode-tab-pill ${activeTab === 'console' ? 'active' : ''}`}
                onClick={() => setActiveTab('console')}
              >
                <Terminal size={12} style={{ display: 'inline', marginRight: 4 }} />
                Consola
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isHtml && activeTab === 'preview' && (
                <>
                  <button
                    className="chimucode-icon-btn"
                    style={{ width: 28, height: 28 }}
                    onClick={() => setIsMobileMode(!isMobileMode)}
                    title={isMobileMode ? 'Vista PC' : 'Vista Móvil'}
                  >
                    {isMobileMode ? <Monitor size={12} /> : <Smartphone size={12} />}
                  </button>
                  <button
                    className="chimucode-icon-btn"
                    style={{ width: 28, height: 28 }}
                    onClick={() => {
                      const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
                      window.open(URL.createObjectURL(blob), '_blank');
                    }}
                    title="Abrir en pestaña nueva"
                  >
                    <ExternalLink size={12} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Contenido: Iframe Sandbox o Consola */}
          {activeTab === 'preview' && isHtml ? (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#0a0b10' }}>
              <iframe
                srcDoc={code}
                title="ChimuCode Preview Sandbox"
                sandbox="allow-scripts allow-modals allow-forms allow-popups"
                className={`chimucode-live-iframe ${isMobileMode ? 'mobile-view' : ''}`}
              />
            </div>
          ) : (
            <div className="chimucode-console-view">
              {result?.output || result?.error || (
                <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                  {isHtml
                    ? 'La app web se está renderizando en la pestaña Vista Previa.'
                    : 'Presiona "Ejecutar" o ⌘+Enter para ver la salida de la consola.'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
