CREATE TABLE player_account (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    login_id      VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE game_character
    ADD COLUMN account_id BIGINT NULL,
    ADD COLUMN character_code VARCHAR(30) NOT NULL DEFAULT 'guanwu',
    ADD COLUMN defense_stage INT NOT NULL DEFAULT 1;

ALTER TABLE game_character DROP INDEX name;
ALTER TABLE game_character
    ADD CONSTRAINT fk_character_account FOREIGN KEY (account_id) REFERENCES player_account(id),
    ADD CONSTRAINT uq_account_character UNIQUE (account_id, character_code);
