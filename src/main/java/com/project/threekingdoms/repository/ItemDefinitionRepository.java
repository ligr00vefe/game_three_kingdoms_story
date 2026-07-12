package com.project.threekingdoms.repository;

import com.project.threekingdoms.domain.ItemDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemDefinitionRepository extends JpaRepository<ItemDefinition, Long> {
}
