export type SandboxLanguage = 'javascript' | 'typescript' | 'python';

export type SandboxEngine = 'worker' | 'cloud' | 'agent';

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
