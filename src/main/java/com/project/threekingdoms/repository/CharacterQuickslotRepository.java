package com.project.threekingdoms.repository;

import java.util.List;
import com.project.threekingdoms.domain.CharacterQuickslot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterQuickslotRepository extends JpaRepository<CharacterQuickslot, Long> {
    List<CharacterQuickslot> findByCharacterIdOrderBySlotIndex(Long characterId);
    void deleteByCharacterId(Long characterId);
}
