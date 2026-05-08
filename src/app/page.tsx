"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Plus, Settings, Send, Paperclip, Menu, X, Cat, XCircle, FileImage, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePlaceholder?: string;
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
  const [attachedImage, setAttachedImage] = useState<{base64: string, name: string} | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [model, setModel] = useState<"deepseek-v4-pro" | "deepseek-v4-flash">("deepseek-v4-pro");
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [showVersionBanner, setShowVersionBanner] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem("chimuelo_theme", theme);
  }, [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId, isThinking]);

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
    setSidebarOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage({
        base64: reader.result as string,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (customMessage?: string) => {
    const msgToSend = customMessage || inputMessage;
    if (!msgToSend.trim() && !attachedImage) return;

    const messageText = msgToSend.trim();
    const imagePayload = attachedImage ? attachedImage.base64 : null;
    const imageName = attachedImage ? attachedImage.name : null;

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
    const userMsg: Message = { 
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
    setIsThinking(true);

    try {
      let currentMessagesForApi: any[] = [];
      
      setChats(currentChats => {
        const chat = currentChats.find(c => c.id === targetChatId);
        if (chat) {
          currentMessagesForApi = chat.messages.map(m => {
            if (m.id === userMsgId && imagePayload) {
              return { role: m.role, content: m.content, image: imagePayload };
            }
            return { role: m.role, content: m.content };
          });
        }
        return currentChats;
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessagesForApi,
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

      setChats(prev => {
        const updated = [...prev];
        const chatIndex = updated.findIndex(c => c.id === targetChatId);
        if (chatIndex !== -1) {
          updated[chatIndex] = {
            ...updated[chatIndex],
            messages: [...updated[chatIndex].messages, assistantMsg],
            updatedAt: Date.now()
          };
        }
        localStorage.setItem("chimuelo_chats", JSON.stringify(updated));
        return updated;
      });
      
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Ocurrió un error al comunicarse con ChimueloGPT. Asegúrate de tener configurada tu API Key."
      };
      setChats(prev => {
        const updated = [...prev];
        const chatIndex = updated.findIndex(c => c.id === targetChatId);
        if (chatIndex !== -1) {
          updated[chatIndex] = {
            ...updated[chatIndex],
            messages: [...updated[chatIndex].messages, errorMsg],
            updatedAt: Date.now()
          };
        }
        localStorage.setItem("chimuelo_chats", JSON.stringify(updated));
        return updated;
      });
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

  const activeChat = chats.find(c => c.id === currentChatId);

  return (
    <div className="app-layout" onClick={() => setModelDropdownOpen(false)}>
      {showVersionBanner && (
        <div className="version-banner">
          ¡Nueva versión disponible! (v{appVersion})
        </div>
      )}

      {sidebarOpen && (
        <div 
          className="modal-overlay md:hidden" 
          style={{ zIndex: 5 }} 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

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

      <div className="main-content">
        <div className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="icon-btn">
            <Menu size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>ChimueloGPT</span>
          </div>
          <button onClick={() => createNewChat()} className="icon-btn">
            <Plus size={24} />
          </button>
        </div>

        <div className="chat-area">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="empty-state-container">
              <Cat size={48} strokeWidth={1.5} style={{ marginBottom: '1rem', color: 'var(--text-primary)' }} />
              <h2 className="empty-state-title">ChimueloGPT</h2>
              <p className="empty-state-subtitle">Un gato que te regala 20 mil pesos de valor mensual por un churu.</p>
              
              <div className="examples-grid">
                <button className="example-btn" onClick={() => handleSendMessage("Genera una imagen de un paisaje cyberpunk en formato ultra realista")}>
                  <span className="example-title">Genera una imagen</span>
                  <span className="example-desc">Un paisaje cyberpunk en formato ultra realista usando Fal.ai FLUX.2</span>
                </button>
                <button className="example-btn" onClick={() => handleSendMessage("Escribe un correo formal para solicitar una reunión con un cliente")}>
                  <span className="example-title">Escribe un correo formal</span>
                  <span className="example-desc">Para solicitar una reunión importante con un cliente</span>
                </button>
                <button className="example-btn" onClick={() => handleSendMessage("Explícame de forma sencilla cómo funciona la gravedad cuántica")}>
                  <span className="example-title">Explícame de forma sencilla</span>
                  <span className="example-desc">Cómo funciona la gravedad cuántica usando analogías</span>
                </button>
                <button className="example-btn" onClick={() => handleSendMessage("Ayúdame a organizar un menú semanal saludable y económico")}>
                  <span className="example-title">Ayúdame a organizar</span>
                  <span className="example-desc">Un menú semanal saludable y económico con ingredientes básicos</span>
                </button>
              </div>
            </div>
          ) : (
            activeChat.messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-content-wrapper">
                  {msg.role === 'assistant' && (
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
                <div className="avatar assistant">
                  <Cat size={24} />
                </div>
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
          <div ref={messagesEndRef} style={{ height: '120px' }} />
        </div>

        <div className="input-area">
          <div className="input-container">
            
            <div className="model-selector-container">
              <div 
                className="model-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  setModelDropdownOpen(!modelDropdownOpen);
                }}
              >
                {model === 'deepseek-v4-pro' ? 'Pro' : 'Rápido'}
                <ChevronDown size={14} />
              </div>
              
              {modelDropdownOpen && (
                <div className="model-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div 
                    className="model-option"
                    onClick={() => {
                      setModel('deepseek-v4-pro');
                      localStorage.setItem("chimuelo_model", "deepseek-v4-pro");
                      setModelDropdownOpen(false);
                    }}
                  >
                    <span className="model-option-title">Pro {model === 'deepseek-v4-pro' && '✓'}</span>
                    <span className="model-option-desc">Matemáticas y programación avanzadas</span>
                  </div>
                  <div 
                    className="model-option"
                    onClick={() => {
                      setModel('deepseek-v4-flash');
                      localStorage.setItem("chimuelo_model", "deepseek-v4-flash");
                      setModelDropdownOpen(false);
                    }}
                  >
                    <span className="model-option-title">Rápido {model === 'deepseek-v4-flash' && '✓'}</span>
                    <span className="model-option-desc">Responde rápidamente a preguntas diarias</span>
                  </div>
                </div>
              )}
            </div>

            {attachedImage && (
              <div className="image-preview-container">
                <div className="image-preview-item">
                  <img src={attachedImage.base64} alt="Preview" className="image-preview-img" />
                  <button 
                    className="image-preview-remove" 
                    onClick={() => setAttachedImage(null)}
                  >
                    <XCircle size={16} fill="white" color="#333" />
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
              onClick={() => handleSendMessage()}
              disabled={(!inputMessage.trim() && !attachedImage) || isThinking}
            >
              <Send size={16} />
            </button>
          </div>
          <div className="disclaimer">
            ChimueloGPT puede cometer errores. Considera verificar la información importante.
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
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
