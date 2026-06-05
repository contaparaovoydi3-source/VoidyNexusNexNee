import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

// Detecção segura de ambiente React Native
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

export interface ExpoNotification {
  request: {
    content: {
      title?: string;
      body?: string;
      data?: Record<string, any>;
    };
  };
}

export function useExpoNotifications(userId: string | undefined) {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission;
    }
    return 'default';
  });

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Função manual para requisitar permissões de notificações (ideal para cliques de botão do usuário)
  const requestPermission = async (): Promise<boolean> => {
    const isMedian = typeof window !== 'undefined' && (
      !!(window as any).gonative || 
      !!(window as any).median || 
      (navigator?.userAgent || '').toLowerCase().includes('gonative') || 
      (navigator?.userAgent || '').toLowerCase().includes('median')
    );

    if (isMedian) {
      try {
        console.log('📱 [NEXUS] GoNative/Median detectado no requestPermission manual.');
        if ((window as any).gonative && (window as any).gonative.push) {
          if ((window as any).gonative.push.onesignal) {
            (window as any).gonative.push.onesignal.register();
          } else {
            (window as any).gonative.push.register();
          }
        } else {
          window.location.href = "gonative://push/onesignal/register";
        }
        
        setTimeout(() => {
          window.location.href = "gonative://push/onesignal/onesignalInfo?callback=gonative_onesignal_info";
        }, 1000);
        
        setPermissionStatus('granted');
        return true;
      } catch (e) {
        console.error('❌ Erro na ponte GoNative/Median ao solicitar permissão:', e);
        return false;
      }
    }

    if (!isReactNative) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const status = await window.Notification.requestPermission();
          setPermissionStatus(status);
          console.log('🔔 [NEXUS] Status da permissão de notificações Web requisitada ativamente:', status);
          
          if (status === 'granted') {
            const mockToken = 'web_sandbox_token_' + Math.random().toString(36).substr(2, 9);
            setExpoPushToken(mockToken);
            
            if (userId) {
              const { error: dbError } = await supabase
                .from('profiles')
                .update({ expo_push_token: mockToken })
                .eq('id', userId);
                
              if (dbError) {
                console.error('❌ Erro ao salvar token web no Supabase:', dbError);
              }
            }

            try {
              new window.Notification('Conexão Concluída', {
                body: 'Notificações ativas no navegador com sucesso!',
                tag: 'nexus-active'
              });
            } catch (e) {
              console.log('Navegador bloqueou exibição direta de teste de notificação sem foco, mas permissão está ATIVA.');
            }
            return true;
          }
          return false;
        } catch (e: any) {
          console.error('❌ Erro ao solicitar permissão de Notificação Web:', e);
          setError(e.message);
          return false;
        }
      }
      return false;
    } else {
      // 2. DISPOSITIVO NATIVO EM PRODUÇÃO (Expo / React Native)
      try {
        const nName = 'expo-notifications';
        const Notifications = await import(/* @vite-ignore */ nName);
        const { status } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(status);
        if (status === 'granted') {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          const token = tokenData.data;
          setExpoPushToken(token);
          if (userId && token) {
            await supabase
              .from('profiles')
              .update({ expo_push_token: token })
              .eq('id', userId);
          }
          return true;
        }
        return false;
      } catch (err: any) {
        console.error('❌ Erro ao solicitar permissão native:', err);
        return false;
      }
    }
  };

  // Sincroniza o token com a tabela profiles no Supabase imediatamente quando o token for gerado ou o userId for definido
  useEffect(() => {
    if (userId && expoPushToken) {
      const updateProfileToken = async () => {
        const { error: dbError } = await supabase
          .from('profiles')
          .update({ expo_push_token: expoPushToken })
          .eq('id', userId);

        if (dbError) {
          console.error('❌ Erro ao atualizar o token de push no Supabase via efeito de sincronização:', dbError);
        } else {
          console.log('✅ Token registrado com sucesso no perfil do usuário no Supabase:', userId);
        }
      };
      updateProfileToken();
    }
  }, [userId, expoPushToken]);

  // Registra globalmente callbacks do GoNative/Median para obter o Player ID do OneSignal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleInfo = async (info: any) => {
        console.log('🔔 [NEXUS] GoNative/Median OneSignal Info recebido:', info);
        if (info && (info.oneSignalUserId || info.registrationId || info.userId)) {
          const token = info.oneSignalUserId || info.registrationId || info.userId;
          setExpoPushToken(token);
          setPermissionStatus('granted');
          if (userId) {
            await supabase
              .from('profiles')
              .update({ expo_push_token: token })
              .eq('id', userId);
          }
        }
      };

      (window as any).gonative_onesignal_info = handleInfo;
      (window as any).gonative_push_info = handleInfo;
    }
  }, [userId]);

  useEffect(() => {
    async function loadAndRegister() {
      const isMedian = typeof window !== 'undefined' && (
        !!(window as any).gonative || 
        !!(window as any).median || 
        (navigator?.userAgent || '').toLowerCase().includes('gonative') || 
        (navigator?.userAgent || '').toLowerCase().includes('median')
      );

      // 1. COMPATIBILIDADE COM NAVEGADOR WEB / MEDIAN / VERCEL WRAPPERS
      if (!isReactNative) {
        // Tenta acionar a permissão de Web Notification nativa do navegador/Android WebView imediatamente
        if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            console.log('🔔 [NEXUS] Solicitando permissão nativa Web Notification ao abrir o app...');
            window.Notification.requestPermission().then(status => {
              setPermissionStatus(status);
              console.log('🔔 [NEXUS] Resposta da permissão de Web Notification:', status);
              if (status === 'granted') {
                const mockToken = 'web_sandbox_token_auto_' + Math.random().toString(36).substr(2, 9);
                setExpoPushToken(mockToken);
              }
            }).catch(err => {
              console.warn('Erro ao chamar Notification.requestPermission:', err);
            });
          } catch (e) {
            console.warn('Erro ao acessar a API de Notification.requestPermission:', e);
          }
        }

        // Tenta executar a requisição por expo-notifications de forma assíncrona para garantir compatibilidade se houver suporte expo residual
        try {
          const nName = 'expo-notifications';
          const Notifications = await import(/* @vite-ignore */ nName);
          console.log('📦 [NEXUS] Módulo expo-notifications importado na Web. Requisitando permissões do Expo...');
          
          // Registro explícito de canais para o Android na Web/Hybrid Wrapper
          try {
            console.log('📦 [NEXUS] Registrando canais de notificação nativos via Expo...');
            const channelsToRegister = ['default', 'default-channel', 'voidy-notifications', 'notifications'];
            for (const channelId of channelsToRegister) {
              await Notifications.setNotificationChannelAsync(channelId, {
                name: channelId === 'voidy-notifications' ? 'VOIDY Notificações' : 'Notificações Gerais',
                importance: Notifications.AndroidImportance ? Notifications.AndroidImportance.MAX : 5,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#00f3ff',
                sound: 'default'
              });
              console.log(`✅ Canal de Notificação '${channelId}' registrado com sucesso.`);
            }
          } catch (channelErr) {
            console.warn('Erro ao definir canais de notificação via Expo:', channelErr);
          }

          const { status } = await Notifications.requestPermissionsAsync();
          setPermissionStatus(status);
          console.log('📦 [NEXUS] Status obtido do Expo na inicialização Web:', status);
        } catch (e) {
          console.log('ℹ️ Módulo expo-notifications em ambiente web convencional está indisponível (comportamento esperado).');
        }

        if (isMedian) {
          console.log('📱 [NEXUS] GoNative/Median detectado. Acionando ativação de permissões de push nativas...');
          setPermissionStatus('granted'); // Define como válido de antemão para liberar interfaces no dashboard
          
          try {
            // 1. Aciona via Javascript Bridge direto se disponível de imediato
            if ((window as any).gonative) {
              const gonative = (window as any).gonative;
              if (gonative.push) {
                if (typeof gonative.push.register === 'function') {
                  console.log('📱 [NEXUS] Executando gonative.push.register()');
                  gonative.push.register();
                }
                if (gonative.push.onesignal && typeof gonative.push.onesignal.register === 'function') {
                  console.log('📱 [NEXUS] Executando gonative.push.onesignal.register()');
                  gonative.push.onesignal.register();
                }
              }
            }
            
            // 2. Aciona via Custom URL schemes (MUITO mais robusto em WebViews Android) para forçar o pop-up nativo
            setTimeout(() => {
              console.log('📱 [NEXUS] Despachando protocolo de registro push genérico do GoNative');
              window.location.href = "gonative://push/register";
            }, 100);

            setTimeout(() => {
              console.log('📱 [NEXUS] Despachando protocolo de registro push do GoNative com OneSignal');
              window.location.href = "gonative://push/onesignal/register";
            }, 500);

            // 3. Solicita a coleta de metadados do token / playerId para o callback correspondente
            setTimeout(() => {
              console.log('📱 [NEXUS] Solicitando informações do push do GoNative');
              window.location.href = "gonative://push/onesignal/onesignalInfo?callback=gonative_onesignal_info";
            }, 1000);

          } catch (e) {
            console.warn('Erro ao disparar pontes GoNative push:', e);
          }
        }
        return;
      }

      // 2. DISPOSITIVO NATIVO EM PRODUÇÃO (Expo / React Native)
      // Usamos importação dinâmica com variáveis e /* @vite-ignore */ para que o compilador do TypeScript (tsc)
      // não acuse erros de módulos ausentes ("Cannot find module"), enquanto funciona nativamente no celular.
      try {
        const dName = 'expo-device';
        const nName = 'expo-notifications';
        const rName = 'react-native';

        const Device = await import(/* @vite-ignore */ dName);
        const Notifications = await import(/* @vite-ignore */ nName);
        const { Platform } = await import(/* @vite-ignore */ rName);

        // Configura o comportamento padrão com o app aberto
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        if (!Device.isDevice) {
          console.warn('⚠️ O push exige um dispositivo físico real.');
          setError('Push notifications require a physical device');
          return;
        }

        // Configura canais para Android
        if (Platform.OS === 'android') {
          const channelsToRegister = ['default', 'default-channel', 'voidy-notifications', 'notifications'];
          for (const channelId of channelsToRegister) {
            await Notifications.setNotificationChannelAsync(channelId, {
              name: channelId === 'voidy-notifications' ? 'VOIDY Notificações' : 'Notificações Gerais',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#00f3ff',
              sound: 'default'
            });
            console.log(`✅ Canal de Notificação nativo '${channelId}' registrado.`);
          }
        }

        // Verifica e pede permissões
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        setPermissionStatus(existingStatus);
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          // Não interrompe ou força se do local do applet / iframe, mas tenta adquirir
          try {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
            setPermissionStatus(status);
          } catch {}
        }

        if (finalStatus !== 'granted') {
          console.warn('⚠️ Permissão para alertas de push negada.');
          setError('Notification permission not granted');
          return;
        }

        // Solicita o Token de Push Expo
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        console.log('📱 Dispositivo registrado com sucesso! Push Token:', token);
        setExpoPushToken(token);

        // Atualiza a tabela "profiles" no Supabase com o TOKEN
        if (userId && token) {
          const { error: dbError } = await supabase
            .from('profiles')
            .update({ expo_push_token: token })
            .eq('id', userId);

          if (dbError) {
            console.error('❌ Erro ao atualizar o token de push no Supabase:', dbError);
          } else {
            console.log('✅ Token registrado com sucesso no perfil:', userId);
          }
        }

        // Registra os listeners ativos
        notificationListener.current = Notifications.addNotificationReceivedListener((incoming: any) => {
          console.log('📬 Notificação recebida em Foreground:', incoming);
          setNotification(incoming);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const payload = response.notification.request.content.data;
          console.log('👉 Usuário clicou na notificação. Payload:', payload);
        });

      } catch (err: any) {
        console.error('❌ Erro na inicialização do Expo Notifications:', err);
        setError(err.message);
      }
    }

    loadAndRegister();

    // Cleanup dos listeners
    return () => {
      async function cleanup() {
        if (isReactNative) {
          try {
            const nName = 'expo-notifications';
            const Notifications = await import(/* @vite-ignore */ nName);
            if (notificationListener.current) {
              Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
              Notifications.removeNotificationSubscription(responseListener.current);
            }
          } catch (e) {
            console.error('Erro de limpeza:', e);
          }
        }
      }
      cleanup();
    };
  }, [userId]);

  return { expoPushToken, notification, error, permissionStatus, requestPermission };
}
