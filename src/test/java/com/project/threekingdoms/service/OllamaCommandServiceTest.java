package com.project.threekingdoms.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OllamaCommandServiceTest {

	@Test
	void removesQwenThinkingBlockFromChatReply() {
		String reply = OllamaCommandService.cleanChatReply(
			"<think>사용자 의도를 분석한다.</think> 반갑습니다, 주군."
		);

		assertThat(reply).isEqualTo("반갑습니다, 주군.");
	}

	@Test
	void removesWrappingQuotesFromChatReply() {
		assertThat(OllamaCommandService.cleanChatReply("\"평안하셨습니까?\""))
			.isEqualTo("평안하셨습니까?");
	}
}
