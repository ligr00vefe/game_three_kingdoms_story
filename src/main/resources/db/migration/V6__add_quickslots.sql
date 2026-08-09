CREATE TABLE character_quickslot (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    character_id  BIGINT      NOT NULL,
    slot_index    INT         NOT NULL,
    entry_kind    VARCHAR(10) NOT NULL,
    entry_code    VARCHAR(60) NOT NULL,
    CONSTRAINT fk_quickslot_character
        FOREIGN KEY (character_id) REFERENCES game_character (id) ON DELETE CASCADE,
    CONSTRAINT uq_character_quickslot UNIQUE (character_id, slot_index),
    CONSTRAINT chk_quickslot_index CHECK (slot_index BETWEEN 0 AND 6),
    CONSTRAINT chk_quickslot_kind CHECK (entry_kind IN ('item', 'skill'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
