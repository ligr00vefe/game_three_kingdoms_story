-- 골드를 캐릭터 슬롯별 자산이 아닌 계정 공용 자산으로 통합한다.
ALTER TABLE player_account
    ADD COLUMN gold BIGINT NOT NULL DEFAULT 0;

-- 기존 슬롯 골드를 합산하면 같은 계정에서 중복 지급될 수 있으므로 가장 큰 잔액을 승계한다.
UPDATE player_account account
SET account.gold = COALESCE((
    SELECT MAX(character_row.gold)
    FROM game_character character_row
    WHERE character_row.account_id = account.id
), 0);
