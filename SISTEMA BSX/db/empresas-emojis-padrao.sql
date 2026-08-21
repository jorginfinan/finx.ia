-- ============================================================
-- Popula os emojis padrão das empresas históricas
-- ============================================================
-- Restaura os ícones que existiam no HTML original.
-- Só atualiza se o emoji ainda estiver no default '🏢'.
-- ============================================================

UPDATE public.empresas
   SET emoji = '📺'
 WHERE UPPER(nome) = 'BSXTV'  AND (emoji IS NULL OR emoji = '🏢');

UPDATE public.empresas
   SET emoji = '🎮'
 WHERE UPPER(nome) = 'BETPLAY' AND (emoji IS NULL OR emoji = '🏢');

UPDATE public.empresas
   SET emoji = '👤'
 WHERE UPPER(nome) = 'EMANUEL' AND (emoji IS NULL OR emoji = '🏢');

-- BSX permanece '🏢' (já é o padrão) — não precisa mexer

NOTIFY pgrst, 'reload schema';
