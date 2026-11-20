package com.repairloop.core.interfaces;

/**
 * Polymorphic scoring contract implemented by evaluation models and offers.
 */
public interface Scorable {
    double calculateScore();
}
