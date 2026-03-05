import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { 
  Plus, LayoutDashboard, BookOpen, Users, 
  MessageSquare, Settings, Upload, Trash2, 
  Edit, ChevronRight, FileText, Lock, Globe, Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { Manhwa } from '../types';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [manhwas, setManhwas] = useState<Manhwa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/manhwa')
      .then(res => res.json())
      .then(data => {
        setManhwas(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar */}
        <div className="w-full lg:w-72 flex-shrink-0 space-y-3">
          <Link to="/admin" className="flex items-center gap-4 px-6 py-4 bg-accent text-white rounded-2xl font-bold shadow-xl shadow-accent/20 transition-all">
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          <Link to="/admin/manhwa/new" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
            <Plus size={20} /> Add Manhwa
          </Link>
          <Link to="/admin/users" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
            <Users size={20} /> Manage Users
          </Link>
          <Link to="/admin/comments" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
            <MessageSquare size={20} /> Comments
          </Link>
          <Link to="/admin/hero" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
            <Globe size={20} /> Hero Banner
          </Link>
          <Link to="/admin/users" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
            <Users size={20} /> Manage Users
          </Link>
        </div>

        {/* Content */}
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<AdminHome manhwas={manhwas} fetchManhwas={() => {
              fetch('/api/manhwa')
                .then(res => res.json())
                .then(data => setManhwas(data));
            }} />} />
            <Route path="/manhwa/new" element={<AddManhwa />} />
            <Route path="/manhwa/:id/edit" element={<EditManhwa />} />
            <Route path="/manhwa/:id/chapters" element={<ManageChapters />} />
            <Route path="/manhwa/:id/chapters/new" element={<AddChapter />} />
            <Route path="/hero" element={<ManageHero />} />
            <Route path="/users" element={<ManageUsers />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function ManageUsers() {
  const { token } = useAuth();
  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;
    setLoading(true);
    setError('');
    setFoundUser(null);
    try {
      const res = await fetch(`/api/users/search/${searchId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFoundUser(data);
      } else {
        setError('User not found');
      }
    } catch (err) {
      setError('Error searching user');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (role: string) => {
    if (!foundUser) return;
    const res = await fetch(`/api/users/${foundUser.id}/role`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    });
    if (res.ok) setFoundUser({ ...foundUser, role });
  };

  const updateCoins = async (coins: number) => {
    if (!foundUser) return;
    const res = await fetch(`/api/users/${foundUser.id}/coins`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coins })
    });
    if (res.ok) setFoundUser({ ...foundUser, coins });
  };

  return (
    <div className="space-y-8">
      <div className="bg-secondary p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 font-display">Find User by ID</h2>
        <form onSubmit={handleSearch} className="flex gap-4">
          <input 
            type="number" 
            placeholder="Enter User ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="flex-1 bg-primary border border-white/5 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button className="bg-accent text-white px-8 py-4 rounded-2xl font-bold">Search</button>
        </form>
        {error && <p className="mt-4 text-accent font-bold">{error}</p>}
      </div>

      {foundUser && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">{foundUser.username}</h3>
              <p className="text-text-secondary text-sm">{foundUser.email}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-text-secondary/40 uppercase tracking-widest">User ID</span>
              <p className="text-lg font-bold">#{foundUser.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Manage Role</label>
              <div className="flex flex-wrap gap-2">
                {['user', 'assistant_admin', 'admin'].map(role => (
                  <button 
                    key={role}
                    onClick={() => updateRole(role)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      foundUser.role === role ? 'bg-accent text-white' : 'bg-primary text-text-secondary'
                    }`}
                  >
                    {role.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Manage Coins (Tanga)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  value={foundUser.coins}
                  onChange={(e) => updateCoins(Number(e.target.value))}
                  className="w-32 bg-primary border border-white/5 rounded-xl px-4 py-2 outline-none"
                />
                <span className="text-text-secondary text-sm font-bold">Coins</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ManageHero() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    button_text: '',
    link: '',
    image: null as File | null
  });

  useEffect(() => {
    fetch('/api/settings/hero_banner')
      .then(res => res.json())
      .then(data => {
        setFormData({
          title: data.title,
          description: data.description,
          button_text: data.button_text,
          link: data.link,
          image: null
        });
        setFetching(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    data.append('value', JSON.stringify({
      title: formData.title,
      description: formData.description,
      button_text: formData.button_text,
      link: formData.link
    }));
    if (formData.image) data.append('image', formData.image);

    const res = await fetch('/api/settings/hero_banner', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: data
    });

    if (res.ok) alert('Hero banner updated successfully!');
    setLoading(false);
  };

  if (fetching) return <div className="text-text-secondary">Loading...</div>;

  return (
    <div className="bg-secondary p-12 rounded-[2.5rem] border border-white/5 max-w-3xl shadow-2xl">
      <div className="space-y-1 mb-10">
        <h2 className="text-3xl font-bold tracking-tight font-display">Manage Hero Banner</h2>
        <p className="text-text-secondary text-sm font-medium opacity-40">Update the main banner on the home page</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Title (Use ':' for accent color)</label>
          <input 
            type="text" 
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
            placeholder="e.g. Solo Leveling: Ragnarok"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Description</label>
          <textarea 
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all min-h-[120px]"
          />
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Button Text</label>
            <input 
              type="text" 
              required
              value={formData.button_text}
              onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
              className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
            />
          </div>
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Button Link</label>
            <input 
              type="text" 
              required
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
            />
          </div>
        </div>
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Banner Image (Leave empty to keep current)</label>
          <div className="relative group">
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="bg-primary border-2 border-dashed border-white/5 rounded-[2rem] p-12 text-center group-hover:border-accent/50 transition-all duration-300">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-text-secondary group-hover:text-accent transition-colors">
                <Upload size={32} />
              </div>
              <p className="text-text-secondary font-bold text-sm">
                {formData.image ? formData.image.name : 'Drop new banner or click to browse'}
              </p>
            </div>
          </div>
        </div>
        <button 
          disabled={loading}
          className="w-full bg-accent hover:bg-accent/90 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-accent/20 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Hero Banner'}
        </button>
      </form>
    </div>
  );
}

function AdminHome({ manhwas, fetchManhwas }: { manhwas: Manhwa[], fetchManhwas: () => void }) {
  const { token } = useAuth();
  
  const deleteManhwa = async (id: number) => {
    if (!confirm('Are you sure you want to delete this manhwa? This will delete all chapters and pages!')) return;
    const res = await fetch(`/api/manhwa/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) fetchManhwas();
  };

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        {[
          { label: 'Total Manhwa', value: manhwas.length, icon: BookOpen },
          { label: 'Total Chapters', value: '1,248', icon: FileText },
          { label: 'Active Users', value: '452', icon: Users },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary rounded-2xl text-accent">
                <stat.icon size={24} />
              </div>
            </div>
            <div className="text-text-secondary text-[10px] font-black uppercase tracking-widest mb-1 opacity-40">{stat.label}</div>
            <div className="text-4xl font-black font-display tracking-tighter">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-secondary rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="p-10 border-b border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight font-display">Recent Manhwa</h2>
            <p className="text-text-secondary text-xs font-medium opacity-40">Manage your latest publications</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/admin/manhwa/new" className="bg-accent hover:bg-accent/90 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-accent/20 flex items-center gap-2">
              <Plus size={18} /> Add New
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-secondary text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                <th className="px-10 py-6">Poster</th>
                <th className="px-10 py-6">Title</th>
                <th className="px-10 py-6">Chapters</th>
                <th className="px-10 py-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {manhwas.map(m => (
                <tr key={m.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-10 py-6">
                    <img src={m.poster} className="w-12 h-16 object-cover rounded-xl shadow-lg" referrerPolicy="no-referrer" />
                  </td>
                  <td className="px-10 py-6 font-bold text-text-primary text-lg tracking-tight">{m.title}</td>
                  <td className="px-10 py-6 text-text-secondary font-bold">24</td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <Link to={`/admin/manhwa/${m.id}/chapters`} className="flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-white/10 text-text-secondary hover:text-white rounded-2xl transition-all text-xs font-bold" title="Manage Chapters">
                        <BookOpen size={16} /> Chapters
                      </Link>
                      <Link to={`/admin/manhwa/${m.id}/chapters/new`} className="flex items-center gap-2 px-5 py-2.5 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-2xl transition-all text-xs font-bold" title="Add Chapter">
                        <Upload size={16} /> Add
                      </Link>
                      <Link to={`/admin/manhwa/${m.id}/edit`} className="p-3 bg-primary hover:bg-white/10 text-text-secondary hover:text-white rounded-2xl transition-all">
                        <Edit size={20} />
                      </Link>
                      <button 
                        onClick={() => deleteManhwa(m.id)}
                        className="p-3 bg-primary hover:bg-accent/10 text-text-secondary hover:text-accent rounded-2xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ManageChapters() {
  const { id } = useParams();
  const { token } = useAuth();
  const [manhwa, setManhwa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchManhwa = () => {
    fetch(`/api/manhwa/${id}`)
      .then(res => res.json())
      .then(data => {
        setManhwa(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchManhwa();
  }, [id]);

  const updatePrice = async (chapterId: number, coin_price: number) => {
    const res = await fetch(`/api/chapters/${chapterId}/price`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coin_price })
    });
    if (res.ok) fetchManhwa();
  };

  const deleteChapter = async (chapterId: number) => {
    if (!confirm('Are you sure you want to delete this chapter?')) return;
    const res = await fetch(`/api/chapters/${chapterId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) fetchManhwa();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight font-display">Manage Chapters</h2>
          <p className="text-text-secondary text-sm font-medium opacity-40">{manhwa.title}</p>
        </div>
        <Link to={`/admin/manhwa/${id}/chapters/new`} className="bg-accent hover:bg-accent/90 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-accent/20 flex items-center gap-2">
          <Plus size={18} /> Add New Chapter
        </Link>
      </div>

      <div className="bg-secondary rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-secondary text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                <th className="px-10 py-6">Number</th>
                <th className="px-10 py-6">Title</th>
                <th className="px-10 py-6">Status</th>
                <th className="px-10 py-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {manhwa.chapters.map((c: any) => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-10 py-6 font-bold text-text-primary text-lg tracking-tight">Chapter {c.chapter_number}</td>
                  <td className="px-10 py-6 text-text-secondary font-medium">{c.title || 'No Title'}</td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        value={c.coin_price}
                        onChange={(e) => updatePrice(c.id, Number(e.target.value))}
                        className="w-20 bg-primary border border-white/5 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-accent/30"
                      />
                      <span className="text-[10px] font-black text-text-secondary/40 uppercase tracking-widest">Coins</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => deleteChapter(c.id)}
                        className="p-3 bg-primary hover:bg-accent/10 text-text-secondary hover:text-accent rounded-2xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EditManhwa() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genres: '',
    poster: null as File | null
  });

  useEffect(() => {
    fetch(`/api/manhwa/${id}`)
      .then(res => res.json())
      .then(data => {
        setFormData({
          title: data.title,
          description: data.description,
          genres: data.genres.join(', '),
          poster: null
        });
        setFetching(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('genres', JSON.stringify(formData.genres.split(',').map(g => g.trim())));
    if (formData.poster) data.append('poster', formData.poster);

    const res = await fetch(`/api/manhwa/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: data
    });

    if (res.ok) navigate('/admin');
    setLoading(false);
  };

  if (fetching) return <div className="text-text-secondary">Loading...</div>;

  return (
    <div className="bg-secondary p-12 rounded-[2.5rem] border border-white/5 max-w-3xl shadow-2xl">
      <div className="space-y-1 mb-10">
        <h2 className="text-3xl font-bold tracking-tight font-display">Edit Manhwa</h2>
        <p className="text-text-secondary text-sm font-medium opacity-40">Update manhwa information</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Title</label>
          <input 
            type="text" 
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Description</label>
          <textarea 
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all min-h-[180px]"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Genres (comma separated)</label>
          <input 
            type="text" 
            value={formData.genres}
            onChange={(e) => setFormData({ ...formData, genres: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Poster Image (Leave empty to keep current)</label>
          <div className="relative group">
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setFormData({ ...formData, poster: e.target.files?.[0] || null })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="bg-primary border-2 border-dashed border-white/5 rounded-[2rem] p-12 text-center group-hover:border-accent/50 transition-all duration-300">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-text-secondary group-hover:text-accent transition-colors">
                <Upload size={32} />
              </div>
              <p className="text-text-secondary font-bold text-sm">
                {formData.poster ? formData.poster.name : 'Drop new poster or click to browse'}
              </p>
            </div>
          </div>
        </div>
        <button 
          disabled={loading}
          className="w-full bg-accent hover:bg-accent/90 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-accent/20 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Manhwa'}
        </button>
      </form>
    </div>
  );
}

function AddManhwa() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genres: '',
    poster: null as File | null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('genres', JSON.stringify(formData.genres.split(',').map(g => g.trim())));
    if (formData.poster) data.append('poster', formData.poster);

    const res = await fetch('/api/manhwa', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: data
    });

    if (res.ok) navigate('/admin');
    setLoading(false);
  };

  return (
    <div className="bg-secondary p-12 rounded-[2.5rem] border border-white/5 max-w-3xl shadow-2xl">
      <div className="space-y-1 mb-10">
        <h2 className="text-3xl font-bold tracking-tight font-display">Add New Manhwa</h2>
        <p className="text-text-secondary text-sm font-medium opacity-40">Create a new entry in the database</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Title</label>
          <input 
            type="text" 
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
            placeholder="Enter manhwa title"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Description</label>
          <textarea 
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all min-h-[180px]"
            placeholder="Write a compelling description..."
          />
        </div>
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Genres (comma separated)</label>
          <input 
            type="text" 
            placeholder="Action, Adventure, Fantasy"
            value={formData.genres}
            onChange={(e) => setFormData({ ...formData, genres: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Poster Image</label>
          <div className="relative group">
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setFormData({ ...formData, poster: e.target.files?.[0] || null })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="bg-primary border-2 border-dashed border-white/5 rounded-[2rem] p-12 text-center group-hover:border-accent/50 transition-all duration-300">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-text-secondary group-hover:text-accent transition-colors">
                <Upload size={32} />
              </div>
              <p className="text-text-secondary font-bold text-sm">
                {formData.poster ? formData.poster.name : 'Drop your poster here or click to browse'}
              </p>
            </div>
          </div>
        </div>
        <button 
          disabled={loading}
          className="w-full bg-accent hover:bg-accent/90 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-accent/20 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Manhwa'}
        </button>
      </form>
    </div>
  );
}

function AddChapter() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    chapter_number: '',
    title: '',
    coin_price: '0',
    pdf: null as File | null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData();
    data.append('chapter_number', formData.chapter_number);
    data.append('title', formData.title);
    data.append('coin_price', formData.coin_price);
    if (formData.pdf) data.append('pdf', formData.pdf);

    try {
      const res = await fetch(`/api/manhwa/${id}/chapters`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: data
      });

      const result = await res.json();

      if (res.ok) {
        navigate('/admin');
      } else {
        setError(result.error || 'Failed to upload chapter');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-secondary p-12 rounded-[2.5rem] border border-white/5 max-w-3xl shadow-2xl">
      <div className="space-y-1 mb-10">
        <h2 className="text-3xl font-bold tracking-tight font-display">Upload New Chapter</h2>
        <p className="text-text-secondary text-sm font-medium opacity-40">Add a new chapter to this series</p>
      </div>
      
      {error && (
        <div className="mb-8 p-6 bg-accent/10 border border-accent/20 rounded-2xl text-accent text-sm font-bold flex items-center gap-3">
          <Info size={20} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Chapter Number</label>
            <input 
              type="number" 
              step="0.1"
              required
              value={formData.chapter_number}
              onChange={(e) => setFormData({ ...formData, chapter_number: e.target.value })}
              className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
              placeholder="e.g. 1.0"
            />
          </div>
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Chapter Title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
              placeholder="Optional title"
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Coin Price (0 for Free)</label>
          <input 
            type="number" 
            value={formData.coin_price}
            onChange={(e) => setFormData({ ...formData, coin_price: e.target.value })}
            className="w-full bg-primary border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-accent/30 focus:border-accent/50 outline-none text-text-primary font-medium transition-all"
            placeholder="e.g. 10"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Chapter PDF</label>
          <div className="relative group">
            <input 
              type="file" 
              accept=".pdf"
              required
              onChange={(e) => setFormData({ ...formData, pdf: e.target.files?.[0] || null })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="bg-primary border-2 border-dashed border-white/5 rounded-[2rem] p-12 text-center group-hover:border-accent/50 transition-all duration-300">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-text-secondary group-hover:text-accent transition-colors">
                <FileText size={32} />
              </div>
              <p className="text-text-secondary font-bold text-sm">
                {formData.pdf ? formData.pdf.name : 'Drop your PDF here or click to browse'}
              </p>
              <p className="text-[10px] font-black text-text-secondary/30 uppercase tracking-widest mt-4">Automatic high-quality PNG conversion</p>
            </div>
          </div>
        </div>

        <button 
          disabled={loading}
          className="w-full bg-accent hover:bg-accent/90 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-accent/20 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Processing PDF...' : 'Upload & Convert Chapter'}
        </button>
      </form>
    </div>
  );
}
