CREATE TABLE bug_report (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    title         VARCHAR(100) NOT NULL,
    content       TEXT         NOT NULL,
    category      VARCHAR(20)  NOT NULL DEFAULT 'BUG',
    status        VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    reporter_name VARCHAR(30)  NOT NULL DEFAULT '익명',
    account_id    BIGINT       NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bug_report_account FOREIGN KEY (account_id) REFERENCES player_account(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
