package com.coderarmy.ragsupport.hub.model;

/**
 * Standardized error categories for image generation, quota management, and provider routing.
 */
public enum ImageErrorCategory {
    ZERO_QUOTA("Zero Quota", "Model quota is explicitly zero (limit: 0 on Free Tier or zero balance)."),
    RATE_LIMITED("Rate Limited", "A positive quota exists, but a request-rate or daily limit was exceeded."),
    BILLING_REQUIRED("Billing Required", "Payment or Google Cloud / Provider billing setup is required."),
    SPEND_CAP_REACHED("Spend Cap Reached", "An account or project spending cap prevents the request."),
    AUTHENTICATION_FAILED("Authentication Failed", "An invalid, missing, or unauthorized API credential."),
    MODEL_UNAVAILABLE("Model Unavailable", "An invalid model ID, deprecated endpoint, or unsupported capability."),
    PROVIDER_UNAVAILABLE("Provider Unavailable", "A transient upstream provider outage or 5xx server error."),
    NETWORK_TIMEOUT("Network Timeout", "The upstream provider request timed out."),
    INVALID_RESPONSE("Invalid Response", "The response does not contain valid image data or binary payload."),
    EXCEPTION("Internal Exception", "An unexpected local or network exception occurred.");

    private final String displayName;
    private final String description;

    ImageErrorCategory(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
