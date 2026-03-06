console.log("Server script starting...");
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
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL: Supabase URL or Anon Key is missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables.");
  console.log("You can find these in your Supabase Project Settings -> API.");
}

const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

console.log("Supabase client initialized.");

// Initialize tables and seed data (Supabase handles tables, but we can seed if needed)
async function initializeDatabase() {
  console.log("Checking Supabase connection and tables...");
  try {
    // Basic connectivity check - check for 'settings' table
    const { data: testData, error: testError } = await supabase.from("settings").select("key").limit(1);
    if (testError) {
      console.error("Supabase connection check failed. Table 'settings' might not exist:", testError.message);
      console.log("CRITICAL: Database tables are missing. Please run the SQL script in 'supabase_schema.sql' in your Supabase SQL Editor to create them.");
      return;
    }
    console.log("Supabase connection successful. 'settings' table found.");

    // Seed default settings if not exists
    const defaultHero = {
      title: "Solo Leveling: Ragnarok",
      description: "The legend continues. Sung Jin-woo's son, Sung Su-ho, awakens his powers in a world where the gates have reopened...",
      image: "https://picsum.photos/seed/manhwa-hero/1920/1080",
      button_text: "Read Now",
      link: "/manhwa/1"
    };

    const { data: existingHero } = await supabase.from("settings").select("*").eq("key", "hero_banner").single();
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
          let { data: genre } = await supabase.from("genres").select("id").eq("name", genreName).single();
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
      console.log("Sample manhwa seeded successfully.");
    }

    // Seed Admin if not exists
    const adminEmail = "yt918859@gmail.com";
    const adminPassword = "bro2009";
    const { data: existingAdmin } = await supabase.from("users").select("*").eq("email", adminEmail).single();
    if (!existingAdmin) {
      const hashedPassword = bcrypt.hashSync(adminPassword, 10);
      await supabase.from("users").insert({
        username: "Admin", email: adminEmail, password: hashedPassword, role: "admin"
      });
    }
  } catch (err) {
    console.error("Database seeding failed:", err);
  }
}

initializeDatabase();

// --- Express & Socket.io Setup ---
async function startServer() {
  console.log("Starting server...");
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;
  const JWT_SECRET = process.env.JWT_SECRET || "manga-secret-key";

  io.on("connection", (socket) => {
    console.log(`New socket connection: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  app.use(express.json());
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
  app.use("/uploads", express.static("uploads"));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Ensure uploads directory exists
  const dirs = ["uploads", "uploads/posters", "uploads/chapters", "uploads/temp", "uploads/banners"];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
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

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'assistant_admin') return res.sendStatus(403);
    next();
  };

  const isSuperAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    next();
  };

  // --- API Routes ---

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
  app.post("/api/auth/register", async (req, res) => {
    const { username, email, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const { data, error } = await supabase.from("users").insert({ username, email, password: hashedPassword }).select().single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e) {
      res.status(400).json({ error: "User already exists or registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const { data: user, error } = await supabase.from("users").select("*").eq("email", email).single();
    
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, role: user.role, coins: user.coins } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // User Management (Super Admin only)
  app.get("/api/admin/users", authenticateToken, isSuperAdmin, async (req, res) => {
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
    const { data: transactions, error } = await supabase
      .from("coin_transactions")
      .select("*, users(username)")
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(transactions.map((t: any) => ({ ...t, username: t.users?.username })));
  });

  app.patch("/api/users/:id/role", authenticateToken, isSuperAdmin, async (req, res) => {
    const { role } = req.body;
    if (!['admin', 'assistant_admin', 'user'].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const { error } = await supabase.from("users").update({ role }).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    io.emit("user_updated", { id: req.params.id, role });
    res.json({ success: true });
  });

  app.patch("/api/users/:id/coins", authenticateToken, isSuperAdmin, async (req, res) => {
    const { amount, type, description } = req.body;
    const userId = req.params.id;

    try {
      // Fetch current coins
      const { data: user } = await supabase.from("users").select("coins").eq("id", userId).single();
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
    console.log("GET /api/manhwa request received");
    try {
      const { data: manhwas, error } = await supabase
        .from("manhwa")
        .select(`
          *,
          manhwa_genres(genres(name))
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching manhwa:", error);
        if (error.code === 'PGRST116' || error.message.includes('relation "manhwa" does not exist')) {
          return res.status(500).json({ 
            error: "Database tables missing", 
            details: "The 'manhwa' table does not exist in Supabase. Please run the SQL script in supabase_schema.sql in your Supabase SQL Editor." 
          });
        }
        throw error;
      }

      if (!manhwas) {
        console.log("No manhwas found in database");
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
          console.warn(`Error fetching chapters for manhwa ${m.id}:`, chapterError);
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
    const { data: manhwa, error } = await supabase.from("manhwa").select("*").eq("id", req.params.id).single();
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
    const { title, description, genres } = req.body;
    const poster = req.file ? `/uploads/posters/${req.file.filename}` : null;
    
    const { data: manga, error } = await supabase.from("manhwa").insert({ title, description, poster }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    
    const mangaId = manga.id;
    
    if (genres) {
      const genreList = JSON.parse(genres);
      for (const genreName of genreList) {
        let { data: genre } = await supabase.from("genres").select("id").eq("name", genreName).single();
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
    const { title, description, genres } = req.body;
    const mangaId = req.params.id;
    
    const { data: currentManhwa } = await supabase.from("manhwa").select("*").eq("id", mangaId).single();
    if (!currentManhwa) return res.status(404).json({ error: "Manhwa not found" });

    const poster = req.file ? `/uploads/posters/${req.file.filename}` : currentManhwa.poster;

    await supabase.from("manhwa").update({ title, description, poster }).eq("id", mangaId);

    if (genres) {
      const genreList = JSON.parse(genres);
      // Clear existing genres
      await supabase.from("manhwa_genres").delete().eq("manga_id", mangaId);
      
      for (const genreName of genreList) {
        let { data: genre } = await supabase.from("genres").select("id").eq("name", genreName).single();
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
    const mangaId = req.params.id;
    const { data: manhwa } = await supabase.from("manhwa").select("*").eq("id", mangaId).single();
    if (!manhwa) return res.status(404).json({ error: "Manhwa not found" });

    // Delete poster file if exists
    if (manhwa.poster && manhwa.poster.startsWith('/uploads')) {
      const posterPath = path.join(__dirname, manhwa.poster);
      if (fs.existsSync(posterPath)) {
        try { fs.unlinkSync(posterPath); } catch (e) {}
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
    const { data: row, error } = await supabase.from("settings").select("value").eq("key", req.params.key).single();
    if (error || !row) return res.status(404).json({ error: "Setting not found" });
    res.json(JSON.parse(row.value));
  });

  app.put("/api/settings/:key", authenticateToken, isAdmin, handleUpload("image"), async (req, res) => {
    const key = req.params.key;
    let value: any;
    try {
      value = JSON.parse(req.body.value);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON value" });
    }

    if (req.file) {
      const targetDir = "uploads/banners";
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, req.file.filename);
      fs.renameSync(req.file.path, targetPath);
      value.image = `/uploads/banners/${req.file.filename}`;
    }

    await supabase.from("settings").update({ value: JSON.stringify(value) }).eq("key", key);
    io.emit("settings_updated", { key, value });
    res.json(value);
  });

  // Chapters & PDF Processing
  app.post("/api/manhwa/:id/chapters", authenticateToken, isAdmin, handleUpload("pdf"), async (req, res) => {
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

      console.log(`Processing chapter ${chapter_number} for manhwa ${mangaId} (Chapter ID: ${chapterId})`);

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
      
      console.log(`PDF loaded successfully. Total pages: ${pdf.numPages}`);

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
            console.warn(`Canvas creation failed at scale ${scale} for page ${i}, falling back to 1.5x`);
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
          const filePath = path.join(chapterDir, fileName);
          fs.writeFileSync(filePath, buffer);

          await supabase.from("pages").insert({
            chapter_id: chapterId, image_url: `/${filePath}`, page_number: i
          });
        } catch (pageErr) {
          console.error(`Error processing page ${i} of chapter ${chapterId}:`, pageErr);
          // We continue with other pages if one fails
        }
      }

      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); 
      console.log(`Chapter ${chapter_number} processed successfully. ID: ${chapterId}`);
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
    const { data: chapter, error } = await supabase.from("chapters").select("*").eq("id", req.params.id).single();
    if (error || !chapter) return res.status(404).json({ error: "Chapter not found" });
    const { data: pages } = await supabase.from("pages").select("*").eq("chapter_id", req.params.id).order("page_number", { ascending: true });
    res.json({ ...chapter, pages: pages || [] });
  });

  app.post("/api/chapters/:id/purchase", authenticateToken, async (req: any, res) => {
    const chapterId = req.params.id;
    const userId = req.user.id;

    const { data: chapter } = await supabase.from("chapters").select("*").eq("id", chapterId).single();
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });

    if (chapter.coin_price === 0) return res.json({ success: true, message: "Free chapter" });

    const { data: alreadyPurchased } = await supabase.from("user_chapters").select("*").eq("user_id", userId).eq("chapter_id", chapterId).single();
    if (alreadyPurchased) return res.json({ success: true, message: "Already purchased" });

    const { data: user } = await supabase.from("users").select("coins").eq("id", userId).single();
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
    const { data: purchases } = await supabase.from("user_chapters").select("chapter_id").eq("user_id", req.user.id);
    res.json(purchases?.map((p: any) => p.chapter_id) || []);
  });

  app.patch("/api/chapters/:id/price", authenticateToken, isAdmin, async (req, res) => {
    const { coin_price } = req.body;
    await supabase.from("chapters").update({ coin_price }).eq("id", req.params.id);
    io.emit("update", { type: "chapter_price_updated", data: { id: req.params.id, coin_price } });
    res.json({ success: true });
  });

  app.get("/api/user/coins", authenticateToken, async (req: any, res) => {
    const { data: user } = await supabase.from("users").select("coins").eq("id", req.user.id).single();
    res.json({ coins: user?.coins || 0 });
  });

  app.get("/api/user/transactions", authenticateToken, async (req: any, res) => {
    const { data: transactions } = await supabase.from("coin_transactions").select("*").eq("user_id", req.user.id).order("created_at", { ascending: false });
    res.json(transactions || []);
  });

  app.post("/api/user/daily-reward", authenticateToken, async (req: any, res) => {
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
      const { data: user } = await supabase.from("users").select("coins").eq("id", userId).single();
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
    const { data: leaderboard } = await supabase.from("users").select("id, username, coins").order("coins", { ascending: false }).limit(10);
    res.json(leaderboard || []);
  });

  app.delete("/api/chapters/:id", authenticateToken, isAdmin, async (req, res) => {
    const { data: chapter } = await supabase.from("chapters").select("*").eq("id", req.params.id).single();
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });
    
    // Delete files
    const chapterDir = `uploads/chapters/${req.params.id}`;
    if (fs.existsSync(chapterDir)) {
      fs.rmSync(chapterDir, { recursive: true, force: true });
    }
    
    await supabase.from("chapters").delete().eq("id", req.params.id);
    res.sendStatus(200);
  });

  // Comments
  app.get("/api/manhwa/:id/comments", async (req, res) => {
    const { data: comments } = await supabase
      .from("comments")
      .select("*, users(username)")
      .eq("manga_id", req.params.id)
      .order("created_at", { ascending: false });
    
    res.json(comments?.map((c: any) => ({ ...c, username: c.users?.username })) || []);
  });

  app.post("/api/manhwa/:id/comments", authenticateToken, async (req: any, res) => {
    const { comment } = req.body;
    const { data: insertedComment, error } = await supabase.from("comments").insert({
      user_id: req.user.id, manga_id: req.params.id, comment
    }).select().single();
    
    if (error) return res.status(500).json({ error: error.message });

    const { data: newComment } = await supabase
      .from("comments")
      .select("*, users(username)")
      .eq("id", insertedComment.id)
      .single();

    const formattedComment = { ...newComment, username: newComment.users?.username };
    io.emit("new_comment", { mangaId: req.params.id, comment: formattedComment });
    res.json(formattedComment);
  });

  app.delete("/api/comments/:id", authenticateToken, async (req: any, res) => {
    const { data: comment } = await supabase.from("comments").select("*").eq("id", req.params.id).single();
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (req.user.role !== 'admin' && req.user.role !== 'assistant_admin' && comment.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
    
    await supabase.from("comments").delete().eq("id", req.params.id);
    io.emit("comment_deleted", { commentId: req.params.id, mangaId: comment.manga_id });
    res.sendStatus(200);
  });

  // Bookmarks
  app.post("/api/manhwa/:id/bookmark", authenticateToken, async (req: any, res) => {
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
    console.log(`API 404: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: "API route not found", 
      method: req.method,
      path: req.originalUrl 
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware integrated.");
    } catch (e) {
      console.error("Failed to start Vite server:", e);
    }
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist/index.html")));
  }

  return httpServer;
}

startServer().then((httpServer) => {
  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("CRITICAL: Server failed to start:", err);
});
