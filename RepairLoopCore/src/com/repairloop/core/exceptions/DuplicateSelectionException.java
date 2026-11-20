package com.repairloop.core.exceptions;

/**
 * Thrown when a user attempts to accept more than one quotation for the
 * same repair request or sell the same resale listing to multiple vendors.
 */
public class DuplicateSelectionException extends RuntimeException {
    public DuplicateSelectionException(String message) {
        super(message);
    }
}
