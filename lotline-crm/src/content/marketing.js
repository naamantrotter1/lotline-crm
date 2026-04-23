/** Single source of truth for all marketing copy. Edit here; UI updates everywhere. */
export const marketing = {
  product: {
    name: "LotLine DealFlow Pro",
    tagline: "The deal management platform built for land investors.",
  },

  hero: {
    headline: "Close more land deals.\nBuild investor confidence.\nScale your pipeline.",
    subhead:
      "LotLine DealFlow Pro is the all-in-one CRM built for land acquisition teams — from first contact to final close.",
    cta1: "Start free trial",
    cta2: "See how it works",
    trust: "Trusted by land acquisition teams across the Southeast",
    metrics: [
      { value: "3×", label: "More deals tracked" },
      { value: "10h", label: "Saved per week" },
      { value: "100%", label: "Investor visibility" },
    ],
  },

  advantages: [
    {
      icon: "Kanban",
      title: "Visual Deal Pipeline",
      body: "See every deal at every stage at a glance. Drag, filter, and act — never lose track of a live opportunity.",
    },
    {
      icon: "DollarSign",
      title: "Capital Stack Builder",
      body: "Structure investor commitments, track positions, and model financing scenarios before you go to contract.",
    },
    {
      icon: "CalendarCheck",
      title: "Draw Schedule Tracking",
      body: "Manage construction draws with built-in milestone tracking and automated distribution calculations.",
    },
    {
      icon: "BarChart2",
      title: "Market Intelligence",
      body: "County-level heat maps, ARV databases, and comp tools so your offers are grounded in real data.",
    },
  ],

  howItWorks: [
    {
      step: "01",
      title: "Add your deals",
      body: "Import or create deals with all the details — address, price, status, contacts, and documents in one place.",
    },
    {
      step: "02",
      title: "Build your capital stack",
      body: "Add investors, define positions, and model your financing before you commit to a contract.",
    },
    {
      step: "03",
      title: "Track draws & milestones",
      body: "Stay on top of construction progress with automated draw schedules tied to real completion milestones.",
    },
    {
      step: "04",
      title: "Close with confidence",
      body: "Distribute returns to investors and track every penny from acquisition to exit.",
    },
  ],

  features: [
    {
      title: "Deal Pipeline",
      subtitle: "Your entire acquisition process, visualized",
      body: "Move deals through Land Acquisition, Due Diligence, Development, and Sales stages with a Kanban board built for land investors. Filter by status, assignee, or market — and drill into any deal in seconds.",
      bullets: [
        "Drag-and-drop Kanban board",
        "Custom pipeline stages",
        "Deal detail pages with docs & photos",
        "Full archived deal history",
      ],
      screenshotSrc: "/marketing/screenshots/pipeline-kanban.webp",
      screenshotAlt: "Deal pipeline kanban board",
    },
    {
      title: "Capital Stack",
      subtitle: "Structure your investor financing with precision",
      body: "Build financing scenarios with first and second position lenders, committed capital partners, and cash investors. See real-time equity splits, coverage ratios, and commitment summaries.",
      bullets: [
        "Multiple financing scenarios",
        "Investor commitment tracking",
        "Position and equity modeling",
        "Coverage ratio calculations",
      ],
      screenshotSrc: "/marketing/screenshots/capital-stack.webp",
      screenshotAlt: "Capital Stack module",
    },
    {
      title: "Investor Portal",
      subtitle: "Give investors the transparency they expect",
      body: "Every investor gets their own portal view with deal updates, distribution history, and document access. You control what they see — they gain the confidence to commit.",
      bullets: [
        "Investor-facing deal dashboards",
        "Distribution tracking",
        "Secure document sharing",
        "Real-time deal updates",
      ],
      screenshotSrc: "/marketing/screenshots/investor-portal.webp",
      screenshotAlt: "Investor portal",
    },
  ],

  pricing: [
    {
      name: "Starter",
      icon: "User",
      monthlyPrice: 49,
      tagline: "Best for new investors",
      badge: null,
      features: [
        { icon: "Kanban",       text: "Up to 10 active deals" },
        { icon: "Users",        text: "1 user seat" },
        { icon: "LayoutDashboard", text: "Deal pipeline (Kanban)" },
        { icon: "DollarSign",   text: "Basic capital stack" },
        { icon: "Map",          text: "Flood map overlay" },
        { icon: "Mail",         text: "Email support" },
      ],
      highlighted: false,
      cta: "Try for free",
      ctaStyle: "muted",
    },
    {
      name: "Pro",
      icon: "Users",
      monthlyPrice: 199,
      tagline: "For growing acquisition teams",
      badge: "Most Popular",
      features: [
        { icon: "Infinity",     text: "Unlimited deals" },
        { icon: "Users",        text: "Up to 6 user seats" },
        { icon: "DollarSign",   text: "Full capital stack + draw schedules" },
        { icon: "Building2",    text: "Investor portal" },
        { icon: "BarChart2",    text: "Market intelligence & heat maps" },
        { icon: "Database",     text: "ARV comparable database" },
        { icon: "TrendingUp",   text: "P&L dashboard" },
        { icon: "Zap",          text: "Priority support" },
      ],
      highlighted: true,
      cta: "Start free trial",
      ctaStyle: "accent",
    },
    {
      name: "Scale",
      icon: "Trophy",
      monthlyPrice: 499,
      tagline: "Built for big operations",
      badge: null,
      features: [
        { icon: "Check",        text: "Everything in Pro" },
        { icon: "Users",        text: "Unlimited user seats" },
        { icon: "Settings",     text: "Custom pipeline stages" },
        { icon: "Code",         text: "API access" },
        { icon: "Globe",        text: "White-label investor portal" },
        { icon: "HeadphonesIcon", text: "Dedicated onboarding" },
      ],
      highlighted: false,
      cta: "Contact sales",
      ctaStyle: "outline",
    },
  ],

  testimonials: [
    {
      quote:
        "We tracked 3× more deals in our first quarter. The capital stack alone saved us 10 hours a week.",
      author: "Marcus T.",
      company: "Land investor, Georgia",
      initials: "MT",
    },
    {
      quote:
        "My investors love the portal. It's the first time they've felt fully informed without me sending weekly email updates.",
      author: "Sarah R.",
      company: "Acquisition manager, Tennessee",
      initials: "SR",
    },
    {
      quote:
        "The pipeline visibility changed how we operate. We catch stalled deals before they fall through the cracks.",
      author: "Derek M.",
      company: "Land developer, Alabama",
      initials: "DM",
    },
  ],

  faq: [
    {
      question: "Is there a free trial?",
      answer:
        "Yes — every plan starts with a 14-day free trial, no credit card required. You get full access to all features included in your plan.",
    },
    {
      question: "Can I import my existing deals?",
      answer:
        "Yes. You can bulk-import deals via CSV or enter them manually. Our onboarding team will help you migrate your data during the trial.",
    },
    {
      question: "How does the investor portal work?",
      answer:
        "Investors log in with their own credentials and see only the deals they're committed to. You control what information is visible on a per-deal basis.",
    },
    {
      question: "Can I add my team members?",
      answer:
        "Starter plans include 1 user seat. Pro plans support up to 5 team members with role-based permissions. Scale plans have unlimited users.",
    },
    {
      question: "What if I need to cancel?",
      answer:
        "Cancel anytime from your account settings. You keep access through the end of your billing period — no cancellation fees, ever.",
    },
  ],

  nav: {
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },

  footer: {
    columns: [
      {
        heading: "Product",
        links: [
          { label: "Features", href: "/features" },
          { label: "Pricing", href: "/pricing" },
          { label: "Changelog", href: "#" },
        ],
      },
      {
        heading: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Contact", href: "/contact" },
          { label: "Blog", href: "#" },
        ],
      },
      {
        heading: "Legal",
        links: [
          { label: "Terms of Service", href: "/terms" },
          { label: "Privacy Policy", href: "/privacy" },
        ],
      },
    ],
    copyright: `© ${new Date().getFullYear()} LotLine Homes LLC. All rights reserved.`,
  },
};
