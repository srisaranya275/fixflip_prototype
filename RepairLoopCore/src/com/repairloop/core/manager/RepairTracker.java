package com.repairloop.core.manager;

import com.repairloop.core.enums.RepairStatus;
import com.repairloop.core.exceptions.InvalidStateTransitionException;
import com.repairloop.core.model.RepairRequest;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Validates and applies repair lifecycle status transitions.
 * Prevents skipping stages or mutating completed/cancelled requests.
 */
public class RepairTracker {

    private final Map<RepairStatus, Set<RepairStatus>> allowedTransitions =
            new EnumMap<>(RepairStatus.class);

    public RepairTracker() {
        allowedTransitions.put(
                RepairStatus.PENDING,
                EnumSet.of(RepairStatus.QUOTATION_RECEIVED, RepairStatus.CANCELLED));
        allowedTransitions.put(
                RepairStatus.QUOTATION_RECEIVED,
                EnumSet.of(RepairStatus.QUOTATION_ACCEPTED, RepairStatus.CANCELLED));
        allowedTransitions.put(
                RepairStatus.QUOTATION_ACCEPTED,
                EnumSet.of(RepairStatus.REPAIR_IN_PROGRESS, RepairStatus.CANCELLED));
        allowedTransitions.put(
                RepairStatus.REPAIR_IN_PROGRESS,
                EnumSet.of(RepairStatus.REPAIR_COMPLETED));
        allowedTransitions.put(RepairStatus.REPAIR_COMPLETED, EnumSet.noneOf(RepairStatus.class));
        allowedTransitions.put(RepairStatus.CANCELLED, EnumSet.noneOf(RepairStatus.class));
    }

    public boolean isTransitionAllowed(RepairStatus current, RepairStatus target) {
        if (current == null || target == null) {
            return false;
        }
        return allowedTransitions.getOrDefault(current, EnumSet.noneOf(RepairStatus.class))
                .contains(target);
    }

    public void updateStatus(RepairRequest request, RepairStatus nextStatus) {
        if (request == null) {
            throw new IllegalArgumentException("RepairRequest cannot be null.");
        }
        RepairStatus current = request.getStatus();
        if (!isTransitionAllowed(current, nextStatus)) {
            throw new InvalidStateTransitionException(String.format(
                "Invalid repair status transition from %s to %s for request %s.",
                current, nextStatus, request.getId()));
        }
        request.setStatus(nextStatus);
    }
}
