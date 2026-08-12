-- ============================================================
-- CONTROLE DE PEÇAS DE MÁQUINAS
-- Execute este script no Supabase SQL Editor (uma única vez).
-- ============================================================
-- Tabelas criadas:
--   1) pecas                  -> catálogo + estoque atual de cada peça
--   2) pecas_movimentacoes    -> histórico de entrada/saída/ajuste do estoque
--   3) maquinas_pecas         -> peças que estão (ou já estiveram) montadas em cada máquina
-- ============================================================

-- ============================================================
-- 1) PEÇAS (catálogo + estoque)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pecas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  codigo               text NOT NULL,                 -- SKU / código interno
  nome                 text NOT NULL,                 -- nome curto da peça
  descricao            text,
  fornecedor           text,

  preco_custo          numeric(12,2) NOT NULL DEFAULT 0,
  preco_unitario       numeric(12,2) NOT NULL DEFAULT 0,

  estoque_atual        integer NOT NULL DEFAULT 0,
  estoque_minimo       integer NOT NULL DEFAULT 0,

  modelos_compativeis  text[] NOT NULL DEFAULT '{}',  -- ex.: {'Ingenico iWL250','Verifone V200'}
  observacao           text,

  ativo                boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pecas_codigo_empresa_uniq UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS pecas_empresa_idx       ON public.pecas(empresa_id);
CREATE INDEX IF NOT EXISTS pecas_ativo_idx         ON public.pecas(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS pecas_estoque_baixo_idx ON public.pecas(empresa_id) WHERE estoque_atual <= estoque_minimo AND ativo = true;
CREATE INDEX IF NOT EXISTS pecas_codigo_idx        ON public.pecas(codigo);

-- ============================================================
-- 2) MOVIMENTAÇÕES DE ESTOQUE DE PEÇAS
-- ============================================================
-- Cada linha é UMA alteração no estoque de UMA peça.
-- O saldo (estoque_atual em `pecas`) é mantido pela aplicação,
-- mas estoque_antes/depois ficam registrados para auditoria.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pecas_movimentacoes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  peca_id                 uuid NOT NULL REFERENCES public.pecas(id) ON DELETE CASCADE,

  tipo                    text NOT NULL CHECK (tipo IN (
                            'entrada',       -- compra/recebimento (soma)
                            'saida',         -- saída manual (subtrai)
                            'ajuste',        -- correção de inventário (delta livre)
                            'instalacao',    -- peça foi montada em uma máquina (subtrai)
                            'remocao'        -- peça retirada de uma máquina e voltou ao estoque (soma)
                          )),
  quantidade              integer NOT NULL CHECK (quantidade <> 0),  -- positivo ou negativo
  estoque_antes           integer NOT NULL,
  estoque_depois          integer NOT NULL,

  preco_unitario_momento  numeric(12,2),
  custo_total             numeric(12,2),  -- preco_unitario_momento * abs(quantidade)

  -- vínculos opcionais com a máquina
  maquina_id              uuid REFERENCES public.maquinas(id) ON DELETE SET NULL,
  maquina_movimentacao_id uuid REFERENCES public.maquinas_movimentacoes(id) ON DELETE SET NULL,

  motivo                  text,
  observacao              text,
  data_evento             date NOT NULL DEFAULT CURRENT_DATE,

  usuario_id              uuid,
  usuario_nome            text,

  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pecas_movs_empresa_idx ON public.pecas_movimentacoes(empresa_id);
CREATE INDEX IF NOT EXISTS pecas_movs_peca_idx    ON public.pecas_movimentacoes(peca_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pecas_movs_maquina_idx ON public.pecas_movimentacoes(maquina_id) WHERE maquina_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pecas_movs_tipo_idx    ON public.pecas_movimentacoes(empresa_id, tipo);

-- ============================================================
-- 3) PEÇAS MONTADAS EM CADA MÁQUINA (composição)
-- ============================================================
-- Uma linha = uma instalação de UMA peça em UMA máquina.
-- Quando a peça é removida (assistência), marcamos `removida = true`
-- em vez de apagar — assim mantemos o histórico completo.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maquinas_pecas (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  maquina_id                  uuid NOT NULL REFERENCES public.maquinas(id) ON DELETE CASCADE,
  peca_id                     uuid NOT NULL REFERENCES public.pecas(id),

  -- snapshot de dados da peça no momento (caso a peça seja editada/excluída depois)
  peca_codigo                 text,
  peca_nome                   text,

  quantidade                  integer NOT NULL DEFAULT 1,
  preco_unitario_momento      numeric(12,2),

  data_instalacao             date NOT NULL DEFAULT CURRENT_DATE,
  instalacao_observacao       text,
  instalacao_pecas_mov_id     uuid REFERENCES public.pecas_movimentacoes(id) ON DELETE SET NULL,
  instalacao_maquinas_mov_id  uuid REFERENCES public.maquinas_movimentacoes(id) ON DELETE SET NULL,

  removida                    boolean NOT NULL DEFAULT false,
  data_remocao                date,
  remocao_motivo              text,
  remocao_observacao          text,
  remocao_pecas_mov_id        uuid REFERENCES public.pecas_movimentacoes(id) ON DELETE SET NULL,
  remocao_maquinas_mov_id     uuid REFERENCES public.maquinas_movimentacoes(id) ON DELETE SET NULL,

  usuario_id                  uuid,
  usuario_nome                text,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maq_pecas_empresa_idx        ON public.maquinas_pecas(empresa_id);
CREATE INDEX IF NOT EXISTS maq_pecas_maquina_idx        ON public.maquinas_pecas(maquina_id);
CREATE INDEX IF NOT EXISTS maq_pecas_peca_idx           ON public.maquinas_pecas(peca_id);
CREATE INDEX IF NOT EXISTS maq_pecas_atual_idx          ON public.maquinas_pecas(maquina_id) WHERE removida = false;

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pecas_set_updated_at ON public.pecas;
CREATE TRIGGER pecas_set_updated_at
  BEFORE UPDATE ON public.pecas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS maq_pecas_set_updated_at ON public.maquinas_pecas;
CREATE TRIGGER maq_pecas_set_updated_at
  BEFORE UPDATE ON public.maquinas_pecas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- Como o restante do sistema usa anon key e filtra por empresa no client,
-- mantemos políticas permissivas. Ajuste se quiser endurecer.
-- ============================================================
ALTER TABLE public.pecas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pecas_movimentacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas_pecas       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pecas_all                ON public.pecas;
DROP POLICY IF EXISTS pecas_movs_all           ON public.pecas_movimentacoes;
DROP POLICY IF EXISTS maquinas_pecas_all       ON public.maquinas_pecas;

CREATE POLICY pecas_all                ON public.pecas               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pecas_movs_all           ON public.pecas_movimentacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY maquinas_pecas_all       ON public.maquinas_pecas      FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM
-- ============================================================
-- Após executar, recarregue o sistema. As novas tabelas estarão prontas.
