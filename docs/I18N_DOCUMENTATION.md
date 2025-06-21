# Internationalization (i18n) Documentation

This document explains the i18next internationalization setup for the Hey Junior website.

## Overview

The website now supports multiple languages using [i18next](https://www.i18next.com/), a powerful internationalization framework. Currently supported languages:

- **English (en)** - Default language
- **Spanish (es)** - Secondary language

## Features

- **Browser Language Detection**: Automatically detects user's browser language and sets Spanish if browser language starts with "es", otherwise defaults to English
- **Language Persistence**: User's language preference is saved in localStorage
- **Dynamic Language Switching**: Users can switch languages using the language switcher in the navigation
- **Static Site Compatible**: Works with static HTML/CSS/JS without requiring a backend

## File Structure

```
heyjunior-website/
├── locales/
│   ├── en/
│   │   └── translation.json    # English translations
│   └── es/
│       └── translation.json    # Spanish translations
├── i18n.js                     # i18next configuration and utilities
├── I18N_DOCUMENTATION.md       # This documentation
└── i18n-test.html             # Test page for i18n functionality
```

## Setup Components

### 1. Translation Files

Translation files are stored in JSON format in the `locales/` directory:

- `locales/en/translation.json` - English translations
- `locales/es/translation.json` - Spanish translations

Each file contains nested objects organizing translations by sections (navigation, hero, features, etc.).

### 2. i18next Libraries

The following libraries are loaded via CDN in each HTML page:

```html
<script src="https://unpkg.com/i18next@23.7.6/dist/umd/i18next.min.js"></script>
<script src="https://unpkg.com/i18next-http-backend@2.4.2/lib/index.js"></script>
<script src="https://unpkg.com/i18next-browser-languagedetector@7.2.0/lib/index.js"></script>
```

### 3. i18n.js Configuration

The `i18n.js` file contains:

- i18next initialization with browser language detection
- Content update functions
- Language switcher creation and management
- Utility functions for translation

### 4. HTML Attributes

Text elements use `data-i18n` attributes to mark them for translation:

```html
<h1 data-i18n="hero.title">Land Your Dream Job with AI-Powered LinkedIn Automation</h1>
<p data-i18n="hero.subtitle">Junior helps you engage with hiring posts automatically...</p>
```

For form inputs, placeholders are automatically translated:

```html
<input type="email" data-i18n="checkout.email" placeholder="Email Address">
```

## Usage

### Adding New Text

1. **Add to English translation file** (`locales/en/translation.json`):
```json
{
  "newSection": {
    "title": "New Section Title",
    "description": "This is a new section description"
  }
}
```

2. **Add to Spanish translation file** (`locales/es/translation.json`):
```json
{
  "newSection": {
    "title": "Título de Nueva Sección",
    "description": "Esta es una descripción de nueva sección"
  }
}
```

3. **Update HTML** with data-i18n attributes:
```html
<h2 data-i18n="newSection.title">New Section Title</h2>
<p data-i18n="newSection.description">This is a new section description</p>
```

### Language Switcher

The language switcher is automatically created and inserted into the navigation. It includes:

- Flag emojis for visual identification
- Active state styling
- Click handlers for language switching
- localStorage persistence

### Programmatic Translation

Use the utility functions in JavaScript:

```javascript
// Get current language
const currentLang = window.i18nUtils.getCurrentLanguage();

// Translate a key
const translatedText = window.i18nUtils.translate('hero.title');

// Change language programmatically
window.i18nUtils.changeLanguage('es');
```

## Browser Language Detection Logic

1. Gets browser language using `navigator.language` or `navigator.userLanguage`
2. If language starts with "es", sets Spanish as default
3. Otherwise, defaults to English
4. Checks localStorage for saved user preference
5. Uses saved preference if available, otherwise uses detected language

## Language Switching Flow

1. User clicks language button in switcher
2. i18next changes language and loads appropriate translation file
3. All elements with `data-i18n` attributes are updated
4. Language preference is saved to localStorage
5. Document language attribute is updated
6. Language switcher buttons are updated to reflect active state

## Testing

Use the test page (`i18n-test.html`) to verify:

- Translation loading
- Language switching
- Browser detection
- Form element placeholders
- Error handling

## File Updates Required

Each HTML file needs:

1. **i18next library scripts** in the `<head>` section
2. **data-page attribute** on the `<body>` tag for page identification
3. **data-i18n attributes** on translatable elements
4. **i18n.js script** inclusion before closing `</body>` tag

Example:
```html
<head>
    <!-- Other head content -->
    <script src="https://unpkg.com/i18next@23.7.6/dist/umd/i18next.min.js"></script>
    <script src="https://unpkg.com/i18next-http-backend@2.4.2/lib/index.js"></script>
    <script src="https://unpkg.com/i18next-browser-languagedetector@7.2.0/lib/index.js"></script>
</head>
<body data-page="home">
    <!-- Page content with data-i18n attributes -->
    
    <!-- i18n initialization script -->
    <script src="i18n.js"></script>
</body>
```

## Performance Considerations

- Translation files are loaded asynchronously
- Language switching is near-instantaneous after initial load
- localStorage caching prevents repeated language detection
- CDN-hosted libraries for optimal loading speed

## Browser Support

Compatible with all modern browsers that support:
- ES6 features (arrow functions, template literals)
- localStorage
- fetch API (used by i18next-http-backend)

## Troubleshooting

### Common Issues

1. **Translation not loading**: Check browser console for network errors, verify JSON syntax
2. **Language not switching**: Ensure i18n.js is loaded after i18next libraries
3. **Fallback text showing**: Verify translation keys exist in both language files
4. **Styling issues**: Check CSS for language switcher styles

### Debug Mode

Enable debug mode in `i18n.js` by changing:
```javascript
debug: false,
```
to:
```javascript
debug: true,
```

This will log detailed information about translation loading and key resolution.

## Future Enhancements

Potential improvements:
- Add more languages (French, German, etc.)
- Implement region-specific variations (es-MX, es-ES)
- Add date/number formatting localization
- Implement dynamic content translation for user-generated content
- Add right-to-left (RTL) language support