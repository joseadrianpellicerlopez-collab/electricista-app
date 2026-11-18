create table public.perfiles_facturacion (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  emisor jsonb not null check (jsonb_typeof(emisor) = 'object')
);
alter table public.perfiles_facturacion enable row level security;
revoke all on public.perfiles_facturacion from anon, authenticated;
grant select on public.perfiles_facturacion to authenticated;
create policy perfil_facturacion_propio on public.perfiles_facturacion
for select to authenticated using ((select auth.uid()) = owner_id);

-- Recover the existing private issuer once, independently of any quote being deleted.
insert into public.perfiles_facturacion(owner_id, emisor)
select distinct on (owner_id) owner_id, contenido->'emisorFactura'
from public.presupuestos
where jsonb_typeof(contenido->'emisorFactura') = 'object'
  and length(btrim(contenido->'emisorFactura'->>'nombre')) > 0
  and length(btrim(contenido->'emisorFactura'->>'nif')) > 0
  and length(btrim(contenido->'emisorFactura'->>'direccion')) > 0
order by owner_id, updated_at desc, id
on conflict (owner_id) do nothing;
