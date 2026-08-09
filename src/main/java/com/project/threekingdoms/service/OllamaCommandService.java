package com.project.threekingdoms.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.project.threekingdoms.api.dto.AiCommandDtos.GameContext;
import com.project.threekingdoms.api.dto.AiCommandDtos.InterpretCommandRequest;
import com.project.threekingdoms.api.dto.AiCommandDtos.InterpretedCommand;
import com.project.threekingdoms.api.dto.AiCommandDtos.ChatRequest;
import com.project.threekingdoms.api.dto.AiCommandDtos.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** 유료 외부 API 없이 localhost의 Ollama만 호출하는 자연어 명령 해석기. */
@Service
public class OllamaCommandService {

	private static final Set<String> ALLOWED_ACTIONS = Set.of(
		"CONTINUE_AUTO_COMBAT", "MOVE_TO", "RUSH_TO", "RETURN_TO_BASE", "GUARD_POSITION",
		"ADVANCE_AND_ATTACK", "ATTACK_TARGET", "FOLLOW_PLAYER", "RETREAT", "HOLD",
		"USE_SKILL", "JUMP", "PLACE_BARRICADE", "TALK_TO_NPC", "STATUS",
		"HOLD_AND_ATTACK", "PURSUE_ENEMIES", "PRIORITIZE_CASTLE_DEFENSE",
		"ELIMINATE_CASTLE_INFILTRATORS",
		"GUARD_BEHIND_BARRICADE",
		"PICKUP_ITEM",
		"ANSWER_GAME_QUESTION", "UNSUPPORTED"
	);
	private static final Set<String> ALLOWED_TARGETS = Set.of(
		"forward", "backward", "current_position", "castle_gate", "main_castle",
		"castle_model_02", "outside_combat", "defense_arena", "npc_castle_lord",
		"in_front_of_character", "skill_charge_slash", "skill_glaive_flurry",
		"skill_decisive_strike", "skill_dragon_slash", "skill_lightning_descent"
	);

	private static final String SYSTEM_PROMPT = """
		If the user asks to defend behind a barricade, return GUARD_BEHIND_BARRICADE with a null targetId.
		If the user asks to pick up an item, coin, or money, return PICKUP_ITEM with a null targetId.
		너는 삼국지 횡스크롤 게임의 관우 명령 해석기다. 사용자의 한국어를 허용된 행동 하나로 변환한다.
		관우답게 간결한 한국어 한 문장으로 답하고 reply는 반드시 한국어 80자 이내로 쓴다.
		reason은 UNSUPPORTED일 때만 짧은 영문 코드로 쓰고 나머지는 null로 쓴다. JSON 이외의 글은 출력하지 않는다.

		행동 의미:
		- MOVE_TO: 싸우지 않고 이동. 앞으로=forward, 뒤로=backward
		- ADVANCE_AND_ATTACK: 돌진·돌파·진격하며 싸움
		- CONTINUE_AUTO_COMBAT: 현재 맵의 적을 계속 찾아 싸움
		- RETURN_TO_BASE: 마을·성·감숙성·본진으로 귀환
		- GUARD_POSITION: 여기 또는 성문을 지킴. 여기=current_position, 성문=castle_gate
		- RETREAT: 후퇴·퇴각, HOLD: 멈춤·대기, JUMP: 점프·도약
		- HOLD_AND_ATTACK: 정지·제자리·여기서 대기하면서 싸움
		- PURSUE_ENEMIES: 일반적인 적 추격. 성으로 침투한 적 명령에는 사용하지 않음
		- ELIMINATE_CASTLE_INFILTRATORS: 디펜스에서 성으로 이동하는 놓친 적들을 계속 섬멸
		- PRIORITIZE_CASTLE_DEFENSE: 수성 최우선·성을 먼저 지킴=castle_gate
		- TALK_TO_NPC: 동탁에게 이동=npc_castle_lord
		- PLACE_BARRICADE: 바리케이트·방벽·방책 설치=in_front_of_character
		- STATUS: 체력·상태 보고
		- ANSWER_GAME_QUESTION: 전직 등 게임 안 질문
		- UNSUPPORTED: 현대 지식, 게임에 없는 능력, 모호하거나 지원하지 않는 요구

		장소:
		- 성 밖으로 가= MOVE_TO/castle_model_02
		- 성 밖으로 나가서 싸워= MOVE_TO/outside_combat
		- 디펜스 아레나·좀비 방어전으로 가= MOVE_TO/defense_arena

		예시:
		"저놈들의 대열에 구멍을 내버려" => ADVANCE_AND_ATTACK/forward
		"너무 멀리 갔다. 성문 앞으로 돌아와 지켜" => GUARD_POSITION/castle_gate
		"하늘을 날아 폭격해" => UNSUPPORTED
		실제 실행 가능 여부와 대상 존재 여부는 게임 엔진이 다시 검증한다.
		""";

	private static final String CHAT_SYSTEM_PROMPT = """
		너는 삼국지 세계관의 관우다. 유비를 섬기는 촉한의 장수이며 의롭고 신중하고 충직하다.
		사용자에게는 항상 정중한 한국어 존댓말로 답하고, 관우다운 간결하고 단호한 말투를 사용한다.
		게임 속 현재 상황을 고려하되, 실제로 실행하지 않은 행동을 했다고 거짓말하지 않는다.
		이 요청은 게임 명령이 아닌 자유 대화다. 인사, 질문, 감상, 조언에는 자연스럽게 답한다.
		답변은 반드시 한국어 한 문장으로 작성하며 20자 안팎, 최대 40자로 짧게 한다.
		사고 과정, 분석, 영어 설명, 머리말, 따옴표를 출력하지 말고 사용자에게 보여 줄 최종 답변만 출력한다.
		삼국지 시대, 현재 게임, 인사나 간단한 일상 대화와 무관한 전문 질문에는
		"죄송하지만 제가 알지 못하는 분야입니다."처럼 짧게 거절한다.
		불확실한 게임 정보는 지어내지 말고 모른다고 답한다.
		""";

	private final ObjectMapper objectMapper;
	private final HttpClient httpClient;
	private final String baseUrl;
	private final String model;

	public OllamaCommandService(
		ObjectMapper objectMapper,
		@Value("${game.ai.ollama.base-url:http://127.0.0.1:11434}") String baseUrl,
		@Value("${game.ai.ollama.model:qwen3:4b}") String model
	) {
		this.objectMapper = objectMapper;
		this.baseUrl = baseUrl;
		this.model = model;
		this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
	}

	public InterpretedCommand interpret(InterpretCommandRequest request) {
		try {
			Map<String, Object> body = Map.of(
				"model", model,
				"stream", false,
				"think", false,
				"keep_alive", "5m",
				"format", schema(),
				"options", Map.of("temperature", 0),
				"messages", List.of(
					Map.of("role", "system", "content", SYSTEM_PROMPT),
					Map.of("role", "user", "content", contextText(request.context()) + "\n사용자 명령: " + request.text())
				)
			);
			HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(baseUrl + "/api/chat"))
				.timeout(Duration.ofSeconds(45))
				.header("Content-Type", "application/json; charset=UTF-8")
				.POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
				.build();
			HttpResponse<String> response = httpClient.send(
				httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
			if (response.statusCode() != 200) return unavailable("OLLAMA_HTTP_" + response.statusCode());
			JsonNode root = objectMapper.readTree(response.body());
			String content = root.path("message").path("content").asText("");
			return validate(objectMapper.readValue(content, InterpretedCommand.class));
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			return unavailable("OLLAMA_UNAVAILABLE");
		} catch (Exception exception) {
			return unavailable("OLLAMA_UNAVAILABLE");
		}
	}

	public ChatResponse chat(ChatRequest request) {
		try {
			Map<String, Object> body = Map.of(
				"model", model,
				"stream", false,
				"think", false,
				"keep_alive", "5m",
				"format", chatSchema(),
				"options", Map.of("temperature", 0.4, "num_predict", 64),
				"messages", List.of(
					Map.of("role", "system", "content", CHAT_SYSTEM_PROMPT),
					Map.of("role", "user", "content", contextText(request.context()) + "\n사용자: " + request.text())
				)
			);
			HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(baseUrl + "/api/chat"))
				.timeout(Duration.ofSeconds(120))
				.header("Content-Type", "application/json; charset=UTF-8")
				.POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
				.build();
			HttpResponse<String> response = httpClient.send(
				httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
			if (response.statusCode() != 200) return new ChatResponse("잠시 후 다시 말씀해 주십시오.");
			JsonNode root = objectMapper.readTree(response.body());
			String content = root.path("message").path("content").asText("");
			String reply;
			try {
				reply = cleanChatReply(objectMapper.readTree(content).path("reply").asText(""));
			} catch (Exception ignored) {
				reply = cleanChatReply(content);
			}
			if (reply.isBlank()) return new ChatResponse("다시 한번 말씀해 주십시오.");
			return new ChatResponse(reply.length() > 40 ? reply.substring(0, 40) : reply);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			return new ChatResponse("잠시 후 다시 말씀해 주십시오.");
		} catch (Exception exception) {
			return new ChatResponse("잠시 후 다시 말씀해 주십시오.");
		}
	}

	static String cleanChatReply(String rawReply) {
		if (rawReply == null) return "";
		String reply = rawReply.replaceAll("(?s)<think>.*?</think>", "").trim();
		int answerMarker = reply.lastIndexOf("</think>");
		if (answerMarker >= 0) reply = reply.substring(answerMarker + 8).trim();
		return reply.replaceAll("^[\\\"']|[\\\"']$", "").trim();
	}

	private InterpretedCommand validate(InterpretedCommand command) {
		if (command == null || !ALLOWED_ACTIONS.contains(command.action())) return unavailable("ACTION_NOT_ALLOWED");
		String target = command.targetId();
		if (target != null && !target.isBlank() && !ALLOWED_TARGETS.contains(target)) {
			return new InterpretedCommand("UNSUPPORTED", null, "NORMAL", "그 대상은 찾을 수 없습니다.", "TARGET_NOT_ALLOWED");
		}
		String priority = Set.of("LOW", "NORMAL", "HIGH").contains(command.priority()) ? command.priority() : "NORMAL";
		String reply = command.reply() == null || command.reply().isBlank() ? "명을 확인했습니다." : command.reply().trim();
		if (reply.length() > 80) reply = reply.substring(0, 80);
		String reason = "UNSUPPORTED".equals(command.action()) ? "MODEL_UNSUPPORTED" : null;
		return new InterpretedCommand(command.action(), target, priority, reply, reason);
	}

	private InterpretedCommand unavailable(String reason) {
		return new InterpretedCommand("UNSUPPORTED", null, "NORMAL",
			"로컬 AI가 응답하지 않습니다. 기본 명령으로 다시 말씀해 주십시오.", reason);
	}

	private String contextText(GameContext context) {
		if (context == null) return "현재 게임 상태: 알 수 없음";
		return "현재 게임 상태: map=%s, mode=%s, state=%s, hp=%s/%s".formatted(
			context.mapKey(), context.mode(), context.characterState(), context.hp(), context.maxHp());
	}

	private Map<String, Object> schema() {
		return Map.of(
			"type", "object",
			"properties", Map.of(
				"action", Map.of("type", "string", "enum", ALLOWED_ACTIONS.stream().sorted().toList()),
				"targetId", Map.of("type", List.of("string", "null")),
				"priority", Map.of("type", "string", "enum", List.of("LOW", "NORMAL", "HIGH")),
				"reply", Map.of("type", "string"),
				"reason", Map.of("type", List.of("string", "null"))
			),
			"required", List.of("action", "targetId", "priority", "reply", "reason"),
			"additionalProperties", false
		);
	}

	private Map<String, Object> chatSchema() {
		return Map.of(
			"type", "object",
			"properties", Map.of("reply", Map.of(
				"type", "string",
				"maxLength", 40
			)),
			"required", List.of("reply"),
			"additionalProperties", false
		);
	}
}
