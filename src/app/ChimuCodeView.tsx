'use client';

import React, { useState } from 'react';
import { Play, RotateCw, Trash2, Copy, Check, Terminal, Cpu, Cloud, Sparkles, ChevronLeft } from 'lucide-react';
import type { SandboxEngine, SandboxLanguage, SandboxResult } from '../lib/sandbox-types';
import { executeBrowserJS } from '../lib/sandbox-worker';
import { CHIMUCODE_STARTER_SNIPPETS } from '../lib/chimucode';

interface ChimuCodeViewProps {
  onBackToChat: () => void;
}

export function ChimuCodeView({ onBackToChat }: ChimuCodeViewProps) {
  const [engine, setEngine] = useState<SandboxEngine>('worker');
  const [language, setLanguage] = useState<SandboxLanguage>('javascript');
  const [code, setCode] = useState<string>(CHIMUCODE_STARTER_SNIPPETS[0].code);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setResult(null);

    try {
      if (engine === 'worker' && language === 'javascript') {
        const res = await executeBrowserJS(code);
        setResult(res);
      } else {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  const handleCopyOutput = () => {
    if (!result?.output && !result?.error) return;
    const textToCopy = result.output || result.error || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectSnippet = (snippetId: string) => {
    const s = CHIMUCODE_STARTER_SNIPPETS.find((item) => item.id === snippetId);
    if (s) {
      setCode(s.code);
      setLanguage(s.language);
      setEngine(s.engine);
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
          <span className="chimucode-badge">Sandbox Dev</span>
        </div>

        <div className="chimucode-controls">
          {/* Selector de Motor */}
          <select
            className="chimucode-select"
            value={engine}
            onChange={(e) => {
              const eng = e.target.value as SandboxEngine;
              setEngine(eng);
              if (eng === 'worker') setLanguage('javascript');
            }}
          >
            <option value="worker">⚡ Web Worker (Browser JS)</option>
            <option value="cloud">☁️ Cloud Sandbox (Node / Python)</option>
          </select>

          {/* Selector de Lenguaje */}
          <select
            className="chimucode-select"
            value={language}
            disabled={engine === 'worker'}
            onChange={(e) => setLanguage(e.target.value as SandboxLanguage)}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python 3</option>
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

      {/* Barra de Plantillas Rápidas */}
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

      {/* Espacio de trabajo (Editor + Consola) */}
      <div className="chimucode-workspace">
        {/* Panel del Editor */}
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
            placeholder="// Escribe aquí tu script..."
            spellCheck={false}
          />
        </div>

        {/* Panel de la Consola / Terminal */}
        <div className="chimucode-pane">
          <div className="chimucode-pane-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Salida de Consola</span>
              {result && (
                <span
                  className="chimucode-meta-pill"
                  style={{
                    color: result.ok ? '#4ade80' : '#f87171',
                    background: result.ok ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                  }}
                >
                  {result.ok ? 'EXIT 0' : 'EXIT 1'} · {result.durationMs}ms
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="chimucode-btn chimucode-btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={handleCopyOutput}
                disabled={!result}
                title="Copiar salida"
              >
                {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
              </button>
              <button
                className="chimucode-btn chimucode-btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => setResult(null)}
                disabled={!result}
                title="Limpiar consola"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <div className="chimucode-console">
            {!result && !isRunning && (
              <div className="chimucode-console-empty">
                Presiona "Ejecutar" o ⌘+Enter para correr el código en el sandbox.
              </div>
            )}

            {isRunning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', margin: 'auto' }}>
                <RotateCw size={16} className="animate-spin" />
                <span>Ejecutando en {engine === 'worker' ? 'Web Worker del Navegador' : 'Cloud Sandbox'}...</span>
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
        </div>
      </div>
    </div>
  );
}
