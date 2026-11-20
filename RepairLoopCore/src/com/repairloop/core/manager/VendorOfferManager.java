package com.repairloop.core.manager;

import com.repairloop.core.enums.ListingStatus;
import com.repairloop.core.enums.OfferStatus;
import com.repairloop.core.exceptions.DuplicateSelectionException;
import com.repairloop.core.interfaces.OfferEvaluator;
import com.repairloop.core.model.ResaleListing;
import com.repairloop.core.model.VendorOffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Manages vendor purchase offers on resale listings.
 * Enforces single-winner acceptance and prevents duplicate purchases.
 */
public class VendorOfferManager implements OfferEvaluator<VendorOffer> {

    private final Map<String, ResaleListing> listingsById = new HashMap<>();
    private final Map<String, List<VendorOffer>> offersByListing = new HashMap<>();

    public void registerListing(ResaleListing listing) {
        listingsById.put(listing.getId(), listing);
        offersByListing.putIfAbsent(listing.getId(), new ArrayList<>());
    }

    public void addOffer(VendorOffer offer) {
        ResaleListing listing = listingsById.get(offer.getListingId());
        if (listing == null) {
            throw new IllegalArgumentException("Unknown listing ID: " + offer.getListingId());
        }
        if (listing.getStatus() == ListingStatus.SOLD) {
            throw new DuplicateSelectionException(
                "Listing " + listing.getId() + " has already been sold.");
        }
        offersByListing.computeIfAbsent(listing.getId(), k -> new ArrayList<>()).add(offer);
        if (listing.getStatus() == ListingStatus.AVAILABLE) {
            listing.setStatus(ListingStatus.OFFER_RECEIVED);
        }
    }

    /**
     * Ranks vendor offers highest offered price first.
     */
    @Override
    public List<VendorOffer> rankOffers(String listingId) {
        List<VendorOffer> list = new ArrayList<>(
                offersByListing.getOrDefault(listingId, Collections.emptyList()));
        Collections.sort(list);
        return list;
    }

    /**
     * Returns offers submitted by a single vendor (prevents seeing competing vendor offers).
     */
    public List<VendorOffer> getOffersForVendor(String vendorId) {
        List<VendorOffer> result = new ArrayList<>();
        for (List<VendorOffer> offers : offersByListing.values()) {
            for (VendorOffer o : offers) {
                if (o.getVendorId().equals(vendorId)) {
                    result.add(o);
                }
            }
        }
        return result;
    }

    @Override
    public VendorOffer acceptOffer(String listingId, String offerId) {
        ResaleListing listing = listingsById.get(listingId);
        if (listing == null) {
            throw new IllegalArgumentException("Listing not found: " + listingId);
        }
        if (listing.getStatus() == ListingStatus.SOLD) {
            throw new DuplicateSelectionException(
                "Duplicate purchase prevented: listing " + listingId + " is already SOLD.");
        }

        List<VendorOffer> offers = offersByListing.get(listingId);
        if (offers == null || offers.isEmpty()) {
            throw new IllegalArgumentException("No offers found for listing " + listingId);
        }

        VendorOffer accepted = null;
        for (VendorOffer o : offers) {
            if (o.getId().equals(offerId)) {
                accepted = o;
                break;
            }
        }
        if (accepted == null) {
            throw new IllegalArgumentException("Offer not found: " + offerId);
        }

        for (VendorOffer o : offers) {
            if (o.getId().equals(offerId)) {
                o.setStatus(OfferStatus.ACCEPTED);
            } else {
                o.setStatus(OfferStatus.REJECTED);
            }
        }

        listing.markSold(accepted.getId(), accepted.getVendorId(), accepted.getOfferedPrice());
        return accepted;
    }
}
