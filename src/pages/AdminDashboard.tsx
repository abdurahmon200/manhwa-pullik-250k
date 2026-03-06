import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { 
  Plus, LayoutDashboard, BookOpen, Users, 
  MessageSquare, Settings, Upload, Trash2, 
  Edit, ChevronRight, FileText, Lock, Globe, Info,
  Search, Coins, History, ArrowUpRight, ArrowDownRight, Gift,
  Star, Bookmark
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { Manhwa } from '../types';

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const [manhwas, setManhwas] = useState<Manhwa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/manhwa')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch manhwas');
        return res.json();
      })
      .then(data => {
        setManhwas(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
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
          {user?.role === 'admin' && (
            <>
              <Link to="/admin/users" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
                <Users size={20} /> Manage Users
              </Link>
              <Link to="/admin/transactions" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
                <History size={20} /> Coin History
              </Link>
              <Link to="/admin/hero" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
                <Globe size={20} /> Hero Banner
              </Link>
            </>
          )}
          <Link to="/admin/comments" className="flex items-center gap-4 px-6 py-4 bg-secondary border border-white/5 text-text-secondary hover:text-white hover:border-white/10 rounded-2xl font-bold transition-all">
            <MessageSquare size={20} /> Comments
          </Link>
        </div>

        {/* Content */}
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<AdminHome manhwas={manhwas} fetchManhwas={() => {
              fetch('/api/manhwa')
                .then(res => {
                  if (!res.ok) throw new Error('Failed to fetch manhwas');
                  return res.json();
                })
                .then(data => setManhwas(data))
                .catch(err => console.error(err));
            }} />} />
            <Route path="/manhwa/new" element={<AddManhwa />} />
            <Route path="/manhwa/:id/edit" element={<EditManhwa />} />
            <Route path="/manhwa/:id/chapters" element={<ManageChapters />} />
            <Route path="/manhwa/:id/chapters/new" element={<AddChapter />} />
            {user?.role === 'admin' && (
              <>
                <Route path="/hero" element={<ManageHero />} />
                <Route path="/users" element={<ManageUsers />} />
                <Route path="/transactions" element={<CoinTransactions />} />
              </>
            )}
          </Routes>
        </div>
      </div>
    </div>
  );
}

function ManageUsers() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coinAmount, setCoinAmount] = useState(0);
  const [coinDesc, setCoinDesc] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users?search=${search}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        if (data.length === 0) setError('No users found');
      } else {
        setError('Error searching users');
      }
    } catch (err) {
      setError('Error searching users');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, role: string) => {
    const res = await fetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    });
    if (res.ok) {
      setUsers(users.map(u => u.id === userId ? { ...u, role } : u));
      if (foundUser?.id === userId) setFoundUser({ ...foundUser, role });
    }
  };

  const adjustCoins = async (userId: string, amount: number) => {
    const res = await fetch(`/api/users/${userId}/coins`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        amount, 
        type: amount > 0 ? 'add' : 'spend',
        description: coinDesc || (amount > 0 ? 'Admin bonus' : 'Admin deduction')
      })
    });
    if (res.ok) {
      const data = await res.json();
      setUsers(users.map(u => u.id === userId ? { ...u, coins: data.coins } : u));
      if (foundUser?.id === userId) setFoundUser({ ...foundUser, coins: data.coins });
      setCoinAmount(0);
      setCoinDesc('');
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-secondary p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 font-display">User Management</h2>
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary/40" size={20} />
            <input 
              type="text" 
              placeholder="Search by ID, Username or Email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-primary border border-white/5 rounded-2xl pl-16 pr-6 py-4 outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button className="bg-accent text-white px-8 py-4 rounded-2xl font-bold">Search</button>
        </form>
        {error && <p className="mt-4 text-accent font-bold">{error}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {users.map(u => (
          <motion.div 
            key={u.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary p-8 rounded-[2.5rem] border border-white/5 shadow-2xl"
          >
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-grow space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {u.username}
                      <span className={`text-[10px] px-2 py-1 rounded-lg ${
                        u.role === 'admin' ? 'bg-accent/20 text-accent' : 
                        u.role === 'assistant_admin' ? 'bg-blue-500/20 text-blue-400' : 
                        'bg-white/5 text-text-secondary'
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </h3>
                    <p className="text-text-secondary text-sm">{u.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-text-secondary/40 uppercase tracking-widest">User ID</span>
                    <p className="text-lg font-bold">#{u.id}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-4 bg-primary rounded-2xl">
                    <p className="text-text-secondary/40 text-[10px] uppercase font-black mb-1">Coins Balance</p>
                    <p className="text-xl font-bold flex items-center gap-2 text-yellow-500">
                      <Coins size={18} /> {u.coins}
                    </p>
                  </div>
                  <div className="p-4 bg-primary rounded-2xl">
                    <p className="text-text-secondary/40 text-[10px] uppercase font-black mb-1">Joined Date</p>
                    <p className="font-bold">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-80 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Change Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['user', 'assistant_admin', 'admin'].map(role => (
                      <button 
                        key={role}
                        onClick={() => updateRole(u.id, role)}
                        className={`px-2 py-2 rounded-xl text-[10px] font-bold transition-all ${
                          u.role === role ? 'bg-accent text-white' : 'bg-primary text-text-secondary'
                        }`}
                      >
                        {role.split('_')[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Adjust Coins</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="Amount"
                        className="w-full bg-primary border border-white/5 rounded-xl px-4 py-2 text-sm outline-none"
                        onChange={(e) => setCoinAmount(Number(e.target.value))}
                      />
                      <button 
                        onClick={() => adjustCoins(u.id, coinAmount)}
                        className="bg-accent text-white px-4 py-2 rounded-xl text-xs font-bold"
                      >
                        Apply
                      </button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Reason (optional)"
                      className="w-full bg-primary border border-white/5 rounded-xl px-4 py-2 text-[10px] outline-none"
                      onChange={(e) => setCoinDesc(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CoinTransactions() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch transactions');
        return res.json();
      })
      .then(data => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight font-display">Coin Transaction History</h2>
      </div>

      <div className="bg-secondary rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-secondary text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                <th className="px-10 py-6">User</th>
                <th className="px-10 py-6">Type</th>
                <th className="px-10 py-6">Amount</th>
                <th className="px-10 py-6">Description</th>
                <th className="px-10 py-6">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-10 py-6 font-bold">{t.username}</td>
                  <td className="px-10 py-6">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                      t.type === 'add' ? 'bg-green-500/20 text-green-400' : 
                      t.type === 'reward' ? 'bg-yellow-500/20 text-yellow-400' : 
                      'bg-accent/20 text-accent'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className={`px-10 py-6 font-black ${t.amount > 0 ? 'text-green-400' : 'text-accent'}`}>
                    {t.amount > 0 ? '+' : ''}{t.amount}
                  </td>
                  <td className="px-10 py-6 text-text-secondary text-sm">{t.description}</td>
                  <td className="px-10 py-6 text-text-secondary text-xs">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch hero banner');
        return res.json();
      })
      .then(data => {
        setFormData({
          title: data.title,
          description: data.description,
          button_text: data.button_text,
          link: data.link,
          image: null
        });
        setFetching(false);
      })
      .catch(err => {
        console.error(err);
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
  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
      })
      .then(data => setStats(data))
      .catch(err => console.error(err));
  }, []);

  const deleteManhwa = async (id: string) => {
    if (!confirm('Are you sure you want to delete this manhwa? This will delete all chapters and pages!')) return;
    const res = await fetch(`/api/manhwa/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) fetchManhwas();
  };

  if (!stats) return <div className="text-text-secondary">Loading statistics...</div>;

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users },
          { label: 'Total Manhwa', value: stats.totalManhwa, icon: BookOpen },
          { label: 'Total Chapters', value: stats.totalChapters, icon: FileText },
          { label: 'Transactions', value: stats.totalTransactions, icon: Coins },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-secondary p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
          <h3 className="text-xl font-bold mb-6 font-display flex items-center gap-2">
            <Star className="text-yellow-500" size={20} /> Popular Manhwa
          </h3>
          <div className="space-y-4">
            {stats.popularManhwa.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-4 bg-primary rounded-2xl">
                <span className="font-bold">{m.title}</span>
                <span className="text-xs text-text-secondary font-bold flex items-center gap-1">
                  <Bookmark size={12} /> {m.bookmark_count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-secondary p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
          <h3 className="text-xl font-bold mb-6 font-display flex items-center gap-2">
            <Users className="text-blue-400" size={20} /> New Users
          </h3>
          <div className="space-y-4">
            {stats.latestUsers.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-4 bg-primary rounded-2xl">
                <span className="font-bold">{u.username}</span>
                <span className="text-[10px] text-text-secondary font-medium">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
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
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch manhwa');
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
  };

  useEffect(() => {
    fetchManhwa();
  }, [id]);

  const updatePrice = async (chapterId: string, coin_price: number) => {
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

  const deleteChapter = async (chapterId: string) => {
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
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch manhwa');
        return res.json();
      })
      .then(data => {
        setFormData({
          title: data.title,
          description: data.description,
          genres: data.genres.join(', '),
          poster: null
        });
        setFetching(false);
      })
      .catch(err => {
        console.error(err);
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
