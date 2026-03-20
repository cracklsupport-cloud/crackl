const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function bust() {
  console.log('Sending cache bust to:', process.env.SUPABASE_URL);
  const { data, error } = await supabase.rpc('hello_world_non_existent');
  console.log('Bust attempt finished.', error);
}

bust();
