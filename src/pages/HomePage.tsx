import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Flame, Clock, Star, ChevronRight, Play, TrendingUp, Lock, Trophy, Coins } from 'lucide-react';
import { Manhwa } from '../types';
import socket from '../socket';

export default function HomePage() {
  const [manhwas, setManhwas] = useState<Manhwa[]>([]);
  const [hero, setHero] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const search = searchParams.get('search');

  useEffect(() => {
    fetch('/api/manhwa')
      .then(async res => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(`Failed to fetch manhwas: ${errorData.details || errorData.error || res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        setManhwas(data);
      })
      .catch(err => {
        // Silently fail or handle UI-side
      });

    fetch('/api/settings/hero_banner')
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Hero banner not found');
        }
        return res.json();
      })
      .then(data => {
        setHero(data);
      })
      .catch(err => {
        // Fallback hero banner
        setHero({
          title: "Welcome to Manhwa World",
          description: "Discover the best manhwa, manga, and comics here. Start your journey today!",
          image: "https://picsum.photos/seed/manhwa-fallback/1920/1080",
          button_text: "Explore Now",
          link: "/popular"
        });
      });

    fetch('/api/leaderboard')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        return res.json();
      })
      .then(data => {
        setLeaderboard(data);
        setLoading(false);
      })
      .catch(err => {
        // Silently fail or handle UI-side
        setLoading(false);
      });

    socket.on('settings_updated', (data) => {
      if (data.key === 'hero_banner') {
        setHero(data.value);
      }
    });

    return () => {
      socket.off('settings_updated');
    };
  }, []);

  const filteredManhwas = search 
    ? manhwas.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
    : manhwas;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero Banner Section */}
      {!search && hero && (
        <section className="mb-20 relative h-[450px] sm:h-[550px] rounded-[2.5rem] overflow-hidden group">
          <img 
            src={hero.image} 
            alt="Featured Manhwa" 
            className="w-full h-full object-cover brightness-[0.4] group-hover:scale-105 transition-transform duration-1000 ease-out"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/20 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-8 sm:p-16 md:p-20">
            <motion.div
              key={hero.title} // Key change triggers re-animation
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="max-w-3xl space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/20 border border-accent/30 rounded-full text-accent font-bold uppercase tracking-widest text-[10px]">
                <Flame size={14} /> Featured Today
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[0.9] font-display">
                {hero.title.split(':').map((part: string, i: number) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {i === 1 ? <span className="text-accent">{part}</span> : part}
                  </React.Fragment>
                ))}
              </h1>
              <p className="text-text-secondary text-lg max-w-xl line-clamp-2 font-medium leading-relaxed opacity-80">
                {hero.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link to={hero.link} className="bg-accent hover:bg-accent/90 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-2xl shadow-accent/30 active:scale-95">
                  <Play size={20} fill="currentColor" /> {hero.button_text}
                </Link>
                <Link to={hero.link} className="bg-white/5 hover:bg-white/10 text-white px-10 py-4 rounded-2xl font-bold backdrop-blur-xl border border-white/10 transition-all active:scale-95">
                  View Details
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Genre Section (Pills) */}
      <section className="mb-16">
        <div className="flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar">
          {['All Genres', 'Action', 'Adventure', 'Fantasy', 'Romance', 'Drama', 'Sci-Fi', 'Horror', 'Comedy'].map((genre, idx) => (
            <button 
              key={genre}
              className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 border ${
                idx === 0 
                ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' 
                : 'bg-secondary border-white/5 text-text-secondary hover:border-accent/50 hover:text-white'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </section>

      {/* Popular Manhwa Section (Grid) */}
      <section className="mb-24">
        <div className="flex items-center justify-between mb-10">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight font-display">Popular Manhwa</h2>
            <p className="text-text-secondary text-sm font-medium opacity-60">Most read titles this week</p>
          </div>
          <Link to="/popular" className="group flex items-center gap-2 text-accent font-bold text-sm">
            View All <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
          {filteredManhwas.map((manhwa, idx) => (
            <motion.div
              key={manhwa.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.5 }}
            >
              <Link to={`/manhwa/${manhwa.id}`} className="block group anime-card">
                <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden mb-4 shadow-2xl">
                  <img 
                    src={manhwa.poster || 'https://picsum.photos/seed/manga/400/600'} 
                    alt={manhwa.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="absolute top-4 right-4 bg-accent text-white text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider shadow-lg">
                    HOT
                  </div>
                  
                  <div className="absolute bottom-6 left-6 right-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="bg-white text-black py-3 rounded-2xl font-bold text-xs text-center shadow-2xl">
                      Read Now
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1.5 px-1">
                  <h3 className="font-bold text-text-primary text-base line-clamp-1 group-hover:text-accent transition-colors duration-300">
                    {manhwa.title}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-secondary/50">
                    <span className="flex items-center gap-1.5">
                      <Star size={12} className="text-accent fill-accent" /> 4.9
                    </span>
                    <span>Chapter 142</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Latest Chapters Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight font-display">Latest Updates</h2>
              <p className="text-text-secondary text-sm font-medium opacity-60">Freshly updated chapters</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredManhwas.slice(0, 8).map((manhwa) => (
              <Link 
                key={manhwa.id} 
                to={`/manhwa/${manhwa.id}`}
                className="flex gap-5 p-5 bg-secondary hover:bg-white/5 rounded-[2rem] border border-white/5 transition-all duration-500 group"
              >
                <div className="relative w-24 h-32 flex-shrink-0 rounded-2xl overflow-hidden shadow-xl">
                  <img 
                    src={manhwa.poster || 'https://picsum.photos/seed/manga/300/400'} 
                    alt={manhwa.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex flex-col justify-center flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                    {manhwa.title}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {manhwa.latest_chapters && manhwa.latest_chapters.length > 0 ? (
                      manhwa.latest_chapters.map((ch: any) => (
                        <div key={ch.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-secondary">Chapter {ch.chapter_number}</span>
                            {ch.coin_price > 0 && <Star size={10} className="text-accent fill-accent" />}
                          </div>
                          <span className="text-[10px] font-medium text-text-secondary/40">
                            {new Date(ch.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs font-bold text-text-secondary/30 italic">No chapters yet</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Leaderboard Sidebar */}
        <div className="lg:col-span-4">
          <div className="bg-secondary p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                <Trophy size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display">Leaderboard</h2>
                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-40">Top Coin Holders</p>
              </div>
            </div>

            <div className="space-y-4">
              {leaderboard.map((u, idx) => (
                <div key={u.id} className="flex items-center justify-between p-4 bg-primary/50 rounded-2xl border border-white/5 group hover:border-accent/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                      idx === 0 ? 'bg-yellow-500 text-black' : 
                      idx === 1 ? 'bg-slate-300 text-black' : 
                      idx === 2 ? 'bg-amber-600 text-white' : 
                      'bg-white/5 text-text-secondary'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className="font-bold text-sm group-hover:text-accent transition-colors">{u.username}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-yellow-500 font-black text-xs">
                    <Coins size={12} /> {u.coins}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
