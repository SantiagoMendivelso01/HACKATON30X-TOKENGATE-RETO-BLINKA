-- Borra TODOS los datos del agente pagador (facturas, revisiones, políticas y auditoría) y deja
-- la base en 0. No se puede deshacer. Pégalo completo en Supabase → SQL Editor → Run.
--
-- Revisiones, políticas y auditoría son solo-agregar: el script quita sus triggers, borra y los
-- vuelve a crear igual que en migrations/20261017000000_persistencia.sql. Todo corre en una
-- transacción: si algo falla, no se borra nada.

begin;

drop trigger if exists pagador_reviews_append_only on public.pagador_reviews;
drop trigger if exists pagador_policies_append_only on public.pagador_policies;
drop trigger if exists pagador_audit_events_append_only on public.pagador_audit_events;

delete from public.pagador_reviews where org_id = 'org';
delete from public.pagador_audit_events where org_id = 'org';
delete from public.pagador_policies where org_id = 'org';
delete from public.pagador_subjects where org_id = 'org';

create trigger pagador_reviews_append_only
  before update or delete on public.pagador_reviews
  for each row execute function public.pagador_forbid_change();
create trigger pagador_policies_append_only
  before update or delete on public.pagador_policies
  for each row execute function public.pagador_forbid_change();
create trigger pagador_audit_events_append_only
  before update or delete on public.pagador_audit_events
  for each row execute function public.pagador_forbid_change();

commit;
