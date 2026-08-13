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
@Table(name = "bug_report")
@Getter
@Setter
@NoArgsConstructor
public class BugReport {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 100)
	private String title;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String content;

	@Column(nullable = false, length = 20)
	private String category = "BUG";

	@Column(nullable = false, length = 20)
	private String status = "OPEN";

	@Column(name = "reporter_name", nullable = false, length = 30)
	private String reporterName = "익명";

	@Column(name = "account_id")
	private Long accountId;

	@Column(name = "created_at", nullable = false, insertable = false, updatable = false)
	private LocalDateTime createdAt;

	public BugReport(String title, String content, String category, String reporterName, Long accountId) {
		this.title = title;
		this.content = content;
		this.category = category;
		this.reporterName = reporterName;
		this.accountId = accountId;
	}
}
