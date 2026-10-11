export type SandboxLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'html'
  | 'css'
  | 'json'
  | 'shell'
  | 'bash'
  | 'sql'
  | 'markdown'
  | 'text'
  | 'yaml'
  | 'rust'
  | 'go'
  | 'cpp'
  | 'java'
  | 'swift';

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

export interface ChimuCodeToolCall {
  name: string;
  status: 'start' | 'done' | 'error';
  input?: string;
  preview?: string;
  error?: string;
}

export interface ChimuCodeAttachment {
  id: string;
  name: string;
  type: 'image' | 'text' | 'file';
  size: number;
  dataUrl?: string;
  textContent?: string;
  content?: string;
}

export interface ChimuCodeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  codeSnippet?: string;
  changedFiles?: ChimuCodeFile[];
  tools?: ChimuCodeToolCall[];
  attachments?: ChimuCodeAttachment[];
  executionResult?: SandboxResult;
  timestamp: string;
}

export interface AgentStageInfo {
  stage: MultiAgentStage;
  label: string;
  details?: string;
}

export interface ChimuCodePageColor {
  hex: string;
  count: number;
}

export interface ChimuCodePageContext {
  url: string;
  title: string;
  text: string;
  colors?: ChimuCodePageColor[];
  background?: string;
  cta?: string;
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
  pageContext?: ChimuCodePageContext | null;
  updatedAt: number;
}
