import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// --- Supabase Setup ---
const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return url.startsWith('http') && !url.includes('placeholder-project');
  } catch {
    return false;
  }
};

const isSupabaseConfigured = isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey !== "placeholder-key";

const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder-project.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder-key"
);

// Mock Data for fallback when Supabase is not configured
const mockManhwas = [
  {
    id: "1",
    title: "Solo Leveling: Ragnarok",
    description: "The legend continues. Sung Jin-woo's son, Sung Su-ho, awakens his powers in a world where the gates have reopened. As a new threat emerges, Su-ho must follow in his father's footsteps to become the ultimate hunter.",
    poster: "https://picsum.photos/seed/manhwa-1/800/1200",
    genres: "Action,Adventure,Fantasy",
    created_at: new Date().toISOString(),
    latest_chapters: [
      { id: "c1", chapter_number: 1, title: "The Awakening", coin_price: 0, created_at: new Date().toISOString() }
    ]
  },
  {
    id: "2",
    title: "The Beginning After The End",
    description: "King Grey has unrivaled strength, wealth, and prestige in a world governed by martial ability. However, solitude lingers closely behind those with great power. Beneath the glamorous exterior of a powerful king lurks the shell of man, devoid of purpose and will.",
    poster: "https://picsum.photos/seed/manhwa-2/800/1200",
    genres: "Isekai,Magic,Fantasy",
    created_at: new Date().toISOString(),
    latest_chapters: [
      { id: "c2", chapter_number: 1, title: "Rebirth", coin_price: 0, created_at: new Date().toISOString() }
    ]
  }
];

const mockHero = {
  title: "Solo Leveling: Ragnarok",
  description: "The legend continues. Sung Jin-woo's son, Sung Su-ho, awakens his powers in a world where the gates have reopened...",
  image: "https://picsum.photos/seed/manhwa-hero/1920/1080",
  button_text: "Read Now",
  link: "/manhwa/1"
};

// Helper to upload to Supabase Storage
async function uploadToSupabase(bucket: string, filePath: string, buffer: Buffer, contentType: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });

  if (error) {
    console.error(`Supabase Storage upload error (${bucket}/${filePath}):`, error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrl;
}

// Helper to delete from Supabase Storage
async function deleteFromSupabase(bucket: string, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage
    .from(bucket)
    .remove(paths);

  if (error) {
    console.error(`Supabase Storage deletion error (${bucket}):`, error);
  }
}

// Initialize tables and seed data (Supabase handles tables, but we can seed if needed)
async function initializeDatabase() {
  try {
    // Seed Admin
    const adminEmail = "yt918859@gmail.com";
    const adminPassword = "bro2009";
    
    const { data: existingAdmin, error: fetchError } = await supabase.from("users").select("*").eq("email", adminEmail).maybeSingle();
    
    if (fetchError) {
      console.error("Error fetching existing admin:", fetchError);
    }

    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    const testMatch = bcrypt.compareSync(adminPassword, hashedPassword);
    
    if (!existingAdmin) {
      const { data: insertedAdmin, error: insertError } = await supabase.from("users").insert({
        username: "Admin", 
        email: adminEmail, 
        password: hashedPassword, 
        role: "admin",
        coins: 999999
      }).select().single();

      if (insertError) {
        console.error("Failed to seed admin user:", insertError.message, insertError);
      }
    } else {
      // Always ensure the admin has the correct role and password for this specific email during dev
      const { error: updateError } = await supabase.from("users").update({ 
        role: "admin",
        password: hashedPassword 
      }).eq("email", adminEmail);
      
      if (updateError) {
        console.error(`Failed to update admin user (${adminEmail}):`, updateError.message);
      }
    }

    // Basic connectivity check - check for 'settings' table
    const { data: testData, error: testError } = await supabase.from("settings").select("key").limit(1);
    if (testError) {
      console.error("Supabase connection check failed. Table 'settings' might not exist:", testError.message);
      // Don't return here, let it try other things if possible
    }

    // Seed default settings if not exists
    const defaultHero = {
      title: "Solo Leveling: Ragnarok",
      description: "The legend continues. Sung Jin-woo's son, Sung Su-ho, awakens his powers in a world where the gates have reopened...",
      image: "https://picsum.photos/seed/manhwa-hero/1920/1080",
      button_text: "Read Now",
      link: "/manhwa/1"
    };

    const { data: existingHero } = await supabase.from("settings").select("*").eq("key", "hero_banner").maybeSingle();
    if (!existingHero) {
      await supabase.from("settings").insert({ key: "hero_banner", value: JSON.stringify(defaultHero) });
    }

    // Seed sample manhwa if none exist
    const { count: manhwaCount } = await supabase.from("manhwa").select("*", { count: 'exact', head: true });
    if (manhwaCount === 0) {
      const { data: manga, error: mangaError } = await supabase.from("manhwa").insert({
        title: "Solo Leveling: Ragnarok",
        description: "The legend continues. Sung Jin-woo's son, Sung Su-ho, awakens his powers in a world where the gates have reopened. As a new threat emerges, Su-ho must follow in his father's footsteps to become the ultimate hunter.",
        poster: "https://picsum.photos/seed/manhwa-1/800/1200"
      }).select().single();

      if (manga) {
        const mangaId = manga.id;
        
        // Add genres
        const genres = ["Action", "Adventure", "Fantasy"];
        for (const genreName of genres) {
          let { data: genre } = await supabase.from("genres").select("id").eq("name", genreName).maybeSingle();
          if (!genre) {
            const { data: newGenre } = await supabase.from("genres").insert({ name: genreName }).select().single();
            genre = newGenre;
          }
          if (genre) {
            await supabase.from("manhwa_genres").insert({ manga_id: mangaId, genre_id: genre.id });
          }
        }

        // Add a sample chapter
        const { data: chapter } = await supabase.from("chapters").insert({
          manga_id: mangaId, chapter_number: 1, title: "The Awakening", coin_price: 0
        }).select().single();

        if (chapter) {
          const chapterId = chapter.id;
          // Add sample pages
          const pages = [];
          for (let i = 1; i <= 3; i++) {
            pages.push({
              chapter_id: chapterId, image_url: `https://picsum.photos/seed/manga-page-${i}/800/1200`, page_number: i
            });
          }
          await supabase.from("pages").insert(pages);
        }
      }
    }
  } catch (err) {
    console.error("Database seeding failed:", err);
  }
}

// initializeDatabase(); // Now called inside startServer to ensure it's awaited

// --- Express & Socket.io Setup ---
async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;
  const JWT_SECRET = process.env.JWT_SECRET || "manga-secret-key";

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {
    });
  });

  app.use(express.json());
  app.use("/uploads", express.static("uploads"));

  // Debug route (REMOVE IN PRODUCTION)
  app.get("/api/debug/users", async (req, res) => {
    if (!isSupabaseConfigured) return res.json([{ id: "mock-admin-id", username: "Admin (Mock)", email: "yt918859@gmail.com", role: "admin" }]);
    const { data: users } = await supabase.from("users").select("id, username, email, role");
    res.json(users);
  });

  // Ensure uploads directory exists
  const dirs = ["uploads", "uploads/posters", "uploads/chapters", "uploads/temp", "uploads/banners"];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "poster") cb(null, "uploads/posters");
      else if (file.fieldname === "pdf") cb(null, "uploads/temp");
      else if (file.fieldname === "image") cb(null, "uploads/banners");
      else cb(null, "uploads");
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    }
  });

  const upload = multer({ 
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
      if (file.fieldname === "pdf") {
        if (file.mimetype !== "application/pdf") {
          return cb(new Error("Only PDF files are allowed"));
        }
      }
      cb(null, true);
    }
  });

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  const isAdmin = async (req: any, res: any, next: any) => {
    if (!isSupabaseConfigured) {
      // In mock mode, the mock admin has role 'admin'
      if (req.user && req.user.role === 'admin') return next();
      return res.sendStatus(403);
    }
    try {
      const { data: user, error } = await supabase.from("users").select("role").eq("id", req.user.id).maybeSingle();
      if (error || !user) return res.sendStatus(403);
      if (user.role !== 'admin' && user.role !== 'assistant_admin') return res.sendStatus(403);
      next();
    } catch (err) {
      res.sendStatus(500);
    }
  };

  const isSuperAdmin = async (req: any, res: any, next: any) => {
    if (!isSupabaseConfigured) {
      if (req.user && req.user.role === 'admin') return next();
      return res.sendStatus(403);
    }
    try {
      const { data: user, error } = await supabase.from("users").select("role").eq("id", req.user.id).maybeSingle();
      if (error || !user) return res.sendStatus(403);
      if (user.role !== 'admin') return res.sendStatus(403);
      next();
    } catch (err) {
      res.sendStatus(500);
    }
  };

  // --- API Routes ---
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      supabaseConfigured: isSupabaseConfigured
    });
  });

  // Start initialization in background
  if (isSupabaseConfigured) {
    initializeDatabase().catch(err => {
      console.error("Background database initialization failed:", err);
    });
  } else {
    console.warn("Supabase not configured. Skipping database initialization.");
  }

  // Improved Multer error handling for specific routes
  const handleUpload = (field: string) => (req: any, res: any, next: any) => {
    upload.single(field)(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        console.error(`Multer error during ${field} upload:`, err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "File too large. Maximum size is 100MB." });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        console.error(`General error during ${field} upload:`, err);
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };

  // Auth
  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) {
      return res.json({
        id: "mock-admin-id",
        username: "Admin (Mock)",
        email: "yt918859@gmail.com",
        role: "admin",
        coins: 999999
      });
    }
    try {
      const { data: user, error } = await supabase.from("users").select("id, username, email, role, coins").eq("id", req.user.id).maybeSingle();
      if (error || !user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    if (!isSupabaseConfigured) {
      return res.status(503).json({ error: "Registration unavailable in mock mode. Please configure Supabase." });
    }
    const { username, email, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const { data: user, error } = await supabase.from("users").insert({ username, email, password: hashedPassword }).select().single();
      if (error) throw error;
      
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET);
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role, 
          coins: user.coins 
        } 
      });
    } catch (e) {
      console.error("Registration error:", e);
      res.status(400).json({ error: "User already exists or registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    
    if (!isSupabaseConfigured) {
      // Allow login with the provided admin credentials in mock mode
      if (email === "yt918859@gmail.com" && password === "bro2009") {
        const token = jwt.sign({ id: "mock-admin-id", role: "admin", username: "Admin (Mock)" }, JWT_SECRET);
        return res.json({ 
          token, 
          user: { id: "mock-admin-id", username: "Admin (Mock)", role: "admin", coins: 999999 } 
        });
      }
      return res.status(401).json({ error: "Invalid credentials (Mock Mode: Use admin email/pass)" });
    }
    
    try {
      const { data: user, error } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
      
      if (error) {
        console.error(`Login error fetching user: ${error.message}`);
        return res.status(500).json({ error: "Internal server error" });
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isPasswordMatch = bcrypt.compareSync(password, user.password);

      if (isPasswordMatch) {
        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET);
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, coins: user.coins } });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err: any) {
      console.error("Login route exception:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Management (Super Admin only)
  app.get("/api/admin/users", authenticateToken, isSuperAdmin, async (req, res) => {
    if (!isSupabaseConfigured) return res.json([{ id: "mock-admin-id", username: "Admin (Mock)", email: "yt918859@gmail.com", role: "admin", coins: 999999, created_at: new Date().toISOString() }]);
    const { search } = req.query;
    let query = supabase.from("users").select("id, username, email, role, coins, created_at");
    
    if (search) {
      query = query.or(`id.eq.${search},username.ilike.%${search}%,email.ilike.%${search}%`);
    }
    
    const { data: users, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(users);
  });

  app.get("/api/admin/stats", authenticateToken, isAdmin, async (req, res) => {
    if (!isSupabaseConfigured) {
      return res.json({
        totalUsers: 1,
        totalManhwa: mockManhwas.length,
        totalChapters: 2,
        totalTransactions: 0,
        popularManhwa: mockManhwas.map(m => ({ id: m.id, title: m.title, bookmark_count: 0 })),
        latestUsers: [{ id: "mock-admin-id", username: "Admin (Mock)", created_at: new Date().toISOString() }]
      });
    }
    const { count: totalUsers } = await supabase.from("users").select("*", { count: 'exact', head: true });
    const { count: totalManhwa } = await supabase.from("manhwa").select("*", { count: 'exact', head: true });
    const { count: totalChapters } = await supabase.from("chapters").select("*", { count: 'exact', head: true });
    const { count: totalTransactions } = await supabase.from("coin_transactions").select("*", { count: 'exact', head: true });
    
    // For popular manhwa, we'd need a more complex query or multiple queries
    const { data: popularManhwaData } = await supabase.from("manhwa").select(`
      id, title, bookmarks(count)
    `).limit(5);

    const { data: latestUsers } = await supabase.from("users").select("id, username, created_at").order("created_at", { ascending: false }).limit(5);

    res.json({
      totalUsers,
      totalManhwa,
      totalChapters,
      totalTransactions,
      popularManhwa: popularManhwaData?.map((m: any) => ({ ...m, bookmark_count: m.bookmarks?.[0]?.count || 0 })) || [],
      latestUsers
    });
  });

  app.get("/api/admin/transactions", authenticateToken, isSuperAdmin, async (req, res) => {
    if (!isSupabaseConfigured) return res.json([]);
    const { data: transactions, error } = await supabase
      .from("coin_transactions")
      .select("*, users(username)")
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(transactions.map((t: any) => ({ ...t, username: t.users?.username })));
  });

  app.patch("/api/users/:id/role", authenticateToken, isSuperAdmin, async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const { role } = req.body;
    if (!['admin', 'assistant_admin', 'user'].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const { error } = await supabase.from("users").update({ role }).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    io.emit("user_updated", { id: req.params.id, role });
    res.json({ success: true });
  });

  app.patch("/api/users/:id/coins", authenticateToken, isSuperAdmin, async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const { amount, type, description } = req.body;
    const userId = req.params.id;

    try {
      // Fetch current coins
      const { data: user } = await supabase.from("users").select("coins").eq("id", userId).maybeSingle();
      if (!user) throw new Error("User not found");

      const newCoins = (user.coins || 0) + amount;
      
      // Update user coins
      await supabase.from("users").update({ coins: newCoins }).eq("id", userId);
      
      // Log transaction
      await supabase.from("coin_transactions").insert({
        user_id: userId, amount, type: type || (amount > 0 ? 'add' : 'spend'), description: description || 'Admin adjustment'
      });

      io.emit("user_updated", { id: userId, coins: newCoins });
      res.json({ success: true, coins: newCoins });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to update coins" });
    }
  });

  // Manhwa
  app.get("/api/manhwa", async (req, res) => {
    if (!isSupabaseConfigured) {
      console.log("Supabase not configured, returning mock manhwas");
      return res.json(mockManhwas);
    }

    try {
      const { data: manhwas, error } = await supabase
        .from("manhwa")
        .select(`
          *,
          manhwa_genres(genres(name))
        `)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "manhwa" does not exist')) {
          return res.status(500).json({ 
            error: "Database tables missing", 
            details: "The 'manhwa' table does not exist in Supabase. Please run the SQL script in supabase_schema.sql in your Supabase SQL Editor." 
          });
        }
        throw error;
      }

      if (!manhwas) {
        return res.json([]);
      }

      const results = [];
      for (const m of manhwas) {
        const { data: latestChapters, error: chapterError } = await supabase
          .from("chapters")
          .select("id, chapter_number, title, coin_price, created_at")
          .eq("manga_id", m.id)
          .order("chapter_number", { ascending: false })
          .limit(2);

        if (chapterError) {
          // Silently fail or handle UI-side
        }

        results.push({
          ...m,
          genres: m.manhwa_genres?.map((mg: any) => mg.genres?.name).join(",") || "",
          latest_chapters: latestChapters || []
        });
      }
      
      res.json(results);
    } catch (err: any) {
      console.error("Failed to fetch manhwas:", err);
      res.status(500).json({ 
        error: "Internal server error", 
        details: err.message || "Unknown error" 
      });
    }
  });

  app.get("/api/manhwa/:id", async (req, res) => {
    if (!isSupabaseConfigured) {
      const manhwa = mockManhwas.find(m => m.id === req.params.id);
      if (!manhwa) return res.status(404).json({ error: "Manhwa not found" });
      return res.json({
        ...manhwa,
        chapters: manhwa.latest_chapters,
        genres: manhwa.genres.split(',')
      });
    }

    const { data: manhwa, error } = await supabase.from("manhwa").select("*").eq("id", req.params.id).maybeSingle();
    if (error || !manhwa) return res.status(404).json({ error: "Manhwa not found" });
    
    const { data: chapters } = await supabase.from("chapters").select("*").eq("manga_id", req.params.id).order("chapter_number", { ascending: false });
    const { data: genresData } = await supabase
      .from("manhwa_genres")
      .select("genres(name)")
      .eq("manga_id", req.params.id);
    
    res.json({ 
      ...manhwa, 
      chapters: chapters || [], 
      genres: genresData?.map((g: any) => g.genres?.name) || [] 
    });
  });

  app.post("/api/manhwa", authenticateToken, isAdmin, handleUpload("poster"), async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const { title, description, genres } = req.body;
    let poster = null;

    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        poster = await uploadToSupabase('posters', req.file.filename, fileBuffer, req.file.mimetype);
        // Clean up local file
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Failed to upload poster to Supabase:", err);
        return res.status(500).json({ error: "Failed to upload poster to storage" });
      }
    }
    
    const { data: manga, error } = await supabase.from("manhwa").insert({ title, description, poster }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    
    const mangaId = manga.id;
    
    if (genres) {
      const genreList = JSON.parse(genres);
      for (const genreName of genreList) {
        let { data: genre } = await supabase.from("genres").select("id").eq("name", genreName).maybeSingle();
        if (!genre) {
          const { data: newGenre } = await supabase.from("genres").insert({ name: genreName }).select().single();
          genre = newGenre;
        }
        if (genre) {
          await supabase.from("manhwa_genres").insert({ manga_id: mangaId, genre_id: genre.id });
        }
      }
    }
    io.emit("update", { type: "manhwa_added", data: { id: mangaId, title } });
    res.json({ id: mangaId });
  });

  app.put("/api/manhwa/:id", authenticateToken, isAdmin, handleUpload("poster"), async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const { title, description, genres } = req.body;
    const mangaId = req.params.id;
    
    const { data: currentManhwa } = await supabase.from("manhwa").select("*").eq("id", mangaId).maybeSingle();
    if (!currentManhwa) return res.status(404).json({ error: "Manhwa not found" });

    let poster = currentManhwa.poster;
    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        poster = await uploadToSupabase('posters', req.file.filename, fileBuffer, req.file.mimetype);
        // Clean up local file
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Failed to upload poster to Supabase:", err);
        return res.status(500).json({ error: "Failed to upload poster to storage" });
      }
    }

    await supabase.from("manhwa").update({ title, description, poster }).eq("id", mangaId);

    if (genres) {
      const genreList = JSON.parse(genres);
      // Clear existing genres
      await supabase.from("manhwa_genres").delete().eq("manga_id", mangaId);
      
      for (const genreName of genreList) {
        let { data: genre } = await supabase.from("genres").select("id").eq("name", genreName).maybeSingle();
        if (!genre) {
          const { data: newGenre } = await supabase.from("genres").insert({ name: genreName }).select().single();
          genre = newGenre;
        }
        if (genre) {
          await supabase.from("manhwa_genres").insert({ manga_id: mangaId, genre_id: genre.id });
        }
      }
    }

    io.emit("update", { type: "manhwa_updated", data: { id: mangaId, title } });
    res.json({ id: mangaId });
  });

  app.delete("/api/manhwa/:id", authenticateToken, isAdmin, async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const mangaId = req.params.id;
    const { data: manhwa } = await supabase.from("manhwa").select("*").eq("id", mangaId).maybeSingle();
    if (!manhwa) return res.status(404).json({ error: "Manhwa not found" });

    // Delete poster file if it's local
    if (manhwa.poster && manhwa.poster.startsWith('/uploads')) {
      const posterPath = path.join(__dirname, manhwa.poster);
      if (fs.existsSync(posterPath)) {
        try { fs.unlinkSync(posterPath); } catch (e) {}
      }
    } else if (manhwa.poster && manhwa.poster.includes(supabaseUrl || "")) {
      // Delete from Supabase Storage
      const posterFileName = manhwa.poster.split('/').pop();
      if (posterFileName) {
        await deleteFromSupabase('posters', [posterFileName]);
      }
    }

    // Delete all chapters and their pages
    const { data: chapters } = await supabase.from("chapters").select("id").eq("manga_id", mangaId);
    if (chapters) {
      for (const c of chapters) {
        const chapterDir = path.join(__dirname, `uploads/chapters/${c.id}`);
        if (fs.existsSync(chapterDir)) {
          try { fs.rmSync(chapterDir, { recursive: true, force: true }); } catch (e) {}
        }
      }
    }

    await supabase.from("manhwa").delete().eq("id", mangaId);
    io.emit("update", { type: "manhwa_deleted", data: { id: mangaId } });
    res.sendStatus(200);
  });

  // Settings
  app.get("/api/settings/:key", async (req, res) => {
    if (!isSupabaseConfigured) {
      if (req.params.key === 'hero_banner') return res.json(mockHero);
      return res.status(404).json({ error: "Setting not found" });
    }

    const { data: row, error } = await supabase.from("settings").select("value").eq("key", req.params.key).maybeSingle();
    if (error || !row) return res.status(404).json({ error: "Setting not found" });
    res.json(JSON.parse(row.value));
  });

  app.put("/api/settings/:key", authenticateToken, isAdmin, handleUpload("image"), async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const key = req.params.key;
    let value: any;
    try {
      value = JSON.parse(req.body.value);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON value" });
    }

    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const imageUrl = await uploadToSupabase('banners', req.file.filename, fileBuffer, req.file.mimetype);
        value.image = imageUrl;
        // Clean up local file
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Failed to upload banner to Supabase:", err);
        return res.status(500).json({ error: "Failed to upload banner to storage" });
      }
    }

    await supabase.from("settings").update({ value: JSON.stringify(value) }).eq("key", key);
    io.emit("settings_updated", { key, value });
    res.json(value);
  });

  // Chapters & PDF Processing
  app.post("/api/manhwa/:id/chapters", authenticateToken, isAdmin, handleUpload("pdf"), async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const { chapter_number, title, coin_price } = req.body;
    const mangaId = req.params.id;
    const pdfPath = req.file?.path;

    if (!pdfPath) {
      console.error("Chapter upload failed: No PDF file provided in request.");
      return res.status(400).json({ error: "PDF file is required for chapter upload." });
    }

    try {
      // Validate chapter number
      if (!chapter_number || isNaN(Number(chapter_number))) {
        console.error(`Chapter upload failed: Invalid chapter number received: ${chapter_number}`);
        throw new Error("Invalid chapter number. Please provide a valid numeric value.");
      }

      // Check if file exists and is readable
      if (!fs.existsSync(pdfPath)) {
        console.error(`Chapter upload failed: File not found at path: ${pdfPath}`);
        throw new Error("Uploaded file could not be found on the server.");
      }

      const stats = fs.statSync(pdfPath);
      if (stats.size === 0) {
        console.error(`Chapter upload failed: Uploaded file is empty: ${pdfPath}`);
        throw new Error("The uploaded PDF file is empty.");
      }

      const { data: chapter, error: chapterError } = await supabase.from("chapters").insert({
        manga_id: mangaId, chapter_number, title, coin_price: Number(coin_price) || 0
      }).select().single();
      
      if (chapterError || !chapter) throw chapterError || new Error("Failed to create chapter record");
      
      const chapterId = chapter.id;

      // Dynamic imports for risky dependencies
      let pdfjs: any;
      let createCanvas: any;
      try {
        // Try multiple possible paths for pdfjs-dist
        try {
          pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        } catch (e) {
          try {
            pdfjs = await import("pdfjs-dist/build/pdf.mjs");
          } catch (e2) {
            pdfjs = await import("pdfjs-dist");
          }
        }
        const canvasModule = await import("canvas");
        createCanvas = canvasModule.createCanvas;
      } catch (importErr) {
        console.error("CRITICAL: Failed to load PDF processing libraries:", importErr);
        throw new Error("Server configuration error: PDF processing engine is currently unavailable. Please contact administrator.");
      }

      // PDF to PNG conversion
      let data: Uint8Array;
      try {
        data = new Uint8Array(fs.readFileSync(pdfPath));
      } catch (readErr) {
        console.error(`Chapter upload failed: Error reading file from disk (${pdfPath}):`, readErr);
        throw new Error("Failed to read the uploaded PDF file from server storage.");
      }

      const loadingTask = pdfjs.getDocument({ 
        data,
        disableWorker: true,
        verbosity: 0
      });

      let pdf: any;
      try {
        pdf = await loadingTask.promise;
      } catch (pdfErr: any) {
        console.error(`Chapter upload failed: PDF parsing error for file ${pdfPath}:`, pdfErr);
        // Check for specific PDF.js error messages if possible
        const msg = pdfErr.message || "";
        if (msg.includes("Invalid PDF structure") || msg.includes("format error")) {
          throw new Error("The uploaded file is not a valid PDF document. Please ensure you are uploading a standard PDF file.");
        }
        throw new Error("Failed to parse the PDF document. It might be corrupted or password-protected.");
      }
      
      const chapterDir = `uploads/chapters/${chapterId}`;
      if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          
          // Ultra High Quality Settings with Safety Limits
          const MAX_DIMENSION = 10240; 
          const baseViewport = page.getViewport({ scale: 1.0 });
          let scale = 5.0; // Increased from 4.0 for ultra quality

          if (baseViewport.width * scale > MAX_DIMENSION || baseViewport.height * scale > MAX_DIMENSION) {
            scale = Math.min(MAX_DIMENSION / baseViewport.width, MAX_DIMENSION / baseViewport.height);
          }
          
          const viewport = page.getViewport({ scale });
          
          let canvas;
          try {
            canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
          } catch (e) {
            const fallbackViewport = page.getViewport({ scale: 1.5 });
            canvas = createCanvas(Math.floor(fallbackViewport.width), Math.floor(fallbackViewport.height));
          }
          
          const context = canvas.getContext('2d');
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';

          await page.render({
            canvasContext: context as any,
            viewport: canvas.width / baseViewport.width === scale ? viewport : page.getViewport({ scale: canvas.width / baseViewport.width }),
            intent: 'print'
          }).promise;

          const buffer = canvas.toBuffer('image/png');
          const fileName = `page-${i}.png`;
          const storagePath = `${chapterId}/${fileName}`;
          
          const imageUrl = await uploadToSupabase('chapters', storagePath, buffer, 'image/png');

          await supabase.from("pages").insert({
            chapter_id: chapterId, image_url: imageUrl, page_number: i
          });
        } catch (pageErr) {
          console.error(`Error processing page ${i} of chapter ${chapterId}:`, pageErr);
          // We continue with other pages if one fails
        }
      }

      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); 
      io.emit("update", { type: "chapter_added", data: { mangaId, chapterId, chapter_number } });
      res.json({ id: chapterId });
    } catch (error: any) {
      console.error("Chapter processing error:", error);
      if (pdfPath && fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
        } catch (unlinkErr) {
          console.error("Failed to delete temporary PDF after error:", unlinkErr);
        }
      }
      res.status(500).json({ error: error.message || "An unexpected error occurred while processing the PDF." });
    }
  });

  app.get("/api/chapters/:id", async (req, res) => {
    if (!isSupabaseConfigured) {
      // Find mock chapter
      const manhwa = mockManhwas.find(m => m.latest_chapters.some(c => c.id === req.params.id));
      const chapter = manhwa?.latest_chapters.find(c => c.id === req.params.id);
      if (!chapter) return res.status(404).json({ error: "Chapter not found" });
      return res.json({ ...chapter, pages: [] });
    }
    const { data: chapter, error } = await supabase.from("chapters").select("*").eq("id", req.params.id).maybeSingle();
    if (error || !chapter) return res.status(404).json({ error: "Chapter not found" });
    const { data: pages } = await supabase.from("pages").select("*").eq("chapter_id", req.params.id).order("page_number", { ascending: true });
    res.json({ ...chapter, pages: pages || [] });
  });

  app.post("/api/chapters/:id/purchase", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const chapterId = req.params.id;
    const userId = req.user.id;

    const { data: chapter } = await supabase.from("chapters").select("*").eq("id", chapterId).maybeSingle();
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });

    if (chapter.coin_price === 0) return res.json({ success: true, message: "Free chapter" });

    const { data: alreadyPurchased } = await supabase.from("user_chapters").select("*").eq("user_id", userId).eq("chapter_id", chapterId).maybeSingle();
    if (alreadyPurchased) return res.json({ success: true, message: "Already purchased" });

    const { data: user } = await supabase.from("users").select("coins").eq("id", userId).maybeSingle();
    if (!user || user.coins < chapter.coin_price) return res.status(400).json({ error: "Not enough coins" });

    try {
      const newCoins = user.coins - chapter.coin_price;
      
      // Sequential updates (Supabase doesn't have multi-table transactions in client easily without RPC)
      await supabase.from("users").update({ coins: newCoins }).eq("id", userId);
      await supabase.from("user_chapters").insert({ user_id: userId, chapter_id: chapterId });
      await supabase.from("coin_transactions").insert({
        user_id: userId, amount: -chapter.coin_price, type: 'spend', description: `Purchased chapter ${chapter.chapter_number} of manga ID ${chapter.manga_id}`
      });

      res.json({ success: true, coins: newCoins });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Purchase failed" });
    }
  });

  app.get("/api/user/purchases", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.json([]);
    const { data: purchases } = await supabase.from("user_chapters").select("chapter_id").eq("user_id", req.user.id);
    res.json(purchases?.map((p: any) => p.chapter_id) || []);
  });

  app.patch("/api/chapters/:id/price", authenticateToken, isAdmin, async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const { coin_price } = req.body;
    await supabase.from("chapters").update({ coin_price }).eq("id", req.params.id);
    io.emit("update", { type: "chapter_price_updated", data: { id: req.params.id, coin_price } });
    res.json({ success: true });
  });

  app.get("/api/user/coins", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.json({ coins: 999999 });
    const { data: user } = await supabase.from("users").select("coins").eq("id", req.user.id).maybeSingle();
    res.json({ coins: user?.coins || 0 });
  });

  app.get("/api/user/transactions", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.json([]);
    const { data: transactions } = await supabase.from("coin_transactions").select("*").eq("user_id", req.user.id).order("created_at", { ascending: false });
    res.json(transactions || []);
  });

  app.post("/api/user/daily-reward", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const { data: lastReward } = await supabase
      .from("coin_transactions")
      .select("created_at")
      .eq("user_id", userId)
      .eq("type", "reward")
      .eq("description", "Daily login reward")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastReward) {
      const lastDate = new Date(lastReward.created_at).toISOString().split('T')[0];
      if (lastDate === today) {
        return res.status(400).json({ error: "Daily reward already claimed today" });
      }
    }

    const rewardAmount = 10;
    try {
      const { data: user } = await supabase.from("users").select("coins").eq("id", userId).maybeSingle();
      const newCoins = (user?.coins || 0) + rewardAmount;
      
      await supabase.from("users").update({ coins: newCoins }).eq("id", userId);
      await supabase.from("coin_transactions").insert({
        user_id: userId, amount: rewardAmount, type: 'reward', description: 'Daily login reward'
      });

      res.json({ success: true, amount: rewardAmount });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to claim reward" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    if (!isSupabaseConfigured) {
      return res.json([
        { id: "1", username: "Admin (Mock)", coins: 999999 },
        { id: "2", username: "User1", coins: 5000 },
        { id: "3", username: "User2", coins: 2500 }
      ]);
    }
    const { data: leaderboard } = await supabase.from("users").select("id, username, coins").order("coins", { ascending: false }).limit(10);
    res.json(leaderboard || []);
  });

  app.delete("/api/chapters/:id", authenticateToken, isAdmin, async (req, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const chapterId = req.params.id;
    const { data: chapter } = await supabase.from("chapters").select("*").eq("id", chapterId).maybeSingle();
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });
    
    // Delete local files if they exist
    const chapterDir = `uploads/chapters/${chapterId}`;
    if (fs.existsSync(chapterDir)) {
      try { fs.rmSync(chapterDir, { recursive: true, force: true }); } catch (e) {}
    }

    // Delete from Supabase Storage
    const { data: pages } = await supabase.from("pages").select("image_url").eq("chapter_id", chapterId);
    if (pages && pages.length > 0) {
      const pathsToDelete = pages
        .map(p => {
          if (p.image_url.includes(supabaseUrl || "")) {
            // Extract path after bucket name
            // URL format: .../storage/v1/object/public/chapters/CHAPTER_ID/page-1.png
            const parts = p.image_url.split('/chapters/');
            return parts.length > 1 ? parts[1] : null;
          }
          return null;
        })
        .filter((p): p is string => p !== null);
      
      if (pathsToDelete.length > 0) {
        await deleteFromSupabase('chapters', pathsToDelete);
      }
    }
    
    await supabase.from("chapters").delete().eq("id", chapterId);
    res.sendStatus(200);
  });

  // Comments
  app.get("/api/manhwa/:id/comments", async (req, res) => {
    if (!isSupabaseConfigured) return res.json([]);
    const { data: comments } = await supabase
      .from("comments")
      .select("*, users(username)")
      .eq("manga_id", req.params.id)
      .order("created_at", { ascending: false });
    
    res.json(comments?.map((c: any) => ({ ...c, username: c.users?.username })) || []);
  });

  app.post("/api/manhwa/:id/comments", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const { comment } = req.body;
    const { data: insertedComment, error } = await supabase.from("comments").insert({
      user_id: req.user.id, manga_id: req.params.id, comment
    }).select().single();
    
    if (error) return res.status(500).json({ error: error.message });

    const { data: newComment } = await supabase
      .from("comments")
      .select("*, users(username)")
      .eq("id", insertedComment.id)
      .maybeSingle();

    const formattedComment = { ...newComment, username: newComment.users?.username };
    io.emit("new_comment", { mangaId: req.params.id, comment: formattedComment });
    res.json(formattedComment);
  });

  app.delete("/api/comments/:id", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    const { data: comment } = await supabase.from("comments").select("*").eq("id", req.params.id).maybeSingle();
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (req.user.role !== 'admin' && req.user.role !== 'assistant_admin' && comment.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
    
    await supabase.from("comments").delete().eq("id", req.params.id);
    io.emit("comment_deleted", { commentId: req.params.id, mangaId: comment.manga_id });
    res.sendStatus(200);
  });

  // Bookmarks
  app.post("/api/manhwa/:id/bookmark", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.status(503).json({ error: "Database not configured" });
    try {
      const { data: existing } = await supabase.from("bookmarks").select("*").eq("user_id", req.user.id).eq("manga_id", req.params.id).maybeSingle();
      if (existing) {
        await supabase.from("bookmarks").delete().eq("user_id", req.user.id).eq("manga_id", req.params.id);
        res.json({ removed: true });
      } else {
        await supabase.from("bookmarks").insert({ user_id: req.user.id, manga_id: req.params.id });
        res.sendStatus(200);
      }
    } catch (e) {
      res.status(500).json({ error: "Bookmark operation failed" });
    }
  });

  app.get("/api/user/bookmarks", authenticateToken, async (req: any, res) => {
    if (!isSupabaseConfigured) return res.json([]);
    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select("manhwa(*)")
      .eq("user_id", req.user.id);
    
    res.json(bookmarks?.map((b: any) => b.manhwa) || []);
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error", message: err.message });
  });

  // API 404 handler
  app.all("/api/*", (req, res) => {
    res.status(404).json({ 
      error: "API route not found", 
      method: req.method,
      path: req.originalUrl 
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    // Start listening immediately
    const PORT = 3000;
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });

    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to start Vite server:", e);
    }
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist/index.html")));
    
    const PORT = 3000;
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Production server listening on http://0.0.0.0:${PORT}`);
    });
  }

  return httpServer;
}

startServer().catch(err => {
  console.error("CRITICAL: Server failed to start:", err);
});
