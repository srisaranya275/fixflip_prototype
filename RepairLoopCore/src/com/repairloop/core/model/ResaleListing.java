package com.repairloop.core.model;

import com.repairloop.core.enums.ListingStatus;

/**
 * Represents an electronic device or household appliance listed for resale.
 */
public class ResaleListing extends BaseEntity {
    private final String sellerId;
    private final String productName;
    private final String category;
    private final String brand;
    private final String model;
    private final double ageYears;
    private final String condition;
    private final double expectedPrice;
    private ListingStatus status;
    private String acceptedOfferId;
    private String buyerVendorId;
    private double soldPrice;

    public ResaleListing(
            String id,
            String sellerId,
            String productName,
            String category,
            String brand,
            String model,
            double ageYears,
            String condition,
            double expectedPrice) {
        super(id);
        this.sellerId = sellerId;
        this.productName = productName;
        this.category = category;
        this.brand = brand;
        this.model = model;
        this.ageYears = Math.max(0, ageYears);
        this.condition = condition;
        this.expectedPrice = Math.max(0, expectedPrice);
        this.status = ListingStatus.AVAILABLE;
    }

    public String getSellerId() { return sellerId; }
    public String getProductName() { return productName; }
    public String getCategory() { return category; }
    public String getBrand() { return brand; }
    public String getModel() { return model; }
    public double getAgeYears() { return ageYears; }
    public String getCondition() { return condition; }
    public double getExpectedPrice() { return expectedPrice; }
    public ListingStatus getStatus() { return status; }
    public String getAcceptedOfferId() { return acceptedOfferId; }
    public String getBuyerVendorId() { return buyerVendorId; }
    public double getSoldPrice() { return soldPrice; }

    public void setStatus(ListingStatus status) { this.status = status; }

    public void markSold(String offerId, String vendorId, double finalPrice) {
        this.status = ListingStatus.SOLD;
        this.acceptedOfferId = offerId;
        this.buyerVendorId = vendorId;
        this.soldPrice = finalPrice;
    }
}
