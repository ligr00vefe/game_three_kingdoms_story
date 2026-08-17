-- 캐릭터 기본 HP/MP 상향. 기존 레벨업 증가분과 현재 손실 HP/MP는 그대로 보존한다.
UPDATE game_character
SET max_hp = max_hp + 120,
    hp = hp + 120,
    max_mp = max_mp + 70,
    mp = mp + 70
WHERE character_code = 'guanwu';

UPDATE game_character
SET max_hp = max_hp + 100,
    hp = hp + 100,
    max_mp = max_mp + 100,
    mp = mp + 100
WHERE character_code = 'zhaoyun';

UPDATE game_character
SET max_hp = max_hp + 130,
    hp = hp + 130,
    max_mp = max_mp + 60,
    mp = mp + 60
WHERE character_code = 'lubu';
