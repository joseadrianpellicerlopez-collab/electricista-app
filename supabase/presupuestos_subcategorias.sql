create table public.presupuesto_subcategorias (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null,
  categoria text not null check (categoria in ('climatizacion', 'electricidad', 'otros')),
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  unique (owner_id, categoria, id)
);
create unique index presupuesto_subcategorias_nombre on public.presupuesto_subcategorias (owner_id, categoria, lower(trim(nombre)));
alter table public.presupuesto_subcategorias enable row level security;
revoke all on public.presupuesto_subcategorias from public, anon;
grant select, insert, update, delete on public.presupuesto_subcategorias to authenticated;
create policy subcategorias_propias on public.presupuesto_subcategorias for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create trigger subcategorias_fecha_servidor before insert or update on public.presupuesto_subcategorias
  for each row execute function public.presupuestos_fecha_servidor();

alter table public.presupuesto_productos add column subcategoria_id uuid;
alter table public.presupuesto_productos add constraint producto_subcategoria_propia
  foreign key (owner_id, categoria, subcategoria_id)
  references public.presupuesto_subcategorias (owner_id, categoria, id);
create index presupuesto_productos_subcategoria on public.presupuesto_productos (owner_id, categoria, subcategoria_id);
drop index public.presupuesto_productos_nombre;
create unique index presupuesto_productos_nombre on public.presupuesto_productos
  (owner_id, categoria, coalesce(subcategoria_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(nombre)));
