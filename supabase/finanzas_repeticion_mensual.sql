-- Opt-in recurrence on the original movement; existing records stay unchanged.
alter table public.finanzas
  add column repetir_mensual boolean not null default false,
  add column siguiente_mes date,
  add column repeticion_origen bigint references public.finanzas(id) on delete set null,
  add column repeticion_mes date;
alter table public.finanzas add constraint finanzas_repeticion_mensual_valida
  check (not repetir_mensual or (tipo = 'mensual' and fecha is not null and repeticion_origen is null));
create unique index finanzas_una_repeticion_por_mes on public.finanzas(repeticion_origen, repeticion_mes);
create index finanzas_repeticiones_pendientes on public.finanzas(siguiente_mes) where repetir_mensual;
create unique index finanzas_una_programacion_por_categoria on public.finanzas
  (lower(btrim(coalesce(nullif(btrim(categoria), ''), concepto))))
  where repetir_mensual;

create or replace function public.finanzas_preparar_repeticion()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  reiniciar boolean := false;
begin
  if new.tipo <> 'mensual' or new.repeticion_origen is not null then
    new.repetir_mensual := false;
  end if;
  if tg_op = 'INSERT' then
    reiniciar := new.repetir_mensual;
  else
    reiniciar := new.repetir_mensual and
      (not old.repetir_mensual or new.fecha is distinct from old.fecha);
  end if;
  if not new.repetir_mensual then
    new.siguiente_mes := null;
  elsif reiniciar then
    -- Enabling an older record starts NEXT month, without inventing past payments.
    new.siguiente_mes := (date_trunc('month', greatest(new.fecha, hoy)) + interval '1 month')::date;
  end if;
  return new;
end;
$$;
revoke all on function public.finanzas_preparar_repeticion() from public, anon, authenticated;
create trigger finanzas_preparar_repeticion
before insert or update on public.finanzas
for each row execute function public.finanzas_preparar_repeticion();

-- Invoked only by postgres/cron, never exposed as a client RPC with a future date.
create or replace function public.finanzas_generar_mensuales(p_hoy date default (now() at time zone 'Europe/Madrid')::date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  origen public.finanzas%rowtype;
  mes date;
  vencimiento date;
  ultimo_dia integer;
  insertados integer := 0;
  filas integer;
begin
  for origen in
    select * from public.finanzas
    where repetir_mensual and siguiente_mes <= p_hoy
    order by id for update skip locked
  loop
    mes := origen.siguiente_mes;
    while mes <= p_hoy loop
      ultimo_dia := extract(day from (mes + interval '1 month - 1 day'))::integer;
      vencimiento := mes + (least(extract(day from origen.fecha)::integer, ultimo_dia) - 1);
      exit when vencimiento > p_hoy;
      insert into public.finanzas(tipo, concepto, categoria, cantidad, fecha, repeticion_origen, repeticion_mes)
      values ('mensual', origen.concepto, origen.categoria, origen.cantidad, vencimiento, origen.id, mes)
      on conflict (repeticion_origen, repeticion_mes) do nothing;
      get diagnostics filas = row_count;
      insertados := insertados + filas;
      mes := (mes + interval '1 month')::date;
    end loop;
    -- Persist cursor even if a generated record is later deleted: it stays deleted.
    update public.finanzas set siguiente_mes = mes where id = origen.id;
  end loop;
  return insertados;
end;
$$;
revoke all on function public.finanzas_generar_mensuales(date) from public, anon, authenticated;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('finanzas-gastos-mensuales', '5 * * * *', 'select public.finanzas_generar_mensuales();');
