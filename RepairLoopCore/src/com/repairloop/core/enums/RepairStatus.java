package com.repairloop.core.enums;

/**
 * Represents the lifecycle states of a repair request in RepairLoop.
 * Each state defines which transitions are valid for the RepairTracker.
 */
public enum RepairStatus {
    PENDING("Request Submitted"),
    QUOTATION_RECEIVED("Quotations Received"),
    QUOTATION_ACCEPTED("Provider Selected"),
    REPAIR_IN_PROGRESS("Repair In Progress"),
    REPAIR_COMPLETED("Repair Completed"),
    CANCELLED("Cancelled");

    private final String displayLabel;

    RepairStatus(String displayLabel) {
        this.displayLabel = displayLabel;
    }

    public String getDisplayLabel() {
        return displayLabel;
    }
}
