package com.repairloop.core.interfaces;

import java.util.List;

/**
 * Generic contract for comparing and ranking candidate offers or quotations.
 *
 * @param <T> Offer or Quotation entity type
 */
public interface OfferEvaluator<T> {
    List<T> rankOffers(String parentId);
    T acceptOffer(String parentId, String offerId);
}
