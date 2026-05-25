
import React, { useState } from 'react';
import { DragonO } from './Lobby';
import { saveNickname } from '../profileService';

interface OnboardingScreenProps {
  onComplete: (nick: string) => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [nick, setNick] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nick.trim();

    if (cleanNick.length < 3) {
      setError('O Nick deve ter pelo menos 3 caracteres');
      return;
    }
    
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      // Chama a nova lógica de inserção na tabela "profiles"
      await saveNickname(cleanNick);
      onComplete(cleanNick);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar Nick na rede neural');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#02040a] flex items-center justify-center px-6">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-[320px] flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-4xl font-syncopate font-black text-white tracking-[-0.12em] flex items-center gap-3 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]">
            V<DragonO className="text-3xl text-white" />IDY
          </h1>
          <p className="text-[7px] font-black text-cyan-400 uppercase tracking-[0.5em] mt-2 opacity-50">
            Identidade Neural Requerida
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest pl-1">Escolha seu Nick Global</label>
            <input 
              type="text"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Ex: Zero_Frost"
              maxLength={20}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-cyan-500/50 transition-all text-center font-bold tracking-wide"
              required
              autoFocus
            />
          </div>

          {error && (
            <p className="text-[9px] font-bold text-red-500 uppercase tracking-wide text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">
              {error}
            </p>
          )}

          <button 
            type="submit"
            disabled={loading || !nick.trim()}
            className="w-full py-4 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-2xl disabled:opacity-30 cursor-pointer"
          >
            {loading ? 'Sincronizando...' : 'Confirmar Identidade'}
          </button>
        </form>

        <p className="text-[6px] text-slate-600 uppercase tracking-[0.2em] max-w-[200px] text-center leading-relaxed">
          Este Nick será sua assinatura permanente nos canais e comunidades da rede VOIDY.
        </p>
      </div>
    </div>
  );
};

export default OnboardingScreen;
