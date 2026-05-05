# CSS Custom Properties Reference

This document provides a comprehensive reference for all CSS custom properties used in the iReadYouTube design system.

## Color System

### Base Colors
```css
/* Primary semantic colors */
--primary: 222.2 84% 4.9%;           /* Primary action color */
--primary-foreground: 210 40% 98%;  /* Text on primary */

/* Secondary colors */
--secondary: 210 40% 96%;           /* Secondary surfaces */
--secondary-foreground: 222.2 84% 4.9%; /* Text on secondary */

/* Muted colors */
--muted: 210 40% 96%;               /* Disabled/muted state */
--muted-foreground: 215.4 16.3% 46.9%; /* Muted text */

/* Accent colors */
--accent: 210 40% 96%;              /* Hover/active states */
--accent-foreground: 222.2 84% 4.9%; /* Text on accent */

/* Destructive colors */
--destructive: 0 84.2% 60.2%;       /* Error/danger states */
--destructive-foreground: 210 40% 98%; /* Text on destructive */

/* Base colors */
--background: 0 0% 100%;            /* Main background */
--foreground: 222.2 84% 4.9%;       /* Main text color */

/* Card colors */
--card: 0 0% 100%;                  /* Card background */
--card-foreground: 222.2 84% 4.9%;  /* Card text */

/* Border colors */
--border: 214.3 31.8% 91.4%;        /* Default border */
--input: 214.3 31.8% 91.4%;         /* Input borders */
--ring: 222.2 84% 4.9%;             /* Focus ring */
```

### Dark Mode Colors
```css
/* Dark mode overrides are applied automatically */
/* Use the same color tokens in dark mode */

/* Example: */
.my-component {
  background: var(--card);          /* Light: white, Dark: var(--gray-950) */
  color: var(--card-foreground);    /* Light: black, Dark: white */
  border: 1px solid var(--border);  /* Light: light gray, Dark: dark gray */
}
```

## Typography System

### Font Families
```css
--font-sans: 'Inter', system-ui, sans-serif;        /* ABeeZee replaced by Inter */
--font-serif: 'Geist', Georgia, serif;             /* Abhaya Libre replaced by Geist */
--font-mono: 'JetBrains Mono', Consolas, monospace; /* Code fonts */
```

### Font Sizes
```css
/* Scale based on 1rem = 16px */
--text-xs: 0.75rem;      /* 12px */
--text-sm: 0.875rem;     /* 14px */
--text-base: 1rem;       /* 16px */
--text-lg: 1.125rem;     /* 18px */
--text-xl: 1.25rem;      /* 20px */
--text-2xl: 1.5rem;      /* 24px */
--text-3xl: 1.875rem;    /* 30px */
--text-4xl: 2.25rem;     /* 36px */
--text-5xl: 3rem;        /* 48px */
```

### Font Weights
```css
--font-thin: 100;
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
--font-black: 900;
```

### Line Heights
```css
--leading-none: 1;
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;
```

## Spacing System

**Base unit**: 0.25rem (4px) with consistent scale

```css
/* Space scale (0.25rem = 4px increments) */
--space-0: 0;           /* 0px */
--space-px: 1px;        /* 1px */
--space-0_5: 0.125rem;  /* 2px */
--space-1: 0.25rem;     /* 4px */
--space-1_5: 0.375rem;  /* 6px */
--space-2: 0.5rem;      /* 8px */
--space-2_5: 0.625rem;  /* 10px */
--space-3: 0.75rem;     /* 12px */
--space-3_5: 0.875rem;  /* 14px */
--space-4: 1rem;        /* 16px */
--space-5: 1.25rem;     /* 20px */
--space-6: 1.5rem;      /* 24px */
--space-7: 1.75rem;     /* 28px */
--space-8: 2rem;        /* 32px */
--space-9: 2.25rem;     /* 36px */
--space-10: 2.5rem;     /* 40px */
--space-11: 2.75rem;    /* 44px */
--space-12: 3rem;       /* 48px */
--space-14: 3.5rem;     /* 56px */
--space-16: 4rem;       /* 64px */
--space-20: 5rem;       /* 80px */
--space-24: 6rem;       /* 96px */
--space-28: 7rem;       /* 112px */
--space-32: 8rem;       /* 128px */
--space-36: 9rem;       /* 144px */
--space-40: 10rem;      /* 160px */
--space-44: 11rem;      /* 176px */
--space-48: 12rem;      /* 192px */
--space-52: 13rem;      /* 208px */
--space-56: 14rem;      /* 224px */
--space-60: 15rem;      /* 240px */
--space-64: 16rem;      /* 256px */
--space-72: 18rem;      /* 288px */
--space-80: 20rem;      /* 320px */
--space-96: 24rem;      /* 384px */
```

## Border Radius System

```css
/* Radius scale */
--radius-0: 0;          /* 0px */
--radius-none: 0;
--radius-sm: 0.125rem;  /* 2px */
--radius: 0.375rem;     /* 6px - default radius */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-xl: 1rem;      /* 16px */
--radius-2xl: 1.5rem;   /* 24px */
--radius-3xl: 2rem;     /* 32px */
--radius-full: 9999px;  /* Fully rounded */
```

## Shadow System

```css
/* Shadow scale - uses hsl colors for automatic dark mode */
--shadow-2xs: 0 1px 2px 0 hsl(var(--shadow-color) / 0.05);
--shadow-xs: 0 1px 2px -1px hsl(var(--shadow-color) / 0.06), 0 3px 4px -2px hsl(var(--shadow-color) / 0.1);
--shadow-sm: 0 1px 2px 0 hsl(var(--shadow-color) / 0.05);
--shadow: 0 1px 3px 0 hsl(var(--shadow-color) / 0.1), 0 1px 2px -1px hsl(var(--shadow-color) / 0.1);
--shadow-md: 0 4px 6px -1px hsl(var(--shadow-color) / 0.1), 0 2px 4px -2px hsl(var(--shadow-color) / 0.1);
--shadow-lg: 0 10px 15px -3px hsl(var(--shadow-color) / 0.1), 0 4px 6px -4px hsl(var(--shadow-color) / 0.1);
--shadow-xl: 0 20px 25px -5px hsl(var(--shadow-color) / 0.1), 0 8px 10px -6px hsl(var(--shadow-color) / 0.1);
--shadow-2xl: 0 25px 50px -12px hsl(var(--shadow-color) / 0.25);

/* Inner shadows */
--shadow-inner: inset 0 2px 4px 0 hsl(var(--shadow-color) / 0.05);
```

## Animation System

```css
/* Transition durations */
--duration-75: 75ms;
--duration-100: 100ms;
--duration-150: 150ms;
--duration-200: 200ms;
--duration-300: 300ms;
--duration-500: 500ms;
--duration-700: 700ms;
--duration-1000: 1000ms;

/* Timing functions */
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* Common transitions */
--transition-colors: color var(--duration-150) var(--ease-in-out), background-color var(--duration-150) var(--ease-in-out), border-color var(--duration-150) var(--ease-in-out);
--transition-opacity: opacity var(--duration-150) var(--ease-in-out);
--transition-shadow: box-shadow var(--duration-150) var(--ease-in-out);
--transition-transform: transform var(--duration-150) var(--ease-in-out);
--transition-all: all var(--duration-150) var(--ease-in-out);
```

## Z-Index System

```css
/* Z-index scale for consistent layering */
--z-0: 0;
--z-10: 10;
--z-20: 20;
--z-30: 30;
--z-40: 40;
--z-50: 50;

/* Common z-index utilities */
--z-dropdown: 1000;
--z-sticky: 1020;
--z-fixed: 1030;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-popover: 1060;
--z-tooltip: 1070;
```

## Breakpoint System

```css
/* Responsive breakpoints (em units) */
--breakpoint-sm: 40em;   /* 640px */
--breakpoint-md: 48em;   /* 768px */
--breakpoint-lg: 64em;   /* 1024px */
--breakpoint-xl: 80em;   /* 1280px */
--breakpoint-2xl: 96em;  /* 1536px */
```

## Usage Examples

### Basic Component Styling
```css
.video-card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow);
  transition: var(--transition-shadow);
}

.video-card:hover {
  box-shadow: var(--shadow-lg);
}
```

### Typography Implementation
```css
.heading-1 {
  font-family: var(--font-serif);
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--foreground);
}

.body-text {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-relaxed);
  color: var(--foreground);
}
```

### Interactive States
```css
.button-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-6);
  font-weight: var(--font-medium);
  transition: var(--transition-colors), var(--transition-transform);
}

.button-primary:hover {
  background: hsl(var(--primary) / 0.9);
  transform: translateY(-1px);
}

.button-primary:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring);
}
```

### Status Colors
```css
.status-success {
  background: hsl(142.1 76.2% 36.3% / 0.1);
  color: hsl(142.1 76.2% 36.3%);
  border: 1px solid hsl(142.1 76.2% 36.3% / 0.2);
}

.status-warning {
  background: hsl(47.9 95.8% 53.1% / 0.1);
  color: hsl(47.9 95.8% 53.1%);
  border: 1px solid hsl(47.9 95.8% 53.1% / 0.2);
}

.status-error {
  background: var(--destructive) / 0.1;
  color: var(--destructive);
  border: 1px solid hsl(var(--destructive) / 0.2);
}
```

## Custom Property Extensions

### Video-Specific Colors
```css
/* Video player and transcript specific colors */
--video-background: var(--muted);
--video-controls: var(--card);
--video-overlay: hsl(var(--background) / 0.8);
--transcript-highlight: hsl(var(--primary) / 0.1);
--transcript-active: hsl(var(--primary) / 0.2);
```

### YouTube Integration Colors
```css
/* YouTube brand colors for integration */
--youtube-red: 239.4 100% 58.8%;
--youtube-dark-red: 359.4 100% 43.5%;
--youtube-light-red: 0 84.2% 60.2%;
```

## Validation Rules

### Required Properties
Always validate that your CSS custom properties follow these rules:

1. **Use correct property names**: `var(--space-6)` not `var(--spacing-6)`
2. **Use semantic colors**: `var(--primary)` not `var(--blue-500)`
3. **Check dark mode compatibility**: Colors should work in both themes
4. **Maintain consistency**: Use appropriate scale values
5. **Test accessibility**: Ensure sufficient contrast ratios

### Common Mistakes
```css
/* ❌ WRONG: Hardcoded values */
.bad-component {
  background: #ffffff;
  color: #000000;
  padding: 24px;
  border-radius: 12px;
}

/* ❌ WRONG: Incorrect property names */
.wrong-usage {
  padding: var(--padding-large);     /* Should be var(--space-6) */
  margin: var(--spacing-md);         /* Should be var(--space-4) */
  color: var(--text-primary);        /* Should be var(--foreground) */
}

/* ❌ WRONG: Hardcoded dark mode colors */
.dark-mode-wrong {
  background: #1a1a1a;               /* Should use var(--card) */
  color: #ffffff;                    /* Should use var(--card-foreground) */
}

/* ✅ CORRECT: Proper CSS custom properties */
.good-component {
  background: var(--card);
  color: var(--card-foreground);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  transition: var(--transition-colors);
}
```

## Tools and Validation

Use the provided scripts to validate CSS custom properties usage:

```bash
# Validate CSS properties in a file
./scripts/validate-css-properties.sh path/to/component.tsx

# Check theme compliance
./scripts/check-theme-compliance.sh component-name

# Run comprehensive audit
./scripts/audit-design-system.sh
```

Remember: Always use CSS custom properties for maintainable, themeable, and accessible components that work seamlessly across light and dark modes.