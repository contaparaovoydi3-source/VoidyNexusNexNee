
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile as AppUserProfile } from '../types';
import { fetchUsersProfiles, UserProfile as SupaProfile } from '../profileService';
import { DragonO } from './Lobby';

const resolveImageRef = (ref: string | undefined | null): string | null => {
  if (!ref) return null;
  if (typeof ref !== 'string') return null;
  const cleanRef = ref.split('|metadata:')[0];
  if (cleanRef.startsWith('ref:vimg_')) {
    const key = cleanRef.replace('ref:', '');
    return localStorage.getItem(key);
  }
  if (cleanRef.startsWith('vimg_')) {
    return localStorage.getItem(cleanRef);
  }
  return cleanRef;
};

interface MembersViewProps {
  onBack: () => void;
  onViewProfile: (member: SupaProfile) => void;
}

const MembersView: React.FC<MembersViewProps> = ({ onBack, onViewProfile }) => {
  const [members, setMembers] = useState<SupaProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const data = await fetchUsersProfiles();
        setMembers(data);
      } catch (err) {
        console.error("Erro ao carregar membros:", err);
      } finally {
        setLoading(false);
      }
    };
    loadMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return members;
    return members.filter(m => m.nickname.toLowerCase().includes(q));
  }, [searchQuery, members]);

  return (
    <div className="flex-1 h-full w-full bg-[#02040a] relative overflow-hidden flex flex-col animate-in fade-in duration-500">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,_rgba(34,211,238,0.15)_0%,_transparent_50%)]"></div>
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_70%,_rgba(168,85,247,0.1)_0%,_transparent_50%)]"></div>
      </div>

      <header className="px-6 py-8 flex items-center justify-between relative z-50 shrink-0 bg-black/40 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <button onClick={onBack} className="p-2.5 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-90 border border-white/5 cursor-pointer">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex flex-col items-center">
           <h2 className="text-xs font-syncopate font-black text-white uppercase tracking-[0.4em]">Membros Registrados</h2>
           <div className="flex items-center gap-2 mt-1">
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"></div>
              <span className="text-[7px] font-black text-cyan-400 uppercase tracking-[0.2em]">Diretório Global</span>
           </div>
        </div>
        <div className="w-12"></div>
      </header>

      <div className="px-6 pt-6 relative z-50">
         <div className="relative group">
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar operativo por nick..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 pl-12 text-[12px] text-white outline-none focus:border-cyan-500/40 transition-all uppercase tracking-widest font-bold placeholder:text-slate-800 shadow-inner relative z-10 backdrop-blur-md"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors z-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-40 relative z-10">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
            <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-cyan-400">Sincronizando Banco de Dados...</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-2 gap-y-10">
            {filteredMembers.map((member, idx) => (
              <button 
                key={member.id}
                onClick={() => onViewProfile(member)}
                className="flex flex-col items-center gap-3 transition-all group active:scale-95 animate-in slide-in-from-bottom duration-500 cursor-pointer"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="relative">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-white/10 p-0.5 bg-black overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:border-cyan-500/50 transition-all duration-500">
                    <img src={resolveImageRef(member.avatar_url) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`} className="w-full h-full object-cover rounded-full grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt="Avatar" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex items-center gap-1 bg-cyan-500 px-1.5 py-0.5 rounded-full border border-black shadow-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                  </div>
                </div>
                
                <div className="text-center w-full px-1 flex flex-col items-center">
                  <h4 className="text-[10px] font-black text-white uppercase truncate w-full group-hover:text-cyan-400 transition-colors tracking-widest">{member.nickname}</h4>
                  <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest opacity-60">Operativo Registrado</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && filteredMembers.length === 0 && (
           <div className="py-32 flex flex-col items-center justify-center opacity-20 text-center space-y-4">
              <span className="text-4xl">📡</span>
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">Nenhum Identidade Encontrada</p>
           </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default MembersView;
