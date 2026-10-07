'use client';

import React, { useState, useRef } from 'react';
import {
  Play, RotateCw, Trash2, Copy, Check, Terminal, Cpu, Cloud,
  Sparkles, ChevronLeft, Eye, Code, Smartphone, Monitor,
  ExternalLink, Download, Wand2, ShieldCheck, Layers
} from 'lucide-react';
import type { SandboxEngine, SandboxLanguage, SandboxResult, MultiAgentStage } from '../lib/sandbox-types';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { CHIMUCODE_STARTER_SNIPPETS } from '../lib/chimucode';

interface ChimuCodeViewProps {
  onBackToChat: () => void;
}

export function ChimuCodeView({ onBackToChat }: ChimuCodeViewProps) {
  const [engine, setEngine] = useState<SandboxEngine>('preview');
  const [language, setLanguage] = useState<SandboxLanguage>('html');
  const [code, setCode] = useState<string>(CHIMUCODE_STARTER_SNIPPETS[0].code);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Vibe Coding & Multiagente state
  const [vibePrompt, setVibePrompt] = useState<string>('');
  const [agentStage, setAgentStage] = useState<MultiAgentStage>('idle');
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'console'>('preview');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setResult(null);

    try {
      if (language === 'html') {
        setActiveRightTab('preview');
        // El preview se actualiza automáticamente con el estado code
        setResult({
          ok: true,
          output: 'Aplicación web renderizada en vivo en el sandbox.',
          durationMs: 12,
          engine: 'preview',
          language: 'html',
        });
      } else if (engine === 'worker' && language === 'javascript') {
        setActiveRightTab('console');
        const res = await executeBrowserJS(code);
        setResult(res);
      } else {
        setActiveRightTab('console');
        // Ejecución en Cloud Sandbox vía API de Next.js
        const response = await fetch('/api/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language }),
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
        engine,
        language,
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
      // Simulación de pipeline multiagente visual
      const stageTimer1 = setTimeout(() => setAgentStage('developer'), 1200);
      const stageTimer2 = setTimeout(() => setAgentStage('qa'), 3500);

      const res = await fetch('/api/chimucode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: vibePrompt,
          currentCode: code,
          language,
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
      setLanguage(data.language || 'html');
      setEngine(data.language === 'html' ? 'preview' : 'worker');
      setActiveRightTab(data.language === 'html' ? 'preview' : 'console');
      setVibePrompt('');

      setResult({
        ok: true,
        output: data.rawExplanation || 'Aplicación generada con éxito por el equipo multiagente.',
        durationMs: 0,
        engine: data.language === 'html' ? 'preview' : 'worker',
        language: data.language || 'html',
      });
    } catch (err: any) {
      setAgentStage('error');
      setResult({
        ok: false,
        output: '',
        error: err.message || 'Error al generar con ChimuCode',
        durationMs: 0,
        engine,
        language,
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
    const textToCopy = language === 'html' ? code : (result?.output || result?.error || '');
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
      setLanguage(s.language);
      setEngine(s.engine);
      setActiveRightTab(s.language === 'html' ? 'preview' : 'console');
    }
  };

  return (
    <div className="chimucode-container">
      {/* Header superior */}
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
          <span className="chimucode-badge chimucode-badge-agent">Multiagente Codex</span>
        </div>

        <div className="chimucode-controls">
          {/* Selector de Lenguaje */}
          <select
            className="chimucode-select"
            value={language}
            onChange={(e) => {
              const lang = e.target.value as SandboxLanguage;
              setLanguage(lang);
              if (lang === 'html') {
                setEngine('preview');
                setActiveRightTab('preview');
              } else if (lang === 'javascript') {
                setEngine('worker');
                setActiveRightTab('console');
              } else {
                setEngine('cloud');
                setActiveRightTab('console');
              }
            }}
          >
            <option value="html">🌐 HTML / Web App (Canvas & UI)</option>
            <option value="javascript">⚡ JavaScript (Web Worker)</option>
            <option value="python">🐍 Python 3 (Cloud Sandbox)</option>
          </select>

          {/* Selector de Motor */}
          <select
            className="chimucode-select"
            value={engine}
            disabled={language === 'html'}
            onChange={(e) => setEngine(e.target.value as SandboxEngine)}
          >
            <option value="preview">🎨 Live Preview</option>
            <option value="worker">⚡ Web Worker (Browser)</option>
            <option value="cloud">☁️ Cloud Sandbox (API)</option>
          </select>

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

      {/* Barra Vibe Coding: Generación Multiagente */}
      <div className="chimucode-vibe-bar">
        <Wand2 size={18} style={{ color: '#ec4899', alignSelf: 'center' }} />
        <input
          type="text"
          className="chimucode-vibe-input"
          placeholder="Vibe Coding: Describe qué app, juego o función quieres que los agentes construyan..."
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
              <span>Programando...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>Vibe Code</span>
            </>
          )}
        </button>
      </div>

      {/* Stepper de progreso multiagente */}
      {agentStage !== 'idle' && (
        <div className="chimucode-agent-stepper">
          <div className={`chimucode-agent-step ${agentStage === 'architect' ? 'active' : ['developer', 'qa', 'ready'].includes(agentStage) ? 'done' : ''}`}>
            <Layers size={14} />
            <span>1. Arquitecto (UX/UI)</span>
          </div>
          <span>→</span>
          <div className={`chimucode-agent-step ${agentStage === 'developer' ? 'active' : ['qa', 'ready'].includes(agentStage) ? 'done' : ''}`}>
            <Code size={14} />
            <span>2. Codex (Programador)</span>
          </div>
          <span>→</span>
          <div className={`chimucode-agent-step ${agentStage === 'qa' ? 'active' : agentStage === 'ready' ? 'done' : ''}`}>
            <ShieldCheck size={14} />
            <span>3. QA (Auditor Sandbox)</span>
          </div>
        </div>
      )}

      {/* Barra de Plantillas Rápidas Vibe Coding */}
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

      {/* Espacio de trabajo (Editor + Preview/Consola) */}
      <div className="chimucode-workspace">
        {/* Panel del Editor de Código */}
        <div className="chimucode-pane">
          <div className="chimucode-pane-header">
            <span>Editor de Código ({language.toUpperCase()})</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Atajo: ⌘+Enter</span>
          </div>
          <textarea
            className="chimucode-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="// Escribe o genera aquí tu aplicación..."
            spellCheck={false}
          />
        </div>

        {/* Panel Derecho: Vista Previa en Vivo o Consola */}
        <div className="chimucode-pane">
          <div className="chimucode-pane-header">
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

            {/* Acciones de la barra derecha */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {activeRightTab === 'preview' && language === 'html' && (
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

          {/* Renderizado condicional: Iframe Sandbox o Consola */}
          {activeRightTab === 'preview' && language === 'html' ? (
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
                  <span>Ejecutando en el sandbox...</span>
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
