"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Plus, Settings, Send, Paperclip, Menu, X, Cat, XCircle, FileImage, ChevronDown, Smartphone, SquarePen, Download, ZoomIn, Book, Star, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type BaseMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePlaceholder?: string;
  reasoning?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: BaseMessage[];
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
  const [thinkingTask, setThinkingTask] = useState<"image" | "document" | "code" | "general">("general");
  const [pendingImagePrompt, setPendingImagePrompt] = useState<string | null>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [artifactModal, setArtifactModal] = useState<string | null>(null);
  
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [model, setModel] = useState<"deepseek-v4-pro" | "deepseek-v4-flash">("deepseek-v4-flash");
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [showVersionBanner, setShowVersionBanner] = useState(false);

  // Manual messages state (replaces useChat)
  const [displayMessages, setDisplayMessages] = useState<BaseMessage[]>([]);

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
  }, [displayMessages, currentChatId, isThinking]);

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
    setDisplayMessages([]);
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
    setIsThinking(true);

    // Add user message to display immediately
    setDisplayMessages(prev => [...prev, userMsg]);

    try {
      let finalContent = messageText || 'Describe esta imagen.';

      // Build messages history for the API
      const chatForApi = chats.find(c => c.id === targetChatId);
      const historyMsgs = (chatForApi?.messages || [])
        .filter(m => m.role && m.content)
        .map(m => ({ role: m.role, content: m.content }));
      historyMsgs.push({ role: 'user' as const, content: finalContent });

      let res: Response;
      if (imagePayload) {
        // Use Claude Haiku vision endpoint
        res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyMsgs, imageBase64: imagePayload })
        });
      } else {
        // Use DeepSeek text endpoint
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyMsgs, model })
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
        if (streamContent.includes('<generate_image>')) {
          streamContent = streamContent.replace(/<generate_image>[\s\S]*?(<\/generate_image>|$)/i, '🎨 Generando tu imagen...').trim();
        }
        const streamingMsg: BaseMessage = { id: assistantId, role: 'assistant', content: streamContent || (streamReasoning ? '' : ''), reasoning: streamReasoning || undefined };
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

      // Post-process: intercept image generation tags
      let processedContent = fullText;
      if (processedContent.includes('<generate_image>')) {
        const promptMatch = processedContent.match(/<generate_image>([\s\S]*?)(?:<\/generate_image>|$)/i);
        if (promptMatch && promptMatch[1]) {
          const imagePrompt = promptMatch[1].trim();
          // Update UI to show generating state
          setDisplayMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: processedContent.replace(/<generate_image>[\s\S]*?(?:<\/generate_image>|$)/i, '🎨 Generando tu imagen...') } : m));
          try {
            // If user attached an image, use img2img; otherwise text-to-image
            const imgBody: any = { prompt: imagePrompt };
            if (imagePayload) {
              imgBody.imageBase64 = imagePayload;
            }
            const imgRes = await fetch('/api/image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(imgBody)
            });
            if (imgRes.ok) {
              const imgData = await imgRes.json();
              processedContent = processedContent.replace(/<generate_image>[\s\S]*?(?:<\/generate_image>|$)/i, `\n\n![Imagen Generada](${imgData.url})\n\n`);
            } else {
              processedContent = processedContent.replace(/<generate_image>[\s\S]*?(?:<\/generate_image>|$)/i, '\n\n*(Error al generar la imagen)*\n\n');
            }
          } catch {
            processedContent = processedContent.replace(/<generate_image>[\s\S]*?(?:<\/generate_image>|$)/i, '\n\n*(Error de red al generar imagen)*\n\n');
          }
        }
      }

      // Extract reasoning
      const reasoningMatch = processedContent.match(/<think>([\s\S]*?)<\/think>/);
      const reasoning = reasoningMatch ? reasoningMatch[1] : undefined;
      const cleanContent = processedContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();

      const finalAssistantMsg: BaseMessage = { id: assistantId, role: 'assistant', content: cleanContent, reasoning };

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

    } catch (e: any) {
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
    setSidebarOpen(false);
  };

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
            <Download size={18} />
          </button>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <form onSubmit={handleLogin} className="auth-box-modern">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Cat size={48} color="var(--text-primary)" strokeWidth={1.5} />
          </div>
          <h1 className="auth-title-modern">ChimueloGPT</h1>
          <p style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 500, textAlign: 'center' }}>
            Un gato que te regala 20 mil pesos de valor mensual por un churu.
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Ingresa la clave familiar para entrar</p>
          
          <div className="auth-input-wrapper">
            <input
              type="text"
              className="auth-input-modern"
              placeholder="Contraseña..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="auth-btn-modern">→</button>
          </div>
          
          {authError && <p className="auth-error" style={{ marginTop: '1rem' }}>Contraseña incorrecta.</p>}

          <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '0.25rem' }}>Una aplicación creada por Rafael Sotomayor.</p>
            <p style={{ opacity: 0.7 }}>Tranquilo, él no puede ver tus chats. Se guardan en tu teléfono.</p>
          </div>
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

      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Lightbox" />
        </div>
      )}

      {sidebarOpen && (
        <div 
          className="sidebar-backdrop d-md-none" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      <div className={`sidebar ${sidebarOpen ? '' : 'sidebar-mobile-hidden'}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={() => handleSwitchChat(null)}>
            <SquarePen size={18} style={{ flexShrink: 0 }} />
            <span>Nueva conversación</span>
          </button>
        </div>

        <div className="sidebar-section-title">Conversaciones</div>
        <div className="sidebar-chat-list">
          {chats.map(chat => (
            <button
              key={chat.id}
              className={`sidebar-item ${currentChatId === chat.id ? 'active' : ''}`}
              onClick={() => handleSwitchChat(chat.id)}
            >
              <MessageSquare size={16} style={{ flexShrink: 0 }} />
              <span>{chat.title}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <button onClick={() => setPwaModalOpen(true)} className="sidebar-item">
            <Smartphone size={16} style={{ flexShrink: 0 }} />
            <span>Agrégame a tu Celu</span>
          </button>
          <button onClick={() => setSettingsOpen(true)} className="sidebar-item">
            <Settings size={16} style={{ flexShrink: 0 }} />
            <span>Configuración</span>
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
          {displayMessages.length === 0 ? (
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
            displayMessages.map((msg: any, i) => {
              const role = msg.role;
              const contentStr = msg.content || '';
              const reasoning = model === 'deepseek-v4-pro' ? (msg.reasoning || contentStr.match(/<think>([\s\S]*?)<\/think>/)?.[1]) : undefined;
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
                      const previewText = reasoning.length > 60 ? reasoning.slice(0, 60) + '...' : reasoning;
                      return (
                        <details className="reasoning-box">
                          <summary className="reasoning-summary">
                            <span className={`reasoning-icon ${isStreaming ? 'reasoning-pulse' : ''}`}>🧠</span>
                            <span>{isStreaming ? 'Pensando...' : 'Pensamiento'}</span>
                            <span className="reasoning-preview">{previewText}</span>
                          </summary>
                          <div className="reasoning-content">
                            {reasoning}
                          </div>
                        </details>
                      );
                    })()}

                    {displayContent && (() => {
                      const hasNewArtifact = displayContent.includes('<artifact>');
                      const hasOldArtifact = displayContent.includes('<artifact_html>') && !hasNewArtifact;
                      const hasImageTag = displayContent.includes('<generate_image>');
                      
                      let currentBody = displayContent;
                      let artifactContent = '';
                      let artifactTitle = 'Diseño Generado';
                      let artifactDesc = 'Haz clic para previsualizar y descargar PDF';
                      
                      if (hasImageTag) {
                        currentBody = displayContent.replace(/<generate_image>[\s\S]*?(<\/generate_image>)?/i, '🎨 Generando tu imagen... por favor espera.').trim();
                      }

                      if (hasNewArtifact) {
                        const matchHtml = displayContent.match(/<artifact_html>([\s\S]*?)(<\/artifact_html>)?/i);
                        const matchTitle = displayContent.match(/<artifact_title>([\s\S]*?)(<\/artifact_title>)?/i);
                        const matchDesc = displayContent.match(/<artifact_desc>([\s\S]*?)(<\/artifact_desc>)?/i);
                        
                        if (matchHtml && matchHtml[1]) artifactContent = matchHtml[1].trim();
                        if (matchTitle && matchTitle[1]) artifactTitle = matchTitle[1].replace(/<\/artifact_title>/, '').trim();
                        if (matchDesc && matchDesc[1]) artifactDesc = matchDesc[1].replace(/<\/artifact_desc>/, '').trim();
                        
                        const fullMatch = displayContent.match(/<artifact>([\s\S]*?)(<\/artifact>)?/i);
                        if (fullMatch) currentBody = displayContent.replace(fullMatch[0], '').trim();
                      } else if (hasOldArtifact) {
                        const match = displayContent.match(/<artifact_html>([\s\S]*?)(<\/artifact_html>)?/i);
                        if (match && match[1]) {
                          artifactContent = match[1].trim();
                          currentBody = displayContent.replace(match[0], '').trim();
                        }
                      } else {
                        // fallback for old pdf
                        currentBody = displayContent.replace(/<pdf_content>([\s\S]*?)<\/pdf_content>/i, '').trim();
                      }
                      
                      const showArtifact = hasNewArtifact || hasOldArtifact;
                      const isArtifactComplete = displayContent.includes('</artifact>') || displayContent.includes('</artifact_html>');
                      
                      return (
                        <div className="markdown-body">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{ img: ImageRenderer }}
                          >
                            {displayContent}
                          </ReactMarkdown>
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

        <div className="input-area">
          <div className="input-container">
            
            <div className="model-selector-container">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '12px', marginBottom: '2px', display: 'block' }}>Modo</span>
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
                  style={{ backgroundColor: '#10a37f', width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
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
    </div>
  );
}
