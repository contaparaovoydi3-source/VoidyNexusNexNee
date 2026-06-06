
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, Message, Character, UserProfile, ChatSession, FeedPost, Community, Notification, MuralPost, CityMemberData } from './types';
import MainConsole from './components/MainConsole';
import CharacterCreation from './components/CharacterCreation';
import Lobby, { DragonO } from './components/Lobby';
import SocialSidebar from './components/SocialSidebar';
import ProfileView from './components/ProfileView';
import FeedView from './components/FeedView';
import WikiCreation from './components/WikiCreation';
import PublicChat from './components/PublicChat';
import CommunityCreation from './components/CommunityCreation';
import CommunityView from './components/CommunityView';
import CommunitySearch from './components/CommunitySearch';
import AuthScreen from './components/AuthScreen';
import HelpOverlay from './components/HelpOverlay';
import NotificationCenter from './components/NotificationCenter';
import VoiceInterface from './components/VoiceInterface';
import MessagesArchive from './components/MessagesArchive';
import RecentCommunityChats from './components/RecentCommunityChats';
import RankingView from './components/RankingView';
import SocialDiscovery from './components/SocialDiscovery';
import InviteFollowers from './components/InviteFollowers';
import DraftsView from './components/DraftsView';
import CommunityPreview from './components/CommunityPreview';
import OnboardingScreen from './components/OnboardingScreen';
import MembersView from './components/MembersView';
import GlobalChat from './components/GlobalChat';
import { useExpoNotifications } from './components/useExpoNotifications';
import { GoogleGenAI } from '@google/genai';
import { AIService } from './aiService';
import { supabase } from './supabaseClient';
import { SYSTEM_INSTRUCTION, MODEL_TEXT, MODEL_IMAGE } from './constants';
import { TEST_COMMUNITIES, INITIAL_POSTS, DEFAULT_THEMES } from './data';

interface LocalUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
}

const AVAILABLE_GLOBAL_FRAMES = [
  { id: 'frame-event-void', name: 'Pulso do Evento', price: 1, color: '#10b981', style: 'frame-event-art', category: 'EVENTO' },
  { id: 'frame-neon-cyan', name: 'Borda Neon Ciano', price: 45, color: '#22d3ee', style: 'frame-neon-cyan-art', category: 'SIMPLES' },
  { id: 'frame-neon-pink', name: 'Borda Neon Rosa', price: 80, color: '#ec4899', style: 'frame-neon-pink-art', category: 'SIMPLES' },
  { id: 'frame-abyssal-beast', name: 'Besta do Abismo', price: 450, color: '#ef4444', style: 'frame-abyssal-beast-art', category: 'LENDÁRIA' },
  { id: 'frame-ouroboros-gold', name: 'Ouroboros Áureo', price: 850, color: '#fbbf24', style: 'frame-ouroboros-art', category: 'LENDÁRIA' },
  { id: 'frame-void-god', name: 'Lorde do Vácuo', price: 1400, color: '#a855f7', style: 'frame-void-god-art', category: 'LIMITADA' },
  { id: 'frame-celestial-angel', name: 'Anjo da Singularidade', price: 1950, color: '#93c5fd', style: 'frame-angel-art', category: 'LIMITADA' }
];

const AVAILABLE_GLOBAL_BUBBLES = [
  { id: 'bubble-event-glitch', name: 'Glitch de Evento', price: 1, color: '#10b981', style: 'bubble-event-art', category: 'EVENTO', icon: '📡' },
  { id: 'bubble-neon-cyan', name: 'Sinal Neon Ciano', price: 30, color: '#22d3ee', style: 'bg-cyan-500/10 border-cyan-500', category: 'SIMPLES', icon: '☁️' },
  { id: 'bubble-neon-pink', name: 'Sinal Neon Rosa', price: 75, color: '#ec4899', style: 'bg-pink-500/10 border-pink-500', category: 'SIMPLES', icon: '🌸' },
  { id: 'bubble-matrix', name: 'Código de Matriz', price: 420, color: '#10b981', style: 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] font-mono', category: 'LENDÁRIA', icon: '📟' },
  { id: 'bubble-abyssal', name: 'Fogo do Abismo', price: 780, color: '#ef4444', style: 'bg-red-950/40 border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]', category: 'LENDÁRIA', icon: '🔥' },
  { id: 'bubble-void-god', name: 'Vácuo Silencioso', price: 1350, color: '#a855f7', style: 'bg-purple-950/60 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]', category: 'LIMITADA', icon: '🌌' },
  { id: 'bubble-pure-gold', name: 'Sincronia Áurea', price: 1800, color: '#f59e0b', style: 'bg-amber-500/10 border-amber-500 shadow-[0_0_35px_rgba(245,158,11,0.5)]', category: 'LIMITADA', icon: '✨' }
];

function normalizeIdToUUID(str: string): string {
  if (!str) return "00000000-0000-0000-0000-000000000000";
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str;
  }
  
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = (hash1 * 31 + ch) | 0;
    hash2 = (hash2 * 37 + ch) | 0;
  }
  
  const part1 = Math.abs(hash1).toString(16).padStart(8, '0').slice(0, 8);
  const part2 = Math.abs(hash2).toString(16).padStart(4, '0').slice(0, 4);
  const part3 = '4' + Math.abs(hash1 ^ hash2).toString(16).padStart(3, '0').slice(0, 3);
  const part4 = '8' + Math.abs(hash1 & hash2).toString(16).padStart(3, '0').slice(0, 3);
  const part5 = Math.abs(hash1 * hash2).toString(16).padStart(12, '0').slice(0, 12);
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

const safeStore = (key: string, value: string) => {
  try {
    if (!key || key.length > 512) return;
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("Storage full, cleaning up...");
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('vimg_') || k.startsWith('img_'));
      for (let i = 0; i < Math.min(keys.length, 10); i++) {
        localStorage.removeItem(keys[i]);
      }
      localStorage.setItem(key, value);
    } catch (inner) {
      console.error("Storage still full after cleanup");
    }
  }
};

const tryGet = (id: string | null | undefined) => {
  if (!id || id.length > 512) return null;
  try {
    const cleanId = id.replace(/^(ref:|vimg_|img_)/i, '');
    // Direct lookup
    const direct = localStorage.getItem(id) || 
                   localStorage.getItem(id.toLowerCase()) || 
                   localStorage.getItem(id.toUpperCase()) ||
                   localStorage.getItem('vimg_' + id) ||
                   localStorage.getItem('img_' + id) ||
                   localStorage.getItem('vimg_' + cleanId) ||
                   localStorage.getItem('img_' + cleanId);
    if (direct) return direct;

    // Player character lookup
    const charStr = localStorage.getItem('void_character');
    if (charStr) {
      const char = JSON.parse(charStr);
      if (char && char.name && (char.name.toUpperCase() === id.toUpperCase() || char.name.toUpperCase() === cleanId.toUpperCase())) {
        return char.avatar || null;
      }
    }

    // Wiki entries (posts) lookup
    const postsStr = localStorage.getItem('void_feed_posts');
    if (postsStr) {
      const posts = JSON.parse(postsStr);
      const wikiPost = posts.find((p: any) => 
        p.title?.toUpperCase() === id.toUpperCase() || 
        p.author?.toUpperCase() === id.toUpperCase() ||
        p.title?.toUpperCase() === cleanId.toUpperCase()
      );
      if (wikiPost) return wikiPost.customAvatar || wikiPost.avatar || null;
    }
    
    return null;
  } catch (e) { return null; }
};

const resolveImageRef = (ref: string | undefined | null): string | null => {
  if (!ref || typeof ref !== 'string') return null;

  // Extrair o link real da imagem limpando o metadata de fallback e auto-encriptografado
  const cleanRef = ref.split('|metadata:')[0];

  const tryGet = (id: string) => {
    try {
      if (!id || id.length > 255) return null;
      return localStorage.getItem(id) || 
             localStorage.getItem(id.toLowerCase()) || 
             localStorage.getItem(id.toUpperCase());
    } catch (e) { return null; }
  };

  // 1. Direct URLs and Data URIs
  if (cleanRef.startsWith('data:') || cleanRef.includes('ais-dev') || cleanRef.includes('googleusercontent') || cleanRef.includes('://') || cleanRef.startsWith('/')) {
    return cleanRef;
  }

  // 2. Persona Specific Protection (NEXUS)
  if (cleanRef.toUpperCase() === 'NEXUS') {
     const nexusCustom = tryGet('void_nexus_custom_avatar') || tryGet('img_NEXUS');
     if (nexusCustom) return nexusCustom;
     return 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Nexus&backgroundColor=111827';
  }

  // 3. Known placeholders
  if (cleanRef.toUpperCase() === 'LAST_UPLOADED' || cleanRef.toUpperCase() === 'ULTIMA_IMAGEM') {
    const last = tryGet('void_last_uploaded_img');
    if (last) return last;
  }
  
  // 4. Local storage key matching
  let cleanKey = cleanRef;
  if (cleanKey.startsWith('ref:')) {
    cleanKey = cleanKey.substring(4);
  }
  
  const resolved = tryGet(cleanKey) || tryGet('vimg_' + cleanKey) || tryGet('img_' + cleanKey);
  if (resolved) return resolved;

  // Regex check for nested/hybrid prefixes
  const match = cleanRef.match(/(img_[a-zA-Z0-9_-]+)/i);
  if (match) {
    const matchedId = match[1];
    const res = tryGet(matchedId) || tryGet('vimg_' + matchedId);
    if (res) return res;
  }

  // If this is a local type prefix but not found in the current browser, DO NOT return the string 'ref:vimg_...'
  // because that isn't a valid image and causes corrupted image tags. Return null instead.
  if (cleanRef.startsWith('ref:') || cleanRef.startsWith('vimg_') || cleanRef.startsWith('img_')) {
    return null;
  }

  // 5. Fallback search
  const resolvedFull = tryGet(cleanRef);
  if (resolvedFull) return resolvedFull;

  // 6. Final fallback
  if (cleanRef.length < 50 && !cleanRef.includes(' ') && !cleanRef.includes('/') && !cleanRef.includes('.')) {
    return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(cleanRef)}`;
  }

  return cleanRef;
};

const App: React.FC = () => {
  const [user, setUser] = useState<LocalUser | null>(() => {
    const saved = localStorage.getItem('void_local_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Ativa e gerencia segurança, permissões e registros do Expo Push Notification / Web Sandbox
  const { 
    expoPushToken, 
    notification: activeNotification, 
    error: notificationError,
    permissionStatus,
    requestPermission
  } = useExpoNotifications(user?.uid);

  const [isAuthReady, setIsAuthReady] = useState(true);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => localStorage.getItem('void_active_session_id'));
  const [communities, setCommunities] = useState<Community[]>(() => {
    const saved = localStorage.getItem('void_communities');
    return saved ? JSON.parse(saved) : [];
  });
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('void_sessions');
    let parsed: ChatSession[] = [];
    try {
      parsed = saved ? JSON.parse(saved).filter((s: any) => s && s.id) : [];
    } catch (e) { parsed = []; }

    let nexusSession = parsed.find(s => s.id === 'nexus-default');
    
    // Migration: If we don't have id 'nexus-default' but have a session named 'NEXUS' of type 'IA', 
    // assign it the ID 'nexus-default' to preserve history and prevent duplication.
    if (!nexusSession) {
      const oldNexusIdx = parsed.findIndex(s => s.name === 'NEXUS' && s.type === 'IA');
      if (oldNexusIdx !== -1) {
        parsed[oldNexusIdx].id = 'nexus-default';
        nexusSession = parsed[oldNexusIdx];
      }
    }

    if (!nexusSession) {
      const savedNexusAvatar = localStorage.getItem('img_NEXUS') || localStorage.getItem('void_nexus_custom_avatar');
      const newNexus: ChatSession = {
        id: 'nexus-default',
        name: 'NEXUS',
        avatar: savedNexusAvatar || 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Nexus&backgroundColor=0a0c1a',
        messages: [{ id: 'nx-init', role: 'model', text: '*Ajusto meu visor e dou um sorriso de canto.* Olha só quem resolveu aparecer. O Vácuo estava meio parado sem uma frequência nova para monitorar. O que manda hoje, viajante?', timestamp: Date.now(), personaName: 'NEXUS' }],
        isPinned: true, lastUpdate: Date.now(), type: 'IA', status: 'accepted', creator: 'SISTEMA'
      };
      parsed.unshift(newNexus);
    }

    // Final deduplication by ID to prevent duplicate key errors
    const uniqueSessions: ChatSession[] = [];
    const seenIds = new Set<string>();
    for (const s of parsed) {
      if (s && s.id && !seenIds.has(s.id)) {
        seenIds.add(s.id);
        uniqueSessions.push(s);
      }
    }

    return uniqueSessions;
  });

  useEffect(() => {
    // Solicitar de antemão permissões para acessar câmera, galeria, microfone e notificações (Web e wrappers)
    const requestInitialHardwarePermissions = async () => {
      // a) Notificações do navegador
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          window.Notification.requestPermission().catch(() => {});
        } catch (e) {
          console.warn('Erro ao solicitar permissão de Notificação:', e);
        }
      }

      // b) Câmera e Microfone via getUserMedia (Força pop-up nativo em WebViews do Android/iOS)
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        try {
          navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
              // Para as faixas imediatamente para não deixar câmera/microfone ativos
              stream.getTracks().forEach(track => track.stop());
            })
            .catch(err => {
              console.warn('Permissão de Câmera/Microfone negada de forma nativa:', err);
            });
        } catch (e) {
          console.warn('Erro ao tentar acionar getUserMedia:', e);
        }
      }

      // c) Compatibilidade para Android/iOS criados via median.co / GoNative (URL schemes oficiais de permissão)
      const isMedian = typeof window !== 'undefined' && (
        !!(window as any).gonative || 
        !!(window as any).median || 
        (navigator?.userAgent || '').toLowerCase().includes('gonative') || 
        (navigator?.userAgent || '').toLowerCase().includes('median')
      );

      if (isMedian) {
        try {
          console.log('📱 [NEXUS] GoNative/Median detectado. Forçando pop-up nativo de Câmera, Galeria, Microfone e Push...');
          
          // Abre permissão de câmera nativa
          setTimeout(() => {
            window.location.href = "gonative://camera/request";
          }, 200);

          // Abre permissão de microfone nativa
          setTimeout(() => {
            window.location.href = "gonative://microphone/request";
          }, 500);

          // Abre permissão de galeria de fotos nativa
          setTimeout(() => {
            window.location.href = "gonative://photoLibrary/request";
          }, 800);

          // Abre permissão de notificações push
          setTimeout(() => {
            window.location.href = "gonative://push/register";
          }, 1100);

          setTimeout(() => {
            window.location.href = "gonative://push/onesignal/register";
          }, 1300);
        } catch (e) {
          console.warn('Erro ao disparar pontes GoNative de hardware:', e);
        }
      }


    };

    requestInitialHardwarePermissions();

    // 1. Verificar sessão atual na carga inicial
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        syncUser(session.user);
      } else {
        setUser(null);
        setGameState(GameState.AUTH);
      }
      setIsAuthReady(true);
    };

    checkSession();

    // 2. Escutar mudanças de estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncUser(session.user);
      } else {
        setUser(null);
        setGameState(GameState.AUTH);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const syncUser = async (supabaseUser: any) => {
    try {
      // Busca o nickname e todas as colunas de estilização e perfil na tabela de perfis
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn("Erro ao buscar perfil:", error.message);
      }

      const displayName = profile?.nickname || null;
      let avatarUrl = profile?.avatar_url || supabaseUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${supabaseUser.id}`;

      let dbMetadata: any = {};
      if (avatarUrl && avatarUrl.includes('|metadata:')) {
        const parts = avatarUrl.split('|metadata:');
        avatarUrl = parts[0];
        try {
          dbMetadata = JSON.parse(parts[1]);
        } catch (e) {
          console.error("Erro parsing avatarUrl metadata in syncUser:", e);
        }
      }

      // Auto-Migration: Se o avatar_url no banco for uma referência local ("ref:...", "vimg_...", etc.),
      // nós resolvemos ela aqui (onde o localStorage tem a imagem de verdade) e sincronizamos de volta de forma definitiva no Supabase em formato Base64.
      // Isso garante que todos os outros membros do sistema consigam ver a foto real do usuário de maneira instantânea sem quebras!
      if (avatarUrl && (avatarUrl.startsWith('ref:') || avatarUrl.startsWith('vimg_') || avatarUrl.startsWith('img_') || (avatarUrl.length < 60 && !avatarUrl.includes('/') && !avatarUrl.includes('.') && !avatarUrl.startsWith('http')))) {
        const resolved = resolveImageRef(avatarUrl);
        if (resolved && resolved.startsWith('data:')) {
          avatarUrl = resolved;
          // Faz upsert assíncrono e silencioso do Base64 direto no Supabase
          supabase.from('profiles').upsert({
            id: supabaseUser.id,
            nickname: (displayName || supabaseUser.user_metadata?.name || "Operativo").trim(),
            avatar_url: resolved,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' }).then(({ error: syncErr }) => {
            if (syncErr) {
              console.warn("[Auto-Migration] Erro ao sincronizar avatar Base64 definitivo no Supabase:", syncErr);
            } else {
              console.log("[Auto-Migration] Avatar Base64 definitivo gravado no Supabase com sucesso!");
            }
          });
        }
      }

      const localUser: LocalUser = {
        uid: supabaseUser.id,
        displayName: displayName,
        photoURL: avatarUrl,
        email: supabaseUser.email || null,
      };
      
      setUser(localUser);

      if (displayName) {
        // Map all customization columns that might exist in profiles table
        const mappedBio = profile.bio || profile.biografia || dbMetadata.bio || '';
        const mappedStatusIcon = profile.statusIcon || profile.status_icon || dbMetadata.statusIcon || '🔮';
        const mappedStatusColor = profile.statusColor || profile.status_color || dbMetadata.statusColor || '#22c55e';
        const mappedNameColor = profile.nameColor || profile.name_color || dbMetadata.nameColor || '';
        const mappedPanelColor = profile.panelColor || profile.panel_color || dbMetadata.panelColor || '';
        const mappedContentColor = profile.contentColor || profile.content_color || dbMetadata.contentColor || '';
        const mappedPanelImage = profile.panelImage || profile.panel_image || dbMetadata.panelImage || '';
        const mappedContentImage = profile.contentImage || profile.content_image || dbMetadata.contentImage || '';
        const mappedFrameColor = profile.frameColor || profile.frame_color || dbMetadata.frameColor || '';
        const mappedFrameStyle = profile.frameStyle || profile.frame_style || dbMetadata.frameStyle || '';
        const mappedBubbleStyle = profile.bubbleStyle || profile.bubble_style || dbMetadata.bubbleStyle || '';
        const mappedBubbleColor = profile.bubbleColor || profile.bubble_color || dbMetadata.bubbleColor || '';
        const mappedHideStats = profile.hideStats !== undefined ? profile.hideStats : (profile.hide_stats !== undefined ? profile.hide_stats : (dbMetadata.hideStats !== undefined ? dbMetadata.hideStats : false));
        const mappedMuralTopColor = profile.muralTopColor || profile.mural_top_color || dbMetadata.muralTopColor || '';
        const mappedMuralFeedColor = profile.muralFeedColor || profile.mural_feed_color || dbMetadata.muralFeedColor || '';
        const mappedMuralImage = profile.muralImage || profile.mural_image || dbMetadata.muralImage || '';
        const mappedMuralFeedImage = profile.muralFeedImage || profile.mural_feed_image || dbMetadata.muralFeedImage || '';
        
        let mappedMural = [];
        const rawMural = profile.mural || profile.mural_posts;
        if (rawMural) {
          try {
            mappedMural = typeof rawMural === 'string' ? JSON.parse(rawMural) : rawMural;
          } catch(e) {
            console.error(e);
          }
        }

        setMyProfile(prev => ({
          ...prev,
          name: displayName,
          avatarUrl: avatarUrl,
          bio: mappedBio,
          statusIcon: mappedStatusIcon,
          statusColor: mappedStatusColor,
          nameColor: mappedNameColor,
          panelColor: mappedPanelColor,
          contentColor: mappedContentColor,
          panelImage: mappedPanelImage,
          contentImage: mappedContentImage,
          frameColor: mappedFrameColor,
          frameStyle: mappedFrameStyle,
          bubbleStyle: mappedBubbleStyle,
          bubbleColor: mappedBubbleColor,
          hideStats: mappedHideStats,
          muralTopColor: mappedMuralTopColor,
          muralFeedColor: mappedMuralFeedColor,
          muralImage: mappedMuralImage,
          muralFeedImage: mappedMuralFeedImage,
          mural: mappedMural
        }));
        setCharacter(prev => prev ? { ...prev, name: displayName, avatar: avatarUrl } : null);
        setGameState(prev => (prev === GameState.AUTH || prev === GameState.ONBOARDING ? GameState.LOBBY : prev));
      } else {
        setGameState(GameState.ONBOARDING);
      }
    } catch (err) {
      console.error("syncUser failed:", err);
      // Fallback para não travar a tela de login
      setUser({
        uid: supabaseUser.id,
        displayName: null,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${supabaseUser.id}`,
        email: supabaseUser.email || null
      });
      setGameState(GameState.ONBOARDING);
    }
  };

  useEffect(() => {
    if (user) {
      const currentName = user.displayName || 'OPERATIVO';
      localStorage.setItem('void_user_name', currentName);
      localStorage.setItem('void_user_avatar', user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + currentName);
      localStorage.setItem('void_local_user', JSON.stringify(user));
      
      // Atualiza o perfil global (Nexus) e o personagem com o Nick real
      if (user.displayName) {
        setMyProfile(prev => ({ ...prev, name: user.displayName! }));
        setCharacter(prev => {
          if (!prev) {
            // Se não houver personagem, criamos um básico com o nome correto
            return {
              name: user.displayName!,
              class: 'Membro',
              stats: { strength: 5, agility: 5, intelligence: 5, willpower: 5, hp: 100 },
              inventory: Array(10).fill(null),
              background: '',
              wallet: 0
            };
          }
          return { ...prev, name: user.displayName! };
        });
      }
    } else {
      localStorage.removeItem('void_local_user');
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setGameState(GameState.AUTH);
      localStorage.clear();
      window.location.reload();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const [gameState, setGameState] = useState<GameState>(GameState.AUTH);

  useEffect(() => {
    if (isAuthReady) {
      if (user) {
        if (gameState === GameState.AUTH) setGameState(GameState.LOBBY);
      } else {
        setGameState(GameState.AUTH);
      }
    }
  }, [user, isAuthReady, gameState]);

  useEffect(() => {
    if (gameState === (GameState as any).BANNED) {
      setGameState(GameState.LOBBY);
    }
  }, [gameState]);

  const isAppModerator = useMemo(() => (window as any).isGlobalMod || false, []);

  const [minimizedMedia, setMinimizedMedia] = useState<{ 
    id: string, 
    type: 'video' | 'voice', 
    source?: string, 
    videoType?: 'local' | 'youtube',
    name: string, 
    currentTime?: number, 
    isPlaying?: boolean,
    characterData?: Character 
  } | null>(null);

  const activeCommunity = useMemo(() => {
    if (!activeSessionId) return null;
    const direct = communities.find(c => c.id === activeSessionId) || TEST_COMMUNITIES.find(c => c.id === activeSessionId);
    if (direct) return direct;
    return communities.find(c => c.channels?.some(ch => ch.id === activeSessionId)) || 
           TEST_COMMUNITIES.find(c => c.channels?.some(ch => ch.id === activeSessionId)) || null;
  }, [activeSessionId, communities, sessions]);

  const isCommunityHome = useMemo(() => {
    if (!activeSessionId) return false;
    return communities.some(c => c.id === activeSessionId) || TEST_COMMUNITIES.some(c => c.id === activeSessionId);
  }, [activeSessionId, communities]);

  const activeSession = useMemo(() => sessions.find(s => s && s.id === activeSessionId), [sessions, activeSessionId]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLocalSearchOpen, setIsLocalSearchOpen] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [storeTab, setStoreTab] = useState<'FRAMES' | 'BUBBLES'>('FRAMES');
  const [returnToState, setReturnToState] = useState<{ id: string | null, state: GameState } | null>(null);
   const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [globalProfiles, setGlobalProfiles] = useState<UserProfile[]>([]);

  const loadGlobalProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      
      if (!error && data) {
        const mapped: UserProfile[] = data.map(p => {
          let pAvatar = p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`;
          let pMetadata: any = {};
          if (pAvatar && pAvatar.includes('|metadata:')) {
            const parts = pAvatar.split('|metadata:');
            pAvatar = parts[0];
            try {
              pMetadata = JSON.parse(parts[1]);
            } catch (e) {
              console.error("Failed parsing pAvatar metadata:", e);
            }
          }

          const mappedBio = p.bio || p.biografia || pMetadata.bio || '';
          const mappedStatusIcon = p.statusIcon || p.status_icon || pMetadata.statusIcon || '🔮';
          const mappedStatusColor = p.statusColor || p.status_color || pMetadata.statusColor || '#22c55e';
          const mappedNameColor = p.nameColor || p.name_color || pMetadata.nameColor || '';
          const mappedPanelColor = p.panelColor || p.panel_color || pMetadata.panelColor || '';
          const mappedContentColor = p.contentColor || p.content_color || pMetadata.contentColor || '';
          const mappedPanelImage = p.panelImage || p.panel_image || pMetadata.panelImage || '';
          const mappedContentImage = p.contentImage || p.content_image || pMetadata.contentImage || '';
          const mappedFrameColor = p.frameColor || p.frame_color || pMetadata.frameColor || '';
          const mappedFrameStyle = p.frameStyle || p.frame_style || pMetadata.frameStyle || '';
          const mappedBubbleStyle = p.bubbleStyle || p.bubble_style || pMetadata.bubbleStyle || '';
          const mappedBubbleColor = p.bubbleColor || p.bubble_color || pMetadata.bubbleColor || '';
          const mappedHideStats = p.hideStats !== undefined ? p.hideStats : (p.hide_stats !== undefined ? p.hide_stats : (pMetadata.hideStats !== undefined ? pMetadata.hideStats : false));
          const mappedMuralTopColor = p.muralTopColor || p.mural_top_color || pMetadata.muralTopColor || '';
          const mappedMuralFeedColor = p.muralFeedColor || p.mural_feed_color || pMetadata.muralFeedColor || '';
          const mappedMuralImage = p.muralImage || p.mural_image || pMetadata.muralImage || '';
          const mappedMuralFeedImage = p.muralFeedImage || p.mural_feed_image || pMetadata.muralFeedImage || '';

          let mappedMural = [];
          const rawMural = p.mural || p.mural_posts;
          if (rawMural) {
            try {
              mappedMural = typeof rawMural === 'string' ? JSON.parse(rawMural) : rawMural;
            } catch(e) {
              console.error(e);
            }
          }

          return {
            id: p.id,
            name: p.nickname || 'Operativo Sem Nome',
            avatarUrl: pAvatar,
            rank: p.rank || 'RECRUTA',
            level: p.level || 1,
            isMe: p.id === user?.uid,
            reputation: p.reputation || 0,
            following: p.following || 0,
            followers: p.followers || 0,
            bio: mappedBio,
            statusIcon: mappedStatusIcon,
            statusColor: mappedStatusColor,
            nameColor: mappedNameColor,
            panelColor: mappedPanelColor,
            contentColor: mappedContentColor,
            panelImage: mappedPanelImage,
            contentImage: mappedContentImage,
            frameColor: mappedFrameColor,
            frameStyle: mappedFrameStyle,
            bubbleStyle: mappedBubbleStyle,
            bubbleColor: mappedBubbleColor,
            hideStats: mappedHideStats,
            muralTopColor: mappedMuralTopColor,
            muralFeedColor: mappedMuralFeedColor,
            muralImage: mappedMuralImage,
            muralFeedImage: mappedMuralFeedImage,
            mural: mappedMural
          };
        });
        setGlobalProfiles(mapped);
      }
    } catch (err) {
      console.error("Erro ao carregar perfis globais:", err);
    }
  }, [user]);

  useEffect(() => {
    if (gameState === GameState.SOCIAL_DISCOVERY) {
      loadGlobalProfiles();
    }
  }, [gameState, loadGlobalProfiles]);

  const [activeGlobalChatId, setActiveGlobalChatId] = useState<string | null>(null);
  const [activeGlobalChatPartner, setActiveGlobalChatPartner] = useState<string>('');
  const [globalChats, setGlobalChats] = useState<any[]>([]);
  
  const loadGlobalChats = useCallback(async () => {
    if (!user) return;
    try {
      const { fetchMyChats } = await import('./chatService');
      const supaChats = await fetchMyChats();
      
      const formatted = await Promise.all(supaChats.map(async (c: any) => {
        const partnerId = c.user_1 === user?.uid ? c.user_2 : c.user_1;
        
        let profile = null;
        try {
          const { data: prof } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', partnerId).single();
          profile = prof;
        } catch (e) {
          console.warn("Could not fetch profile for partner " + partnerId, e);
        }

        // Buscar a última mensagem real do chat no Supabase
        let lastMsg = null;
        try {
          const targetPrefix = `[chat_id:${c.id}]`;
          const { data: msgData } = await supabase
            .from('messages')
            .select('*')
            .like('content', `${targetPrefix}%`)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (msgData && msgData.length > 0) {
            const matchedMsg = msgData[0];
            const rawContent = matchedMsg.content || '';
            const cleanContent = rawContent.startsWith(targetPrefix) 
              ? rawContent.slice(targetPrefix.length) 
              : rawContent;

            lastMsg = {
              ...matchedMsg,
              content: cleanContent
            };
          }
        } catch (msgErr) {
          console.warn("Could not fetch last message for chat " + c.id, msgErr);
        }

        return {
          ...c,
          other_user_nickname: profile?.nickname || 'Sinal Desconhecido',
          other_user_avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.nickname || partnerId}`,
          last_message: lastMsg,
          lastUpdate: lastMsg ? new Date(lastMsg.created_at).getTime() : new Date(c.created_at).getTime()
        };
      }));
      
      // Ordenar os chats para manter os mais recentes no topo
      formatted.sort((a, b) => b.lastUpdate - a.lastUpdate);
      setGlobalChats(formatted);
    } catch (err) {
      console.error("Erro ao carregar chats globais:", err);
    }
  }, [user]);

  useEffect(() => {
    if (gameState === GameState.MESSAGES) {
      loadGlobalChats();
      // Polling fallback to reload global chat overview list every 1.5 seconds for instant private DMs reactivity
      const pollId = setInterval(() => {
        loadGlobalChats();
      }, 1500);
      return () => clearInterval(pollId);
    }
  }, [gameState, loadGlobalChats]);

  // Canal em tempo real para escutar atualizações de mensagens globais e novas mensagens
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global_chats_realtime_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Quando qualquer mensagem for inserida ou modificada no banco, atualiza os chats
          loadGlobalChats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats'
        },
        () => {
          // Quando novos chats forem criados ou modificados, atualiza
          loadGlobalChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadGlobalChats]);

  const allSessions = useMemo(() => {
    const converted = globalChats.map(c => ({
      id: c.id,
      name: c.other_user_nickname,
      avatar: c.other_user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.other_user_nickname}`,
      type: 'PRIVADO' as const, // Usar PRIVADO para que apareça na aba correta do MessagesArchive
      lastUpdate: c.lastUpdate || new Date(c.created_at).getTime(),
      messages: c.last_message ? [{
        id: c.last_message.id,
        role: (c.last_message.sender_id === user?.uid ? 'user' : 'model') as 'user' | 'model',
        text: c.last_message.content,
        timestamp: new Date(c.last_message.created_at).getTime(),
        sender_id: c.last_message.sender_id
      }] : [],
      isPinned: false,
      status: 'accepted' as const,
      creator: c.user_1
    }));
    // Remove duplicados pelo ID caso existam
    const sessionIds = new Set(converted.map(s => s.id));
    const filteredSessions = sessions.filter(s => !sessionIds.has(s.id));
    return [...filteredSessions, ...converted];
  }, [sessions, globalChats, user?.uid]);
  const [editingWikiPost, setEditingWikiPost] = useState<FeedPost | null>(null);
  const [previewCommunity, setPreviewCommunity] = useState<Community | null>(null);
  const [lobbyAtTop, setLobbyAtTop] = useState(true);
  const [archiveViewMode, setArchiveViewMode] = useState<'PRIVADO' | 'CHATS'>('PRIVADO');

  const saveTimeoutRef = useRef<number | null>(null);
  const isAiProcessing = useRef<Set<string>>(new Set());

  const shouldShowBottomNav = useMemo(() => {
    if (gameState === GameState.AUTH || gameState === GameState.BANNED || gameState === GameState.CHARACTER_CREATION || gameState === GameState.COMMUNITY_CREATION) return false;
    if (viewedProfile || previewCommunity || isStoreOpen) return false;
    if (gameState === GameState.PLAYING) return false;
    return [GameState.LOBBY, GameState.RECENT_CHATS, GameState.SOCIAL_DISCOVERY, GameState.RANKING, GameState.COMMUNITY_SEARCH, GameState.FEED, GameState.MESSAGES, GameState.DRAFTS].includes(gameState);
  }, [gameState, viewedProfile, previewCommunity, isStoreOpen]);

  const handleCreateCommunity = (commData: any) => {
    if (!user) return;
    const newCommId = Date.now().toString();
    const newComm = {
      ...commData,
      id: newCommId,
      creator: user.uid,
      members: [user.uid],
      membersCount: 1,
      createdAt: Date.now(),
      level: 1
    };
    setCommunities(prev => [...prev, newComm]);
    setActiveSessionId(newCommId);
    setGameState(GameState.PLAYING);
  };

  const handleSessionUpdate = useCallback((sessionId: string, updates: any) => {
    setSessions(prev => prev.map(s => s && s.id === sessionId ? { ...s, ...updates } : s));
    setCommunities(prev => prev.map(c => {
      if (c.channels && c.channels.some(ch => ch.id === sessionId)) {
         return { ...c, channels: c.channels.map(ch => ch.id === sessionId ? { ...ch, ...updates } : ch) };
      }
      return c;
    }));
  }, []);

  const memoizedOnUpdateSession = useCallback((updates: Partial<ChatSession>) => {
    if (activeSessionId) handleSessionUpdate(activeSessionId, updates);
  }, [activeSessionId, handleSessionUpdate]);

  const memoizedSetMessages = useCallback(async (updater: any) => {
    if (!activeSessionId) return;
    const updateTimestamp = Date.now();
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const newMessages = typeof updater === 'function' ? updater(s.messages || []) : updater;
        return {
          ...s,
          messages: newMessages,
          lastUpdate: updateTimestamp
        };
      }
      return s;
    }));
  }, [activeSessionId]);

  const memoizedOnNavigateBack = useCallback(() => {
    if (returnToState && returnToState.state === GameState.PLAYING) {
      setActiveSessionId(returnToState.id);
    } else {
      setActiveSessionId(null);
      setGameState(GameState.MESSAGES);
    }
  }, [returnToState, setActiveSessionId, setGameState]);

  const memoizedOnDeleteSession = useCallback((id: string) => {
    const sessionToDelete = sessions.find(s => s && s.id === id);
    if (sessionToDelete && (sessionToDelete.type === 'CLUSTER' || sessionToDelete.type === 'RPG')) {
      // Cleanup
    }
    setSessions(prev => prev.filter(s => s && s.id !== id));
    setActiveSessionId(null);
    if (sessionToDelete?.type === 'PUBLICO' || sessionToDelete?.type === 'CLUSTER' || sessionToDelete?.type === 'RPG') {
      setArchiveViewMode('CHATS');
    }
    setGameState(GameState.MESSAGES);
  }, [sessions, setActiveSessionId, setArchiveViewMode, setGameState]);

  const memoizedOnAddMemberClick = useCallback(() => {
    setReturnToState({ id: activeSessionId, state: GameState.PLAYING });
    setGameState(GameState.INVITE_FOLLOWERS);
  }, [activeSessionId, setReturnToState, setGameState]);

  const [myProfile, setMyProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('void_user_profile');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      name: parsed.name || localStorage.getItem('void_user_name') || 'MEMBRO',
      avatarUrl: parsed.avatarUrl || localStorage.getItem('void_user_avatar') || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Voidy',
      rank: parsed.rank || 'RECRUTA',
      level: parsed.level || 1,
      isMe: true,
      reputation: parsed.reputation || 0,
      following: parsed.following || 0,
      followers: parsed.followers || 0,
      bio: parsed.bio || '',
      statusIcon: parsed.statusIcon || '🔮',
      statusColor: parsed.statusColor || '#22c55e',
      mural: parsed.mural || [],
      voidyCoins: parsed.voidyCoins || 0,
      dailyAdCount: parsed.dailyAdCount || 0,
      lastAdReset: parsed.lastAdReset || 0,
      ...parsed
    };
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('void_notifications');
    return saved ? JSON.parse(saved) : [{ id: 'welcome', type: 'PROMOTION', title: 'Comando Nexus', content: 'Sincronia estabelecida.', sender: 'Drake.OS', timestamp: Date.now(), read: false }];
  });

  const [activeToast, setActiveToast] = useState<Notification | null>(null);

  const addNotification = useCallback((n: any) => {
    const newNotif = { ...n, id: Date.now().toString(), timestamp: Date.now(), read: false } as Notification;
    setNotifications(prev => [newNotif, ...prev]);
    setActiveToast(newNotif);
  }, []);

  useEffect(() => {
    if (activeNotification) {
      const content = activeNotification.request?.content || activeNotification;
      const title = content?.title || 'Nova Sincronia';
      const body = content?.body || content?.text || 'Você recebeu uma atualização do Vácuo.';
      const data = content?.data || {};

      addNotification({
        type: data.type || 'SYSTEM',
        title,
        content: body,
        sender: data.sender || 'NEXUS'
      });
    }
  }, [activeNotification, addNotification]);

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const handlePermanentBan = useCallback((reason: string) => {
    console.warn(`Tentativa de banimento ignorada: ${reason}`);
  }, []);

  const verifySafety = useCallback(async (content: string, type: 'image' | 'text' = 'image'): Promise<boolean> => {
    return true;
  }, []);

  const handleViewProfile = useCallback(async (p: any) => {
    if (!p) {
      setViewedProfile(null);
      return;
    }

    const targetId = p.id;
    if (!targetId) {
      setViewedProfile({
        name: p.name || 'Operativo',
        avatarUrl: p.avatarUrl || p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`,
        rank: p.rank || 'RECRUTA',
        level: p.level || 1,
        isMe: false,
        reputation: p.reputation || 0,
        following: p.following || 0,
        followers: p.followers || 0,
        bio: p.bio || '',
        posts: [],
        mural: []
      });
      return;
    }

    // Define estado temporário rápido para transição de tela imediata
    setViewedProfile({
      id: targetId,
      name: p.name || p.nickname || 'Operativo',
      avatarUrl: p.avatarUrl || p.avatar_url || p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetId}`,
      rank: p.rank || 'OPERATIVO',
      level: p.level || 1,
      isMe: targetId === user?.uid,
      reputation: p.reputation || 0,
      following: p.following || 0,
      followers: p.followers || 0,
      bio: "Carregando biografia operacional...",
      posts: [],
      mural: []
    });

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single();

      if (!error && data) {
        let pAvatar = data.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetId}`;
        let pMetadata: any = {};
        if (pAvatar && pAvatar.includes('|metadata:')) {
          const parts = pAvatar.split('|metadata:');
          pAvatar = parts[0];
          try {
            pMetadata = JSON.parse(parts[1]);
          } catch (e) {
            console.error("Failed parsing pAvatar metadata in handleViewProfile:", e);
          }
        }

        // Mapeia colunas do banco (compatível com snake_case e camelCase)
        const mappedBio = data.bio || data.biografia || pMetadata.bio || '';
        const mappedStatusIcon = data.statusIcon || data.status_icon || pMetadata.statusIcon || '🔮';
        const mappedStatusColor = data.statusColor || data.status_color || pMetadata.statusColor || '#22c55e';
        const mappedNameColor = data.nameColor || data.name_color || pMetadata.nameColor || '';
        const mappedPanelColor = data.panelColor || data.panel_color || pMetadata.panelColor || '';
        const mappedContentColor = data.contentColor || data.content_color || pMetadata.contentColor || '';
        const mappedPanelImage = data.panelImage || data.panel_image || pMetadata.panelImage || '';
        const mappedContentImage = data.contentImage || data.content_image || pMetadata.contentImage || '';
        const mappedFrameColor = data.frameColor || data.frame_color || pMetadata.frameColor || '';
        const mappedFrameStyle = data.frameStyle || data.frame_style || pMetadata.frameStyle || '';
        const mappedBubbleStyle = data.bubbleStyle || data.bubble_style || pMetadata.bubbleStyle || '';
        const mappedBubbleColor = data.bubbleColor || data.bubble_color || pMetadata.bubbleColor || '';
        const mappedHideStats = data.hideStats !== undefined ? data.hideStats : (data.hide_stats !== undefined ? data.hide_stats : (pMetadata.hideStats !== undefined ? pMetadata.hideStats : false));
        const mappedMuralTopColor = data.muralTopColor || data.mural_top_color || pMetadata.muralTopColor || '';
        const mappedMuralFeedColor = data.muralFeedColor || data.mural_feed_color || pMetadata.muralFeedColor || '';
        const mappedMuralImage = data.muralImage || data.mural_image || pMetadata.muralImage || '';
        const mappedMuralFeedImage = data.muralFeedImage || data.mural_feed_image || pMetadata.muralFeedImage || '';
        
        let mappedMural = [];
        const rawMural = data.mural || data.mural_posts;
        if (rawMural) {
          try {
            mappedMural = typeof rawMural === 'string' ? JSON.parse(rawMural) : rawMural;
          } catch(e) {
            console.error(e);
          }
        }

        setViewedProfile({
          id: targetId,
          name: data.nickname || p.name || p.nickname || 'Operativo',
          avatarUrl: pAvatar,
          rank: p.rank || 'OPERATIVO',
          level: p.level || 1,
          isMe: targetId === user?.uid,
          reputation: p.reputation || 0,
          following: p.following || 0,
          followers: p.followers || 0,
          bio: mappedBio,
          statusIcon: mappedStatusIcon,
          statusColor: mappedStatusColor,
          nameColor: mappedNameColor,
          panelColor: mappedPanelColor,
          contentColor: mappedContentColor,
          panelImage: mappedPanelImage,
          contentImage: mappedContentImage,
          frameColor: mappedFrameColor,
          frameStyle: mappedFrameStyle,
          bubbleStyle: mappedBubbleStyle,
          bubbleColor: mappedBubbleColor,
          hideStats: mappedHideStats,
          muralTopColor: mappedMuralTopColor,
          muralFeedColor: mappedMuralFeedColor,
          muralImage: mappedMuralImage,
          muralFeedImage: mappedMuralFeedImage,
          mural: mappedMural,
          posts: [] // Será populado pelo filtro do feedPosts/arquivos de posts abaixo se necessário
        });
      }
    } catch (e) {
      console.error("Erro ao carregar perfil completo do Supabase:", e);
    }
  }, [user]);

  useEffect(() => {
    localStorage.removeItem('void_is_banned');
    localStorage.removeItem('void_blacklist');
  }, []);

  const [character, setCharacter] = useState<Character | null>(() => {
    const saved = localStorage.getItem('void_character');
    return saved ? JSON.parse(saved) : null;
  });

  const handleUpdateCharacter = useCallback((updates: Partial<Character>) => {
    setCharacter(prev => {
      const base = prev || { 
        name: myProfile.name, 
        class: 'Membro', 
        stats: { strength: 5, agility: 5, intelligence: 5, willpower: 5, hp: 100 }, 
        inventory: Array(10).fill(null), 
        background: '',
        wallet: 0
      };
      
      let finalInventory = base.inventory;
      if (updates.inventory) {
          finalInventory = [...updates.inventory];
          while (finalInventory.length < 10) finalInventory.push(null);
          finalInventory = finalInventory.slice(0, 10);
      }

      const next = { ...base, ...updates, inventory: finalInventory };
      localStorage.setItem('void_character', JSON.stringify(next));
      if (next.avatar && next.name) {
        localStorage.setItem('img_' + next.name.toUpperCase(), next.avatar);
      }
      return next;
    });
  }, [myProfile.name]);

  const handleEditWikiPost = useCallback((post: FeedPost) => {
    setEditingWikiPost(post);
  }, []);

  const handleDeletePost = useCallback(async (id: string) => {
    const targetUuid = normalizeIdToUUID(id);
    setFeedPosts(prev => prev.filter(p => p.id !== id && p.id !== targetUuid));
    setMyProfile(prev => ({
      ...prev,
      posts: prev.posts?.filter(p => p.id !== id && p.id !== targetUuid)
    }));
    setViewedProfile(prev => prev ? { ...prev, posts: prev.posts?.filter(p => p.id !== id && p.id !== targetUuid) } : null);

    try {
      const { error } = await supabase.from('posts').delete().eq('id', targetUuid);
      if (error) {
        console.error("Erro ao excluir post no Supabase:", error.message);
      }
    } catch (e) {
      console.error("Erro ao deletar post no Supabase:", e);
    }
  }, []);

  const handleUpdateWikiPost = useCallback((p: FeedPost) => {
    const normalizedID = normalizeIdToUUID(p.id);
    const updatedPost = { ...p, id: normalizedID };
    setFeedPosts(prev => {
      if (prev.some(p => p.id === updatedPost.id)) {
        return prev.map(p => p.id === updatedPost.id ? updatedPost : p);
      }
      return [updatedPost, ...prev];
    });
    setMyProfile(prev => {
      const posts = prev.posts || [];
      if (posts.some(p => p.id === updatedPost.id)) {
        return {
          ...prev,
          posts: posts.map(p => p.id === updatedPost.id ? updatedPost : p)
        };
      }
      return {
        ...prev,
        posts: [updatedPost, ...posts]
      };
    });
    setViewedProfile(prev => {
      if (!prev) return null;
      const posts = prev.posts || [];
      if (posts.some(p => p.id === updatedPost.id)) {
        return {
          ...prev,
          posts: posts.map(p => p.id === updatedPost.id ? updatedPost : p)
        };
      }
      if (prev.isMe) {
        return {
          ...prev,
          posts: [updatedPost, ...posts]
        };
      }
      return prev;
    });
    setEditingWikiPost(null);
  }, [viewedProfile]);

  const handleAddPost = useCallback(async (p: FeedPost) => {
    const normalizedID = normalizeIdToUUID(p.id);
    const postWithUserId = {
      ...p,
      id: normalizedID,
      user_id: p.user_id || user?.uid
    };

    setFeedPosts(prev => {
      if (prev.some(existing => existing.id === postWithUserId.id)) return prev;
      return [postWithUserId, ...prev];
    });
    setMyProfile(prev => {
      if (prev.posts?.some(existing => existing.id === postWithUserId.id)) return prev;
      return {
        ...prev,
        posts: [postWithUserId, ...(prev.posts || [])]
      };
    });
    setViewedProfile(prev => {
      if (prev && prev.isMe) {
        if (prev.posts?.some(existing => existing.id === postWithUserId.id)) return prev;
        return {
          ...prev,
          posts: [postWithUserId, ...(prev.posts || [])]
        };
      }
      return prev;
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;
      if (!currentUser) return;

      const postPayload = {
        id: postWithUserId.id,
        user_id: currentUser.id,
        content: JSON.stringify({
          title: postWithUserId.title,
          content: postWithUserId.content,
          tag: postWithUserId.tag,
          likes: postWithUserId.likes || 0,
          comments: postWithUserId.comments || [],
          customTopColor: postWithUserId.customTopColor,
          customBgColor: postWithUserId.customBgColor,
          customTopImage: postWithUserId.customTopImage,
          customBgImage: postWithUserId.customBgImage,
          customBgType: postWithUserId.customBgType,
          customGallery: postWithUserId.customGallery,
          hideTopOverlay: postWithUserId.hideTopOverlay,
          customAvatar: postWithUserId.customAvatar,
          customAvatarPosition: postWithUserId.customAvatarPosition,
          customKeywords: postWithUserId.customKeywords,
          customInfoRows: postWithUserId.customInfoRows
        }),
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('posts').insert([postPayload]);
      if (error) {
        console.error("Erro ao salvar post no Supabase:", error.message);
      }
    } catch (e) {
      console.error("Erro ao persistir post no Supabase:", e);
    }
  }, [user]);

  const [communityVisits, setCommunityVisits] = useState<Record<string, { lastVisit: number; count: number }>>(() => {
    const saved = localStorage.getItem('void_community_visits_v2');
    return saved ? JSON.parse(saved) : {};
  });

  const recordVisit = useCallback((id: string) => {
    setCommunityVisits(prev => {
      const current = prev[id] || { lastVisit: 0, count: 0 };
      const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
      return { ...prev, [id]: { lastVisit: Date.now(), count: current.lastVisit > fourHoursAgo ? current.count + 1 : 1 } };
    });
  }, []);

  const handleLeaveCommunity = useCallback((id: string) => {
    const targetComm = communities.find(c => String(c.id) === String(id));
    const linkedChannelIds = targetComm?.channels?.map(ch => ch.id) || [];
    setCommunities(prev => prev.filter(c => String(c.id) !== String(id)));
    setCommunityVisits(prev => {
      const next = { ...prev }; 
      delete next[id]; 
      return next;
    });
    setSessions(prev => prev.filter(s => s && s.id !== id && !linkedChannelIds.includes(s.id)));
    if (String(activeSessionId) === String(id) || linkedChannelIds.includes(activeSessionId || '')) {
      setActiveSessionId(null); 
      setReturnToState(null); 
      setGameState(GameState.LOBBY);
    }
  }, [activeSessionId, communities]);

  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(() => {
    const saved = localStorage.getItem('void_feed_posts');
    return saved ? JSON.parse(saved) : INITIAL_POSTS;
  });

  const [publicMessages, setPublicMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('void_public_messages');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const loadPosts = async () => {
      try {
        let { data, error } = await supabase
          .from('posts')
          .select('id, content, created_at, user_id, profiles!fk_posts_profiles (nickname, avatar_url)')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn("Retrying posts fetch with standard profiles join...");
          const fallbackRes = await supabase
            .from('posts')
            .select('id, content, created_at, user_id, profiles (nickname, avatar_url)')
            .order('created_at', { ascending: false });
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (error) {
          console.error("Erro ao carregar posts:", error.message);
          return;
        }

        const mappedPosts: FeedPost[] = (data || []).map(post => {
          let postData: Partial<FeedPost> = {};
          try {
            const parsed = JSON.parse(post.content);
            if (parsed && typeof parsed === 'object') {
              postData = parsed;
            }
          } catch (e) {
            postData = { content: post.content };
          }

          const authorNickname = (post.profiles as any)?.nickname || 'User';
          const authorAvatar = (post.profiles as any)?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user_id}`;

          return {
            id: post.id,
            user_id: post.user_id,
            author: authorNickname,
            avatar: authorAvatar,
            content: postData.content || post.content,
            title: postData.title || undefined,
            tag: postData.tag || 'BLOG',
            likes: postData.likes || 0,
            time: post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Agora',
            timestamp: post.created_at ? new Date(post.created_at).getTime() : Date.now(),
            comments: postData.comments || [],
            customTopColor: postData.customTopColor,
            customBgColor: postData.customBgColor,
            customTopImage: postData.customTopImage,
            customBgImage: postData.customBgImage,
            customBgType: postData.customBgType,
            customGallery: postData.customGallery,
            hideTopOverlay: postData.hideTopOverlay,
            customAvatar: postData.customAvatar,
            customAvatarPosition: postData.customAvatarPosition,
            customKeywords: postData.customKeywords,
            customInfoRows: postData.customInfoRows,
          };
        });

        setFeedPosts(prev => {
          const merged = [...mappedPosts];
          prev.forEach(localPost => {
            if (!merged.some(m => m.id === localPost.id)) {
              merged.push(localPost);
            }
          });
          return merged.sort((a, b) => b.timestamp - a.timestamp);
        });
      } catch (err) {
        console.error("Erro inesperado ao carregar posts:", err);
      }
    };

    loadPosts();

    const channel = supabase
      .channel('public:posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        async (payload) => {
          const newPostRaw = payload.new;
          if (!newPostRaw) return;

          let profileData = null;
          try {
            const { data } = await supabase
              .from('profiles')
              .select('nickname, avatar_url')
              .eq('id', newPostRaw.user_id)
              .single();
            profileData = data;
          } catch (err) {
            console.error(err);
          }

          let postData: Partial<FeedPost> = {};
          try {
            const parsed = JSON.parse(newPostRaw.content);
            if (parsed && typeof parsed === 'object') {
              postData = parsed;
            }
          } catch (e) {
            postData = { content: newPostRaw.content };
          }

          const authorNickname = profileData?.nickname || 'Voidy User';
          const authorAvatar = profileData?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newPostRaw.user_id}`;

          const mappedPost: FeedPost = {
            id: newPostRaw.id,
            user_id: newPostRaw.user_id,
            author: authorNickname,
            avatar: authorAvatar,
            content: postData.content || newPostRaw.content,
            title: postData.title || undefined,
            tag: postData.tag || 'BLOG',
            likes: postData.likes || 0,
            time: newPostRaw.created_at ? new Date(newPostRaw.created_at).toLocaleDateString() : 'Agora',
            timestamp: newPostRaw.created_at ? new Date(newPostRaw.created_at).getTime() : Date.now(),
            comments: postData.comments || [],
            customTopColor: postData.customTopColor,
            customBgColor: postData.customBgColor,
            customTopImage: postData.customTopImage,
            customBgImage: postData.customBgImage,
            customBgType: postData.customBgType,
            customGallery: postData.customGallery,
            hideTopOverlay: postData.hideTopOverlay,
            customAvatar: postData.customAvatar,
            customAvatarPosition: postData.customAvatarPosition,
            customKeywords: postData.customKeywords,
            customInfoRows: postData.customInfoRows,
          };

          setFeedPosts(prev => {
            if (prev.some(p => p.id === mappedPost.id)) return prev;
            return [mappedPost, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (gameState === GameState.BANNED) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem('void_game_state', gameState);
        localStorage.setItem('void_user_profile', JSON.stringify(myProfile));
        if (character) localStorage.setItem('void_character', JSON.stringify(character));
        localStorage.setItem('void_notifications', JSON.stringify(notifications));
        localStorage.setItem('void_sessions', JSON.stringify(sessions));
        localStorage.setItem('void_communities', JSON.stringify(communities));
        localStorage.setItem('void_community_visits_v2', JSON.stringify(communityVisits));
        localStorage.setItem('void_feed_posts', JSON.stringify(feedPosts));
        localStorage.setItem('void_public_messages', JSON.stringify(publicMessages));
        if (activeSessionId) {
          localStorage.setItem('void_active_session_id', activeSessionId);
        } else {
          localStorage.removeItem('void_active_session_id');
        }
      } catch (e) {
        console.warn("Auto-save partially failed due to storage limits. Cleaning up old images...");
        const keys = Object.keys(localStorage).filter(k => k.startsWith('vimg_'));
        for (let i = 0; i < Math.min(keys.length, 20); i++) localStorage.removeItem(keys[i]);
      }
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [gameState, myProfile, character, notifications, sessions, communities, communityVisits, feedPosts, publicMessages, activeSessionId]);

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const handleAiResponse = useCallback(async (sessionId: string) => {
    if (isAiProcessing.current.has(sessionId)) return;
    
    const session = sessionsRef.current.find(s => s && s.id === sessionId);
    if (!session || (session.type !== 'IA' && session.type !== 'RPG')) return;
    
    // For RPG type, we only respond if NEXUS is the intended participant or if there are few participants
    // For simplicity, let's assume NEXUS handles all IA and RPG session types where it's called
    
    const sessionMessages = session.messages || [];
    const lastMsg = sessionMessages[sessionMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') return;

    isAiProcessing.current.add(sessionId);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isTyping: true } : s));

    const now = Date.now();
    let profileCopy = { ...myProfile };
    const lastReset = new Date(profileCopy.lastDailyReset || 0);
    
    if (lastReset.getDate() !== new Date(now).getDate()) { 
      profileCopy.dailyMessageCount = 0; 
      profileCopy.lastDailyReset = now; 
      setMyProfile(profileCopy); 
    }
    
    if ((profileCopy.dailyMessageCount || 0) >= 1000) {
      isAiProcessing.current.delete(sessionId);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isTyping: false } : s));
      return;
    }

    setMyProfile(prev => ({ ...prev, dailyMessageCount: (prev.dailyMessageCount || 0) + 1 }));
    
    try {
      const aiService = new AIService(process.env.GEMINI_API_KEY || process.env.API_KEY || '');
      
      let additionalInstructions = "";
      if (session.rpgData) {
        const { tema, objetivo, scenery, currentPhase, npcs } = session.rpgData;
        if (tema) additionalInstructions += `O tema atual é: ${tema}. `;
        if (objetivo) additionalInstructions += `O objetivo atual é: ${objetivo}. `;
        if (scenery) additionalInstructions += `O cenário atual é: ${scenery}. `;
        if (currentPhase) additionalInstructions += `A fase atual da missão é: ${currentPhase}. `;
        if (npcs && npcs.length > 0) {
          additionalInstructions += `NPCs disponíveis que você pode interpretar: ${npcs.map((n: any) => `${n.name} (${n.role})`).join(', ')}. `;
        }
      }

      if (session.type === 'RPG' || session.type === 'IA') {
        additionalInstructions += `\nVocê está em uma cena de personificação. Dê vida ao(s) personagem(ns) como pessoas reais: assimile características, ambientação, clima, gostos, culturas, ritmo, desejos, personalidade, gestos e trejeitos. Mantenha a imersão total.`;
      }

      const aiText = await aiService.generateResponse(sessionMessages, additionalInstructions);
      
      let finalAiText = aiText;
      let updatedName = session.name;
      let updatedAvatar = session.avatar;

      // Extract and clean identity tags
      const nameMatch = finalAiText.match(/\[ID_(?:NAME|NOME):\s*(.*?)\]/i);
      if (nameMatch) {
        updatedName = nameMatch[1].trim();
      }

      const avatarMatch = finalAiText.match(/\[ID_AVATAR:\s*(.*?)\]/i);
      if (avatarMatch) {
        const rawAvatar = avatarMatch[1].trim();
        const upRaw = rawAvatar.toUpperCase();
        let resolved = null;
        
        // 1. Check for specific local upload first (The "Direct Upload" feature)
        // If the AI references a broken domain or a generic keyword, use the last upload
        const looksLikeHallucination = upRaw.includes('IBB.CO') || upRaw.includes('IMGUR') || upRaw.includes('POSTIMG');
        const isGenericRef = upRaw.includes('ESTA IMAGEM') || upRaw.includes('ESSA IMAGEM') || 
                            upRaw.includes('IMAGE') || upRaw === 'PHOTO' || upRaw === 'FOTO' || 
                            upRaw.includes('CONVERSA');

        // Use the last specific image sent in this session or stored globally
        resolved = localStorage.getItem('void_last_uploaded_img') || 
                   localStorage.getItem('img_' + (updatedName || session.name).toUpperCase());

        // 2. If no direct upload in history, try generic resolve
        if (!resolved || (!isGenericRef && !looksLikeHallucination)) {
          const attempt = resolveImageRef(rawAvatar);
          if (attempt) resolved = attempt;
        }
        
        // 3. Fallback contextual searches
        if (!resolved) {
          if (character && (upRaw === character.name.toUpperCase() || upRaw === 'EU' || upRaw === 'PERSONAGEM')) {
            resolved = character.avatar || null;
          }
          if (!resolved && session.rpgData?.npcs) {
            const npc = session.rpgData.npcs.find((n: any) => n.name.toUpperCase() === upRaw);
            if (npc) resolved = npc.avatar;
          }
          if (!resolved) {
            const lastWithImage = [...session.messages].reverse().find(m => m.image);
            if (lastWithImage) resolved = lastWithImage.image;
          }
        }

        if (resolved) {
          // If this is a NEXUS session or persona, we prioritize the manual upload.
          // This prevents the AI from "recreating" or hallucinating a new avatar if the user already uploaded one.
          const isNexus = sessionId === 'nexus-default' || (updatedName || session.name) === 'NEXUS';
          if (isNexus) {
             const customNexusAvatar = localStorage.getItem('void_nexus_custom_avatar') || localStorage.getItem('img_NEXUS');
             if (customNexusAvatar) {
                updatedAvatar = customNexusAvatar;
             } else {
                const isHallucinated = rawAvatar.includes('http') && !rawAvatar.includes('dicebear') && !rawAvatar.includes('googleusercontent');
                if (!isHallucinated) updatedAvatar = resolved;
             }
          } else {
             updatedAvatar = resolved;
          }
          
          // Persist as the definitive avatar for this persona name
          if (updatedName) {
             safeStore('img_' + updatedName.toUpperCase(), resolved);
          }
        } else if (rawAvatar.length < 60 && sessionId !== 'nexus-default') {
          updatedAvatar = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(rawAvatar)}`;
        }
      }

      // Remove tags from the displayed text
      finalAiText = finalAiText
        .replace(/\[ID_(?:NAME|NOME):\s*.*?\]/gi, '')
        .replace(/\[ID_AVATAR:\s*.*?\]/gi, '')
        .trim();

      const aiMsgId = `ai-${Date.now()}`;
      const aiMsgTimestamp = Date.now();
      const aiMsg: Message = { 
        id: aiMsgId, 
        role: 'model', 
        text: finalAiText, 
        timestamp: aiMsgTimestamp, 
        personaName: updatedName,
        personaAvatar: updatedAvatar
      };
      
      setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s,
      name: updatedName,
      avatar: updatedAvatar,
      messages: [...(s.messages || []), aiMsg],
      lastUpdate: aiMsgTimestamp,
      isTyping: false
    } : s));
  } catch (error) { 
    console.error("AI Error:", error);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isTyping: false } : s));
  } finally {
    isAiProcessing.current.delete(sessionId);
  }
}, [myProfile, character]);

  useEffect(() => {
    if (activeSession?.type === 'IA' || activeSession?.type === 'RPG') {
      const msgs = activeSession.messages || [];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.role !== 'model' && lastMsg.personaName !== 'SISTEMA') handleAiResponse(activeSession.id);
    }
  }, [activeSession, handleAiResponse]);

  const handleStartChatSession = async (type: string, name: string, avatar: string = '', background?: string, id?: string, rpgData?: any, initialMessages: Message[] = []) => {
    if (!user) return;
    if (name.toUpperCase() === 'NEXUS') {
      setActiveSessionId('nexus-default');
      setGameState(GameState.PLAYING);
      return;
    }
    if (type === 'PRIVADO') {
      const existing = sessions.find(s => s && (s.name === name || s.id === name) && (s.type === 'PRIVADO' || s.type === 'IA'));
      if (existing) { setActiveSessionId(existing.id); setGameState(GameState.PLAYING); return; }
    }
    const sessionId = id || `session-${Date.now()}`;
    
    const existingSession = sessions.find(s => s.id === sessionId);
    if (existingSession) {
      if (rpgData) {
         setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, rpgData } : s));
      }
      setActiveSessionId(sessionId); 
      setGameState(GameState.PLAYING); 
      return;
    }

    let msgs = [...initialMessages];
    if ((type === 'CLUSTER' || type === 'RPG') && msgs.length === 0) {
      msgs.push({
        id: `sys-join-${Date.now()}`,
        role: 'user',
        text: `${myProfile.name} entrou na conversa`,
        timestamp: Date.now(),
        personaName: 'SISTEMA'
      });
    }
    if (type === 'PRIVADO' && msgs.length === 0) {
      msgs.push({
        id: `sys-${Date.now()}`,
        role: 'user',
        text: `${myProfile.name} iniciou uma conversa`,
        timestamp: Date.now(),
        personaName: 'SISTEMA'
      });
    }

    const newSession: ChatSession = { 
      id: sessionId, 
      name, 
      avatar: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`, 
      messages: msgs, 
      isPinned: false, 
      lastUpdate: Date.now(), 
      type: type as any, 
      status: 'accepted', 
      creator: user.uid,
      rpgData: rpgData,
      isTyping: false,
      participants: [user.uid]
    };
    
    setSessions(prev => [...prev, newSession]);
    if (background) localStorage.setItem(`void_chat_img_${sessionId}`, background);
    setActiveSessionId(sessionId); 
    setGameState(GameState.PLAYING);
  };

  const handleSmartBack = (fallback: GameState = GameState.LOBBY) => {
    setGameState(fallback);
  };

  const handleJoinCommunity = (communityId: string) => {
    if (!user) return;
    const community = communities.find(c => c.id === communityId) || TEST_COMMUNITIES.find(c => c.id === communityId);
    if (community) {
      setCommunities(prev => {
        const exists = prev.find(c => c.id === communityId);
        if (exists) {
          const membersData = exists.membersData || {};
          if (!membersData[user.uid]) {
            membersData[user.uid] = {
              userId: user.uid,
              cityLevel: 1,
              cityReputation: 0,
              cityRank: 'CIDADÃO',
              joinDate: Date.now(),
              personaName: myProfile.name,
              personaAvatar: myProfile.avatarUrl
            };
            return prev.map(c => c.id === communityId ? { ...c, membersData, membersCount: (c.membersCount || 0) + 1 } : c);
          }
          return prev;
        } else {
          const newComm = { ...community, members: [user.uid], membersCount: 1 };
          return [...prev, newComm];
        }
      });
      
      // Transição imediata
      setActiveSessionId(communityId);
      setPreviewCommunity(null);
      setGameState(GameState.PLAYING);
    }
  };

  const handleReset = async () => { 
    await supabase.auth.signOut();
    localStorage.clear(); 
    window.location.reload(); 
  };

  const navigateToLobbySection = (section: 'RADAR' | 'EXPLORAR') => {
    setGameState(GameState.LOBBY); setActiveSessionId(null); setPreviewCommunity(null);
    setTimeout(() => {
        const container = document.querySelector('.snap-y');
        if (container) container.scrollTo({ top: section === 'RADAR' ? 0 : container.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  const handleProfileUpdate = useCallback(async (name: string, avatar: string, pCol?: string, cCol?: string, pImg?: string, cImg?: string, fCol?: string, fStyle?: string, bio?: string, sIcon?: string, hStats?: boolean, nCol?: string, mTop?: string, mFeed?: string, mImg?: string, mFeedImg?: string, mural?: MuralPost[], posts?: FeedPost[], voidyCoins?: number, dailyAdCount?: number, lastAdReset?: number, bStyle?: string, bCol?: string, sCol?: string) => {
    const resolvedAvatar = resolveImageRef(avatar) || avatar;

    // 1. Obtém o usuário de forma robusta e veridica diretamente do Auth do Supabase
    let supaUserId = user?.uid;
    try {
      const { data: { user: activeSupaUser } } = await supabase.auth.getUser();
      if (activeSupaUser) {
        supaUserId = activeSupaUser.id;
      }
    } catch (e) {
      console.warn("Luz auxiliar: falha ao buscar via supabase.auth.getUser(), usando uid reativo:", e);
    }

    if (!supaUserId) {
      console.error("Erro Crítico de Perfil: Nenhum usuário autenticado detectado para realizar o salvamento.");
      return;
    }

    // Atualiza imediatamente o LocalUser no React e no LocalStorage
    // para evitar que useEffects de sinc e concorrência revertam os estados locais do perfil
    setUser(prev => {
      if (!prev) return null;
      const updatedUser = {
        ...prev,
        displayName: name,
        photoURL: resolvedAvatar
      };
      localStorage.setItem('void_local_user', JSON.stringify(updatedUser));
      localStorage.setItem('void_user_name', name);
      localStorage.setItem('void_user_avatar', resolvedAvatar);
      return updatedUser;
    });

    // Atualiza imediatamente o personagem do jogador com o novo nick e avatar
    setCharacter(prev => {
      if (!prev) return null;
      const updatedChar = {
        ...prev,
        name: name,
        avatar: resolvedAvatar
      };
      localStorage.setItem('void_character', JSON.stringify(updatedChar));
      return updatedChar;
    });

    // INSTANT REACTIVITY: Atualiza imediatamente o "myProfile" e o "viewedProfile" (se for o próprio usuário)
    // na memória do React para que as alterações visuais (fundo, biografia, etc.) fiquem visíveis NO MESMO SEGUNDO!
    setMyProfile(prev => {
      const postsWithUserId = posts ? posts.map(pt => ({
        ...pt,
        id: normalizeIdToUUID(pt.id),
        user_id: pt.user_id || supaUserId
      })) : prev.posts;

      const updatedProfile: UserProfile = { 
        ...prev,
        id: supaUserId,
        name, 
        avatarUrl: resolvedAvatar, 
        panelColor: pCol !== undefined ? pCol : prev.panelColor, 
        contentColor: cCol !== undefined ? cCol : prev.contentColor, 
        panelImage: pImg !== undefined ? pImg : prev.panelImage, 
        contentImage: cImg !== undefined ? cImg : prev.contentImage, 
        frameColor: fCol !== undefined ? fCol : prev.frameColor, 
        frameStyle: fStyle !== undefined ? fStyle : prev.frameStyle, 
        bio: bio !== undefined ? bio : prev.bio, 
        statusIcon: sIcon !== undefined ? sIcon : prev.statusIcon, 
        hideStats: hStats !== undefined ? hStats : prev.hideStats, 
        nameColor: nCol !== undefined ? nCol : prev.nameColor,
        statusColor: sCol !== undefined ? sCol : prev.statusColor,
        muralTopColor: mTop !== undefined ? mTop : prev.muralTopColor, 
        muralFeedColor: mFeed !== undefined ? mFeed : prev.muralFeedColor, 
        muralImage: mImg !== undefined ? mImg : prev.muralImage, 
        muralFeedImage: mFeedImg !== undefined ? mFeedImg : prev.muralFeedImage, 
        mural: mural || prev.mural, 
        posts: postsWithUserId ? postsWithUserId.map(pt => ({
          ...pt,
          author: name,
          avatar: resolvedAvatar
        })) : undefined,
        voidyCoins: voidyCoins !== undefined ? voidyCoins : prev.voidyCoins,
        dailyAdCount: dailyAdCount !== undefined ? dailyAdCount : prev.dailyAdCount,
        lastAdReset: lastAdReset !== undefined ? lastAdReset : prev.lastAdReset,
        bubbleStyle: bStyle !== undefined ? bStyle : prev.bubbleStyle,
        bubbleColor: bCol !== undefined ? bCol : prev.bubbleColor
      };

      // Sync posts to the global feed if they were modified via ProfileView
      if (posts) {
        const postsWithUserIdAndAuthor = postsWithUserId.map(pt => ({
          ...pt,
          author: pt.author || name,
          avatar: pt.avatar || resolvedAvatar
        }));
        setFeedPosts(currentFeed => {
          let nextFeed = [...currentFeed];
          let feedChanged = false;
          
          postsWithUserIdAndAuthor.forEach(newPost => {
            const feedIdx = nextFeed.findIndex(f => f.id === newPost.id);
            if (feedIdx !== -1) {
              if (JSON.stringify(nextFeed[feedIdx]) !== JSON.stringify(newPost)) {
                nextFeed[feedIdx] = newPost;
                feedChanged = true;
              }
            } else {
              const isActuallyNew = !prev.posts?.some(old => old.id === newPost.id);
              if (isActuallyNew) {
                nextFeed = [newPost, ...nextFeed];
                feedChanged = true;
              }
            }
          });
          
          return feedChanged ? nextFeed : currentFeed;
        });
      }

      // Sincroniza o novo Nome e Avatar globalmente para todos os posts antigos no Feed
      setFeedPosts(currentFeed => {
        return currentFeed.map(f => {
          if (f.user_id === supaUserId || f.author === prev.name) {
            return {
              ...f,
              author: name,
              avatar: resolvedAvatar
            };
          }
          return f;
        });
      });

      // Sincroniza o novo Nome e Avatar globalmente na lista de mensagens locais do chat público
      setPublicMessages(currentPubMsgs => {
        return currentPubMsgs.map(m => {
          if (m.role === 'user' || m.personaName === prev.name) {
            return {
              ...m,
              personaName: name,
              personaAvatar: resolvedAvatar
            };
          }
          return m;
        });
      });

      // Sincroniza imediatamente com o localStorage sob a chave do perfil para persistir duradouramente
      localStorage.setItem('void_user_profile', JSON.stringify(updatedProfile));

      // Se o próprio usuário estiver visualizando seu perfil, atualiza também a visualização ativa de imediato
      if (viewedProfile && (viewedProfile.isMe || viewedProfile.id === supaUserId)) {
        setViewedProfile(updatedProfile);
      }

      return updatedProfile;
    });

    try {
      // Sincroniza o Nick, Avatar e todas as customizações de perfil no Supabase de forma resiliente.
      // 1. Obtém as colunas suportadas na tabela profiles buscando qualquer perfil existente (para evitar filtros vazios caso o perfil deste usuário específico ainda não exista)
      let dbColumns: string[] = [];
      try {
        const { data: anyProfile } = await supabase.from('profiles').select('*').limit(1);
        if (anyProfile && anyProfile.length > 0) {
          dbColumns = Object.keys(anyProfile[0]);
        }
      } catch (err) {
        console.warn("Luz auxiliar: falha ao inspecionar colunas via limit(1):", err);
      }

      const { data: colCheck, error: colCheckError } = await supabase.from('profiles').select('*').eq('id', supaUserId).single();
      
      if (colCheckError) {
        console.warn("Informação: Perfil não pré-existia no Supabase ou erro de leitura simples:", colCheckError.message);
      } else if (colCheck) {
        dbColumns = Array.from(new Set([...dbColumns, ...Object.keys(colCheck)]));
      }

      // Se todas as tentativas falharem, assume a ampla gama de colunas comuns para garantir o aproveitamento de dados
      if (dbColumns.length === 0) {
        dbColumns = [
          'nickname', 'avatar_url', 'updated_at', 'bio', 'biografia', 
          'status_icon', 'statusIcon', 'status_color', 'statusColor', 
          'name_color', 'nameColor', 'panel_color', 'panelColor', 
          'content_color', 'contentColor', 'panel_image', 'panelImage', 
          'content_image', 'contentImage', 'frame_color', 'frameColor', 
          'frame_style', 'frameStyle', 'bubble_style', 'bubbleStyle', 
          'bubble_color', 'bubbleColor', 'hide_stats', 'hideStats', 
          'mural_top_color', 'muralTopColor', 'mural_feed_color', 'muralFeedColor', 
          'mural_image', 'muralImage', 'mural_feed_image', 'muralFeedImage', 
          'mural', 'mural_posts', 'raw_profile_data', 'customization', 'metadata'
        ];
      }
      
      const genericMetadata = {
        bio,
        statusIcon: sIcon,
        statusColor: sCol,
        nameColor: nCol,
        panelColor: pCol,
        contentColor: cCol,
        panelImage: pImg,
        contentImage: cImg,
        frameColor: fCol,
        frameStyle: fStyle,
        bubbleStyle: bStyle,
        bubbleColor: bCol,
        hideStats: hStats,
        muralTopColor: mTop,
        muralFeedColor: mFeed,
        muralImage: mImg,
        muralFeedImage: mFeedImg,
        mural
      };
      
      const payload: any = {
        nickname: name.trim(),
        avatar_url: `${resolvedAvatar}|metadata:${JSON.stringify(genericMetadata)}`,
        updated_at: new Date().toISOString()
      };

      const setIfSupported = (columnName: string, value: any) => {
        if (dbColumns.includes(columnName) && value !== undefined) {
          payload[columnName] = value;
        }
      };

      // Mapeia todas as customizações de forma resiliente tanto para camelCase quanto para snake_case
      setIfSupported('bio', bio);
      setIfSupported('biografia', bio);

      setIfSupported('status_icon', sIcon);
      setIfSupported('statusIcon', sIcon);

      setIfSupported('status_color', sCol);
      setIfSupported('statusColor', sCol);

      setIfSupported('name_color', nCol);
      setIfSupported('nameColor', nCol);

      setIfSupported('panel_color', pCol);
      setIfSupported('panelColor', pCol);

      setIfSupported('content_color', cCol);
      setIfSupported('contentColor', cCol);

      setIfSupported('panel_image', pImg);
      setIfSupported('panelImage', pImg);

      setIfSupported('content_image', cImg);
      setIfSupported('contentImage', cImg);

      setIfSupported('frame_color', fCol);
      setIfSupported('frameColor', fCol);

      setIfSupported('frame_style', fStyle);
      setIfSupported('frameStyle', fStyle);

      setIfSupported('bubble_style', bStyle);
      setIfSupported('bubbleStyle', bStyle);

      setIfSupported('bubble_color', bCol);
      setIfSupported('bubbleColor', bCol);

      setIfSupported('hide_stats', hStats);
      setIfSupported('hideStats', hStats);

      setIfSupported('mural_top_color', mTop);
      setIfSupported('muralTopColor', mTop);

      setIfSupported('mural_feed_color', mFeed);
      setIfSupported('muralFeedColor', mFeed);

      setIfSupported('mural_image', mImg);
      setIfSupported('muralImage', mImg);

      setIfSupported('mural_feed_image', mFeedImg);
      setIfSupported('muralFeedImage', mFeedImg);

      if (mural) {
        if (dbColumns.includes('mural')) {
          payload['mural'] = mural;
        } else if (dbColumns.includes('mural_posts')) {
          payload['mural_posts'] = mural;
        }
      }

      // 3. Suporte a colunas agregadas de JSON (raw_profile_data, metadata, settings)
      // Se o banco possuir uma coluna JSON genérica, persistimos toda a árvore de customização lá
      setIfSupported('raw_profile_data', genericMetadata);
      setIfSupported('customization', genericMetadata);
      setIfSupported('metadata', genericMetadata);

      console.log("Enviando Payload Atualizado ao Supabase:", payload);

      // Usamos .update() em vez de .upsert() para assegurar máxima conformidade com políticas de RLS e triggers do Supabase
      // Se não houver registro prévio de perfil para update, tentamos fazer upsert de forma controlada
      let { error: writeError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', supaUserId);

      // Se der erro ou se nenhum registro foi atualizado (ex: perfil ainda não tinha ID inserido)
      if (writeError || (colCheck === null)) {
        console.warn("Update silencioso ou falhou. Tentando upsert completo de segurança...");
        const fullPayload = { id: supaUserId, ...payload };
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert(fullPayload, { onConflict: 'id' });
        
        if (upsertErr) {
          writeError = upsertErr;
        } else {
          writeError = null; // Resolvido via upsert!
        }
      }

      // 4. Se houver erro de permissão ou de coluna, geramos um console.error detalhadíssimo
      if (writeError) {
        console.error("❌ ERRO NO SALVAMENTO DO SUPABASE DETECTADO: ❌", {
          codigo: writeError.code,
          mensagem: writeError.message,
          detalhes: writeError.details,
          dica: writeError.hint,
          payloadTentado: payload,
          idDoUsuario: supaUserId
        });
      } else {
        console.log("✅ Perfil sincronizado e persistido com absoluto sucesso no Supabase para o ID:", supaUserId);
        loadGlobalProfiles();
      }

    } catch (supaErr) {
      console.error("Erro excepcional ao salvar dados de personalização de perfil no Supabase:", supaErr);
    }

    // Persistir posts criados/editados no perfil diretamente no Supabase
    if (posts && posts.length > 0) {
      try {
        const currentUser = (await supabase.auth.getUser()).data.user;
        if (currentUser) {
          const userPosts = posts.filter(p => !p.user_id || p.user_id === currentUser.id);
          for (const p of userPosts) {
            const normalizedID = normalizeIdToUUID(p.id);
            const postPayload = {
              id: normalizedID,
              user_id: currentUser.id,
              content: JSON.stringify({
                title: p.title,
                content: p.content,
                tag: p.tag,
                likes: p.likes || 0,
                comments: p.comments || [],
                customTopColor: p.customTopColor,
                customBgColor: p.customBgColor,
                customTopImage: p.customTopImage,
                customBgImage: p.customBgImage,
                customBgType: p.customBgType,
                customGallery: p.customGallery,
                hideTopOverlay: p.hideTopOverlay,
                customAvatar: p.customAvatar,
                customAvatarPosition: p.customAvatarPosition,
                customKeywords: p.customKeywords,
                customInfoRows: p.customInfoRows,
                wideMode: p.wideMode,
                customBgImages: p.customBgImages,
                galleryImages: p.galleryImages
              }),
              created_at: p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString()
            };

            const { error: insertErr } = await supabase
              .from('posts')
              .insert(postPayload);

            if (insertErr) {
              if (insertErr.code === '23505') {
                const { error: updateErr } = await supabase
                  .from('posts')
                  .update({
                    content: postPayload.content
                  })
                  .eq('id', postPayload.id)
                  .eq('user_id', currentUser.id);

                if (updateErr) {
                  console.error("Erro ao atualizar post existente no Supabase via perfil:", updateErr.message);
                }
              } else {
                console.error("Erro ao inserir post no Supabase via perfil:", insertErr.message);
              }
            }
          }
        }
      } catch (e) {
        console.error("Erro na sincronização de posts do perfil com Supabase:", e);
      }
    }

  }, [user, viewedProfile]);

  const renderContent = () => {
    if (editingWikiPost) {
      return (
        <WikiCreation 
          onBack={() => setEditingWikiPost(null)} 
          onCreate={handleUpdateWikiPost} 
          userName={myProfile.name} 
          userAvatar={myProfile.avatarUrl || undefined} 
          verifySafety={verifySafety} 
          initialData={editingWikiPost}
          isCharacterSheet={editingWikiPost.tag === 'WIKI_ENTRADA'}
        />
      );
    }

    if (viewedProfile) return (
      <div className="state-transition-container">
        <ProfileView 
          profile={{
            ...viewedProfile,
            posts: feedPosts.filter(p => viewedProfile.id ? p.user_id === viewedProfile.id : p.author === viewedProfile.name)
          }}
          onBack={() => setViewedProfile(null)} 
          userAvatar={myProfile.avatarUrl || undefined} 
          userName={myProfile.name} 
          verifySafety={verifySafety} 
          addNotification={addNotification} 
          onProfileUpdate={handleProfileUpdate} 
          onEditPost={handleEditWikiPost} 
          onDeletePost={handleDeletePost} 
          onNavigateToChat={(id) => {
            setActiveGlobalChatId(id);
            setActiveGlobalChatPartner(viewedProfile.name);
            setGameState(GameState.GLOBAL_CHAT);
            setViewedProfile(null);
          }}
        />
      </div>
    );

    if (previewCommunity) return (
      <div className="state-transition-container"><CommunityPreview community={previewCommunity} onBack={() => setPreviewCommunity(null)} onJoin={handleJoinCommunity} /></div>
    );

    return (
      <>
        {renderMainContent()}
      </>
    );
  };

  const renderMainContent = () => {
    if (gameState === GameState.PLAYING && isCommunityHome && activeCommunity) return (
      <div className="state-transition-container">
        <CommunityView 
          community={activeCommunity} 
          userProfile={myProfile} 
          onProfileUpdate={handleProfileUpdate} 
          userName={myProfile.name} 
          userAvatar={resolveImageRef(myProfile.avatarUrl) || undefined} 
          onBack={() => { setActiveSessionId(null); setGameState(GameState.LOBBY); }} 
          onUpdate={(upd) => setCommunities(prev => prev.map(c => c.id === activeCommunity.id ? upd(c) : c))} 
          onDelete={handleLeaveCommunity} 
          onAddFeedPost={handleAddPost}
          onAddMemberClick={() => {
            setReturnToState({ id: activeSessionId, state: GameState.PLAYING });
            setGameState(GameState.INVITE_FOLLOWERS);
          }} 
          onViewProfile={handleViewProfile} 
          onNavigateToPrivate={() => { setReturnToState({ id: activeCommunity.id, state: GameState.PLAYING }); setArchiveViewMode('PRIVADO'); setGameState(GameState.MESSAGES); }} 
          onNavigateToPublicSearch={() => { setReturnToState({ id: activeCommunity.id, state: GameState.PLAYING }); setGameState(GameState.COMMUNITY_SEARCH); }} 
          onNavigateToDrafts={() => { setReturnToState({ id: activeCommunity.id, state: GameState.PLAYING }); setGameState(GameState.DRAFTS); }} 
          onNavigateToMembers={() => { setReturnToState({ id: activeCommunity.id, state: GameState.PLAYING }); setGameState(GameState.SOCIAL_DISCOVERY); }} 
          onOpenNotifications={() => setIsNotifOpen(true)} 
          onShowBio={setPreviewCommunity} 
          addNotification={addNotification} 
          verifySafety={verifySafety} 
          onOpenStore={() => setIsStoreOpen(true)}
          onStartChat={(type, name, avatar, background, id, rpgData, initialMessages) => { 
            setReturnToState({ id: activeCommunity.id, state: GameState.PLAYING }); 
            handleStartChatSession(type, name, avatar, background, id, rpgData, initialMessages); 
          }} 
          character={character}
          onUpdateCharacter={handleUpdateCharacter}
        />
      </div>
    );

    switch (gameState) {
      case GameState.AUTH: return <AuthScreen onLogin={() => setGameState(GameState.LOBBY)} />;
      case GameState.ONBOARDING: return <OnboardingScreen onComplete={(nick) => {
        if (user) {
          const updatedUser = { ...user, displayName: nick };
          setUser(updatedUser);
          
          // Sincroniza o perfil recém-criado imediatamente para carregar dados reais na interface global
          supabase.auth.getUser().then(({ data: { user: supaUser } }) => {
            if (supaUser) {
              syncUser(supaUser);
            }
          });
        }
        setGameState(GameState.LOBBY);
      }} />;
      case GameState.CHARACTER_CREATION: return <CharacterCreation onBack={() => setGameState(GameState.LOBBY)} onComplete={(char) => { handleUpdateCharacter(char); setGameState(GameState.LOBBY); }} verifySafety={verifySafety} />;
      case GameState.FEED: return <FeedView onBack={() => handleSmartBack(GameState.LOBBY)} userAvatar={resolveImageRef(myProfile.avatarUrl) || undefined} userName={myProfile.name} posts={feedPosts} verifySafety={verifySafety} onAddPost={(p) => handleAddPost({...p, id: Date.now().toString(), likes: 0, time: 'Just now', timestamp: Date.now()})} onDeletePost={handleDeletePost} onEditPost={handleEditWikiPost} isAppModerator={isAppModerator} />;
      case GameState.DRAFTS: return <DraftsView onBack={() => handleSmartBack(GameState.LOBBY)} userName={myProfile.name} userAvatar={resolveImageRef(myProfile.avatarUrl) || undefined} onPublish={(p) => { handleAddPost(p); setGameState(GameState.FEED); }} verifySafety={verifySafety} />;
      case GameState.INVITE_FOLLOWERS:
        return <InviteFollowers onBack={() => handleSmartBack(GameState.PLAYING)} onInviteMember={(m) => {
          addNotification({ type: 'INVITE', title: 'Sincronia Solicitada', content: `Você convidou ${m.name} para o cluster ativo.`, sender: 'SISTEMA' });
        }} />;
      case GameState.LOBBY:
      case GameState.COMMUNITY_CREATION:
        return (
          <div className="fade-scene">
            <div className="fade-layer lobby-layer">
              <div className="state-transition-container">
                <Lobby 
              onStart={handleStartChatSession} 
              communities={communities} 
              customThemes={DEFAULT_THEMES} 
              onAtTopChange={setLobbyAtTop} 
              onSelectCommunity={(id) => { recordVisit(id); setActiveSessionId(id); setGameState(GameState.PLAYING); }} 
              onPreviewCommunity={setPreviewCommunity} 
              onNavigateToChats={() => setGameState(GameState.RECENT_CHATS)} 
              onNavigateToLocation={() => setGameState(GameState.SOCIAL_DISCOVERY)} 
              onNavigateToHelp={() => setIsHelpOpen(true)} 
              onViewProfile={handleViewProfile} 
              onCreateCommunity={() => setGameState(GameState.COMMUNITY_CREATION)} 
              isSearchOpen={isLocalSearchOpen} 
              onOpenSearch={() => setIsLocalSearchOpen(true)}
              onCloseSearch={() => setIsLocalSearchOpen(false)} 
              onLeaveCommunity={handleLeaveCommunity} 
            />
              </div>
            </div>
            <div className={`fade-layer builder-layer ${gameState === GameState.COMMUNITY_CREATION ? 'active' : ''}`}>
              <CommunityCreation onCancel={() => setGameState(GameState.LOBBY)} userName={myProfile.name} userAvatar={resolveImageRef(myProfile.avatarUrl) || undefined} onCreate={handleCreateCommunity} verifySafety={verifySafety} />
            </div>
          </div>
        );
      case GameState.SOCIAL_DISCOVERY:
          return <SocialDiscovery members={globalProfiles} isInviting={false} onBack={() => handleSmartBack(GameState.LOBBY)} onSelectMember={(m) => handleStartChatSession('PRIVADO', m.name, m.avatarUrl)} onViewProfile={handleViewProfile} />;
      case GameState.RECENT_CHATS: return <RecentCommunityChats communities={[...TEST_COMMUNITIES, ...communities]} visitData={communityVisits} onSelect={(id) => { recordVisit(id); setActiveSessionId(id); setGameState(GameState.PLAYING); }} onBack={() => setGameState(GameState.LOBBY)} />;
      case GameState.PUBLIC_CHAT: return <PublicChat 
        onBack={() => handleSmartBack(GameState.LOBBY)} 
        onLeave={() => {
          setPublicMessages(prev => [...prev, {
            id: `sys-leave-${Date.now()}`,
            role: 'user',
            text: `${myProfile.name} saiu da conversa`,
            timestamp: Date.now(),
            personaName: 'SISTEMA'
          }]);
          setActiveSessionId(null);
          setArchiveViewMode('CHATS');
          setGameState(GameState.MESSAGES);
        }}
        userAvatar={myProfile.avatarUrl || undefined} 
        userName={myProfile.name} 
        publicMessages={publicMessages} 
        onUpdatePublicMessages={setPublicMessages} 
        onViewProfile={handleViewProfile} 
        onAddMemberClick={() => {
          setReturnToState({ id: null, state: GameState.PUBLIC_CHAT });
          setGameState(GameState.INVITE_FOLLOWERS);
        }} 
        isAdmin={true}
        addNotification={addNotification} 
        verifySafety={verifySafety} 
      />;
      case GameState.MESSAGES: 
        return <MessagesArchive 
          sessions={allSessions} 
          activeSessionId={activeSessionId || ''} 
          onTogglePin={(id) => setSessions(prev => prev.map(s => s && s.id === id ? {...s, isPinned: !s.isPinned} : s))} 
          onDeleteSession={(id) => setSessions(prev => prev.filter(s => s && s.id !== id))} 
          onBlockUser={() => {}} 
          onSelectSession={(id) => { 
            const global = globalChats.find(c => c.id === id);
            if (global) {
              setActiveGlobalChatId(id);
              setActiveGlobalChatPartner(global.other_user_nickname);
              setGameState(GameState.GLOBAL_CHAT);
            } else {
              setActiveSessionId(id); 
              setGameState(GameState.PLAYING); 
            }
          }} 
          onBack={() => handleSmartBack(GameState.LOBBY)} 
          onFindOperatives={() => setGameState(GameState.SOCIAL_DISCOVERY)} 
          title={archiveViewMode} 
          addNotification={addNotification} 
        />;
      case GameState.COMMUNITY_SEARCH: return <CommunitySearch onBack={() => handleSmartBack(GameState.LOBBY)} communities={[...TEST_COMMUNITIES, ...communities]} onSelect={(id) => { recordVisit(id); setActiveSessionId(id); setGameState(GameState.PLAYING); }} onPreview={(c) => { setPreviewCommunity(c); setGameState(GameState.LOBBY); }} />;
      case GameState.RANKING: return <RankingView onBack={() => handleSmartBack(GameState.LOBBY)} onPreviewCommunity={(c) => { setPreviewCommunity(c); setGameState(GameState.LOBBY); }} communities={[...TEST_COMMUNITIES, ...communities]} />;
      case GameState.MEMBERS_VIEW: return <MembersView onBack={() => handleSmartBack(GameState.LOBBY)} onViewProfile={handleViewProfile} />;
      case GameState.GLOBAL_CHAT: {
        const currentGlobal = globalChats.find(c => c.id === activeGlobalChatId);
        const partnerAvatar = currentGlobal?.other_user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeGlobalChatPartner}`;
        return (
          <GlobalChat 
            chatId={activeGlobalChatId || ''} 
            otherUserNickname={activeGlobalChatPartner}
            otherUserAvatar={partnerAvatar}
            onBack={() => setGameState(GameState.MESSAGES)}
            userName={myProfile.name}
            userAvatar={myProfile.avatarUrl || ''}
            currentUserId={user?.uid || ''}
            onDeleteSession={async (id) => {
              if (confirm("Deseja realmente sair e excluir esta conversa?")) {
                try {
                  await supabase.from('chats').delete().eq('id', id);
                  setGlobalChats(prev => prev.filter(c => c.id !== id));
                  setGameState(GameState.MESSAGES);
                } catch (err) {
                  console.error("Erro ao excluir chat:", err);
                }
              }
            }}
          />
        );
      }
      case GameState.PLAYING:
        if (activeSession) {
          const charData = character || { name: myProfile.name, class: 'Membro', stats: { strength: 5, agility: 5, intelligence: 5, willpower: 5, hp: 100 }, inventory: Array(10).fill(null), background: '', wallet: 0 };
          const isAdmin = activeSession.id === 'nexus-default' || activeSession.creator === myProfile.name || activeSession.admins?.includes(myProfile.name) || activeSession.type === 'PRIVADO' || activeSession.type === 'IA' || activeSession.nature === 'RPG' || activeSession.type === 'PUBLICO' || activeSession.type === 'CLUSTER';
          const isCoAdmin = activeSession.coAdmins?.includes(myProfile.name);
          return (
            <div className="state-transition-container">
              <MainConsole 
                key={activeSession.id}
                character={charData} 
                session={activeSession} 
                isAdmin={isAdmin || isCoAdmin}
                isFullAdmin={isAdmin}
                onUpdateCharacter={handleUpdateCharacter} 
                setMessages={memoizedSetMessages} 
                sceneImage={null} 
                setSceneImage={(url) => {}} 
                userAvatar={resolveImageRef(myProfile.avatarUrl) || undefined} 
                onOpenProfile={handleViewProfile}
                onNavigateBack={memoizedOnNavigateBack} 
                onDeleteSession={memoizedOnDeleteSession} 
                onBlockUser={(name) => {}} 
                onAddMemberClick={memoizedOnAddMemberClick} 
                addNotification={addNotification} 
                verifySafety={verifySafety} 
                onAcceptInvite={(id) => {}} 
                onUpdateSession={memoizedOnUpdateSession}
                onMinimizeMedia={(media) => setMinimizedMedia({ ...media, characterData: charData })}
                community={activeCommunity}
              />
            </div>
          );
        }
        return null;
      default: return <AuthScreen onLogin={() => setGameState(GameState.LOBBY)} />;
    }
  };

  return (
    <div className="flex-1 h-full w-full bg-[#02040a] text-white overflow-hidden font-inter relative flex">
      {gameState === GameState.LOBBY && !viewedProfile && !previewCommunity && (
        <header className="absolute top-4 md:top-8 left-0 w-full h-12 md:h-16 flex items-center justify-between px-4 md:px-6 z-[150] pointer-events-none">
          <div className="pointer-events-auto"><button onClick={() => setIsSidebarOpen(true)} className="p-1.5 md:p-2 hover:bg-white/5 rounded-xl transition-all"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7"/></svg></button></div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={() => setIsLocalSearchOpen(true)} className="p-1.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all"><svg className="w-4 h-4 md:w-5 md:h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
            <button onClick={() => setIsNotifOpen(true)} className="relative p-1.5 bg-white/5 rounded-xl border border-white/10 transition-all"><svg className="w-4 h-4 md:w-5 md:h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></button>
          </div>
        </header>
      )}
      <main className="flex-1 relative overflow-hidden flex flex-col">{renderContent()}</main>
      
      {isStoreOpen && (
        <div className="fixed inset-0 z-[1000] bg-[#02040a] flex flex-col animate-in slide-in-from-bottom duration-500">
          <header className="h-16 md:h-20 bg-white/5 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 shrink-0">
            <button onClick={() => setIsStoreOpen(false)} className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all active:scale-90 border border-white/5">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div className="flex items-center gap-4">
              <button onClick={() => setStoreTab('FRAMES')} className={`text-[10px] font-black uppercase tracking-widest transition-all ${storeTab === 'FRAMES' ? 'text-cyan-400' : 'text-white/40'}`}>Molduras</button>
              <button onClick={() => setStoreTab('BUBBLES')} className={`text-[10px] font-black uppercase tracking-widest transition-all ${storeTab === 'BUBBLES' ? 'text-cyan-400' : 'text-white/40'}`}>Balões</button>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <span className="text-amber-400 text-xs">✨</span>
              <span className="text-[10px] font-black text-white">{myProfile.voidyCoins || 0}</span>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-6 pb-32">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(storeTab === 'FRAMES' ? AVAILABLE_GLOBAL_FRAMES : AVAILABLE_GLOBAL_BUBBLES).map((item: any) => (
                <div key={item.id} className="bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col items-center gap-4 group">
                  <div className="relative w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
                    {storeTab === 'FRAMES' ? (
                      <div className="w-full h-full rounded-full border-4" style={{ borderColor: item.color }}>
                        <img src={resolveImageRef(myProfile.avatarUrl)} loading="lazy" decoding="async" className="w-full h-full object-cover rounded-full p-1" alt="preview" />
                      </div>
                    ) : (
                      <div className={`px-4 py-2 rounded-2xl border-2 flex items-center gap-2 ${item.style}`}>
                        <span className="text-lg">{item.icon}</span>
                        <span className="text-[10px] font-bold">Olá!</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white truncate w-full">{item.name}</h3>
                    <p className="text-[8px] font-bold text-white/40 uppercase mt-1">{item.category}</p>
                  </div>
                  <button className="w-full py-2 bg-cyan-500 rounded-xl text-black font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                    <span>✨</span>
                    <span>{item.price}</span>
                  </button>
                </div>
              ))}
            </div>
          </main>
        </div>
      )}
      
      {shouldShowBottomNav && (
        <div className="fixed bottom-0 left-0 w-full z-[140] shrink-0">
          <nav className="h-14 md:h-20 bg-[#0a1a3a]/10 backdrop-blur-3xl border-t border-white/5 flex items-center justify-around px-4">
            <button onClick={() => navigateToLobbySection('RADAR')} className={`flex flex-col items-center gap-1 transition-all ${gameState === GameState.LOBBY && lobbyAtTop ? 'text-white' : 'text-purple-200/60'}`}><svg className="w-5 h-5 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg><span className="text-[7px] md:text-[9px] font-black uppercase">Radar</span></button>
            <button onClick={() => navigateToLobbySection('EXPLORAR')} className={`flex flex-col items-center gap-0.5 transition-all ${gameState === GameState.LOBBY && !lobbyAtTop ? 'text-white' : 'text-purple-200/60'}`}><svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 8l-1 4 4 1-3-5z"/><path d="M12 21a9 9 0 100-18 9 9 0 000 18z"/></svg><span className="text-[7px] md:text-[9px] font-black uppercase">Explorar</span></button>
            <div className="relative"><button onClick={() => setGameState(GameState.COMMUNITY_CREATION)} className="relative -top-3 w-12 h-12 md:w-14 md:h-14 rounded-full bg-cyan-500 flex items-center justify-center text-white shadow-lg active:scale-90 border-[4px] border-[#02040a]"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M12 4v16m8-8H4"/></svg></button></div>
            <button onClick={() => setGameState(GameState.RECENT_CHATS)} className={`flex flex-col items-center gap-0.5 transition-all ${gameState === GameState.RECENT_CHATS ? 'text-white' : 'text-purple-200/60'}`}><svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg><span className="text-[7px] font-black uppercase">Sinal</span></button>
            <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-0.5 text-purple-200/60"><svg className="w-5 h-5 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg><span className="text-[7px] md:text-[9px] font-black uppercase">Nexus</span></button>
          </nav>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .fade-scene { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .fade-layer { position: absolute; inset: 0; width: 100%; height: 100%; transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1); will-change: opacity, transform; }
        .lobby-layer { z-index: 10; }
        .builder-layer { opacity: 0; pointer-events: none; z-index: 500; transform: translateY(-20px) scale(0.98); background: #02040a; }
        .builder-layer.active { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }
        
        @keyframes neon-blink {
          0%, 100% { 
            box-shadow: 0 0 0px rgba(34, 211, 238, 0);
            background-color: transparent;
          }
          50% { 
            box-shadow: 0 0 25px rgba(34, 211, 238, 0.3);
            background-color: rgba(34, 211, 238, 0.05);
          }
        }
        .neon-blink {
          animation: neon-blink 0.8s ease-in-out 3;
          position: relative;
          z-index: 50;
          border-radius: 2rem;
        }
      `}} />
      <SocialSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        userAvatar={resolveImageRef(myProfile.avatarUrl) || undefined} 
        userName={myProfile.name} 
        onOpenProfile={() => { 
          setViewedProfile({ ...myProfile }); 
          setIsSidebarOpen(false); 
        }} 
        onNavigateToFeed={() => { setGameState(GameState.FEED); setActiveSessionId(null); setIsSidebarOpen(false); }} 
        onNavigateToPrivate={() => { setArchiveViewMode('PRIVADO'); setGameState(GameState.MESSAGES); setActiveSessionId(null); setIsSidebarOpen(false); }} 
        onNavigateToMembers={() => { setGameState(GameState.MEMBERS_VIEW); setActiveSessionId(null); setIsSidebarOpen(false); }}
        onNavigateToChats={() => { setArchiveViewMode('CHATS'); setGameState(GameState.MESSAGES); setActiveSessionId(null); setIsSidebarOpen(false); }} 
        onNavigateToPublicChat={() => {
          setPublicMessages(prev => [...prev, {
            id: `sys-join-${Date.now()}`,
            role: 'user',
            text: `${myProfile.name} entrou na conversa`,
            timestamp: Date.now(),
            personaName: 'SISTEMA'
          }]);
          setGameState(GameState.PUBLIC_CHAT);
          setIsSidebarOpen(false);
        }}
        onNavigateToRanking={() => { setGameState(GameState.RANKING); setActiveSessionId(null); setIsSidebarOpen(false); }} 
        onNavigateToDrafts={() => { setGameState(GameState.DRAFTS); setActiveSessionId(null); setIsSidebarOpen(false); }} 
        onReset={handleReset} 
        onGoHome={() => { setGameState(GameState.LOBBY); setActiveSessionId(null); setIsSidebarOpen(false); }} 
        communities={communities} 
        onSelectCommunity={(id) => { recordVisit(id); setActiveSessionId(id); setGameState(GameState.PLAYING); setIsSidebarOpen(false); }} 
      />
      {isNotifOpen && (
        <NotificationCenter 
          isOpen={isNotifOpen} 
          onClose={() => setIsNotifOpen(false)} 
          notifications={notifications} 
          onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? {...n, read: true} : n))} 
          onAction={(n) => {
            if (n.targetSessionId) {
              setSessions(prev => prev.map(s => s.id === n.targetSessionId ? { ...s, targetMessageId: n.targetMessageId } : s));
              setActiveSessionId(n.targetSessionId);
              setGameState(GameState.PLAYING);
              setIsNotifOpen(false);
            }
          }} 
          permissionStatus={permissionStatus}
          onRequestPermission={requestPermission}
        />
      )}

      {activeToast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-[340px] md:max-w-md px-4 pointer-events-auto animate-in fade-in slide-in-from-top-12 duration-300">
          <div className="bg-[#0a0f24]/90 border-2 border-cyan-500/40 backdrop-blur-xl rounded-2xl p-4 shadow-[0_0_35px_rgba(6,182,212,0.25)] flex gap-3 items-start relative select-none">
            <div className={`p-2.5 rounded-xl text-base shrink-0 ${
              activeToast.type === 'INVITE' ? 'bg-indigo-500/20 text-indigo-400' :
              activeToast.type === 'PROMOTION' ? 'bg-amber-500/20 text-amber-400' :
              activeToast.type === 'COMMENT' ? 'bg-cyan-500/20 text-cyan-400' :
              activeToast.type === 'SYSTEM' ? 'bg-emerald-500/20 text-emerald-400' :
              'bg-cyan-500/20 text-cyan-400'
            }`}>
              {activeToast.type === 'INVITE' ? '✉️' :
               activeToast.type === 'PROMOTION' ? '✨' :
               activeToast.type === 'COMMENT' ? '💬' :
               activeToast.type === 'SYSTEM' ? '⚙️' : '🔔'}
            </div>
            
            <div className="flex-1 min-w-0 pr-6">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-cyan-400">{activeToast.title}</h4>
              <p className="text-xs text-slate-100 font-medium mt-1 leading-relaxed break-words">{activeToast.content}</p>
              {activeToast.sender && (
                <div className="flex items-center gap-1.5 mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Por:</span>
                  <span className="text-white bg-white/5 px-1.5 py-0.5 rounded">{activeToast.sender}</span>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setActiveToast(null)} 
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isHelpOpen && <HelpOverlay onClose={() => setIsHelpOpen(false)} onReset={handleReset} />}
    </div>
  );
};

export default App;
