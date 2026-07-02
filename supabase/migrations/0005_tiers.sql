-- Essai Pro de 14 jours à l'inscription (reverse trial)
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

-- Backfill des utilisateurs existants : 14 jours depuis created_at
UPDATE households
  SET trial_ends_at = created_at + INTERVAL '14 days'
  WHERE trial_ends_at IS NULL;
