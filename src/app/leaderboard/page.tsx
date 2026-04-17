'use client';

import { useEffect, useState } from 'react';
import { Trophy, ArrowLeft, Loader2, Sparkles, Medal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDAH } from '../lib/types';
import type { LeaderboardRecord } from '../lib/stakes';

const CINEMATIC_COLORS = [
    { name: "Crimson", h: 350 }, { name: "Ruby", h: 340 }, { name: "Coral", h: 10 },
    { name: "Amber", h: 35 }, { name: "Golden", h: 45 }, { name: "Yellow", h: 55 },
    { name: "Lime", h: 90 }, { name: "Neon", h: 110 }, { name: "Emerald", h: 140 },
    { name: "Mint", h: 160 }, { name: "Teal", h: 175 }, { name: "Cyan", h: 190 },
    { name: "Azure", h: 205 }, { name: "Sapphire", h: 220 }, { name: "Cobalt", h: 235 },
    { name: "Indigo", h: 260 }, { name: "Violet", h: 275 }, { name: "Purple", h: 290 },
    { name: "Magenta", h: 305 }, { name: "Rose", h: 325 }, { name: "Pink", h: 335 }
];

const CINEMATIC_NOUNS = [
    "Director", "Producer", "Critic", "Star", "Writer", "Editor", 
    "Auteur", "Legend", "Icon", "Fanatic", "Cinephile", "Visionary", 
    "Actor", "Scout", "Mogul", "Extra", "Villain", "Hero", "Sidekick",
    "Protagonist", "Antagonist", "Maestro", "Savant", "Guru", "Tycoon",
    "Boss", "Master", "Genius", "Prophet", "Oracle", "Nomad", "Drifter",
    "Pioneer", "Creator", "Designer", "Animator", "Composer", "Artist"
];

function generateIdentity(address: string) {
    if (!address) return { name: "Unknown", color1: "#3b82f6", color2: "#8b5cf6" };
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
        hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }
    const positiveHash = Math.abs(hash);
    const colorIndex = positiveHash % CINEMATIC_COLORS.length;
    const nounIndex = Math.floor(positiveHash / CINEMATIC_COLORS.length) % CINEMATIC_NOUNS.length;
    
    // Pick the base color hue precisely from our named color array
    const baseColor = CINEMATIC_COLORS[colorIndex];
    const hue1 = baseColor.h;
    const hue2 = (baseColor.h + 40) % 360; 
    
    const baseName = `${baseColor.name} ${CINEMATIC_NOUNS[nounIndex]}`;
    const discriminator = String(Math.floor(positiveHash / (CINEMATIC_COLORS.length * CINEMATIC_NOUNS.length)) % 10000).padStart(4, '0');
    
    return {
        localName: baseName,
        tag: `#${discriminator}`,
        globalName: `${baseName} #${discriminator}`,
        color1: `hsl(${hue1}, 80%, 60%)`,
        color2: `hsl(${hue2}, 80%, 40%)`
    };
}

export default function LeaderboardPage() {
    const router = useRouter();
    const [leaders, setLeaders] = useState<LeaderboardRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [myPublicKey, setMyPublicKey] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            setMyPublicKey(params.get('publicKey'));
        }
    }, []);

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
                                    const identity = generateIdentity(leader.userId);
                                    return (
                                        <div key={leader.userId} className={`flex items-center justify-between p-4 transition-colors hover:bg-white/5 ${isTop3 ? 'bg-blue-500/5' : ''}`}>
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    i === 0 ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]' :
                                                    i === 1 ? 'bg-slate-300 text-black' :
                                                    i === 2 ? 'bg-orange-700 text-white' :
                                                    'bg-white/10 text-slate-400'
                                                }`}>
                                                    {i + 1}
                                                </div>
                                                <div 
                                                    className="flex-shrink-0 w-8 h-8 rounded-full shadow-inner border border-white/10"
                                                    style={{ background: `linear-gradient(135deg, ${identity.color1}, ${identity.color2})` }}
                                                />
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                                        {leader.userId === myPublicKey ? (
                                                            <div className="flex items-baseline gap-1.5">
                                                                <h4 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-amber-400">You</h4>
                                                                <span className="text-xs text-white font-semibold">({identity.localName} <span className="text-[10px] text-slate-400 font-normal">{identity.tag}</span>)</span>
                                                                <span className="text-[10px] text-slate-500 font-mono hidden md:inline ml-1">[{leader.userId.slice(0, 6)}...{leader.userId.slice(-4)}]</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-baseline gap-1.5">
                                                                <h4 className="text-sm font-semibold text-white">{identity.localName} <span className="text-slate-400 text-xs font-normal">{identity.tag}</span></h4>
                                                                <span className="text-[10px] text-slate-500 font-mono hidden md:inline">[{leader.userId.slice(0, 6)}...{leader.userId.slice(-4)}]</span>
                                                            </div>
                                                        )}
                                                        {isTop10 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/20 text-green-400 uppercase whitespace-nowrap">Prize Zone</span>}
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
