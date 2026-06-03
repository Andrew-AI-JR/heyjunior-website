/* Referral tracking: ?ref=CODE stored 30d and sent as referral_code on register/checkout.
 * Legacy partner payment links are being migrated to Stripe Connect; partners in
 * MIGRATED_TO_CONNECT bypass the payment link redirect and use standard checkout with revenue split.
 * Self-referral must be enforced in the API on register (not in this script).
 */

// Partners migrated to Stripe Connect (add codes here as each partner is onboarded)
const MIGRATED_TO_CONNECT = [];

// Legacy partner payment links (will be removed once all partners are on Connect)
const PARTNER_LINKS = {
  'qazi': 'https://buy.stripe.com/4gM3cxfFz6Ru0wTf523cc03',
  'taco': 'https://buy.stripe.com/cNidRbctn5Nq1AX7CA3cc04',
  'chris-c': 'https://buy.stripe.com/3cI9AVgJD0t6enJ3mk3cc05',
  'buki': 'https://buy.stripe.com/00w7sN2SNgs4a7tf523cc06',
  'ellen': 'https://buy.stripe.com/00wdRb0KFdfS6Vh1ec3cc07',
  'zach-wilson': 'https://buy.stripe.com/6oUfZjctn4JmgvRcWU3cc08',
  '14-day-trial': 'https://buy.stripe.com/5kQcN7ctn2BedjF5us3cc09'
};

(function() {
  // Check for referral code in URL
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  if (refCode) {
    const normalizedRefCode = refCode.toUpperCase(); // Store in uppercase for consistency
    console.log('Referral detected:', normalizedRefCode);
    
    // Check if we already have a referral code stored
    const existingRefCode = localStorage.getItem('referralCode');
    const existingTimestamp = localStorage.getItem('referralTimestamp');
    
    // Only store if we don't have one, or if the existing one is expired
    let shouldStore = true;
    if (existingRefCode && existingTimestamp) {
      const daysSinceRef = (Date.now() - parseInt(existingTimestamp)) / (1000 * 60 * 60 * 24);
      if (daysSinceRef <= 30) {
        // We already have a valid referral code, keep the first one
        console.log('Keeping existing referral code:', existingRefCode);
        shouldStore = false;
      } else {
        // Existing referral is expired, clear it
        console.log('Existing referral code expired, storing new one');
        localStorage.removeItem('referralCode');
        localStorage.removeItem('referralTimestamp');
        localStorage.removeItem('partnerPaymentLink');
      }
    }
    
    if (shouldStore) {
      // Store referral in localStorage (persists across pages)
      // Keep for 30 days - this tracks who referred the user
      localStorage.setItem('referralCode', normalizedRefCode);
      localStorage.setItem('referralTimestamp', Date.now().toString());
      console.log('Stored referral code:', normalizedRefCode, 'for 30 days');
    }
    
    // Unified signup: always use register.html + API referral_code (no buy.stripe.com redirects)
    localStorage.removeItem('partnerPaymentLink');
  }
  
  // Clean up expired referral codes
  function cleanupExpiredReferrals() {
    const refTimestamp = localStorage.getItem('referralTimestamp');
    if (refTimestamp) {
      const daysSinceRef = (Date.now() - parseInt(refTimestamp)) / (1000 * 60 * 60 * 24);
      if (daysSinceRef > 30) {
        // Clear expired referral after 30 days
        console.log('Referral code expired, clearing...');
        localStorage.removeItem('referralCode');
        localStorage.removeItem('referralTimestamp');
        localStorage.removeItem('partnerPaymentLink');
      }
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanupExpiredReferrals);
  } else {
    cleanupExpiredReferrals();
  }
})();

// Export for use in checkout.js if needed
window.getReferralCode = function() {
  return localStorage.getItem('referralCode');
};

window.getPartnerPaymentLink = function() {
  return localStorage.getItem('partnerPaymentLink');
};

window.clearReferral = function() {
  localStorage.removeItem('referralCode');
  localStorage.removeItem('referralTimestamp');
  localStorage.removeItem('partnerPaymentLink');
};

