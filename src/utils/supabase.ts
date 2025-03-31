import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ybnsuhrrioxgoslrriup.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibnN1aHJyaW94Z29zbHJyaXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4NTk5NTgsImV4cCI6MjA1ODQzNTk1OH0.zrIJfq_GqtnNMffWVaXztfSAHgwS9WmFKmcyd7ndCcw';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase; 