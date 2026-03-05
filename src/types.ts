export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'assistant_admin';
  coins: number;
}

export interface Manhwa {
  id: number;
  title: string;
  description: string;
  poster: string;
  genres?: string;
  created_at: string;
  latest_chapters?: Chapter[];
}

export interface Chapter {
  id: number;
  manga_id: number;
  chapter_number: number;
  title: string;
  coin_price: number;
  created_at: string;
}

export interface Page {
  id: number;
  chapter_id: number;
  image_url: string;
  page_number: number;
}

export interface Comment {
  id: number;
  user_id: number;
  username: string;
  manga_id: number;
  comment: string;
  created_at: string;
}
