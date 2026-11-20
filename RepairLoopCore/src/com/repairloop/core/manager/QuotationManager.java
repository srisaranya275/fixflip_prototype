package com.repairloop.core.manager;

import com.repairloop.core.enums.OfferStatus;
import com.repairloop.core.enums.RepairStatus;
import com.repairloop.core.exceptions.DuplicateSelectionException;
import com.repairloop.core.interfaces.OfferEvaluator;
import com.repairloop.core.model.Quotation;
import com.repairloop.core.model.RepairRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Manages mechanic quotations for repair requests.
 * Enforces single-quotation acceptance and automatic rejection of competing bids.
 */
public class QuotationManager implements OfferEvaluator<Quotation> {

    private final Map<String, List<Quotation>> quotationsByRequest = new HashMap<>();
    private final Map<String, String> acceptedQuotationByRequest = new HashMap<>();
    private final Map<String, RepairRequest> requestsById = new HashMap<>();

    public void registerRequest(RepairRequest request) {
        requestsById.put(request.getId(), request);
        quotationsByRequest.putIfAbsent(request.getId(), new ArrayList<>());
    }

    public void addQuotation(Quotation quotation) {
        String requestId = quotation.getRequestId();
        RepairRequest request = requestsById.get(requestId);
        if (request == null) {
            throw new IllegalArgumentException("Unknown repair request ID: " + requestId);
        }
        if (acceptedQuotationByRequest.containsKey(requestId)) {
            throw new DuplicateSelectionException(
                "Cannot submit quotation; request " + requestId + " already has an accepted quotation.");
        }
        quotationsByRequest.computeIfAbsent(requestId, k -> new ArrayList<>()).add(quotation);
        if (request.getStatus() == RepairStatus.PENDING) {
            request.setStatus(RepairStatus.QUOTATION_RECEIVED);
        }
    }

    /**
     * Returns quotations sorted by value score (lifespan & turnaround vs cost).
     */
    @Override
    public List<Quotation> rankOffers(String requestId) {
        List<Quotation> list = new ArrayList<>(
                quotationsByRequest.getOrDefault(requestId, Collections.emptyList()));
        Collections.sort(list);
        return list;
    }

    /**
     * Returns quotations visible only to a specific mechanic (privacy isolation).
     */
    public List<Quotation> getQuotationsForMechanic(String mechanicId) {
        List<Quotation> result = new ArrayList<>();
        for (List<Quotation> quotes : quotationsByRequest.values()) {
            for (Quotation q : quotes) {
                if (q.getMechanicId().equals(mechanicId)) {
                    result.add(q);
                }
            }
        }
        return result;
    }

    /**
     * Accepts one quotation for the given request, rejects all competing quotations,
     * and prevents duplicate acceptance.
     */
    @Override
    public Quotation acceptOffer(String requestId, String quotationId) {
        if (acceptedQuotationByRequest.containsKey(requestId)) {
            throw new DuplicateSelectionException(
                "A quotation has already been accepted for repair request " + requestId);
        }

        List<Quotation> candidates = quotationsByRequest.get(requestId);
        if (candidates == null || candidates.isEmpty()) {
            throw new IllegalArgumentException("No quotations found for request " + requestId);
        }

        Quotation selected = null;
        for (Quotation q : candidates) {
            if (q.getId().equals(quotationId)) {
                selected = q;
                break;
            }
        }

        if (selected == null) {
            throw new IllegalArgumentException("Quotation not found: " + quotationId);
        }

        for (Quotation q : candidates) {
            if (q.getId().equals(quotationId)) {
                q.setStatus(OfferStatus.ACCEPTED);
            } else {
                q.setStatus(OfferStatus.REJECTED);
            }
        }

        acceptedQuotationByRequest.put(requestId, quotationId);
        RepairRequest request = requestsById.get(requestId);
        if (request != null) {
            request.setStatus(RepairStatus.QUOTATION_ACCEPTED);
            request.setAcceptedQuotationId(quotationId);
        }

        return selected;
    }
}
