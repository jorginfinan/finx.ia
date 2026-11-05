-- ============================================================
-- MODALIDADE VIDEO GAME
-- Execute no Supabase SQL Editor ANTES de subir os arquivos.
-- Pode rodar mais de uma vez (tudo é IF NOT EXISTS).
-- ============================================================
-- Tabelas criadas:
--   vg_pontos      -> ponto, gerente responsável e as 3 comissões
--   vg_maquinas    -> video games do ponto e a leitura de partida
--   vg_prestacoes  -> cada leitura/prestação do ponto
-- Colunas novas:
--   lancamentos.modalidade e pendencias.modalidade ('JB' por padrão)
--
-- Valores de leitura e de dinheiro ficam em CENTAVOS (bigint),
-- igual à tela do video game: 150700 = R$ 1.507,00.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vg_pontos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome              text NOT NULL,
  gerente_id        text,
  gerente_nome      text,

  comissao1_nome    text NOT NULL DEFAULT 'Comissão 1',
  comissao1_pct     numeric(5,2) NOT NULL DEFAULT 0 CHECK (comissao1_pct BETWEEN 0 AND 100),
  comissao2_nome    text NOT NULL DEFAULT 'Comissão 2',
  comissao2_pct     numeric(5,2) NOT NULL DEFAULT 0 CHECK (comissao2_pct BETWEEN 0 AND 100),
  comissao3_nome    text NOT NULL DEFAULT 'Comissão 3',
  comissao3_pct     numeric(5,2) NOT NULL DEFAULT 0 CHECK (comissao3_pct BETWEEN 0 AND 100),
  base_comissao     text NOT NULL DEFAULT 'saldo' CHECK (base_comissao IN ('saldo', 'cascata')),

  -- negativo que o ponto já tinha ao começar a usar o sistema
  negativo_inicial  bigint NOT NULL DEFAULT 0 CHECK (negativo_inicial >= 0),

  ativo             boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vg_pontos_empresa_idx ON public.vg_pontos(empresa_id, ativo);

CREATE TABLE IF NOT EXISTS public.vg_maquinas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ponto_id     uuid NOT NULL REFERENCES public.vg_pontos(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  di_inicial   bigint NOT NULL DEFAULT 0 CHECK (di_inicial >= 0),
  ds_inicial   bigint NOT NULL DEFAULT 0 CHECK (ds_inicial >= 0),
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vg_maquinas_ponto_idx ON public.vg_maquinas(ponto_id, ativo);

CREATE TABLE IF NOT EXISTS public.vg_prestacoes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                text NOT NULL UNIQUE,
  empresa_id         uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ponto_id           uuid NOT NULL REFERENCES public.vg_pontos(id) ON DELETE RESTRICT,
  data               date NOT NULL,
  gerente_id         text,
  gerente_nome       text,
  saldo              bigint NOT NULL DEFAULT 0,
  negativo_anterior  bigint NOT NULL DEFAULT 0,
  negativo_novo      bigint NOT NULL DEFAULT 0,
  total_comissoes    bigint NOT NULL DEFAULT 0,
  liquido            bigint NOT NULL DEFAULT 0,
  dados              jsonb NOT NULL DEFAULT '{}'::jsonb,   -- leituras, comissões e pagamentos
  created_by         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- 🔒 Uma leitura por ponto em cada data
  CONSTRAINT vg_prestacoes_ponto_data_unique UNIQUE (ponto_id, data)
);
CREATE INDEX IF NOT EXISTS vg_prestacoes_empresa_idx ON public.vg_prestacoes(empresa_id, data DESC);

-- Caixa único: cada movimentação fica marcada com a modalidade
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS modalidade text NOT NULL DEFAULT 'JB';
ALTER TABLE public.pendencias  ADD COLUMN IF NOT EXISTS modalidade text NOT NULL DEFAULT 'JB';
CREATE INDEX IF NOT EXISTS lancamentos_modalidade_idx ON public.lancamentos(company, modalidade);

-- updated_at automático (mesma função dos módulos de peças e bobinas)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vg_pontos_set_updated_at ON public.vg_pontos;
CREATE TRIGGER vg_pontos_set_updated_at BEFORE UPDATE ON public.vg_pontos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS vg_maquinas_set_updated_at ON public.vg_maquinas;
CREATE TRIGGER vg_maquinas_set_updated_at BEFORE UPDATE ON public.vg_maquinas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS vg_prestacoes_set_updated_at ON public.vg_prestacoes;
CREATE TRIGGER vg_prestacoes_set_updated_at BEFORE UPDATE ON public.vg_prestacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS no mesmo padrão dos demais módulos do sistema
ALTER TABLE public.vg_pontos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vg_maquinas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vg_prestacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vg_pontos_all     ON public.vg_pontos;
DROP POLICY IF EXISTS vg_maquinas_all   ON public.vg_maquinas;
DROP POLICY IF EXISTS vg_prestacoes_all ON public.vg_prestacoes;
CREATE POLICY vg_pontos_all     ON public.vg_pontos     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY vg_maquinas_all   ON public.vg_maquinas   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY vg_prestacoes_all ON public.vg_prestacoes FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Conferência: se aparecer alguma linha aqui, me envie antes de subir os arquivos
-- (a pendência do video game usa prestacao_id, e uma chave estrangeira bloquearia).
SELECT conname, pg_get_constraintdef(oid) AS definicao
  FROM pg_constraint
 WHERE conrelid = 'public.pendencias'::regclass
   AND contype = 'f';
