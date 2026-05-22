-- ============================================================
-- CONTROLE DE BOBINAS
-- Execute este script no Supabase SQL Editor (uma única vez).
-- ============================================================
-- Tabelas criadas:
--   1) bobinas                -> configuração e estoque atual
--   2) bobinas_movimentacoes  -> histórico de entradas, saídas, entregas e ajustes
-- ============================================================

-- ============================================================
-- 1) BOBINAS (estoque atual + config)
-- ============================================================
-- Cada empresa tem normalmente UMA linha aqui (tipo único), mas a
-- estrutura permite mais de um tipo no futuro (térmica 57mm, 80mm, etc.).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bobinas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  nome                text NOT NULL DEFAULT 'Bobina térmica',
  descricao           text,
  fornecedor_padrao   text,

  preco_custo         numeric(12,2) NOT NULL DEFAULT 0,

  estoque_atual       integer NOT NULL DEFAULT 0,
  estoque_minimo      integer NOT NULL DEFAULT 0,

  observacao          text,
  ativo               boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bobinas_empresa_idx ON public.bobinas(empresa_id);
CREATE INDEX IF NOT EXISTS bobinas_ativo_idx   ON public.bobinas(empresa_id, ativo);

-- ============================================================
-- 2) MOVIMENTAÇÕES DE BOBINAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bobinas_movimentacoes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id               uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  bobina_id                uuid NOT NULL REFERENCES public.bobinas(id) ON DELETE CASCADE,

  tipo                     text NOT NULL CHECK (tipo IN (
                             'entrada',    -- compra/recebimento (+)
                             'saida',      -- saída manual (-)
                             'entrega',    -- entregue a um gerente (-)
                             'ajuste'      -- correção de inventário (delta livre)
                           )),

  quantidade               integer NOT NULL CHECK (quantidade <> 0),  -- positivo ou negativo
  estoque_antes            integer NOT NULL,
  estoque_depois           integer NOT NULL,

  preco_unitario_momento   numeric(12,2),
  custo_total              numeric(12,2),

  -- vínculo opcional com gerente (em "entrega")
  gerente_id               uuid,
  gerente_nome             text,
  gerente_empresa          text,         -- snapshot (BSX / BetPlay) p/ histórico

  fornecedor               text,         -- usado em "entrada"
  nota_fiscal              text,         -- opcional em "entrada"

  motivo                   text,
  observacao               text,
  data_evento              date NOT NULL DEFAULT CURRENT_DATE,

  usuario_id               uuid,
  usuario_nome             text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bob_movs_empresa_idx ON public.bobinas_movimentacoes(empresa_id);
CREATE INDEX IF NOT EXISTS bob_movs_bobina_idx  ON public.bobinas_movimentacoes(bobina_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bob_movs_tipo_idx    ON public.bobinas_movimentacoes(empresa_id, tipo);
CREATE INDEX IF NOT EXISTS bob_movs_gerente_idx ON public.bobinas_movimentacoes(gerente_id) WHERE gerente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bob_movs_data_idx    ON public.bobinas_movimentacoes(empresa_id, data_evento DESC);

-- ============================================================
-- TRIGGER updated_at
-- (Reusa a função tg_set_updated_at criada pelo schema de peças,
-- ou cria se ainda não existir.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bobinas_set_updated_at ON public.bobinas;
CREATE TRIGGER bobinas_set_updated_at
  BEFORE UPDATE ON public.bobinas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- RLS (compatível com o restante do sistema)
-- ============================================================
ALTER TABLE public.bobinas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bobinas_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bobinas_all      ON public.bobinas;
DROP POLICY IF EXISTS bobinas_movs_all ON public.bobinas_movimentacoes;

CREATE POLICY bobinas_all      ON public.bobinas               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY bobinas_movs_all ON public.bobinas_movimentacoes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- LINHA INICIAL para a empresa BSX (tipo único)
-- ============================================================
INSERT INTO public.bobinas (empresa_id, nome, estoque_atual, estoque_minimo)
SELECT id, 'Bobina térmica', 0, 10
FROM public.empresas
WHERE nome = 'BSX'
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIM
-- ============================================================
-- Após executar, recarregue o sistema. A página "Bobinas" estará disponível
-- em "Máquinas → Bobinas".
-- ============================================================
