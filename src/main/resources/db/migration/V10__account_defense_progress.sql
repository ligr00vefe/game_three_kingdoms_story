-- 디펜스 진행도와 랭킹 기준을 캐릭터 슬롯이 아닌 계정 단위로 통합한다.
ALTER TABLE player_account
    ADD COLUMN defense_stage INT NOT NULL DEFAULT 1,
    ADD COLUMN defense_stage_reached_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN last_character_code VARCHAR(30) NOT NULL DEFAULT 'guanwu';

UPDATE player_account account
SET account.defense_stage = COALESCE((
        SELECT MAX(character_row.defense_stage)
        FROM game_character character_row
        WHERE character_row.account_id = account.id
    ), 1),
    account.defense_stage_reached_at = COALESCE((
        SELECT MIN(character_row.updated_at)
        FROM game_character character_row
        WHERE character_row.account_id = account.id
          AND character_row.defense_stage = (
              SELECT MAX(stage_row.defense_stage)
              FROM game_character stage_row
              WHERE stage_row.account_id = account.id
          )
    ), account.created_at),
    account.last_character_code = COALESCE((
        SELECT character_row.character_code
        FROM game_character character_row
        WHERE character_row.account_id = account.id
        ORDER BY character_row.updated_at DESC, character_row.id DESC
        LIMIT 1
    ), 'guanwu');
