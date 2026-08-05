-- V5: 삭제된 Shift 청룡참 안내를 현재 단축키/디펜스 기능 안내로 교체
UPDATE notice
SET message = '[안내] I키: 인벤토리 / Z키: 줍기 / K키: 스킬창 / 디펜스: B키 구매, 1~5 전술·명령'
WHERE message LIKE '%Shift%';
