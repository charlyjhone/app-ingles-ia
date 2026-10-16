-- =====================================================================
-- Testes de segurança (RLS). Rodam no CI a cada mudança.
-- Se qualquer verificação falhar, o merge é bloqueado.
-- =====================================================================
\set ON_ERROR_STOP on

create or replace function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
end $$;

begin;

-- ---------- dados de exemplo (como service_role/superusuário) ----------
insert into public.schools (id, name) values
  ('00000000-0000-0000-0000-00000000c0c0', 'COC Macapá'),
  ('00000000-0000-0000-0000-0000000c0ce1', 'Colégio Conceito');

insert into auth.users (id) values
  ('11111111-0000-0000-0000-000000000001'), -- aluna COC (Ana)
  ('11111111-0000-0000-0000-000000000002'), -- aluno COC outra turma (Bruno)
  ('11111111-0000-0000-0000-000000000003'), -- professora COC turma 9A
  ('11111111-0000-0000-0000-000000000004'), -- coordenadora COC
  ('11111111-0000-0000-0000-000000000005'), -- responsável da Ana (com consentimento)
  ('11111111-0000-0000-0000-000000000006'), -- coordenador do Conceito
  ('11111111-0000-0000-0000-000000000007'); -- responsável sem consentimento

insert into public.profiles (id, school_id, role, full_name) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000c0c0', 'student', 'Ana'),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000c0c0', 'student', 'Bruno'),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000c0c0', 'teacher', 'Profa. Carla'),
  ('11111111-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000c0c0', 'coordinator', 'Coord. COC'),
  ('11111111-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000c0c0', 'guardian', 'Mãe da Ana'),
  ('11111111-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000c0ce1', 'coordinator', 'Coord. Conceito'),
  ('11111111-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000c0c0', 'guardian', 'Responsável sem consentimento');

insert into public.classes (id, school_id, name) values
  ('22222222-0000-0000-0000-0000000009a0', '00000000-0000-0000-0000-00000000c0c0', '9º A'),
  ('22222222-0000-0000-0000-0000000008b0', '00000000-0000-0000-0000-00000000c0c0', '8º B');

insert into public.class_members (class_id, profile_id, member_role) values
  ('22222222-0000-0000-0000-0000000009a0', '11111111-0000-0000-0000-000000000001', 'student'),
  ('22222222-0000-0000-0000-0000000009a0', '11111111-0000-0000-0000-000000000003', 'teacher'),
  ('22222222-0000-0000-0000-0000000008b0', '11111111-0000-0000-0000-000000000002', 'student');

insert into public.guardian_links (guardian_id, student_id, consent_at) values
  ('11111111-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', now()),
  ('11111111-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000002', null);

insert into public.xp_events (student_id, school_id, amount, reason) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000c0c0', 10, 'lesson'),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000c0c0', 20, 'lesson');

insert into public.audit_log (actor_id, school_id, action) values
  ('11111111-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000c0c0', 'seed');

set local role authenticated;

-- ---------- aluna ----------
select pg_temp.as_user('11111111-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.xp_events) = 1, 'aluna vê só o próprio XP');
select pg_temp.check((select count(*) from public.profiles) = 1, 'aluna vê só o próprio perfil');
select pg_temp.check((select count(*) from public.schools) = 1, 'aluna vê só a própria escola');
select pg_temp.check((select count(*) from public.audit_log) = 0, 'aluna não vê auditoria');

-- ---------- professora ----------
select pg_temp.as_user('11111111-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.xp_events) = 1, 'professora vê XP só de alunos da sua turma');
select pg_temp.check(
  not exists (select 1 from public.profiles where id = '11111111-0000-0000-0000-000000000002'),
  'professora não vê aluno de outra turma');
select pg_temp.check((select count(*) from public.classes) = 1, 'professora vê só as próprias turmas');

-- ---------- coordenação ----------
select pg_temp.as_user('11111111-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from public.xp_events) = 2, 'coordenação vê todos os alunos da escola');
select pg_temp.check((select count(*) from public.audit_log) = 1, 'coordenação vê auditoria da escola');

-- ---------- isolamento entre escolas ----------
select pg_temp.as_user('11111111-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from public.xp_events) = 0, 'coordenação do Conceito NÃO vê dados do COC');
select pg_temp.check((select count(*) from public.profiles) = 1, 'coordenação do Conceito NÃO vê perfis do COC');
select pg_temp.check((select count(*) from public.audit_log) = 0, 'coordenação do Conceito NÃO vê auditoria do COC');

-- ---------- responsáveis ----------
select pg_temp.as_user('11111111-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.xp_events) = 1, 'responsável com consentimento vê o próprio filho');
select pg_temp.as_user('11111111-0000-0000-0000-000000000007');
select pg_temp.check((select count(*) from public.xp_events) = 0, 'responsável SEM consentimento não vê nada');

-- ---------- sem login ----------
select pg_temp.as_user(null);
select pg_temp.check((select count(*) from public.xp_events) = 0, 'usuário sem login não vê nada');

-- ---------- apps não escrevem direto no banco ----------
select pg_temp.as_user('11111111-0000-0000-0000-000000000001');
do $$ begin
  begin
    insert into public.xp_events (student_id, school_id, amount, reason)
    values ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000c0c0', 9999, 'hack');
    raise exception 'FALHOU: aluna conseguiu inserir XP direto no banco';
  exception when insufficient_privilege then
    raise notice 'ok - aluna não consegue se dar XP direto no banco';
  end;
end $$;

do $$ begin
  begin
    update public.profiles set role = 'admin' where id = '11111111-0000-0000-0000-000000000001';
    raise exception 'FALHOU: aluna conseguiu virar admin';
  exception when insufficient_privilege then
    raise notice 'ok - aluna não consegue mudar o próprio papel';
  end;
end $$;

reset role;

-- ---------- auditoria é somente-acréscimo ----------
do $$ begin
  begin
    delete from public.audit_log;
    raise exception 'FALHOU: auditoria foi apagada';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice 'ok - auditoria não pode ser apagada nem pelo backend';
  end;
end $$;

rollback;
\echo 'Todos os testes de segurança passaram.'
