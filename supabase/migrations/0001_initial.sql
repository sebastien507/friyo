-- Friyo — schéma initial. RLS activé sur toutes les tables dès cette migration.

-- ─────────────────────────── Tables ───────────────────────────

CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  adults INT DEFAULT 2,
  children INT DEFAULT 0,
  preferences TEXT[] DEFAULT '{}',        -- restrictions alimentaires
  favorite_dishes TEXT[] DEFAULT '{}',    -- recettes aimées (texte libre parsé)
  cuisine_styles TEXT[] DEFAULT '{}',     -- styles de cuisine préférés
  meals_per_week INT DEFAULT 5 CHECK (meals_per_week BETWEEN 3 AND 7),
  grocery_day INT DEFAULT 6 CHECK (grocery_day BETWEEN 0 AND 6), -- 0=lundi … 6=dimanche
  reminder_time TIME DEFAULT '18:00',
  last_season_prompt DATE,
  language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
  is_purchased BOOLEAN DEFAULT FALSE,     -- achat unique vérifié côté Edge Function
  generation_count INT DEFAULT 0,         -- nb de menus générés (paywall : 1er gratuit)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX households_user_id_idx ON households (user_id);

CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, week_start_date)
);

CREATE TABLE meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID REFERENCES meal_plans ON DELETE CASCADE NOT NULL,
  day_index INT NOT NULL CHECK (day_index BETWEEN 0 AND 6), -- 0=lundi … 6=dimanche
  name TEXT NOT NULL,
  prep_minutes INT,
  ingredients JSONB NOT NULL DEFAULT '[]', -- [{ name, quantity, unit }]
  steps JSONB NOT NULL DEFAULT '[]',
  is_locked BOOLEAN DEFAULT FALSE,
  is_manual BOOLEAN DEFAULT FALSE,
  was_regenerated BOOLEAN DEFAULT FALSE,   -- remplacement demandé = signal négatif
  is_favorited BOOLEAN DEFAULT FALSE,      -- cœur = signal positif fort
  -- une ligne remplacée est archivée (cachée du menu) mais conservée
  -- pour que le signal was_regenerated compte dans le score de popularité
  is_archived BOOLEAN DEFAULT FALSE,
  personal_note TEXT
);
CREATE INDEX meal_plan_items_plan_idx ON meal_plan_items (meal_plan_id);

CREATE TABLE grocery_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID REFERENCES meal_plans ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX grocery_lists_household_idx ON grocery_lists (household_id);

CREATE TABLE grocery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_list_id UUID REFERENCES grocery_lists ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  category TEXT NOT NULL,
  is_checked BOOLEAN DEFAULT FALSE,
  is_manual BOOLEAN DEFAULT FALSE,
  is_staple BOOLEAN DEFAULT FALSE
);
CREATE INDEX grocery_items_list_idx ON grocery_items (grocery_list_id);

CREATE TABLE staple_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  frequency_weeks INT DEFAULT 1 CHECK (frequency_weeks IN (1, 2, 4)),
  last_added_date DATE,
  category TEXT DEFAULT 'pantry'
);
CREATE INDEX staple_items_household_idx ON staple_items (household_id);

CREATE TABLE fridge_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL,
  contents TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, week_start_date)
);

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  meal_name TEXT NOT NULL,
  meal_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX favorites_user_idx ON favorites (user_id);

-- ─────────────────────────── RLS ───────────────────────────

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staple_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Helper : le foyer appartient-il à l'utilisateur courant ?
CREATE FUNCTION is_my_household(hid UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM households WHERE id = hid AND user_id = auth.uid());
$$;

CREATE POLICY "own household" ON households
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own meal plans" ON meal_plans
  FOR ALL USING (is_my_household(household_id)) WITH CHECK (is_my_household(household_id));

CREATE POLICY "own meal plan items" ON meal_plan_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = meal_plan_id AND is_my_household(mp.household_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = meal_plan_id AND is_my_household(mp.household_id))
  );

CREATE POLICY "own grocery lists" ON grocery_lists
  FOR ALL USING (is_my_household(household_id)) WITH CHECK (is_my_household(household_id));

CREATE POLICY "own grocery items" ON grocery_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM grocery_lists gl WHERE gl.id = grocery_list_id AND is_my_household(gl.household_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM grocery_lists gl WHERE gl.id = grocery_list_id AND is_my_household(gl.household_id))
  );

CREATE POLICY "own staples" ON staple_items
  FOR ALL USING (is_my_household(household_id)) WITH CHECK (is_my_household(household_id));

CREATE POLICY "own fridge snapshots" ON fridge_snapshots
  FOR ALL USING (is_my_household(household_id)) WITH CHECK (is_my_household(household_id));

CREATE POLICY "own favorites" ON favorites
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─────────────────── Suppression de compte (PIPEDA / CCPA) ───────────────────
-- Supprime l'utilisateur auth ; toutes les données suivent par ON DELETE CASCADE.

CREATE FUNCTION delete_my_account() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;
