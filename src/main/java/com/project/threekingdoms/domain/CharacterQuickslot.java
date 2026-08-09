package com.project.threekingdoms.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "character_quickslot")
@Getter
@NoArgsConstructor
public class CharacterQuickslot {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "character_id")
    private GameCharacter character;

    @Column(name = "slot_index", nullable = false)
    private int slotIndex;

    @Column(name = "entry_kind", nullable = false, length = 10)
    private String entryKind;

    @Column(name = "entry_code", nullable = false, length = 60)
    private String entryCode;

    public CharacterQuickslot(GameCharacter character, int slotIndex, String entryKind, String entryCode) {
        this.character = character;
        this.slotIndex = slotIndex;
        this.entryKind = entryKind;
        this.entryCode = entryCode;
    }
}
