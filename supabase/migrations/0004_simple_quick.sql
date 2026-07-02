-- Remplace budget_tier par is_simple_quick (recettes simples et rapides)
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS is_simple_quick BOOLEAN NOT NULL DEFAULT FALSE;
