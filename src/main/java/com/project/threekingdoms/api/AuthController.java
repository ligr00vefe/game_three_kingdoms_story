package com.project.threekingdoms.api;

import com.project.threekingdoms.api.dto.AuthDtos.AuthResponse;
import com.project.threekingdoms.api.dto.AuthDtos.Credentials;
import com.project.threekingdoms.api.dto.AuthDtos.RegisterRequest;
import com.project.threekingdoms.domain.PlayerAccount;
import com.project.threekingdoms.service.AuthService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
	private final AuthService authService;

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpSession session) {
		return loginSession(authService.register(request.loginId(), request.displayName(), request.password()), session);
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody Credentials request, HttpSession session) {
		return loginSession(authService.authenticate(request.loginId(), request.password()), session);
	}

	@GetMapping("/me")
	public AuthResponse me(HttpSession session) {
		Long id = (Long) session.getAttribute(AuthService.SESSION_ACCOUNT_ID);
		String loginId = (String) session.getAttribute(AuthService.SESSION_LOGIN_ID);
		String displayName = (String) session.getAttribute(AuthService.SESSION_DISPLAY_NAME);
		if (id == null || loginId == null) throw new IllegalStateException("NOT_LOGGED_IN");
		return new AuthResponse(id, loginId, displayName);
	}

	@DeleteMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout(HttpSession session) { session.invalidate(); }

	private AuthResponse loginSession(PlayerAccount account, HttpSession session) {
		session.setAttribute(AuthService.SESSION_ACCOUNT_ID, account.getId());
		session.setAttribute(AuthService.SESSION_LOGIN_ID, account.getLoginId());
		session.setAttribute(AuthService.SESSION_DISPLAY_NAME, account.getDisplayName());
		return new AuthResponse(account.getId(), account.getLoginId(), account.getDisplayName());
	}
}
