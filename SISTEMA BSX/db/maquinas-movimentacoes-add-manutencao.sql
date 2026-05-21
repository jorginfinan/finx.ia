-- ============================================================
-- OPCIONAL: adicionar 'manutencao' como tipo válido em maquinas_movimentacoes
-- ============================================================
-- Execute apenas se quiser ter "Manutenção" como tipo dedicado no histórico
-- (e não apenas embutido na observação dos eventos de "edicao").
-- O sistema funciona normalmente sem esta alteração.
-- ============================================================

-- Descobre o nome da constraint atual e remove
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.maquinas_movimentacoes'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%tipo%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.maquinas_movimentacoes DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Recria a constraint incluindo 'manutencao'
ALTER TABLE public.maquinas_movimentacoes
  ADD CONSTRAINT maquinas_movimentacoes_tipo_check
  CHECK (tipo IN (
    'entrada_estoque',
    'entrega',
    'devolucao',
    'troca',
    'baixa',
    'edicao',
    'manutencao'
  ));

-- ============================================================
-- Depois de rodar este script, abra js/maquinas.js e troque
-- a linha que registra o evento de manutenção:
--   tipo: 'edicao'   →   tipo: 'manutencao'
-- Procure pelo comentário "// Se foi para manutenção, registra"
-- ============================================================
