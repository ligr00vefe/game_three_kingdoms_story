package com.project.threekingdoms.repository;

import java.util.List;

import com.project.threekingdoms.domain.BugReport;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BugReportRepository extends JpaRepository<BugReport, Long> {
	List<BugReport> findTop20ByOrderByCreatedAtDesc();
}
