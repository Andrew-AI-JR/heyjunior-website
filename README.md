# Hey Junior - LinkedIn Automation Tool Website

🌐 **Official website for the LinkedIn Automation Tool**

Visit: [heyjunior.com](https://heyjunior.com)

## 📋 Overview

This repository contains the public-facing website for the LinkedIn Automation Tool, including:

- **Landing Page**: Product showcase and features
- **Purchase Flow**: Secure payment processing with Stripe
- **Success Page**: Download links and setup instructions
- **My Story**: Personal journey and motivation

## 🏗️ Website Structure

```
heyjunior-website/
├── index.html           # Landing page
├── purchase.html        # Purchase/pricing page
├── success.html         # Post-purchase success page
├── my-story.html        # Personal story page
├── styles.css           # Main stylesheet
├── purchase.js          # Purchase flow logic
├── success.js           # Download and success logic
├── images/              # Website images
├── downloads/           # Release files
└── CNAME               # Custom domain configuration
```

## 🚀 Features

### Landing Page
- Product overview and benefits
- Feature highlights
- Pricing information
- Call-to-action buttons

### Purchase Flow
- Stripe payment integration
- Platform detection (Windows/macOS)
- Secure checkout process
- Email validation

### Success Page
- Automatic OS detection
- Platform-specific download links
- Setup instructions
- Support information

## 💳 Payment Integration

The website integrates with:
- **Stripe**: Secure payment processing
- **Backend API**: Payment verification and customer management
- **GitHub Releases**: Automatic download links

## 🎨 Design

- **Responsive**: Mobile-first design
- **Modern UI**: Clean, professional interface
- **Fast Loading**: Optimized assets and code
- **Accessible**: WCAG compliant

## 🔧 Development

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Andrew-AI-JR/heyjunior-website.git
   cd heyjunior-website
   ```

2. **Serve locally**:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser**:
   ```
   http://localhost:8000
   ```

### File Structure

- **HTML Files**: Semantic, accessible markup
- **CSS**: Modern CSS with flexbox/grid
- **JavaScript**: Vanilla JS, no frameworks
- **Images**: Optimized for web delivery

## 🌐 Deployment

The website is automatically deployed via GitHub Pages:

- **Domain**: heyjunior.com
- **SSL**: Automatic HTTPS
- **CDN**: Global content delivery
- **Updates**: Automatic on push to main

## 📊 Analytics

- **Google Analytics**: Traffic and user behavior
- **Conversion Tracking**: Purchase funnel analysis
- **Performance Monitoring**: Core Web Vitals

## 🔐 Security

- **HTTPS Only**: Secure connections
- **CSP Headers**: Content Security Policy
- **Input Validation**: Form security
- **Payment Security**: PCI DSS compliant via Stripe

## 📱 Browser Support

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This website code is open source under the MIT License.

## 📞 Support

For website issues or questions:
- **Email**: support@heyjunior.com
- **Issues**: GitHub Issues
- **Documentation**: This README

---

**Built with ❤️ for professional networking** 