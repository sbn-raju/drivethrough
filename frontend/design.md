# DriveThrough â€” Brand & UI Design Kit

**Version:** 1.0  
**Status:** Initial brand direction  
**Product:** DriveThrough â€” a marketplace connecting vehicle owners with professional drivers who drive the customer's own vehicle for a trip.

---

## 1. Brand foundation

### Brand idea
DriveThrough gives people access to a professional driver when they need someone else to drive their own vehicle.

The brand should communicate:
- **Control:** The customer travels in their own vehicle.
- **Trust:** Drivers are screened and their credentials are reviewed.
- **Convenience:** Booking a driver should feel straightforward.
- **Reliability:** Clear trip details, transparent pricing and dependable communication.
- **Freedom:** Customers can travel without having to drive themselves.

### Positioning
> A trusted way to book a professional driver for your own car, whether the journey is one-way or round-trip.

**Tagline:** Your car. Your journey. A professional driver when you need one.

### Brand personality

| Attribute | Expression |
|---|---|
| Trustworthy | Clear driver profiles, verification status and trip information |
| Confident | Strong typography, clear actions and visual hierarchy |
| Approachable | Simple language and helpful guidance |
| Efficient | Short booking flow and visible trip progress |
| Premium-practical | Polished details without unnecessary decoration |

### Voice and tone
Use plain, direct and reassuring language.

**Prefer:** â€œFind a driverâ€, â€œReview trip detailsâ€, â€œEstimated fareâ€, â€œDriver verification in progressâ€.

**Avoid:** Unsupported claims such as â€œ100% safeâ€, vague statuses such as â€œProcessingâ€, and overly technical language in customer-facing screens.

---

## 2. Logo system

### Logo concept
Use a road-inspired symbol that combines a stylised **D** with a route or road motif. It should suggest movement, direction and a clear journey.

### Logo variations
Create and maintain these variants:
1. **Primary horizontal:** symbol plus `DriveThrough` wordmark.
2. **Stacked:** symbol above the wordmark.
3. **Symbol-only:** app icon, favicon and compact navigation.
4. **Light-background:** yellow symbol and near-black wordmark.
5. **Dark-background:** yellow symbol and white wordmark.
6. **Monochrome:** one-colour utility version.

### Logo colour rules

| Context | Symbol | Wordmark |
|---|---|---|
| White / light surface | Yellow | Near-black |
| Black / dark surface | Yellow | White |
| Yellow surface | Near-black | Near-black |
| Monochrome | One approved solid colour | Same colour |

### Clear space and sizing
- Keep clear space around the logo equal to at least the height of the symbol's central road detail.
- Do not place text, borders or icons inside this area.
- Prefer the horizontal logo in headers and website navigation.
- Use the symbol-only mark when the wordmark cannot remain readable.
- Do not stretch or shrink the logo disproportionately.

### Incorrect logo usage
Do not stretch, skew, rotate, recolour, add shadows/gradients, or place the logo over busy imagery without a clear area. Do not recreate the wordmark with an unapproved font.

**Production note:** The generated brand-board image is a visual concept, not an export-ready vector logo. Redraw and approve the final mark as SVG/PDF, then export required PNG sizes. Do not use a screenshot of the brand board as the production logo.

---

## 3. Colour system

The direction is **yellow + black**, balanced with white and light neutral surfaces. Yellow is the action and recognition colour; black provides contrast and structure.

### Core palette

| Token | Hex | Purpose |
|---|---|---|
| `brand.yellow` | `#FFC107` | Primary brand colour, actions and highlights |
| `brand.yellow-hover` | `#E5AC00` | Hover / pressed state |
| `brand.yellow-soft` | `#FFF4CC` | Subtle selected surfaces |
| `brand.black` | `#0B0B0B` | Headings, text and dark surfaces |
| `brand.black-soft` | `#171717` | Secondary dark surface |
| `neutral.white` | `#FFFFFF` | Cards and light surfaces |
| `neutral.background` | `#F8F9FA` | App background |
| `neutral.surface-muted` | `#F1F3F5` | Muted surfaces |
| `neutral.border` | `#E5E7EB` | Borders and dividers |
| `neutral.text` | `#171717` | Primary text |
| `neutral.text-secondary` | `#6B7280` | Secondary text |
| `neutral.text-disabled` | `#9CA3AF` | Disabled text |

### Semantic colours

| Token | Hex | Use |
|---|---|---|
| `status.success` | `#10B981` | Verified, completed, successful |
| `status.warning` | `#F59E0B` | Attention required, pending action |
| `status.error` | `#EF4444` | Failed, rejected, destructive action |
| `status.info` | `#3B82F6` | Informational messages |

Semantic colours communicate status; do not use them as alternative brand colours.

### Colour balance
As a starting point:
- 65â€“75% white and light neutral surfaces
- 15â€“25% black and dark text/surfaces
- 5â€“10% yellow accents and actions

Use near-black text on yellow buttons and white text on near-black buttons. Do not use yellow text on white for important information. Never communicate status through colour alone. Check contrast against WCAG 2.2 AA.

---

## 4. Typography

### Typeface
**Primary:** Manrope.

Fallback stack:

```css
font-family: "Manrope", Inter, ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Type scale

| Token | Size | Weight | Use |
|---|---:|---:|---|
| `display` | 48px | 700â€“800 | Marketing hero |
| `h1` | 36px | 700 | Page title |
| `h2` | 28px | 700 | Main section |
| `h3` | 22px | 650â€“700 | Card / subsection |
| `h4` | 18px | 600â€“700 | Small section |
| `body-lg` | 16px | 400â€“500 | Introductory copy |
| `body` | 14px | 400â€“500 | Standard UI |
| `label` | 12px | 600 | Form labels |
| `caption` | 11px | 400â€“500 | Supporting metadata |

Line height: headings 1.15â€“1.3, body 1.45â€“1.65, compact labels 1.3â€“1.4.

### Typography rules
- Use sentence case for headings and buttons.
- Keep body text short and scannable.
- Use bold weight to establish hierarchy, not to emphasise every phrase.
- Avoid long blocks of uppercase text.
- Use tabular numerals for prices, dates, distances and metrics where supported.

---

## 5. Layout and spacing

### Spacing scale
Use a 4px base spacing system.

| Token | Value |
|---|---:|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |

### Radius scale

| Token | Value | Use |
|---|---:|---|
| `radius-sm` | 6px | Small labels and compact controls |
| `radius-md` | 10px | Inputs and buttons |
| `radius-lg` | 14px | Cards |
| `radius-xl` | 20px | Large panels and modals |
| `radius-full` | 999px | Pills and avatars |

### Elevation

```css
--shadow-sm: 0 1px 2px rgb(0 0 0 / 0.06);
--shadow-md: 0 4px 12px rgb(0 0 0 / 0.08);
--shadow-lg: 0 12px 28px rgb(0 0 0 / 0.12);
```

Prefer borders before shadows to separate adjacent cards and sections.

### Responsive breakpoints

| Name | Width |
|---|---:|
| Mobile | 0â€“639px |
| Tablet | 640â€“1023px |
| Desktop | 1024â€“1279px |
| Wide desktop | 1280px+ |

Use one-column forms on mobile, two columns only when fields remain readable, and centred content containers on desktop.

Suggested maximum widths:
- Reading content: 720px
- Forms: 560â€“680px
- Application content: 1200px
- Marketing content: 1280px

---

## 6. Iconography and illustration

### Icon style
Use one consistent outline icon family, such as Lucide.
- Stroke width: 1.75â€“2px.
- 16px for compact controls, 20px for standard actions, 24px for prominent actions.
- Pair unfamiliar icons with text.
- Use filled icons sparingly for selected states.

### Useful icon concepts

| Purpose | Icon concept |
|---|---|
| Pickup / destination | Map pin |
| Route | Route |
| Vehicle | Car |
| Driver | User / steering wheel |
| One-way trip | Arrow right |
| Round trip | Repeat |
| Date | Calendar |
| Time | Clock |
| Fare | Indian rupee |
| Verification | Shield check |
| Rating | Star |
| Support | Headset |
| Notifications | Bell |

### Illustration style
Use simple geometric illustrations: road lines, route paths, minimal vehicle silhouettes, location pins and driver profile illustrations. Avoid overly playful illustrations that weaken the trust-oriented positioning.

---

## 7. UI component foundations

### Buttons

| Variant | Appearance | Use |
|---|---|---|
| Primary | Yellow background, black text | Main action |
| Secondary | Black background, white text | Important alternative |
| Outline | Transparent / white with dark border | Lower-emphasis action |
| Ghost | Transparent, dark text | Inline / tertiary action |
| Destructive | Red background or red text | Remove, cancel, destructive action |

Button guidance:
- Use one primary action per major section where possible.
- Start labels with an action verb.
- Provide hover, pressed, focus and disabled states.
- Show loading after submission and prevent duplicate submissions.

Suggested heights: small 36px, medium 44px, large 48â€“52px. Use 16â€“22px horizontal padding.

### Text inputs
Input anatomy:
1. Visible label
2. Input control
3. Optional leading/trailing icon
4. Helper or validation message

States: default, hover, focus, error, success (when useful), disabled. Never rely on placeholder text as the only label.

### Selects and autocomplete
Use searchable autocomplete for pickup, drop, state selection and long vehicle lists. For locations, show enough context to distinguish similarly named places, allow map confirmation and do not treat arbitrary typed text as a confirmed place.

### Cards
- White background
- 1px neutral border
- 14px radius
- 16â€“24px padding
- Subtle shadow only when elevated or interactive

Use cards for driver results, fare summaries, booking details and dashboard metrics.

### Badges and status chips
Use compact text labels such as `Verified`, `Pending review`, `Available`, `On trip`, `Completed` and `Cancelled`. Keep colours semantically consistent. A submitted document is not the same as a verified document.

### Tabs and segmented controls
Use a segmented control for mutually exclusive trip types (`One-way`, `Round-trip`). Use tabs to navigate between related content areas. Make the selected state obvious.

### Switches and checkboxes
Use switches for immediate on/off settings such as driver availability. Use checkboxes for form choices and consent. Explain important consequences.

### Modals and bottom sheets
Use centred desktop modals for focused tasks and mobile bottom sheets for compact selection flows. Include a title, close action and clear primary/secondary actions. Avoid long multi-step forms in small modals.

### Toasts and alerts
Use toasts for brief feedback such as â€œProfile updatedâ€. Use inline alerts for issues requiring action. Keep important payment, safety and booking errors visible until resolved.

---

## 8. Product experience and screen direction

DriveThrough has two primary user journeys: **Customer** and **Driver**. Share the visual language, but tailor navigation and dashboard priorities.

### Customer experience

**Goal:** Help customers find and book a suitable driver for their own vehicle.

Screens:
1. Landing page
2. Sign up / sign in
3. Identity verification
4. Customer profile
5. Vehicle management
6. Trip search
7. Driver results
8. Driver profile and credentials
9. Fare breakdown
10. Booking review and confirmation
11. Payment
12. Booking tracking
13. Trip details and history
14. Rating and review
15. Help and support

#### Landing page
- White or light background.
- Black headline with yellow emphasis.
- Primary CTA: **Find a driver**.
- Secondary CTA: **Drive with DriveThrough**.
- Explain clearly that the customer's own vehicle is driven by the booked professional driver.
- Avoid visuals that make the service look like a car-rental business.

Suggested hero:

> Your car. Your journey. A driver when you need one.

Supporting copy:

> Book a professional driver for your one-way or round-trip journey in your own vehicle.

#### Trip search panel
Fields:
- Pickup location
- Drop location
- Trip type: One-way / Round-trip
- Departure date
- Departure time
- Return date/time when round-trip is selected
- Optional trip notes

Primary CTA: **Find drivers**

Interaction rules:
- Validate pickup and drop locations.
- Do not show return-date fields for a one-way trip.
- Show return date and waiting duration for round trips.
- Explain additional charges before the customer requests a booking.

#### Driver result card
Show:
- Driver name and profile photo
- Verification status
- Rating and review count, if available
- Verified experience or relevant driving history
- Languages, if supplied
- Service states / route coverage
- Indicative fare
- Availability for the requested date
- View profile / Select driver action

Never expose private KYC document numbers or document images to customers.

#### Fare breakdown
Show each applicable component separately:
- Driver base fare
- Distance/time component, if applicable
- One-way return/deadhead component, if applicable
- Waiting charges, if applicable
- Toll, parking or other pass-through charges, if applicable
- Platform fee
- Taxes
- Total payable

Explain whether the amount is an estimate or confirmed quote.

### Driver experience

**Goal:** Help drivers complete onboarding, manage availability and respond to suitable trip requests.

Screens:
1. Driver sign up / sign in
2. Personal details
3. Driving licence and KYC submission
4. Verification status
5. Service-state selection
6. Rate configuration
7. Preferences
8. Availability calendar
9. Trip requests
10. Booking details
11. Active trip
12. Earnings and payout history
13. Reviews
14. Support and incident reporting

#### Driver dashboard
Prioritise:
- Availability toggle
- Verification status
- Upcoming trips
- New booking requests
- Service states
- Rate settings
- Earnings summary

Use yellow for the availability action and important CTAs. Do not make the entire dashboard yellow.

#### Driver verification states
Use: `Not submitted`, `Submitted`, `Under review`, `Action required`, `Verified`, `Rejected`. If action is required, explain which item needs correction and how to resubmit it.

### Admin experience
Use the same colour, typography and component foundations, but prioritise information density and operational clarity.

Core areas:
- Driver verification queue
- Customer management
- Booking management
- Payment/refund overview
- Complaints and incident management
- Pricing configuration
- Service-area configuration
- Audit log

Use tables, filters, status chips and detail panels. Require explicit confirmation for destructive actions.

---

## 9. Navigation patterns

### Customer navigation
Desktop: Home, Find a driver, My bookings, My vehicles, Profile, Help.  
Mobile: Home, Bookings, Vehicles, Profile.

Keep the booking action prominent without crowding navigation.

### Driver navigation
Desktop: Dashboard, Requests, My trips, Availability, Earnings, Profile.  
Mobile: Dashboard, Requests, Trips, Earnings, Profile.

### Admin navigation
Overview, Drivers, Customers, Bookings, Payments, Safety and support, Pricing and service areas, Reports, Settings.

---

## 10. Booking and trip status design

Use the same status vocabulary in cards, detail pages, notifications and admin views.

| Status | Meaning | Suggested treatment |
|---|---|---|
| Draft | Booking details not submitted | Neutral |
| Quote ready | Fare estimate available | Info |
| Requested | Customer sent a request | Info |
| Accepted | Driver accepted request | Success |
| Payment pending | Payment action required | Warning |
| Confirmed | Booking confirmed | Success |
| Driver en route | Driver travelling to pickup | Info |
| Arrived | Driver reached pickup | Info |
| In progress | Trip has started | Info |
| Completed | Trip completed | Success |
| Cancelled | Booking cancelled | Neutral / error as appropriate |
| Disputed | A dispute is open | Warning |
| Refunded | Refund completed | Success |

Do not use `Confirmed` until the required acceptance and payment conditions have been met.

---

## 11. Motion and interaction

Motion should provide feedback, not decoration.

Suggested timings:
- 120â€“180ms: button and hover transitions
- 180â€“240ms: small panels and menus
- 220â€“300ms: modal and bottom-sheet transitions

Use motion for button feedback, expanding fare details, switching trip type, validation messages and booking status changes. Respect `prefers-reduced-motion`. Avoid continuously animated road lines or distracting effects in core workflows.

---

## 12. Photography and visual content

Use imagery that reinforces the service:
- A professional driver beside a customer's vehicle
- A customer preparing for a journey
- A clean vehicle interior
- A road or route visual
- A driver portrait, with consent

Prefer natural lighting and authentic settings. Avoid imagery implying DriveThrough owns or rents the customer's vehicle. Do not use stock photos as proof of a real driver's identity or verification.

---

## 13. Accessibility requirements

Target WCAG 2.2 AA.

- [ ] Text contrast meets applicable AA requirements.
- [ ] All form controls have programmatic and visible labels.
- [ ] Keyboard users can reach and operate all controls.
- [ ] Focus indicators are clearly visible.
- [ ] Errors identify the field and explain how to fix it.
- [ ] Status is not communicated by colour alone.
- [ ] Touch targets are comfortably sized; aim for at least 44 Ã— 44 CSS pixels where practical.
- [ ] Images have meaningful alt text or are marked decorative.
- [ ] Dialogs manage focus and return focus when closed.
- [ ] Reduced-motion preferences are respected.
- [ ] Map-based actions have an accessible text alternative.

---

## 14. Design tokens â€” CSS starter

```css
:root {
  /* Brand */
  --color-brand-yellow: #FFC107;
  --color-brand-yellow-hover: #E5AC00;
  --color-brand-yellow-soft: #FFF4CC;
  --color-brand-black: #0B0B0B;
  --color-brand-black-soft: #171717;

  /* Neutrals */
  --color-white: #FFFFFF;
  --color-background: #F8F9FA;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F1F3F5;
  --color-border: #E5E7EB;
  --color-text: #171717;
  --color-text-secondary: #6B7280;
  --color-text-disabled: #9CA3AF;

  /* Semantic */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Typography */
  --font-sans: "Manrope", Inter, ui-sans-serif, system-ui, sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.06);
  --shadow-md: 0 4px 12px rgb(0 0 0 / 0.08);
  --shadow-lg: 0 12px 28px rgb(0 0 0 / 0.12);

  /* Layout */
  --content-width: 1200px;
  --header-height: 72px;
}
```

### Button CSS example

```css
.button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font: 600 14px/1 var(--font-sans);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.button:active {
  transform: translateY(1px);
}

.button:focus-visible {
  outline: 3px solid rgb(255 193 7 / 0.45);
  outline-offset: 2px;
}

.button--primary {
  color: var(--color-brand-black);
  background: var(--color-brand-yellow);
}

.button--primary:hover {
  background: var(--color-brand-yellow-hover);
}

.button--secondary {
  color: var(--color-white);
  background: var(--color-brand-black);
}

.button--outline {
  color: var(--color-text);
  background: transparent;
  border-color: var(--color-border);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

### Card CSS example

```css
.card {
  padding: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
```

---

## 15. Frontend implementation guidance

The product stack is React, Express.js and Supabase PostgreSQL. Implement the design system as reusable frontend primitives rather than styling every screen independently.

Suggested structure:

```text
src/
  app/
  assets/
    brand/
      logo-primary.svg
      logo-dark.svg
      logo-symbol.svg
      favicon.svg
  components/
    ui/
      Button/
      Input/
      Select/
      Card/
      Badge/
      Dialog/
      Tabs/
      Switch/
      Toast/
    layout/
      CustomerLayout/
      DriverLayout/
      AdminLayout/
  features/
    auth/
    customer/
    vehicles/
    driver/
    onboarding/
    availability/
    search/
    bookings/
    payments/
    notifications/
    support/
  styles/
    tokens.css
    globals.css
    typography.css
```

Implementation principles:
- Build shared UI primitives first.
- Keep customer, driver and admin layouts separate.
- Share tokens and common components.
- Keep booking and payment states driven by backend responses.
- Use server-calculated fare quotes; do not calculate authoritative prices only in the browser.
- Implement loading, empty, error, success and disabled states.
- Make forms responsive and keyboard accessible.
- Avoid hardcoding colours in individual components; use tokens.

---

## 16. Content and microcopy library

### Primary calls to action

| Context | Copy |
|---|---|
| Customer landing page | Find a driver |
| Driver landing page | Become a driver |
| Search | Find available drivers |
| Driver result | View driver |
| Booking review | Continue to booking |
| Payment | Pay and confirm |
| Driver availability | Go available |
| Driver request | Accept trip |
| Trip completion | Complete trip |

### Empty states

**No drivers found**

> No drivers match this trip yet. Try changing your date or route.

**No upcoming bookings**

> You don't have any upcoming trips. Find a driver when you're ready to travel.

**No driver requests**

> No new trip requests right now. Keep your availability up to date.

### Error messages
- â€œChoose a valid pickup location.â€
- â€œChoose a destination different from your pickup.â€
- â€œSelect a return date for a round trip.â€
- â€œThis time slot is no longer available. Search again to see current availability.â€
- â€œWe couldn't confirm your payment. Check the payment status before trying again.â€

### Trust and verification copy
Prefer precise wording:
- â€œIdentity document submittedâ€
- â€œDriving licence under reviewâ€
- â€œDriver verification completedâ€

Do not say â€œbackground checkedâ€ unless that check has actually been performed and its scope is defined.

---

## 17. Brand application checklist

### Logo and assets
- [ ] Final vector logo approved.
- [ ] Horizontal, stacked and symbol-only variants exported.
- [ ] Light and dark variants exported.
- [ ] Favicon and app icon prepared.
- [ ] Clear-space and minimum-size rules documented.

### Visual system
- [ ] Colour tokens implemented.
- [ ] Typography loaded and tested.
- [ ] Spacing, radius and shadow tokens implemented.
- [ ] Icon family selected.
- [ ] Responsive breakpoints tested.

### Components
- [ ] Buttons and all interaction states.
- [ ] Inputs, selects and autocomplete.
- [ ] Cards and driver result cards.
- [ ] Badges and booking status chips.
- [ ] Tabs and trip-type segmented control.
- [ ] Dialogs, bottom sheets, alerts and toasts.
- [ ] Loading, empty, error and disabled states.

### Product screens
- [ ] Customer booking journey.
- [ ] Driver onboarding journey.
- [ ] Driver dashboard and availability.
- [ ] Booking details and trip tracking.
- [ ] Payment and fare breakdown.
- [ ] Admin operations screens.

### Quality
- [ ] Accessibility review completed.
- [ ] Mobile and desktop layouts tested.
- [ ] Contrast checked.
- [ ] Copy reviewed for clarity.
- [ ] Logo and imagery usage rights confirmed.

---

## 18. Final design direction

- **Primary brand:** Yellow `#FFC107`
- **Anchor colour:** Near-black `#0B0B0B`
- **Main interface:** White and light neutral surfaces
- **Typography:** Manrope
- **Logo idea:** Road-inspired `D` symbol with a bold wordmark
- **UI character:** Clean, confident, practical and trustworthy
- **Primary action:** Yellow button with black text
- **Secondary action:** Black button with white text

The key principle is balance: use yellow to make important actions and brand moments recognisable, not to colour every surface. Keep the booking experience calm, readable and transparent so customers can understand who will drive their vehicle, where the trip goes and what it will cost.

---

## 19. Decisions to confirm before production

1. Final logo geometry and wordmark typography.
2. Whether yellow remains `#FFC107` after contrast testing.
3. Whether customer and driver accounts share a visual shell or use separate layouts.
4. Final status vocabulary for bookings and driver verification.
5. Fare presentation rules, including platform fee, one-way return/deadhead compensation, waiting time and pass-through expenses.
6. Exact driver verification claims that can be shown publicly.
7. Legal, insurance and safety wording for each launch market.

**This document defines the initial brand and UI direction. Treat it as the source of truth for the first design-system implementation, subject to the decisions above and accessibility testing.**