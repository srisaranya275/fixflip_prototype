package com.repairloop.core.model;

import com.repairloop.core.interfaces.Identifiable;
import java.time.Instant;

/**
 * Abstract base entity providing shared ID and creation timestamp fields
 * for all domain models in RepairLoopCore.
 */
public abstract class BaseEntity implements Identifiable {
    private final String id;
    private final Instant createdAt;

    protected BaseEntity(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("Entity ID cannot be null or blank.");
        }
        this.id = id;
        this.createdAt = Instant.now();
    }

    @Override
    public String getId() {
        return id;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
