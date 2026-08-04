package com.project.threekingdoms.service;

import com.project.threekingdoms.domain.PlayerAccount;
import com.project.threekingdoms.repository.PlayerAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {
	public static final String SESSION_ACCOUNT_ID = "threeKingdoms.accountId";
	public static final String SESSION_LOGIN_ID = "threeKingdoms.loginId";
	public static final String SESSION_DISPLAY_NAME = "threeKingdoms.displayName";

	private final PlayerAccountRepository repository;
	private final PasswordEncoder passwordEncoder;

	@Transactional
	public PlayerAccount register(String loginId, String displayName, String password) {
		if (repository.existsByLoginId(loginId)) throw new IllegalArgumentException("LOGIN_ID_EXISTS");
		return repository.save(new PlayerAccount(loginId, passwordEncoder.encode(password), displayName));
	}

	public PlayerAccount authenticate(String loginId, String password) {
		PlayerAccount account = repository.findByLoginId(loginId)
			.orElseThrow(() -> new IllegalArgumentException("INVALID_CREDENTIALS"));
		if (!passwordEncoder.matches(password, account.getPasswordHash())) {
			throw new IllegalArgumentException("INVALID_CREDENTIALS");
		}
		return account;
	}
}
