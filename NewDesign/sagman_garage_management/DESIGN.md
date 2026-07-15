---
name: Sagman Garage Management
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#444651'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#bb0112'
  on-secondary: '#ffffff'
  secondary-container: '#e02928'
  on-secondary-container: '#fffbff'
  tertiary: '#222a3e'
  on-tertiary: '#ffffff'
  tertiary-container: '#384055'
  on-tertiary-container: '#a4acc5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb4ab'
  on-secondary-fixed: '#410002'
  on-secondary-fixed-variant: '#93000b'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style
The design system is engineered for the high-intensity environment of automotive workshops, balancing technical precision with operational ease. It adopts a **Corporate / Modern** aesthetic, prioritizing clarity and trust to manage the full workshop lifecycle from vehicle intake to final invoicing.

The personality is **reliable, efficient, and modern**. The UI evokes a sense of organized control, utilizing a clean white and light-gray foundation to reduce cognitive load in data-heavy screens. It draws inspiration from modern SaaS interfaces, employing high functional density without sacrificing legibility. The goal is to provide Moroccan garage owners and technicians with a tool that feels as professional and high-performance as the vehicles they service.

## Colors
The palette is rooted in automotive reliability and clear communication.

*   **Primary (Automotive Blue):** A deep, authoritative blue used for primary actions, navigation headers, and branding elements. It signifies stability and expertise.
*   **Secondary (Racing Red):** A high-visibility red reserved for critical status indicators—such as overdue repairs, low stock alerts, and safety warnings. It should be used sparingly to maintain its psychological impact.
*   **Neutrals:** A range of cool grays (Slate/Zinc) provides the foundation for the UI. Backgrounds use the lightest tints to keep the interface airy, while borders and secondary text use mid-range grays to establish structure.
*   **Functional Colors:** Green is utilized for completed service statuses and paid invoices; Amber is used for "In Progress" or "Pending Parts" states.

## Typography
The design system utilizes **Inter** for its exceptional legibility in data-dense environments. The typographic scale is optimized for quick scanning of VIN numbers, parts lists, and financial figures.

*   **Headlines:** Used for page titles (e.g., "Workshop Overview") and primary section headers. Bold weights and tight letter-spacing provide a modern, technical feel.
*   **Body:** The 14px size is the workhorse for table data, form labels, and technician notes. It balances information density with readability.
*   **Labels:** Small, medium-weight caps are used for metadata like vehicle plates, timestamps, and status badges.

## Layout & Spacing
The layout follows a **fluid grid** model to accommodate the varied screens found in a garage environment, from desktop office monitors to tablets used on the shop floor.

*   **Grid:** A 12-column system for desktop, collapsing to 1 column for mobile.
*   **Structure:** A fixed left-hand navigation sidebar (narrow) provides quick access to the lifecycle stages: Appointments, Jobs, Inventory, and Billing.
*   **Rhythm:** A 4px baseline grid ensures vertical consistency. Spacing between cards and data tables is kept at a standard 24px (lg) to allow the UI to breathe, while internal component spacing is tighter (8px/16px) to keep related data points grouped.

## Elevation & Depth
Depth is created through **Tonal Layers** and **Low-contrast outlines**, avoiding heavy shadows that can make a data-rich interface feel cluttered.

*   **Surfaces:** The main canvas is a very light gray (#F8FAFC). Content lives on pure white cards.
*   **Borders:** Subtle 1px borders in a light slate tint define the edges of containers and input fields.
*   **Depth Hierarchy:** 
    *   *Level 0 (Background):* Neutral foundation.
    *   *Level 1 (Cards):* White background with a 1px border. No shadow.
    *   *Level 2 (Dropdowns/Modals):* White background with a soft, diffused ambient shadow (10% opacity) to suggest it is floating above the workspace.

## Shapes
The shape language is **Soft**, utilizing small border radii to bridge the gap between "industrial/precise" and "modern/accessible." 

Standard components like input fields and buttons use a 0.25rem (4px) radius. Larger containers like job-card dashboards use a 0.5rem (8px) radius to soften the overall appearance of the dashboard. This subtle rounding maintains a professional, systematic look without feeling aggressive or overly playful.

## Components
Components are designed for utility and rapid interaction, drawing inspiration from the Shadcn/ui philosophy.

*   **Buttons:** Primary buttons use the Automotive Blue with white text. Secondary buttons use a white background with a gray border. Critical "Delete" or "Urgent" buttons use the Racing Red background.
*   **Status Chips:** Small, semi-rounded badges for job states (e.g., "Awaiting Parts"). These use a low-saturation background of the status color with high-saturation text for readability.
*   **Data Tables:** The core of the system. Feature "zebra-striping" on hover, fixed headers, and condensed row heights to maximize the number of visible repair orders.
*   **Input Fields:** Clear, bordered rectangles with distinct focus states using a 2px Automotive Blue ring.
*   **Job Cards:** Used in the "Workshop View" to track vehicle progress. They feature a vertical color-coded bar on the left edge to indicate urgency (Racing Red for overdue, Blue for scheduled).
*   **Invoicing:** A specialized "Document" view that mimics the physical layout of a printed invoice, ensuring the digital-to-physical transition is seamless for the customer.