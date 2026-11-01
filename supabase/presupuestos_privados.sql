-- Private, per-account quote catalogue and snapshots. Does not change other modules.
create table public.presupuesto_productos (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null,
  nombre text not null check (length(trim(nombre)) between 1 and 160),
  categoria text not null check (categoria in ('climatizacion', 'electricidad', 'otros')),
  precio bigint not null check (precio between 0 and 9999999900),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create unique index presupuesto_productos_nombre on public.presupuesto_productos (owner_id, categoria, lower(trim(nombre)));
create table public.presupuestos (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null,
  contenido jsonb not null check (jsonb_typeof(contenido) = 'object' and jsonb_typeof(contenido->'lineas') = 'array'),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index presupuestos_recientes on public.presupuestos (owner_id, updated_at desc, id);
alter table public.presupuesto_productos enable row level security;
alter table public.presupuestos enable row level security;
revoke all on public.presupuesto_productos, public.presupuestos from public, anon;
grant select, insert, update, delete on public.presupuesto_productos, public.presupuestos to authenticated;
create policy productos_propios on public.presupuesto_productos for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy presupuestos_propios on public.presupuestos for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- Ordering uses server time, independent of phone/desktop clock settings.
create function public.presupuestos_fecha_servidor() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.presupuestos_fecha_servidor() from public, anon;
create trigger productos_fecha_servidor before insert or update on public.presupuesto_productos
  for each row execute function public.presupuestos_fecha_servidor();
create trigger presupuestos_fecha_servidor before insert or update on public.presupuestos
  for each row execute function public.presupuestos_fecha_servidor();
