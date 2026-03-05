import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  User, Mail, Shield, Star, Bookmark, 
  History, Settings, Edit, LogOut 
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { Manhwa } from '../types';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { user, token, logout } = useAuth();
  const [bookmarks, setBookmarks] = useState<Manhwa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch('/api/user/bookmarks', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        setBookmarks(data);
        setLoading(false);
      });
    }
  }, [token]);

  if (!user) return <div className="text-center py-20">Please login to view your profile</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Sidebar: Profile Info */}
        <div className="lg:col-span-4 space-y-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary p-10 rounded-[2.5rem] border border-white/5 text-center shadow-2xl"
          >
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div className="w-full h-full bg-accent rounded-[2rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-accent/20 rotate-3">
                {user.username[0].toUpperCase()}
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary border-4 border-secondary rounded-2xl flex items-center justify-center">
                <Shield size={18} className="text-accent" />
              </div>
            </div>
            
            <div className="space-y-2 mb-8">
              <h2 className="text-3xl font-bold tracking-tighter font-display">{user.username}</h2>
              <p className="text-text-secondary text-sm font-medium opacity-60">{user.email}</p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mb-10">
              <span className="px-4 py-1.5 bg-primary border border-white/5 text-text-secondary text-[10px] font-black uppercase tracking-widest rounded-full">
                {user.role.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest rounded-full">
                <Star size={12} fill="currentColor" />
                {user.coins} Coins
              </div>
            </div>

            <div className="space-y-3">
              <button className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-sm text-text-secondary hover:text-white transition-all duration-300 flex items-center justify-center gap-3">
                <Edit size={18} /> Edit Profile
              </button>
              <a 
                href="https://t.me/Shohruh010101" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-4 bg-accent hover:bg-accent/90 rounded-2xl font-bold text-sm text-white transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-accent/20"
              >
                <Star size={18} fill="currentColor" /> Buy Coins (Tanga)
              </a>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-secondary/50 p-8 rounded-[2.5rem] border border-white/5 space-y-2"
          >
            {[
              { icon: Bookmark, label: 'My Library', count: bookmarks.length },
              { icon: History, label: 'Reading History' },
              { icon: Star, label: 'My Reviews' },
              { icon: Settings, label: 'Account Settings' },
            ].map((item, idx) => (
              <button 
                key={item.label}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${
                  idx === 0 ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-4 font-bold text-sm">
                  <item.icon size={20} className={idx === 0 ? 'text-accent' : 'text-text-secondary group-hover:text-white'} /> 
                  {item.label}
                </div>
                {item.count !== undefined && (
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                    idx === 0 ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
            
            <div className="pt-6 mt-6 border-t border-white/5">
              <button 
                onClick={logout}
                className="w-full flex items-center gap-4 p-4 text-accent hover:bg-accent/10 rounded-2xl transition-all duration-300 font-bold text-sm"
              >
                <LogOut size={20} /> Logout
              </button>
            </div>
          </motion.div>
        </div>

        {/* Main Content: Library */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-12">
            <div className="space-y-1">
              <h2 className="text-4xl font-bold tracking-tighter font-display">My Library</h2>
              <p className="text-text-secondary text-sm font-medium opacity-60">Your bookmarked manhwa collection</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-32">
              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-32 bg-secondary/30 rounded-[3rem] border border-dashed border-white/5">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bookmark size={32} className="text-text-secondary/20" />
              </div>
              <p className="text-text-secondary font-medium mb-8">Your library is empty. Start exploring!</p>
              <Link to="/" className="inline-flex bg-accent hover:bg-accent/90 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-accent/20 active:scale-95">
                Browse Collection
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-12">
              {bookmarks.map((manhwa, idx) => (
                <motion.div 
                  key={manhwa.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link to={`/manhwa/${manhwa.id}`} className="block group anime-card">
                    <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden mb-5 shadow-2xl">
                      <img 
                        src={manhwa.poster || 'https://picsum.photos/seed/manga/400/600'} 
                        alt={manhwa.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    <div className="px-1">
                      <h3 className="font-bold text-text-primary text-lg line-clamp-1 group-hover:text-accent transition-colors duration-300">
                        {manhwa.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-black text-text-secondary/40 uppercase tracking-widest">Chapter 142</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
