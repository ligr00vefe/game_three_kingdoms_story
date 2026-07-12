package com.project.threekingdoms.domain;

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
@Table(name = "game_character")
@Getter
@Setter
@NoArgsConstructor
public class GameCharacter {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 20)
	private String name;

	@Column(nullable = false)
	private int level = 1;

	@Column(nullable = false)
	private long exp = 0;

	@Column(name = "max_hp", nullable = false)
	private int maxHp = 100;

	@Column(nullable = false)
	private int hp = 100;

	@Column(name = "max_mp", nullable = false)
	private int maxMp = 50;

	@Column(nullable = false)
	private int mp = 50;

	@Column(name = "attack_power", nullable = false)
	private int attackPower = 10;

	@Column(nullable = false)
	private long gold = 0;

	@Column(name = "stage_code", nullable = false, length = 30)
	private String stageCode = "stage1_grassland";

	public GameCharacter(String name) {
		this.name = name;
	}
}
