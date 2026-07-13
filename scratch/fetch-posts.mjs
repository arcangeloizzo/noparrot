import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=["']?([^"'\r\n]+)/)[1];
const supabaseKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["']?([^"'\r\n]+)/)[1];

console.log('URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, content, title')
    .limit(10);
  
  if (error) {
    console.error('Error fetching posts:', error);
  } else {
    console.log(`Fetched ${data.length} posts:`);
    console.log(JSON.stringify(data, null, 2));
  }
}
run();
