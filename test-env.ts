import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env');
console.log('Env path:', envPath);
console.log('Env file exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  console.log('Dotenv config result:', result.error ? 'Error' : 'Success');
}

console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
if (process.env.SUPABASE_URL) {
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL.substring(0, 10) + '...');
}
