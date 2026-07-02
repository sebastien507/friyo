-- Colonnes ajoutées après la migration initiale (settings v2).
ALTER TABLE households ADD COLUMN IF NOT EXISTS chef_styles   TEXT[]  DEFAULT '{}';
ALTER TABLE households ADD COLUMN IF NOT EXISTS budget_tier   TEXT    DEFAULT 'medium' CHECK (budget_tier IN ('low','medium','high'));
ALTER TABLE households ADD COLUMN IF NOT EXISTS unit_system   TEXT    DEFAULT 'metric' CHECK (unit_system IN ('metric','imperial'));
