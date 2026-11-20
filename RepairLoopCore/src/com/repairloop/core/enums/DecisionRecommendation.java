package com.repairloop.core.enums;

/**
 * Advisory outcome produced by RepairDecisionEngine.
 */
public enum DecisionRecommendation {
    REPAIR("Repair is financially and functionally favorable"),
    REPLACE("Replacement is likely more cost-effective");

    private final String summary;

    DecisionRecommendation(String summary) {
        this.summary = summary;
    }

    public String getSummary() {
        return summary;
    }
}
