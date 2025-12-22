/* Referral Tracking System
 * Detects ?ref=CODE in URL and routes to partner payment links
 */

// Partner payment links configuration
// Add new partners here: 'code': 'stripe_payment_link_url'
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
    
    // Check if this is a known partner (for payment link redirects)
    const lowerRefCode = normalizedRefCode.toLowerCase();
    if (PARTNER_LINKS[lowerRefCode]) {
      localStorage.setItem('partnerPaymentLink', PARTNER_LINKS[lowerRefCode]);
    }
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
  
  // Apply stored referral to checkout buttons (for partner payment links only)
  function applyReferralToLinks() {
    cleanupExpiredReferrals();
    
    const storedRef = localStorage.getItem('referralCode');
    const partnerLink = localStorage.getItem('partnerPaymentLink');
    
    // Only redirect to partner links if it's a known partner
    if (storedRef && partnerLink) {
      // Replace checkout links with partner's payment link
      const checkoutLinks = document.querySelectorAll('a[href*="checkout.html"]');
      checkoutLinks.forEach(link => {
        link.href = partnerLink;
        console.log('Redirecting checkout to partner link:', partnerLink);
      });
    }
    // Note: Regular referral codes are stored and will be sent during signup
    // They don't need to redirect checkout links
  }
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyReferralToLinks);
  } else {
    applyReferralToLinks();
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

