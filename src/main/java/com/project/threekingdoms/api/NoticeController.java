package com.project.threekingdoms.api;

import java.util.List;

import com.project.threekingdoms.repository.NoticeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notices")
@RequiredArgsConstructor
public class NoticeController {

	private final NoticeRepository noticeRepository;

	public record NoticeDto(long id, String message) {}

	/** 활성 공지 목록 — 프론트 상단 배너 롤링 (GAME_DESIGN 9장) */
	@GetMapping
	public List<NoticeDto> activeNotices() {
		return noticeRepository.findByActiveTrueOrderByCreatedAtDesc().stream()
			.map(n -> new NoticeDto(n.getId(), n.getMessage()))
			.toList();
	}
}
