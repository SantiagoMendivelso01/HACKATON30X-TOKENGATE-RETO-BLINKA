-- Persistencia del agente pagador (blinka).
-- Pégalo completo en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- Se guardan solo las entradas: facturas y compras, revisiones humanas, versiones de la
-- política y eventos de auditoría. Las decisiones del agente no se guardan: el motor de
-- reglas las recalcula siempre a partir de estas entradas.
--
-- Cada fila lleva el objeto completo en `payload` (igual a src/lib/tokengate/types.ts) y
-- copia algunos campos en columnas reales para índices y consultas.
--
-- Las tablas llevan el prefijo pagador_ porque el proyecto comparte el esquema public con otra
-- app. Solo el servidor habla con estas tablas, con la clave secreta. RLS queda activado y sin
-- políticas: la clave pública (anon) no puede leer ni escribir nada.

create table if not exists public.pagador_subjects (
  id text primary key,
  org_id text not null,
  kind text not null check (kind in ('invoice', 'purchase')),
  reference text not null,
  received_at timestamptz not null,
  amount_minor bigint not null,
  currency text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pagador_subjects_org_received on public.pagador_subjects (org_id, received_at);

-- Cada revisión humana, con el resultado del motor que la persona vio al decidir.
create table if not exists public.pagador_reviews (
  id text primary key,
  org_id text not null,
  subject_id text not null references public.pagador_subjects (id),
  action text not null check (action in ('approved', 'rejected', 'info_requested')),
  at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pagador_reviews_org_at on public.pagador_reviews (org_id, at);

-- Una fila por versión guardada; la vigente es la de mayor seq.
create table if not exists public.pagador_policies (
  seq bigint generated always as identity primary key,
  org_id text not null,
  version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (org_id, version)
);

create table if not exists public.pagador_audit_events (
  id text primary key,
  org_id text not null,
  type text not null,
  at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pagador_audit_events_org_at on public.pagador_audit_events (org_id, at);

alter table public.pagador_subjects enable row level security;
alter table public.pagador_reviews enable row level security;
alter table public.pagador_policies enable row level security;
alter table public.pagador_audit_events enable row level security;

-- Revisiones, políticas y auditoría son solo-agregar: corregir algo es un evento nuevo.
-- Para borrar datos de prueba hay que quitar estos triggers a mano.
create or replace function public.pagador_forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% es solo-agregar: % no está permitido', tg_table_name, tg_op;
end $$;

create or replace trigger pagador_reviews_append_only
  before update or delete on public.pagador_reviews
  for each row execute function public.pagador_forbid_change();
create or replace trigger pagador_reviews_no_truncate
  before truncate on public.pagador_reviews
  for each statement execute function public.pagador_forbid_change();

create or replace trigger pagador_policies_append_only
  before update or delete on public.pagador_policies
  for each row execute function public.pagador_forbid_change();
create or replace trigger pagador_policies_no_truncate
  before truncate on public.pagador_policies
  for each statement execute function public.pagador_forbid_change();

create or replace trigger pagador_audit_events_append_only
  before update or delete on public.pagador_audit_events
  for each row execute function public.pagador_forbid_change();
create or replace trigger pagador_audit_events_no_truncate
  before truncate on public.pagador_audit_events
  for each statement execute function public.pagador_forbid_change();

-- Guarda todo lo que produce una acción en una sola transacción: o queda todo o nada.
-- p_writes = { subjects: [...], reviews: [...], policies: [...], audit: [...] }
create or replace function public.pagador_save_writes(p_org text, p_writes jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.pagador_subjects (id, org_id, kind, reference, received_at, amount_minor, currency, payload)
  select s ->> 'id', p_org, s ->> 'kind', s ->> 'reference', (s ->> 'receivedAt')::timestamptz,
         (s -> 'amount' ->> 'amountMinor')::bigint, s -> 'amount' ->> 'currency', s
  from jsonb_array_elements(coalesce(p_writes -> 'subjects', '[]'::jsonb)) as s;

  insert into public.pagador_reviews (id, org_id, subject_id, action, at, payload)
  select r ->> 'id', p_org, r ->> 'subjectId', r ->> 'humanAction', (r ->> 'at')::timestamptz, r
  from jsonb_array_elements(coalesce(p_writes -> 'reviews', '[]'::jsonb)) as r;

  insert into public.pagador_policies (org_id, version, payload)
  select p_org, p ->> 'version', p
  from jsonb_array_elements(coalesce(p_writes -> 'policies', '[]'::jsonb)) with ordinality as x(p, n)
  order by n;

  insert into public.pagador_audit_events (id, org_id, type, at, payload)
  select e ->> 'id', p_org, e ->> 'type', (e ->> 'at')::timestamptz, e
  from jsonb_array_elements(coalesce(p_writes -> 'audit', '[]'::jsonb)) as e;
end $$;

revoke execute on function public.pagador_save_writes(text, jsonb) from public, anon, authenticated;
grant execute on function public.pagador_save_writes(text, jsonb) to service_role;
