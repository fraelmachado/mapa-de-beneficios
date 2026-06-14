-- Fontes
insert into sources (id, kind, name, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'card', 'Itaú', 1),
  ('22222222-2222-2222-2222-222222222222', 'carrier', 'Claro', 2),
  ('33333333-3333-3333-3333-333333333333', 'loyalty', 'Livelo', 3);

-- Folhas selecionáveis
insert into source_items (id, source_id, label, sort_order) values
  ('aaaaaaa1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Black/Infinite', 1),
  ('aaaaaaa1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Platinum', 2),
  ('bbbbbbb2-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Pós', 1),
  ('ccccccc3-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '—', 1);

-- Benefícios
insert into benefits (id, title, summary, category, scope, partner_name, steps, action_label) values
  ('d0000001-0000-0000-0000-000000000001', 'Sala VIP em Guarulhos', 'Acesso gratuito à sala VIP do aeroporto.', 'viagem', 'pontual', 'Mastercard', '1. Apresente seu cartão na entrada da sala.', 'Ver salas'),
  ('d0000001-0000-0000-0000-000000000002', '50% no Cinemark', 'Metade do preço no ingresso de cinema.', 'entretenimento', 'nacional', 'Cinemark', '1. Compre pelo site oficial usando o cartão elegível.', 'Comprar'),
  ('d0000001-0000-0000-0000-000000000003', 'Streaming incluso', 'Uma assinatura de streaming à sua escolha.', 'entretenimento', 'nacional', 'Claro', '1. Ative no app da operadora.', 'Ativar');

-- Mapeamento benefício -> folha
insert into benefit_sources (benefit_id, source_item_id) values
  ('d0000001-0000-0000-0000-000000000001', 'aaaaaaa1-0000-0000-0000-000000000001'),
  ('d0000001-0000-0000-0000-000000000002', 'aaaaaaa1-0000-0000-0000-000000000001'),
  ('d0000001-0000-0000-0000-000000000002', 'aaaaaaa1-0000-0000-0000-000000000002'),
  ('d0000001-0000-0000-0000-000000000003', 'bbbbbbb2-0000-0000-0000-000000000001');

-- Local físico de exemplo (geo capturado já)
insert into benefit_locations (benefit_id, name, lat, lng, city, uf) values
  ('d0000001-0000-0000-0000-000000000001', 'Sala VIP GRU Terminal 2', -23.4356, -46.4731, 'Guarulhos', 'SP');
