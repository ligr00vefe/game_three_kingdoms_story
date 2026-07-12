package com.project.threekingdoms.repository;

import java.util.List;

import com.project.threekingdoms.domain.Notice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoticeRepository extends JpaRepository<Notice, Long> {
	List<Notice> findByActiveTrueOrderByCreatedAtDesc();
}
