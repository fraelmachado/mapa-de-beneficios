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
