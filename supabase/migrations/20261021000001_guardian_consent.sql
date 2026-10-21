-- =====================================================================
-- 0003 — Consentimento do responsável (LGPD, alunos menores de idade)
-- Só ADICIONA colunas (nada é apagado ou renomeado). Colunas vazias =
-- consentimento ainda não registrado. Quem grava é só o servidor
-- (service role), a pedido da coordenação, com registro na auditoria.
-- =====================================================================

alter table public.profiles
  add column if not exists guardian_consent_at timestamptz,
  add column if not exists guardian_consent_by uuid references public.profiles (id);

create index if not exists profiles_guardian_consent_by_idx on public.profiles (guardian_consent_by);

comment on column public.profiles.guardian_consent_at is
  'Quando a coordenação registrou a autorização do responsável (termo assinado). Nulo = sem autorização.';
