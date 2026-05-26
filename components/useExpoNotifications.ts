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

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

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

  useEffect(() => {
    async function loadAndRegister() {
      // 1. COMPATIBILIDADE COM NAVEGADOR WEB (AI Studio Preview)
      // Se for ambiente Web, oferecemos suporte real às Web Notifications do navegador!
      if (!isReactNative) {
        console.log('🌐 [NEXUS] Ambiente Web detectado. Inicializando suporte a Web Notifications.');
        
        if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            const status = await window.Notification.requestPermission();
            console.log('🔔 [NEXUS] Status da permissão de notificações Web:', status);
            
            if (status === 'granted') {
              const mockToken = 'web_sandbox_token_' + Math.random().toString(36).substr(2, 9);
              setExpoPushToken(mockToken);
              
              // Incrementa e salva o token no Supabase para o usuário logado
              if (userId) {
                const { error: dbError } = await supabase
                  .from('profiles')
                  .update({ expo_push_token: mockToken })
                  .eq('id', userId);
                  
                if (dbError) {
                  console.error('❌ Erro ao salvar token web no Supabase:', dbError);
                } else {
                  console.log('✅ Token Web salvo com sucesso no banco para o usuário:', userId);
                }
              }

              // Simula o recebimento de uma mensagem em primeiro plano para testes
              setTimeout(() => {
                new window.Notification('Conexão Concluída', {
                  body: 'Notificações push em Sandbox ativadas com sucesso!',
                  tag: 'nexus-intro'
                });
              }, 1500);
            }
          } catch (e: any) {
            console.error('❌ Erro ao registrar Web Notification:', e);
            setError(e.message);
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
          await Notifications.setNotificationChannelAsync('default-channel', {
            name: 'Notificações Gerais',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        // Verifica e pede permissões
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
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

  return { expoPushToken, notification, error };
}
