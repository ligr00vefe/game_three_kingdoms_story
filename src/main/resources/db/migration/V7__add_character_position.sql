-- 마지막으로 종료한 맵 안의 정확한 캐릭터 위치를 복원한다.
-- 기존 캐릭터는 NULL을 유지해 각 맵의 안전한 기본 스폰 지점을 사용한다.
ALTER TABLE game_character
    ADD COLUMN position_x INT NULL,
    ADD COLUMN position_y INT NULL;
