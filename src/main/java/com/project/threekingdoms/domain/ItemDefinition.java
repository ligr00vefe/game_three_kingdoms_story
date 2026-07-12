package com.project.threekingdoms.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 아이템 정의 (V1__init.sql 시드). 효과는 JSON으로 유연하게 (예: {"heal":30}, {"moveSpeedPct":10}) */
@Entity
@Table(name = "item_definition")
@Getter
@NoArgsConstructor
public class ItemDefinition {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 40)
	private String code;

	@Column(nullable = false, length = 50)
	private String name;

	/** EQUIP / CONSUME / ETC / ARTIFACT */
	@Column(name = "item_type", nullable = false, length = 15)
	private String itemType;

	@Column(name = "icon_key", nullable = false, length = 60)
	private String iconKey;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "effect_json")
	private String effectJson;

	@Column(length = 200)
	private String description;
}
