package com.repairloop.core.model;

import com.repairloop.core.enums.OfferStatus;
import com.repairloop.core.interfaces.Scorable;

/**
 * Represents a vendor's purchase offer on a ResaleListing.
 * Ranked highest offered price first.
 */
public class VendorOffer extends BaseEntity implements Scorable, Comparable<VendorOffer> {
    private final String listingId;
    private final String vendorId;
    private final String vendorName;
    private final double offeredPrice;
    private final String message;
    private OfferStatus status;

    public VendorOffer(
            String id,
            String listingId,
            String vendorId,
            String vendorName,
            double offeredPrice,
            String message) {
        super(id);
        if (offeredPrice <= 0) {
            throw new IllegalArgumentException("Offered price must be greater than zero.");
        }
        this.listingId = listingId;
        this.vendorId = vendorId;
        this.vendorName = vendorName;
        this.offeredPrice = offeredPrice;
        this.message = message == null ? "" : message;
        this.status = OfferStatus.PENDING;
    }

    @Override
    public double calculateScore() {
        return offeredPrice;
    }

    @Override
    public int compareTo(VendorOffer other) {
        return Double.compare(other.offeredPrice, this.offeredPrice);
    }

    public String getListingId() { return listingId; }
    public String getVendorId() { return vendorId; }
    public String getVendorName() { return vendorName; }
    public double getOfferedPrice() { return offeredPrice; }
    public String getMessage() { return message; }
    public OfferStatus getStatus() { return status; }

    public void setStatus(OfferStatus status) { this.status = status; }

    @Override
    public String toString() {
        return String.format("VendorOffer[id=%s, vendor=%s, offered=$%.2f, status=%s, msg=\"%s\"]",
                getId(), vendorName, offeredPrice, status, message);
    }
}
