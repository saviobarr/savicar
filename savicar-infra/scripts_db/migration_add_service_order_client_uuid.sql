-- Migração: adiciona CLIENT_UUID em SERVICE_ORDER — chave de idempotência
-- usada por clientes offline (app mobile) para evitar duplicar a OS caso o
-- sync seja reenviado após perder a resposta do servidor.
-- Ver internal/domain/serviceorder/entity.go e
-- internal/application/serviceorder/service.go (Create).
--
-- Rode este arquivo assim:
--   mysql -u badencar -p badencar < migration_add_service_order_client_uuid.sql

ALTER TABLE `badencar`.`SERVICE_ORDER`
  ADD COLUMN `CLIENT_UUID` VARCHAR(36) NULL AFTER `STATUS`,
  ADD UNIQUE INDEX `UX_SERVICE_ORDER_CLIENT_UUID` (`CLIENT_UUID`);

DESCRIBE `badencar`.`SERVICE_ORDER`;
