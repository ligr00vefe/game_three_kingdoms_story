package com.project.threekingdoms.repository;

import java.util.Optional;

import com.project.threekingdoms.domain.GameCharacter;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameCharacterRepository extends JpaRepository<GameCharacter, Long> {
	Optional<GameCharacter> findByName(String name);
}
