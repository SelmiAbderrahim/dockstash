# Accessibility Guidelines

This document provides comprehensive accessibility guidelines for implementing WCAG 2.1 AA compliant components in the iReadYouTube project using Shadcn/ui.

## Core Accessibility Requirements

### WCAG 2.1 AA Compliance Checklist

- **[ ] Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **[ ] Keyboard Navigation**: All functionality available via keyboard
- **[ ] Screen Reader Support**: Proper ARIA labels and roles
- **[ ] Focus Management**: Visible focus indicators and logical tab order
- **[ ] Responsive Design**: Works across all device sizes
- **[ ] Error Prevention**: Clear error messages and confirmation dialogs
- **[ ] Alternatives**: Text alternatives for non-text content

## Color and Contrast Guidelines

### Contrast Ratios

**Minimum Requirements (AA Level):**
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+ or 14pt+ bold): 3:1:1 contrast ratio
- UI components and graphical objects: 3:1:1 contrast ratio

### Using Shadcn Color Tokens

```typescript
// ✅ CORRECT: Use semantic color tokens with proper contrast
const AccessibleButton = () => {
  return (
    <Button className="bg-primary text-primary-foreground">
      Button with automatic contrast
    </Button>
  );
};

// ✅ CORRECT: Custom colors with sufficient contrast
const CustomStatusBadge = ({ status }) => {
  const statusStyles = {
    success: "bg-green-600 text-white", // 4.5:1 ratio
    warning: "bg-yellow-500 text-black", // 5.7:1 ratio
    error: "bg-red-600 text-white", // 4.5:1 ratio
  };

  return (
    <Badge className={statusStyles[status]}>
      {status}
    </Badge>
  );
};

// ❌ WRONG: Insufficient contrast
const BadExample = () => {
  return (
    <div className="bg-gray-100 text-gray-400">
      Low contrast text (2.1:1 ratio - FAILS)
    </div>
  );
};
```

### Color Independence

**Never use color as the only indicator of state or meaning:**

```typescript
// ✅ CORRECT: Color + icon + text
const StatusIndicator = ({ status }) => {
  return (
    <div className="flex items-center gap-2">
      {status === "complete" && (
        <>
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-600 font-medium">Complete</span>
        </>
      )}
    </div>
  );
};

// ❌ WRONG: Color only
const BadStatusIndicator = ({ status }) => {
  return (
    <span className={status === "complete" ? "text-green-600" : "text-gray-600"}>
      {status}
    </span>
  );
};
```

## Keyboard Navigation

### Focus Management

```typescript
import { useId } from "react";

const AccessibleFormField = ({ label, error, children }) => {
  const id = useId();
  const errorId = useId();

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>

      {React.cloneElement(children, {
        id,
        "aria-describedby": error ? errorId : undefined,
        "aria-invalid": !!error,
        className: cn(
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          children.props.className
        )
      })}

      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

### Skip Links

```typescript
const SkipLinks = () => {
  return (
    <div className="sr-only not-sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50">
      <a href="#main-content" className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
        Skip to main content
      </a>
      <a href="#navigation" className="bg-primary text-primary-foreground px-4 py-2 rounded-md ml-2">
        Skip to navigation
      </a>
    </div>
  );
};

// Layout component
const Layout = ({ children }) => {
  return (
    <div className="min-h-screen">
      <SkipLinks />
      <header id="navigation">
        {/* Navigation content */}
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
};
```

### Keyboard-Accessible Dropdown

```typescript
const AccessibleDropdown = ({ items, trigger }: AccessibleDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex((prev) => (prev + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (isOpen && selectedIndex >= 0) {
          items[selectedIndex].onClick();
        }
        setIsOpen(!isOpen);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && dropdownRef.current) {
      const selectedItem = dropdownRef.current.children[selectedIndex] as HTMLElement;
      selectedItem?.focus();
    }
  }, [selectedIndex, isOpen]);

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {trigger}
      </Button>

      {isOpen && (
        <ul
          ref={dropdownRef}
          role="menu"
          className="absolute top-full left-0 mt-1 w-48 bg-popover border border-border rounded-md shadow-lg z-50"
        >
          {items.map((item, index) => (
            <li key={item.id} role="none">
              <button
                role="menuitem"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  index === selectedIndex && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

## Screen Reader Support

### ARIA Labels and Descriptions

```typescript
const VideoThumbnail = ({ video, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="relative group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg overflow-hidden"
      aria-label={`Play video: ${video.title}. Duration: ${formatDuration(video.duration)}. Description: ${video.description}`}
    >
      <img
        src={video.thumbnail}
        alt={video.title}
        className="w-full aspect-video object-cover"
      />
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Play className="w-12 h-12 text-white" />
      </div>
      <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
        {formatDuration(video.duration)}
      </div>
    </button>
  );
};
```

### Form Validation Announcements

```typescript
const AccessibleForm = () => {
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const announcementRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      const newErrors = validateForm(formData);
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);

        // Announce errors to screen readers
        if (announcementRef.current) {
          announcementRef.current.textContent =
            `Form has ${Object.keys(newErrors).length} error(s). ${Object.values(newErrors).join('. ')}`;
        }
        return;
      }

      await submitForm(formData);
    } catch (error) {
      setErrors({ general: error.message });

      if (announcementRef.current) {
        announcementRef.current.textContent = `Submission failed: ${error.message}`;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Hidden announcement for screen readers */}
      <div
        ref={announcementRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />

      <AccessibleFormField
        label="Video Title"
        error={errors.title}
        required
      >
        <Input
          type="text"
          name="title"
          required
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
        />
      </AccessibleFormField>

      {errors.general && (
        <div role="alert" className="text-destructive text-sm">
          {errors.general}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : "Upload Video"}
      </Button>
    </form>
  );
};
```

### Live Regions

```typescript
const ProgressTracker = ({ progress, status }) => {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (status === "completed") {
      setAnnouncement("Video processing completed successfully");
    } else if (status === "failed") {
      setAnnouncement("Video processing failed. Please try again.");
    } else if (progress > 0 && progress % 25 === 0) {
      setAnnouncement(`Processing is ${progress}% complete`);
    }
  }, [progress, status]);

  return (
    <div className="space-y-2">
      <Progress value={progress} className="h-2" />

      {/* Screen reader announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      {/* Visual status */}
      <div className="text-sm text-muted-foreground">
        {status === "processing" && `Processing: ${progress}%`}
        {status === "completed" && "Completed successfully"}
        {status === "failed" && "Processing failed"}
      </div>
    </div>
  );
};
```

## Focus Management

### Custom Focus Indicators

```css
/* Enhanced focus styles that work with the design system */
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .focus-ring {
    @apply focus:ring-4 focus:ring-offset-0;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .focus-ring {
    @apply transition-none;
  }
}
```

### Modal Focus Trapping

```typescript
const AccessibleModal = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus modal
      modalRef.current?.focus();

      // Trap focus
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Tab") {
          const focusableElements = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );

          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          }
        }

        if (e.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto focus-ring"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground focus-ring rounded-sm p-1"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 id="modal-title" className="text-lg font-semibold mb-4">
          {title}
        </h2>

        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
```

## Responsive and Mobile Accessibility

### Touch Target Sizes

**Minimum touch target: 44×44 pixels**

```typescript
// ✅ CORRECT: Adequate touch targets
const MobileButton = ({ icon, label, ...props }) => {
  return (
    <Button
      size="lg"
      className="min-h-[44px] min-w-[44px] flex items-center gap-2"
      {...props}
    >
      {icon && <icon className="w-4 h-4" />}
      {label}
    </Button>
  );
};

// ✅ CORRECT: Spaced touch targets
const IconButton = ({ icon, label, ...props }) => {
  return (
    <button
      className={cn(
        "p-3 rounded-md hover:bg-accent hover:text-accent-foreground",
        "focus-ring min-h-[44px] min-w-[44px]",
        "flex items-center justify-center"
      )}
      aria-label={label}
      {...props}
    >
      <icon className="w-5 h-5" />
    </button>
  );
};
```

### Responsive Typography

```typescript
const ResponsiveText = ({ children, variant = "body" }: ResponsiveTextProps) => {
  const variants = {
    h1: "text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
    h2: "text-xl sm:text-2xl md:text-3xl lg:text-4xl",
    h3: "text-lg sm:text-xl md:text-2xl lg:text-3xl",
    body: "text-sm sm:text-base",
    small: "text-xs sm:text-sm",
  };

  return (
    <p className={variants[variant]}>
      {children}
    </p>
  );
};
```

## Testing Accessibility

### Manual Testing Checklist

**Keyboard Navigation:**
- [ ] Can I navigate to all interactive elements with Tab?
- [ ] Is the focus order logical?
- [ ] Can I activate all elements with Enter/Space?
- [ ] Are focus indicators clearly visible?
- [ ] Can I dismiss modals with Escape?

**Screen Reader Testing:**
- [ ] Are all images described (alt text or aria-label)?
- [ ] Are form fields properly labeled?
- [ ] Are error messages announced?
- [ ] Are status updates communicated?
- [ ] Can I navigate by headings?

**Color and Contrast:**
- [ ] Does text meet minimum contrast ratios?
- [ ] Is color not used as the only indicator?
- [ ] Do focus states have sufficient contrast?
- [ ] Can I distinguish interactive elements?

**Visual Accessibility:**
- [ ] Can I resize text to 200% without breaking layout?
- [ ] Does content reflow on small screens?
- [ ] Are touch targets at least 44×44px?
- [ ] Is there enough whitespace?

### Automated Testing Tools

```bash
# Install accessibility testing tools
npm install --save-dev axe-core @axe-core/react

# Run accessibility audits
npm run test:a11y
```

### Accessibility Unit Tests

```typescript
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { VideoCard } from "./VideoCard";

expect.extend(toHaveNoViolations);

describe("VideoCard accessibility", () => {
  test("should not have accessibility violations", async () => {
    const { container } = render(<VideoCard video={mockVideo} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test("should have accessible play button", () => {
    render(<VideoCard video={mockVideo} />);

    const playButton = screen.getByRole("button", { name: /play video/i });
    expect(playButton).toBeInTheDocument();
    expect(playButton).toHaveAttribute("aria-label");
  });

  test("should announce loading state", () => {
    render(<VideoCard video={mockVideo} loading />);

    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus).toBeInTheDocument();
  });
});
```

## Common Accessibility Issues and Solutions

### Issue: Hidden Elements Still Focusable

```typescript
// ❌ WRONG: Hidden but still in tab order
const BadHidden = ({ hidden }) => (
  <div style={{ display: hidden ? "none" : "block" }}>
    Content
  </div>
);

// ✅ CORRECT: Properly hidden from accessibility tree
const GoodHidden = ({ hidden }) => (
  <div
    hidden={hidden}
    aria-hidden={hidden}
    className={hidden ? "sr-only" : ""}
  >
    Content
  </div>
);
```

### Issue: Missing Alternative Text

```typescript
// ✅ CORRECT: Proper image alternatives
const VideoThumbnail = ({ video }) => (
  <img
    src={video.thumbnail}
    alt={`Thumbnail for ${video.title}`}
    onError={(e) => {
      // Fallback for decorative images
      e.currentTarget.alt = "";
      e.currentTarget.setAttribute("aria-hidden", "true");
    }}
  />
);

// ✅ CORRECT: Decorative images
const DecorativeIcon = () => (
  <img
    src="/decoration.svg"
    alt=""
    aria-hidden="true"
  />
);
```

### Issue: Insufficient Error Information

```typescript
// ✅ CORRECT: Detailed error messages
const FormError = ({ field, errors }) => {
  if (!errors[field]) return null;

  const errorMessages = {
    required: `${field.charAt(0).toUpperCase() + field.slice(1)} is required`,
    minLength: `${field.charAt(0).toUpperCase() + field.slice(1)} must be at least ${errors[field].requiredLength} characters`,
    invalid: `Please enter a valid ${field}`,
  };

  return (
    <div role="alert" className="text-destructive text-sm">
      {errorMessages[errors[field].type] || "Invalid input"}
    </div>
  );
};
```

Remember: Accessibility is not optional—it's a fundamental requirement for inclusive design. Always test with real users and assistive technologies to ensure your components work for everyone.