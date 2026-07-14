-- D4: motivo de rejeição (UPDATE direto sob a RLS admin de 0015).
alter table discovery_candidates add column rejection_reason text;
