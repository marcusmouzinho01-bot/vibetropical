# Vibe Tropical — Etapa 1
1. Crie um projeto no Supabase. No SQL Editor, rode `supabase/migrations/001_init.sql`.
2. Em Authentication > Users, crie o usuário da proprietária. Depois rode:
   `insert into profiles(id, full_name) values ('<ID DO USUÁRIO>', 'Nome');`
3. `cp .env.example .env` e preencha URL e chave **anon** (nunca a service_role).
4. `npm install && npm run dev`
