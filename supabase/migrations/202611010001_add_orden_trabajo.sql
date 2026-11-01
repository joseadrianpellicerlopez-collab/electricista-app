ALTER TABLE public.horarios
  ADD COLUMN IF NOT EXISTS orden_trabajo text;
