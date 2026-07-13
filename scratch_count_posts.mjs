import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import dotenv from 'dotenv'

const envConfig = dotenv.parse(fs.readFileSync('.env'))
const supabaseUrl = envConfig.VITE_SUPABASE_URL
const supabaseKey = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error, count } = await supabase
    .from('posts')
    .select('id, title, content, category, post_type', { count: 'exact' });
  
  if (error) console.error(error);
  else {
    console.log(`Total posts in DB: ${count}`);
    
    const { data: topics } = await supabase.from('post_topics').select('post_id');
    const topicSet = new Set(topics?.map(t => t.post_id) || []);
    console.log(`Total post_topics in DB: ${topicSet.size}`);
    
    const missing = data.filter(p => !topicSet.has(p.id));
    console.log(`Posts missing topic: ${missing.length}`);
    console.log(`Sample missing posts:`, missing.slice(0, 5));
  }
}
run();
