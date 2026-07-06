/* pricing-config.js - Centralized pricing configuration */

window.JUNIOR_PRICING = {
    // Stripe Price IDs for standard plans
    STRIPE_PRICE_IDS: {
        'basic': 'price_1TcWzqRxE6F23RwQ7FnKpQyU',
        'starter': 'price_1TqD2LRxE6F23RwQg0S18fTb',
        'standard': 'price_1RJMCrRxE6F23RwQEnHUwvFq',
        'pro': 'price_1SX1LrRxE6F23RwQgWgIV1NK'
    },
    
    // Display configuration for plans
    PLANS: {
        'basic': {
            label: 'Basic',
            price: 9.99,
            dailyLimit: 10
        },
        'starter': {
            label: 'Starter',
            price: 14.99,
            dailyLimit: 20
        },
        'standard': {
            label: 'Standard',
            price: 29.99,
            dailyLimit: 50
        },
        'pro': {
            label: 'Pro',
            price: 49.99,
            dailyLimit: 80
        }
    },
    
    // Helper to map legacy plan names to current plan display names
    mapLegacyPlan: function(planName) {
        if (!planName) return 'Standard';
        const lower = planName.toLowerCase();
        if (lower === 'beta') return 'Standard';
        if (lower === 'premium') return 'Pro';
        if (lower === 'unlimited') return 'Pro';
        if (lower === 'trial') return 'Free Trial';
        
        // Capitalize first letter if it's a known plan
        if (this.PLANS[lower]) return this.PLANS[lower].label;
        
        // Return original capitalized
        return planName.charAt(0).toUpperCase() + planName.slice(1);
    }
};
