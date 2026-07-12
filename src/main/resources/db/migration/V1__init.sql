-- V1: 초기 스키마 — 캐릭터 / 아이템 정의 / 인벤토리
-- 규칙: 스키마 변경은 반드시 새 V{n}__*.sql 파일로 추가한다. 이 파일은 수정 금지.

CREATE TABLE game_character (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(20)  NOT NULL UNIQUE,
    level           INT          NOT NULL DEFAULT 1,
    exp             BIGINT       NOT NULL DEFAULT 0,
    max_hp          INT          NOT NULL DEFAULT 100,
    hp              INT          NOT NULL DEFAULT 100,
    max_mp          INT          NOT NULL DEFAULT 50,
    mp              INT          NOT NULL DEFAULT 50,
    attack_power    INT          NOT NULL DEFAULT 10,
    gold            BIGINT       NOT NULL DEFAULT 0,
    stage_code      VARCHAR(30)  NOT NULL DEFAULT 'stage1_grassland',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE item_definition (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(40)  NOT NULL UNIQUE,     -- 코드로 참조 (예: weapon_green_dragon_blade)
    name            VARCHAR(50)  NOT NULL,
    item_type       VARCHAR(15)  NOT NULL,            -- EQUIP / CONSUME / ETC / ARTIFACT
    icon_key        VARCHAR(60)  NOT NULL,            -- 프론트 텍스처 키 (manifest와 일치)
    effect_json     JSON         NULL,                -- 효과 정의 (예: {"heal": 30}, {"moveSpeedPct": 10})
    description     VARCHAR(200) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_item (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    character_id    BIGINT       NOT NULL,
    item_code       VARCHAR(40)  NOT NULL,
    quantity        INT          NOT NULL DEFAULT 1,
    slot_index      INT          NOT NULL,            -- 인벤토리 격자 위치 (0~23)
    equipped        BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_inventory_character FOREIGN KEY (character_id) REFERENCES game_character (id),
    CONSTRAINT fk_inventory_item_code FOREIGN KEY (item_code) REFERENCES item_definition (code),
    CONSTRAINT uq_character_slot UNIQUE (character_id, slot_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 초기 아이템 정의 (GAME_DESIGN.md 2, 6.2, 8.3)
INSERT INTO item_definition (code, name, item_type, icon_key, effect_json, description) VALUES
('weapon_green_dragon_blade', '청룡언월도', 'EQUIP',    'icon_green_dragon_blade', JSON_OBJECT('attackMultiplier', 1.2), '관우의 시작 무기. 리치가 긴 대도.'),
('consume_hp_potion_s',       'HP 물약(소)', 'CONSUME', 'icon_hp_potion_s',        JSON_OBJECT('heal', 30),             '체력을 30 회복한다.'),
('etc_yellow_turban_scrap',   '누런 두건 조각', 'ETC',  'icon_turban_scrap',       NULL,                                '황건당 좀비가 쓰던 두건 조각. 어딘가 쓸 데가 있을 것 같다.'),
('artifact_red_hare_shoe',    '적토의 편자', 'ARTIFACT','icon_red_hare_shoe',      JSON_OBJECT('moveSpeedPct', 10),     '명마 적토의 편자. 착용 시 이동속도가 10% 빨라진다.');
