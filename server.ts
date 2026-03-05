import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// --- Database Setup ---
let db: any;
try {
  db = new Database("manga.db");
  db.pragma("journal_mode = WAL");
} catch (err) {
  console.error("Database initialization failed:", err);
}

// Initialize tables
if (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      coins INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_chapters (
      user_id INTEGER,
      chapter_id INTEGER,
      PRIMARY KEY(user_id, chapter_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS manhwa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      poster TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manga_id INTEGER,
      chapter_number REAL,
      title TEXT,
      coin_price INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(manga_id) REFERENCES manhwa(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER,
      image_url TEXT,
      page_number INTEGER,
      FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS manhwa_genres (
      manga_id INTEGER,
      genre_id INTEGER,
      PRIMARY KEY(manga_id, genre_id),
      FOREIGN KEY(manga_id) REFERENCES manhwa(id) ON DELETE CASCADE,
      FOREIGN KEY(genre_id) REFERENCES genres(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER,
      manga_id INTEGER,
      PRIMARY KEY(user_id, manga_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(manga_id) REFERENCES manhwa(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      manga_id INTEGER,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(manga_id) REFERENCES manhwa(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed default settings
  const defaultHero = {
    title: "Solo Leveling: Ragnarok",
    description: "The legend continues. Sung Jin-woo's son, Sung Su-ho, awakens his powers in a world where the gates have reopened...",
    image: "https://picsum.photos/seed/manhwa-hero/1920/1080",
    button_text: "Read Now",
    link: "/manhwa/1"
  };

  const existingHero = db.prepare("SELECT * FROM settings WHERE key = ?").get("hero_banner");
  if (!existingHero) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("hero_banner", JSON.stringify(defaultHero));
  }

  // Migration: Add created_at to chapters if missing
  try {
    const tableInfo = db.prepare("PRAGMA table_info(chapters)").all();
    const hasCreatedAt = tableInfo.some((col: any) => col.name === 'created_at');
    if (!hasCreatedAt) {
      db.prepare("ALTER TABLE chapters ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
      console.log("Migration: Added created_at column to chapters table.");
    }
  } catch (err) {
    console.error("Migration failed for chapters table:", err);
  }

  // Migration: Add coins to users if missing
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasCoins = tableInfo.some((col: any) => col.name === 'coins');
    if (!hasCoins) {
      db.prepare("ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0").run();
      console.log("Migration: Added coins column to users table.");
    }
  } catch (err) {
    console.error("Migration failed for users table (coins):", err);
  }

  // Migration: Add coin_price to chapters if missing
  try {
    const tableInfo = db.prepare("PRAGMA table_info(chapters)").all();
    const hasCoinPrice = tableInfo.some((col: any) => col.name === 'coin_price');
    if (!hasCoinPrice) {
      db.prepare("ALTER TABLE chapters ADD COLUMN coin_price INTEGER DEFAULT 0").run();
      console.log("Migration: Added coin_price column to chapters table.");
    }
  } catch (err) {
    console.error("Migration failed for chapters table (coin_price):", err);
  }

  // Migration: Remove is_vip from chapters if exists (optional but cleaner)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(chapters)").all();
    const hasIsVip = tableInfo.some((col: any) => col.name === 'is_vip');
    if (hasIsVip) {
      // SQLite doesn't support DROP COLUMN easily, so we just leave it or use it as a legacy
    }
  } catch (err) {}
}

// Seed Admin if not exists
if (db) {
  const adminEmail = "yt918859@gmail.com";
  const adminPassword = "bro2009";
  const existingAdmin = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)").run(
      "Admin", adminEmail, hashedPassword, "admin"
    );
  }
}

// --- Express & Socket.io Setup ---
async function startServer() {
  console.log("Starting server...");
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;
  const JWT_SECRET = process.env.JWT_SECRET || "manga-secret-key";

  app.use(express.json());
  app.use("/uploads", express.static("uploads"));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Ensure uploads directory exists
  if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
  if (!fs.existsSync("uploads/posters")) fs.mkdirSync("uploads/posters");
  if (!fs.existsSync("uploads/chapters")) fs.mkdirSync("uploads/chapters");

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "poster") cb(null, "uploads/posters");
      else if (file.fieldname === "pdf") cb(null, "uploads/temp");
      else cb(null, "uploads");
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    }
  });
  if (!fs.existsSync("uploads/temp")) fs.mkdirSync("uploads/temp");
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
  app.post("/api/auth/register", (req, res) => {
    const { username, email, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)").run(username, email, hashedPassword);
      res.json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "User already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, role: user.role, coins: user.coins } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // User Management (Super Admin only)
  app.get("/api/users/search/:id", authenticateToken, isSuperAdmin, (req, res) => {
    const user = db.prepare("SELECT id, username, email, role, coins FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.patch("/api/users/:id/role", authenticateToken, isSuperAdmin, (req, res) => {
    const { role } = req.body;
    if (!['admin', 'assistant_admin', 'user'].includes(role)) return res.status(400).json({ error: "Invalid role" });
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
    io.emit("user_updated", { id: req.params.id, role });
    res.json({ success: true });
  });

  app.patch("/api/users/:id/coins", authenticateToken, isSuperAdmin, (req, res) => {
    const { coins } = req.body;
    db.prepare("UPDATE users SET coins = ? WHERE id = ?").run(coins, req.params.id);
    io.emit("user_updated", { id: req.params.id, coins });
    res.json({ success: true });
  });

  // Manhwa
  app.get("/api/manhwa", (req, res) => {
    try {
      const manhwas = db.prepare(`
        SELECT m.*, GROUP_CONCAT(DISTINCT g.name) as genres,
        (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('id', id, 'chapter_number', chapter_number, 'title', title, 'coin_price', coin_price, 'created_at', created_at))
         FROM (SELECT id, chapter_number, title, coin_price, created_at FROM chapters WHERE manga_id = m.id ORDER BY chapter_number DESC LIMIT 2)) as latest_chapters
        FROM manhwa m 
        LEFT JOIN manhwa_genres mg ON m.id = mg.manga_id 
        LEFT JOIN genres g ON mg.genre_id = g.id 
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `).all();
      
      res.json(manhwas.map((m: any) => ({
        ...m,
        latest_chapters: JSON.parse(m.latest_chapters || '[]')
      })));
    } catch (err) {
      console.error("Failed to fetch manhwas:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/manhwa/:id", (req, res) => {
    const manhwa = db.prepare("SELECT * FROM manhwa WHERE id = ?").get(req.params.id);
    if (!manhwa) return res.sendStatus(404);
    const chapters = db.prepare("SELECT * FROM chapters WHERE manga_id = ? ORDER BY chapter_number DESC").all(req.params.id);
    const genres = db.prepare(`
      SELECT g.name FROM genres g 
      JOIN manhwa_genres mg ON g.id = mg.genre_id 
      WHERE mg.manga_id = ?
    `).all(req.params.id);
    res.json({ ...manhwa, chapters, genres: genres.map((g: any) => g.name) });
  });

  app.post("/api/manhwa", authenticateToken, isAdmin, handleUpload("poster"), (req, res) => {
    const { title, description, genres } = req.body;
    const poster = req.file ? `/uploads/posters/${req.file.filename}` : null;
    const result = db.prepare("INSERT INTO manhwa (title, description, poster) VALUES (?, ?, ?)").run(title, description, poster);
    const mangaId = result.lastInsertRowid;
    
    if (genres) {
      const genreList = JSON.parse(genres);
      genreList.forEach((genreName: string) => {
        let genre: any = db.prepare("SELECT id FROM genres WHERE name = ?").get(genreName);
        if (!genre) {
          const res = db.prepare("INSERT INTO genres (name) VALUES (?)").run(genreName);
          genre = { id: res.lastInsertRowid };
        }
        db.prepare("INSERT INTO manhwa_genres (manga_id, genre_id) VALUES (?, ?)").run(mangaId, genre.id);
      });
    }
    io.emit("update", { type: "manhwa_added", data: { id: mangaId, title } });
    res.json({ id: mangaId });
  });

  app.put("/api/manhwa/:id", authenticateToken, isAdmin, handleUpload("poster"), (req, res) => {
    const { title, description, genres } = req.body;
    const mangaId = req.params.id;
    
    const currentManhwa = db.prepare("SELECT * FROM manhwa WHERE id = ?").get(mangaId);
    if (!currentManhwa) return res.sendStatus(404);

    const poster = req.file ? `/uploads/posters/${req.file.filename}` : currentManhwa.poster;

    db.prepare("UPDATE manhwa SET title = ?, description = ?, poster = ? WHERE id = ?").run(
      title, description, poster, mangaId
    );

    if (genres) {
      const genreList = JSON.parse(genres);
      // Clear existing genres
      db.prepare("DELETE FROM manhwa_genres WHERE manga_id = ?").run(mangaId);
      
      genreList.forEach((genreName: string) => {
        let genre: any = db.prepare("SELECT id FROM genres WHERE name = ?").get(genreName);
        if (!genre) {
          const res = db.prepare("INSERT INTO genres (name) VALUES (?)").run(genreName);
          genre = { id: res.lastInsertRowid };
        }
        db.prepare("INSERT INTO manhwa_genres (manga_id, genre_id) VALUES (?, ?)").run(mangaId, genre.id);
      });
    }

    io.emit("update", { type: "manhwa_updated", data: { id: mangaId, title } });
    res.json({ id: mangaId });
  });

  app.delete("/api/manhwa/:id", authenticateToken, isAdmin, (req, res) => {
    const mangaId = req.params.id;
    const manhwa = db.prepare("SELECT * FROM manhwa WHERE id = ?").get(mangaId);
    if (!manhwa) return res.sendStatus(404);

    // Delete poster file if exists
    if (manhwa.poster) {
      const posterPath = path.join(__dirname, manhwa.poster);
      if (fs.existsSync(posterPath)) {
        try { fs.unlinkSync(posterPath); } catch (e) {}
      }
    }

    // Delete all chapters and their pages
    const chapters = db.prepare("SELECT id FROM chapters WHERE manga_id = ?").all(mangaId);
    chapters.forEach((c: any) => {
      const chapterDir = path.join(__dirname, `uploads/chapters/${c.id}`);
      if (fs.existsSync(chapterDir)) {
        try { fs.rmSync(chapterDir, { recursive: true, force: true }); } catch (e) {}
      }
    });

    db.prepare("DELETE FROM manhwa WHERE id = ?").run(mangaId);
    io.emit("update", { type: "manhwa_deleted", data: { id: mangaId } });
    res.sendStatus(200);
  });

  // Settings
  app.get("/api/settings/:key", (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(req.params.key);
    if (!row) return res.sendStatus(404);
    res.json(JSON.parse(row.value));
  });

  app.put("/api/settings/:key", authenticateToken, isAdmin, handleUpload("image"), (req, res) => {
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

    db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(JSON.stringify(value), key);
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

      const chapterResult = db.prepare("INSERT INTO chapters (manga_id, chapter_number, title, coin_price) VALUES (?, ?, ?, ?)").run(
        mangaId, chapter_number, title, Number(coin_price) || 0
      );
      const chapterId = chapterResult.lastInsertRowid;

      console.log(`Processing chapter ${chapter_number} for manhwa ${mangaId} (Chapter ID: ${chapterId})`);

      // Dynamic imports for risky dependencies
      let pdfjs: any;
      let createCanvas: any;
      try {
        pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
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

          db.prepare("INSERT INTO pages (chapter_id, image_url, page_number) VALUES (?, ?, ?)").run(
            chapterId, `/${filePath}`, i
          );
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

  app.get("/api/chapters/:id", (req, res) => {
    const chapter = db.prepare("SELECT * FROM chapters WHERE id = ?").get(req.params.id);
    if (!chapter) return res.sendStatus(404);
    const pages = db.prepare("SELECT * FROM pages WHERE chapter_id = ? ORDER BY page_number ASC").all(req.params.id);
    res.json({ ...chapter, pages });
  });

  app.post("/api/chapters/:id/purchase", authenticateToken, (req: any, res) => {
    const chapterId = req.params.id;
    const userId = req.user.id;

    const chapter: any = db.prepare("SELECT * FROM chapters WHERE id = ?").get(chapterId);
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });

    if (chapter.coin_price === 0) return res.json({ success: true, message: "Free chapter" });

    const alreadyPurchased = db.prepare("SELECT * FROM user_chapters WHERE user_id = ? AND chapter_id = ?").get(userId, chapterId);
    if (alreadyPurchased) return res.json({ success: true, message: "Already purchased" });

    const user: any = db.prepare("SELECT coins FROM users WHERE id = ?").get(userId);
    if (user.coins < chapter.coin_price) return res.status(400).json({ error: "Not enough coins" });

    db.transaction(() => {
      db.prepare("UPDATE users SET coins = coins - ? WHERE id = ?").run(chapter.coin_price, userId);
      db.prepare("INSERT INTO user_chapters (user_id, chapter_id) VALUES (?, ?)").run(userId, chapterId);
    })();

    res.json({ success: true, coins: user.coins - chapter.coin_price });
  });

  app.get("/api/user/purchases", authenticateToken, (req: any, res) => {
    const purchases = db.prepare("SELECT chapter_id FROM user_chapters WHERE user_id = ?").all(req.user.id);
    res.json(purchases.map((p: any) => p.chapter_id));
  });

  app.patch("/api/chapters/:id/price", authenticateToken, isAdmin, (req, res) => {
    const { coin_price } = req.body;
    db.prepare("UPDATE chapters SET coin_price = ? WHERE id = ?").run(coin_price, req.params.id);
    io.emit("update", { type: "chapter_price_updated", data: { id: req.params.id, coin_price } });
    res.json({ success: true });
  });

  app.get("/api/user/coins", authenticateToken, (req: any, res) => {
    const user = db.prepare("SELECT coins FROM users WHERE id = ?").get(req.user.id);
    res.json({ coins: user.coins });
  });

  app.delete("/api/chapters/:id", authenticateToken, isAdmin, (req, res) => {
    const chapter = db.prepare("SELECT * FROM chapters WHERE id = ?").get(req.params.id);
    if (!chapter) return res.sendStatus(404);
    
    // Delete files
    const chapterDir = `uploads/chapters/${req.params.id}`;
    if (fs.existsSync(chapterDir)) {
      fs.rmSync(chapterDir, { recursive: true, force: true });
    }
    
    db.prepare("DELETE FROM chapters WHERE id = ?").run(req.params.id);
    res.sendStatus(200);
  });

  // Comments
  app.get("/api/manhwa/:id/comments", (req, res) => {
    const comments = db.prepare(`
      SELECT c.*, u.username 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.manga_id = ? 
      ORDER BY c.created_at DESC
    `).all(req.params.id);
    res.json(comments);
  });

  app.post("/api/manhwa/:id/comments", authenticateToken, (req: any, res) => {
    const { comment } = req.body;
    const result = db.prepare("INSERT INTO comments (user_id, manga_id, comment) VALUES (?, ?, ?)").run(
      req.user.id, req.params.id, comment
    );
    const newComment = db.prepare(`
      SELECT c.*, u.username 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.id = ?
    `).get(result.lastInsertRowid);
    io.emit("new_comment", { mangaId: req.params.id, comment: newComment });
    res.json(newComment);
  });

  app.delete("/api/comments/:id", authenticateToken, (req: any, res) => {
    const comment: any = db.prepare("SELECT * FROM comments WHERE id = ?").get(req.params.id);
    if (!comment) return res.sendStatus(404);
    if (req.user.role !== 'admin' && comment.user_id !== req.user.id) return res.sendStatus(403);
    db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
    io.emit("comment_deleted", { commentId: req.params.id, mangaId: comment.manga_id });
    res.sendStatus(200);
  });

  // Bookmarks
  app.post("/api/manhwa/:id/bookmark", authenticateToken, (req: any, res) => {
    try {
      db.prepare("INSERT INTO bookmarks (user_id, manga_id) VALUES (?, ?)").run(req.user.id, req.params.id);
      res.sendStatus(200);
    } catch (e) {
      db.prepare("DELETE FROM bookmarks WHERE user_id = ? AND manga_id = ?").run(req.user.id, req.params.id);
      res.json({ removed: true });
    }
  });

  app.get("/api/user/bookmarks", authenticateToken, (req: any, res) => {
    const bookmarks = db.prepare(`
      SELECT m.* FROM manhwa m 
      JOIN bookmarks b ON m.id = b.manga_id 
      WHERE b.user_id = ?
    `).all(req.user.id);
    res.json(bookmarks);
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist/index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Server failed to start:", err);
});
