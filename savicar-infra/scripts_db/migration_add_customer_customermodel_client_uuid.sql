-- Migração: adiciona CLIENT_UUID em CUSTOMER e CUSTOMER_MODEL — mesma chave de
-- idempotência já usada em SERVICE_ORDER (migration_add_service_order_client_uuid.sql),
-- agora para permitir cadastrar cliente/veículo offline no app mobile sem
-- duplicar caso o sync seja reenviado após perder a resposta do servidor.
-- Ver internal/domain/customer/entity.go, internal/domain/customermodel/entity.go
-- e os respectivos service.go (Create).
--
-- Rode este arquivo assim:
--   mysql -u badencar -p badencar < migration_add_customer_customermodel_client_uuid.sql

ALTER TABLE `badencar`.`CUSTOMER`
  ADD COLUMN `CLIENT_UUID` VARCHAR(36) NULL,
  ADD UNIQUE INDEX `UX_CUSTOMER_CLIENT_UUID` (`CLIENT_UUID`);

ALTER TABLE `badencar`.`CUSTOMER_MODEL`
  ADD COLUMN `CLIENT_UUID` VARCHAR(36) NULL,
  ADD UNIQUE INDEX `UX_CUSTOMER_MODEL_CLIENT_UUID` (`CLIENT_UUID`);

DESCRIBE `badencar`.`CUSTOMER`;
DESCRIBE `badencar`.`CUSTOMER_MODEL`;
