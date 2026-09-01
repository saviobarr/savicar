-- Migração: corrige a FK de técnico em SERVICE_ORDER.
--
-- Problema: a coluna SERVICE_ORDER.ID_USER tem FK para users.ID_USER, mas o
-- backend (e os apps) sempre gravaram ali o TECHNICIAN.ID_TECHNICIAN (o id
-- que o seletor de técnico realmente envia). Como só 1 dos 5 técnicos tem
-- login vinculado (ID_USER preenchido), abrir OS com qualquer outro técnico
-- falha com "Cannot add or update a child row: a foreign key constraint
-- fails ... FK_SERVICE_ORDER_TECHNICIAN".
--
-- Esta migração renomeia a coluna para ID_TECHNICIAN e aponta a FK para
-- technician.ID_TECHNICIAN (que é o schema já refletido no dump mais novo
-- badencar_220620261727.sql, nunca aplicado em produção).
--
-- ANTES DE RODAR: faça backup da tabela.
--   mysqldump -u badencar -p badencar service_order > backup_service_order_YYYYMMDD.sql
--
-- Rode este arquivo assim:
--   mysql -u badencar -p badencar < migration_service_order_id_technician.sql

-- 0. Conferir estado atual antes da migração (opcional, só para registro)
SELECT ID_USER, COUNT(*) AS qtd FROM service_order GROUP BY ID_USER;

-- 1. Nova coluna para guardar o ID_TECHNICIAN correto
ALTER TABLE service_order ADD COLUMN ID_TECHNICIAN int DEFAULT NULL AFTER ID_USER;

-- 2. Migra os dados existentes: só as linhas cujo ID_USER bate com o login
--    vinculado de algum técnico são preservadas (mapeadas para o
--    ID_TECHNICIAN real dele). As demais (ID_USER sem técnico correspondente,
--    ex.: ID_USER = 1) ficam NULL — que é exatamente o que já era exibido
--    para elas hoje (o JOIN antigo não encontrava técnico nenhum).
UPDATE service_order so
JOIN technician t ON t.ID_USER = so.ID_USER
SET so.ID_TECHNICIAN = t.ID_TECHNICIAN;

-- 3. Remove a FK e a coluna antigas (erradas)
ALTER TABLE service_order DROP FOREIGN KEY FK_SERVICE_ORDER_TECHNICIAN;
ALTER TABLE service_order DROP COLUMN ID_USER;

-- 4. Cria a FK correta, apontando para TECHNICIAN
ALTER TABLE service_order
  ADD CONSTRAINT FK_SERVICE_ORDER_TECHNICIAN
  FOREIGN KEY (ID_TECHNICIAN) REFERENCES technician (ID_TECHNICIAN);

-- 5. Conferir resultado: cada linha deve mostrar o nome do técnico certo
--    (ou NULL, se nenhum técnico estava associado antes)
SELECT so.ID_ORDER, so.ID_TECHNICIAN, t.NAME
FROM service_order so
LEFT JOIN technician t ON t.ID_TECHNICIAN = so.ID_TECHNICIAN;
