package com.repairloop.core.exceptions;

/**
 * Thrown when an attempt is made to move a repair request into an
 * invalid or out-of-order lifecycle state.
 */
public class InvalidStateTransitionException extends RuntimeException {
    public InvalidStateTransitionException(String message) {
        super(message);
    }
}
