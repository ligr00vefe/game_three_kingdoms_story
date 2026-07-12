package com.project.threekingdoms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@EnableCaching
@SpringBootApplication
public class ThreeKingdomsApplication {

	public static void main(String[] args) {
		SpringApplication.run(ThreeKingdomsApplication.class, args);
	}

}
