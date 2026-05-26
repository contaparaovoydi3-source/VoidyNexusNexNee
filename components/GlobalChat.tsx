import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { fetchMessages, sendMessage, ChatMessage, uploadChatImage, deleteMessage } from '../chatService';

const renderFormattedContent = (content: string = '') => {
  const tagRegex = /(\[[BbIiCcSs]{1,4}\])/g;
  const parts = content.split(tagRegex);

  let hasCentering = false;
  const matches = content.match(tagRegex);
  if (matches) {
    for (const match of matches) {
      if (match.toLowerCase().includes('c')) {
        hasCentering = true;
        break;
      }
    }
  }

  let currentBold = false;
  let currentItalic = false;
  let currentUnderline = false;
  let currentCentered = false;

  const renderedSpans = parts.map((part, index) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      const tagContent = part.slice(1, -1).toLowerCase();
      if (tagContent.includes('b')) currentBold = !currentBold;
      if (tagContent.includes('i')) currentItalic = !currentItalic;
      if (tagContent.includes('s')) currentUnderline = !currentUnderline;
      if (tagContent.includes('c')) currentCentered = !currentCentered;
      return null;
    }

    if (!part) return null;

    const classes = [];
    if (currentBold) classes.push('font-bold');
    if (currentItalic) classes.push('italic');
    if (currentUnderline) classes.push('underline');
    if (currentCentered) classes.push('text-center block w-full');

    return (
      <span key={index} className={classes.join(' ')}>
        {part}
      </span>
    );
  });

  return (
    <p className={`text-[11px] font-medium leading-relaxed tracking-wide select-text whitespace-pre-wrap ${hasCentering ? 'text-center w-full' : ''}`}>
      {renderedSpans}
    </p>
  );
};

interface GlobalChatProps {
  chatId: string;
  onBack: () => void;
  userName: string;
  userAvatar: string;
  otherUserNickname: string;
  otherUserAvatar?: string;
  currentUserId: string;
  onDeleteSession?: (chatId: string) => void;
}

const GlobalChat: React.FC<GlobalChatProps> = ({ 
  chatId, onBack, userName, userAvatar, otherUserNickname, otherUserAvatar, currentUserId, onDeleteSession
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  // Estados dos Menus de Hold e Detalhes
  const [heldMessage, setHeldMessage] = useState<ChatMessage | null>(null);
  const [showDetailsMessage, setShowDetailsMessage] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartPosRef = useRef<{ x: number, y: number } | null>(null);

  // Estados e referências para a funcionalidade de "Digitando..."
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const messageChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Estados de customização do chat
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [userBubbleColor, setUserBubbleColor] = useState(() => localStorage.getItem(`glob_chat_user_bubble_${chatId}`) || '#0891b2');
  const [partnerBubbleColor, setPartnerBubbleColor] = useState(() => localStorage.getItem(`glob_chat_partner_bubble_${chatId}`) || 'rgba(255, 255, 255, 0.05)');
  const [chatBgColor, setChatBgColor] = useState(() => localStorage.getItem(`glob_chat_bg_${chatId}`) || '#02040a');

  const updateDatabaseBackground = async (newBg: string) => {
    localStorage.setItem(`glob_chat_bg_${chatId}`, newBg);
    if (messageChannelRef.current) {
      messageChannelRef.current.send({
        type: 'broadcast',
        event: 'bg_change',
        payload: { backgroundUrl: newBg }
      });
    }
    try {
      const { error } = await supabase
        .from('chats')
        .update({ background_url: newBg })
        .eq('id', chatId);
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao sincronizar fundo com parceiro:", err);
    }
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const imageUrl = await uploadChatImage(file);
        setChatBgColor(imageUrl);
        await updateDatabaseBackground(imageUrl);
      } catch (err) {
        console.error("Erro no upload da imagem de fundo, usando FileReader:", err);
        const reader = new FileReader();
        reader.onloadend = async () => {
          if (reader.result) {
            const base64Bg = reader.result as string;
            setChatBgColor(base64Bg);
            await updateDatabaseBackground(base64Bg);
          }
        };
        reader.readAsDataURL(file);
      } finally {
        setIsUploading(false);
      }
    }
  };

  useEffect(() => {
    setUserBubbleColor(localStorage.getItem(`glob_chat_user_bubble_${chatId}`) || '#0891b2');
    setPartnerBubbleColor(localStorage.getItem(`glob_chat_partner_bubble_${chatId}`) || 'rgba(255, 255, 255, 0.05)');
    setChatBgColor(localStorage.getItem(`glob_chat_bg_${chatId}`) || '#02040a');
  }, [chatId]);

  useEffect(() => {
    const loadChatAndMessages = async () => {
      try {
        // Obter configuração de fundo diretamente da tabela 'chats'
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select('background_url')
          .eq('id', chatId)
          .maybeSingle();
        
        if (!chatError && chatData) {
          const fetchedBg = chatData.background_url || '#02040a';
          setChatBgColor(fetchedBg);
          localStorage.setItem(`glob_chat_bg_${chatId}`, fetchedBg);
        }

        const data = await fetchMessages(chatId);
        // Filtrar mensagens legadas para preservar o histórico do chat limpo
        const filtered = data.filter(m => !m.content || !m.content.startsWith('SINAL_CHAT_BG:'));
        setMessages(filtered);
      } catch (err) {
        console.error("Erro ao carregar mensagens e fundo:", err);
      } finally {
        setLoading(false);
      }
    };

    loadChatAndMessages();

    // Polling fallback - recarrega as mensagens do banco a cada 3 segundos como redundância garantida
    const pollingIntervalId = setInterval(async () => {
      try {
        const data = await fetchMessages(chatId);
        const filtered = data.filter(m => !m.content || !m.content.startsWith('SINAL_CHAT_BG:'));

        let deletedList: string[] = [];
        try {
          const deletedKey = `void_deleted_messages_${chatId}`;
          const deletedSaved = localStorage.getItem(deletedKey);
          if (deletedSaved) {
            deletedList = JSON.parse(deletedSaved);
          }
        } catch {}
        
        setMessages(prev => {
          if (filtered.length === 0 && prev.length > 0) {
            return prev;
          }

          const databaseIds = new Set(filtered.map(m => m.id));
          const prevMap = new Map<string, ChatMessage>(prev.map(m => [m.id, m]));
          
          let changed = false;
          const nextMessages = [...prev];

          filtered.forEach(dbMsg => {
            const existing = prevMap.get(dbMsg.id);
            if (!existing) {
              const tempMatch = nextMessages.find(t => 
                t.id.startsWith('temp-') && 
                t.sender_id === dbMsg.sender_id && 
                t.content === dbMsg.content
              );

              if (tempMatch) {
                const idx = nextMessages.indexOf(tempMatch);
                nextMessages[idx] = dbMsg;
              } else {
                nextMessages.push(dbMsg);
              }
              changed = true;
            } else if (existing.content !== dbMsg.content || existing.created_at !== dbMsg.created_at) {
              const idx = nextMessages.indexOf(existing);
              nextMessages[idx] = dbMsg;
              changed = true;
            }
          });

          const cleanedMessages = nextMessages.filter(m => {
            if (deletedList.includes(m.id)) return false;
            if (m.id.startsWith('temp-')) return true;
            
            // Se a mensagem está no banco de dados, mantém sempre
            if (databaseIds.has(m.id)) return true;
            
            // Se a mensagem foi enviada pelo próprio usuário atual e é muito recente (menos de 60s),
            // mantém para evitar sumiço por lag de replicação/indexação do Supabase
            if (m.sender_id === currentUserId) {
              const ageMs = Date.now() - new Date(m.created_at).getTime();
              if (ageMs < 60000) {
                return true;
              }
            }
            
            // Caso contrário, se não está no banco e não é uma mensagem recente do próprio usuário,
            // significa que foi de fato excluída
            return false;
          });

          if (cleanedMessages.length !== prev.length) {
            changed = true;
          }

          if (changed) {
            return cleanedMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          }
          return prev;
        });
      } catch (err) {
        console.warn("Falha no polling de mensagens redundante:", err);
      }
    }, 3000);

    // Canal em Tempo Real para Mensagens e alteração de Fundo
    const messageChannel = supabase
      .channel(`chat:messages:${chatId}`)
      .on(
        'broadcast',
        { event: 'new_msg' },
        (response) => {
          const { message } = response.payload || {};
          if (message && message.sender_id !== currentUserId) {
            // Salva a mensagem recebida via broadcast no fallback local de resiliência permanente
            try {
              const localFallbackKey = `void_chat_fallback_messages_${chatId}`;
              const localSaved = localStorage.getItem(localFallbackKey);
              const list = localSaved ? JSON.parse(localSaved) : [];
              if (!list.some((m: any) => m.id === message.id)) {
                list.push(message);
                localStorage.setItem(localFallbackKey, JSON.stringify(list));
              }
            } catch (localErr) {
              console.warn("Erro ao salvar mensagem recebida via broadcast no fallback local:", localErr);
            }

            setMessages(prev => {
              if (prev.find(m => m.id === message.id)) return prev;
              const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.sender_id === message.sender_id && m.content === message.content));
              return [...filtered, message];
            });
          }
        }
      )
      .on(
        'broadcast',
        { event: 'typing' },
        (response) => {
          const { userId: senderTypingId, isTyping } = response.payload || {};
          if (senderTypingId !== currentUserId) {
            setPartnerIsTyping(!!isTyping);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'bg_change' },
        (response) => {
          const { backgroundUrl } = response.payload || {};
          if (backgroundUrl) {
            setChatBgColor(backgroundUrl);
            localStorage.setItem(`glob_chat_bg_${chatId}`, backgroundUrl);
          }
        }
      )
      .subscribe();

    messageChannelRef.current = messageChannel;

    // Canal em Tempo Real para Atualizações do Chat (como mudar o fundo)
    const chatChannel = supabase
      .channel(`chat:metadata:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: `id=eq.${chatId}`
        },
        (payload) => {
          const updatedChat = payload.new as any;
          if (updatedChat) {
            const newBg = updatedChat.background_url || '#02040a';
            setChatBgColor(newBg);
            localStorage.setItem(`glob_chat_bg_${chatId}`, newBg);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollingIntervalId);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(chatChannel);
      messageChannelRef.current = null;
      setPartnerIsTyping(false);
    };
  }, [chatId, currentUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current && inputText) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [inputText]);

  useEffect(() => {
    if (scrollRef.current && partnerIsTyping) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [partnerIsTyping]);

  useEffect(() => {
    if (!inputText) {
      if (messageChannelRef.current) {
        messageChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserId, isTyping: false }
        });
      }
      return;
    }

    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      if (messageChannelRef.current) {
        messageChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserId, isTyping: true }
        });
      }
      lastTypingSentRef.current = now;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      if (messageChannelRef.current) {
        messageChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserId, isTyping: false }
        });
      }
    }, 3000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [inputText, currentUserId]);

  const scrollToMessage = (msgId: string) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('neon-blink');
      setTimeout(() => {
        element.classList.remove('neon-blink');
      }, 2400);
    }
  };

  const handleStartHold = (e: React.MouseEvent | React.TouchEvent, msg: ChatMessage) => {
    const pos = 'touches' in e 
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    
    holdStartPosRef.current = pos;

    holdTimerRef.current = window.setTimeout(() => {
      setHeldMessage(msg);
      if (navigator.vibrate) navigator.vibrate(50);
      holdStartPosRef.current = null;
    }, 1000);
  };

  const handleMoveHold = (e: React.MouseEvent | React.TouchEvent) => {
    if (!holdStartPosRef.current) return;
    
    const pos = 'touches' in e 
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    
    const dx = Math.abs(pos.x - holdStartPosRef.current.x);
    const dy = Math.abs(pos.y - holdStartPosRef.current.y);
    
    if (dx > 10 || dy > 10) {
      handleEndHold();
    }
  };

  const handleEndHold = () => {
    if (holdTimerRef.current) { 
      clearTimeout(holdTimerRef.current); 
      holdTimerRef.current = null; 
    }
    holdStartPosRef.current = null;
  };

  /*
   =============================================================================
   SUGESTÃO DE FUNÇÃO DE ENVIO PARA O SEU APLICATIVO REACT NATIVE (COPY & PASTE):
   
   async function handleSendMessage(text) {
     if (!text.trim()) return;
     
     // 1. Obter o usuário autenticado via supabase.auth.getUser()
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) {
       console.error("Usuário não autenticado");
       return;
     }

     try {
       // 2. Modifica o .insert() para passar apenas 'user_id' e 'content'. Removido 'receiver_id'
       // E usamos o '.select()' logo após o '.insert()' para retornar o objeto persistido
       const { data, error } = await supabase
         .from('messages')
         .insert([
           { user_id: user.id, content: text.trim() }
         ])
         .select();

       if (error) throw error;

       if (data && data.length > 0) {
         const createdMessage = data[0];
         
         // Formata o objeto retornado de acordo com seu schema local
         const formattedMessage = {
           id: String(createdMessage.id),
           sender_id: String(createdMessage.user_id),
           content: createdMessage.content,
           created_at: createdMessage.created_at || new Date().toISOString()
         };

         // 3. Pegue esse objeto retornado do banco e insira-o imediatamente no estado local (ex: setMessages)
         setMessages(prev => [...prev, formattedMessage]);
       }
     } catch (err) {
       console.error("Erro ao enviar mensagem:", err);
     }
   }
   =============================================================================
  */

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    let text = inputText.trim();
    if (replyingTo) {
      text = `[REPLY:${replyingTo.id}]${text}`;
      setReplyingTo(null);
    }
    setInputText('');

    // Adiciona a mensagem de forma otimista localmente sem atrasos
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      chat_id: chatId,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // Chama a função sendMessage centralizada que possui um mecanismo híbrido resiliente (Supabase + LocalStorage fallback)
      const realMessage = await sendMessage(chatId, text);

      // Substitui a mensagem otimista temporária do estado interno com o resultado persistido/híbrido
      setMessages(prev => prev.map(m => m.id === tempId ? realMessage : m));
      
      // Broadcast do sinal da mensagem instantaneamente via canal ativo para entrega em tempo real
      if (messageChannelRef.current) {
        messageChannelRef.current.send({
          type: 'broadcast',
          event: 'new_msg',
          payload: { message: realMessage }
        });
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      // Mantém a mensagem de forma segura no estado sem apagá-la, recorrendo a garantias híbridas locais
      const fallbackMsg: ChatMessage = {
        id: `local-err-${Date.now()}`,
        chat_id: chatId,
        sender_id: currentUserId,
        content: text,
        created_at: new Date().toISOString()
      };
      setMessages(prev => prev.map(m => m.id === tempId ? fallbackMsg : m));
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadChatImage(file);
      const realMessage = await sendMessage(chatId, `SINAL_IMG:${imageUrl}`);
      if (realMessage) {
        setMessages(prev => {
          if (prev.find(m => m.id === realMessage.id)) return prev;
          return [...prev, realMessage];
        });
        if (messageChannelRef.current) {
          messageChannelRef.current.send({
            type: 'broadcast',
            event: 'new_msg',
            payload: { message: realMessage }
          });
        }
      }
    } catch (err: any) {
      console.error("Erro no upload de imagem:", err);
      if (err.message && err.message.includes('CONFIG_REQUIRED')) {
        alert(err.message.replace('CONFIG_REQUIRED: ', ''));
      } else {
        alert("Falha ao transmitir imagem. Verique se o bucket 'chat-images' existe no Supabase.");
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };  return (
    <div 
      className="flex-1 h-full w-full relative overflow-hidden flex flex-col animate-in fade-in duration-500 bg-cover bg-center"
      style={{ 
        backgroundColor: chatBgColor.startsWith('#') ? chatBgColor : 'transparent',
        backgroundImage: (chatBgColor.startsWith('data:') || chatBgColor.startsWith('http')) ? `url(${chatBgColor})` : 'none'
      }}
    >
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,_#22d3ee_0%,_transparent_70%)]"></div>

      <header className="px-6 py-5 flex items-center justify-between relative z-50 bg-transparent shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white transition-all active:scale-90">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        
        <div className="flex flex-col items-center">
           <h2 className="text-[10px] font-black font-syncopate text-white uppercase tracking-[0.3em]">{otherUserNickname}</h2>
           <span className="text-[6px] font-black text-cyan-400 uppercase tracking-[0.2em] mt-1 flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"></div>
              Link Criptografado
           </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-white/10 bg-black overflow-hidden shadow-xl">
             <img src={otherUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserNickname}`} className="w-full h-full object-cover" alt="Avatar" />
          </div>
          <button onClick={() => setIsCustomizing(true)} className="p-1 text-slate-400 hover:text-white transition-all active:scale-90 cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 relative z-10 pb-32">
        {loading ? (
          <div className="h-full flex items-center justify-center opacity-30">
            <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center gap-4">
             <span className="text-3xl">📡</span>
             <p className="text-[8px] font-black uppercase tracking-[0.4em]">Inicie a Transmissão</p>
          </div>
        ) : (
          messages.map((msg) => {
            const replyRegex = /^\[REPLY:([^\]]+)\](.*)/s;
            const replyMatch = msg.content.match(replyRegex);
            const isReply = !!replyMatch;
            const replyId = replyMatch ? replyMatch[1] : '';
            const rawContent = replyMatch ? replyMatch[2] : msg.content;

            const isImage = rawContent.startsWith('SINAL_IMG:') || 
                           (rawContent.startsWith('http') && rawContent.match(/\.(jpeg|jpg|gif|png|webp|svg)/i));
            
            const imageUrl = rawContent.startsWith('SINAL_IMG:') 
                              ? rawContent.replace('SINAL_IMG:', '') 
                              : rawContent;

            const isMe = msg.sender_id === currentUserId;

            // Encontrar mensagem respondida
            const repliedMessage = isReply ? messages.find(m => m.id === replyId) : null;
            let repliedText = '';
            if (repliedMessage) {
              const rMatch = repliedMessage.content.match(replyRegex);
              const origContent = rMatch ? rMatch[2] : repliedMessage.content;
              repliedText = origContent.startsWith('SINAL_IMG:') ? '[Imagem]' : origContent;
            }

            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div 
                  className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-2xl relative cursor-pointer select-none transition-all duration-150 active:scale-[0.99] hover:brightness-[1.03] ${
                    isMe 
                      ? 'text-white rounded-tr-none border border-cyan-500/10' 
                      : 'text-slate-300 rounded-tl-none border border-white/5'
                  }`}
                  style={{
                    backgroundColor: isMe ? userBubbleColor : partnerBubbleColor
                  }}
                  onMouseDown={(e) => handleStartHold(e, msg)}
                  onTouchStart={(e) => handleStartHold(e, msg)}
                  onMouseMove={handleMoveHold}
                  onTouchMove={handleMoveHold}
                  onMouseUp={handleEndHold}
                  onTouchEnd={handleEndHold}
                  onMouseLeave={handleEndHold}
                >
                  {isReply && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToMessage(replyId);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="mb-2 text-[8px] opacity-75 bg-black/30 p-2 rounded-lg border-l-2 border-cyan-400 max-w-full cursor-pointer hover:bg-black/50 active:scale-95 transition-all text-left"
                    >
                      <span className="font-bold block uppercase tracking-wider text-[6px] text-cyan-300">Resposta a:</span>
                      <span className="line-clamp-2 italic">{repliedText || 'Sinal original'}</span>
                    </div>
                  )}

                  {isImage ? (
                    <div className="rounded-lg overflow-hidden border border-white/5 shadow-inner bg-black/20">
                      <img 
                        src={imageUrl} 
                        className="max-w-full max-h-[300px] object-contain block" 
                        alt="Sinal Visual" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    renderFormattedContent(rawContent)
                  )}
                  <span className="block text-[6px] font-black opacity-30 mt-1 uppercase tracking-tighter text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        
        {partnerIsTyping && (
          <div className="flex justify-start items-center gap-2 px-4 py-2 text-[10px] text-cyan-400 font-bold tracking-widest uppercase animate-pulse select-none">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>{otherUserNickname} transmitindo sinal...</span>
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[92%] md:max-w-2xl z-50 flex flex-col gap-2">
        {replyingTo && (
          <div className="flex items-center justify-between bg-black/60 backdrop-blur-xl border border-cyan-500/30 px-4 py-2 rounded-xl text-[10px] text-slate-300 z-50 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-2 truncate">
              <span className="text-cyan-400 font-bold">↩️ Respondendo a:</span>
              <span className="truncate opacity-80">
                {(() => {
                  const raw = replyingTo.content;
                  const localReplyRegex = /^\[REPLY:([^\]]+)\](.*)/s;
                  const rMatch = raw.match(localReplyRegex);
                  const contentClean = rMatch ? rMatch[2] : raw;
                  return contentClean.startsWith('SINAL_IMG:') ? '[Imagem]' : contentClean;
                })()}
              </span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:text-white text-slate-400 active:scale-90 font-bold transition-colors cursor-pointer">✕</button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <div className="flex-1 relative group">
            <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5 group-focus-within:border-cyan-500/10 transition-all"></div>
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => {
                setTimeout(() => {
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                  }
                }, 120);
              }}
              placeholder="Transmitir sinal..."
              rows={1}
              className="w-full bg-transparent relative z-10 px-7 py-4 text-[12px] text-white outline-none font-medium placeholder:text-slate-800 tracking-wider resize-none max-h-32 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            />
          </div>
          
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full active:scale-90 transition-all shadow-2xl shadow-white/10 disabled:opacity-10 cursor-pointer shrink-0"
          >
            <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>

          <button 
            type="button"
            onClick={handleImageClick}
            disabled={isUploading}
            className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 text-slate-400 rounded-full active:scale-90 transition-all hover:text-white cursor-pointer shrink-0 disabled:opacity-20"
          >
            {isUploading ? (
              <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
            )}
          </button>
        </form>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange}
        />
      </div>

      {isCustomizing && (
        <div className="fixed inset-0 z-[2000] bg-[#02040a] flex flex-col animate-in slide-in-from-right duration-500 font-sans">
          <header className="px-6 py-6 flex items-center justify-between bg-black/40 backdrop-blur-xl border-b border-white/5 shrink-0">
             <button onClick={() => setIsCustomizing(false)} className="p-2 text-slate-400 font-bold active:scale-95 transition-all text-sm">✕</button>
             <h2 className="text-[10px] font-syncopate font-black text-white uppercase tracking-[0.3em]">
               Configurações do Chat
             </h2>
             <button 
               onClick={async () => {
                 localStorage.setItem(`glob_chat_user_bubble_${chatId}`, userBubbleColor);
                 localStorage.setItem(`glob_chat_partner_bubble_${chatId}`, partnerBubbleColor);
                 
                 const savedBg = localStorage.getItem(`glob_chat_bg_${chatId}`) || '#02040a';
                 if (chatBgColor !== savedBg) {
                   localStorage.setItem(`glob_chat_bg_${chatId}`, chatBgColor);
                   try {
                     const { error: updateError } = await supabase
                       .from('chats')
                       .update({ background_url: chatBgColor })
                       .eq('id', chatId);
                     if (updateError) throw updateError;
                   } catch (err) {
                     console.error("Erro ao sincronizar fundo com parceiro:", err);
                   }
                 }
                 setIsCustomizing(false);
               }} 
               className="p-2 text-cyan-400 font-black text-[10px] uppercase tracking-wide active:scale-95 transition-all"
             >
               Salvar
             </button>
          </header>
          
          <main className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar bg-[#02040a]/90">
             <div className="w-full space-y-6">
                
                {/* MUDAR O FUNDO (IMAGEM OU COR) */}
                <div className="space-y-2">
                   <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block ml-1">Mudar Fundo (Imagem ou Cor)</label>
                   <div className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                     <div className="flex items-center gap-4">
                       <input 
                         type="color" 
                         value={chatBgColor.startsWith('#') ? chatBgColor : '#02040a'} 
                         onChange={(e) => { setChatBgColor(e.target.value); updateDatabaseBackground(e.target.value); }} 
                         className="w-12 h-12 rounded-xl bg-transparent border-0 cursor-pointer" 
                       />
                       <button 
                         type="button"
                         onClick={() => bgImageInputRef.current?.click()} 
                         className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[8px] font-black uppercase text-center active:scale-95 transition-all"
                       >
                         Escolher Imagem de Fundo
                       </button>
                       <input 
                         type="file" 
                         ref={bgImageInputRef} 
                         className="hidden" 
                         accept="image/*" 
                         onChange={handleBgImageUpload} 
                       />
                     </div>
                     {(chatBgColor.startsWith('data:') || chatBgColor.startsWith('http')) && (
                       <div className="relative w-full h-24 rounded-lg overflow-hidden border border-white/5 bg-black/20 group">
                         <img src={chatBgColor} className="w-full h-full object-cover" alt="Background Preview" />
                         <button 
                           type="button"
                           onClick={async () => { setChatBgColor('#02040a'); await updateDatabaseBackground('#02040a'); }} 
                           className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-lg text-[6px] text-white font-bold uppercase active:scale-95 transition-all"
                         >
                           Remover Imagem
                         </button>
                       </div>
                     )}
                   </div>
                </div>

                {/* MUDAR BALÃO */}
                <div className="space-y-4">
                   <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block ml-1">Mudar Balão</label>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
                         <input 
                           type="color" 
                           value={userBubbleColor} 
                           onChange={(e) => setUserBubbleColor(e.target.value)} 
                           className="w-12 h-12 rounded-xl bg-transparent border-0 cursor-pointer" 
                         />
                         <span className="text-[8px] font-black text-white uppercase mt-1">Seu Balão</span>
                      </div>
                      <div className="space-y-2 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
                         <input 
                           type="color" 
                           value={partnerBubbleColor} 
                           onChange={(e) => setPartnerBubbleColor(e.target.value)} 
                           className="w-12 h-12 rounded-xl bg-transparent border-0 cursor-pointer" 
                         />
                         <span className="text-[8px] font-black text-white uppercase mt-1">Balão do Parceiro</span>
                      </div>
                   </div>
                </div>

                {/* OPÇÃO DE SAIR DA CONVERSA */}
                <div className="pt-6 border-t border-white/5 space-y-3">
                  <button 
                    type="button"
                    onClick={() => {
                      if (onDeleteSession) {
                        onDeleteSession(chatId);
                      } else {
                        if (confirm("Deseja realmente sair e apagar esta conversa?")) {
                          onBack();
                        }
                      }
                    }}
                    className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-2xl text-[9px] font-black uppercase text-red-500 tracking-widest active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                  >
                    🚪 Sair da Conversa
                  </button>

                  <button 
                    type="button"
                    onClick={async () => {
                      if (confirm("Limpar personalização e restaurar padrão?")) {
                        setUserBubbleColor('#0891b2');
                        setPartnerBubbleColor('rgba(255, 255, 255, 0.05)');
                        setChatBgColor('#02040a');
                        localStorage.removeItem(`glob_chat_user_bubble_${chatId}`);
                        localStorage.removeItem(`glob_chat_partner_bubble_${chatId}`);
                        localStorage.removeItem(`glob_chat_bg_${chatId}`);
                        try {
                          const { error: resetError } = await supabase
                            .from('chats')
                            .update({ background_url: '#02040a' })
                            .eq('id', chatId);
                          if (resetError) throw resetError;
                        } catch (err) {
                          console.error("Erro ao redefinir fundo:", err);
                        }
                        setIsCustomizing(false);
                      }
                    }}
                    className="w-full py-2.5 text-slate-500 hover:text-slate-300 text-[8px] font-black uppercase text-center tracking-wider transition-colors"
                  >
                    Restaurar Padrão
                  </button>
                </div>
             </div>
          </main>
        </div>
      )}

      {heldMessage && (
        <div key="held-msg-overlay" className="fixed inset-0 z-[1500] flex items-center justify-center p-6 animate-in fade-in duration-300 pointer-events-none">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto" onClick={() => setHeldMessage(null)} />
           <div className="relative w-full max-w-[280px] bg-[#0a0c1a]/95 border border-cyan-500/30 rounded-[2.5rem] p-6 shadow-2xl flex flex-col gap-2 pointer-events-auto">
              <button 
                onClick={() => { setReplyingTo(heldMessage); setHeldMessage(null); }} 
                className="w-full text-left px-6 py-4 hover:bg-white/5 rounded-2xl text-[10px] font-black uppercase text-white flex items-center gap-3 cursor-pointer"
              >
                <span>↩️</span> Responder texto
              </button>
              
              <button 
                onClick={() => { 
                  const raw = heldMessage.content;
                  const replyRegex = /^\[REPLY:[^\]]+\](.*)/s;
                  const match = raw.match(replyRegex);
                  const cleanText = match ? match[2] : raw;
                  if (!cleanText.startsWith('SINAL_IMG:')) {
                    navigator.clipboard.writeText(cleanText);
                  }
                  setHeldMessage(null); 
                }} 
                className="w-full text-left px-6 py-4 hover:bg-white/5 rounded-2xl text-[10px] font-black uppercase text-white flex items-center gap-3 cursor-pointer"
              >
                <span>📋</span> Copiar texto
              </button>
              
              {heldMessage.sender_id === currentUserId && (
                <button 
                  onClick={async () => { 
                    try {
                      await deleteMessage(chatId, heldMessage.id);
                      setMessages(prev => prev.filter(m => m.id !== heldMessage.id));
                    } catch (err) {
                      console.error("Erro ao deletar sinal:", err);
                    }
                    setHeldMessage(null); 
                  }} 
                  className="w-full text-left px-6 py-4 hover:bg-red-500/10 rounded-2xl text-[10px] font-black uppercase text-red-500 flex items-center gap-3 cursor-pointer"
                >
                  <span>🗑️</span> Apagar texto
                </button>
              )}

              <button 
                onClick={() => { setShowDetailsMessage(heldMessage); setHeldMessage(null); }} 
                className="w-full text-left px-6 py-4 hover:bg-white/5 rounded-2xl text-[10px] font-black uppercase text-white flex items-center gap-3 cursor-pointer"
              >
                <span>ℹ️</span> Detalhes
              </button>

              <button onClick={() => setHeldMessage(null)} className="mt-2 py-3 text-[8px] font-black uppercase text-slate-500 hover:text-white border-t border-white/5 pt-4 cursor-pointer">Abortar</button>
           </div>
        </div>
      )}

      {showDetailsMessage && (
        <div key="details-msg-overlay" className="fixed inset-0 z-[1600] flex items-center justify-center p-6 animate-in fade-in duration-300 pointer-events-none">
           <div className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-auto" onClick={() => setShowDetailsMessage(null)} />
           <div className="relative w-full max-w-[340px] bg-[#02040a] border border-cyan-500/40 rounded-[2rem] p-6 shadow-2xl flex flex-col gap-4 pointer-events-auto font-sans">
              <div className="flex border-b border-white/10 pb-3 items-center justify-between">
                <span className="text-[10px] font-black font-syncopate text-cyan-400 uppercase tracking-widest">Detalhes do Sinal</span>
                <span className="text-[8px] font-mono opacity-50 px-2 py-0.5 bg-white/5 border border-white/10 rounded-md">ID: {showDetailsMessage.id.substring(0, 8)}</span>
              </div>
              <div className="space-y-3 text-[11px]">
                <div className="flex justify-between border-b border-white/5 py-1">
                  <span className="text-slate-500 uppercase font-black text-[8px] tracking-wider">Autor</span>
                  <span className="text-white font-bold">{showDetailsMessage.sender_id === currentUserId ? 'Você' : otherUserNickname}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-1">
                  <span className="text-slate-500 uppercase font-black text-[8px] tracking-wider font-sans">Data & Hora</span>
                  <span className="text-white font-bold font-mono">{new Date(showDetailsMessage.created_at).toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-white/5 py-1">
                  <span className="text-slate-500 uppercase font-black text-[8px] tracking-wider font-sans">Conteúdo Bruto</span>
                  <p className="text-slate-300 bg-white/[0.02] p-3 rounded-xl border border-white/5 font-mono text-[9px] max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {(() => {
                      const raw = showDetailsMessage.content;
                      const replyRegex = /^\[REPLY:[^\]]+\](.*)/s;
                      const rMatch = raw.match(replyRegex);
                      const contentClean = rMatch ? rMatch[2] : raw;
                      return contentClean.startsWith('SINAL_IMG:') ? contentClean.replace('SINAL_IMG:', '[Sinal Visual URL: ') + ']' : contentClean;
                    })()}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDetailsMessage(null)} className="w-full py-3 bg-white/5 border border-white/10 text-[9px] font-black uppercase text-white rounded-2xl hover:bg-white/10 active:scale-95 transition-all text-center cursor-pointer">Fechar</button>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default GlobalChat;
