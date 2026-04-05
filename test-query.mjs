import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
// We don't have it explicitly without searching .env, but we can read from .env

import fs from 'fs'
import dotenv from 'dotenv'
const envConfig = dotenv.parse(fs.readFileSync('.env'))
const supabaseUrl = envConfig.VITE_SUPABASE_URL
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('posts')
    .select('*, challenges(*), voice_posts(*)')
    .eq('post_type', 'challenge')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) console.error(error);
  else {
    console.log(JSON.stringify(data, null, 2))
  }
}
run();
