-- Migração: numeração estritamente sequencial das notas fiscais (tabela NF).
--
-- Antes o NF.numero vinha do AUTO_INCREMENT do MySQL, que pula valores em
-- INSERTs com falha/rollback e pode andar de N em N (auto_increment_increment).
-- Agora o número vem da tabela NF_SEQUENCE, travada (SELECT ... FOR UPDATE) na
-- mesma transação do INSERT em nf — falha no INSERT desfaz o incremento.
--
-- A API cria a tabela sozinha no primeiro uso (CREATE TABLE IF NOT EXISTS +
-- seed pelo MAX(numero)); este script é o equivalente manual.
--
-- ANTES DE RODAR: faça backup
--   mysqldump -u badencar -p badencar > backup_pre_nf_sequence_YYYYMMDD.sql
--
--   mysql -u badencar -p badencar < migration_nf_sequence.sql

CREATE TABLE IF NOT EXISTS `badencar`.`NF_SEQUENCE` (
  `id`            TINYINT NOT NULL PRIMARY KEY,
  `ultimo_numero` INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `badencar`.`NF_SEQUENCE` (`id`, `ultimo_numero`)
SELECT 1, COALESCE(MAX(`numero`), 0) FROM `badencar`.`nf`;

-- Remove o AUTO_INCREMENT: o número agora é informado explicitamente.
ALTER TABLE `badencar`.`nf` MODIFY `numero` INT NOT NULL;

SELECT * FROM `badencar`.`NF_SEQUENCE`;

ALTER TABLE `badencar`.`nf` 
CHANGE COLUMN `numero` `numero` INT NOT NULL ;