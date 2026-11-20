package com.repairloop.core;

import com.repairloop.core.engine.RepairDecisionEngine;
import com.repairloop.core.enums.RepairStatus;
import com.repairloop.core.exceptions.DuplicateSelectionException;
import com.repairloop.core.exceptions.InvalidStateTransitionException;
import com.repairloop.core.manager.QuotationManager;
import com.repairloop.core.manager.RepairTracker;
import com.repairloop.core.manager.VendorOfferManager;
import com.repairloop.core.model.DecisionResult;
import com.repairloop.core.model.ProductInfo;
import com.repairloop.core.model.Quotation;
import com.repairloop.core.model.RepairRequest;
import com.repairloop.core.model.ResaleListing;
import com.repairloop.core.model.VendorOffer;
import java.util.List;

/**
 * Runnable Java 21 demonstration for RepairLoopCore.
 * Exercises all core business logic modules end-to-end without Spring Boot.
 */
public class Main {

    public static void main(String[] args) {
        System.out.println("====================================================");
        System.out.println("  RepairLoopCore - Java 21 Business Logic Demo");
        System.out.println("====================================================\n");

        // 1. Create a Repair Request
        System.out.println("1. Creating Repair Request...");
        ProductInfo laptop = new ProductInfo(
                "ZenBook 14 OLED",
                "Laptops & Computers",
                "ASUS",
                "UX3402ZA",
                2.5,
                1199.00,
                1149.00,
                0,
                0.0,
                false
        );
        RepairRequest request = new RepairRequest(
                "RL-1042",
                "cust-001",
                laptop,
                "USB-C charging IC failure; laptop runs on battery only.",
                "Austin, TX"
        );
        System.out.println("   Created: " + request + "\n");

        // 2. Run RepairDecisionEngine
        System.out.println("2. Running RepairDecisionEngine...");
        RepairDecisionEngine decisionEngine = new RepairDecisionEngine();
        DecisionResult decision = decisionEngine.evaluate(laptop, 210.00, 30);
        System.out.println("   " + decision);
        System.out.println("   Factor Breakdown: " + decision.getFactorBreakdown() + "\n");

        // 3. Create Multiple Quotations
        System.out.println("3. Creating Multiple Mechanic Quotations...");
        QuotationManager quotationManager = new QuotationManager();
        quotationManager.registerRequest(request);

        Quotation q1 = new Quotation(
                "QT-201", request.getId(), "mech-11", "Precision Micro-Solder Lab",
                215.00, "TI USB-C PD Controller IC + Thermal Pads", 3, 30,
                "Board-level IC replacement and ultrasonic flux cleaning.",
                "Includes 6-month workmanship warranty."
        );
        Quotation q2 = new Quotation(
                "QT-202", request.getId(), "mech-22", "Metro Circuit Repair",
                260.00, "OEM Power Management IC + USB-C Port", 2, 24,
                "Full charging rail rebuild and load test.",
                "Express 48-hour turnaround."
        );
        quotationManager.addQuotation(q1);
        quotationManager.addQuotation(q2);

        List<Quotation> rankedQuotes = quotationManager.rankOffers(request.getId());
        for (Quotation q : rankedQuotes) {
            System.out.println("   Candidate: " + q);
        }
        System.out.println();

        // 4. Accept One Quotation & Verify Competing Rejection + Duplicate Protection
        System.out.println("4. Accepting Quotation QT-201...");
        Quotation acceptedQuote = quotationManager.acceptOffer(request.getId(), "QT-201");
        System.out.println("   Accepted: " + acceptedQuote);
        for (Quotation q : quotationManager.rankOffers(request.getId())) {
            System.out.println("   Updated Status -> " + q.getId() + ": " + q.getStatus());
        }
        try {
            quotationManager.acceptOffer(request.getId(), "QT-202");
        } catch (DuplicateSelectionException ex) {
            System.out.println("   Guard Verified: " + ex.getMessage());
        }
        System.out.println();

        // 5. Update Repair Status via RepairTracker
        System.out.println("5. Updating Repair Status via RepairTracker...");
        RepairTracker tracker = new RepairTracker();
        System.out.println("   Current Status: " + request.getStatus());
        tracker.updateStatus(request, RepairStatus.REPAIR_IN_PROGRESS);
        System.out.println("   Transitioned to: " + request.getStatus());
        tracker.updateStatus(request, RepairStatus.REPAIR_COMPLETED);
        System.out.println("   Transitioned to: " + request.getStatus());

        try {
            tracker.updateStatus(request, RepairStatus.PENDING);
        } catch (InvalidStateTransitionException ex) {
            System.out.println("   Guard Verified: " + ex.getMessage());
        }
        System.out.println();

        // 6. Create Vendor Offers on a Resale Listing
        System.out.println("6. Creating Vendor Offers on Resale Listing...");
        ResaleListing listing = new ResaleListing(
                "LIST-501", "cust-001", "Barista Pro Espresso Machine",
                "Kitchen Appliances", "Breville", "BES878", 3.5, "GOOD", 420.00
        );
        VendorOfferManager offerManager = new VendorOfferManager();
        offerManager.registerListing(listing);

        VendorOffer offer1 = new VendorOffer(
                "OFF-301", listing.getId(), "vend-10", "GreenCycle Refurbishers",
                390.00, "Pickup within 24 hours with immediate payout."
        );
        VendorOffer offer2 = new VendorOffer(
                "OFF-302", listing.getId(), "vend-20", "Circular Home Appliances",
                430.00, "Full asking price offer plus certified parts testing."
        );
        offerManager.addOffer(offer1);
        offerManager.addOffer(offer2);

        for (VendorOffer offer : offerManager.rankOffers(listing.getId())) {
            System.out.println("   Offer: " + offer);
        }
        System.out.println();

        // 7. Accept a Vendor Offer & Verify Duplicate Purchase Prevention
        System.out.println("7. Accepting Vendor Offer OFF-302...");
        VendorOffer winningOffer = offerManager.acceptOffer(listing.getId(), "OFF-302");
        System.out.println("   Winning Offer: " + winningOffer);
        System.out.println("   Listing Status: " + listing.getStatus()
                + " | Buyer Vendor: " + listing.getBuyerVendorId()
                + " | Final Price: $" + listing.getSoldPrice());
        try {
            offerManager.acceptOffer(listing.getId(), "OFF-301");
        } catch (DuplicateSelectionException ex) {
            System.out.println("   Guard Verified: " + ex.getMessage());
        }

        System.out.println("\nDemo completed successfully.");
    }
}
