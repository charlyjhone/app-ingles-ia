-- =====================================================================
-- 0001 — Esquema base do app de inglês com IA
--
-- Princípios:
-- 1. Toda tabela tem RLS ligado. Sem política = ninguém lê.
-- 2. Os apps (anon/authenticated) só LEEM. Toda escrita passa pelo backend
--    (service_role), que valida regras, limites e auditoria.
-- 3. Isolamento por escola: um professor do Colégio Conceito nunca vê
--    dados do COC Macapá, mesmo que haja bug no app.
-- 4. Migrações são só aditivas (veja docs/MUDANCAS-SEGURAS.md).
-- =====================================================================

create type public.app_role as enum ('student', 'guardian', 'teacher', 'coordinator', 'admin');

create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  school_id   uuid not null references public.schools (id),
  role        public.app_role not null,
  full_name   text not null,
  kids_mode   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index profiles_school_idx on public.profiles (school_id);

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id),
  name        text not null,
  grade       text,
  created_at  timestamptz not null default now()
);
create index classes_school_idx on public.classes (school_id);

create table public.class_members (
  class_id     uuid not null references public.classes (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  member_role  text not null check (member_role in ('student', 'teacher')),
  primary key (class_id, profile_id)
);
create index class_members_profile_idx on public.class_members (profile_id);

create table public.guardian_links (
  guardian_id  uuid not null references public.profiles (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  consent_at   timestamptz,               -- consentimento LGPD do responsável
  primary key (guardian_id, student_id)
);

create table public.review_items (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles (id) on delete cascade,
  school_id        uuid not null references public.schools (id),
  term             text not null,
  translation_pt   text not null,
  half_life_hours  numeric not null check (half_life_hours > 0),
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index review_items_student_idx on public.review_items (student_id);

create table public.conversation_usage (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  school_id   uuid not null references public.schools (id),
  session_id  uuid not null,
  day_key     date not null,
  seconds     integer not null check (seconds >= 0),
  created_at  timestamptz not null default now()
);
create index conversation_usage_student_day_idx on public.conversation_usage (student_id, day_key);

create table public.xp_events (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  school_id   uuid not null references public.schools (id),
  amount      integer not null,
  reason      text not null,
  created_at  timestamptz not null default now()
);
create index xp_events_student_idx on public.xp_events (student_id, created_at);

create table public.feature_flags (
  id         uuid primary key default gen_random_uuid(),
  key        text not null,
  enabled    boolean not null,
  school_id  uuid references public.schools (id) on delete cascade,
  class_id   uuid references public.classes (id) on delete cascade,
  unique nulls not distinct (key, school_id, class_id)
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  school_id   uuid,
  action      text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_school_idx on public.audit_log (school_id, created_at);

-- Auditoria é somente-acréscimo: nem o backend apaga ou altera histórico.
create function public.audit_log_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log é somente-acréscimo';
end;
$$;
create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();

-- =====================================================================
-- Funções auxiliares de permissão (schema privado, não exposto na API)
-- =====================================================================
create schema if not exists private;

create function private.current_school_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select school_id from public.profiles where id = auth.uid()
$$;

create function private.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function private.is_school_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_app_role() in ('coordinator', 'admin'), false)
$$;

create function private.is_class_member(p_class_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class_id and profile_id = auth.uid()
  )
$$;

create function private.teaches_student(p_student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.class_members t
    join public.class_members s on s.class_id = t.class_id
    where t.profile_id = auth.uid() and t.member_role = 'teacher'
      and s.profile_id = p_student_id and s.member_role = 'student'
  )
$$;

create function private.is_guardian_of(p_student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guardian_links
    where guardian_id = auth.uid() and student_id = p_student_id and consent_at is not null
  )
$$;

create function private.can_view_student(p_student_id uuid, p_school_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    p_student_id = auth.uid()
    or private.is_guardian_of(p_student_id)
    or (
      p_school_id = private.current_school_id()
      and (private.is_school_manager() or private.teaches_student(p_student_id))
    )
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
revoke execute on all functions in schema private from anon, public;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.schools            enable row level security;
alter table public.profiles           enable row level security;
alter table public.classes            enable row level security;
alter table public.class_members      enable row level security;
alter table public.guardian_links     enable row level security;
alter table public.review_items       enable row level security;
alter table public.conversation_usage enable row level security;
alter table public.xp_events          enable row level security;
alter table public.feature_flags      enable row level security;
alter table public.audit_log          enable row level security;

create policy "ver a própria escola" on public.schools
  for select to authenticated using (id = private.current_school_id());

create policy "ver perfis permitidos" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or private.is_guardian_of(id)
    or (school_id = private.current_school_id()
        and (private.is_school_manager() or private.teaches_student(id)))
  );

create policy "ver turmas da escola" on public.classes
  for select to authenticated using (
    school_id = private.current_school_id()
    and (private.is_school_manager() or private.is_class_member(id))
  );

create policy "ver membros de turmas visíveis" on public.class_members
  for select to authenticated using (
    profile_id = auth.uid()
    or (private.current_app_role() = 'teacher' and private.is_class_member(class_id))
    or (private.is_school_manager()
        and exists (select 1 from public.classes c
                    where c.id = class_id and c.school_id = private.current_school_id()))
  );

create policy "responsável vê os próprios vínculos" on public.guardian_links
  for select to authenticated using (guardian_id = auth.uid());

create policy "ver revisão de alunos permitidos" on public.review_items
  for select to authenticated using (private.can_view_student(student_id, school_id));

create policy "ver uso de conversa de alunos permitidos" on public.conversation_usage
  for select to authenticated using (private.can_view_student(student_id, school_id));

create policy "ver xp de alunos permitidos" on public.xp_events
  for select to authenticated using (private.can_view_student(student_id, school_id));

create policy "ver flags globais e da escola" on public.feature_flags
  for select to authenticated using (school_id is null or school_id = private.current_school_id());

create policy "gestão vê auditoria da escola" on public.audit_log
  for select to authenticated using (private.is_school_manager() and school_id = private.current_school_id());

-- Defesa em profundidade: os apps nunca escrevem direto no banco.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
