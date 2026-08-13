package com.project.threekingdoms.api;

import java.util.List;
import java.util.stream.IntStream;

import com.project.threekingdoms.domain.BugReport;
import com.project.threekingdoms.domain.GameCharacter;
import com.project.threekingdoms.repository.BugReportRepository;
import com.project.threekingdoms.repository.GameCharacterRepository;
import com.project.threekingdoms.repository.PlayerAccountRepository;
import com.project.threekingdoms.service.AuthService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

	private final GameCharacterRepository gameCharacterRepository;
	private final PlayerAccountRepository playerAccountRepository;
	private final BugReportRepository bugReportRepository;

	public record RankingDto(int rank, String playerName, String characterName, String characterCode,
		int defenseStage, int level) {}
	public record BugReportDto(long id, String title, String content, String category, String status,
		String reporterName, String createdAt) {}
	public record BugReportRequest(
		@NotBlank @Size(max = 100) String title,
		@NotBlank @Size(max = 4000) String content,
		@Size(max = 20) String category
	) {}

	@GetMapping("/defense-ranking")
	public List<RankingDto> defenseRanking() {
		List<GameCharacter> characters = gameCharacterRepository.findTop20ByOrderByDefenseStageDescLevelDescExpDesc();
		var accountNames = playerAccountRepository.findAllById(characters.stream()
			.map(GameCharacter::getAccountId)
			.filter(java.util.Objects::nonNull)
			.toList())
			.stream()
			.collect(java.util.stream.Collectors.toMap(account -> account.getId(), account -> account.getDisplayName()));
		return IntStream.range(0, characters.size())
			.mapToObj(index -> {
				GameCharacter character = characters.get(index);
				String playerName = accountNames.getOrDefault(character.getAccountId(), character.getName());
				return new RankingDto(index + 1, playerName, character.getName(), character.getCharacterCode(),
					character.getDefenseStage(), character.getLevel());
			})
			.toList();
	}

	@GetMapping("/bug-reports")
	public List<BugReportDto> bugReports() {
		return bugReportRepository.findTop20ByOrderByCreatedAtDesc().stream()
			.map(this::toDto)
		.toList();
	}

	@PostMapping("/bug-reports")
	@ResponseStatus(HttpStatus.CREATED)
	public BugReportDto createBugReport(@Valid @RequestBody BugReportRequest request, HttpSession session) {
		Long accountId = (Long) session.getAttribute(AuthService.SESSION_ACCOUNT_ID);
		String displayName = (String) session.getAttribute(AuthService.SESSION_DISPLAY_NAME);
		String reporterName = displayName == null || displayName.isBlank() ? "익명" : displayName;
		String category = request.category() == null || request.category().isBlank() ? "BUG" : request.category();
		return toDto(bugReportRepository.save(new BugReport(request.title().trim(), request.content().trim(), category,
			reporterName, accountId)));
	}

	private BugReportDto toDto(BugReport report) {
		return new BugReportDto(report.getId(), report.getTitle(), report.getContent(), report.getCategory(),
			report.getStatus(), report.getReporterName(), report.getCreatedAt() == null ? "" : report.getCreatedAt().toString());
	}
}
