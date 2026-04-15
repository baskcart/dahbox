'use client';

import { useEffect, useState } from 'react';
import { Trophy, ArrowLeft, Loader2, Sparkles, Medal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDAH } from '../lib/types';
import type { LeaderboardRecord } from '../lib/stakes';

export default function LeaderboardPage() {
    const router = useRouter();
    const [leaders, setLeaders] = useState<LeaderboardRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Get current month format YYYY-MM
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthDisplay = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    useEffect(() => {
        // In a real app we would fetch from an API route. 
        // For now, we simulate fetching the leaderboard.
        // We'll create the API endpoint right after this!
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch(`/api/leaderboard?type=BOXOFFICE_MONTHLY&period=${monthStr}`);
                if (res.ok) {
                    const data = await res.json();
                    setLeaders(data.leaders || []);
                }
            } catch (err) {
                console.error("Failed to load leaderboard:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [monthStr]);

    // Auto-return timeout to prevent getting stuck
    useEffect(() => {
        const timer = setTimeout(() => {
            // Tell parent to sync if in iframe
            if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
                const urlParams = new URLSearchParams(window.location.search);
                const screenCode = urlParams.get('screenCode') || "PHONE_MODE";
                window.parent.postMessage({ type: "DAHBOX_NAVIGATE", screenCode, path: "/" }, "*");
            }
            // Navigate locally
            router.push("/");
        }, 30000); // 30 seconds

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen relative">
            <div className="cinema-glow" />

            <header className="sticky top-0 z-40 border-b border-white/5" style={{ background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(20px)' }}>
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <button onClick={(e) => {
                        e.preventDefault();
                        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
                            const urlParams = new URLSearchParams(window.location.search);
                            const screenCode = urlParams.get('screenCode') || "PHONE_MODE";
                            window.parent.postMessage({ type: "DAHBOX_NAVIGATE", screenCode, path: "/" }, "*");
                        }
                        router.push("/");
                    }} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" /> Back to Predictions
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 pt-10 pb-20 fade-in-up">
                <div className="text-center mb-10 space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                        <Trophy className="w-8 h-8 text-blue-400" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-white">
                        Global <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Leaderboard</span>
                    </h1>
                    <p className="text-slate-400 max-w-lg mx-auto text-sm">
                        The Top 10 predictors for {monthDisplay} will win a <span className="text-amber-400 font-bold">$50 AMC Physical Gift Card</span> shipped right to their door.
                    </p>
                </div>

                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest pl-4">Rank & Predictor</span>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest pr-4">Net Profit</span>
                    </div>

                    <div className="p-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-400" />
                                <span className="text-sm">Loading ranks...</span>
                            </div>
                        ) : leaders.length === 0 ? (
                            <div className="text-center py-16">
                                <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-white mb-1">No predictions yet</h3>
                                <p className="text-sm text-slate-400">Be the first to predict {monthDisplay}&apos;s box office!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {leaders.map((leader, i) => {
                                    const isTop10 = i < 10;
                                    const isTop3 = i < 3;
                                    return (
                                        <div key={leader.userId} className={`flex items-center justify-between p-4 transition-colors hover:bg-white/5 ${isTop3 ? 'bg-blue-500/5' : ''}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    i === 0 ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]' :
                                                    i === 1 ? 'bg-slate-300 text-black' :
                                                    i === 2 ? 'bg-orange-700 text-white' :
                                                    'bg-white/10 text-slate-400'
                                                }`}>
                                                    {i + 1}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-sm font-semibold text-white font-mono">{leader.userId.slice(0, 6)}...{leader.userId.slice(-4)}</h4>
                                                        {isTop10 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/20 text-green-400 uppercase">Prize Zone</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">{leader.totalWins || 0} Wins</p>
                                                </div>
                                            </div>
                                            <div className="text-right pr-2">
                                                <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-white">
                                                    {formatDAH(leader.netProfit)} <span className="text-xs text-slate-400 font-medium tracking-wide">DAH</span>
                                                </div>
                                                {isTop3 && <p className="text-[10px] text-amber-500 flex items-center justify-end gap-1 mt-0.5"><Medal className="w-3 h-3" /> Medalist</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
