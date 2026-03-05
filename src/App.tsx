import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, User, LogOut, Menu, X, Home, 
  BookOpen, Star, Settings, Shield,
  ChevronRight, TrendingUp, Clock, Flame
} from 'lucide-react';
import { useAuth } from './AuthContext';
import HomePage from './pages/HomePage';
import ManhwaDetail from './pages/ManhwaDetail';
import Reader from './pages/Reader';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import AuthModal from './components/AuthModal';
import { io } from 'socket.io-client';

const socket = io();

export default function App() {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    socket.on('update', (data) => {
      console.log('Real-time update:', data);
      // We could show a toast here
    });
    return () => { socket.off('update'); };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-primary text-text-primary selection:bg-accent selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-primary/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform duration-500">
                  <BookOpen className="text-white" size={22} />
                </div>
                <span className="text-2xl font-bold tracking-tight font-display hidden sm:block">
                  Manga<span className="text-accent">Lab</span>
                </span>
              </Link>
            </div>

            {/* Search Bar (Center) */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <form onSubmit={handleSearch} className="relative w-full group">
                <input
                  type="text"
                  placeholder="Search manhwa, manga..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-secondary border border-white/5 rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all duration-300 placeholder:text-text-secondary/50"
                />
                <Search className="absolute left-4 top-3 text-text-secondary/40 group-focus-within:text-accent transition-colors" size={18} />
              </form>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="hidden lg:flex items-center gap-6 mr-4">
                <Link to="/" className="text-sm font-medium text-text-secondary hover:text-accent transition-colors">Home</Link>
                <Link to="/popular" className="text-sm font-medium text-text-secondary hover:text-accent transition-colors">Popular</Link>
                <Link to="/latest" className="text-sm font-medium text-text-secondary hover:text-accent transition-colors">Latest</Link>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                {user ? (
                  <div className="flex items-center gap-4">
                    {(user.role === 'admin' || user.role === 'assistant_admin') && (
                      <Link to="/admin" className="p-2.5 hover:bg-white/5 rounded-xl text-text-secondary hover:text-accent transition-all" title="Admin Dashboard">
                        <Shield size={20} />
                      </Link>
                    )}
                    <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest rounded-full">
                      <Star size={12} fill="currentColor" />
                      {user.coins}
                    </div>
                    <Link to="/profile" className="flex items-center gap-3 p-1.5 pr-4 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5">
                      <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-accent/20">
                        {user.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold hidden sm:block">{user.username}</span>
                    </Link>
                    <button onClick={logout} className="p-2.5 hover:bg-white/5 rounded-xl text-text-secondary hover:text-accent transition-all">
                      <LogOut size={20} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="bg-accent hover:bg-accent/90 text-white px-7 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-accent/20 active:scale-95"
                  >
                    Login
                  </button>
                )}
                
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2.5 text-text-secondary hover:bg-white/5 rounded-xl transition-all">
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden bg-secondary border-t border-white/5 overflow-hidden shadow-2xl"
            >
              <div className="px-4 pt-4 pb-8 space-y-3">
                <div className="mb-6">
                  <form onSubmit={handleSearch} className="relative">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-primary border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <Search className="absolute left-4 top-3.5 text-text-secondary/40" size={18} />
                  </form>
                </div>
                <Link to="/" onClick={() => setIsMenuOpen(false)} className="block px-4 py-3 rounded-2xl text-text-secondary hover:bg-white/5 hover:text-accent transition-all font-medium">Home</Link>
                <Link to="/popular" onClick={() => setIsMenuOpen(false)} className="block px-4 py-3 rounded-2xl text-text-secondary hover:bg-white/5 hover:text-accent transition-all font-medium">Popular</Link>
                <Link to="/latest" onClick={() => setIsMenuOpen(false)} className="block px-4 py-3 rounded-2xl text-text-secondary hover:bg-white/5 hover:text-accent transition-all font-medium">Latest</Link>
                {!user && (
                  <button
                    onClick={() => { setIsAuthModalOpen(true); setIsMenuOpen(false); }}
                    className="w-full mt-6 bg-accent text-white py-3.5 rounded-2xl font-bold shadow-xl shadow-accent/20"
                  >
                    Login
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/manhwa/:id" element={<ManhwaDetail />} />
          <Route path="/reader/:chapterId" element={<Reader />} />
          <Route path="/profile" element={<ProfilePage />} />
          {user?.role === 'admin' && <Route path="/admin/*" element={<AdminDashboard />} />}
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-secondary border-t border-white/5 py-16 mt-32">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                <BookOpen className="text-white" size={22} />
              </div>
              <span className="text-2xl font-bold tracking-tight font-display">
                Manga<span className="text-accent">Lab</span>
              </span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-8 text-text-secondary text-sm font-medium">
              <Link to="#" className="hover:text-accent transition-colors">Terms</Link>
              <Link to="#" className="hover:text-accent transition-colors">Privacy</Link>
              <Link to="#" className="hover:text-accent transition-colors">DMCA</Link>
              <Link to="#" className="hover:text-accent transition-colors">Contact</Link>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-text-secondary/40 text-xs font-medium">
            <p>© 2024 MangaLab. All rights reserved.</p>
            <p>Designed for the ultimate reading experience.</p>
          </div>
        </div>
      </footer>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
