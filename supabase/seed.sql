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
insert into sources (slug, kind, name, sort_order, institution_url, country, source_category, logo_url, primary_color) values
  ('nubank', 'card', 'Nubank',      1, 'https://nubank.com.br', 'BR', 'bank_card', '/logos/nubank.svg', '#820AD1'),
  ('inter',  'card', 'Banco Inter', 2, 'https://inter.co',      'BR', 'bank_card', '/logos/inter.svg',  '#FF7A00'),
  ('xp',     'card', 'XP',          3, 'https://www.xpi.com.br','BR', 'bank_card', '/logos/xp.svg',     '#0B0B0B')
on conflict (slug) do update set
  kind = excluded.kind, name = excluded.name, sort_order = excluded.sort_order,
  institution_url = excluded.institution_url, country = excluded.country,
  source_category = excluded.source_category, logo_url = excluded.logo_url,
  primary_color = excluded.primary_color;

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

-- ===== VALOR ESTIMADO (paridade mockup) =====
-- Estimativa R$/ano por categoria — placeholder curado até haver valor real por
-- benefício. Só toca linhas do catálogo (com slug) ainda sem valor (idempotente).
update benefits set estimated_value_brl = case category
  when 'airport'                then 600
  when 'concierge'              then 250
  when 'travel'                 then 400
  when 'miles'                  then 350
  when 'insurance'              then 300
  when 'security'               then 250
  when 'cashback'               then 240
  when 'investback'             then 300
  when 'points'                 then 200
  when 'shopping'               then 180
  when 'restaurant'             then 220
  when 'international_purchase'  then 150
  when 'experience'             then 200
  when 'investment'             then 300
  when 'account_service'        then 120
  else 150 end
where slug is not null and estimated_value_brl is null;

-- ============================================================================
-- Mapa de Benefícios — Expansão do catálogo (paridade visual com os mockups)
-- ----------------------------------------------------------------------------
-- Adiciona 22 provedores em 5 categorias de fonte (bank_card, carrier, retail,
-- health, loyalty) além de nubank/inter/xp já semeados. Idempotente:
--   sources / source_items / benefits -> on conflict (slug) do update
--   benefit_sources                   -> on conflict do nothing
-- Vocabulário controlado (cards): card_brand mastercard|visa · card_level gold|
--   platinum|black|signature|infinite. Não-cards têm card_brand/level nulos.
-- Aplicar DEPOIS de supabase/seed.sql (mesmos catálogos de enum/colunas).
-- NÃO toca nubank/inter/xp.
-- ============================================================================

-- ===== SOURCES =====
insert into sources (slug, kind, name, sort_order, institution_url, country, source_category, logo_url, primary_color) values
  ('itau',           'card',    'Itaú',                     4, 'https://www.itau.com.br',                'BR', 'bank_card', '/logos/itau.svg',           '#EC7000'),
  ('bradesco',       'card',    'Bradesco',                 5, 'https://banco.bradesco',                 'BR', 'bank_card', '/logos/bradesco.svg',       '#CC092F'),
  ('c6',             'card',    'C6 Bank',                  6, 'https://www.c6bank.com.br',              'BR', 'bank_card', '/logos/c6.svg',             '#121212'),
  ('bb',             'card',    'Banco do Brasil',          7, 'https://www.bb.com.br',                  'BR', 'bank_card', '/logos/bb.svg',             '#0033A0'),
  ('santander',      'card',    'Santander',                8, 'https://www.santander.com.br',           'BR', 'bank_card', '/logos/santander.svg',      '#EC0000'),
  ('btg',            'card',    'BTG Pactual',              9, 'https://www.btgpactual.com',             'BR', 'bank_card', '/logos/btg.svg',            '#0A2A43'),
  ('mercado-pago',   'card',    'Mercado Pago',            10, 'https://www.mercadopago.com.br',         'BR', 'bank_card', '/logos/mercado-pago.svg',   '#00AEEF'),
  ('picpay',         'card',    'PicPay',                  11, 'https://www.picpay.com',                 'BR', 'bank_card', '/logos/picpay.svg',         '#11C76F'),
  ('vivo',           'carrier', 'Vivo',                    12, 'https://www.vivo.com.br',                'BR', 'carrier',   '/logos/vivo.svg',           '#660099'),
  ('claro',          'carrier', 'Claro',                   13, 'https://www.claro.com.br',               'BR', 'carrier',   '/logos/claro.svg',          '#DA291C'),
  ('tim',            'carrier', 'TIM',                     14, 'https://www.tim.com.br',                 'BR', 'carrier',   '/logos/tim.svg',            '#004691'),
  ('spotify',        'carrier', 'Spotify',                 15, 'https://www.spotify.com/br',             'BR', 'retail',    '/logos/spotify.svg',        '#1DB954'),
  ('disney-plus',    'carrier', 'Disney+',                 16, 'https://www.disneyplus.com',             'BR', 'retail',    '/logos/disney-plus.svg',    '#113CCF'),
  ('amazon-prime',   'carrier', 'Amazon Prime',            17, 'https://www.amazon.com.br/prime',        'BR', 'retail',    '/logos/amazon-prime.svg',   '#1399C6'),
  ('sulamerica',     'carrier', 'SulAmérica',              18, 'https://portal.sulamericaseguros.com.br','BR', 'health',    '/logos/sulamerica.svg',     '#00A859'),
  ('amil',           'carrier', 'Amil',                    19, 'https://www.amil.com.br',                'BR', 'health',    '/logos/amil.svg',           '#0061A8'),
  ('bradesco-saude', 'carrier', 'Bradesco Saúde',          20, 'https://www.bradescosaude.com.br',       'BR', 'health',    '/logos/bradesco-saude.svg', '#CC092F'),
  ('hapvida',        'carrier', 'Hapvida',                 21, 'https://www.hapvida.com.br',             'BR', 'health',    '/logos/hapvida.svg',        '#00833E'),
  ('notredame',      'carrier', 'NotreDame Intermédica',   22, 'https://www.gndi.com.br',                'BR', 'health',    '/logos/notredame.svg',      '#0033A0'),
  ('latam-pass',     'loyalty', 'LATAM Pass',              23, 'https://www.latampass.latam.com',        'BR', 'loyalty',   '/logos/latam-pass.svg',     '#1B0088'),
  ('smiles',         'loyalty', 'Smiles',                  24, 'https://www.smiles.com.br',              'BR', 'loyalty',   '/logos/smiles.svg',         '#FF7A00'),
  ('tudoazul',       'loyalty', 'TudoAzul',                25, 'https://www.voeazul.com.br/tudoazul',    'BR', 'loyalty',   '/logos/tudoazul.svg',       '#0033A0')
on conflict (slug) do update set
  kind = excluded.kind, name = excluded.name, sort_order = excluded.sort_order,
  institution_url = excluded.institution_url, country = excluded.country,
  source_category = excluded.source_category, logo_url = excluded.logo_url,
  primary_color = excluded.primary_color;

-- ===== SOURCE_ITEMS =====
insert into source_items (slug, source_id, label, display_name, sort_order, card_brand, card_level, product_type, source_url, verification_status) values
  ('itau-personnalite',   (select id from sources where slug='itau'),          'Personnalité','Cartão Itaú Personnalité Visa Infinite',       1, 'visa',      'infinite', 'credit_card',       'https://www.itau.com.br/cartoes/personnalite',              'official_confirmed'),
  ('bradesco-aeternum',   (select id from sources where slug='bradesco'),      'Aeternum',    'Cartão Bradesco Aeternum Visa Infinite',       1, 'visa',      'infinite', 'credit_card',       'https://banco.bradesco/cartoes',                            'official_confirmed'),
  ('c6-carbon',           (select id from sources where slug='c6'),            'C6 Carbon',   'Cartão C6 Carbon Mastercard Black',            1, 'mastercard','black',    'credit_card',       'https://www.c6bank.com.br/cartao-de-credito',               'official_confirmed'),
  ('bb-ourocard-black',   (select id from sources where slug='bb'),            'Ourocard Black','Ourocard Visa Infinite',                     1, 'visa',      'infinite', 'credit_card',       'https://www.bb.com.br/site/cartoes/',                       'official_confirmed'),
  ('santander-unlimited', (select id from sources where slug='santander'),     'Unlimited',   'Cartão Santander Unlimited Mastercard Black',  1, 'mastercard','black',    'credit_card',       'https://www.santander.com.br/cartoes',                      'official_confirmed'),
  ('btg-black',           (select id from sources where slug='btg'),           'BTG+ Black',  'Cartão BTG+ Black Mastercard Black',           1, 'mastercard','black',    'credit_card',       'https://www.btgpactual.com/para-voce/cartoes',              'official_confirmed'),
  ('mercado-pago-card',   (select id from sources where slug='mercado-pago'),  'Mercado Pago','Cartão Mercado Pago Mastercard',              1, 'mastercard','gold',     'digital_wallet',    'https://www.mercadopago.com.br/cartao',                     'official_confirmed'),
  ('picpay-card',         (select id from sources where slug='picpay'),        'PicPay Card', 'PicPay Card Mastercard',                       1, 'mastercard','gold',     'digital_wallet',    'https://www.picpay.com/produtos/cartao',                    'official_confirmed'),
  ('vivo-total',          (select id from sources where slug='vivo'),          'Vivo Total',  'Plano Vivo Total',                             1, null,        null,       'subscription_plan', 'https://www.vivo.com.br/para-voce/planos',                  'official_confirmed'),
  ('claro-max',           (select id from sources where slug='claro'),         'Claro Max',   'Plano Claro Pós Max',                          1, null,        null,       'subscription_plan', 'https://www.claro.com.br/celular/planos',                   'official_confirmed'),
  ('tim-black',           (select id from sources where slug='tim'),           'TIM Black',   'Plano TIM Black',                              1, null,        null,       'subscription_plan', 'https://www.tim.com.br/planos',                             'official_confirmed'),
  ('spotify-premium',     (select id from sources where slug='spotify'),       'Premium',     'Spotify Premium',                              1, null,        null,       'subscription_plan', 'https://www.spotify.com/br/premium/',                       'official_confirmed'),
  ('disney-plus-premium', (select id from sources where slug='disney-plus'),   'Premium',     'Disney+ Plano Premium',                        1, null,        null,       'subscription_plan', 'https://www.disneyplus.com/pt-br',                          'official_confirmed'),
  ('amazon-prime-plan',   (select id from sources where slug='amazon-prime'),  'Prime',       'Amazon Prime',                                 1, null,        null,       'subscription_plan', 'https://www.amazon.com.br/prime',                           'official_confirmed'),
  ('sulamerica-saude',    (select id from sources where slug='sulamerica'),    'Saúde',       'SulAmérica Saúde',                             1, null,        null,       'health_plan',       'https://portal.sulamericaseguros.com.br/planos-de-saude',   'official_confirmed'),
  ('amil-one',            (select id from sources where slug='amil'),          'Amil One',    'Amil One Health',                              1, null,        null,       'health_plan',       'https://www.amil.com.br',                                   'official_confirmed'),
  ('bradesco-saude-top',  (select id from sources where slug='bradesco-saude'),'Top Nacional','Bradesco Saúde Top Nacional',                  1, null,        null,       'health_plan',       'https://www.bradescosaude.com.br',                          'official_confirmed'),
  ('hapvida-plan',        (select id from sources where slug='hapvida'),       'Hapvida',     'Plano Hapvida',                                1, null,        null,       'health_plan',       'https://www.hapvida.com.br/site/planos',                    'official_confirmed'),
  ('notredame-advance',   (select id from sources where slug='notredame'),     'Advance',     'NotreDame Intermédica Advance',                1, null,        null,       'health_plan',       'https://www.gndi.com.br/planos-de-saude',                   'official_confirmed'),
  ('latam-pass-program',  (select id from sources where slug='latam-pass'),    'LATAM Pass',  'Programa LATAM Pass',                          1, null,        null,       'loyalty_program',   'https://www.latampass.latam.com',                           'official_confirmed'),
  ('smiles-program',      (select id from sources where slug='smiles'),        'Smiles',      'Programa Smiles',                              1, null,        null,       'loyalty_program',   'https://www.smiles.com.br',                                 'official_confirmed'),
  ('tudoazul-program',    (select id from sources where slug='tudoazul'),      'TudoAzul',    'Programa TudoAzul',                            1, null,        null,       'loyalty_program',   'https://www.voeazul.com.br/tudoazul',                       'official_confirmed')
on conflict (slug) do update set
  source_id = excluded.source_id, label = excluded.label, display_name = excluded.display_name,
  sort_order = excluded.sort_order, card_brand = excluded.card_brand, card_level = excluded.card_level,
  product_type = excluded.product_type, source_url = excluded.source_url,
  verification_status = excluded.verification_status;

-- ===== BENEFITS =====
-- Colunas = subconjunto de seed.sql + steps/action_url/action_label/estimated_value_brl
-- (colunas do schema, exigidas pelo pedido; requires_*/notes/limits ficam no default).
insert into benefits (slug, title, summary, category, scope, benefit_source, redemption_type,
  partner_name, long_description, steps, action_url, action_label,
  estimated_value_brl, source_url, observed_at, verification_status)
values

  -- ── Itaú Personnalité ─────────────────────────────────────────────────────
  (
    'itau-personnalite-sala-vip',
    'Salas VIP em aeroportos — Personnalité',
    'Acesso a salas VIP nos principais aeroportos para clientes Personnalité, conforme regras do cartão.',
    'airport', 'nacional', 'issuer', 'physical_access',
    'Itaú',
    'Clientes Personnalité têm acesso a salas VIP nacionais e internacionais. A quantidade de acessos e convidados segue o regulamento vigente do cartão.',
    E'Abra o app Itaú e acesse Cartões > Benefícios\nGere o acesso à sala VIP para o aeroporto desejado\nApresente o cartão de acesso na recepção da sala',
    'https://www.itau.com.br/cartoes/personnalite',
    'Ver benefício',
    800, 'https://www.itau.com.br/cartoes/personnalite', '2026-06-15',
    'official_needs_regulation_check'
  ),
  (
    'itau-personnalite-sempre-presente',
    'Pontos Sempre Presente',
    'Acúmulo de pontos no programa Sempre Presente, trocáveis por produtos, milhas e descontos na fatura.',
    'points', 'nacional', 'issuer', 'points_exchange',
    'Sempre Presente',
    'Cada compra no crédito acumula pontos no programa de relacionamento do Itaú, que podem ser transferidos para parceiros aéreos ou usados no catálogo.',
    E'Ative o programa Sempre Presente no app Itaú\nUse o cartão de crédito nas compras do dia a dia\nResgate os pontos no site Sempre Presente por produtos ou milhas',
    'https://www.credicard.com.br/sempre-presente',
    'Resgatar pontos',
    300, 'https://www.itau.com.br/cartoes/personnalite', '2026-06-15',
    'official_confirmed'
  ),
  (
    'itau-personnalite-assessoria',
    'Assessoria de investimentos dedicada',
    'Gerente e assessoria de investimentos exclusiva para clientes do segmento Personnalité.',
    'investment', 'nacional', 'issuer', 'concierge',
    null,
    'O segmento Personnalité oferece atendimento com gerente dedicado e assessoria de investimentos para montar a carteira conforme o perfil do cliente.',
    E'Torne-se cliente Personnalité no app ou agência\nAgende conversa com seu gerente dedicado\nReceba recomendações de investimentos personalizadas',
    'https://www.itau.com.br/personnalite',
    'Falar com gerente',
    500, 'https://www.itau.com.br/personnalite', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Bradesco Aeternum ─────────────────────────────────────────────────────
  (
    'bradesco-aeternum-sala-vip',
    'Salas VIP LoungeKey — Aeternum',
    'Acessos anuais a salas VIP da rede LoungeKey para o titular do cartão Bradesco Aeternum.',
    'airport', 'nacional', 'mixed', 'physical_access',
    'LoungeKey',
    'O cartão Bradesco Aeternum dá acesso a salas VIP em aeroportos de todo o mundo pela rede LoungeKey, conforme quantidade de acessos do regulamento.',
    E'Acesse o app Bradesco Cartões > Aeternum\nConsulte as salas LoungeKey disponíveis\nApresente o cartão elegível na entrada da sala',
    'https://banco.bradesco/cartoes',
    'Ver salas VIP',
    700, 'https://banco.bradesco/cartoes', '2026-06-15',
    'official_needs_regulation_check'
  ),
  (
    'bradesco-livelo-pontos',
    'Pontos Livelo nas compras',
    'Acúmulo de pontos Livelo nas compras do cartão, trocáveis por passagens, produtos e milhas.',
    'points', 'nacional', 'partner', 'points_exchange',
    'Livelo',
    'As compras no crédito acumulam pontos Livelo, o programa de fidelidade do Bradesco em parceria com o Banco do Brasil, com resgate por milhas e produtos.',
    E'Cadastre o CPF no programa Livelo\nUse o cartão Bradesco nas compras do dia a dia\nResgate os pontos no site Livelo por milhas ou produtos',
    'https://www.livelo.com.br',
    'Resgatar pontos',
    300, 'https://banco.bradesco/cartoes', '2026-06-15',
    'official_confirmed'
  ),
  (
    'bradesco-aeternum-concierge',
    'Concierge Aeternum 24h',
    'Serviço de concierge 24h para reservas, viagens e assistência ao titular Aeternum.',
    'concierge', 'nacional', 'issuer', 'concierge',
    null,
    'Concierge disponível 24 horas para auxiliar em reservas de restaurantes, hotéis, compra de ingressos e organização de viagens.',
    E'Localize o telefone do Concierge no verso do cartão\nEntre em contato informando os dados do cartão\nSolicite a reserva ou assistência desejada',
    'https://banco.bradesco/cartoes',
    'Acionar concierge',
    250, 'https://banco.bradesco/cartoes', '2026-06-15',
    'official_confirmed'
  ),

  -- ── C6 Bank (Carbon) ──────────────────────────────────────────────────────
  (
    'c6-atomos-pontos',
    'Programa Átomos — pontos sem expiração',
    'Acúmulo de pontos Átomos que não expiram, trocáveis por milhas, produtos e desconto na fatura.',
    'points', 'nacional', 'issuer', 'points_exchange',
    'Átomos',
    'O programa Átomos do C6 Bank acumula pontos que nunca expiram enquanto o cliente mantiver a conta ativa, com transferência para parceiros aéreos.',
    E'Ative o programa Átomos no app C6 Bank\nUse o cartão de crédito nas compras\nResgate os pontos por milhas, produtos ou desconto na fatura',
    'https://www.c6bank.com.br/pontos-atomos',
    'Resgatar pontos',
    250, 'https://www.c6bank.com.br/cartao-de-credito', '2026-06-15',
    'official_confirmed'
  ),
  (
    'c6-carbon-sala-vip',
    'Salas VIP — C6 Carbon',
    'Acessos a salas VIP em aeroportos para clientes C6 Carbon, conforme regras do cartão.',
    'airport', 'nacional', 'mixed', 'physical_access',
    'Mastercard',
    'O cartão C6 Carbon Mastercard Black oferece acessos a salas VIP em aeroportos nacionais e internacionais, conforme o regulamento vigente.',
    E'Abra o app C6 Bank > Cartões > Carbon\nGere o acesso à sala VIP para o aeroporto\nApresente o acesso na recepção da sala',
    'https://www.c6bank.com.br/cartao-de-credito',
    'Ver benefício',
    600, 'https://www.c6bank.com.br/cartao-de-credito', '2026-06-15',
    'official_needs_regulation_check'
  ),
  (
    'c6-tag-sem-mensalidade',
    'C6 Tag sem mensalidade',
    'Tag de pedágio e estacionamento sem mensalidade, com pagamento automático pelo app.',
    'other', 'nacional', 'issuer', 'app',
    null,
    'A C6 Tag permite passar em pedágios e estacionamentos conveniados sem parar, sem cobrança de mensalidade, com débito automático na conta.',
    E'Solicite a C6 Tag no app C6 Bank\nCole a tag no para-brisa do veículo\nPasse pelas cancelas conveniadas com pagamento automático',
    'https://www.c6bank.com.br/tag-de-pedagio',
    'Pedir C6 Tag',
    120, 'https://www.c6bank.com.br/tag-de-pedagio', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Banco do Brasil (Ourocard Black) ─────────────────────────────────────
  (
    'bb-ourocard-sala-vip',
    'Salas VIP — Ourocard Black',
    'Acessos a salas VIP em aeroportos para clientes Ourocard Black, conforme regras do cartão.',
    'airport', 'nacional', 'mixed', 'physical_access',
    'Visa',
    'O Ourocard Black oferece acesso a salas VIP em aeroportos pela rede da bandeira, com quantidade de acessos definida no regulamento do cartão.',
    E'Acesse o app BB > Cartões > Benefícios\nGere o acesso à sala VIP no aeroporto\nApresente o acesso na recepção da sala',
    'https://www.bb.com.br/site/cartoes/',
    'Ver benefício',
    600, 'https://www.bb.com.br/site/cartoes/', '2026-06-15',
    'official_needs_regulation_check'
  ),
  (
    'bb-ourocard-livelo',
    'Pontos Livelo — Ourocard',
    'Acúmulo de pontos Livelo nas compras do Ourocard, com resgate por milhas e produtos.',
    'points', 'nacional', 'partner', 'points_exchange',
    'Livelo',
    'As compras no Ourocard acumulam pontos Livelo, o programa de fidelidade do Banco do Brasil em parceria com o Bradesco.',
    E'Cadastre o CPF no programa Livelo\nUse o Ourocard nas compras do dia a dia\nResgate os pontos no site Livelo por milhas ou produtos',
    'https://www.livelo.com.br',
    'Resgatar pontos',
    250, 'https://www.bb.com.br/site/cartoes/', '2026-06-15',
    'official_confirmed'
  ),
  (
    'bb-ourocard-seguro-viagem',
    'Seguro viagem internacional — Ourocard Black',
    'Seguro de emergência médica internacional ao pagar a passagem com o Ourocard Black.',
    'insurance', 'nacional', 'card_network', 'certificate',
    'Visa',
    'Ao comprar a passagem com o cartão elegível, o titular conta com seguro de emergência médica em viagens internacionais, conforme certificado da bandeira.',
    E'Pague a passagem com o Ourocard Black\nEmita o certificado do seguro no portal da bandeira\nEm emergência, acione a central informada no certificado',
    'https://www.bb.com.br/site/cartoes/',
    'Emitir certificado',
    300, 'https://www.bb.com.br/site/cartoes/', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Santander (Unlimited) ─────────────────────────────────────────────────
  (
    'santander-esfera-pontos',
    'Pontos Esfera',
    'Acúmulo de pontos no programa Esfera, trocáveis por produtos, viagens e milhas.',
    'points', 'nacional', 'issuer', 'points_exchange',
    'Esfera',
    'O programa de pontos Esfera do Santander permite acumular nas compras e resgatar por produtos, gift cards e transferência para parceiros aéreos.',
    E'Cadastre-se no programa Esfera\nUse o cartão Santander nas compras\nResgate os pontos no site Esfera por produtos ou milhas',
    'https://www.esfera.com.vc',
    'Resgatar pontos',
    300, 'https://www.santander.com.br/cartoes', '2026-06-15',
    'official_confirmed'
  ),
  (
    'santander-unlimited-sala-vip',
    'Salas VIP — Santander Unlimited',
    'Acessos a salas VIP em aeroportos para clientes Santander Unlimited, conforme regras do cartão.',
    'airport', 'nacional', 'mixed', 'physical_access',
    'Mastercard',
    'O cartão Santander Unlimited Mastercard Black dá acesso a salas VIP em aeroportos, com quantidade de acessos definida no regulamento vigente.',
    E'Abra o app Santander > Cartões > Unlimited\nGere o acesso à sala VIP no aeroporto\nApresente o acesso na recepção da sala',
    'https://www.santander.com.br/cartoes',
    'Ver benefício',
    700, 'https://www.santander.com.br/cartoes', '2026-06-15',
    'official_needs_regulation_check'
  ),
  (
    'santander-esfera-avios',
    'Transferência de pontos para milhas',
    'Pontos Esfera podem ser transferidos para programas de milhas e parceiros aéreos.',
    'miles', 'nacional', 'mixed', 'points_exchange',
    'Esfera',
    'O programa Esfera permite transferir pontos para parceiros de milhagem, ampliando o alcance dos pontos acumulados nas compras.',
    E'Acesse sua conta no site Esfera\nEscolha o parceiro aéreo de destino\nConfirme a transferência dos pontos para milhas',
    'https://www.esfera.com.vc',
    'Transferir pontos',
    350, 'https://www.santander.com.br/cartoes', '2026-06-15',
    'official_confirmed'
  ),

  -- ── BTG Pactual (BTG+ Black) ──────────────────────────────────────────────
  (
    'btg-black-sala-vip',
    'Salas VIP — BTG+ Black',
    'Acessos a salas VIP em aeroportos para clientes do cartão BTG+ Black, conforme regras do cartão.',
    'airport', 'nacional', 'mixed', 'physical_access',
    'Mastercard',
    'O cartão BTG+ Black Mastercard Black oferece acessos a salas VIP em aeroportos nacionais e internacionais conforme regulamento vigente.',
    E'Abra o app BTG+ > Cartões > Black\nGere o acesso à sala VIP no aeroporto\nApresente o acesso na recepção da sala',
    'https://www.btgpactual.com/para-voce/cartoes',
    'Ver benefício',
    700, 'https://www.btgpactual.com/para-voce/cartoes', '2026-06-15',
    'official_needs_regulation_check'
  ),
  (
    'btg-black-cashback',
    'Cashback BTG+',
    'Cashback nas compras do cartão creditado diretamente na conta BTG+.',
    'cashback', 'nacional', 'issuer', 'statement_credit',
    null,
    'O cartão BTG+ Black devolve parte do valor gasto como cashback na conta, que pode ser investido automaticamente conforme a preferência do cliente.',
    E'Ative o cartão BTG+ Black no app\nUse o cartão nas compras do dia a dia\nAcompanhe o cashback creditado na conta BTG+',
    'https://www.btgpactual.com/para-voce/cartoes',
    'Ver cashback',
    240, 'https://www.btgpactual.com/para-voce/cartoes', '2026-06-15',
    'official_confirmed'
  ),
  (
    'btg-assessoria-investimentos',
    'Assessoria de investimentos BTG',
    'Atendimento com assessor dedicado e acesso a produtos de investimento do BTG Pactual.',
    'investment', 'nacional', 'issuer', 'concierge',
    null,
    'Clientes do banco de investimentos contam com assessor dedicado para montar a carteira e acessar produtos exclusivos da plataforma BTG.',
    E'Abra conta no app BTG+ investimentos\nFale com seu assessor dedicado\nMonte a carteira conforme seu perfil de investidor',
    'https://www.btgpactual.com/para-voce/investimentos',
    'Falar com assessor',
    500, 'https://www.btgpactual.com/para-voce/investimentos', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Mercado Pago ──────────────────────────────────────────────────────────
  (
    'mercado-pago-rendimento',
    'Rendimento automático no saldo',
    'O dinheiro guardado na conta Mercado Pago rende automaticamente todos os dias.',
    'account_service', 'nacional', 'issuer', 'automatic',
    null,
    'O saldo disponível na conta Mercado Pago rende automaticamente conforme a taxa vigente, com liquidez diária e sem necessidade de aplicação manual.',
    E'Mantenha saldo na conta Mercado Pago\nO rendimento é creditado automaticamente todos os dias\nAcompanhe os rendimentos na tela inicial do app',
    'https://www.mercadopago.com.br/rendimento',
    'Ver rendimento',
    150, 'https://www.mercadopago.com.br', '2026-06-15',
    'official_confirmed'
  ),
  (
    'mercado-pago-cashback',
    'Cashback no Mercado Livre',
    'Cashback e descontos ao pagar compras no Mercado Livre e em parceiros com Mercado Pago.',
    'cashback', 'nacional', 'issuer', 'app',
    'Mercado Livre',
    'Pagamentos com Mercado Pago no Mercado Livre e em lojas parceiras geram cashback em dinheiro, creditado na conta para uso em novas compras.',
    E'Pague com Mercado Pago no Mercado Livre ou parceiros\nReceba o cashback na conta Mercado Pago\nUse o saldo em novas compras ou pagamentos',
    'https://www.mercadopago.com.br',
    'Ver ofertas',
    200, 'https://www.mercadopago.com.br', '2026-06-15',
    'official_confirmed'
  ),
  (
    'mercado-pago-meli-plus',
    'Meli+ — frete grátis e benefícios',
    'Assinatura Meli+ com frete grátis no Mercado Livre e benefícios de streaming parceiros.',
    'shopping', 'nacional', 'partner', 'app',
    'Meli+',
    'A assinatura Meli+ oferece frete grátis em compras elegíveis no Mercado Livre e acesso a benefícios de parceiros de streaming.',
    E'Assine o Meli+ no app Mercado Livre ou Mercado Pago\nAproveite frete grátis nas compras elegíveis\nAtive os benefícios de streaming parceiros',
    'https://www.mercadolivre.com.br/meli-mais',
    'Assinar Meli+',
    180, 'https://www.mercadopago.com.br', '2026-06-15',
    'partner_network'
  ),

  -- ── PicPay ────────────────────────────────────────────────────────────────
  (
    'picpay-cashback',
    'Cashback PicPay',
    'Cashback em pagamentos, recargas e compras feitas pelo app PicPay.',
    'cashback', 'nacional', 'issuer', 'app',
    null,
    'O PicPay devolve parte do valor como cashback em pagamentos de contas, recargas de celular e compras em lojas parceiras.',
    E'Pague contas ou compre com o PicPay\nReceba o cashback no saldo PicPay\nUse o saldo em novos pagamentos ou transfira',
    'https://www.picpay.com',
    'Ver ofertas',
    180, 'https://www.picpay.com', '2026-06-15',
    'official_confirmed'
  ),
  (
    'picpay-rendimento',
    'Rendimento no saldo PicPay',
    'O saldo guardado no PicPay rende um percentual do CDI com liquidez diária.',
    'account_service', 'nacional', 'issuer', 'automatic',
    null,
    'O dinheiro guardado na conta PicPay rende diariamente um percentual do CDI, sem prazo de carência e com resgate a qualquer momento.',
    E'Mantenha saldo guardado na conta PicPay\nO rendimento é creditado automaticamente\nResgate quando quiser, com liquidez diária',
    'https://www.picpay.com',
    'Ver rendimento',
    150, 'https://www.picpay.com', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Vivo (Vivo Total) ─────────────────────────────────────────────────────
  (
    'vivo-disney-incluso',
    'Disney+ incluso no plano',
    'Assinatura Disney+ inclusa em planos Vivo Total elegíveis, sem custo adicional.',
    'experience', 'nacional', 'partner', 'app',
    'Disney+',
    'Planos Vivo Total elegíveis incluem a assinatura do Disney+ sem cobrança adicional, com ativação pelo app Vivo ou pela central.',
    E'Contrate um plano Vivo Total elegível\nAtive o Disney+ na seção de vantagens do app Vivo\nAcesse o conteúdo com sua conta Disney+',
    'https://www.vivo.com.br/para-voce/vantagens',
    'Ativar Disney+',
    240, 'https://www.vivo.com.br/para-voce/planos', '2026-06-15',
    'partner_network'
  ),
  (
    'vivo-valoriza-descontos',
    'Vivo Valoriza — descontos e sorteios',
    'Programa Vivo Valoriza com descontos em parceiros, brindes e sorteios para clientes.',
    'experience', 'nacional', 'issuer', 'app',
    'Vivo Valoriza',
    'O programa de relacionamento Vivo Valoriza oferece descontos em parceiros, cupons e participação em sorteios, conforme o tempo de casa do cliente.',
    E'Acesse a seção Vivo Valoriza no app Vivo\nEscolha o desconto ou cupom desejado\nResgate e utilize no parceiro participante',
    'https://www.vivo.com.br/para-voce/vivo-valoriza',
    'Ver vantagens',
    180, 'https://www.vivo.com.br/para-voce/planos', '2026-06-15',
    'official_confirmed'
  ),
  (
    'vivo-apps-ilimitados',
    'Apps de mensagem e redes ilimitados',
    'Uso de WhatsApp e redes sociais selecionadas sem consumir a franquia de dados do plano.',
    'other', 'nacional', 'issuer', 'automatic',
    null,
    'Planos Vivo Total elegíveis permitem usar WhatsApp e redes sociais selecionadas sem descontar da franquia de internet contratada.',
    E'Contrate um plano Vivo Total elegível\nUse os apps participantes normalmente\nO consumo não desconta da franquia de dados',
    'https://www.vivo.com.br/para-voce/planos',
    'Ver plano',
    160, 'https://www.vivo.com.br/para-voce/planos', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Claro (Claro Max) ─────────────────────────────────────────────────────
  (
    'claro-streaming-incluso',
    'Streaming incluso (Max e parceiros)',
    'Aplicativos de streaming inclusos em planos Claro Pós Max elegíveis, sem custo adicional.',
    'experience', 'nacional', 'partner', 'app',
    'Max',
    'Planos Claro Pós Max elegíveis incluem apps de streaming como Max e parceiros, com ativação pelo app Minha Claro.',
    E'Contrate um plano Claro Pós Max elegível\nAtive o streaming no app Minha Claro\nAcesse o conteúdo com seu login do parceiro',
    'https://www.claro.com.br/celular/planos',
    'Ativar streaming',
    240, 'https://www.claro.com.br/celular/planos', '2026-06-15',
    'partner_network'
  ),
  (
    'claro-clube-descontos',
    'Claro Clube — pontos e descontos',
    'Programa Claro Clube com pontos, descontos e trocas por benefícios para clientes.',
    'experience', 'nacional', 'issuer', 'app',
    'Claro Clube',
    'O programa Claro Clube acumula pontos com o pagamento das faturas, trocáveis por descontos, gigas extras e produtos de parceiros.',
    E'Acesse o Claro Clube no app Minha Claro\nAcompanhe os pontos acumulados\nTroque os pontos por descontos ou gigas extras',
    'https://www.claro.com.br/clube',
    'Ver Claro Clube',
    180, 'https://www.claro.com.br/celular/planos', '2026-06-15',
    'official_confirmed'
  ),
  (
    'claro-roaming-incluso',
    'Roaming internacional incluso',
    'Pacote de roaming internacional incluso em planos Claro Pós Max elegíveis para uso em viagens.',
    'other', 'nacional', 'issuer', 'automatic',
    null,
    'Planos Claro Pós Max elegíveis incluem franquia de roaming internacional para uso de dados e ligações em países participantes.',
    E'Contrate um plano Claro Pós Max elegível\nAtive o roaming antes da viagem no app Minha Claro\nUse dados e ligações nos países participantes',
    'https://www.claro.com.br/celular/planos',
    'Ver plano',
    160, 'https://www.claro.com.br/celular/planos', '2026-06-15',
    'official_confirmed'
  ),

  -- ── TIM (TIM Black) ───────────────────────────────────────────────────────
  (
    'tim-streaming-incluso',
    'Streaming incluso (Deezer e parceiros)',
    'Aplicativos de streaming como Deezer inclusos em planos TIM Black elegíveis.',
    'experience', 'nacional', 'partner', 'app',
    'Deezer',
    'Planos TIM Black elegíveis incluem apps parceiros como Deezer e serviços de vídeo, com ativação pelo app Meu TIM.',
    E'Contrate um plano TIM Black elegível\nAtive o app parceiro no Meu TIM\nAcesse o conteúdo com o login do parceiro',
    'https://www.tim.com.br/planos',
    'Ativar streaming',
    220, 'https://www.tim.com.br/planos', '2026-06-15',
    'partner_network'
  ),
  (
    'tim-banca-virtual',
    'TIM Banca Virtual — jornais e revistas',
    'Acesso a jornais e revistas digitais incluso em planos TIM Black elegíveis.',
    'experience', 'nacional', 'partner', 'app',
    'TIM Banca Virtual',
    'A TIM Banca Virtual dá acesso a um acervo de jornais e revistas digitais para clientes de planos elegíveis, com leitura pelo app.',
    E'Contrate um plano TIM Black elegível\nAtive a TIM Banca Virtual no Meu TIM\nLeia jornais e revistas no app da banca',
    'https://www.tim.com.br/planos',
    'Ver banca',
    200, 'https://www.tim.com.br/planos', '2026-06-15',
    'partner_network'
  ),
  (
    'tim-apps-ilimitados',
    'Apps de mensagem e redes ilimitados',
    'Uso de WhatsApp e redes sociais selecionadas sem consumir a franquia de dados do plano.',
    'other', 'nacional', 'issuer', 'automatic',
    null,
    'Planos TIM Black elegíveis permitem usar WhatsApp e redes sociais selecionadas sem descontar da franquia de internet.',
    E'Contrate um plano TIM Black elegível\nUse os apps participantes normalmente\nO consumo não desconta da franquia de dados',
    'https://www.tim.com.br/planos',
    'Ver plano',
    180, 'https://www.tim.com.br/planos', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Spotify (Premium) ─────────────────────────────────────────────────────
  (
    'spotify-premium-teste-gratis',
    'Meses grátis no Premium',
    'Período gratuito do Spotify Premium para novos assinantes, sem anúncios e com download offline.',
    'experience', 'nacional', 'issuer', 'app',
    null,
    'Novos assinantes têm um período gratuito do Spotify Premium com música sem anúncios, pulos ilimitados e download para ouvir offline.',
    E'Acesse spotify.com/premium e escolha o plano\nInicie o período gratuito para novos assinantes\nCancele antes do fim do período se não quiser continuar',
    'https://www.spotify.com/br/premium/',
    'Assinar Premium',
    120, 'https://www.spotify.com/br/premium/', '2026-06-15',
    'official_confirmed'
  ),
  (
    'spotify-planos-duo-familia',
    'Planos Duo e Família',
    'Planos Duo e Família com várias contas Premium por um valor com desconto por pessoa.',
    'experience', 'nacional', 'issuer', 'app',
    null,
    'Os planos Duo (2 contas) e Família (até 6 contas) oferecem Premium para todos os membros com custo por pessoa reduzido em relação ao plano individual.',
    E'Escolha o plano Duo ou Família em spotify.com\nConvide os demais membros por e-mail\nCada membro acessa sua própria conta Premium',
    'https://www.spotify.com/br/premium/',
    'Ver planos',
    180, 'https://www.spotify.com/br/premium/', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Disney+ (Premium) ─────────────────────────────────────────────────────
  (
    'disney-plus-catalogo',
    'Catálogo Disney, Marvel, Star Wars e ESPN',
    'Acesso ao catálogo completo de filmes, séries e esportes ao vivo pela ESPN no plano Premium.',
    'experience', 'nacional', 'issuer', 'app',
    null,
    'O plano Premium reúne o catálogo de Disney, Pixar, Marvel, Star Wars, National Geographic e a programação esportiva ao vivo da ESPN.',
    E'Assine o Disney+ plano Premium no site ou app\nEntre com sua conta em qualquer dispositivo\nAssista filmes, séries e esportes ao vivo',
    'https://www.disneyplus.com/pt-br',
    'Assinar Disney+',
    240, 'https://www.disneyplus.com/pt-br', '2026-06-15',
    'official_confirmed'
  ),
  (
    'disney-plus-anual-desconto',
    'Desconto no plano anual',
    'Economia ao contratar o Disney+ no plano anual em vez do pagamento mensal.',
    'experience', 'nacional', 'issuer', 'app',
    null,
    'A assinatura anual do Disney+ oferece desconto equivalente a alguns meses grátis em comparação com doze pagamentos mensais.',
    E'Escolha o plano anual na página de assinatura\nConfirme o pagamento anual\nAproveite a economia em relação ao plano mensal',
    'https://www.disneyplus.com/pt-br',
    'Ver planos',
    200, 'https://www.disneyplus.com/pt-br', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Amazon Prime ──────────────────────────────────────────────────────────
  (
    'amazon-prime-frete-gratis',
    'Frete grátis e rápido Amazon',
    'Frete grátis e entregas rápidas em milhões de itens elegíveis para assinantes Prime.',
    'shopping', 'nacional', 'issuer', 'automatic',
    null,
    'Assinantes Amazon Prime têm frete grátis e prazos de entrega reduzidos em produtos elegíveis vendidos e entregues pela Amazon.',
    E'Assine o Amazon Prime no site ou app\nAdicione produtos elegíveis com o selo Prime\nReceba com frete grátis e entrega rápida',
    'https://www.amazon.com.br/prime',
    'Assinar Prime',
    180, 'https://www.amazon.com.br/prime', '2026-06-15',
    'official_confirmed'
  ),
  (
    'amazon-prime-video',
    'Prime Video incluso',
    'Streaming de filmes, séries e produções originais incluso na assinatura Amazon Prime.',
    'experience', 'nacional', 'issuer', 'app',
    'Prime Video',
    'A assinatura Amazon Prime inclui o Prime Video com catálogo de filmes, séries e produções Amazon Originals sem custo adicional.',
    E'Assine o Amazon Prime\nAbra o app Prime Video com sua conta Amazon\nAssista filmes, séries e originais inclusos',
    'https://www.primevideo.com',
    'Ver Prime Video',
    200, 'https://www.amazon.com.br/prime', '2026-06-15',
    'official_confirmed'
  ),
  (
    'amazon-prime-music-ofertas',
    'Prime Music e ofertas exclusivas',
    'Música incluída no Prime Music e acesso antecipado a ofertas exclusivas para assinantes.',
    'experience', 'nacional', 'issuer', 'app',
    'Prime Music',
    'A assinatura Prime inclui o Prime Music e dá acesso antecipado a promoções e ofertas relâmpago exclusivas para assinantes.',
    E'Assine o Amazon Prime\nOuça músicas no app Amazon Music com o selo Prime\nAcesse ofertas exclusivas antecipadas para assinantes',
    'https://www.amazon.com.br/prime',
    'Ver benefícios',
    150, 'https://www.amazon.com.br/prime', '2026-06-15',
    'official_confirmed'
  ),

  -- ── SulAmérica Saúde ──────────────────────────────────────────────────────
  (
    'sulamerica-telemedicina',
    'Telemedicina 24h',
    'Consultas médicas por vídeo 24 horas para beneficiários do plano, sem custo adicional.',
    'insurance', 'nacional', 'issuer', 'app',
    null,
    'Beneficiários da SulAmérica podem realizar consultas médicas por vídeo a qualquer hora, com orientação e emissão de receitas quando indicado.',
    E'Abra o app SulAmérica Saúde\nAcesse a área de telemedicina\nInicie a consulta por vídeo com o médico disponível',
    'https://portal.sulamericaseguros.com.br/planos-de-saude',
    'Iniciar consulta',
    700, 'https://portal.sulamericaseguros.com.br/planos-de-saude', '2026-06-15',
    'official_confirmed'
  ),
  (
    'sulamerica-rede-credenciada',
    'Rede credenciada nacional',
    'Atendimento em ampla rede de hospitais, clínicas e laboratórios credenciados em todo o país.',
    'insurance', 'nacional', 'issuer', 'insurance_claim',
    null,
    'O plano dá acesso a uma rede nacional de hospitais, clínicas e laboratórios credenciados, conforme a abrangência contratada.',
    E'Consulte a rede credenciada no app ou site SulAmérica\nEscolha o hospital, clínica ou laboratório\nApresente a carteirinha digital no atendimento',
    'https://portal.sulamericaseguros.com.br/planos-de-saude',
    'Ver rede',
    900, 'https://portal.sulamericaseguros.com.br/planos-de-saude', '2026-06-15',
    'official_confirmed'
  ),
  (
    'sulamerica-bem-estar',
    'Descontos em farmácias e bem-estar',
    'Descontos em medicamentos e programas de bem-estar para beneficiários do plano.',
    'other', 'nacional', 'partner', 'app',
    null,
    'O programa de bem-estar oferece descontos em medicamentos em farmácias parceiras e incentivos para hábitos saudáveis.',
    E'Acesse a área de vantagens no app SulAmérica\nConsulte as farmácias e parceiros participantes\nApresente o benefício para obter o desconto',
    'https://portal.sulamericaseguros.com.br/planos-de-saude',
    'Ver vantagens',
    300, 'https://portal.sulamericaseguros.com.br/planos-de-saude', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Amil (Amil One) ───────────────────────────────────────────────────────
  (
    'amil-pronto-atendimento-digital',
    'Pronto Atendimento Digital',
    'Atendimento médico online por vídeo para beneficiários, disponível todos os dias.',
    'insurance', 'nacional', 'issuer', 'app',
    null,
    'O Pronto Atendimento Digital da Amil permite consulta médica por vídeo com orientação clínica e encaminhamento quando necessário.',
    E'Abra o app Amil\nAcesse o Pronto Atendimento Digital\nInicie a consulta por vídeo com o médico',
    'https://www.amil.com.br',
    'Iniciar atendimento',
    700, 'https://www.amil.com.br', '2026-06-15',
    'official_confirmed'
  ),
  (
    'amil-rede-hospitais',
    'Rede de hospitais e clínicas Amil',
    'Cobertura em ampla rede de hospitais, clínicas e laboratórios conforme o plano contratado.',
    'insurance', 'nacional', 'issuer', 'insurance_claim',
    null,
    'Beneficiários Amil One têm acesso a uma rede nacional de hospitais e clínicas, com abrangência conforme o produto contratado.',
    E'Consulte a rede credenciada no app ou site Amil\nEscolha o hospital, clínica ou laboratório\nApresente a carteirinha digital no atendimento',
    'https://www.amil.com.br',
    'Ver rede',
    1000, 'https://www.amil.com.br', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Bradesco Saúde ────────────────────────────────────────────────────────
  (
    'bradesco-saude-meu-doutor',
    'Meu Doutor Novamed — consultas',
    'Consultas e telemedicina nas clínicas Meu Doutor Novamed para beneficiários do plano.',
    'insurance', 'nacional', 'issuer', 'app',
    'Meu Doutor Novamed',
    'Beneficiários têm acesso a consultas presenciais e por telemedicina nas clínicas Meu Doutor Novamed, integradas ao plano Bradesco Saúde.',
    E'Abra o app Bradesco Saúde\nAgende consulta presencial ou por telemedicina\nRealize o atendimento no Meu Doutor Novamed',
    'https://www.bradescosaude.com.br',
    'Agendar consulta',
    800, 'https://www.bradescosaude.com.br', '2026-06-15',
    'official_confirmed'
  ),
  (
    'bradesco-saude-rede-nacional',
    'Rede Top Nacional',
    'Cobertura em ampla rede de hospitais e laboratórios de referência em todo o país.',
    'insurance', 'nacional', 'issuer', 'insurance_claim',
    null,
    'O plano Top Nacional dá acesso a uma rede de hospitais e laboratórios de referência, conforme a abrangência contratada.',
    E'Consulte a rede referenciada no app ou site Bradesco Saúde\nEscolha o hospital ou laboratório\nApresente a carteirinha digital no atendimento',
    'https://www.bradescosaude.com.br',
    'Ver rede',
    1100, 'https://www.bradescosaude.com.br', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Hapvida ───────────────────────────────────────────────────────────────
  (
    'hapvida-telemedicina',
    'Hapvida Telemedicina 24h',
    'Consultas médicas online por vídeo disponíveis 24 horas para beneficiários do plano.',
    'insurance', 'nacional', 'issuer', 'app',
    null,
    'A Hapvida oferece atendimento médico por vídeo 24 horas, com orientação clínica e emissão de documentos quando indicado.',
    E'Abra o app Hapvida\nAcesse a telemedicina\nInicie a consulta por vídeo com o médico',
    'https://www.hapvida.com.br/site/planos',
    'Iniciar consulta',
    600, 'https://www.hapvida.com.br/site/planos', '2026-06-15',
    'official_confirmed'
  ),
  (
    'hapvida-rede-propria',
    'Rede própria de hospitais e clínicas',
    'Atendimento na rede própria de hospitais, clínicas e laboratórios Hapvida.',
    'insurance', 'nacional', 'issuer', 'insurance_claim',
    null,
    'Beneficiários Hapvida são atendidos em uma ampla rede própria de hospitais, clínicas e laboratórios, o que agiliza consultas e exames.',
    E'Consulte as unidades no app ou site Hapvida\nAgende consulta ou exame na unidade\nApresente a carteirinha digital no atendimento',
    'https://www.hapvida.com.br/site/planos',
    'Ver unidades',
    800, 'https://www.hapvida.com.br/site/planos', '2026-06-15',
    'official_confirmed'
  ),

  -- ── NotreDame Intermédica ─────────────────────────────────────────────────
  (
    'notredame-atendimento-virtual',
    'Pronto Atendimento Virtual',
    'Atendimento médico digital por vídeo para beneficiários do plano, disponível todos os dias.',
    'insurance', 'nacional', 'issuer', 'app',
    null,
    'O Pronto Atendimento Virtual da NotreDame Intermédica oferece consulta por vídeo com orientação clínica e encaminhamento quando necessário.',
    E'Abra o app NotreDame Intermédica\nAcesse o Pronto Atendimento Virtual\nInicie a consulta por vídeo com o médico',
    'https://www.gndi.com.br/planos-de-saude',
    'Iniciar atendimento',
    650, 'https://www.gndi.com.br/planos-de-saude', '2026-06-15',
    'official_confirmed'
  ),
  (
    'notredame-rede-propria',
    'Rede própria Intermédica',
    'Atendimento na rede própria de hospitais e centros clínicos da NotreDame Intermédica.',
    'insurance', 'nacional', 'issuer', 'insurance_claim',
    null,
    'Beneficiários têm acesso à rede própria de hospitais e centros clínicos da NotreDame Intermédica, com abrangência conforme o plano contratado.',
    E'Consulte as unidades no app ou site NotreDame Intermédica\nAgende consulta ou exame na unidade\nApresente a carteirinha digital no atendimento',
    'https://www.gndi.com.br/planos-de-saude',
    'Ver unidades',
    900, 'https://www.gndi.com.br/planos-de-saude', '2026-06-15',
    'official_confirmed'
  ),

  -- ── LATAM Pass ────────────────────────────────────────────────────────────
  (
    'latam-pass-acumulo-voos',
    'Acúmulo de pontos em voos LATAM',
    'Acúmulo de pontos LATAM Pass em voos LATAM e companhias parceiras, conforme a tarifa.',
    'miles', 'nacional', 'partner', 'points_exchange',
    'LATAM',
    'O programa LATAM Pass acumula pontos em voos LATAM e parceiros da aliança, com quantidade conforme a tarifa e a distância voada.',
    E'Cadastre-se no LATAM Pass e informe o número na reserva\nVoe pela LATAM ou companhias parceiras\nAcompanhe os pontos creditados na conta LATAM Pass',
    'https://www.latampass.latam.com',
    'Ver programa',
    500, 'https://www.latampass.latam.com', '2026-06-15',
    'official_confirmed'
  ),
  (
    'latam-pass-resgate-passagens',
    'Resgate de passagens com pontos',
    'Troca de pontos LATAM Pass por passagens em voos LATAM e parceiros.',
    'miles', 'nacional', 'partner', 'points_exchange',
    'LATAM',
    'Os pontos acumulados podem ser resgatados por passagens em voos LATAM e companhias parceiras, sujeito à disponibilidade de assentos.',
    E'Acesse sua conta no site ou app LATAM Pass\nBusque o destino e as datas desejadas\nResgate a passagem usando os pontos acumulados',
    'https://www.latampass.latam.com',
    'Resgatar passagem',
    550, 'https://www.latampass.latam.com', '2026-06-15',
    'official_confirmed'
  ),
  (
    'latam-pass-categorias-elite',
    'Categorias elite e salas VIP',
    'Categorias elite do programa com bônus de pontos e acesso a salas VIP em aeroportos.',
    'airport', 'nacional', 'partner', 'physical_access',
    'LATAM',
    'Ao atingir categorias elite do LATAM Pass, o cliente ganha bônus de pontos, prioridade de embarque e acesso a salas VIP conforme a categoria.',
    E'Acumule pontos qualificáveis voando pela LATAM\nAtinja a categoria elite conforme as regras do programa\nAproveite os benefícios de prioridade e salas VIP',
    'https://www.latampass.latam.com',
    'Ver categorias',
    500, 'https://www.latampass.latam.com', '2026-06-15',
    'official_confirmed'
  ),

  -- ── Smiles ────────────────────────────────────────────────────────────────
  (
    'smiles-acumulo-milhas',
    'Acúmulo de milhas Smiles',
    'Acúmulo de milhas em voos Gol e parceiros, além de compras em lojas conveniadas.',
    'miles', 'nacional', 'partner', 'points_exchange',
    'Gol',
    'O programa Smiles acumula milhas em voos Gol e companhias parceiras, e também em compras no shopping Smiles e em lojas conveniadas.',
    E'Cadastre-se no Smiles e informe o número na reserva\nVoe pela Gol ou parceiros e compre no shopping Smiles\nAcompanhe as milhas creditadas na conta',
    'https://www.smiles.com.br',
    'Ver programa',
    500, 'https://www.smiles.com.br', '2026-06-15',
    'official_confirmed'
  ),
  (
    'smiles-clube',
    'Clube Smiles — milhas mensais',
    'Assinatura mensal que credita milhas todo mês com desconto sobre a compra avulsa.',
    'miles', 'nacional', 'partner', 'points_exchange',
    'Smiles',
    'O Clube Smiles credita uma quantidade fixa de milhas por mês por uma mensalidade, com custo por milha menor do que a compra avulsa e milhas que não expiram enquanto a assinatura estiver ativa.',
    E'Escolha um plano do Clube Smiles no site ou app\nReceba as milhas creditadas todo mês\nUse as milhas em passagens e produtos',
    'https://www.smiles.com.br/clube-smiles',
    'Assinar clube',
    480, 'https://www.smiles.com.br', '2026-06-15',
    'official_confirmed'
  ),
  (
    'smiles-resgate-passagens',
    'Resgate de passagens Gol',
    'Troca de milhas Smiles por passagens em voos Gol e companhias parceiras.',
    'miles', 'nacional', 'partner', 'points_exchange',
    'Gol',
    'As milhas acumuladas podem ser resgatadas por passagens em voos Gol e parceiros, sujeito à disponibilidade de assentos.',
    E'Acesse sua conta no site ou app Smiles\nBusque o destino e as datas desejadas\nResgate a passagem usando as milhas acumuladas',
    'https://www.smiles.com.br',
    'Resgatar passagem',
    550, 'https://www.smiles.com.br', '2026-06-15',
    'official_confirmed'
  ),

  -- ── TudoAzul ──────────────────────────────────────────────────────────────
  (
    'tudoazul-acumulo-pontos',
    'Acúmulo de pontos TudoAzul',
    'Acúmulo de pontos em voos Azul e parceiros, além de compras em lojas conveniadas.',
    'miles', 'nacional', 'partner', 'points_exchange',
    'Azul',
    'O programa TudoAzul acumula pontos em voos Azul e companhias parceiras, e também em compras no shopping TudoAzul e em lojas conveniadas.',
    E'Cadastre-se no TudoAzul e informe o número na reserva\nVoe pela Azul ou parceiros e compre no shopping TudoAzul\nAcompanhe os pontos creditados na conta',
    'https://www.voeazul.com.br/tudoazul',
    'Ver programa',
    500, 'https://www.voeazul.com.br/tudoazul', '2026-06-15',
    'official_confirmed'
  ),
  (
    'tudoazul-clube',
    'Clube TudoAzul — pontos mensais',
    'Assinatura mensal que credita pontos todo mês com custo menor do que a compra avulsa.',
    'miles', 'nacional', 'partner', 'points_exchange',
    'TudoAzul',
    'O Clube TudoAzul credita pontos por mês por uma mensalidade, com custo por ponto menor que a compra avulsa e pontos que não expiram enquanto a assinatura estiver ativa.',
    E'Escolha um plano do Clube TudoAzul no site ou app\nReceba os pontos creditados todo mês\nUse os pontos em passagens e produtos',
    'https://www.voeazul.com.br/tudoazul/clube-tudoazul',
    'Assinar clube',
    480, 'https://www.voeazul.com.br/tudoazul', '2026-06-15',
    'official_confirmed'
  )

on conflict (slug) do update set
  title               = excluded.title,
  summary             = excluded.summary,
  category            = excluded.category,
  scope               = excluded.scope,
  benefit_source      = excluded.benefit_source,
  redemption_type     = excluded.redemption_type,
  partner_name        = excluded.partner_name,
  long_description    = excluded.long_description,
  steps               = excluded.steps,
  action_url          = excluded.action_url,
  action_label        = excluded.action_label,
  estimated_value_brl = excluded.estimated_value_brl,
  source_url          = excluded.source_url,
  observed_at         = excluded.observed_at,
  verification_status = excluded.verification_status;

-- ===== BENEFIT_SOURCES (links diretos benefício -> source_item) =====
insert into benefit_sources (benefit_id, source_item_id)
select b.id, si.id from benefits b, source_items si
where (b.slug, si.slug) in (
  ('itau-personnalite-sala-vip',           'itau-personnalite'),
  ('itau-personnalite-sempre-presente',    'itau-personnalite'),
  ('itau-personnalite-assessoria',         'itau-personnalite'),
  ('bradesco-aeternum-sala-vip',           'bradesco-aeternum'),
  ('bradesco-livelo-pontos',               'bradesco-aeternum'),
  ('bradesco-aeternum-concierge',          'bradesco-aeternum'),
  ('c6-atomos-pontos',                     'c6-carbon'),
  ('c6-carbon-sala-vip',                   'c6-carbon'),
  ('c6-tag-sem-mensalidade',               'c6-carbon'),
  ('bb-ourocard-sala-vip',                 'bb-ourocard-black'),
  ('bb-ourocard-livelo',                   'bb-ourocard-black'),
  ('bb-ourocard-seguro-viagem',            'bb-ourocard-black'),
  ('santander-esfera-pontos',              'santander-unlimited'),
  ('santander-unlimited-sala-vip',         'santander-unlimited'),
  ('santander-esfera-avios',               'santander-unlimited'),
  ('btg-black-sala-vip',                   'btg-black'),
  ('btg-black-cashback',                   'btg-black'),
  ('btg-assessoria-investimentos',         'btg-black'),
  ('mercado-pago-rendimento',              'mercado-pago-card'),
  ('mercado-pago-cashback',                'mercado-pago-card'),
  ('mercado-pago-meli-plus',               'mercado-pago-card'),
  ('picpay-cashback',                      'picpay-card'),
  ('picpay-rendimento',                    'picpay-card'),
  ('vivo-disney-incluso',                  'vivo-total'),
  ('vivo-valoriza-descontos',              'vivo-total'),
  ('vivo-apps-ilimitados',                 'vivo-total'),
  ('claro-streaming-incluso',              'claro-max'),
  ('claro-clube-descontos',                'claro-max'),
  ('claro-roaming-incluso',                'claro-max'),
  ('tim-streaming-incluso',                'tim-black'),
  ('tim-banca-virtual',                    'tim-black'),
  ('tim-apps-ilimitados',                  'tim-black'),
  ('spotify-premium-teste-gratis',         'spotify-premium'),
  ('spotify-planos-duo-familia',           'spotify-premium'),
  ('disney-plus-catalogo',                 'disney-plus-premium'),
  ('disney-plus-anual-desconto',           'disney-plus-premium'),
  ('amazon-prime-frete-gratis',            'amazon-prime-plan'),
  ('amazon-prime-video',                   'amazon-prime-plan'),
  ('amazon-prime-music-ofertas',           'amazon-prime-plan'),
  ('sulamerica-telemedicina',              'sulamerica-saude'),
  ('sulamerica-rede-credenciada',          'sulamerica-saude'),
  ('sulamerica-bem-estar',                 'sulamerica-saude'),
  ('amil-pronto-atendimento-digital',      'amil-one'),
  ('amil-rede-hospitais',                  'amil-one'),
  ('bradesco-saude-meu-doutor',            'bradesco-saude-top'),
  ('bradesco-saude-rede-nacional',         'bradesco-saude-top'),
  ('hapvida-telemedicina',                 'hapvida-plan'),
  ('hapvida-rede-propria',                 'hapvida-plan'),
  ('notredame-atendimento-virtual',        'notredame-advance'),
  ('notredame-rede-propria',               'notredame-advance'),
  ('latam-pass-acumulo-voos',              'latam-pass-program'),
  ('latam-pass-resgate-passagens',         'latam-pass-program'),
  ('latam-pass-categorias-elite',          'latam-pass-program'),
  ('smiles-acumulo-milhas',                'smiles-program'),
  ('smiles-clube',                         'smiles-program'),
  ('smiles-resgate-passagens',             'smiles-program'),
  ('tudoazul-acumulo-pontos',              'tudoazul-program'),
  ('tudoazul-clube',                       'tudoazul-program')
)
on conflict do nothing;

-- ===== CATÁLOGO ESTABELECIDO (paridade mockup) =====
-- Backdatea created_at p/ o badge "novo" ficar reservado a adições realmente
-- recentes (evita "novo" em todo o catálogo no lançamento) e revela o badge
-- "Assinatura" nos benefícios de assinatura/operadora.
update benefits set created_at = coalesce(observed_at, date '2026-06-15')::timestamptz
where slug is not null;
