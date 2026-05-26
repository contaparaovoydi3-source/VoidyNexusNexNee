import { supabase } from './supabaseClient';

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  user_1: string;
  user_2: string;
  created_at: string;
  other_user_nickname?: string;
}

export const getOrCreateChat = async (targetUserId: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Autenticação necessária');
    const user = session.user;

    // Verifica se já existe um chat entre os dois usuários
    const { data: existingChats, error } = await supabase
      .from('chats')
      .select('*')
      .or(`and(user_1.eq.${user.id},user_2.eq.${targetUserId}),and(user_1.eq.${targetUserId},user_2.eq.${user.id})`);

    if (error) throw error;

    if (existingChats && existingChats.length > 0) {
      return existingChats[0] as ChatRoom;
    }

    // Se não existir, cria um novo
    const { data: newChat, error: createError } = await supabase
      .from('chats')
      .insert([
        { user_1: user.id, user_2: targetUserId }
      ])
      .select()
      .single();

    if (createError) throw createError;
    return newChat as ChatRoom;
  } catch (err: any) {
    console.error("getOrCreateChat failed:", err);
    throw err;
  }
};

export const sendMessage = async (chatId: string, content: string) => {
  const localFallbackKey = `void_chat_fallback_messages_${chatId}`;
  let userId = 'anonymous';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  } catch (userErr) {
    console.warn("Auth check failed in sendMessage, continuing with fallback user:", userErr);
  }

  const generatedMsgId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const optimisticMsg: ChatMessage = {
    id: generatedMsgId,
    chat_id: chatId,
    sender_id: userId,
    content: content,
    created_at: new Date().toISOString()
  };

  try {
    // Prefixa o conteúdo para isolar e vincular ao chatId correspondente na tabela messages sem a coluna física chat_id
    const prefixedContent = `[chat_id:${chatId}]${content}`;

    const { data, error } = await supabase
      .from('messages')
      .insert([
        { user_id: userId === 'anonymous' ? null : userId, content: prefixedContent }
      ])
      .select();

    if (error) {
      console.warn("⚠️ [CONEXÃO NEXUS] Falha ao persistir no Supabase (trigger inativo), usando resiliência local de contingência:", error.message);
      // Salva no storage local sob resiliência para não perder
      const localSaved = localStorage.getItem(localFallbackKey);
      const list = localSaved ? JSON.parse(localSaved) : [];
      list.push(optimisticMsg);
      localStorage.setItem(localFallbackKey, JSON.stringify(list));
      return optimisticMsg;
    }

    if (data && data.length > 0) {
      const insertedMsg = data[0];
      const realMsg: ChatMessage = {
        id: String(insertedMsg.id),
        chat_id: chatId,
        sender_id: String(insertedMsg.user_id || userId),
        content: content,
        created_at: insertedMsg.created_at || new Date().toISOString()
      };
      
      // Salva no storage local também para segurança adicional
      const localSaved = localStorage.getItem(localFallbackKey);
      const list = localSaved ? JSON.parse(localSaved) : [];
      list.push(realMsg);
      localStorage.setItem(localFallbackKey, JSON.stringify(list));
      return realMsg;
    }

    // Fallback se retornou vazio
    const localSaved = localStorage.getItem(localFallbackKey);
    const list = localSaved ? JSON.parse(localSaved) : [];
    list.push(optimisticMsg);
    localStorage.setItem(localFallbackKey, JSON.stringify(list));
    return optimisticMsg;

  } catch (err: any) {
    console.warn("⚠️ [CONEXÃO NEXUS] Erro crítico no sendMessage, salvando no canal de contingência local:", err.message);
    const localSaved = localStorage.getItem(localFallbackKey);
    const list = localSaved ? JSON.parse(localSaved) : [];
    list.push(optimisticMsg);
    localStorage.setItem(localFallbackKey, JSON.stringify(list));
    return optimisticMsg;
  }
};

export const uploadChatImage = async (file: File): Promise<string> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Autenticação necessária');

    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`; // Removido o prefixo da pasta interna, usa a raiz do bucket

    // Tentativa com bucket 'chat-images'
    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err: any) {
    console.error("uploadChatImage failed:", err);
    throw err;
  }
};

export const fetchMessages = async (chatId: string): Promise<ChatMessage[]> => {
  const localFallbackKey = `void_chat_fallback_messages_${chatId}`;
  let dbMessages: ChatMessage[] = [];

  try {
    const targetPrefix = `[chat_id:${chatId}]`;
    
    // Filtro super eficiente por padrão usando LIKE no servidor Supabase
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .like('content', `${targetPrefix}%`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      dbMessages = data.map((m: any) => {
        const rawContent = m.content || '';
        const cleanContent = rawContent.startsWith(targetPrefix) 
          ? rawContent.slice(targetPrefix.length) 
          : rawContent;

        return {
          id: String(m.id),
          chat_id: chatId,
          sender_id: String(m.user_id || m.sender_id || ''),
          content: cleanContent,
          created_at: m.created_at || new Date().toISOString()
        };
      });
    } else if (error) {
      console.warn("fetchMessages com filtro .like falhou, tentando fallback de varredura:", error.message);
      const { data: fallbackData } = await supabase
        .from('messages')
        .select('*');

      if (fallbackData) {
        dbMessages = fallbackData
          .filter((m: any) => m.content && m.content.startsWith(targetPrefix))
          .map((m: any) => {
            const rawContent = m.content || '';
            const cleanContent = rawContent.startsWith(targetPrefix) 
              ? rawContent.slice(targetPrefix.length) 
              : rawContent;

            return {
              id: String(m.id || `msg-${Math.random()}`),
              chat_id: chatId,
              sender_id: String(m.user_id || m.sender_id || ''),
              content: cleanContent,
              created_at: m.created_at || new Date().toISOString()
            };
          });
      }
    }
  } catch (err: any) {
    console.warn("Falha ao buscar mensagens do banco de dados (usando fallback de contingência local):", err.message);
  }

  // Carrega as mensagens salvas na resiliência local
  let localFallbackMessages: ChatMessage[] = [];
  try {
    const saved = localStorage.getItem(localFallbackKey);
    if (saved) {
      localFallbackMessages = JSON.parse(saved);
    }
  } catch (e) {
    console.error("Erro ao ler as mensagens de contingência local:", e);
  }

  // Obter lista de IDs de mensagens excluídas localmente
  let deletedList: string[] = [];
  try {
    const deletedKey = `void_deleted_messages_${chatId}`;
    const deletedSaved = localStorage.getItem(deletedKey);
    if (deletedSaved) {
      deletedList = JSON.parse(deletedSaved);
    }
  } catch {}

  // Mescla e remove quaisquer duplicidades baseado em ID exclusivo (ignorando deletados)
  const messagesMap = new Map<string, ChatMessage>();

  localFallbackMessages.forEach(msg => {
    if (msg && msg.id && !deletedList.includes(msg.id)) {
      messagesMap.set(msg.id, msg);
    }
  });

  dbMessages.forEach(msg => {
    if (msg && msg.id && !deletedList.includes(msg.id)) {
      messagesMap.set(msg.id, msg);
    }
  });

  // Converte para lista ordenada de forma ascendente
  const mergedList = Array.from(messagesMap.values());
  mergedList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return mergedList;
};

export const deleteMessage = async (chatId: string, messageId: string): Promise<boolean> => {
  try {
    // 1. Registrar o ID deletado no localStorage para efeito imediato local
    const deletedKey = `void_deleted_messages_${chatId}`;
    let deletedList: string[] = [];
    try {
      const deletedSaved = localStorage.getItem(deletedKey);
      if (deletedSaved) {
        deletedList = JSON.parse(deletedSaved);
      }
    } catch {}
    if (!deletedList.includes(messageId)) {
      deletedList.push(messageId);
      localStorage.setItem(deletedKey, JSON.stringify(deletedList));
    }

    // 2. Limpar do fallback/contingência local
    const localFallbackKey = `void_chat_fallback_messages_${chatId}`;
    try {
      const saved = localStorage.getItem(localFallbackKey);
      if (saved) {
        const list = JSON.parse(saved);
        const filtered = list.filter((m: any) => String(m.id) !== String(messageId));
        localStorage.setItem(localFallbackKey, JSON.stringify(filtered));
      }
    } catch {}

    // 3. Remover do Supabase
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      console.warn("Erro ao excluir do Supabase (removido localmente apenas por segurança):", error.message);
    }
    return !error;
  } catch (err) {
    console.error("Erro na função deleteMessage:", err);
    return false;
  }
};

export const fetchMyChats = async (): Promise<ChatRoom[]> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .or(`user_1.eq.${session.user.id},user_2.eq.${session.user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("fetchMyChats network error:", err);
    return [];
  }
};
