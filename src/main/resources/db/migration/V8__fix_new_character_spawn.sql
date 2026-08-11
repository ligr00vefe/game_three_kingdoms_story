-- 신규 캐릭터는 감숙성 내부의 동탁 앞에서 시작한다.
ALTER TABLE game_character
    ALTER COLUMN stage_code SET DEFAULT 'map_ye_castle';

-- 과거 기본값(stage1_grassland)은 실제 맵 키가 아니므로 신규 시작 데이터로 간주해 교정한다.
UPDATE game_character
SET stage_code = 'map_ye_castle',
    position_x = COALESCE(position_x, 1100),
    position_y = COALESCE(position_y, 440)
WHERE stage_code = 'stage1_grassland'
   OR (stage_code = 'map_stage1'
       AND level = 1 AND exp = 0 AND gold = 0 AND defense_stage = 1);
