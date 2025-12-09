/* Referral Tracking System
 * Detects ?ref=CODE in URL and routes to partner payment links
 */

// Partner payment links configuration
// Add new partners here: 'code': 'stripe_payment_link_url'
const PARTNER_LINKS = {
  'qazi': 'https://buy.stripe.com/4gM3cxfFz6Ru0wTf523cc03'
};

(function() {
  // Check for referral code in URL
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref')?.toLowerCase();
  
  if (refCode) {
    console.log('Referral detected:', refCode);
    
    // Store referral in localStorage (persists across pages)
    localStorage.setItem('referralCode', refCode);
    localStorage.setItem('referralTimestamp', Date.now());
    
    // Check if this is a known partner
    if (PARTNER_LINKS[refCode]) {
      localStorage.setItem('partnerPaymentLink', PARTNER_LINKS[refCode]);
    }
  }
  
  // Apply stored referral to checkout buttons
  function applyReferralToLinks() {
    const storedRef = localStorage.getItem('referralCode');
    const partnerLink = localStorage.getItem('partnerPaymentLink');
    
    // Only apply if referral is less than 30 days old
    const refTimestamp = localStorage.getItem('referralTimestamp');
    if (refTimestamp) {
      const daysSinceRef = (Date.now() - parseInt(refTimestamp)) / (1000 * 60 * 60 * 24);
      if (daysSinceRef > 30) {
        // Clear expired referral
        localStorage.removeItem('referralCode');
        localStorage.removeItem('referralTimestamp');
        localStorage.removeItem('partnerPaymentLink');
        return;
      }
    }
    
    if (storedRef && partnerLink) {
      // Replace checkout links with partner's payment link
      const checkoutLinks = document.querySelectorAll('a[href*="checkout.html"]');
      checkoutLinks.forEach(link => {
        link.href = partnerLink;
        console.log('Redirecting checkout to partner link:', partnerLink);
      });
      
      // Add visual indicator (optional)
      const ctaButtons = document.querySelectorAll('.primary-button, .cta-button');
      ctaButtons.forEach(btn => {
        if (btn.href && btn.href.includes(partnerLink)) {
          // Could add a badge or modify text if desired
        }
      });
    }
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

