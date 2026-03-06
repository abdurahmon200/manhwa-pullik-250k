export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'assistant_admin';
  coins: number;
}

export interface Manhwa {
  id: string;
  title: string;
  description: string;
  poster: string;
  genres?: string;
  created_at: string;
  latest_chapters?: Chapter[];
}

export interface Chapter {
  id: string;
  manga_id: string;
  chapter_number: number;
  title: string;
  coin_price: number;
  created_at: string;
}

export interface Page {
  id: string;
  chapter_id: string;
  image_url: string;
  page_number: number;
}

export interface Comment {
  id: string;
  user_id: string;
  username: string;
  manga_id: string;
  comment: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  chapter_id: string;
  purchase_time: string;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'add' | 'spend' | 'reward';
  description: string;
  created_at: string;
}
