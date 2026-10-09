export type SandboxLanguage = 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'json';

export type SandboxEngine = 'worker' | 'cloud' | 'agent' | 'preview';

export type MultiAgentStage = 'idle' | 'architect' | 'developer' | 'qa' | 'ready' | 'error';

export interface SandboxResult {
  ok: boolean;
  output: string;
  error?: string;
  durationMs: number;
  engine: SandboxEngine;
  language: SandboxLanguage;
}

export interface ChimuCodeFile {
  path: string;
  language: string;
  content: string;
}

export interface ChimuCodeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  codeSnippet?: string;
  changedFiles?: ChimuCodeFile[];
  executionResult?: SandboxResult;
  timestamp: string;
}

export interface AgentStageInfo {
  stage: MultiAgentStage;
  label: string;
  details?: string;
}

export interface ChimuCodeSession {
  id: string;
  title: string;
  messages: ChimuCodeMessage[];
  files: ChimuCodeFile[];
  activePath: string;
  activeCode?: string;
  language?: string;
  consoleOutput?: string | null;
  updatedAt: number;
}
