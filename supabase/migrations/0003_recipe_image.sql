-- Image générée par IA pour chaque recette (stockée dans Supabase Storage).
ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS image_url TEXT;
