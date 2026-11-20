package com.repairloop.core.model;

import com.repairloop.core.enums.RepairStatus;

/**
 * Represents a customer repair request tracked through the RepairLoop lifecycle.
 */
public class RepairRequest extends BaseEntity {
    private final String customerId;
    private final ProductInfo productInfo;
    private final String problemDescription;
    private final String location;
    private RepairStatus status;
    private String acceptedQuotationId;

    public RepairRequest(
            String id,
            String customerId,
            ProductInfo productInfo,
            String problemDescription,
            String location) {
        super(id);
        this.customerId = customerId;
        this.productInfo = productInfo;
        this.problemDescription = problemDescription;
        this.location = location;
        this.status = RepairStatus.PENDING;
    }

    public String getCustomerId() { return customerId; }
    public ProductInfo getProductInfo() { return productInfo; }
    public String getProblemDescription() { return problemDescription; }
    public String getLocation() { return location; }
    public RepairStatus getStatus() { return status; }
    public String getAcceptedQuotationId() { return acceptedQuotationId; }

    public void setStatus(RepairStatus status) {
        this.status = status;
    }

    public void setAcceptedQuotationId(String acceptedQuotationId) {
        this.acceptedQuotationId = acceptedQuotationId;
    }

    @Override
    public String toString() {
        return String.format("RepairRequest[id=%s, product=%s %s, status=%s]",
                getId(), productInfo.getBrand(), productInfo.getProductName(), status);
    }
}
