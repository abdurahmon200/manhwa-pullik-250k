import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Star, Bookmark, Share2, MessageSquare, 
  Play, ChevronRight, Lock, Trash2, Send, Clock
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { Manhwa, Chapter, Comment } from '../types';
import { io } from 'socket.io-client';

const socket = io();

export default function ManhwaDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [manhwa, setManhwa] = useState<Manhwa & { chapters: Chapter[], genres: string[] } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasedChapters, setPurchasedChapters] = useState<number[]>([]);

  useEffect(() => {
    fetch(`/api/manhwa/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Manhwa not found');
        return res.json();
      })
      .then(data => {
        setManhwa(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    fetch(`/api/manhwa/${id}/comments`)
      .then(res => res.json())
      .then(data => setComments(data))
      .catch(err => console.error("Comments fetch error:", err));

    if (user) {
      fetch('/api/user/bookmarks', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setIsBookmarked(data.some((b: any) => b.id === Number(id))));

      fetch('/api/user/purchases', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setPurchasedChapters(data));
    }

    socket.on('new_comment', (data) => {
      if (data.mangaId === id) {
        setComments(prev => [data.comment, ...prev]);
      }
    });

    socket.on('comment_deleted', (data) => {
      if (data.mangaId === id) {
        setComments(prev => prev.filter(c => c.id !== Number(data.commentId)));
      }
    });

    return () => {
      socket.off('new_comment');
      socket.off('comment_deleted');
    };
  }, [id, user, token]);

  const handleBookmark = async () => {
    if (!user) return alert('Please login to bookmark');
    const res = await fetch(`/api/manhwa/${id}/bookmark`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setIsBookmarked(!data.removed);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const res = await fetch(`/api/manhwa/${id}/comments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ comment: newComment })
    });
    if (res.ok) {
      setNewComment('');
    }
  };

  const deleteComment = async (commentId: number) => {
    await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!manhwa) return <div className="text-center py-20">Manhwa not found</div>;

  return (
    <div className="min-h-screen bg-primary">
      {/* Hero Backdrop */}
      <div className="relative h-[450px] w-full overflow-hidden">
        <img 
          src={manhwa.poster || 'https://picsum.photos/seed/manga/1920/1080'} 
          className="w-full h-full object-cover blur-3xl scale-110 opacity-20"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-[320px] relative z-10 pb-32">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Left Side: Poster & Quick Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full lg:w-[340px] flex-shrink-0"
          >
            <div className="rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] border border-white/5 aspect-[2/3] group">
              <img 
                src={manhwa.poster || 'https://picsum.photos/seed/manga/400/600'} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="mt-10 grid grid-cols-2 gap-4">
              <button 
                onClick={handleBookmark}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all duration-300 ${
                  isBookmarked 
                  ? 'bg-accent text-white shadow-xl shadow-accent/20' 
                  : 'bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10'
                }`}
              >
                <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
                {isBookmarked ? 'Saved' : 'Bookmark'}
              </button>
              <button className="flex items-center justify-center gap-2 py-4 bg-secondary border border-white/5 rounded-2xl font-bold text-sm text-text-secondary hover:text-white hover:border-white/10 transition-all duration-300">
                <Share2 size={18} /> Share
              </button>
            </div>
          </motion.div>

          {/* Right Side: Info & Chapters */}
          <div className="flex-grow pt-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-8"
            >
              <div className="flex flex-wrap gap-3">
                {manhwa.genres.map(genre => (
                  <span key={genre} className="px-4 py-1.5 bg-secondary border border-white/5 text-text-secondary text-[10px] font-black uppercase tracking-widest rounded-full hover:border-accent/50 hover:text-accent transition-colors cursor-default">
                    {genre}
                  </span>
                ))}
              </div>
              
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter font-display leading-[0.9]">{manhwa.title}</h1>
                <div className="flex flex-wrap items-center gap-8 text-text-secondary/60 font-bold text-xs uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Star size={18} className="text-accent fill-accent" />
                    <span className="text-text-primary text-base">4.9</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare size={18} />
                    <span>{comments.length} Comments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={18} />
                    <span>Updated 2h ago</span>
                  </div>
                </div>
              </div>

              <p className="text-text-secondary text-lg leading-relaxed max-w-3xl font-medium opacity-80">
                {manhwa.description}
              </p>

              <div className="pt-6">
                <Link 
                  to={manhwa.chapters.length > 0 ? `/reader/${manhwa.chapters[manhwa.chapters.length - 1].id}` : '#'}
                  className="inline-flex items-center gap-4 bg-accent hover:bg-accent/90 text-white px-12 py-5 rounded-[2rem] font-bold text-lg transition-all shadow-2xl shadow-accent/30 active:scale-95"
                >
                  <Play size={24} fill="currentColor" /> Start Reading
                </Link>
              </div>
            </motion.div>

            {/* Chapter List Section */}
            <div className="mt-24">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-bold tracking-tight font-display">Chapters</h2>
                <div className="px-4 py-1.5 bg-secondary border border-white/5 rounded-full text-[10px] font-black text-text-secondary uppercase tracking-widest">
                  {manhwa.chapters.length} Total
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {manhwa.chapters.map((chapter, idx) => (
                  <motion.div
                    key={chapter.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Link 
                      to={`/reader/${chapter.id}`}
                      className="flex items-center justify-between p-6 bg-secondary hover:bg-white/5 rounded-[2rem] border border-white/5 transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-primary border border-white/5 rounded-2xl flex items-center justify-center font-black text-text-secondary group-hover:text-accent group-hover:border-accent/30 transition-all duration-300">
                          {chapter.chapter_number}
                        </div>
                        <div>
                          <div className="font-bold text-text-primary group-hover:text-accent transition-colors">
                            {chapter.title || `Chapter ${chapter.chapter_number}`}
                          </div>
                          <div className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest mt-1">
                            Dec 24, 2023
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {chapter.coin_price > 0 && (
                          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            purchasedChapters.includes(chapter.id) 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                              : 'bg-accent/10 text-accent border border-accent/20'
                          }`}>
                            {purchasedChapters.includes(chapter.id) ? 'Purchased' : `${chapter.coin_price} Coins`}
                          </div>
                        )}
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl text-text-secondary/20 group-hover:text-accent transition-colors">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Comments Section */}
            <div className="mt-24">
              <h2 className="text-3xl font-bold tracking-tight font-display mb-10">Discussion</h2>
              
              {user ? (
                <form onSubmit={handleComment} className="mb-12 group">
                  <div className="relative">
                    <textarea 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="What's on your mind?"
                      className="w-full bg-secondary border border-white/5 rounded-[2rem] p-8 min-h-[160px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all duration-300 placeholder:text-text-secondary/30 text-lg font-medium"
                    />
                    <button 
                      type="submit"
                      disabled={!newComment.trim()}
                      className="absolute bottom-6 right-6 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent text-white p-4 rounded-2xl transition-all shadow-xl shadow-accent/20 active:scale-95"
                    >
                      <Send size={24} />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-12 bg-secondary rounded-[2.5rem] border border-dashed border-white/5 text-center mb-12">
                  <p className="text-text-secondary font-medium">Please login to join the conversation</p>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('openAuth'))} className="mt-4 text-accent font-bold text-sm hover:underline">Sign In Now</button>
                </div>
              )}

              <div className="space-y-6">
                {comments.map((comment, idx) => (
                  <motion.div 
                    key={comment.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-6 p-8 bg-secondary/50 rounded-[2.5rem] border border-white/5"
                  >
                    <div className="w-14 h-14 bg-accent rounded-2xl flex-shrink-0 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-accent/10">
                      {comment.username[0].toUpperCase()}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-text-primary text-lg">{comment.username}</span>
                          <span className="text-[10px] font-black text-text-secondary/30 uppercase tracking-widest">{new Date(comment.created_at).toLocaleDateString()}</span>
                        </div>
                        {(user?.role === 'admin' || user?.id === comment.user_id) && (
                          <button 
                            onClick={() => deleteComment(comment.id)}
                            className="p-2 text-text-secondary/20 hover:text-accent transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      <p className="text-text-secondary text-lg leading-relaxed font-medium opacity-90">{comment.comment}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
