-- =====================================================================
-- 0002 — Correções apontadas pelo verificador do Supabase (advisors)
-- Só ajustes; nenhum dado é apagado.
-- =====================================================================

-- Segurança: função do gatilho de auditoria com search_path fixo.
alter function public.audit_log_is_append_only() set search_path = '';

-- Desempenho: índices nas chaves estrangeiras sem índice.
create index if not exists conversation_usage_school_idx on public.conversation_usage (school_id);
create index if not exists feature_flags_class_idx       on public.feature_flags (class_id);
create index if not exists feature_flags_school_idx      on public.feature_flags (school_id);
create index if not exists guardian_links_student_idx    on public.guardian_links (student_id);
create index if not exists review_items_school_idx       on public.review_items (school_id);
create index if not exists xp_events_school_idx          on public.xp_events (school_id);

-- Desempenho: auth.uid() avaliado uma vez por consulta, não por linha.
-- (mesmas regras de acesso, só reescritas; os testes de RLS confirmam)
alter policy "ver perfis permitidos" on public.profiles
  using (
    id = (select auth.uid())
    or private.is_guardian_of(id)
    or (school_id = private.current_school_id()
        and (private.is_school_manager() or private.teaches_student(id)))
  );

alter policy "ver membros de turmas visíveis" on public.class_members
  using (
    profile_id = (select auth.uid())
    or (private.current_app_role() = 'teacher' and private.is_class_member(class_id))
    or (private.is_school_manager()
        and exists (select 1 from public.classes c
                    where c.id = class_id and c.school_id = private.current_school_id()))
  );

alter policy "responsável vê os próprios vínculos" on public.guardian_links
  using (guardian_id = (select auth.uid()));
