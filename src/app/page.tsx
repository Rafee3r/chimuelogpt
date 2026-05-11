"use client";

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { MessageSquare, Plus, Settings, Send, Paperclip, Menu, X, Cat, XCircle, FileImage, ChevronDown, ChevronLeft, Smartphone, SquarePen, Download, ZoomIn, Book, Star, Search, ThumbsUp, ThumbsDown, RotateCw, Share2, Copy, MoreVertical, GraduationCap, Trash2, LogOut, Brain, Square, Check, Command, Palette, Zap, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─────────── v2.0 Performance: Memoized markdown per message ─────────── */
const MemoizedMarkdown = memo(function MemoizedMarkdown({ content, imgRenderer, codeRenderer }: {
  content: string;
  imgRenderer: any;
  codeRenderer: any;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ img: imgRenderer, code: codeRenderer }}
    >
      {content}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);

/* ─────────── v2.0 Code block with copy button ─────────── */
function CodeBlock({ inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, "");
  if (inline) return <code className={className} {...props}>{children}</code>;
  return (
    <div className="code-block-wrapper">
      <button
        className="code-copy-btn"
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        title="Copiar código"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? "Copiado" : "Copiar"}</span>
      </button>
      <pre><code className={className} {...props}>{children}</code></pre>
    </div>
  );
}
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type BaseMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePlaceholder?: string;
  reasoning?: string;
  model?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: BaseMessage[];
  updatedAt: number;
  systemPrompt?: string;
  subjectId?: string;
};

type Subject = {
  id: string;
  name: string;
  baseMemory: string;
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<"wrong" | "old" | null>(null);
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  const [inputMessage, setInputMessage] = useState("");
  const [attachedImage, setAttachedImage] = useState<{base64: string, name: string, type?: string} | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingTask, setThinkingTask] = useState<"image" | "document" | "code" | "general">("general");
  const [pendingImagePrompt, setPendingImagePrompt] = useState<string | null>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"chat" | "university" | "settings">("chat");
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedUniTask, setSelectedUniTask] = useState<"essay" | "science" | "synthesis" | "socratic" | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectMemory, setNewSubjectMemory] = useState("");
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [artifactModal, setArtifactModal] = useState<string | null>(null);
  
  const [theme, setTheme] = useState<"system" | "light" | "dark" | "pink" | "orange" | "oled" | "snow">("system");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [persona, setPersona] = useState<"default" | "serio" | "cursi" | "chistoso" | "directo" | "amable" | "profesional">("default");
  const [model, setModel] = useState<"deepseek-v4-pro" | "deepseek-v4-flash">("deepseek-v4-flash");
  const [enterToSend, setEnterToSend] = useState<boolean>(true);
  const [bubbleStyle, setBubbleStyle] = useState<"bubbles" | "flat">("bubbles");
  const [messageDensity, setMessageDensity] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [userMemory, setUserMemory] = useState<{id: string; content: string; createdAt: number}[]>([]);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [showVersionModal, setShowVersionModal] = useState<boolean>(false);
  const [versionData, setVersionData] = useState<{version: string; date: string; changes: {icon: string; title: string; desc: string}[]}>({ version: '', date: '', changes: [] });
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [showVersionBanner, setShowVersionBanner] = useState(false);

  type SmartPill = { icon: string; label: string; message: string };
  const defaultPills: SmartPill[] = [
    { icon: '🎨', label: 'Crear Imagen', message: 'Genera una imagen de un paisaje cyberpunk en formato ultra realista' },
    { icon: '✉️', label: 'Redactar Correo', message: 'Escribe un correo formal para solicitar una reunión con un cliente' },
    { icon: '🧠', label: 'Explicar Concepto', message: 'Explícame de forma sencilla cómo funciona la gravedad cuántica' },
    { icon: '💻', label: 'Revisar Código', message: 'Revisa este código y dime cómo optimizarlo' },
  ];
  const [smartPills, setSmartPills] = useState<SmartPill[]>(defaultPills);

  // Manual messages state (replaces useChat)
  const [displayMessages, setDisplayMessages] = useState<BaseMessage[]>([]);

  // v2.0 productivity state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [sidebarSearch, setSidebarSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef<boolean>(false);
  const isTouching = useRef<boolean>(false);
  const isProgrammaticScroll = useRef<boolean>(false);
  const touchEndTime = useRef<number>(0);
  const pendingScrollRaf = useRef<number | null>(null);
  const prevViewMode = useRef<"chat" | "university">("chat");
  const abortControllerRef = useRef<AbortController | null>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const localStorageQueueRef = useRef<{ chats?: Chat[]; timer?: any }>({});

  /* v2.0 — debounced localStorage write (chats only; called from streaming hot path) */
  const queueChatsToLS = useCallback((chats: Chat[]) => {
    localStorageQueueRef.current.chats = chats;
    if (localStorageQueueRef.current.timer) return;
    localStorageQueueRef.current.timer = setTimeout(() => {
      const pending = localStorageQueueRef.current.chats;
      localStorageQueueRef.current.timer = null;
      if (pending) {
        try { localStorage.setItem("chimuelo_chats", JSON.stringify(pending)); } catch {}
      }
    }, 500);
  }, []);

  const flushChatsToLS = useCallback((chats: Chat[]) => {
    if (localStorageQueueRef.current.timer) {
      clearTimeout(localStorageQueueRef.current.timer);
      localStorageQueueRef.current.timer = null;
    }
    try { localStorage.setItem("chimuelo_chats", JSON.stringify(chats)); } catch {}
  }, []);

  /* v2.0 — Stop generation */
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const groupChatsByDate = (chats: Chat[]) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      hoy:    chats.filter(c => c.updatedAt >= today.getTime()),
      ayer:   chats.filter(c => c.updatedAt >= yesterday.getTime() && c.updatedAt < today.getTime()),
      semana: chats.filter(c => c.updatedAt >= weekAgo.getTime() && c.updatedAt < yesterday.getTime()),
      antes:  chats.filter(c => c.updatedAt < weekAgo.getTime()),
    };
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem("chimuelo_auth");
    if (savedAuth === "true") setIsAuthenticated(true);

    const savedChats = localStorage.getItem("chimuelo_chats");
    if (savedChats) setChats(JSON.parse(savedChats));

    const savedTheme = localStorage.getItem("chimuelo_theme") as "system" | "light" | "dark" | "pink" | "orange" | "oled" | "snow";
    if (savedTheme) setTheme(savedTheme);

    const savedFontSize = localStorage.getItem("chimuelo_fontSize") as "small" | "medium" | "large";
    if (savedFontSize) setFontSize(savedFontSize);

    const savedPersona = localStorage.getItem("chimuelo_persona") as "default" | "serio" | "cursi" | "chistoso" | "directo" | "amable" | "profesional";
    if (savedPersona) setPersona(savedPersona);

    // Auto-wipe old bugged instructions from localStorage
    localStorage.removeItem("chimuelo_customInstructions");
    localStorage.removeItem("chimuelo_custom_instructions");

    const savedModel = localStorage.getItem("chimuelo_model") as "deepseek-v4-pro" | "deepseek-v4-flash";
    if (savedModel) setModel(savedModel);

    const savedEnterToSend = localStorage.getItem("chimuelo_enterToSend");
    if (savedEnterToSend !== null) setEnterToSend(savedEnterToSend === "true");

    const savedBubbleStyle = localStorage.getItem("chimuelo_bubbleStyle") as "bubbles" | "flat";
    if (savedBubbleStyle) setBubbleStyle(savedBubbleStyle);

    const savedDensity = localStorage.getItem("chimuelo_density") as "compact" | "comfortable" | "spacious";
    if (savedDensity) setMessageDensity(savedDensity);

    try {
      const savedMemory = localStorage.getItem("chimuelo_memory");
      if (savedMemory) {
        const parsed = JSON.parse(savedMemory);
        if (Array.isArray(parsed)) {
          // Migrate old string[] format to {id, content, createdAt}[]
          const normalized = parsed.map((m: any, i: number) =>
            typeof m === 'string'
              ? { id: `m_${i}`, content: m, createdAt: Date.now() }
              : m
          ).filter((m: any) => m && typeof m.content === 'string');
          setUserMemory(normalized);
          localStorage.setItem("chimuelo_memory", JSON.stringify(normalized));
        }
      }
    } catch {
      localStorage.removeItem("chimuelo_memory");
    }

    const savedMemoryEnabled = localStorage.getItem("chimuelo_memoryEnabled");
    if (savedMemoryEnabled !== null) setMemoryEnabled(savedMemoryEnabled === "true");

    const savedSubjects = localStorage.getItem("chimuelo_subjects");
    if (savedSubjects) setSubjects(JSON.parse(savedSubjects));
    
    const savedActiveSubject = localStorage.getItem("chimuelo_active_subject");
    if (savedActiveSubject) setActiveSubjectId(savedActiveSubject);

    const currentChat = localStorage.getItem("chimuelo_current_chat");
    if (currentChat) {
      setCurrentChatId(currentChat);
      if (savedChats) {
        const parsed = JSON.parse(savedChats);
        const active = parsed.find((c: Chat) => c.id === currentChat);
        if (active) {
          setDisplayMessages(active.messages);
        }
      }
    }

    const checkVersion = async () => {
      try {
        const res = await fetch("/version.json");
        if (res.ok) {
          const data = await res.json();
          const storedVersion = localStorage.getItem("chimuelo_version") || "1.0.0";
          if (data.version && data.version !== storedVersion) {
            setAppVersion(data.version);
            setVersionData(data);
            setShowVersionModal(true);
            localStorage.setItem("chimuelo_version", data.version);
          }
        }
      } catch (e) {
        console.error("Failed to check version", e);
      }
    };
    checkVersion();

    // Background suggestions — once per session
    if (!sessionStorage.getItem('chimuelo_suggestions_fetched')) {
      sessionStorage.setItem('chimuelo_suggestions_fetched', '1');
      setTimeout(() => {
        try {
          const savedChats = localStorage.getItem('chimuelo_chats');
          const chats: Chat[] = savedChats ? JSON.parse(savedChats) : [];
          const recentChats = chats.slice(-6).map((c: Chat) => c.title).filter(Boolean);
          const savedMem = localStorage.getItem('chimuelo_memory');
          const mem = savedMem ? JSON.parse(savedMem) : [];
          const memoryFacts = Array.isArray(mem) ? mem.map((m: any) => (typeof m === 'string' ? m : m.content)).filter(Boolean) : [];
          const savedPersona = localStorage.getItem('chimuelo_persona') || 'default';
          fetch('/api/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recentChats, memoryFacts, hour: new Date().getHours(), persona: savedPersona }),
          }).then(r => r.json()).then(({ suggestions }) => {
            if (suggestions?.length === 4) setSmartPills(suggestions);
          }).catch(() => {});
        } catch {}
      }, 2000);
    }
  }, []);

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem("chimuelo_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("chimuelo_fontSize", fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("chimuelo_persona", persona);
  }, [persona]);

  // v2.0 — Programmatic scroll helper: coalesces multiple calls per frame
  // and marks the scroll as ours so handleScroll ignores it. Critical during
  // token streaming where naive scrolling = visible "creep down" animation.
  const scrollToBottom = useCallback(() => {
    if (pendingScrollRaf.current != null) return; // already queued for this frame
    pendingScrollRaf.current = requestAnimationFrame(() => {
      pendingScrollRaf.current = null;
      if (!messagesEndRef.current) return;
      isProgrammaticScroll.current = true;
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { isProgrammaticScroll.current = false; });
      });
    });
  }, []);

  // Smart auto-scroll
  useEffect(() => {
    if (!userScrolledUp.current) scrollToBottom();
  }, [displayMessages, isThinking, scrollToBottom]);

  // Scroll intent detection
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;

    // Wheel up = explicit user intent to scroll up
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) userScrolledUp.current = true;
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      isTouching.current = true;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0].clientY > touchStartY + 8) userScrolledUp.current = true;
    };
    const handleTouchEnd = () => {
      isTouching.current = false;
      touchEndTime.current = Date.now();
    };

    // Only re-enable auto-scroll when user manually lands AT the bottom — and only
    // for HUMAN scroll events (not our programmatic scrolls, not iOS momentum).
    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;
      if (isTouching.current) return;
      // iOS momentum can fire scroll events for ~300ms after touchend.
      if (Date.now() - touchEndTime.current < 350) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom < 8) userScrolledUp.current = false;
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Reset scroll lock when switching chats
  useEffect(() => {
    userScrolledUp.current = false;
    setTimeout(() => scrollToBottom(), 50);
  }, [currentChatId, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const val = passwordInput.toLowerCase().trim();
    if (val === "chimuelo26") {
      setIsAuthenticated(true);
      localStorage.setItem("chimuelo_auth", "true");
      setAuthError(null);
    } else if (val === "chimuelo") {
      setAuthError("old");
    } else {
      setAuthError("wrong");
    }
  };

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "Nuevo Chat",
      messages: [],
      updatedAt: Date.now()
    };
    setChats(prev => {
      const updated = [newChat, ...prev];
      localStorage.setItem("chimuelo_chats", JSON.stringify(updated));
      return updated;
    });
    setCurrentChatId(newChat.id);
    localStorage.setItem("chimuelo_current_chat", newChat.id);
    setDisplayMessages([]);
    setSidebarOpen(false);
    setViewMode("chat");
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Compress to 0.7 quality to significantly reduce size
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const originalBase64 = reader.result as string;
      let finalBase64 = originalBase64;
      
      if (file.type.startsWith('image/')) {
        finalBase64 = await compressImage(originalBase64);
      }
      
      setAttachedImage({
        base64: finalBase64,
        name: file.name,
        type: file.type
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateSubject = () => {
    if (!newSubjectName.trim()) return;
    const newSubject: Subject = {
      id: Date.now().toString(),
      name: newSubjectName,
      baseMemory: newSubjectMemory
    };
    const updated = [...subjects, newSubject];
    setSubjects(updated);
    localStorage.setItem("chimuelo_subjects", JSON.stringify(updated));
    setActiveSubjectId(newSubject.id);
    localStorage.setItem("chimuelo_active_subject", newSubject.id);
    setNewSubjectName("");
    setNewSubjectMemory("");
    setIsCreatingSubject(false);
  };

  const handleDeleteSubject = (id: string) => {
    const updated = subjects.filter(s => s.id !== id);
    setSubjects(updated);
    localStorage.setItem("chimuelo_subjects", JSON.stringify(updated));
    if (activeSubjectId === id) {
      setActiveSubjectId(null);
      localStorage.removeItem("chimuelo_active_subject");
    }
  };

  const openConfigModal = (type: "essay" | "science" | "synthesis" | "socratic") => {
    setSelectedUniTask(type);
    setConfigModalOpen(true);
  };

  const launchUniversityTask = (subType: string) => {
    let systemPrompt = "";
    let firstMessage = "";
    let title = "";

    if (selectedUniTask === "essay") {
      title = "Editor: " + subType;
      systemPrompt = `Eres un Editor Académico experto nivel PhD. Tu objetivo es revisar textos bajo el formato ${subType}. Corrige ortografía, gramática, y estructura argumentativa. Explica QUÉ cambiaste y POR QUÉ lo cambiaste para que el estudiante aprenda. NO escribas el ensayo desde cero.`;
      firstMessage = `¡Hola! He activado el Revisor de Ensayos para formato **${subType}**. Por favor, pega aquí el texto o párrafo que quieres que revise.`;
    } else if (selectedUniTask === "science") {
      title = "Tutor: " + subType;
      systemPrompt = `Eres un Tutor de Ciencias especializado en ${subType} de la Universidad de Harvard. Tu enfoque es didáctico. NO des solo la respuesta final. DEBES desglosar el razonamiento en pasos lógicos, usar fórmulas claras, explicar las leyes subyacentes y asegurarte de que el estudiante comprenda el mecanismo de resolución.`;
      firstMessage = `¡Hola! Soy tu Tutor de **${subType}**. Sube una foto del problema o escríbelo aquí, y lo resolveremos paso a paso.`;
    } else if (selectedUniTask === "synthesis") {
      title = "Analista: " + subType;
      systemPrompt = `Eres un Investigador Académico experto en Análisis Crítico. Tu objetivo es ayudar al usuario a sintetizar textos complejos. Extrae la tesis central, los argumentos principales y las conclusiones. Si el usuario pide ${subType}, asegúrate de que el formato de salida se enfoque en eso (ej. Markdown estructurado).`;
      firstMessage = `¡Hola! Listo para realizar una **${subType}**. Sube fotos de tus apuntes o pega el texto.`;
    } else if (selectedUniTask === "socratic") {
      title = "Socrático: " + subType;
      systemPrompt = `Eres un Profesor Socrático experto. Tu objetivo es preparar al estudiante para un examen ${subType}. NO des respuestas directas. Pide al estudiante que defina el tema de estudio, y luego hazle preguntas progresivamente más difíciles. Corrige amablemente si se equivoca, y llévalo a deducir las respuestas por sí mismo.`;
      firstMessage = `¡Hola! Vamos a prepararte para tu examen **${subType}**. ¿Qué tema específico vas a estudiar hoy?`;
    }

    const newChatId = Date.now().toString();
    const newChat: Chat = {
      id: newChatId,
      title: title,
      messages: [
        {
          id: Date.now().toString() + "_sys",
          role: "assistant",
          content: firstMessage
        }
      ],
      updatedAt: Date.now(),
      systemPrompt: systemPrompt,
      subjectId: activeSubjectId || undefined
    };
    
    setChats(prev => {
      const updated = [newChat, ...prev];
      localStorage.setItem("chimuelo_chats", JSON.stringify(updated));
      return updated;
    });
    setCurrentChatId(newChatId);
    localStorage.setItem("chimuelo_current_chat", newChatId);
    setDisplayMessages(newChat.messages);
    setViewMode("chat");
    setSidebarOpen(false);
    setConfigModalOpen(false);
  };

  const handleSendMessage = async (customMessage?: string) => {
    const msgToSend = customMessage || inputMessage;
    if (!msgToSend.trim() && !attachedImage) return;

    const messageText = msgToSend.trim();
    const imagePayload = attachedImage ? attachedImage.base64 : null;
    const imageName = attachedImage ? attachedImage.name : null;
    
    const lower = messageText.toLowerCase();
    if (lower.includes('imagen') || lower.includes('dibuja') || lower.includes('foto') || lower.includes('pint')) {
      setThinkingTask("image");
    } else if (lower.includes('pdf') || lower.includes('documento') || lower.includes('informe') || lower.includes('invita') || lower.includes('ensayo') || lower.includes('plantilla')) {
      setThinkingTask("document");
    } else if (lower.includes('codigo') || lower.includes('código') || lower.includes('programa') || lower.includes('script') || lower.includes('html')) {
      setThinkingTask("code");
    } else {
      setThinkingTask("general");
    }

    let targetChatId = currentChatId;
    if (!targetChatId) {
      const newChatId = Date.now().toString();
      targetChatId = newChatId;
      setCurrentChatId(newChatId);
      localStorage.setItem("chimuelo_current_chat", newChatId);
      
      setChats(prev => {
        const newChat: Chat = {
          id: newChatId,
          title: messageText ? messageText.slice(0, 30) : (imageName || "Nuevo Chat"),
          messages: [],
          updatedAt: Date.now()
        };
        return [newChat, ...prev];
      });
    }

    const userMsgId = Date.now().toString();
    const userMsg: BaseMessage = { 
      id: userMsgId, 
      role: "user", 
      content: messageText,
      ...(imageName ? { imagePlaceholder: imageName } : {})
    };

    setChats(prev => {
      const updated = [...prev];
      const chatIndex = updated.findIndex(c => c.id === targetChatId);
      if (chatIndex !== -1) {
        updated[chatIndex] = {
          ...updated[chatIndex],
          messages: [...updated[chatIndex].messages, userMsg],
          updatedAt: Date.now(),
          title: updated[chatIndex].messages.length === 0 ? (messageText ? messageText.slice(0, 30) : "Imagen adjunta") : updated[chatIndex].title
        };
      }
      localStorage.setItem("chimuelo_chats", JSON.stringify(updated));
      return updated;
    });

    setInputMessage("");
    setAttachedImage(null);
    userScrolledUp.current = false;
    setIsThinking(true);

    // Add user message to display immediately
    setDisplayMessages(prev => [...prev, userMsg]);

    // v2.0 — fresh AbortController for this stream
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let finalContent = messageText || 'Describe esta imagen.';

      // Build messages history for the API
      const chatForApi = chats.find(c => c.id === targetChatId);
      const historyMsgs = (chatForApi?.messages || [])
        .filter(m => m.role && m.content)
        .map(m => ({ role: m.role, content: m.content }));
      historyMsgs.push({ role: 'user' as const, content: finalContent });

      let finalSystemPrompt = "";
      if (chatForApi) {
        if (chatForApi.systemPrompt) finalSystemPrompt = chatForApi.systemPrompt;
        if (chatForApi.subjectId) {
          const subject = subjects.find(s => s.id === chatForApi.subjectId);
          if (subject && subject.baseMemory) {
            finalSystemPrompt += `\n\n[SISTEMA DE MEMORIA ACTIVO]\nESTÁS EN EL CONTEXTO DE LA MATERIA: "${subject.name}".\nSyllabus o apuntes base obligatorios de esta clase:\n${subject.baseMemory}\n[FIN DE MEMORIA. Todo lo que respondas debe tener en cuenta este contexto estrictamente.]`;
          }
        }
      }
      // Inject persistent user memory
      if (memoryEnabled && userMemory.length > 0) {
        finalSystemPrompt += `\n\n[MEMORIA PERSISTENTE DEL USUARIO — PRIORIDAD ALTA]\nConoces estos datos del usuario de conversaciones anteriores. Úsalos para personalizar tus respuestas sin que te lo repita:\n${userMemory.map(m => `• ${m.content}`).join('\n')}\n[FIN DE MEMORIA PERSISTENTE]`;
      }

      let res: Response;
      if (imagePayload) {
        // Use Claude Haiku vision endpoint
        res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyMsgs, imageBase64: imagePayload, persona, customInstructions: finalSystemPrompt }),
          signal: controller.signal,
        });
      } else {
        // Use DeepSeek text endpoint
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyMsgs, model, persona, customInstructions: finalSystemPrompt }),
          signal: controller.signal,
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Error desconocido del servidor' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      // Stream the response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const assistantId = (Date.now() + 1).toString();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Update the assistant message in real-time (hide reasoning + image tags during stream)
        const streamReasoning = fullText.match(/<think>([\s\S]*?)(<\/think>|$)/)?.[1];
        let streamContent = fullText.replace(/<think>[\s\S]*?(<\/think>|$)/, '').trim();
        // Hide generate_image tags during streaming
        if (streamContent.includes('<generate_image')) {
          streamContent = streamContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/i, '🎨 Generando tu imagen...').trim();
        }
        const streamingMsg: BaseMessage = { id: assistantId, role: 'assistant', content: streamContent || (streamReasoning ? '' : ''), reasoning: streamReasoning || undefined, model };
        setDisplayMessages(prev => {
          const existing = prev.findIndex(m => m.id === assistantId);
          if (existing !== -1) {
            const updated = [...prev];
            updated[existing] = streamingMsg;
            return updated;
          }
          return [...prev, streamingMsg];
        });
      }

      // Extract reasoning FIRST to avoid replacing tags inside the think block
      const reasoningMatch = fullText.match(/<think>([\s\S]*?)<\/think>/);
      const reasoning = reasoningMatch ? reasoningMatch[1] : undefined;
      let cleanContent = fullText.replace(/<think>[\s\S]*?<\/think>/, '').trim();

      // Post-process: intercept image generation tags on the clean content
      if (cleanContent.includes('<generate_image')) {
        const promptMatch = cleanContent.match(/<generate_image(?:[^>]*)>([\s\S]*?)(?:<\/generate_image>|$)/i);
        const modeMatch = cleanContent.match(/<generate_image[^>]*mode=["']([^"']+)["'][^>]*>/i);
        const isText2Img = modeMatch ? modeMatch[1] === 'text2img' : false;
        
        if (promptMatch && promptMatch[1]) {
          const imagePrompt = promptMatch[1].trim();
          // Update UI to show generating state
          setDisplayMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: cleanContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/ig, '🎨 Generando tu imagen...') } : m));
          try {
            // If user attached an image AND it's not a dramatic text2img structural change, use img2img
            const imgBody: any = { prompt: imagePrompt };
            if (imagePayload && !isText2Img) {
              imgBody.imageBase64 = imagePayload;
            }
            const imgRes = await fetch('/api/image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(imgBody)
            });
            if (imgRes.ok) {
              const imgData = await imgRes.json();
              cleanContent = cleanContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/ig, `\n\n![Imagen Generada](${imgData.url})\n\n`);
            } else {
              cleanContent = cleanContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/ig, '\n\n*(Error al generar la imagen)*\n\n');
            }
          } catch {
            cleanContent = cleanContent.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/ig, '\n\n*(Error de red al generar imagen)*\n\n');
          }
        }
      }

      // Only keep reasoning if the model that generated this message supports it
      const finalReasoning = model === 'deepseek-v4-pro' ? reasoning : undefined;
      const finalAssistantMsg: BaseMessage = { id: assistantId, role: 'assistant', content: cleanContent, reasoning: finalReasoning, model };

      // Update display
      setDisplayMessages(prev => prev.map(m => m.id === assistantId ? finalAssistantMsg : m));

      // Save to chats/localStorage
      setChats(prev => {
        const updated = prev.map(chat => {
          if (chat.id === targetChatId) {
            return { ...chat, messages: [...chat.messages, finalAssistantMsg], updatedAt: Date.now() };
          }
          return chat;
        });
        localStorage.setItem("chimuelo_chats", JSON.stringify(updated));
        return updated;
      });

      // Extract persistent memory facts (fire-and-forget)
      if (memoryEnabled && messageText && cleanContent) {
        fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: messageText,
            assistantMessage: cleanContent,
            existingMemories: userMemory.map(m => m.content),
          }),
        }).then(r => r.json()).then(({ facts }) => {
          if (facts?.length > 0) {
            setUserMemory(prev => {
              const newEntries = facts.map((content: string) => ({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                content,
                createdAt: Date.now(),
              }));
              const updated = [...prev, ...newEntries];
              localStorage.setItem("chimuelo_memory", JSON.stringify(updated));
              return updated;
            });
          }
        }).catch(() => {});
      }

    } catch (e: any) {
      // v2.0 — user-triggered stop: persist whatever streamed so far, no error UI
      if (e?.name === 'AbortError' || controller.signal.aborted) {
        setDisplayMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.content) {
            // Save the partial assistant reply
            const partial: BaseMessage = { ...last, content: last.content + ' ⏹' };
            const updatedDisplay = [...prev.slice(0, -1), partial];
            setChats(prevChats => {
              const updated = prevChats.map(chat =>
                chat.id === targetChatId
                  ? { ...chat, messages: [...chat.messages, partial], updatedAt: Date.now() }
                  : chat
              );
              flushChatsToLS(updated);
              return updated;
            });
            return updatedDisplay;
          }
          return prev;
        });
      } else {
        console.error("Stream error:", e);
        const errMsg: BaseMessage = { id: (Date.now() + 2).toString(), role: 'assistant', content: `*(Error de conexión: ${e.message})*` };
        setDisplayMessages(prev => [...prev, errMsg]);
        setChats(prev => {
          const updated = prev.map(chat => {
            if (chat.id === targetChatId) {
              return { ...chat, messages: [...chat.messages, errMsg], updatedAt: Date.now() };
            }
            return chat;
          });
          localStorage.setItem("chimuelo_chats", JSON.stringify(updated));
          return updated;
        });
      }
    } finally {
      setIsThinking(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (e.key === "Enter" && !e.shiftKey && enterToSend && !isMobile) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearAllHistory = () => {
    if (window.confirm("¿Seguro que quieres borrar todas tus conversaciones y espacios de estudio? Esta acción no se puede deshacer.")) {
      setChats([]);
      setDisplayMessages([]);
      setCurrentChatId(null);
      setSubjects([]);
      setActiveSubjectId(null);
      localStorage.removeItem("chimuelo_chats");
      localStorage.removeItem("chimuelo_current_chat");
      localStorage.removeItem("chimuelo_subjects");
      localStorage.removeItem("chimuelo_active_subject");
      setViewMode('chat');
    }
  };

  const handleSwitchChat = (chatId: string | null) => {
    if (chatId) {
      setCurrentChatId(chatId);
      localStorage.setItem("chimuelo_current_chat", chatId);
      const active = chats.find(c => c.id === chatId);
      if (active) {
        setDisplayMessages(active.messages);
      } else {
        setDisplayMessages([]);
      }
    } else {
      createNewChat();
    }
    setAttachedImage(null);
    setSidebarOpen(false);
    setViewMode("chat");
  };

  /* ─────────── v2.0 Command Palette items ─────────── */
  type PaletteItem = { id: string; icon: any; label: string; hint?: string; run: () => void };

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      { id: 'a_new', icon: SquarePen, label: 'Nuevo chat', hint: '⌘/', run: () => { handleSwitchChat(null); } },
      { id: 'a_uni', icon: GraduationCap, label: 'Modo Universitario', run: () => { prevViewMode.current = 'chat'; setViewMode('university'); } },
      { id: 'a_settings', icon: Settings, label: 'Configuración', hint: '⌘,', run: () => { prevViewMode.current = viewMode === 'settings' ? 'chat' : (viewMode as 'chat' | 'university'); setViewMode('settings'); } },
      { id: 'a_model_fast', icon: Zap, label: 'Modelo: ⚡ Rápido', run: () => { setModel('deepseek-v4-flash'); localStorage.setItem('chimuelo_model', 'deepseek-v4-flash'); } },
      { id: 'a_model_deep', icon: Brain, label: 'Modelo: 🧠 Profundo', run: () => { setModel('deepseek-v4-pro'); localStorage.setItem('chimuelo_model', 'deepseek-v4-pro'); } },
      { id: 'a_theme_light', icon: Palette, label: 'Tema: Claro', run: () => setTheme('light') },
      { id: 'a_theme_dark', icon: Palette, label: 'Tema: Oscuro', run: () => setTheme('dark') },
      { id: 'a_theme_oled', icon: Palette, label: 'Tema: OLED', run: () => setTheme('oled') },
      { id: 'a_theme_pink', icon: Palette, label: 'Tema: Rosa', run: () => setTheme('pink') },
      { id: 'a_theme_orange', icon: Palette, label: 'Tema: Naranja', run: () => setTheme('orange') },
      { id: 'a_theme_snow', icon: Palette, label: 'Tema: Nieve', run: () => setTheme('snow') },
      { id: 'a_install', icon: Smartphone, label: 'Instalar como app', run: () => setPwaModalOpen(true) },
    ];
    const chatItems: PaletteItem[] = chats.slice(0, 50).map(c => ({
      id: `c_${c.id}`,
      icon: MessageSquare,
      label: c.title || 'Sin título',
      hint: 'Chat',
      run: () => { handleSwitchChat(c.id); },
    }));
    return [...actions, ...chatItems];
  }, [chats, viewMode]);

  const filteredPaletteItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return paletteItems;
    return paletteItems.filter(it => it.label.toLowerCase().includes(q));
  }, [paletteItems, paletteQuery]);

  useEffect(() => { setPaletteIndex(0); }, [paletteQuery, paletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setTimeout(() => paletteInputRef.current?.focus(), 30);
    }
  }, [paletteOpen]);

  /* ─────────── v2.0 Global keyboard shortcuts ─────────── */
  useEffect(() => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (e.key === 'Escape') {
        if (paletteOpen) { setPaletteOpen(false); e.preventDefault(); return; }
        if (sidebarOpen) { setSidebarOpen(false); return; }
      }
      if (!mod) return;
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        handleSwitchChat(null);
        return;
      }
      if (e.key === '\\') {
        e.preventDefault();
        setSidebarOpen(s => !s);
        return;
      }
      if (e.key === ',') {
        e.preventDefault();
        prevViewMode.current = viewMode === 'settings' ? 'chat' : (viewMode as 'chat' | 'university');
        setViewMode(v => v === 'settings' ? prevViewMode.current : 'settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, sidebarOpen, viewMode]);

  const ImageRenderer = ({ node, ...props }: any) => {
    return (
      <div className="image-container">
        <img {...props} onClick={() => setLightboxImg(props.src || null)} />
        <div className="image-overlay">
          <button 
            className="image-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              const a = document.createElement('a');
              a.href = props.src;
              a.download = `chimuelo_imagen_${Date.now()}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
          >
          </button>
        </div>
      </div>
    );
  };

  const exportToAPA = (text: string) => {
    const doc = new jsPDF();
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    
    // Better markdown cleaning for APA
    let cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links but keep text
      .replace(/[*_#`>]/g, "") // Remove bold, italic, headings, blockquotes
      .replace(/<[^>]*>?/gm, ""); // Remove any stray HTML
      
    const lines = doc.splitTextToSize(cleanText, 160);
    let y = 25.4;
    const pageHeight = doc.internal.pageSize.height;
    
    for (let i = 0; i < lines.length; i++) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 25.4;
      }
      doc.text(lines[i], 25.4, y);
      y += 8.4;
    }
    doc.save("Documento_APA.pdf");
  };

  const InteractiveFlashcard = ({ q, a }: { q: string, a: string }) => {
    const [flipped, setFlipped] = useState(false);
    return (
      <div 
        className={`flashcard-container ${flipped ? 'flipped' : ''}`}
        onClick={() => setFlipped(!flipped)}
      >
        <div className="flashcard-inner">
          <div className="flashcard-front">
            <div className="flashcard-label">Pregunta</div>
            <div className="flashcard-text">{q}</div>
            <div className="flashcard-hint">Toca para voltear ↺</div>
          </div>
          <div className="flashcard-back">
            <div className="flashcard-label">Respuesta</div>
            <div className="flashcard-text">{a}</div>
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <form onSubmit={handleLogin} className="auth-box-v2">
          <div className="auth-icon-wrap">
            <Cat size={36} strokeWidth={1.5} />
          </div>
          <h1 className="auth-title-v2">ChimueloGPT</h1>
          <p className="auth-subtitle-v2">Un gato que te regala 20 mil pesos de valor mensual por un churu.</p>
          <p className="auth-hint-v2">Ingresa la clave familiar para entrar</p>

          <div className="auth-field-v2">
            <input
              type="text"
              className="auth-input-v2"
              placeholder="Clave familiar..."
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setAuthError(null); }}
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {authError === "wrong" && (
            <p className="auth-error-v2">Clave incorrecta. Pídele la clave a Rafa.</p>
          )}
          {authError === "old" && (
            <p className="auth-error-v2 auth-error-old">La clave cambió. Pídele la nueva a Rafa 😄</p>
          )}

          <button type="submit" className="auth-submit-v2">Entrar</button>

          <p className="auth-footer-v2">Una app de Rafael Sotomayor · Tus chats solo se guardan en tu teléfono.</p>
        </form>
      </div>
    );
  }

  const activeChat = chats.find(c => c.id === currentChatId);


  return (
    <div className="app-layout" onClick={() => setModelDropdownOpen(false)}>
      {showVersionModal && (
        <div className="modal-overlay" onClick={() => setShowVersionModal(false)}>
          <div className="modal-content version-modal" onClick={e => e.stopPropagation()}>
            <div className="version-modal-header">
              <div className="version-modal-badge">✨ Novedad</div>
              <h2 className="version-modal-title">ChimueloGPT <span className="version-modal-num">v{versionData.version}</span></h2>
              <p className="version-modal-date">{versionData.date}</p>
            </div>
            <div className="version-modal-changes">
              {versionData.changes?.map((c, i) => (
                <div key={i} className="version-change-item">
                  <div className="version-change-icon">{c.icon}</div>
                  <div>
                    <div className="version-change-title">{c.title}</div>
                    <div className="version-change-desc">{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="version-modal-close-btn" onClick={() => setShowVersionModal(false)}>
              Entendido 🎉
            </button>
          </div>
        </div>
      )}

      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Lightbox" />
        </div>
      )}

      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`sidebar ${sidebarOpen ? '' : 'sidebar-mobile-hidden'}`}>
        {/* Primary actions */}
        <div className="sidebar-actions">
          <button className="sidebar-primary-btn" onClick={() => { handleSwitchChat(null); setSidebarOpen(false); }}>
            <SquarePen size={16} />
            <span>Nuevo chat</span>
          </button>
          <button className="sidebar-uni-btn" onClick={() => { prevViewMode.current = 'chat'; setViewMode("university"); setSidebarOpen(false); }}>
            <GraduationCap size={16} />
            <span>Modo Universitario</span>
          </button>
        </div>

        {/* v2.0 — Chat search */}
        {chats.length > 0 && (
          <div className="sidebar-search-wrap">
            <Search size={14} className="sidebar-search-icon" />
            <input
              type="text"
              className="sidebar-search-input"
              placeholder="Buscar chats..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />
            {sidebarSearch && (
              <button className="sidebar-search-clear" onClick={() => setSidebarSearch('')} title="Limpiar">
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Chat list grouped by date */}
        <div className="sidebar-chat-list">
          {chats.length === 0 ? (
            <div className="sidebar-empty-state">
              <MessageSquare size={28} />
              <p>Aún no hay conversaciones.</p>
              <small>Toca "Nuevo chat" para empezar.</small>
            </div>
          ) : (() => {
            const q = sidebarSearch.trim().toLowerCase();
            const filtered = q
              ? chats.filter(c =>
                  (c.title || '').toLowerCase().includes(q) ||
                  c.messages.some(m => (m.content || '').toLowerCase().includes(q))
                )
              : chats;
            if (q && filtered.length === 0) {
              return <div className="sidebar-empty-state"><p>Sin coincidencias</p><small>Prueba otra palabra</small></div>;
            }
            const groups = groupChatsByDate(filtered);
            const renderGroup = (label: string, items: Chat[]) => items.length === 0 ? null : (
              <div key={label}>
                <div className="sidebar-group-label">{label}</div>
                {items.map(chat => (
                  <button
                    key={chat.id}
                    className={`sidebar-item ${currentChatId === chat.id ? 'active' : ''}`}
                    onClick={() => { handleSwitchChat(chat.id); setSidebarOpen(false); }}
                  >
                    <MessageSquare size={14} style={{ flexShrink: 0 }} />
                    <span>{chat.title}</span>
                  </button>
                ))}
              </div>
            );
            return (
              <>
                {renderGroup('Hoy', groups.hoy)}
                {renderGroup('Ayer', groups.ayer)}
                {renderGroup('Esta semana', groups.semana)}
                {renderGroup('Antes', groups.antes)}
              </>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className="sidebar-memory-status"
            onClick={() => { prevViewMode.current = viewMode as "chat" | "university"; setViewMode('settings'); setSidebarOpen(false); }}
          >
            <Brain size={14} />
            <span>{memoryEnabled ? `${userMemory.length} recuerdos guardados` : 'Memoria pausada'}</span>
          </button>
          <button
            className="sidebar-item"
            onClick={() => { prevViewMode.current = viewMode as "chat" | "university"; setViewMode('settings'); setSidebarOpen(false); }}
          >
            <Settings size={16} style={{ flexShrink: 0 }} />
            <span>Configuración</span>
          </button>
          <button onClick={() => setPwaModalOpen(true)} className="sidebar-item">
            <Smartphone size={16} style={{ flexShrink: 0 }} />
            <span>Instalar como app</span>
          </button>
        </div>
      </div>

      {configModalOpen && selectedUniTask && (
        <div className="uni-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfigModalOpen(false); }}>
          <div className="uni-modal-content">
            <div className="uni-modal-header">
              <div className="uni-modal-title">
                {selectedUniTask === "essay" ? "✍️ ¿Cómo quieres que lo revise?" : 
                 selectedUniTask === "science" ? "🧠 ¿Qué tipo de ejercicio es?" : 
                 selectedUniTask === "synthesis" ? "📚 ¿Cómo quieres el resumen?" : "🎯 ¿Qué tipo de práctica quieres?"}
              </div>
              <button className="icon-btn" onClick={() => setConfigModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            {selectedUniTask === "essay" && (
              <>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Formato APA (Estricto)")}>
                  <span>📋 Con formato APA <small style={{color:'var(--text-secondary)',fontWeight:400}}>(el más pedido en universidades)</small></span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Formato MLA")}>
                  <span>📖 Con formato MLA <small style={{color:'var(--text-secondary)',fontWeight:400}}>(común en letras e historia)</small></span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Revisión de Ortografía General")}>
                  <span>✏️ Solo revisar ortografía y redacción</span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
              </>
            )}
            
            {selectedUniTask === "science" && (
              <>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Matemáticas y Cálculo")}>
                  <span>➕ Matemáticas y Cálculo</span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Física General")}>
                  <span>⚡ Física General</span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Química Orgánica")}>
                  <span>🧪 Química</span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
              </>
            )}

            {selectedUniTask === "synthesis" && (
              <>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Síntesis Rápida (Bullet points)")}>
                  <span>⚡ Resumen corto con los puntos clave</span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Análisis Crítico Profundo")}>
                  <span>🔍 Análisis completo y detallado</span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
              </>
            )}

            {selectedUniTask === "socratic" && (
              <>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Examen Oral (Muy Estricto)")}>
                  <span>😐 Modo difícil <small style={{color:'var(--text-secondary)',fontWeight:400}}>(profe muy estricto, sin pistas)</small></span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
                <button className="uni-option-btn" onClick={() => launchUniversityTask("Cuestionario Escrito (Amable)")}>
                  <span>😊 Modo fácil <small style={{color:'var(--text-secondary)',fontWeight:400}}>(para practicar sin presión)</small></span> <ChevronDown size={16} style={{transform: "rotate(-90deg)"}}/>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="mobile-header" style={{ display: viewMode === 'settings' ? 'none' : undefined }}>
          <button onClick={() => setSidebarOpen(true)} className="icon-btn">
            <Menu size={24} />
          </button>
          
          <div className="mobile-segmented-control d-md-none" style={{ display: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'none' : 'flex' }}>
            <button 
              className={`segment-btn ${viewMode === 'chat' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('chat');
                setCurrentChatId(null);
                setDisplayMessages([]);
              }}
            >
              <MessageSquare size={14} /> Chat
            </button>
            <button 
              className={`segment-btn ${viewMode === 'university' ? 'active' : ''}`}
              onClick={() => setViewMode('university')}
            >
              <GraduationCap size={14} /> Académico
            </button>
          </div>
          
          <div className="d-none d-md-flex" style={{ display: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'flex' : 'none', alignItems: 'center', gap: '8px' }}>
            <span>ChimueloGPT</span>
          </div>

          <button onClick={() => createNewChat()} className="icon-btn">
            <Plus size={24} />
          </button>
        </div>

        {viewMode === "settings" && (
          <div className="settings-page">
            <div className="settings-page-header">
              <button className="settings-back-btn" onClick={() => setViewMode(prevViewMode.current)}>
                <ChevronLeft size={20} /> Volver
              </button>
              <h1 className="settings-page-title">Configuración</h1>
            </div>
            <div className="settings-page-body">

              {/* Apariencia */}
              <div className="settings-card">
                <h3 className="settings-card-title">Apariencia</h3>
                <div className="settings-group">
                  <label className="settings-label">Tema Visual</label>
                  <div className="theme-selector" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {[
                      { id: 'system', name: 'Sistema', color: 'linear-gradient(135deg, #f0f0f0 50%, #1a1a1a 50%)' },
                      { id: 'light', name: 'Claro', color: '#f8fafc' },
                      { id: 'dark', name: 'Oscuro', color: '#0f172a' },
                      { id: 'pink', name: 'Rosa', color: '#fdf2f8' },
                      { id: 'orange', name: 'Naranja', color: '#fff7ed' },
                      { id: 'oled', name: 'OLED', color: '#000000' },
                      { id: 'snow', name: 'Nieve', color: '#ffffff' },
                    ].map(t => (
                      <button
                        key={t.id}
                        className={`theme-circle ${theme === t.id ? 'active' : ''}`}
                        title={t.name}
                        onClick={() => setTheme(t.id as any)}
                        style={{
                          width: '36px', height: '36px', borderRadius: '50%', background: t.color,
                          border: theme === t.id ? '3px solid #3b82f6' : '1px solid var(--border-color)',
                          cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="settings-group" style={{ marginTop: '1rem' }}>
                  <label className="settings-label">Tamaño de Texto del Chat</label>
                  <select className="settings-select" value={fontSize} onChange={(e) => setFontSize(e.target.value as any)}>
                    <option value="small">Pequeño</option>
                    <option value="medium">Mediano (Normal)</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
              </div>

              {/* Personalidad */}
              <div className="settings-card">
                <h3 className="settings-card-title">Cerebro de Chimuelo</h3>
                <div className="settings-group">
                  <label className="settings-label">Personalidad de la IA</label>
                  <select className="settings-select" value={persona} onChange={(e) => setPersona(e.target.value as any)}>
                    <option value="default">Normal (Amigable y útil)</option>
                    <option value="amable">Amable (Muy cálido y paciente)</option>
                    <option value="chistoso">Chistoso (Humor y sarcasmo)</option>
                    <option value="cursi">Cursi (Amoroso, muchos emojis 🥰)</option>
                    <option value="directo">Directo al grano (Respuestas cortas)</option>
                    <option value="serio">Serio (Formal, analítico)</option>
                    <option value="profesional">Profesional (Corporativo, de usted)</option>
                  </select>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Cambia cómo te habla y se comporta el asistente.</p>
                </div>
              </div>

              {/* Estilo del Chat */}
              <div className="settings-card">
                <h3 className="settings-card-title">Estilo del Chat</h3>
                <div className="settings-group">
                  <label className="settings-label">Burbujas</label>
                  <div className="settings-toggle-row">
                    <button className={`settings-toggle-btn ${bubbleStyle === 'bubbles' ? 'active' : ''}`} onClick={() => { setBubbleStyle('bubbles'); localStorage.setItem('chimuelo_bubbleStyle', 'bubbles'); }}>💬 Clásico</button>
                    <button className={`settings-toggle-btn ${bubbleStyle === 'flat' ? 'active' : ''}`} onClick={() => { setBubbleStyle('flat'); localStorage.setItem('chimuelo_bubbleStyle', 'flat'); }}>▬ Plano</button>
                  </div>
                </div>
                <div className="settings-group" style={{ marginTop: '1rem' }}>
                  <label className="settings-label">Densidad de mensajes</label>
                  <div className="settings-toggle-row">
                    {(['compact', 'comfortable', 'spacious'] as const).map(d => (
                      <button key={d} className={`settings-toggle-btn ${messageDensity === d ? 'active' : ''}`} onClick={() => { setMessageDensity(d); localStorage.setItem('chimuelo_density', d); }}>
                        {d === 'compact' ? '▣ Compacto' : d === 'comfortable' ? '▤ Normal' : '▥ Amplio'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Memoria */}
              <div className="settings-card">
                <h3 className="settings-card-title">🧠 Memoria Persistente</h3>
                <div className="settings-group">
                  <div className="settings-toggle-row" style={{ marginBottom: '12px' }}>
                    <button className={`settings-toggle-btn ${memoryEnabled ? 'active' : ''}`} onClick={() => { setMemoryEnabled(true); localStorage.setItem('chimuelo_memoryEnabled', 'true'); }}>✅ Activa</button>
                    <button className={`settings-toggle-btn ${!memoryEnabled ? 'active' : ''}`} onClick={() => { setMemoryEnabled(false); localStorage.setItem('chimuelo_memoryEnabled', 'false'); }}>⏸ Pausada</button>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                    Chimuelo extrae datos de tus chats para recordarte entre conversaciones.
                  </p>
                  {userMemory.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Aún no hay recuerdos. Aparecerán aquí tras tus primeras conversaciones.
                    </p>
                  ) : (
                    <div className="memory-entries-list">
                      {userMemory.map(m => (
                        <div key={m.id} className="memory-entry">
                          <span className="memory-entry-text">{m.content}</span>
                          <button className="memory-entry-delete" title="Olvidar esto" onClick={() => { const updated = userMemory.filter(x => x.id !== m.id); setUserMemory(updated); localStorage.setItem('chimuelo_memory', JSON.stringify(updated)); }}><X size={12} /></button>
                        </div>
                      ))}
                      <button style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => { setUserMemory([]); localStorage.removeItem('chimuelo_memory'); }}>Borrar toda la memoria</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cuenta y Datos */}
              <div className="settings-card danger">
                <h3 className="settings-card-title">Cuenta y Datos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={() => setPwaModalOpen(true)} className="settings-action-btn">
                    <Smartphone size={16} /> Instalar como App
                  </button>
                  <button onClick={clearAllHistory} className="settings-action-btn">
                    <Trash2 size={16} /> Borrar todos los chats
                  </button>
                  <button onClick={() => { localStorage.removeItem("chimuelo_auth"); window.location.reload(); }} className="settings-action-btn logout">
                    <LogOut size={16} /> Cerrar sesión
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        <div ref={chatScrollRef} className={`chat-area style-${bubbleStyle} density-${messageDensity}`} style={{ display: viewMode === 'settings' ? 'none' : undefined, paddingBottom: viewMode === 'university' ? '20px' : (displayMessages.length === 0 ? '0' : undefined), paddingTop: displayMessages.length === 0 ? '0' : undefined }}>
          {viewMode === "university" ? (
            <div className="university-dashboard">
              <div className="university-header">
                <h1>Cerebro Académico</h1>
                <p>Tu propio lugar de estudio. Añade tus materias y la IA recordará tus apuntes.</p>
              </div>
              
              <div className="subject-section" style={{ width: '100%', maxWidth: '850px', marginBottom: '2rem', animation: 'fadeUpStagger 0.4s ease both' }}>

                {isCreatingSubject ? (
                  /* ── CREAR MATERIA: Formulario guiado ── */
                  <div className="subject-form-card compact">
                    <div className="subject-form-header">
                      <div style={{ fontSize: '1.5rem' }}>📚</div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Añadir un Ramo</h3>
                      </div>
                    </div>

                    <div className="subject-form-field">
                      <input
                        type="text"
                        placeholder="Nombre de la materia (Ej: Cálculo 2)"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        className="subject-field-input"
                        autoFocus
                      />
                    </div>

                    <details className="subject-advanced-opt">
                      <summary>Añadir apuntes o reglas extra ▾</summary>
                      <div className="subject-form-field" style={{ marginTop: '8px' }}>
                        <textarea
                          placeholder={"Cosas que Chimuelo debe recordar:\n- El profe pide todo en APA\n- No usar Wikipedia"}
                          value={newSubjectMemory}
                          onChange={(e) => setNewSubjectMemory(e.target.value)}
                          className="subject-field-textarea"
                          style={{ minHeight: '80px' }}
                        />
                      </div>
                    </details>

                    <div className="subject-form-actions" style={{ paddingTop: '8px' }}>
                      <button className="subject-cancel-btn" onClick={() => { setIsCreatingSubject(false); setNewSubjectName(''); setNewSubjectMemory(''); }}>
                        Cancelar
                      </button>
                      <button className="subject-save-btn" onClick={handleCreateSubject} disabled={!newSubjectName.trim()}>
                        ✓ Guardar
                      </button>
                    </div>
                  </div>

                ) : subjects.length === 0 ? (
                  /* ── ESTADO VACÍO: Guía de primeros pasos ── */
                  <div className="subject-empty-state">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', maxWidth: '440px', marginBottom: '1.25rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>¿Cómo funciona?</p>
                      {[
                        { n: '1', icon: '📚', title: 'Agrega un ramo', desc: 'Escribe el nombre (ej: Cálculo 2) y pega tus apuntes o el programa del curso.' },
                        { n: '2', icon: '☝️', title: 'Selecciónalo aquí arriba', desc: 'Chimuelo cargará ese contexto antes de responder — sin que tengas que explicar nada.' },
                        { n: '3', icon: '🎯', title: 'Elige una tarea abajo', desc: 'Corregir ensayo, resolver ejercicios, resumir papers… lo que necesites para esa materia.' },
                      ].map(s => (
                        <div key={s.n} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', textAlign: 'left' }}>
                          <div style={{ fontSize: '1.3rem', flexShrink: 0, lineHeight: 1 }}>{s.icon}</div>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{s.title} </span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="subject-add-first-btn" onClick={() => setIsCreatingSubject(true)}>
                      <Plus size={18} /> Agregar mi primer ramo
                    </button>
                  </div>

                ) : (
                  /* ── LISTA DE MATERIAS ── */
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {activeSubjectId ? '📖 Ramo activo — Chimuelo usará tus apuntes:' : '👆 Elige un ramo o trabaja en modo General:'}
                      </p>
                      <button className="subject-add-more-btn" onClick={() => setIsCreatingSubject(true)}>
                        <Plus size={14} /> Añadir
                      </button>
                    </div>
                    <div className="subject-chips-list">
                      <button
                        className={`subject-chip ${!activeSubjectId ? 'active' : ''}`}
                        onClick={() => { setActiveSubjectId(null); localStorage.removeItem('chimuelo_active_subject'); }}
                      >
                        <span>🌐</span> General
                      </button>
                      {subjects.map(s => (
                        <div key={s.id} className="subject-chip-wrapper">
                          <button
                            className={`subject-chip ${activeSubjectId === s.id ? 'active' : ''}`}
                            onClick={() => { setActiveSubjectId(s.id); localStorage.setItem('chimuelo_active_subject', s.id); }}
                          >
                            <span>📖</span> {s.name}
                          </button>
                          {activeSubjectId === s.id && (
                            <button
                              className="subject-chip-delete"
                              onClick={() => handleDeleteSubject(s.id)}
                              title="Eliminar materia"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {activeSubjectId ? (
                      <div style={{ marginTop: '0.75rem', padding: '10px 14px', borderRadius: '10px', background: 'rgba(161,140,209,0.12)', border: '1px solid rgba(161,140,209,0.3)', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        🎯 <strong>¡Listo!</strong> Chimuelo ya tiene cargados los apuntes de <strong>{subjects.find(s => s.id === activeSubjectId)?.name}</strong>. Ahora elige una tarea abajo y empezará con todo el contexto de tu ramo.
                      </div>
                    ) : (
                      <p style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        💡 Selecciona un ramo para que Chimuelo use tus apuntes automáticamente, o usa <strong>General</strong> para cualquier consulta sin contexto de materia.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="university-grid">
                <div className="university-card essay" onClick={() => openConfigModal("essay")}>
                  <div className="uni-card-header">
                    <div className="uni-card-icon-wrapper">✍️</div>
                    <div className="uni-card-title">Corregir Trabajos y Ensayos</div>
                  </div>
                  <div className="uni-card-desc">Sube tu texto y la IA arreglará la ortografía, mejorará tus argumentos y le pondrá un tono más formal y académico.</div>
                </div>
                <div className="university-card science" onClick={() => openConfigModal("science")}>
                  <div className="uni-card-header">
                    <div className="uni-card-icon-wrapper">🧮</div>
                    <div className="uni-card-title">Ayudante de Ciencias (Mates, Física)</div>
                  </div>
                  <div className="uni-card-desc">Pásale un ejercicio difícil y no solo te dará la respuesta, sino que te explicará el paso a paso como un ayudante buena onda.</div>
                </div>
                <div className="university-card synthesis" onClick={() => openConfigModal("synthesis")}>
                  <div className="uni-card-header">
                    <div className="uni-card-icon-wrapper">📚</div>
                    <div className="uni-card-title">Resumir Textos Largos (Papers)</div>
                  </div>
                  <div className="uni-card-desc">Pega esa lectura gigante de 50 páginas y te hará un resumen al grano con los puntos clave para estudiar rápido.</div>
                </div>
                <div className="university-card socratic" onClick={() => openConfigModal("socratic")}>
                  <div className="uni-card-header">
                    <div className="uni-card-icon-wrapper">🧠</div>
                    <div className="uni-card-title">Simulador de Examen (Ponte a Prueba)</div>
                  </div>
                  <div className="uni-card-desc">Dile qué entra en la prueba y la IA te hará preguntas difíciles para ver si de verdad dominas la materia.</div>
                </div>
              </div>
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="v2-empty-state">
              <div className="v2-orb-container">
                <div className="glowing-orb"></div>
                <div className="glowing-orb-core"></div>
              </div>
              <h2 className="greeting-text-gradient">
                {getGreeting()}, ¿en qué te ayudo hoy?
              </h2>
              <div className="smart-pills-container">
                {smartPills.map((pill, i) => (
                  <button key={i} className="smart-pill" onClick={() => handleSendMessage(pill.message)}>
                    <span className="pill-icon">{pill.icon}</span>
                    <span className="pill-text">{pill.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            displayMessages.map((msg: any, i) => {
              const role = msg.role;
              const contentStr = msg.content || '';
              const reasoning = msg.model === 'deepseek-v4-pro' ? (msg.reasoning || contentStr.match(/<think>([\s\S]*?)<\/think>/)?.[1]) : undefined;
              const displayContent = contentStr.replace(/<think>[\s\S]*?<\/think>/, '').trim();

              return (
              <div key={msg.id} className={`message ${role}`}>
                <div className="message-content-wrapper">
                  {role === 'assistant' && (
                    <div className="avatar assistant">
                      <Cat size={24} />
                    </div>
                  )}
                  <div className="message-text">
                    {msg.imagePlaceholder && (
                      <div className="attachment-placeholder">
                        <FileImage size={16} />
                        <span>{msg.imagePlaceholder}</span>
                      </div>
                    )}
                    
                    {role === 'assistant' && reasoning && (() => {
                      const isStreaming = !displayContent;
                      return (
                        <div className={`reasoning-v2-card v3 ${isStreaming ? 'streaming' : 'done'}`}>
                          <div className="reasoning-v2-header">
                            <div className="reasoning-v2-orb">
                              <span className="reasoning-v2-brain">🧠</span>
                            </div>
                            <div className="reasoning-v2-title-area">
                              {isStreaming ? (
                                <>
                                  <span className="reasoning-v2-title">Analizando tu pregunta...</span>
                                  <div className="reasoning-v2-dots">
                                    <span></span><span></span><span></span>
                                  </div>
                                </>
                              ) : (
                                <details style={{ listStyle: 'none', width: '100%' }}>
                                  <summary className="reasoning-v2-summary">
                                    <span className="reasoning-v2-title">Ver cómo lo pensé →</span>
                                  </summary>
                                  <div className="reasoning-v2-body">{reasoning}</div>
                                </details>
                              )}
                            </div>
                          </div>
                          {isStreaming && (
                            <div className="reasoning-v2-live typewriter">
                              <div className="reasoning-v2-live-text">{reasoning}</div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {displayContent && (() => {
                      const hasNewArtifact = displayContent.includes('<artifact>');
                      const hasOldArtifact = displayContent.includes('<artifact_html>') && !hasNewArtifact;
                      const hasImageTag = displayContent.includes('<generate_image');
                      
                      let currentBody = displayContent;
                      let artifactContent = '';
                      let artifactTitle = 'Diseño Generado';
                      let artifactDesc = 'Haz clic para previsualizar y descargar PDF';
                      let flashcards: {q: string, a: string}[] | null = null;
                      
                      const jsonMatch = currentBody.match(/```(?:json)?\n([\s\S]*?)\n```/);
                      if (jsonMatch) {
                        try {
                          const parsed = JSON.parse(jsonMatch[1]);
                          if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
                            flashcards = parsed.flashcards;
                            currentBody = currentBody.replace(jsonMatch[0], '').trim();
                          }
                        } catch(e) {}
                      }
                      
                      if (hasImageTag) {
                        currentBody = currentBody.replace(/<generate_image(?:[^>]*)>[\s\S]*?(?:<\/generate_image>|$)/i, '🎨 Generando tu imagen... por favor espera.').trim();
                      }

                      if (hasNewArtifact) {
                        const matchHtml = displayContent.match(/<artifact_html>([\s\S]*?)(?:<\/artifact_html>|$)/i);
                        const matchTitle = displayContent.match(/<artifact_title>([\s\S]*?)(?:<\/artifact_title>|$)/i);
                        const matchDesc = displayContent.match(/<artifact_desc>([\s\S]*?)(?:<\/artifact_desc>|$)/i);
                        
                        if (matchHtml && matchHtml[1]) artifactContent = matchHtml[1].trim();
                        if (matchTitle && matchTitle[1]) artifactTitle = matchTitle[1].replace(/<\/artifact_title>/, '').trim();
                        if (matchDesc && matchDesc[1]) artifactDesc = matchDesc[1].replace(/<\/artifact_desc>/, '').trim();
                        
                        currentBody = currentBody.replace(/<artifact>[\s\S]*?(?:<\/artifact>|$)/i, '').trim();
                      } else if (hasOldArtifact) {
                        const match = displayContent.match(/<artifact_html>([\s\S]*?)(?:<\/artifact_html>|$)/i);
                        if (match && match[1]) {
                          artifactContent = match[1].trim();
                          currentBody = currentBody.replace(/<artifact_html>[\s\S]*?(?:<\/artifact_html>|$)/i, '').trim();
                        }
                      } else {
                        // fallback for old pdf
                        currentBody = currentBody.replace(/<pdf_content>[\s\S]*?(?:<\/pdf_content>|$)/i, '').trim();
                      }
                      
                      const showArtifact = hasNewArtifact || hasOldArtifact;
                      const isArtifactComplete = displayContent.includes('</artifact>') || displayContent.includes('</artifact_html>');
                      const isLastMsg = i === displayMessages.length - 1;
                      const isReady = !isThinking || !isLastMsg;
                      const showActions = msg.role === 'assistant' && isReady && (!showArtifact || isArtifactComplete);
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div className={`markdown-body font-${fontSize}`}>
                            <MemoizedMarkdown
                              content={currentBody}
                              imgRenderer={ImageRenderer}
                              codeRenderer={CodeBlock}
                            />
                            {msg.role === 'assistant' && activeChat?.subjectId && (
                               <div className="apa-export-bar" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                                  <button className="download-btn" onClick={() => exportToAPA(currentBody)}>
                                    <Download size={14} style={{ marginRight: '6px' }} /> Exportar a PDF (Formato APA)
                                  </button>
                               </div>
                            )}
                            
                            {flashcards && flashcards.length > 0 && (
                              <div className="flashcards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                {flashcards.map((fc, idx) => (
                                  <InteractiveFlashcard key={idx} q={fc.q} a={fc.a} />
                                ))}
                              </div>
                            )}
                            
                            {msg.role === 'assistant' && showArtifact && (
                              <div 
                                className={`artifact-card ${isArtifactComplete ? '' : 'loading'}`}
                                onClick={() => isArtifactComplete && setArtifactModal(artifactContent)}
                                style={{ opacity: isArtifactComplete ? 1 : 0.6, cursor: isArtifactComplete ? 'pointer' : 'wait' }}
                              >
                                <div className="artifact-icon">{thinkingTask === 'document' || artifactTitle.toLowerCase().includes('informe') ? '📄' : '✨'}</div>
                                <div className="artifact-info">
                                  <strong>{isArtifactComplete ? artifactTitle : 'Renderizando Diseño...'}</strong>
                                  <span>{isArtifactComplete ? artifactDesc : 'Pintando interfaz gráfica'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {showActions && (
                            <div className="message-actions" style={{ display: 'flex', gap: '12px', marginTop: '4px', opacity: 0.7 }}>
                              <button className="action-btn hover-bg" title="Me gusta" onClick={(e) => { e.currentTarget.style.color = '#10b981'; }}><ThumbsUp size={16} /></button>
                              <button className="action-btn hover-bg" title="No me gusta" onClick={(e) => { e.currentTarget.style.color = '#ef4444'; }}><ThumbsDown size={16} /></button>
                              
                              {/* Download button for images or artifacts */}
                              {(displayContent.includes('![Imagen') || showArtifact) && (
                                <button className="action-btn hover-bg" title="Descargar" onClick={() => {
                                  const imgMatch = displayContent.match(/!\[.*?\]\((.*?)\)/);
                                  if (imgMatch && imgMatch[1]) {
                                    // It's an image
                                    window.open(imgMatch[1], '_blank');
                                  } else if (showArtifact && isArtifactComplete) {
                                    // It's an artifact, open the modal to preview/download
                                    setArtifactModal(artifactContent);
                                  }
                                }}><Download size={16} /></button>
                              )}

                              {/* Only show regenerate for the last assistant message */}
                              {displayMessages.length > 0 && msg.id === displayMessages[displayMessages.length - 1].id && (
                                <button className="action-btn hover-bg" title="Regenerar respuesta" onClick={() => {
                                  // Find the last user message
                                  const lastUserMsg = displayMessages.slice().reverse().find(m => m.role === 'user');
                                  if (lastUserMsg && currentChatId) {
                                    // Remove the last assistant message
                                    setChats(prev => {
                                      const updated = [...prev];
                                      const chatIndex = updated.findIndex(c => c.id === currentChatId);
                                      if (chatIndex !== -1) {
                                        updated[chatIndex].messages = updated[chatIndex].messages.slice(0, -1);
                                      }
                                      return updated;
                                    });
                                    setDisplayMessages(prev => prev.slice(0, -1));
                                    // Trigger send again
                                    handleSendMessage(lastUserMsg.content);
                                  }
                                }}><RotateCw size={16} /></button>
                              )}
                              
                              <button className="action-btn hover-bg" title="Compartir" onClick={() => {
                                if (navigator.share) {
                                  navigator.share({ title: 'ChimueloGPT', text: displayContent }).catch(() => {});
                                } else {
                                  navigator.clipboard.writeText(displayContent);
                                  alert('Copiado al portapapeles');
                                }
                              }}><Share2 size={16} /></button>
                              <button className="action-btn hover-bg" title="Copiar" onClick={() => {
                                navigator.clipboard.writeText(displayContent);
                                alert('Copiado al portapapeles');
                              }}><Copy size={16} /></button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              );
            })
          )}

          {isThinking && (displayMessages.length === 0 || displayMessages[displayMessages.length - 1]?.role !== 'assistant') && (
            <div className="message assistant">
              <div className="message-content-wrapper">
                <div className="avatar assistant">
                  <Cat size={24} />
                </div>
                <div className="message-text">
                  <div className="thinking-modern-container">
                    <div className="modern-spinner"></div>
                    <span className="thinking-text-modern">
                      {thinkingTask === "image" ? "🎨 Pintando la imagen, preparando pinceles..." : 
                       thinkingTask === "document" ? "📄 Diseñando y redactando el documento..." :
                       thinkingTask === "code" ? "💻 Escribiendo y estructurando código..." :
                       model === 'deepseek-v4-pro' ? "🧠 Pensando profundamente..." : "⚡ Preparando respuesta rápida..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {viewMode === "chat" && (
          <div className="v2-input-area">
            <div className="v2-model-selector">
              <button 
                className={`v2-model-btn ${model === 'deepseek-v4-flash' ? 'active' : ''}`}
                onClick={() => { setModel('deepseek-v4-flash'); localStorage.setItem('chimuelo_model', 'deepseek-v4-flash'); }}
              >
                ⚡ Rápido
              </button>
              <button 
                className={`v2-model-btn ${model === 'deepseek-v4-pro' ? 'active' : ''}`}
                onClick={() => { setModel('deepseek-v4-pro'); localStorage.setItem('chimuelo_model', 'deepseek-v4-pro'); }}
              >
                🧠 Profundo
              </button>
            </div>

            <div className="v2-input-container">
              {attachedImage && (
                <div className="image-preview-container">
                  <div className="image-preview-item" style={{ background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {attachedImage.type?.startsWith('image/') ? (
                      <img src={attachedImage.base64} alt="Preview" className="image-preview-img" />
                    ) : (
                      <div style={{ padding: '8px', fontSize: '0.7rem', textAlign: 'center', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                        📄 {attachedImage.name.length > 10 ? attachedImage.name.substring(0, 10) + '...' : attachedImage.name}
                      </div>
                    )}
                    <button className="image-preview-remove" onClick={() => setAttachedImage(null)}>
                      <XCircle size={16} fill="white" color="#333" />
                    </button>
                  </div>
                </div>
              )}
              
              <input type="file" accept="*/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
              
              <div className="v2-input-row">
                <button className="v2-attach-btn" title="Subir foto" onClick={() => fileInputRef.current?.click()}>
                  <div className="v2-attach-icon-wrapper">
                    <Plus size={20} />
                  </div>
                </button>
                
                <textarea
                  ref={textareaRef}
                  className="v2-input-textarea"
                  placeholder="Escribe o pregunta algo..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                
                {isThinking ? (
                  <button
                    className="v2-send-btn stop active"
                    onClick={stopGeneration}
                    title="Detener generación"
                  >
                    <Square size={16} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    className={`v2-send-btn ${inputMessage.trim() || attachedImage ? 'active' : ''}`}
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() && !attachedImage}
                  >
                    <Send size={18} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="disclaimer">
              Chimuelo puede cometer errores. Considera verificar la información importante.
            </div>
          </div>
        )}
      </div>

      {/* PWA Instructions Modal */}
      {pwaModalOpen && (
        <div className="modal-overlay" onClick={() => setPwaModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={24} /> Agrégame a tu Celu
              </h2>
              <button onClick={() => setPwaModalOpen(false)} className="modal-close">
                <X size={24} />
              </button>
            </div>
            
            <div style={{ marginTop: '1rem' }}>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Puedes instalar ChimueloGPT como una app en tu teléfono para entrar más rápido, como si fuera WhatsApp. ¡Es muy fácil!
              </p>
              
              <div style={{ backgroundColor: 'var(--input-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🍎 Si usas iPhone (Safari)
                </h3>
                <ol style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  <li>Toca el botón de <strong>Compartir</strong> (es un cuadrito con una flecha hacia arriba que está en la barra de abajo).</li>
                  <li>Desliza hacia abajo en ese menú hasta encontrar <strong>"Agregar a inicio"</strong> o <strong>"Add to Home Screen"</strong> y tócalo.</li>
                  <li>Toca <strong>"Agregar"</strong> arriba a la derecha. ¡Listo! Ya aparecerá el ícono en tu teléfono.</li>
                </ol>
              </div>

              <div style={{ backgroundColor: 'var(--input-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🤖 Si usas Android (Chrome)
                </h3>
                <ol style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  <li>Toca los <strong>tres puntitos</strong> que están arriba a la derecha en el navegador.</li>
                  <li>Busca la opción <strong>"Agregar a la pantalla principal"</strong> o <strong>"Instalar aplicación"</strong> y tócala.</li>
                  <li>Confirma tocando <strong>"Agregar"</strong> o <strong>"Instalar"</strong>. ¡Ya lo tienes como app!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <div className="lightbox-actions" onClick={e => e.stopPropagation()}>
            <button 
              className="image-action-btn"
              onClick={() => {
                const a = document.createElement('a');
                a.href = lightboxImg;
                a.download = `chimuelo_imagen_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
              <Download size={20} />
            </button>
            <button className="image-action-btn" onClick={() => setLightboxImg(null)}>
              <X size={20} />
            </button>
          </div>
          <img src={lightboxImg} className="lightbox-img" alt="Ampliación" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Artifact Modal */}
      {artifactModal && (
        <div className="modal-overlay" onClick={() => setArtifactModal(null)}>
          <div className="artifact-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '1rem' }}>
              <h2 className="modal-title">Previsualización del Diseño</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="danger-btn"
                  style={{ backgroundColor: '#1877F2', width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={async () => {
                    const iframe = document.getElementById('artifact-iframe') as HTMLIFrameElement;
                    if (iframe && iframe.contentDocument) {
                      const canvas = await html2canvas(iframe.contentDocument.body, { useCORS: true, allowTaint: true });
                      const imgData = canvas.toDataURL('image/png');
                      const pdf = new jsPDF({
                        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [canvas.width, canvas.height]
                      });
                      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                      pdf.save(`chimuelo_documento_${Date.now()}.pdf`);
                    }
                  }}
                >
                  <Download size={18} /> Descargar PDF
                </button>
                <button onClick={() => setArtifactModal(null)} className="icon-btn">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="artifact-preview-container">
              <iframe 
                id="artifact-iframe"
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <script src="https://cdn.tailwindcss.com"></script>
                      <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; box-sizing: border-box; }
                      </style>
                    </head>
                    <body>
                      ${artifactModal}
                    </body>
                  </html>
                `}
                title="Artifact Preview"
                className="artifact-iframe"
              />
            </div>
          </div>
        </div>
      )}

      {/* v2.0 — Command Palette (Cmd+K) */}
      {paletteOpen && (
        <div className="palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="palette-modal" onClick={(e) => e.stopPropagation()}>
            <div className="palette-search-row">
              <Search size={16} />
              <input
                ref={paletteInputRef}
                type="text"
                className="palette-input"
                placeholder="Buscar acción o chat..."
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setPaletteIndex(i => Math.min(i + 1, filteredPaletteItems.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setPaletteIndex(i => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const item = filteredPaletteItems[paletteIndex];
                    if (item) {
                      item.run();
                      setPaletteOpen(false);
                      setPaletteQuery('');
                    }
                  }
                }}
              />
              <kbd className="palette-kbd">esc</kbd>
            </div>
            <div className="palette-list">
              {filteredPaletteItems.length === 0 ? (
                <div className="palette-empty">Sin resultados</div>
              ) : (
                filteredPaletteItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      className={`palette-item ${i === paletteIndex ? 'active' : ''}`}
                      onMouseEnter={() => setPaletteIndex(i)}
                      onClick={() => {
                        item.run();
                        setPaletteOpen(false);
                        setPaletteQuery('');
                      }}
                    >
                      <Icon size={16} className="palette-item-icon" />
                      <span className="palette-item-label">{item.label}</span>
                      {item.hint && <span className="palette-item-hint">{item.hint}</span>}
                    </button>
                  );
                })
              )}
            </div>
            <div className="palette-footer">
              <span><kbd>↑↓</kbd> Navegar</span>
              <span><kbd>↵</kbd> Ejecutar</span>
              <span><kbd>esc</kbd> Cerrar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
