"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Plus, Settings, Send, Paperclip, Menu, X, Trash2, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string; // Base64 image
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(false);
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  const [inputMessage, setInputMessage] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [model, setModel] = useState<"deepseek-v4-pro" | "deepseek-v4-flash">("deepseek-v4-pro");
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [showVersionBanner, setShowVersionBanner] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from localStorage
  useEffect(() => {
    const savedAuth = localStorage.getItem("chimuelo_auth");
    if (savedAuth === "true") setIsAuthenticated(true);

    const savedChats = localStorage.getItem("chimuelo_chats");
    if (savedChats) setChats(JSON.parse(savedChats));

    const savedTheme = localStorage.getItem("chimuelo_theme") as "system" | "light" | "dark";
    if (savedTheme) setTheme(savedTheme);

    const savedModel = localStorage.getItem("chimuelo_model") as "deepseek-v4-pro" | "deepseek-v4-flash";
    if (savedModel) setModel(savedModel);

    const currentChat = localStorage.getItem("chimuelo_current_chat");
    if (currentChat) setCurrentChatId(currentChat);

    // Version check logic
    const checkVersion = async () => {
      try {
        const res = await fetch("/version.json");
        if (res.ok) {
          const data = await res.json();
          const storedVersion = localStorage.getItem("chimuelo_version") || "1.0.0";
          if (data.version && data.version !== storedVersion) {
            setAppVersion(data.version);
            setShowVersionBanner(true);
            localStorage.setItem("chimuelo_version", data.version);
            setTimeout(() => setShowVersionBanner(false), 10000);
          }
        }
      } catch (e) {
        console.error("Failed to check version", e);
      }
    };
    checkVersion();
  }, []);

  // Theme application
  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem("chimuelo_theme", theme);
  }, [theme]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId, isThinking]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.toLowerCase() === "chimuelo") {
      setIsAuthenticated(true);
      localStorage.setItem("chimuelo_auth", "true");
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const currentChat = chats.find(c => c.id === currentChatId);

  const saveChats = (newChats: Chat[]) => {
    setChats(newChats);
    localStorage.setItem("chimuelo_chats", JSON.stringify(newChats));
  };

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "Nuevo Chat",
      messages: [],
      updatedAt: Date.now()
    };
    const updatedChats = [newChat, ...chats];
    saveChats(updatedChats);
    setCurrentChatId(newChat.id);
    localStorage.setItem("chimuelo_current_chat", newChat.id);
    setSidebarOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be selected again if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && !attachedImage) return;

    let activeChatId = currentChatId;
    let activeChat = currentChat;
    let updatedChats = [...chats];

    const messageText = inputMessage.trim();
    const messageImage = attachedImage;

    if (!activeChatId || !activeChat) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: messageText ? messageText.slice(0, 30) + (messageText.length > 30 ? "..." : "") : "Imagen adjunta",
        messages: [],
        updatedAt: Date.now()
      };
      activeChatId = newChat.id;
      activeChat = newChat;
      updatedChats = [newChat, ...chats];
      setCurrentChatId(activeChatId);
      localStorage.setItem("chimuelo_current_chat", activeChatId);
    }

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: "user", 
      content: messageText,
      ...(messageImage ? { image: messageImage } : {})
    };
    
    activeChat.messages.push(userMsg);
    activeChat.updatedAt = Date.now();
    
    // Update title if it's the first message and it has text
    if (activeChat.messages.length === 1 && messageText) {
      activeChat.title = messageText.slice(0, 30) + (messageText.length > 30 ? "..." : "");
    }

    saveChats(updatedChats);
    setInputMessage("");
    setAttachedImage(null);
    setIsThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: activeChat.messages,
          model: model
        })
      });

      if (!res.ok) throw new Error("API Error");

      const data = await res.json();
      
      const assistantMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.reply || "No hubo respuesta."
      };

      const finalChats = [...chats];
      const chatIndex = finalChats.findIndex(c => c.id === activeChatId);
      if (chatIndex !== -1) {
        finalChats[chatIndex].messages.push(assistantMsg);
        finalChats[chatIndex].updatedAt = Date.now();
        saveChats(finalChats);
      }
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Ocurrió un error al comunicarse con ChimueloGPT. Por favor, asegúrate de tener bien configurada tu API Key en Vercel."
      };
      const finalChats = [...chats];
      const chatIndex = finalChats.findIndex(c => c.id === activeChatId);
      if (chatIndex !== -1) {
        finalChats[chatIndex].messages.push(errorMsg);
        saveChats(finalChats);
      }
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearAllHistory = () => {
    if (confirm("¿Estás seguro de que quieres borrar todo el historial? Esto no se puede deshacer.")) {
      setChats([]);
      setCurrentChatId(null);
      localStorage.removeItem("chimuelo_chats");
      localStorage.removeItem("chimuelo_current_chat");
      setSettingsOpen(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <form onSubmit={handleLogin} className="auth-box">
          <h1 className="auth-title">ChimueloGPT</h1>
          <input
            type="text"
            className="auth-input"
            placeholder="Contraseña"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            autoFocus
          />
          {authError && <p className="auth-error">Contraseña incorrecta.</p>}
          <button type="submit" className="auth-btn">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {showVersionBanner && (
        <div className="version-banner">
          ¡Nueva versión disponible! (v{appVersion})
        </div>
      )}

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="modal-overlay md:hidden" 
          style={{ zIndex: 5 }} 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? '' : 'sidebar-mobile-hidden'}`}>
        <div className="sidebar-header">
          <button onClick={createNewChat} className="new-chat-btn">
            <Plus size={16} />
            Nuevo chat
          </button>
        </div>
        <div className="sidebar-history">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`history-item ${chat.id === currentChatId ? 'active' : ''}`}
              onClick={() => {
                setCurrentChatId(chat.id);
                localStorage.setItem("chimuelo_current_chat", chat.id);
                setSidebarOpen(false);
              }}
            >
              <MessageSquare size={16} />
              <span className="history-item-title">{chat.title}</span>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <button onClick={() => setSettingsOpen(true)} className="settings-btn">
            <Settings size={16} />
            Configuración
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="icon-btn">
            <Menu size={24} />
          </button>
          <span>ChimueloGPT</span>
          <button onClick={() => createNewChat()} className="icon-btn">
            <Plus size={24} />
          </button>
        </div>

        <div className="chat-area">
          {currentChat?.messages.length === 0 || !currentChat ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>ChimueloGPT</h2>
              <p>¿En qué te puedo ayudar hoy?</p>
            </div>
          ) : (
            currentChat.messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-content-wrapper">
                  <div className={`avatar ${msg.role}`}>
                    {msg.role === 'user' ? 'Tú' : 'C'}
                  </div>
                  <div className="message-text">
                    {msg.image && (
                      <img src={msg.image} alt="Adjunto" className="message-image" />
                    )}
                    {msg.content && (
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {isThinking && (
            <div className="message assistant">
              <div className="message-content-wrapper">
                <div className="avatar assistant">C</div>
                <div className="message-text">
                  <div className="thinking-animation">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} style={{ height: '100px' }} />
        </div>

        <div className="input-area">
          <div className="input-container">
            {attachedImage && (
              <div className="image-preview-container">
                <div className="image-preview-item">
                  <img src={attachedImage} alt="Preview" className="image-preview-img" />
                  <button 
                    className="image-preview-remove" 
                    onClick={() => setAttachedImage(null)}
                  >
                    <XCircle size={16} fill="white" color="var(--text-primary)" />
                  </button>
                </div>
              </div>
            )}
            
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            
            <button 
              className="attach-btn" 
              title="Adjuntar imagen"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={20} />
            </button>
            <textarea
              ref={textareaRef}
              className="input-textarea"
              placeholder="Mensaje a ChimueloGPT..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button 
              className="send-btn" 
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && !attachedImage) || isThinking}
            >
              <Send size={16} />
            </button>
          </div>
          <div className="disclaimer" style={{ position: 'absolute', bottom: '8px' }}>
            ChimueloGPT puede cometer errores. Considera verificar la información importante.
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Configuración</h2>
              <button onClick={() => setSettingsOpen(false)} className="modal-close">
                <X size={24} />
              </button>
            </div>
            
            <div className="settings-group">
              <label className="settings-label">Tema</label>
              <select 
                className="settings-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
              >
                <option value="system">Sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">Modelo</label>
              <select 
                className="settings-select"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value as any);
                  localStorage.setItem("chimuelo_model", e.target.value);
                }}
              >
                <option value="deepseek-v4-pro">Modo Pro (deepseek-v4-pro)</option>
                <option value="deepseek-v4-flash">Modo Rápido (deepseek-v4-flash)</option>
              </select>
            </div>

            <div className="settings-group" style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <label className="settings-label" style={{ color: '#ef4444' }}>Zona de peligro</label>
              <button onClick={clearAllHistory} className="danger-btn">
                Borrar todos los chats
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
