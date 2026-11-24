-- Migração: cria a tabela NOTIFICATIONS, usada para avisar usuários com
-- perfil admin quando um usuário com perfil técnico/mecânico altera uma OS
-- (caixa de entrada de notificações no frontend).
--
-- Ver internal/domain/notification/entity.go para o shape correspondente.
--
-- ANTES DE RODAR: faça backup (a tabela é nova, mas por segurança):
--   mysqldump -u badencar -p badencar > backup_pre_notifications_YYYYMMDD.sql
--
-- Rode este arquivo assim:
--   mysql -u badencar -p badencar < migration_add_notifications_table.sql

-- 0. Conferir se a tabela já existe antes da migração
SHOW TABLES LIKE 'NOTIFICATIONS';

-- 1. Cria a tabela
CREATE TABLE `badencar`.`NOTIFICATIONS` (
  `ID_NOTIFICATION` INT NOT NULL AUTO_INCREMENT,
  `ID_TENANT`        INT NOT NULL,
  `ID_USER`          INT NOT NULL COMMENT 'Destinatário da notificação (usuário admin)',
  `ID_ORDER`         INT NULL COMMENT 'OS relacionada, se houver',
  `MESSAGE`          VARCHAR(255) NOT NULL,
  `IS_READ`          TINYINT(1) NOT NULL DEFAULT 0,
  `CREATED_AT`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID_NOTIFICATION`),
  KEY `IDX_NOTIFICATIONS_USER_READ` (`ID_USER`, `IS_READ`),
  CONSTRAINT `FK_NOTIFICATIONS_USER`  FOREIGN KEY (`ID_USER`)  REFERENCES `USERS` (`ID_USER`),
  CONSTRAINT `FK_NOTIFICATIONS_ORDER` FOREIGN KEY (`ID_ORDER`) REFERENCES `SERVICE_ORDER` (`ID_ORDER`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Conferir resultado
DESCRIBE `badencar`.`NOTIFICATIONS`;
