-- Catálogo real (M7). Vocabulário controlado:
--   card_brand: mastercard | visa
--   card_level: gold | platinum | black | signature | infinite
-- Catálogo é autoritativo. Remoção ESCOPADA do catálogo demo (no-op em banco limpo,
-- relevante ao reaplicar sobre um banco com o seed demo do M5).
delete from benefits where id in (
  'd0000001-0000-0000-0000-000000000001',
  'd0000001-0000-0000-0000-000000000002',
  'd0000001-0000-0000-0000-000000000003');
delete from sources where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333');

-- (Tasks 2–5 inserem sources, source_items, benefits, benefit_sources,
--  benefit_card_tiers e benefit_locations abaixo desta linha.)

-- ===== SOURCES =====
insert into sources (slug, kind, name, sort_order, institution_url, country) values
  ('nubank', 'card', 'Nubank',      1, 'https://nubank.com.br', 'BR'),
  ('inter',  'card', 'Banco Inter', 2, 'https://inter.co',      'BR'),
  ('xp',     'card', 'XP',          3, 'https://www.xpi.com.br','BR')
on conflict (slug) do update set
  kind = excluded.kind, name = excluded.name, sort_order = excluded.sort_order,
  institution_url = excluded.institution_url, country = excluded.country;

-- ===== SOURCE_ITEMS =====
insert into source_items (slug, source_id, label, display_name, sort_order, card_brand, card_level, product_type, source_url, verification_status) values
  ('nubank-gold',              (select id from sources where slug='nubank'), 'Gold',        'Cartão Nubank Mastercard Gold',        1, 'mastercard','gold',    'credit_card',      'https://nubank.com.br/nu/cartao', 'official_confirmed'),
  ('nubank-platinum',          (select id from sources where slug='nubank'), 'Platinum',    'Cartão Nubank Mastercard Platinum',    2, 'mastercard','platinum','credit_card',      'https://nubank.com.br/nu/cartao', 'official_confirmed'),
  ('nubank-ultravioleta-black',(select id from sources where slug='nubank'), 'Ultravioleta','Nubank Ultravioleta Mastercard Black',  3, 'mastercard','black',   'credit_card',      'https://nubank.com.br/ultravioleta/cartao-black', 'official_confirmed'),
  ('inter-gold',               (select id from sources where slug='inter'),  'Gold',        'Cartão Inter Gold',                    1, 'mastercard','gold',    'credit_card',      'https://inter.co/pra-voce/cartoes/', 'official_confirmed'),
  ('inter-platinum',           (select id from sources where slug='inter'),  'Platinum',    'Cartão Inter Platinum',                2, 'mastercard','platinum','credit_card',      'https://inter.co/pra-voce/cartoes/', 'official_confirmed'),
  ('inter-prime',              (select id from sources where slug='inter'),  'Prime',       'Inter Prime',                          3, 'mastercard','black',   'credit_card',      'https://inter.co/pra-voce/relacionamento/inter-prime/', 'official_confirmed'),
  ('inter-win',                (select id from sources where slug='inter'),  'Win',         'Inter Win',                            4, 'mastercard','black',   'credit_card',      'https://inter.co/pra-voce/relacionamento/inter-win/', 'official_confirmed'),
  ('inter-duo-gourmet',        (select id from sources where slug='inter'),  'Duo Gourmet', 'Duo Gourmet (plano anual)',            5, null,        null,      'subscription_plan','https://inter.co/pra-voce/duo-gourmet/', 'official_confirmed'),
  ('xp-one',                   (select id from sources where slug='xp'),     'XP One',      'Cartão XP One',                        1, 'visa',      'infinite','credit_card',      'https://www.xpi.com.br/produtos/cartao-de-credito/', 'official_confirmed'),
  ('xp-infinite',              (select id from sources where slug='xp'),     'XP Infinite', 'Cartão XP Infinite',                   2, 'visa',      'infinite','credit_card',      'https://www.xpi.com.br/produtos/cartao-de-credito/', 'official_confirmed'),
  ('xp-legacy',                (select id from sources where slug='xp'),     'XP Legacy',   'Cartão XP Legacy',                     3, 'visa',      'infinite','credit_card',      'https://www.xpi.com.br/produtos/cartao-xp-legacy/', 'official_needs_regulation_check'),
  ('xp-digital',               (select id from sources where slug='xp'),     'XP Digital',  'XP Digital',                           4, null,        null,      'relationship_tier','https://www.xpi.com.br/app/', 'official_confirmed'),
  ('xp-exclusive',             (select id from sources where slug='xp'),     'XP Exclusive','XP Exclusive',                         5, null,        null,      'relationship_tier','https://www.xpi.com.br/app/', 'official_confirmed'),
  ('xp-signature',             (select id from sources where slug='xp'),     'XP Signature','XP Signature',                         6, null,        null,      'relationship_tier','https://www.xpi.com.br/app/', 'official_confirmed'),
  ('xp-unique',                (select id from sources where slug='xp'),     'XP Unique',   'XP Unique',                            7, null,        null,      'relationship_tier','https://www.xpi.com.br/app/', 'official_confirmed')
on conflict (slug) do update set
  source_id = excluded.source_id, label = excluded.label, display_name = excluded.display_name,
  sort_order = excluded.sort_order, card_brand = excluded.card_brand, card_level = excluded.card_level,
  product_type = excluded.product_type, source_url = excluded.source_url,
  verification_status = excluded.verification_status;

-- ===== BENEFITS (Task 3 — issuer/partner, caminho direto) =====
insert into benefits (slug, title, summary, category, scope, benefit_source, redemption_type,
  requires_activation, requires_eligible_card, requires_certificate,
  partner_name, limits_description, long_description, source_url, observed_at,
  verification_status, notes)
values

  -- ── Nubank Ultravioleta ───────────────────────────────────────────────────
  (
    'nubank-ultravioleta-pontos-cashback',
    'Pontos ou Cashback Ultravioleta',
    'Cliente escolhe acumular a partir de 2,2 pontos por dólar gasto ou 1,25% de cashback.',
    'points', 'nacional', 'issuer', 'app',
    true, false, false,
    'Nubank', null, null,
    'https://nubank.com.br/ultravioleta/cartao-black/pontos-cashback', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'nubank-ultravioleta-transferencia-milhas',
    'Transferência de pontos para LATAM, Azul e Gol',
    'Pontos Ultravioleta podem ser transferidos para programas de milhas de LATAM, Azul e Gol, conforme regras do Nubank.',
    'miles', 'nacional', 'mixed', 'points_exchange',
    true, false, false,
    'LATAM Pass, Azul, Gol/Smiles', null, null,
    'https://nubank.com.br/ultravioleta/cartao-black/pontos-cashback', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'nubank-ultravioleta-priority-pass',
    '4 acessos Priority Pass por ano',
    'Clientes Ultravioleta têm 4 visitas por ano à rede Priority Pass, com mais de 1.700 salas VIP em mais de 145 países.',
    'airport', 'nacional', 'partner', 'physical_access',
    true, false, false,
    'Priority Pass', '4 visitas por ano, conforme regras do Nubank Ultravioleta.', null,
    'https://nubank.com.br/ultravioleta/cartao-black/salas-vip', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'nubank-ultravioleta-lounge-gru',
    'Nubank Ultravioleta Lounge em Guarulhos',
    'Acesso gratuito e ilimitado ao Nubank Ultravioleta Lounge no Aeroporto Internacional de São Paulo/Guarulhos.',
    'airport', 'pontual', 'issuer', 'physical_access',
    true, false, false,
    'Nubank', 'Entrada permitida até 3 horas antes do voo; verificar regras de acompanhante no regulamento vigente.', null,
    'https://nubank.com.br/ultravioleta/cartao-black/ultravioleta-lounge', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'nubank-ultravioleta-nu-viagens',
    'Nu Viagens Ultravioleta',
    'Benefícios em passagens e hotéis, com acúmulo de 9 pontos por dólar ou 5% de cashback, parcelamento e garantia de melhor preço conforme regras.',
    'travel', 'nacional', 'issuer', 'app',
    true, false, false,
    'Nubank', null, null,
    'https://nubank.com.br/ultravioleta/nu-viagens', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'nubank-ultravioleta-iof-zero',
    'Compras internacionais com IOF zero',
    'Compras internacionais no crédito com IOF zero e spread reduzido informado pelo Nubank Ultravioleta.',
    'international_purchase', 'nacional', 'issuer', 'automatic',
    false, true, false,
    null, null, null,
    'https://nubank.com.br/ultravioleta', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── Inter Loop — por nível de cartão ─────────────────────────────────────
  (
    'inter-loop-pontos-gold',
    'Inter Loop — Gold',
    'Acúmulo de 1 ponto Loop a cada R$ 10,00 gastos no crédito.',
    'points', 'nacional', 'issuer', 'points_exchange',
    true, true, false,
    null, 'Para Gold, Platinum e Prime, fonte oficial informa necessidade de débito automático da fatura ativo para acumular pontos.', null,
    'https://inter.co/pra-voce/cartoes/programa-de-pontos/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'inter-loop-pontos-platinum',
    'Inter Loop — Platinum',
    'Acúmulo de 1 ponto Loop a cada R$ 5,00 gastos no crédito.',
    'points', 'nacional', 'issuer', 'points_exchange',
    true, true, false,
    null, null, null,
    'https://inter.co/pra-voce/cartoes/programa-de-pontos/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'inter-loop-pontos-prime',
    'Inter Loop — Prime',
    'Acúmulo de 1 ponto Loop a cada R$ 2,50 gastos no crédito.',
    'points', 'nacional', 'issuer', 'points_exchange',
    true, true, false,
    null, null, null,
    'https://inter.co/pra-voce/cartoes/programa-de-pontos/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'inter-loop-pontos-win',
    'Inter Loop — Win',
    'Acúmulo de 1 ponto Loop a cada R$ 2,00 gastos no crédito.',
    'points', 'nacional', 'issuer', 'points_exchange',
    true, true, false,
    null, null, null,
    'https://inter.co/pra-voce/cartoes/programa-de-pontos/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'inter-loop-resgate-milhas',
    'Troca de pontos Inter Loop por milhas',
    'Pontos Loop podem ser trocados por milhas aéreas. A fonte oficial cita Azul para clientes em geral e Smiles para clientes Prime ou Win.',
    'miles', 'nacional', 'mixed', 'points_exchange',
    true, false, false,
    'Azul, Smiles', null, null,
    'https://inter.co/pra-voce/cartoes/programa-de-pontos/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'inter-loop-desconto-fatura',
    'Desconto na fatura com pontos Loop',
    'Uso de pontos Loop para obter desconto na fatura do cartão.',
    'cashback', 'nacional', 'issuer', 'statement_credit',
    true, false, false,
    null, null, null,
    'https://inter.co/recompensas/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'inter-loop-cashback-inter-shop',
    'Cashback extra no Inter Shop',
    'Pontos Loop podem gerar cashback extra em compras no shopping do Inter.',
    'shopping', 'nacional', 'issuer', 'app',
    true, false, false,
    null, null, null,
    'https://inter.co/recompensas/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'inter-loop-dolares-global-account',
    'Troca de pontos por dólares na Global Account',
    'Pontos Loop podem ser convertidos em dólares na Global Account, conforme regras do Inter.',
    'account_service', 'nacional', 'issuer', 'points_exchange',
    true, false, false,
    null, null, null,
    'https://inter.co/pra-voce/cartoes/programa-de-pontos/', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── Inter Prime ───────────────────────────────────────────────────────────
  (
    'inter-prime-salas-vip',
    'Salas VIP Inter para clientes Prime',
    'Acesso às Salas VIP Inter em aeroportos informados na página do Duo Gourmet/Inter Prime.',
    'airport', 'nacional', 'issuer', 'physical_access',
    true, false, false,
    'Inter', 'A página do Duo Gourmet informa acesso ilimitado às salas VIP Inter para quem assina plano anual e desbloqueia Inter Prime. Confirmar regras no regulamento Prime.', null,
    'https://inter.co/pra-voce/duo-gourmet/', '2026-06-15',
    'official_needs_regulation_check', null
  ),
  (
    'inter-prime-priority-pass',
    'Priority Pass Inter Prime',
    'A página Duo Gourmet/Inter Prime informa 6 acessos anuais às salas VIP Priority Pass ao redor do mundo.',
    'airport', 'nacional', 'partner', 'physical_access',
    true, false, false,
    'Priority Pass', '6 acessos anuais informados na página do Duo Gourmet. Confirmar regras de elegibilidade e plano vigente.', null,
    'https://inter.co/pra-voce/duo-gourmet/', '2026-06-15',
    'official_needs_regulation_check', null
  ),

  -- ── Inter Duo Gourmet ─────────────────────────────────────────────────────
  (
    'inter-duo-gourmet-2-por-1',
    'Duo Gourmet — 2 pratos pelo preço de 1',
    'Benefício de pedir 2 pratos e pagar 1 em restaurantes participantes, sem limite de uso informado na página.',
    'restaurant', 'nacional', 'partner', 'app',
    true, false, false,
    'Duo Gourmet', null, null,
    'https://inter.co/pra-voce/duo-gourmet/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'inter-duo-experiencias',
    'Duo Experiências — lazer, viagem e bem-estar',
    'Descontos em experiências de viagem, lazer, bem-estar, hotéis, aluguel de carro, passeios, cinemas, teatros e parques, conforme parceiros disponíveis.',
    'experience', 'nacional', 'partner', 'app',
    true, false, false,
    'Duo Gourmet', null, null,
    'https://inter.co/pra-voce/duo-gourmet/', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── Inter Win ─────────────────────────────────────────────────────────────
  (
    'inter-win-gestao-patrimonial',
    'Gestão patrimonial Inter Win',
    'Atendimento com profissionais dedicados, diagnóstico patrimonial, análise de mercado e estratégias alinhadas a objetivos financeiros.',
    'investment', 'nacional', 'issuer', 'concierge',
    true, false, false,
    null, null, null,
    'https://inter.co/pra-voce/relacionamento/inter-win/', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── XP One ────────────────────────────────────────────────────────────────
  (
    'xp-one-pontos-investback',
    'Pontos XP ou Investback — XP One',
    'Até 1,8 Pontos XP por dólar ou até 1,1% de Investback com Turbo Benefícios.',
    'investback', 'nacional', 'issuer', 'app',
    true, true, false,
    null, null, null,
    'https://www.xpi.com.br/produtos/cartao-de-credito/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'xp-one-sala-vip',
    'Salas VIP — XP One',
    'Até 2 acessos por ano a salas VIP, conforme regras do cartão e gasto no cartão.',
    'airport', 'nacional', 'mixed', 'physical_access',
    true, false, false,
    null, 'Validar regra vigente no app/regulamento XP antes de produção.', null,
    'https://www.xpi.com.br/produtos/cartao-de-credito/', '2026-06-15',
    'official_needs_regulation_check', null
  ),

  -- ── XP Infinite ──────────────────────────────────────────────────────────
  (
    'xp-infinite-pontos-investback',
    'Pontos XP ou Investback — XP Infinite',
    'Até 3 Pontos XP por dólar ou até 1,5% de Investback com Turbo Benefícios.',
    'investback', 'nacional', 'issuer', 'app',
    true, true, false,
    null, null, null,
    'https://www.xpi.com.br/produtos/cartao-de-credito/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'xp-infinite-sala-vip',
    '4 acessos por ano a salas VIP — XP Infinite',
    'Cartão XP Infinite informa 4 acessos por ano a salas VIP.',
    'airport', 'nacional', 'mixed', 'physical_access',
    true, false, false,
    null, '4 acessos por ano, conforme fonte XP.', null,
    'https://www.xpi.com.br/produtos/cartao-de-credito/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'xp-infinite-fast-pass',
    'Fast Pass GRU/GIG',
    'Benefício de fila diferenciada nos aeroportos internacionais de Guarulhos e Galeão, conforme comunicação XP/Visa.',
    'airport', 'pontual', 'mixed', 'physical_access',
    true, false, false,
    'Visa', null, null,
    'https://www.xpi.com.br/produtos/cartao-de-credito/', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── XP Legacy ────────────────────────────────────────────────────────────
  (
    'xp-legacy-pontos-investback',
    'Pontos XP ou Investback — XP Legacy',
    '9,5 Pontos XP por dólar em compras internacionais e 3 Pontos XP por dólar em compras nacionais; ou 5,3% de Investback em compras internacionais e 1,5% em compras nacionais.',
    'investback', 'nacional', 'issuer', 'app',
    true, true, false,
    null, null, null,
    'https://www.xpi.com.br/produtos/cartao-xp-legacy/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'xp-legacy-salas-vip-ilimitado',
    'Salas VIP ilimitadas — XP Legacy',
    'Acesso ilimitado para o titular a mais de 1.300 salas VIP pelo mundo; até 12 convidados por ano, conforme condições.',
    'airport', 'nacional', 'mixed', 'physical_access',
    true, false, false,
    'Visa / rede parceira', 'Acesso ilimitado para titular; até 12 convidados por ano. Consultar condições.', null,
    'https://www.xpi.com.br/produtos/cartao-xp-legacy/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'xp-legacy-meet-greet',
    'Meet & Greet — XP Legacy',
    'Atendimento dedicado para embarques e desembarques com agilidade, consultado via Concierge Cartão XP Legacy.',
    'airport', 'pontual', 'mixed', 'concierge',
    true, false, false,
    null, null, null,
    'https://www.xpi.com.br/produtos/cartao-xp-legacy/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'xp-legacy-vistos-passaportes',
    'Consultoria de vistos e passaportes — XP Legacy',
    'Suporte especializado para emissão, renovação e regularização de documentos de viagem.',
    'travel', 'nacional', 'partner', 'concierge',
    true, false, false,
    null, null, null,
    'https://www.xpi.com.br/produtos/cartao-xp-legacy/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'xp-legacy-concierge',
    'Concierge Cartão XP Legacy',
    'Concierge com roteiros personalizados, apoio em viagens, hotéis, gastronomia e eventos.',
    'concierge', 'nacional', 'issuer', 'concierge',
    true, false, false,
    null, null, null,
    'https://www.xpi.com.br/produtos/cartao-xp-legacy/', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── XP Experience / Faixas de relacionamento ─────────────────────────────
  (
    'xp-experience-signature-assessoria',
    'Assessoria dedicada XP Signature',
    'Assessoria dedicada, atendimento presencial/vídeo/telefone, mesa de operações e eventos exclusivos.',
    'investment', 'nacional', 'issuer', 'concierge',
    true, false, false,
    null, null, null,
    'https://www.xpi.com.br/app/', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'xp-experience-unique-wealth-planning',
    'Wealth Planning XP Unique',
    'Bankers CFP, banker offshore, wealth planning, planejamento sucessório, fundos exclusivos e soluções customizadas.',
    'investment', 'nacional', 'issuer', 'concierge',
    true, false, false,
    null, null, null,
    'https://www.xpi.com.br/app/', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── XP Private ───────────────────────────────────────────────────────────
  (
    'xp-private-visa-infinite-privilege-lounge',
    'Visa Infinite Privilege Lounge — XP Private',
    'Acesso ao Visa Infinite Privilege Lounge no Aeroporto Internacional de Guarulhos para público elegível XP Private.',
    'airport', 'pontual', 'mixed', 'physical_access',
    true, false, false,
    'Visa', null, null,
    'https://private.xpi.com.br/xp-visa-infinite-privilege/', '2026-06-15',
    'official_confirmed', null
  )

on conflict (slug) do update set
  title                = excluded.title,
  summary              = excluded.summary,
  category             = excluded.category,
  scope                = excluded.scope,
  benefit_source       = excluded.benefit_source,
  redemption_type      = excluded.redemption_type,
  requires_activation  = excluded.requires_activation,
  requires_eligible_card = excluded.requires_eligible_card,
  requires_certificate = excluded.requires_certificate,
  partner_name         = excluded.partner_name,
  limits_description   = excluded.limits_description,
  long_description     = excluded.long_description,
  source_url           = excluded.source_url,
  observed_at          = excluded.observed_at,
  verification_status  = excluded.verification_status,
  notes                = excluded.notes;

-- ===== BENEFIT_SOURCES (Task 3 — links direto emissor/parceiro) =====
insert into benefit_sources (benefit_id, source_item_id)
select b.id, si.id from benefits b, source_items si
where (b.slug, si.slug) in (
  ('nubank-ultravioleta-priority-pass',          'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-lounge-gru',             'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-pontos-cashback',        'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-transferencia-milhas',   'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-nu-viagens',             'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-iof-zero',               'nubank-ultravioleta-black'),
  ('inter-loop-pontos-gold',                     'inter-gold'),
  ('inter-loop-pontos-platinum',                 'inter-platinum'),
  ('inter-loop-pontos-prime',                    'inter-prime'),
  ('inter-loop-pontos-win',                      'inter-win'),
  ('inter-loop-resgate-milhas',                  'inter-prime'),
  ('inter-loop-desconto-fatura',                 'inter-gold'),
  ('inter-loop-cashback-inter-shop',             'inter-gold'),
  ('inter-loop-dolares-global-account',          'inter-prime'),
  ('inter-prime-salas-vip',                      'inter-prime'),
  ('inter-prime-priority-pass',                  'inter-prime'),
  ('inter-duo-gourmet-2-por-1',                  'inter-duo-gourmet'),
  ('inter-duo-experiencias',                     'inter-duo-gourmet'),
  ('inter-win-gestao-patrimonial',              'inter-win'),
  ('xp-one-pontos-investback',                   'xp-one'),
  ('xp-one-sala-vip',                            'xp-one'),
  ('xp-infinite-pontos-investback',             'xp-infinite'),
  ('xp-infinite-sala-vip',                       'xp-infinite'),
  ('xp-infinite-fast-pass',                      'xp-infinite'),
  ('xp-legacy-pontos-investback',               'xp-legacy'),
  ('xp-legacy-salas-vip-ilimitado',             'xp-legacy'),
  ('xp-legacy-meet-greet',                       'xp-legacy'),
  ('xp-legacy-vistos-passaportes',              'xp-legacy'),
  ('xp-legacy-concierge',                        'xp-legacy'),
  ('xp-experience-signature-assessoria',        'xp-signature'),
  ('xp-experience-unique-wealth-planning',      'xp-unique'),
  ('xp-private-visa-infinite-privilege-lounge', 'xp-legacy')
)
on conflict do nothing;

-- ===== BENEFITS (Task 4 — card_network, caminho derivado) =====
insert into benefits (slug, title, summary, category, scope, benefit_source, redemption_type,
  requires_activation, requires_eligible_card, requires_certificate,
  partner_name, limits_description, long_description, source_url, observed_at,
  verification_status, notes)
values

  -- ── Mastercard Gold ──────────────────────────────────────────────────────
  (
    'mastercard-gold-protecao-preco',
    'Seguro Proteção de Preço Mastercard Gold',
    'Reembolso da diferença se o usuário encontrar o mesmo item por preço menor após a compra, conforme regras Mastercard Gold.',
    'shopping', 'nacional', 'card_network', 'insurance_claim',
    true, true, false,
    'Mastercard', null, null,
    'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/gold-credit-card.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'mastercard-gold-compra-protegida',
    'Seguro Compra Protegida Mastercard Gold',
    'Reembolso por roubo e/ou danos acidentais na compra de itens cobertos.',
    'insurance', 'nacional', 'card_network', 'insurance_claim',
    true, true, false,
    'Mastercard', null, null,
    'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/gold-credit-card.html', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── Mastercard Platinum ──────────────────────────────────────────────────
  (
    'mastercard-platinum-concierge',
    'Concierge Mastercard Platinum',
    'Concierge para organização de viagens, assistência global de emergência, entretenimento, informações e indicações.',
    'concierge', 'nacional', 'card_network', 'concierge',
    true, false, false,
    'Mastercard', null, null,
    'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/platinum-credit-card.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'mastercard-platinum-masterassist-plus',
    'MasterAssist Plus',
    'Reembolso de despesas médicas, convalescença em hotel, custos de viagens emergenciais para parentes e outros itens elegíveis.',
    'insurance', 'nacional', 'card_network', 'certificate',
    true, true, true,
    'Mastercard', null, null,
    'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/platinum-credit-card.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'mastercard-platinum-masterseguro-automoveis',
    'MasterSeguro de Automóveis',
    'Seguro que cobre danos a veículo alugado por colisão, roubo, incêndio acidental e vandalismo.',
    'insurance', 'nacional', 'card_network', 'insurance_claim',
    false, true, false,
    'Mastercard', null, null,
    'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/platinum-credit-card.html', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── Mastercard Black ─────────────────────────────────────────────────────
  (
    'mastercard-black-compra-protegida',
    'Compra Protegida Mastercard Black',
    'Reembolso por roubo e/ou danos acidentais em itens cobertos comprados com cartão elegível.',
    'insurance', 'nacional', 'card_network', 'insurance_claim',
    true, true, false,
    'Mastercard', null, null,
    'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/black-credit-card.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'mastercard-black-garantia-estendida',
    'Garantia Estendida Original Mastercard Black',
    'Duplica a garantia original do fabricante/loja por até 1 ano, respeitando limite máximo de cobertura total informado pela Mastercard.',
    'shopping', 'nacional', 'card_network', 'insurance_claim',
    true, true, false,
    'Mastercard', null, null,
    'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/black-credit-card/garantia-estendida-original.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'mastercard-black-concierge',
    'Mastercard Concierge Black',
    'Serviço de concierge para viagens, restaurantes, entretenimento e assistência em experiências.',
    'concierge', 'nacional', 'card_network', 'concierge',
    true, false, false,
    'Mastercard', null, null,
    'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/black-credit-card/concierge.html', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── Visa Infinite ─────────────────────────────────────────────────────────
  (
    'visa-infinite-seguro-emergencia-medica',
    'Seguro Emergência Médica Internacional Visa Infinite',
    'Proteção para acidentes ou emergências médicas internacionais em viagens, conforme regras Visa.',
    'insurance', 'nacional', 'card_network', 'certificate',
    true, true, true,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-infinite-seguro-veiculo-locadora',
    'Seguro para Veículos de Locadora Visa Infinite',
    'Proteção gratuita contra roubo e danos ao pagar e reservar a locação de automóvel com cartão Visa elegível.',
    'insurance', 'nacional', 'card_network', 'insurance_claim',
    false, true, false,
    'Visa', null, null,
    'https://www.visa.com.br/pt_br/shopping/so-com-visa/seguro-para-ve%C3%ADculos-de-locadora/141828', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-infinite-cancelamento-viagem',
    'Seguro Cancelamento de Viagem Visa Infinite',
    'Benefício de seguro para cancelamento de viagem, conforme regras Visa Infinite.',
    'insurance', 'nacional', 'card_network', 'insurance_claim',
    true, true, false,
    'Visa', null, null,
    'https://visabenefitslac.axa-assistance.us/benefits/I_C_BR', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-infinite-bagagem',
    'Seguro Perda, Roubo ou Atraso de Bagagem Visa Infinite',
    'Benefícios relacionados a perda, roubo ou atraso de bagagem, conforme regras Visa Infinite.',
    'insurance', 'nacional', 'card_network', 'insurance_claim',
    true, true, false,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-infinite-fast-pass',
    'Visa Infinite Fast Pass',
    'Acesso exclusivo Visa de embarque nos terminais 2 e 3 do Aeroporto de Guarulhos e no RIOgaleão.',
    'airport', 'pontual', 'card_network', 'physical_access',
    true, false, false,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-infinite-airport-companion',
    'Visa Airport Companion',
    'Benefício de acesso a experiências e serviços em aeroportos via Visa Airport Companion, conforme elegibilidade do cartão.',
    'airport', 'nacional', 'card_network', 'partner_portal',
    true, false, false,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-infinite-protecao-compra',
    'Proteção de Compra Visa Infinite',
    'Proteção contra roubo, furto ou danos acidentais em compras feitas com Cartão Visa elegível.',
    'shopping', 'nacional', 'card_network', 'insurance_claim',
    true, true, false,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-infinite-concierge',
    'Visa Concierge',
    'Assistência pessoal 24h para voos, restaurantes, presentes e outras solicitações elegíveis.',
    'concierge', 'nacional', 'card_network', 'concierge',
    true, false, false,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/cartoes-de-credito/detalhes-visa-infinite.html', '2026-06-15',
    'official_confirmed', null
  ),

  -- ── Visa Signature ────────────────────────────────────────────────────────
  (
    'visa-signature-airport-companion',
    'Visa Airport Companion — Signature',
    'Benefício de aeroportos disponível para cartões Visa Signature elegíveis, conforme regras Visa.',
    'airport', 'nacional', 'card_network', 'partner_portal',
    true, false, false,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-signature-seguro-emergencia-medica',
    'Seguro Emergência Médica Internacional Visa Signature',
    'Seguro de emergência médica internacional para cartões Visa Signature elegíveis, conforme regras Visa.',
    'insurance', 'nacional', 'card_network', 'certificate',
    true, true, true,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15',
    'official_confirmed', null
  ),
  (
    'visa-signature-protecao-compra',
    'Proteção de Compra Visa Signature',
    'Proteção contra roubo, furto ou danos acidentais em compras feitas com Cartão Visa elegível.',
    'shopping', 'nacional', 'card_network', 'insurance_claim',
    true, true, false,
    'Visa', null, null,
    'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15',
    'official_confirmed', null
  )

on conflict (slug) do update set
  title                = excluded.title,
  summary              = excluded.summary,
  category             = excluded.category,
  scope                = excluded.scope,
  benefit_source       = excluded.benefit_source,
  redemption_type      = excluded.redemption_type,
  requires_activation  = excluded.requires_activation,
  requires_eligible_card = excluded.requires_eligible_card,
  requires_certificate = excluded.requires_certificate,
  partner_name         = excluded.partner_name,
  limits_description   = excluded.limits_description,
  long_description     = excluded.long_description,
  source_url           = excluded.source_url,
  observed_at          = excluded.observed_at,
  verification_status  = excluded.verification_status,
  notes                = excluded.notes;

-- ===== BENEFIT_CARD_TIERS (Task 4 — links bandeira por brand/level) =====
insert into benefit_card_tiers (benefit_id, card_brand, card_level)
select b.id, t.card_brand, t.card_level
from benefits b
join (values
  ('mastercard-gold-protecao-preco',           'mastercard','gold'),
  ('mastercard-gold-compra-protegida',         'mastercard','gold'),
  ('mastercard-platinum-concierge',            'mastercard','platinum'),
  ('mastercard-platinum-masterassist-plus',    'mastercard','platinum'),
  ('mastercard-platinum-masterseguro-automoveis','mastercard','platinum'),
  ('mastercard-black-compra-protegida',        'mastercard','black'),
  ('mastercard-black-garantia-estendida',      'mastercard','black'),
  ('mastercard-black-concierge',               'mastercard','black'),
  ('visa-infinite-seguro-emergencia-medica',   'visa','infinite'),
  ('visa-infinite-seguro-veiculo-locadora',    'visa','infinite'),
  ('visa-infinite-cancelamento-viagem',        'visa','infinite'),
  ('visa-infinite-bagagem',                    'visa','infinite'),
  ('visa-infinite-fast-pass',                  'visa','infinite'),
  ('visa-infinite-airport-companion',          'visa','infinite'),
  ('visa-infinite-protecao-compra',            'visa','infinite'),
  ('visa-infinite-concierge',                  'visa','infinite'),
  ('visa-signature-airport-companion',         'visa','signature'),
  ('visa-signature-seguro-emergencia-medica',  'visa','signature'),
  ('visa-signature-protecao-compra',           'visa','signature')
) as t(slug, card_brand, card_level) on t.slug = b.slug
on conflict do nothing;

-- ===== BENEFIT_LOCATIONS (Task 5 — locais de resgate) =====
-- benefit_locations não tem chave natural; limpamos as do catálogo antes de reinserir
-- (idempotência: re-aplicar o seed não duplica locais). Só toca linhas de benefícios do catálogo (com slug).
delete from benefit_locations where benefit_id in (select id from benefits where slug is not null);

insert into benefit_locations (benefit_id, name, scope, country, region, uf, city, airport_code, terminal, lat, lng, geolocation_status)
select b.id, t.name, t.scope::location_scope, t.country, t.region, t.uf, t.city,
       t.airport_code, t.terminal, t.lat, t.lng, t.geolocation_status::geolocation_status
from benefits b
join (values
  ('nubank-ultravioleta-lounge-gru', 'Nubank Ultravioleta Lounge — GRU', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', 'Terminal 3', null::float8, null::float8, 'needs_geocoding'),
  ('nubank-ultravioleta-priority-pass', 'Rede Priority Pass', 'global_network', 'GLOBAL', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('nubank-ultravioleta-nu-viagens', 'App Nubank / Nu Viagens', 'online', 'BR', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('inter-prime-salas-vip', 'Sala VIP Inter — GRU', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', null, null::float8, null::float8, 'needs_geocoding'),
  ('inter-prime-salas-vip', 'Sala VIP Inter — CWB', 'airport', 'BR', 'Sul', 'PR', 'Curitiba', 'CWB', null, null::float8, null::float8, 'needs_geocoding'),
  ('inter-prime-salas-vip', 'Sala VIP Inter — CNF', 'airport', 'BR', 'Sudeste', 'MG', 'Confins', 'CNF', null, null::float8, null::float8, 'needs_geocoding'),
  ('inter-prime-salas-vip', 'Sala VIP Inter — FOR', 'airport', 'BR', 'Nordeste', 'CE', 'Fortaleza', 'FOR', null, null::float8, null::float8, 'needs_geocoding'),
  ('inter-prime-priority-pass', 'Rede Priority Pass', 'global_network', 'GLOBAL', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('inter-loop-cashback-inter-shop', 'Super App Inter / Inter Shop', 'online', 'BR', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('inter-duo-gourmet-2-por-1', 'Rede Duo Gourmet', 'global_network', 'BR', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('xp-infinite-fast-pass', 'Aeroporto de Guarulhos', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', null, null::float8, null::float8, 'needs_geocoding'),
  ('xp-legacy-salas-vip-ilimitado', 'Rede global de salas VIP', 'global_network', 'GLOBAL', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('xp-private-visa-infinite-privilege-lounge', 'Visa Infinite Privilege Lounge — GRU', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', null, null::float8, null::float8, 'needs_geocoding'),
  ('visa-infinite-fast-pass', 'Visa Infinite Fast Pass — GRU', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', 'Terminais 2 e 3', null::float8, null::float8, 'needs_geocoding'),
  ('visa-infinite-fast-pass', 'Visa Infinite Fast Pass — RIOgaleão', 'airport', 'BR', 'Sudeste', 'RJ', 'Rio de Janeiro', 'GIG', null, null::float8, null::float8, 'needs_geocoding'),
  ('visa-infinite-airport-companion', 'Visa Airport Companion', 'global_network', 'GLOBAL', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('visa-infinite-protecao-compra', 'Portal de Benefícios Visa', 'online', 'BR', null, null, null, null, null, null::float8, null::float8, 'not_applicable')
) as t(slug, name, scope, country, region, uf, city, airport_code, terminal, lat, lng, geolocation_status)
  on t.slug = b.slug;
