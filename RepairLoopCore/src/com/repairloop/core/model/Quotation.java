package com.repairloop.core.model;

import com.repairloop.core.enums.OfferStatus;
import com.repairloop.core.interfaces.Scorable;

/**
 * Represents a mechanic's quotation for a RepairRequest.
 * Implements Scorable and Comparable to enable objective quotation ranking.
 */
public class Quotation extends BaseEntity implements Scorable, Comparable<Quotation> {
    private final String requestId;
    private final String mechanicId;
    private final String mechanicName;
    private final double estimatedRepairCost;
    private final String spareParts;
    private final int completionTimeDays;
    private final int estimatedAdditionalLifespanMonths;
    private final String repairDescription;
    private final String notes;
    private OfferStatus status;

    public Quotation(
            String id,
            String requestId,
            String mechanicId,
            String mechanicName,
            double estimatedRepairCost,
            String spareParts,
            int completionTimeDays,
            int estimatedAdditionalLifespanMonths,
            String repairDescription,
            String notes) {
        super(id);
        if (estimatedRepairCost <= 0) {
            throw new IllegalArgumentException("Estimated repair cost must be greater than zero.");
        }
        this.requestId = requestId;
        this.mechanicId = mechanicId;
        this.mechanicName = mechanicName;
        this.estimatedRepairCost = estimatedRepairCost;
        this.spareParts = spareParts;
        this.completionTimeDays = Math.max(1, completionTimeDays);
        this.estimatedAdditionalLifespanMonths = Math.max(1, estimatedAdditionalLifespanMonths);
        this.repairDescription = repairDescription;
        this.notes = notes == null ? "" : notes;
        this.status = OfferStatus.PENDING;
    }

    /**
     * Computes a value-per-dollar score: higher additional lifespan and faster turnaround
     * yield a higher score relative to repair cost.
     */
    @Override
    public double calculateScore() {
        double lifespanValue = (estimatedAdditionalLifespanMonths * 12.0) / estimatedRepairCost;
        double speedBonus = 10.0 / completionTimeDays;
        return Math.round((lifespanValue * 100.0 + speedBonus) * 100.0) / 100.0;
    }

    @Override
    public int compareTo(Quotation other) {
        // Higher value score first; tie-breaker on lower repair cost
        int byScore = Double.compare(other.calculateScore(), this.calculateScore());
        if (byScore != 0) {
            return byScore;
        }
        return Double.compare(this.estimatedRepairCost, other.estimatedRepairCost);
    }

    public String getRequestId() { return requestId; }
    public String getMechanicId() { return mechanicId; }
    public String getMechanicName() { return mechanicName; }
    public double getEstimatedRepairCost() { return estimatedRepairCost; }
    public String getSpareParts() { return spareParts; }
    public int getCompletionTimeDays() { return completionTimeDays; }
    public int getEstimatedAdditionalLifespanMonths() { return estimatedAdditionalLifespanMonths; }
    public String getRepairDescription() { return repairDescription; }
    public String getNotes() { return notes; }
    public OfferStatus getStatus() { return status; }

    public void setStatus(OfferStatus status) {
        this.status = status;
    }

    @Override
    public String toString() {
        return String.format("Quotation[id=%s, mechanic=%s, cost=$%.2f, lifespan=%d mo, days=%d, status=%s, valueScore=%.2f]",
                getId(), mechanicName, estimatedRepairCost, estimatedAdditionalLifespanMonths,
                completionTimeDays, status, calculateScore());
    }
}
