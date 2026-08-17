package com.project.threekingdoms.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "player_account")
@Getter
@Setter
@NoArgsConstructor
public class PlayerAccount {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "login_id", nullable = false, unique = true, length = 30)
	private String loginId;

	@Column(name = "password_hash", nullable = false, length = 100)
	private String passwordHash;

	@Column(name = "display_name", nullable = false, length = 30)
	private String displayName;

	@Column(name = "defense_stage", nullable = false)
	private int defenseStage = 1;

	@Column(name = "defense_stage_reached_at", nullable = false)
	private LocalDateTime defenseStageReachedAt = LocalDateTime.now();

	@Column(name = "last_character_code", nullable = false, length = 30)
	private String lastCharacterCode = "guanwu";

	@Column(nullable = false)
	private long gold = 0;

	public PlayerAccount(String loginId, String passwordHash, String displayName) {
		this.loginId = loginId;
		this.passwordHash = passwordHash;
		this.displayName = displayName;
	}
}
