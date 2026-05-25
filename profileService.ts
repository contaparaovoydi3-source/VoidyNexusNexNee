import { supabase } from './supabaseClient';

export interface UserProfile {
  id: string;
  nickname: string;
  avatar_url?: string;
  updated_at?: string;
}

export const saveNickname = async (nickname: string) => {
  // Busca o usuário autenticado
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('Usuário não autenticado ou sessão expirada.');
  }

  // Insere ou atualiza na tabela public.profiles com avatar_url default ou existente se houver
  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;
  const { data, error } = await supabase.from('profiles').upsert([
    { 
      id: user.id, 
      nickname: nickname.trim(),
      avatar_url: defaultAvatar,
      updated_at: new Date().toISOString()
    }
  ], { onConflict: 'id' }).select().single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este Nickname já está em uso. Escolha outro.');
    }
    throw error;
  }

  return data;
};

export const fetchUsersProfiles = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, updated_at')
    .order('nickname', { ascending: true });

  if (error) throw error;
  return data || [];
};
