// Simple GlobalizeJS Configuration without complex CLDR requirements
// This script provides internationalization for the static website

// Translation data storage
let translations = {
  en: {},
  es: {}
};

let currentLocale = 'en';

// Initialize the internationalization system
async function initializeI18n() {
  try {
    // Determine language as early as possible
    const savedLang = localStorage.getItem('selectedLanguage');
    const browserLang = navigator.language || navigator.userLanguage;
    const defaultLang = browserLang.startsWith('es') ? 'es' : 'en';
    const selectedLang = savedLang || defaultLang;

    // Set locale first
    setCurrentLocale(selectedLang);

    // Load translation files
    await loadTranslations();

    // I18n system initialized successfully
    return true;

  } catch (error) {
    console.error('Failed to initialize i18n system:', error);
    return false;
  }
}

// Load translation files
async function loadTranslations() {
  try {
    const [enResponse, esResponse] = await Promise.all([
      fetch('./locales/en/translation.json'),
      fetch('./locales/es/translation.json')
    ]);

    if (!enResponse.ok || !esResponse.ok) {
      throw new Error('Failed to fetch translation files');
    }

    const [enData, esData] = await Promise.all([
      enResponse.json(),
      esResponse.json()
    ]);
    console.log('Raw translation data (enData):', enData);
    console.log('Raw translation data (esData):', esData);

    // Convert nested objects to dot notation
    translations.en = flattenObject(enData);
    translations.es = flattenObject(esData);
    console.log('Flattened translations (en):', translations.en);
    console.log('Flattened translations (es):', translations.es);

    // Translation files loaded successfully

  } catch (error) {
    console.error('Error loading translations:', error);
    // Use empty objects as fallback
    translations.en = {};
    translations.es = {};
  }
}

// Convert nested object to dot notation
function flattenObject(obj, prefix = '') {
  const flattened = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flattened, flattenObject(obj[key], newKey));
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }

  return flattened;
}

// Set current locale
function setCurrentLocale(locale) {
  if (locale === 'es' || locale === 'en') {
    currentLocale = locale;
  } else {
    currentLocale = 'en'; // fallback
  }

  // Store in localStorage
  localStorage.setItem('selectedLanguage', currentLocale);

  // Update document language
  document.documentElement.lang = currentLocale;

  // Locale set to currentLocale
}

// Get current locale
function getCurrentLocale() {
  return currentLocale;
}

// Translate function
function translate(key, options = {}) {
  try {
    const currentTranslations = translations[currentLocale] || translations.en;

    if (!currentTranslations) {
      console.warn('No translations available, returning key:', key);
      return key;
    }

    const translation = currentTranslations[key];

    if (!translation) {
      console.warn('Translation not found for key:', key, 'in locale:', currentLocale);
      // Try fallback to English
      const fallbackTranslation = translations.en[key];
      return fallbackTranslation || key;
    }

    // Simple variable replacement if options provided
    let result = translation;
    if (options && typeof options === 'object') {
      Object.keys(options).forEach(optionKey => {
        const placeholder = `{{${optionKey}}}`;
        result = result.replace(new RegExp(placeholder, 'g'), options[optionKey]);
      });
    }

    return result;

  } catch (error) {
    console.warn('Translation error for key:', key, error);
    return key;
  }
}

// Update page content
function updateContent() {
  try {
    // Updating content for locale

    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = translate(key);

      if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'email' || element.type === 'password')) {
        element.placeholder = translation;
      } else {
        element.textContent = translation;
      }
    });

    // Update elements with data-i18n-html attribute (for HTML content)
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
      const key = element.getAttribute('data-i18n-html');
      const translation = translate(key);
      element.innerHTML = translation;
    });

    // Update meta tags
    updateMetaTags();

    // Update page title
    updatePageTitle();

    // Show the page now that content is ready
    showPage();

    // Content updated successfully

  } catch (error) {
    console.error('Error updating content:', error);
    showPage(); // Show page even if there are translation errors
  }
}

// Update meta tags
function updateMetaTags() {
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    const pageType = document.body.getAttribute('data-page');
    let descKey = 'meta.description';

    if (pageType === 'checkout') {
      descKey = 'meta.checkoutDescription';
    } else if (pageType === 'success') {
      descKey = 'meta.successDescription';
    } else if (pageType === 'my-story') {
      descKey = 'meta.myStoryDescription';
    }

    const translation = translate(descKey);
    if (translation !== descKey) {
      metaDescription.content = translation;
    }
  }
}

// Update page title
function updatePageTitle() {
  const titleElement = document.querySelector('title');
  if (titleElement && document.body.getAttribute('data-page')) {
    const pageType = document.body.getAttribute('data-page');
    let titleKey = 'meta.title';

    if (pageType === 'checkout') {
      titleKey = 'meta.checkoutTitle';
    } else if (pageType === 'success') {
      titleKey = 'meta.successTitle';
    } else if (pageType === 'my-story') {
      titleKey = 'meta.myStoryTitle';
    }

    const translation = translate(titleKey);
    if (translation !== titleKey) {
      titleElement.textContent = translation;
    }
  }
}

// Create language switcher
function createLanguageSwitcher() {
  // Remove existing language switcher if any
  const existingSwitcher = document.querySelector('.language-switcher');
  if (existingSwitcher) {
    existingSwitcher.remove();
  }

  const languageSwitcher = document.createElement('div');
  languageSwitcher.className = 'language-switcher';
  languageSwitcher.innerHTML = `
    <button class="lang-btn ${getCurrentLocale() === 'en' ? 'active' : ''}" data-lang="en">
      🇺🇸 EN
    </button>
    <button class="lang-btn ${getCurrentLocale() === 'es' ? 'active' : ''}" data-lang="es">
      🇲🇽 ES
    </button>
  `;

  // Add event listeners
  languageSwitcher.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const newLang = e.target.getAttribute('data-lang');
      changeLanguage(newLang);
    });
  });

  // Insert into navigation
  const navbar = document.querySelector('.navbar .container');
  if (navbar) {
    navbar.appendChild(languageSwitcher);
  }

  return languageSwitcher;
}

// Change language
function changeLanguage(language) {
  try {
    // Hide content during language change to prevent flash
    hidePage();

    setCurrentLocale(language);
    updateContent(); // This will call showPage() when done
    updateLanguageSwitcher();

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { language: language }
    }));

    // Language changed successfully

  } catch (error) {
    console.error('Error changing language:', error);
    showPage(); // Show page even if language change failed
  }
}

// Update language switcher active state
function updateLanguageSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-lang') === getCurrentLocale()) {
      btn.classList.add('active');
    }
  });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Hide page content initially
  hidePage();

  try {
    const success = await initializeI18n();

    if (success) {
      updateContent(); // This will call showPage() when done
      createLanguageSwitcher();

      // Listen for language changes
      window.addEventListener('languageChanged', (event) => {
        // Language changed event fired
      });

      // Dispatch event to signal i18n is ready
      window.dispatchEvent(new Event('i18nInitialized'));

      // I18n system setup completed successfully
    } else {
      // I18n initialization failed, using fallback
      createLanguageSwitcher();
      showPage(); // Show page even if i18n failed
    }

  } catch (error) {
    console.error('Error during i18n setup:', error);
    createLanguageSwitcher();
    showPage(); // Show page even if there's an error
  }
});

// Helper functions to show/hide page content
function showPage() {
  document.body.classList.add('i18n-ready');
}

function hidePage() {
  document.body.classList.remove('i18n-ready');
}

// Export utility functions for global use
window.i18nUtils = {
  translate,
  getCurrentLocale,
  changeLanguage,
  updateContent,
  setCurrentLocale
};

// For debugging
window.i18nDebug = {
  translations,
  currentLocale: () => currentLocale,
  getTranslations: (locale) => translations[locale] || {}
};

// Simple GlobalizeJS Configuration without complex CLDR requirements
// This script provides internationalization for the static website
