-- Simula o mínimo do Supabase (schema auth, auth.uid() e papéis) para rodar
-- as migrações e os testes de segurança num Postgres comum (local ou CI).
-- NÃO é aplicado no Supabase de verdade.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- No Supabase, novas tabelas recebem estes privilégios por padrão (a RLS é quem restringe).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
