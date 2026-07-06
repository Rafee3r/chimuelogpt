/* ─────────── Tipos compartidos de Chimuelo ───────────
   Fuente única de verdad para los tipos de datos del chat.
   page.tsx los importa desde aquí. */

export type BaseMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePlaceholder?: string;
  imageData?: string;
  docPlaceholder?: string;
  reasoning?: string;
  model?: string;
  feedback?: 'like' | 'dislike';
  status?: 'pending' | 'sent' | 'delivered' | 'read';
  timestamp?: number;
  images?: { base64?: string; name: string; type?: string }[];
  docs?: { name: string }[];
};

export type Chat = {
  id: string;
  title: string;
  messages: BaseMessage[];
  updatedAt: number;
  systemPrompt?: string;
  subjectId?: string;
  agentId?: string;
  pinned?: boolean;
};

/* Storage mínimo inyectable — permite testear sin browser */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
