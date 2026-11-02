-- Preserve all transactions, dates and amounts. Older app versions remain compatible.
alter table public.finanzas add column if not exists categoria text;
update public.finanzas
set categoria = coalesce(nullif(btrim(concepto), ''), 'Sin categoría')
where categoria is null;
