'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, RotateCw, Trash2, Copy, Check, Terminal,
  ChevronLeft, Eye, Smartphone, Monitor, ExternalLink,
  Download, Wand2, Sparkles, Layers, Code, ShieldCheck,
  Maximize2, Minimize2
} from 'lucide-react';
import type { SandboxEngine, SandboxLanguage, SandboxResult, MultiAgentStage } from '../lib/sandbox-types';
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
  
  // Detección automática del lenguaje
  const detectedLang = detectCodeLanguage(code);
  const isHtmlApp = detectedLang === 'html';

  // Vibe Coding & Multiagente state
  const [vibePrompt, setVibePrompt] = useState<string>('');
  const [agentStage, setAgentStage] = useState<MultiAgentStage>('idle');
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'console'>('preview');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  
  // Panel lateral derecho controlable horizontalmente (% del ancho)
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Manejador del arrastre horizontal
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newWidthPercent = ((rect.right - e.clientX) / rect.width) * 100;
    // Límites de seguridad entre 20% y 80%
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
      if (isHtmlApp) {
        setActiveRightTab('preview');
        setResult({
          ok: true,
          output: 'App web renderizada en vivo en el sandbox.',
          durationMs: 8,
          engine: 'preview',
          language: 'html',
        });
      } else if (detectedLang === 'javascript') {
        setActiveRightTab('console');
        const res = await executeBrowserJS(code);
        setResult(res);
      } else {
        // Python 3 u otros lenguajes en Cloud Sandbox
        setActiveRightTab('console');
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
    setAgentStage('architect');

    try {
      const stageTimer1 = setTimeout(() => setAgentStage('developer'), 1200);
      const stageTimer2 = setTimeout(() => setAgentStage('qa'), 3500);

      const res = await fetch('/api/chimucode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: vibePrompt,
          currentCode: code,
          language: detectedLang,
        }),
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Fallo en la generación multiagente');
      }

      setAgentStage('ready');
      setCode(data.code);
      setVibePrompt('');

      const newLang = detectCodeLanguage(data.code);
      if (newLang === 'html') {
        setActiveRightTab('preview');
      } else {
        setActiveRightTab('console');
      }

      setResult({
        ok: true,
        output: data.rawExplanation || 'Aplicación generada con éxito por el equipo multiagente.',
        durationMs: 0,
        engine: newLang === 'html' ? 'preview' : 'worker',
        language: newLang,
      });
    } catch (err: any) {
      setAgentStage('error');
      setResult({
        ok: false,
        output: '',
        error: err.message || 'Error al generar con ChimuCode',
        durationMs: 0,
        engine: 'preview',
        language: detectedLang,
      });
    } finally {
      setIsRunning(false);
      setTimeout(() => {
        setAgentStage(prev => (prev === 'ready' || prev === 'error' ? 'idle' : prev));
      }, 5000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  const handleCopyOutput = () => {
    const textToCopy = isHtmlApp && activeRightTab === 'preview' ? code : (result?.output || result?.error || code);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chimucode-app.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleSelectSnippet = (snippetId: string) => {
    const s = CHIMUCODE_STARTER_SNIPPETS.find((item) => item.id === snippetId);
    if (s) {
      setCode(s.code);
      setActiveRightTab(s.language === 'html' ? 'preview' : 'console');
    }
  };

  return (
    <div className="chimucode-container">
      {/* Header Simplificado (Estilo Claude) */}
      <div className="chimucode-header">
        <div className="chimucode-title-group">
          <button
            className="chimucode-btn chimucode-btn-secondary"
            onClick={onBackToChat}
            title="Volver al Chat"
            style={{ padding: '6px 10px' }}
          >
            <ChevronLeft size={16} />
            <span>Chat</span>
          </button>
          <h2>
            <Terminal size={18} style={{ color: '#818cf8' }} />
            ChimuCode
          </h2>
          {/* Badge de detección automática sin selectores innecesarios */}
          <span className="chimucode-badge" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {detectedLang === 'html' && '🌐 HTML / Web App (Live)'}
            {detectedLang === 'python' && '🐍 Python 3 (Cloud)'}
            {detectedLang === 'javascript' && '⚡ JS / TypeScript (Web Worker)'}
          </span>
        </div>

        <div className="chimucode-controls">
          {/* Presets rápidos de ancho para el panel lateral */}
          <div className="preview-width-presets">
            <button
              className={`preview-preset-btn ${splitPercent === 33 ? 'active' : ''}`}
              onClick={() => setSplitPercent(33)}
              title="Panel lateral 33%"
            >
              1/3
            </button>
            <button
              className={`preview-preset-btn ${splitPercent === 50 ? 'active' : ''}`}
              onClick={() => setSplitPercent(50)}
              title="Mitad y mitad (50%)"
            >
              1/2
            </button>
            <button
              className={`preview-preset-btn ${splitPercent === 70 ? 'active' : ''}`}
              onClick={() => setSplitPercent(70)}
              title="Panel lateral 70%"
            >
              2/3
            </button>
          </div>

          {/* Botón Ejecutar */}
          <button
            className="chimucode-btn chimucode-btn-primary"
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
          >
            {isRunning ? (
              <>
                <RotateCw size={14} className="animate-spin" />
                <span>Ejecutando...</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Ejecutar (⌘↵)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barra de Vibe Coding: Prompt directo de IA */}
      <div className="chimucode-vibe-bar">
        <Wand2 size={18} style={{ color: '#ec4899', alignSelf: 'center', flexShrink: 0 }} />
        <input
          type="text"
          className="chimucode-vibe-input"
          placeholder="Vibe Coding: Describe qué app, juego, visualización o función quieres crear..."
          value={vibePrompt}
          onChange={(e) => setVibePrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleVibeGenerate();
          }}
          disabled={isRunning}
        />
        <button
          className="chimucode-btn chimucode-btn-vibe"
          onClick={handleVibeGenerate}
          disabled={isRunning || !vibePrompt.trim()}
        >
          {isRunning ? (
            <>
              <RotateCw size={14} className="animate-spin" />
              <span>Generando...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>Vibe Code</span>
            </>
          )}
        </button>
      </div>

      {/* Stepper de agentes si están activos */}
      {agentStage !== 'idle' && (
        <div className="chimucode-agent-stepper">
          <div className={`chimucode-agent-step ${agentStage === 'architect' ? 'active' : ['developer', 'qa', 'ready'].includes(agentStage) ? 'done' : ''}`}>
            <Layers size={14} />
            <span>1. Arquitecto</span>
          </div>
          <span>→</span>
          <div className={`chimucode-agent-step ${agentStage === 'developer' ? 'active' : ['qa', 'ready'].includes(agentStage) ? 'done' : ''}`}>
            <Code size={14} />
            <span>2. Codex</span>
          </div>
          <span>→</span>
          <div className={`chimucode-agent-step ${agentStage === 'qa' ? 'active' : agentStage === 'ready' ? 'done' : ''}`}>
            <ShieldCheck size={14} />
            <span>3. QA Auditor</span>
          </div>
        </div>
      )}

      {/* Plantillas Rápidas */}
      <div className="chimucode-snippets-bar">
        <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center', marginRight: '4px' }}>
          Plantillas:
        </span>
        {CHIMUCODE_STARTER_SNIPPETS.map((snip) => (
          <button
            key={snip.id}
            className="chimucode-snippet-chip"
            onClick={() => handleSelectSnippet(snip.id)}
            title={snip.description}
          >
            {snip.title}
          </button>
        ))}
      </div>

      {/* Espacio de trabajo con Panel Lateral Derecho Controlable Horizontalmente */}
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flex: 1,
          minHeight: '480px',
          gap: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Panel Izquierdo: Editor de Código */}
        <div
          className="chimucode-pane"
          style={{
            flex: 1,
            width: `${100 - splitPercent}%`,
            borderRadius: 0,
            border: 'none',
          }}
        >
          <div className="chimucode-pane-header">
            <span>Editor de Código</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Atajo: ⌘+Enter</span>
          </div>
          <textarea
            className="chimucode-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="// Escribe o genera aquí tu código..."
            spellCheck={false}
          />
        </div>

        {/* Divisor de redimensión horizontal (Draggable Handle) */}
        <div
          className={`preview-resizer-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleMouseDown}
          title="Arrastra horizontalmente para ajustar el tamaño del panel"
        />

        {/* Panel Lateral Derecho: Vista Previa y Consola */}
        <div
          className="chimucode-pane preview-side-panel"
          style={{
            width: `${splitPercent}%`,
            borderRadius: 0,
            border: 'none',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="preview-side-header">
            <div className="chimucode-tab-switch">
              <button
                className={`chimucode-tab-btn ${activeRightTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveRightTab('preview')}
              >
                <Eye size={12} style={{ display: 'inline', marginRight: 4 }} />
                Vista Previa
              </button>
              <button
                className={`chimucode-tab-btn ${activeRightTab === 'console' ? 'active' : ''}`}
                onClick={() => setActiveRightTab('console')}
              >
                <Terminal size={12} style={{ display: 'inline', marginRight: 4 }} />
                Consola
              </button>
            </div>

            {/* Controles del panel lateral derecho */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {activeRightTab === 'preview' && isHtmlApp && (
                <>
                  <button
                    className="chimucode-btn chimucode-btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => setIsMobileMode(!isMobileMode)}
                    title={isMobileMode ? 'Vista Escritorio' : 'Vista Móvil'}
                  >
                    {isMobileMode ? <Monitor size={12} /> : <Smartphone size={12} />}
                  </button>
                  <button
                    className="chimucode-btn chimucode-btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={handleOpenInNewTab}
                    title="Abrir en pestaña nueva"
                  >
                    <ExternalLink size={12} />
                  </button>
                  <button
                    className="chimucode-btn chimucode-btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={handleDownloadHtml}
                    title="Descargar index.html"
                  >
                    <Download size={12} />
                  </button>
                </>
              )}
              <button
                className="chimucode-btn chimucode-btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={handleCopyOutput}
                title="Copiar código o salida"
              >
                {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
              </button>
              <button
                className="chimucode-btn chimucode-btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => setResult(null)}
                title="Limpiar"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Renderizado en Vivo (Iframe) o Consola */}
          {activeRightTab === 'preview' && isHtmlApp ? (
            <div className={`chimucode-preview-container ${isMobileMode ? 'mobile-mode' : ''}`}>
              <iframe
                ref={iframeRef}
                srcDoc={code}
                title="ChimuCode Live Sandbox"
                sandbox="allow-scripts allow-modals allow-forms allow-popups"
                className="chimucode-preview-iframe"
              />
            </div>
          ) : (
            <div className="chimucode-console">
              {!result && !isRunning && (
                <div className="chimucode-console-empty">
                  Presiona "Ejecutar" o ⌘+Enter para correr el código en el sandbox.
                </div>
              )}

              {isRunning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', margin: 'auto' }}>
                  <RotateCw size={16} className="animate-spin" />
                  <span>Ejecutando en sandbox...</span>
                </div>
              )}

              {result && (
                <>
                  {result.output && (
                    <div className="chimucode-output-entry">
                      {result.output}
                    </div>
                  )}
                  {result.error && (
                    <div className="chimucode-output-error">
                      {result.error}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
