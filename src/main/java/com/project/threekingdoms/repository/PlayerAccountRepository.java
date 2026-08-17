package com.project.threekingdoms.repository;

import java.util.Optional;
import java.util.List;

import com.project.threekingdoms.domain.PlayerAccount;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerAccountRepository extends JpaRepository<PlayerAccount, Long> {
	Optional<PlayerAccount> findByLoginId(String loginId);
	boolean existsByLoginId(String loginId);
	List<PlayerAccount> findTop20ByOrderByDefenseStageDescDefenseStageReachedAtAscIdAsc();
}
