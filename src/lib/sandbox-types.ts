export type SandboxLanguage = 'javascript' | 'typescript' | 'python' | 'html';

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

export interface ChimuCodeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  codeSnippet?: string;
  executionResult?: SandboxResult;
  timestamp: string;
}

export interface AgentStageInfo {
  stage: MultiAgentStage;
  label: string;
  details?: string;
}
