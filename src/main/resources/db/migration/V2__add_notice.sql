-- V2: 공지사항 배너 (GAME_DESIGN 9장 — 서버에서 내려주는 시스템 공지)

CREATE TABLE notice (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    message     VARCHAR(200) NOT NULL,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO notice (message, active) VALUES
('황건당 좀비의 습격이 시작됐습니다! 초원의 좀비를 처치해 주세요.', TRUE),
('[안내] I키: 인벤토리 / Z키: 줍기 / Shift: 청룡참', TRUE);
