package com.repairloop.core.model;

/**
 * Encapsulates technical and financial attributes of a product
 * evaluated for repair or resale.
 */
public class ProductInfo {
    private final String productName;
    private final String category;
    private final String brand;
    private final String modelNumber;
    private final double productAgeYears;
    private final double originalPrice;
    private final double replacementPrice;
    private final int previousRepairCount;
    private final double previousRepairCost;
    private final boolean recurringFault;

    public ProductInfo(
            String productName,
            String category,
            String brand,
            String modelNumber,
            double productAgeYears,
            double originalPrice,
            double replacementPrice,
            int previousRepairCount,
            double previousRepairCost,
            boolean recurringFault) {
        this.productName = productName;
        this.category = category;
        this.brand = brand;
        this.modelNumber = modelNumber;
        this.productAgeYears = Math.max(0, productAgeYears);
        this.originalPrice = Math.max(0, originalPrice);
        this.replacementPrice = Math.max(0, replacementPrice);
        this.previousRepairCount = Math.max(0, previousRepairCount);
        this.previousRepairCost = Math.max(0, previousRepairCost);
        this.recurringFault = recurringFault;
    }

    public String getProductName() { return productName; }
    public String getCategory() { return category; }
    public String getBrand() { return brand; }
    public String getModelNumber() { return modelNumber; }
    public double getProductAgeYears() { return productAgeYears; }
    public double getOriginalPrice() { return originalPrice; }
    public double getReplacementPrice() { return replacementPrice; }
    public int getPreviousRepairCount() { return previousRepairCount; }
    public double getPreviousRepairCost() { return previousRepairCost; }
    public boolean isRecurringFault() { return recurringFault; }
}
