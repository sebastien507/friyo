# Friyo 🍽️

Le menu de soupers de la semaine de ta famille en 30 secondes — basé sur ce que t'as dans le frigo.

## Stack

- **Expo SDK 53** + TypeScript + Expo Router (file-based, construit sur React Navigation)
- **NativeWind** (Tailwind) · **Zustand** · **TanStack Query** · **FlashList**
- **Supabase** : PostgreSQL + Auth anonyme + Edge Functions (Deno)
- **OpenAI GPT-4o mini** — appelé uniquement via Edge Functions (clé jamais côté client)
- **OneSignal** + Expo Notifications · **react-native-iap** (achat unique 6,99 $)

## Démarrage

```bash
npm install

# 1. Créer un projet Supabase, puis :
npx supabase link --project-ref <ref>
npx supabase db push                      # applique supabase/migrations/
npx supabase functions deploy generate-meal-plan
npx supabase functions deploy regenerate-single-meal
npx supabase functions deploy generate-grocery-list

# 2. Secrets des Edge Functions (dashboard Supabase ou CLI) :
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set ONESIGNAL_APP_ID=... ONESIGNAL_REST_API_KEY=...

# 3. Activer l'auth anonyme : Dashboard → Authentication → Providers → Anonymous

# 4. Variables client :
cp .env.example .env.local   # remplir EXPO_PUBLIC_SUPABASE_URL / ANON_KEY

npm run ios
```

## Architecture

- `app/` — écrans Expo Router : onboarding 6 étapes, écran principal (menu + liste
  d'épicerie sur une seule page scrollable via une FlashList hétérogène),
  `fridge-check` (question frigo hebdo), `recipe/[id]`, paramètres.
- `supabase/functions/` — toute la logique OpenAI :
  - `generate-meal-plan` : vérifie le paywall, calcule le score de popularité
    (8 semaines) et les recettes récentes (2 semaines) côté serveur, génère le
    menu **et** la liste d'épicerie dans la foulée.
  - `regenerate-single-meal` : remplace un souper ; l'ancien item est archivé
    (`is_archived = true`) avec `was_regenerated = true` pour préserver le
    signal de popularité.
  - `generate-grocery-list` : re-agrège la liste (préserve les items manuels,
    ajoute les staples « dus » selon leur fréquence).
- `hooks/` — React Query par domaine. `lib/` — supabase, i18n (FR-CA/EN-CA),
  dates/saisons, notifications, IAP.

## Décisions d'implémentation (écarts ou précisions vs le brief)

1. **Onboarding 6 étapes** — le brief contient à la fois « 6 étapes » (sections
   détaillées + checklist v2.3) et « 2 étapes max » (contrainte héritée d'une
   version antérieure). Le flux 6 étapes a été retenu.
2. **`is_archived` sur `meal_plan_items`** — « Régénérer ce souper » doit à la
   fois remplacer la ligne du menu et conserver le signal `was_regenerated`
   pour le score de popularité ; la ligne remplacée est donc archivée plutôt
   qu'écrasée.
3. **`generation_count` sur `households`** — compteur fiable pour le paywall
   (« premier menu gratuit »), vérifié dans l'Edge Function (402 → paywall).
4. **Rappel frigo** : notification locale hebdomadaire (expo-notifications),
   calée sur la veille du jour d'épicerie à l'heure choisie + tags OneSignal
   (`grocery_day`, `reminder_time`, `notif_*`) pour les campagnes serveur
   (« menu prêt », « rappel liste », « saison »). TODO : Edge Function de
   scheduling OneSignal pour remplacer les campagnes manuelles.
5. **IAP** : `is_purchased` est mis à jour après `finishTransaction`. TODO
   Phase 1.1 : validation du reçu App Store côté Edge Function.
6. **Catégories d'épicerie** stockées en clés canoniques (`produce`,
   `meat_fish`, …) et traduites dans l'UI — nécessaire pour le bilinguisme.

## Conformité

- RLS sur toutes les tables (migration initiale).
- Suppression de compte : RPC `delete_my_account` → cascade complète (PIPEDA/CCPA).
- Aucune donnée personnelle identifiable envoyée à OpenAI.
