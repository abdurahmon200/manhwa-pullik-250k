import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ChevronLeft, ChevronRight, Settings, 
  Menu, Info, Lock, ArrowLeft, FileText
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { Chapter, Page } from '../types';

export default function Reader() {
  const { chapterId } = useParams();
  const { user, token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<Chapter & { pages: Page[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFocused, setIsFocused] = useState(true);
  const [purchasedChapters, setPurchasedChapters] = useState<string[]>([]);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    // Security: Disable context menu
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    
    // Security: Disable specific keys
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable Ctrl+S, Ctrl+P, Ctrl+U, F12, Ctrl+Shift+I
      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'u')) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I')
      ) {
        e.preventDefault();
        return false;
      }
    };

    // Security: Detect focus loss
    const handleBlur = () => setIsFocused(false);
    const handleFocus = () => setIsFocused(true);

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    const fetchData = async () => {
      try {
        const [chapterRes, purchasesRes] = await Promise.all([
          fetch(`/api/chapters/${chapterId}`),
          token ? fetch('/api/user/purchases', { headers: { 'Authorization': `Bearer ${token}` } }) : Promise.resolve(null)
        ]);

        if (!chapterRes.ok) throw new Error('Chapter not found');
        const chapterData = await chapterRes.json();
        setChapter(chapterData);

        if (purchasesRes && purchasesRes.ok) {
          const purchasesData = await purchasesRes.json();
          setPurchasedChapters(purchasesData);
        }
      } catch (err) {
        // Silently fail or handle UI-side
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const handleScroll = () => {
      if (window.scrollY > 100) setShowControls(false);
      else setShowControls(true);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [chapterId]);

  const handlePurchase = async () => {
    if (!token) return alert('Please login to purchase chapters');
    setPurchasing(true);
    try {
      const res = await fetch(`/api/chapters/${chapterId}/purchase`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPurchasedChapters([...purchasedChapters, chapterId]);
        refreshUser();
      } else {
        alert(data.error || 'Purchase failed');
      }
    } catch (err) {
      alert('Error during purchase');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div></div>;
  
  if (!chapter) return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-24 h-24 bg-secondary rounded-[2rem] flex items-center justify-center text-text-secondary/20">
        <FileText size={48} />
      </div>
      <div className="space-y-2">
        <h2 className="text-4xl font-black font-display tracking-tight">Chapter Not Found</h2>
        <p className="text-text-secondary font-medium opacity-60 max-w-xs mx-auto">
          The chapter you're looking for might have been moved or deleted.
        </p>
      </div>
      <Link 
        to="/" 
        className="bg-accent hover:bg-accent/90 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-accent/20 active:scale-95"
      >
        Go Back Home
      </Link>
    </div>
  );

  const isPurchased = chapter && (chapter.coin_price === 0 || purchasedChapters.includes(chapterId));

  if (!isPurchased) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-secondary p-12 rounded-[3rem] text-center space-y-8 border border-white/5 shadow-2xl"
        >
          <div className="w-24 h-24 bg-accent/10 rounded-[2rem] flex items-center justify-center mx-auto text-accent shadow-inner">
            <Lock size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black font-display tracking-tight">Locked Chapter</h2>
            <p className="text-text-secondary font-medium opacity-60">
              This chapter costs <span className="text-accent font-bold">{chapter?.coin_price} Coins</span>.
            </p>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handlePurchase}
              disabled={purchasing}
              className="w-full bg-accent hover:bg-accent/90 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-accent/20 active:scale-95 disabled:opacity-50"
            >
              {purchasing ? 'Processing...' : `Buy for ${chapter?.coin_price} Coins`}
            </button>
            <Link 
              to={`/manhwa/${chapter?.manga_id}`} 
              className="flex items-center justify-center gap-2 text-text-secondary hover:text-white font-bold text-sm transition-colors py-2"
            >
              <ArrowLeft size={16} /> Back to Series
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black no-select transition-all duration-500 ${!isFocused ? 'blur-2xl grayscale' : ''}`}>
      {/* Immersive Navigation Bar */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: showControls ? 0 : -100 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-3xl border-b border-white/5 px-6 h-20 flex items-center justify-between"
      >
        <div className="flex items-center gap-6">
          <Link to={`/manhwa/${chapter?.manga_id}`} className="p-3 hover:bg-white/10 rounded-2xl text-text-secondary hover:text-white transition-all">
            <ArrowLeft size={24} />
          </Link>
          <div className="space-y-0.5">
            <h1 className="font-bold text-text-primary text-lg tracking-tight line-clamp-1">{chapter?.title || `Chapter ${chapter?.chapter_number}`}</h1>
            <p className="text-[10px] font-black text-text-secondary/40 uppercase tracking-widest">Reading Mode • Vertical</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-3 hover:bg-white/10 rounded-2xl text-text-secondary hover:text-white transition-all"><Settings size={20} /></button>
          <button className="p-3 hover:bg-white/10 rounded-2xl text-text-secondary hover:text-white transition-all"><Menu size={20} /></button>
        </div>
      </motion.nav>

      {/* Reader Content */}
      <div className="max-w-4xl mx-auto pt-0 pb-40 relative">
        {chapter?.pages.map((page, idx) => (
          <div key={page.id} className="relative group no-drag">
            <img 
              src={page.image_url} 
              alt={`Page ${page.page_number}`}
              className="w-full h-auto select-none pointer-events-none no-drag"
              loading={idx < 3 ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
            />
            
            {/* Security Overlay: Prevents direct interaction with image */}
            <div className="absolute inset-0 z-20 bg-transparent cursor-default" />

            {/* Dynamic Watermark Overlay */}
            <div className="watermark-overlay">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="watermark-text">
                  {user?.username || 'MangaLab User'} • {user?.id || '0000'}
                </div>
              ))}
            </div>

            {/* Subtle page number indicator */}
            <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="bg-black/60 backdrop-blur-md text-white/40 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                Page {page.page_number}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Minimalist Floating Controls */}
      <motion.div 
        initial={{ y: 100, x: "-50%" }}
        animate={{ y: showControls ? 0 : 100, x: "-50%" }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="fixed bottom-10 left-1/2 z-50 flex items-center gap-6 bg-black/60 backdrop-blur-3xl px-8 py-4 rounded-[2.5rem] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]"
      >
        <button className="p-2 text-text-secondary hover:text-accent transition-colors">
          <ChevronLeft size={28} />
        </button>
        <div className="h-8 w-px bg-white/10" />
        <div className="flex flex-col items-center px-4">
          <span className="text-[10px] font-black text-text-secondary/40 uppercase tracking-widest">Chapter</span>
          <span className="text-lg font-black text-text-primary tracking-tighter">{chapter?.chapter_number}</span>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <button className="p-2 text-text-secondary hover:text-accent transition-colors">
          <ChevronRight size={28} />
        </button>
      </motion.div>

      {/* Progress Indicator */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-white/5 z-50">
        <motion.div 
          className="h-full bg-accent shadow-[0_0_20px_rgba(255,77,109,0.5)]" 
          style={{ width: '33%' }} // This would ideally be calculated from scroll position
        />
      </div>
    </div>
  );
}
