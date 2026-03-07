-- Supabase Database Schema for Manhwa Application

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- 'admin', 'assistant_admin', 'user'
    coins INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Manhwa Table
CREATE TABLE IF NOT EXISTS manhwa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    poster TEXT, -- Changed from cover_image to match server.ts
    author TEXT,
    artist TEXT,
    status TEXT DEFAULT 'Ongoing',
    release_year INTEGER,
    rating NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Genres Table
CREATE TABLE IF NOT EXISTS genres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL
);

-- 6. Create Manhwa-Genres Junction Table
CREATE TABLE IF NOT EXISTS manhwa_genres (
    manga_id UUID REFERENCES manhwa(id) ON DELETE CASCADE,
    genre_id UUID REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (manga_id, genre_id)
);

-- 7. Create Chapters Table
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manga_id UUID REFERENCES manhwa(id) ON DELETE CASCADE,
    chapter_number NUMERIC NOT NULL,
    title TEXT,
    coin_price INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create Pages Table
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create Coin Transactions Table
CREATE TABLE IF NOT EXISTS coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'add', 'spend', 'reward'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create User Chapters (Purchases) Table
CREATE TABLE IF NOT EXISTS user_chapters (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, chapter_id)
);

-- 11. Create Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    manga_id UUID REFERENCES manhwa(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, manga_id)
);

-- 12. Create Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    manga_id UUID REFERENCES manhwa(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Insert default genres
INSERT INTO genres (name) VALUES 
('Action'), ('Adventure'), ('Comedy'), ('Drama'), 
('Fantasy'), ('Horror'), ('Mystery'), ('Psychological'), 
('Romance'), ('Sci-Fi'), ('Slice of Life'), ('Supernatural'), 
('Thriller'), ('Martial Arts'), ('Isekai'), ('School Life')
ON CONFLICT (name) DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, value) VALUES 
('hero_banner', '{"title": "Welcome to Manhwa Catalog", "subtitle": "Read your favorite manhwa for free!", "image": "https://picsum.photos/seed/manhwa/1200/600", "link": "/catalog"}')
ON CONFLICT (key) DO NOTHING;

-- 14. Enable Row Level Security (RLS)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY; -- Disabled for now to allow seeding with anon key
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE manhwa ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE manhwa_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 15. Create Policies for Public Read Access
DROP POLICY IF EXISTS "Allow public read access for settings" ON settings;
CREATE POLICY "Allow public read access for settings" ON settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access for manhwa" ON manhwa;
CREATE POLICY "Allow public read access for manhwa" ON manhwa FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access for chapters" ON chapters;
CREATE POLICY "Allow public read access for chapters" ON chapters FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access for genres" ON genres;
CREATE POLICY "Allow public read access for genres" ON genres FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access for manhwa_genres" ON manhwa_genres;
CREATE POLICY "Allow public read access for manhwa_genres" ON manhwa_genres FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access for pages" ON pages;
CREATE POLICY "Allow public read access for pages" ON pages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access for comments" ON comments;
CREATE POLICY "Allow public read access for comments" ON comments FOR SELECT USING (true);

-- 16. Create Policies for Authenticated Access
DROP POLICY IF EXISTS "Allow users to read their own data" ON users;
CREATE POLICY "Allow users to read their own data" ON users FOR SELECT USING (true); -- Allow public read for now or fix auth.uid()

DROP POLICY IF EXISTS "Allow public insert for users" ON users;
CREATE POLICY "Allow public insert for users" ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to update their own data" ON users;
CREATE POLICY "Allow users to update their own data" ON users FOR UPDATE USING (true); -- Allow public update for seeding or fix auth.uid()

DROP POLICY IF EXISTS "Allow users to read their own transactions" ON coin_transactions;
CREATE POLICY "Allow users to read their own transactions" ON coin_transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to read their own purchases" ON user_chapters;
CREATE POLICY "Allow users to read their own purchases" ON user_chapters FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to read their own bookmarks" ON bookmarks;
CREATE POLICY "Allow users to read their own bookmarks" ON bookmarks FOR SELECT USING (auth.uid() = user_id);

-- 17. Admin Policies (Simplified for demo - in production use roles)
DROP POLICY IF EXISTS "Allow all for authenticated on manhwa" ON manhwa;
CREATE POLICY "Allow all for authenticated on manhwa" ON manhwa ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated on chapters" ON chapters;
CREATE POLICY "Allow all for authenticated on chapters" ON chapters ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated on pages" ON pages;
CREATE POLICY "Allow all for authenticated on pages" ON pages ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated on settings" ON settings;
CREATE POLICY "Allow all for authenticated on settings" ON settings ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated on genres" ON genres;
CREATE POLICY "Allow all for authenticated on genres" ON genres ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated on manhwa_genres" ON manhwa_genres;
CREATE POLICY "Allow all for authenticated on manhwa_genres" ON manhwa_genres ALL USING (auth.role() = 'authenticated');
