# Phoenix Marketplace Club

မြန်မာနိုင်ငံအတွက် Burmese-first marketplace storefront prototype.

**Live site:** https://eei852552-rgb.github.io/phoenix-marketplace-public-/

## Current status

This repository currently publishes a **static front-end demo** through GitHub Pages.

- Responsive Burmese-first storefront
- Sample product cards and category filters
- Search and price sorting
- Demo-only product detail and contact notices
- Custom GitHub Pages 404 page

**Not live yet:** customer accounts, seller registration, product uploads, persistent inventory, orders, checkout, payments, chat, moderation, and admin tools. Sample products and prices are illustrative only; they are not offers for sale.

## Run locally

Open `index.html` in a browser, or serve this folder with any static HTTP server.

## Deployment

The workflow at `.github/workflows/deploy.yml` deploys the repository root to GitHub Pages when changes are pushed to `main`, or when manually started from GitHub Actions.

## Before enabling real marketplace features

A production launch needs an approved backend and database, secure authentication and role checks, seller/product moderation, server-side order validation, privacy and terms pages, abuse reporting, backups, and end-to-end tests. Do not collect real customer data or accept payments through this static demo.

## Project principle

Keep the first release small, accessible, mobile-friendly, and honest about which features are demonstrations. Never commit API keys, bot tokens, passwords, or private customer information.
