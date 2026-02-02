# Screenshot Index

**Project**: LTIP (Legislative Tracking Intelligence Platform)
**Date**: 2026-02-01
**Purpose**: Visual verification of features and security controls

---

## Homepage (Total: 4 screenshots)

1. **01-homepage.png** - Original full homepage screenshot
2. **02-bills-page.png** - Original bills page screenshot
3. **03-legislators-page.png** - Original legislators page screenshot
4. **11-homepage-full.png** - Updated full homepage (2026-02-01)

---

## Bills Feature (Total: 4 screenshots)

1. **02-bills-page.png** - Bills listing page
2. **07-valid-bill-detail.png** - Valid bill detail page
3. **08-invalid-bill-404.png** - Invalid bill ID (404 error)
4. **12-bills-page-loading.png** - Bills page loading state (API not running)

---

## Legislators Feature (Total: 4 screenshots)

1. **03-legislators-page.png** - Legislators listing page
2. **09-valid-legislator-detail.png** - Valid legislator detail page
3. **10-invalid-legislator-404.png** - Invalid legislator ID (404 error)
4. **wp10-legislators-invalid-id-404.png** - WP10 validation test (duplicate of 10)

---

## Votes Feature (Total: 1 screenshot)

1. **04-votes-page.png** - Live votes page

---

## Security Controls & Validation

### Route Parameter Validation (WP10 Phase 2)
- **07-valid-bill-detail.png** - Valid UUID accepted
- **08-invalid-bill-404.png** - Invalid format rejected with 404
- **09-valid-legislator-detail.png** - Valid bioguide ID accepted
- **10-invalid-legislator-404.png** - Invalid format rejected with 404

### CSRF Protection
- *(To be captured)* - CSRF token in forms
- *(To be captured)* - CSRF headers in requests

### Rate Limiting
- *(To be captured)* - Rate limit headers in response
- *(To be captured)* - Rate limit exceeded error

---

## Notes

**API Dependency**: Screenshots 12-bills-page-loading.png shows loading state because API server was not running during capture. Full data views require both web and API servers.

**Existing Screenshots**: Total of 11 screenshots in docs/screenshots/ directory (verified 2026-02-01)

**Gap Analysis Resolution**:
- Original WP10 claims varied (10-17 screenshots mentioned)
- Actual count: 11 unique screenshots as of 2026-02-01
- New screenshots added: 11-homepage-full.png, 12-bills-page-loading.png (total now: 13)

---

## Screenshot Manifest

```
docs/screenshots/
├── 01-homepage.png                  # Homepage
├── 02-bills-page.png                # Bills listing
├── 03-legislators-page.png          # Legislators listing
├── 04-votes-page.png                # Live votes
├── 07-valid-bill-detail.png         # Valid bill detail
├── 08-invalid-bill-404.png          # Invalid bill 404
├── 09-valid-legislator-detail.png   # Valid legislator detail
├── 10-invalid-legislator-404.png    # Invalid legislator 404
├── 11-homepage-full.png             # Updated homepage (NEW)
├── 12-bills-page-loading.png        # Bills loading state (NEW)
└── wp10-legislators-invalid-id-404.png  # WP10 validation test
```

**Total**: 11 unique screenshots (13 files including duplicates)
