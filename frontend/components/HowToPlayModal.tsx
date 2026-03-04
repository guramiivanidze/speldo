'use client';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GEM_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  white: { bg: 'bg-slate-200', border: 'border-slate-300', text: 'text-slate-700' },
  blue: { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-white' },
  green: { bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-white' },
  red: { bg: 'bg-red-500', border: 'border-red-400', text: 'text-white' },
  black: { bg: 'bg-slate-700', border: 'border-slate-600', text: 'text-white' },
  gold: { bg: 'bg-yellow-400', border: 'border-yellow-300', text: 'text-yellow-900' },
};

function GemToken({ color, count }: { color: string; count?: number }) {
  const style = GEM_COLORS[color] || GEM_COLORS.white;
  return (
    <div className={`w-6 h-6 rounded-full ${style.bg} border-2 ${style.border} flex items-center justify-center text-xs font-bold ${style.text} shadow-md`}>
      {count !== undefined ? count : ''}
    </div>
  );
}

function MiniCard({ bonus, points, cost }: { bonus: string; points: number; cost: Record<string, number> }) {
  const style = GEM_COLORS[bonus];
  return (
    <div className="w-16 h-20 rounded-lg bg-slate-800 border border-slate-600 p-1 flex flex-col">
      <div className="flex justify-between items-start">
        {points > 0 && <span className="text-amber-400 text-xs font-bold">{points}</span>}
        <div className={`w-4 h-4 rounded-full ${style.bg} ml-auto`} />
      </div>
      <div className="flex-1" />
      <div className="flex gap-0.5 flex-wrap">
        {Object.entries(cost).filter(([, v]) => v > 0).map(([c, v]) => (
          <div key={c} className={`w-3.5 h-3.5 rounded-full ${GEM_COLORS[c].bg} flex items-center justify-center text-[8px] font-bold ${GEM_COLORS[c].text}`}>
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="max-w-2xl w-full max-h-[90vh] flex flex-col animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="glass rounded-t-2xl px-6 py-4 border border-white/10 border-b-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📖</span>
            <div>
              <h2 className="text-xl font-bold text-slate-100">How to Play Splendor</h2>
              <p className="text-slate-400 text-sm">Master the art of gem trading</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-3xl leading-none hover:bg-slate-700/50 w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
        
        {/* Content */}
        <div className="glass rounded-b-2xl border border-white/10 border-t-0 overflow-y-auto flex-1">
          <div className="p-6 space-y-8">
            
            {/* Goal */}
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-amber-400 mb-3">
                <span>🎯</span> Goal
              </h3>
              <p className="text-slate-300">
                Be the first player to reach <span className="text-amber-400 font-bold">15 prestige points</span>. 
                Collect gems, buy development cards, and attract nobles to win!
              </p>
            </section>

            {/* Gems */}
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-400 mb-3">
                <span>💎</span> Gem Tokens
              </h3>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center gap-3 flex-wrap justify-center mb-3">
                  {['white', 'blue', 'green', 'red', 'black'].map(c => (
                    <div key={c} className="flex items-center gap-1.5">
                      <GemToken color={c} />
                      <span className="text-slate-400 text-sm capitalize">{c}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 border-l border-slate-600 pl-3">
                    <GemToken color="gold" />
                    <span className="text-yellow-400 text-sm">Gold (wild)</span>
                  </div>
                </div>
                <p className="text-slate-400 text-sm text-center">
                  Gold tokens are wild — they can substitute any gem color
                </p>
              </div>
            </section>

            {/* Actions */}
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-indigo-400 mb-3">
                <span>🎲</span> On Your Turn
              </h3>
              <p className="text-slate-400 text-sm mb-4">Choose ONE action per turn:</p>
              
              <div className="space-y-4">
                {/* Action 1: Take Gems */}
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h4 className="font-bold text-slate-100 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-sm">1</span>
                    Take Gems
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-300">Take <span className="text-amber-300 font-semibold">3 different</span> gem tokens</span>
                      <div className="flex gap-1 ml-2">
                        <GemToken color="blue" />
                        <GemToken color="red" />
                        <GemToken color="green" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-300">OR take <span className="text-amber-300 font-semibold">2 same</span> tokens (if 4+ available)</span>
                      <div className="flex gap-1 ml-2">
                        <GemToken color="white" />
                        <GemToken color="white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs mt-2">⚠️ Maximum 10 tokens in hand — discard excess</p>
                </div>

                {/* Action 2: Reserve Card */}
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h4 className="font-bold text-slate-100 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-sm">2</span>
                    Reserve a Card
                  </h4>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-2 text-sm">
                      <p className="text-slate-300">• Take any visible card into your hand</p>
                      <p className="text-slate-300">• Or take from the top of any deck (hidden)</p>
                      <p className="text-slate-300">• Receive <span className="text-yellow-400 font-semibold">1 gold token</span> as bonus</p>
                      <p className="text-slate-500 text-xs">⚠️ Maximum 3 reserved cards</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MiniCard bonus="blue" points={1} cost={{ white: 2, green: 1 }} />
                      <span className="text-2xl">→</span>
                      <GemToken color="gold" />
                    </div>
                  </div>
                </div>

                {/* Action 3: Buy Card */}
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h4 className="font-bold text-slate-100 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-sm">3</span>
                    Buy a Card
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <MiniCard bonus="red" points={2} cost={{ blue: 3, green: 2, black: 1 }} />
                      <div className="text-sm">
                        <p className="text-slate-300 mb-1">Pay the gem cost shown on the card</p>
                        <p className="text-emerald-400">✓ Your bonuses reduce the cost!</p>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-2">Example: Card costs 3 blue, 2 green, 1 black</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-300">You have:</span>
                        <div className="flex gap-1">
                          <div className="w-5 h-5 rounded-full bg-blue-500 border border-blue-400 text-[10px] flex items-center justify-center text-white font-bold">2</div>
                        </div>
                        <span className="text-slate-300">blue bonus →</span>
                        <span className="text-emerald-400">Only pay 1 blue!</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Development Cards */}
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-violet-400 mb-3">
                <span>🃏</span> Development Cards
              </h3>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="bg-emerald-900/30 text-emerald-400 rounded-lg py-1 text-sm font-semibold mb-2">Level 1</div>
                    <p className="text-slate-400 text-xs">Cheap cards, few points</p>
                    <p className="text-slate-500 text-xs">Build your bonuses</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-amber-900/30 text-amber-400 rounded-lg py-1 text-sm font-semibold mb-2">Level 2</div>
                    <p className="text-slate-400 text-xs">Medium cost</p>
                    <p className="text-slate-500 text-xs">1-3 prestige points</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-rose-900/30 text-rose-400 rounded-lg py-1 text-sm font-semibold mb-2">Level 3</div>
                    <p className="text-slate-400 text-xs">Expensive cards</p>
                    <p className="text-slate-500 text-xs">3-5 prestige points</p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm text-center">
                  Each card gives a <span className="text-amber-300 font-semibold">permanent gem bonus</span> — use it to buy future cards for free!
                </p>
              </div>
            </section>

            {/* Nobles */}
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-rose-400 mb-3">
                <span>👑</span> Nobles
              </h3>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-slate-300 mb-3">
                  Nobles visit automatically at the end of your turn if you meet their requirements.
                </p>
                <div className="bg-slate-900/50 rounded-lg p-3 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-rose-900 to-rose-700 border-2 border-rose-500 flex items-center justify-center text-2xl">
                    👑
                  </div>
                  <div>
                    <p className="text-rose-400 font-semibold">Example Noble: 3 points</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-400 text-sm">Requires:</span>
                      <div className="flex gap-1">
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-[10px] flex items-center justify-center text-white font-bold">4</div>
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-[10px] flex items-center justify-center text-white font-bold">4</div>
                      </div>
                      <span className="text-slate-400 text-sm">card bonuses</span>
                    </div>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-3 text-center">
                  Each noble can only visit one player!
                </p>
              </div>
            </section>

            {/* Tips */}
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-cyan-400 mb-3">
                <span>💡</span> Pro Tips
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <p className="text-sm text-slate-300">
                    <span className="text-cyan-400 font-bold">1.</span> Focus on building bonuses early — Level 1 cards are investments!
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <p className="text-sm text-slate-300">
                    <span className="text-cyan-400 font-bold">2.</span> Watch your opponents — block cards they need!
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <p className="text-sm text-slate-300">
                    <span className="text-cyan-400 font-bold">3.</span> Reserve cards to deny opponents AND get gold tokens.
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <p className="text-sm text-slate-300">
                    <span className="text-cyan-400 font-bold">4.</span> Nobles are 3 free points — plan your bonuses to attract them!
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
