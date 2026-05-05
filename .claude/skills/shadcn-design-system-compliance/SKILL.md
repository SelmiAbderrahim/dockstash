---
name: shadcn-design-system-compliance
description: Comprehensive guide for implementing and validating Shadcn/ui design system compliance with CSS custom properties. Use when creating React components, implementing UI features, or validating design system adherence in the iReadYouTube project. Enforces professional theme compliance, CSS custom properties usage, and enterprise-grade quality standards.
license: MIT
metadata:
  version: "1.0.0"
  author: "Design System Specialist"
  category: "design-system"
  dependencies: "react@18+, typescript, tailwindcss, shadcn/ui"
  project: "iReadYouTube YouTube Video Transcription MVP"
---

# Shadcn Design System Compliance

## Overview

This skill ensures strict adherence to the professional Shadcn/ui design system implemented in the iReadYouTube project. It provides comprehensive guidelines for CSS custom properties usage, component composition patterns, and theme compliance validation.

**Keywords**: shadcn, design system, CSS custom properties, theme compliance, UI components, dark mode, typography, spacing, color tokens, accessibility, responsive design

**Project Context**: iReadYouTube YouTube Video Transcription MVP with React 18 + TypeScript + Convex + AssemblyAI, featuring professional Shadcn theme with ABeeZee and Abhaya Libre typography.

## When to Use This Skill

- **Component Development**: When creating new React components or UI elements
- **Design Implementation**: When implementing designs or UI features
- **Code Review**: When validating design system compliance in pull requests
- **Style Validation**: When checking CSS custom properties usage
- **Theme Updates**: When updating or modifying theme configurations
- **Accessibility Audits**: When ensuring WCAG 2.1 AA compliance
- **Responsive Implementation**: When implementing mobile-first responsive design
- **Dark Mode Features**: When adding dark/light mode support

## Process / Workflow

### Step 1: Design System Validation

Always validate design system compliance before implementation:

```bash
# Check if component uses CSS custom properties correctly
./scripts/validate-css-properties.sh path/to/component.tsx

# Validate theme compliance
./scripts/check-theme-compliance.sh component-name

# Run comprehensive design system audit
./scripts/audit-design-system.sh
```

### Step 2: Component Implementation with CSS Custom Properties

**MANDATORY**: Use only CSS custom properties, never hardcoded values:

```typescript
// ✅ CORRECT: CSS custom properties only
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const VideoCard = ({ video, variant = "default" }) => {
  return (
    <Card className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      "p-6 hover:shadow-md transition-shadow duration-200",
      variant === "featured" && "ring-2 ring-primary"
    )}>
      <h3 className="text-lg font-semibold text-card-foreground mb-2">
        {video.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {video.description}
      </p>
      <Button variant="secondary" className="w-full">
        View Transcript
      </Button>
    </Card>
  );
};

// ❌ WRONG: Hardcoded values - NEVER DO THIS
const BadVideoCard = ({ video }) => {
  return (
    <div style={{
      backgroundColor: "#ffffff",        // WRONG - Use var(--card)
      color: "#0a0a0a",                 // WRONG - Use var(--card-foreground)
      borderRadius: "10px",             // WRONG - Use var(--radius-lg)
      padding: "24px",                  // WRONG - Use var(--space-6)
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"  // WRONG - Use var(--shadow)
    }}>
      {/* content */}
    </div>
  );
};
```

### Step 3: Typography System Implementation

Use ABeeZee (sans-serif) and Abhaya Libre (serif) fonts only:

```typescript
// Typography scale using CSS custom properties
const TypographyPatterns = {
  // Heading patterns
  h1: "text-4xl font-serif font-bold text-foreground", // Abhaya Libre
  h2: "text-3xl font-serif font-semibold text-foreground",
  h3: "text-2xl font-serif font-medium text-foreground",
  h4: "text-xl font-serif text-foreground",

  // Body text patterns
  bodyLarge: "text-base font-sans text-foreground", // ABeeZee
  body: "text-sm font-sans text-foreground",
  bodySmall: "text-xs font-sans text-muted-foreground",

  // UI text patterns
  caption: "text-xs font-sans text-muted-foreground",
  label: "text-sm font-sans font-medium text-foreground",
};

// Component example
const TranscriptViewer = ({ transcript }) => {
  return (
    <div className="space-y-6">
      <h2 className={TypographyPatterns.h2}>
        Video Transcript
      </h2>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        {transcript.segments.map((segment) => (
          <p key={segment.id} className={TypographyPatterns.body}>
            <span className="text-muted-foreground">
              [{formatTime(segment.timestamp)}]
            </span>{" "}
            {segment.text}
          </p>
        ))}
      </div>
    </div>
  );
};
```

### Step 4: Color Token System Implementation

Use semantic color tokens with proper dark mode support:

```typescript
// Color token patterns for iReadYouTube
const ColorPatterns = {
  // Primary actions (brand colors)
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  primaryOutline: "border border-primary text-primary hover:bg-primary hover:text-primary-foreground",

  // Secondary actions
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",

  // Status colors
  success: "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
  warning: "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
  error: "bg-destructive text-destructive-foreground",
  info: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",

  // Surface colors
  card: "bg-card text-card-foreground border-border",
  muted: "bg-muted text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
};

// Status indicator component
const ProcessingStatus = ({ status }) => {
  const statusConfig = {
    processing: {
      variant: "warning",
      text: "Processing...",
      icon: Loader2,
    },
    completed: {
      variant: "success",
      text: "Completed",
      icon: CheckCircle,
    },
    failed: {
      variant: "error",
      text: "Failed",
      icon: XCircle,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border",
      ColorPatterns[config.variant]
    )}>
      <Icon className="w-4 h-4" />
      {config.text}
    </div>
  );
};
```

### Step 5: Spacing System Implementation

Use var(--space-*) tokens for consistent spacing:

```typescript
// Spacing scale (0.25rem = 4px base unit)
const SpacingPatterns = {
  // Component spacing
  section: "space-y-12",     // var(--space-12) = 48px
  card: "space-y-6",         // var(--space-6) = 24px
  compact: "space-y-4",      // var(--space-4) = 16px
  tight: "space-y-2",        // var(--space-2) = 8px

  // Element spacing
  elementGap: "gap-4",       // var(--space-4) = 16px
  elementGapLarge: "gap-6",  // var(--space-6) = 24px
  elementGapSmall: "gap-2",  // var(--space-2) = 8px

  // Padding patterns
  paddingCard: "p-6",        // var(--space-6) = 24px
  paddingCompact: "p-4",     // var(--space-4) = 16px
  paddingTight: "p-2",       // var(--space-2) = 8px
};

// Layout component example
const VideoGrid = ({ videos }) => {
  return (
    <section className={SpacingPatterns.section}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            className={SpacingPatterns.paddingCard}
          />
        ))}
      </div>
    </section>
  );
};
```

### Step 6: Border Radius and Shadow System

Use var(--radius-*) and var(--shadow-*) tokens:

```typescript
// Border radius patterns
const BorderRadiusPatterns = {
  none: "rounded-none",           // var(--radius-none) = 0px
  small: "rounded-sm",            // var(--radius-sm) = 0.125rem = 2px
  default: "rounded",             // var(--radius) = 0.375rem = 6px
  medium: "rounded-md",           // var(--radius-md) = 0.5rem = 8px
  large: "rounded-lg",            // var(--radius-lg) = 0.75rem = 12px
  extraLarge: "rounded-xl",       // var(--radius-xl) = 1rem = 16px
  full: "rounded-full",           // var(--radius-full) = 9999px
};

// Shadow patterns
const ShadowPatterns = {
  none: "shadow-none",                        // var(--shadow-2xs) = none
  small: "shadow-sm",                         // var(--shadow-sm) = subtle
  default: "shadow",                          // var(--shadow) = standard
  medium: "shadow-md",                        // var(--shadow-md) = medium
  large: "shadow-lg",                         // var(--shadow-lg) = large
  extraLarge: "shadow-xl",                    // var(--shadow-xl) = extra large
  glow: "shadow-lg shadow-primary/20",        // Colored glow effect
};

// Interactive component with proper radius and shadows
const InteractiveButton = ({ children, variant = "default", size = "md" }) => {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const variantClasses = {
    default: cn(
      "bg-primary text-primary-foreground",
      "hover:bg-primary/90",
      ShadowPatterns.small,
      "hover:shadow-md transition-shadow duration-200"
    ),
    outline: cn(
      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ShadowPatterns.none,
      "hover:shadow-sm transition-shadow duration-200"
    ),
    ghost: cn(
      "hover:bg-accent hover:text-accent-foreground",
      ShadowPatterns.none
    ),
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center",
        "font-medium transition-colors duration-200",
        BorderRadiusPatterns.medium,
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        sizeClasses[size],
        variantClasses[variant]
      )}
    >
      {children}
    </button>
  );
};
```

### Step 7: Dark Mode Implementation

Ensure all components support dark mode automatically:

```typescript
// Dark mode utilities
const DarkModePatterns = {
  // Surface colors (automatic dark mode)
  surface: "bg-background text-foreground",
  card: "bg-card text-card-foreground border-border",
  muted: "bg-muted text-muted-foreground",

  // Interactive elements
  interactive: "hover:bg-accent hover:text-accent-foreground",
  focus: "focus:ring-2 focus:ring-ring focus:ring-offset-2",

  // Border colors (automatic dark mode)
  border: "border-border",
  borderSubtle: "border-border/50",
};

// Theme-aware component
const ThemeAwareCard = ({ children, className, ...props }) => {
  return (
    <Card
      className={cn(
        DarkModePatterns.card,
        "transition-colors duration-200",
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
};

// Dark mode toggle component
const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="w-9 px-0"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};
```

### Step 8: Accessibility Compliance (WCAG 2.1 AA)

Ensure full accessibility compliance:

```typescript
// Accessibility patterns
const AccessibilityPatterns = {
  // Focus management
  focusable: "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  focusVisible: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",

  // Screen reader support
  srOnly: "sr-only",
  notSrOnly: "not-sr-only",

  // Interactive states
  disabled: "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",

  // High contrast mode
  highContrast: "contrast-more:border-current contrast-more:border-opacity-100",
};

// Accessible form component
const AccessibleFormField = ({ label, error, description, required, children }) => {
  const fieldId = useId();
  const errorId = useId();
  const descriptionId = useId();

  return (
    <div className="space-y-2">
      <Label
        htmlFor={fieldId}
        className={cn(
          "text-sm font-medium text-foreground",
          required && "after:content-['*'] after:ml-0.5 after:text-destructive"
        )}
      >
        {label}
      </Label>

      <div className="relative">
        {React.cloneElement(children, {
          id: fieldId,
          "aria-describedby": cn(
            description && descriptionId,
            error && errorId
          ),
          "aria-invalid": !!error,
          "aria-required": required,
          className: cn(
            AccessibilityPatterns.focusable,
            children.props.className
          )
        })}
      </div>

      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

### Step 9: Responsive Design Patterns

Implement mobile-first responsive design:

```typescript
// Responsive breakpoints (Tailwind defaults)
const ResponsivePatterns = {
  // Container patterns
  container: "container mx-auto px-4 sm:px-6 lg:px-8",

  // Grid patterns
  gridResponsive: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
  gridTwoColumn: "grid grid-cols-1 lg:grid-cols-2 gap-8",

  // Text responsive
  headingResponsive: "text-2xl md:text-3xl lg:text-4xl",
  bodyResponsive: "text-sm md:text-base",

  // Spacing responsive
  sectionResponsive: "py-8 md:py-12 lg:py-16",
  cardResponsive: "p-4 md:p-6",
};

// Responsive layout component
const ResponsiveVideoCard = ({ video }) => {
  return (
    <Card className={ResponsivePatterns.cardResponsive}>
      <div className="aspect-video bg-muted rounded-md mb-4" />
      <div className="space-y-2">
        <h3 className={cn(
          "font-semibold line-clamp-2",
          ResponsivePatterns.bodyResponsive
        )}>
          {video.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {video.description}
        </p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {formatDuration(video.duration)}
          </span>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Responsive grid component
const ResponsiveVideoGrid = ({ videos }) => {
  return (
    <section className={ResponsivePatterns.sectionResponsive}>
      <div className={ResponsivePatterns.container}>
        <div className={ResponsivePatterns.gridResponsive}>
          {videos.map((video) => (
            <ResponsiveVideoCard key={video.id} video={video} />
          ))}
        </div>
      </div>
    </section>
  );
};
```

## Guidelines

### 🎨 CSS Custom Properties Rules

**MANDATORY**: Always use CSS custom properties, never hardcoded values:

```css
/* ✅ CORRECT: Use CSS custom properties */
.component {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow);
}

/* ❌ WRONG: Hardcoded values - NEVER DO THIS */
.bad-component {
  background: #ffffff;
  color: #0a0a0a;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}
```

### 🏗️ Component Composition

**Compose from Shadcn/ui primitives** using the `cn` utility:

```typescript
// ✅ CORRECT: Composition with cn utility
import { cn } from "@/lib/utils";

const MyComponent = ({ variant = "default", className, ...props }) => {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm p-6",
        variant === "elevated" && "shadow-lg",
        className
      )}
      {...props}
    />
  );
};

// ❌ WRONG: Direct style manipulation
const BadComponent = ({ variant }) => {
  const styles = {
    backgroundColor: "#ffffff",
    color: "#0a0a0a",
    borderRadius: variant === "elevated" ? "16px" : "12px",
    // ... more hardcoded values
  };

  return <div style={styles} />;
};
```

### 🌙 Dark Mode Implementation

**All components must support dark mode** automatically:

```typescript
// ✅ CORRECT: Automatic dark mode support
const DarkModeComponent = () => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-card-foreground mb-2">
        Title
      </h3>
      <p className="text-sm text-muted-foreground">
        Description text
      </p>
    </Card>
  );
};

// ❌ WRONG: Manual dark mode handling
const BadDarkModeComponent = ({ isDark }) => {
  const theme = isDark ? darkTheme : lightTheme;
  return (
    <div style={{
      backgroundColor: theme.backgroundColor,
      color: theme.color,
      borderColor: theme.borderColor
    }}>
      {/* content */}
    </div>
  );
};
```

### 📱 Mobile-First Responsive Design

**Start with mobile layout, then enhance**:

```typescript
// ✅ CORRECT: Mobile-first approach
const ResponsiveComponent = () => {
  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* content */}
      </div>
    </div>
  );
};

// ❌ WRONG: Desktop-first approach
const BadResponsiveComponent = () => {
  return (
    <div className="space-y-8 lg:space-y-6 md:space-y-4">
      <div className="grid grid-cols-3 lg:grid-cols-2 md:grid-cols-1 gap-4">
        {/* content */}
      </div>
    </div>
  );
};
```

### ♿ Accessibility First

**Ensure WCAG 2.1 AA compliance** by default:

```typescript
// ✅ CORRECT: Accessibility first
const AccessibleButton = ({ children, ...props }) => {
  return (
    <button
      className={cn(
        "rounded-md bg-primary text-primary-foreground px-4 py-2",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
      {...props}
    >
      {children}
    </button>
  );
};

// ❌ WRONG: No accessibility considerations
const InaccessibleButton = ({ children, onClick }) => {
  return (
    <div onClick={onClick} style={{
      backgroundColor: '#007bff',
      color: 'white',
      padding: '8px 16px',
      cursor: 'pointer'
    }}>
      {children}
    </div>
  );
};
```

## Examples

### Example 1: Video Transcript Viewer Component

```typescript
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  Search,
  Copy,
  Download,
  Volume2,
  FileText
} from "lucide-react";

interface TranscriptSegment {
  id: string;
  timestamp: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

interface TranscriptViewerProps {
  videoId: string;
  videoTitle: string;
  segments: TranscriptSegment[];
  duration: number;
  className?: string;
}

const TranscriptViewer = ({
  videoId,
  videoTitle,
  segments,
  duration,
  className
}: TranscriptViewerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const filteredSegments = segments.filter(segment =>
    segment.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = () => {
    const fullTranscript = segments
      .map(segment => `[${formatTime(segment.timestamp)}] ${segment.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullTranscript);
  };

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Transcript
            </CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {videoTitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(duration)}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2",
                "bg-muted border border-border rounded-md",
                "text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
            />
          </div>

          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="w-4 h-4" />
          </Button>

          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-4">
            {filteredSegments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "No matching segments found" : "No transcript available"}
              </div>
            ) : (
              filteredSegments.map((segment) => (
                <div
                  key={segment.id}
                  className={cn(
                    "group p-4 rounded-lg border border-border/50",
                    "hover:bg-muted/50 hover:border-border",
                    "cursor-pointer transition-colors duration-200",
                    selectedSegment === segment.id && "bg-muted border-border"
                  )}
                  onClick={() => setSelectedSegment(segment.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {formatTime(segment.timestamp)}
                    </div>

                    <div className="flex-1 space-y-1">
                      <p className="text-sm leading-relaxed">
                        {segment.text}
                      </p>

                      {segment.confidence && (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-xs"
                            title={`Confidence: ${Math.round(segment.confidence * 100)}%`}
                          >
                            {Math.round(segment.confidence * 100)}% confidence
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TranscriptViewer;
```

### Example 2: Video Upload Component with Design System Compliance

```typescript
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  Link,
  FileVideo,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle
} from "lucide-react";

interface VideoUploadProps {
  onUpload: (file: File | string) => void;
  accept?: string;
  maxSize?: number;
  className?: string;
}

const VideoUpload = ({
  onUpload,
  accept = "video/*,.mp4,.avi,.mov",
  maxSize = 100 * 1024 * 1024, // 100MB
  className
}: VideoUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.size > maxSize) {
      setUploadError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      return;
    }

    if (!file.type.startsWith('video/')) {
      setUploadError('Please upload a valid video file');
      return;
    }

    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          setTimeout(() => {
            setUploading(false);
            onUpload(file);
          }, 500);
          return 95;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleYoutubeUrl = () => {
    if (!youtubeUrl.trim()) {
      setUploadError('Please enter a valid YouTube URL');
      return;
    }

    // Basic YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(youtubeUrl)) {
      setUploadError('Please enter a valid YouTube URL');
      return;
    }

    setUploadError(null);
    onUpload(youtubeUrl);
    setYoutubeUrl("");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Video
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload a video file or provide a YouTube URL
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Upload Area */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8",
            "transition-colors duration-200",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-border/80",
            uploading && "pointer-events-none opacity-50"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
            disabled={uploading}
          />

          <div className="flex flex-col items-center space-y-4 text-center">
            <div className={cn(
              "p-4 rounded-full",
              dragActive ? "bg-primary/10" : "bg-muted"
            )}>
              <FileVideo className={cn(
                "w-8 h-8",
                dragActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">
                {uploading ? "Uploading..." : "Drop video file here"}
              </h3>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>

            <div className="text-xs text-muted-foreground">
              Max file size: {formatFileSize(maxSize)}
            </div>
          </div>

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
              <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Uploading video...</p>
                  <Progress value={uploadProgress} className="w-48" />
                  <p className="text-xs text-muted-foreground">
                    {uploadProgress}% complete
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or
            </span>
          </div>
        </div>

        {/* YouTube URL Input */}
        <div className="space-y-3">
          <Label htmlFor="youtube-url">YouTube URL</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="youtube-url"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleYoutubeUrl()}
                className="pl-10"
                disabled={uploading}
              />
            </div>
            <Button
              onClick={handleYoutubeUrl}
              disabled={uploading || !youtubeUrl.trim()}
            >
              Add URL
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {uploadError && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-md",
            "bg-destructive/10 text-destructive border border-destructive/20"
          )}>
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm">{uploadError}</p>
          </div>
        )}

        {/* Supported Formats */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Supported formats:</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">MP4</Badge>
            <Badge variant="secondary">AVI</Badge>
            <Badge variant="secondary">MOV</Badge>
            <Badge variant="secondary">WebM</Badge>
            <Badge variant="secondary">YouTube URLs</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoUpload;
```

### Example 3: Processing Status Dashboard Component

```typescript
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Volume2
} from "lucide-react";

interface VideoItem {
  id: string;
  title: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  duration?: number;
  uploadedAt: Date;
  completedAt?: Date;
}

interface ProcessingDashboardProps {
  videos: VideoItem[];
  className?: string;
}

const ProcessingDashboard = ({ videos, className }: ProcessingDashboardProps) => {
  const getStatusConfig = (status: VideoItem['status']) => {
    const configs = {
      uploading: {
        icon: Loader2,
        label: 'Uploading',
        color: 'blue',
        variant: 'secondary' as const,
        className: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
      },
      processing: {
        icon: Loader2,
        label: 'Processing',
        color: 'yellow',
        variant: 'secondary' as const,
        className: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800'
      },
      completed: {
        icon: CheckCircle,
        label: 'Completed',
        color: 'green',
        variant: 'default' as const,
        className: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
      },
      failed: {
        icon: XCircle,
        label: 'Failed',
        color: 'red',
        variant: 'destructive' as const,
        className: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
      }
    };

    return configs[status];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  const getStats = () => {
    const total = videos.length;
    const completed = videos.filter(v => v.status === 'completed').length;
    const processing = videos.filter(v => v.status === 'processing' || v.status === 'uploading').length;
    const failed = videos.filter(v => v.status === 'failed').length;

    return { total, completed, processing, failed };
  };

  const stats = getStats();

  return (
    <div className={cn("space-y-6", className)}>
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-md">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Videos</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <Loader2 className="w-4 h-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.processing}</p>
              <p className="text-sm text-muted-foreground">Processing</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.failed}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Videos List */}
      <Card>
        <CardHeader>
          <CardTitle>Video Processing Status</CardTitle>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No videos uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {videos.map((video) => {
                const statusConfig = getStatusConfig(video.status);
                const Icon = statusConfig.icon;

                return (
                  <div
                    key={video.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border",
                      "transition-colors duration-200",
                      video.status === 'completed' && "bg-muted/30",
                      video.status === 'failed' && "bg-destructive/5"
                    )}
                  >
                    <div className="flex-shrink-0">
                      <div className={cn(
                        "p-2 rounded-full border",
                        statusConfig.className,
                        video.status === 'processing' && "animate-pulse"
                      )}>
                        <Icon className={cn(
                          "w-4 h-4",
                          video.status === 'processing' && "animate-spin"
                        )} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium truncate">{video.title}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(video.uploadedAt)}
                            </span>
                            {video.duration && (
                              <span className="flex items-center gap-1">
                                <Volume2 className="w-3 h-3" />
                                {formatDuration(video.duration)}
                              </span>
                            )}
                          </div>
                        </div>

                        <Badge
                          variant={statusConfig.variant}
                          className="flex-shrink-0"
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>

                      {video.progress !== undefined && video.status === 'processing' && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Processing progress</span>
                            <span>{video.progress}%</span>
                          </div>
                          <Progress value={video.progress} className="h-2" />
                        </div>
                      )}

                      {video.error && (
                        <div className={cn(
                          "flex items-center gap-2 p-2 rounded-md text-xs",
                          "bg-destructive/10 text-destructive border border-destructive/20"
                        )}>
                          <XCircle className="w-3 h-3" />
                          {video.error}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {video.status === 'processing' && (
                        <Button variant="ghost" size="sm">
                          <Pause className="w-4 h-4" />
                        </Button>
                      )}

                      {video.status === 'failed' && (
                        <Button variant="ghost" size="sm">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}

                      {video.status === 'completed' && (
                        <Button variant="default" size="sm">
                          <Play className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessingDashboard;
```

## Reference Files

- [📋 STYLES.md](../../../STYLES.md) - Complete design system documentation and styling guidelines
- [🎨 CSS Custom Properties Reference](./references/css-custom-properties.md) - Comprehensive CSS token reference
- [🧩 Component Patterns](./references/component-patterns.md) - Shadcn component composition patterns
- [♿ Accessibility Guidelines](./references/accessibility.md) - WCAG 2.1 AA compliance guide
- [📱 Responsive Design](./references/responsive-design.md) - Mobile-first responsive patterns

## Scripts

- [🔍 CSS Properties Validator](./scripts/validate-css-properties.sh) - Validate CSS custom properties usage
- [✅ Theme Compliance Checker](./scripts/check-theme-compliance.sh) - Check design system compliance
- [🔧 Component Generator](./scripts/generate-component.sh) - Generate compliant components
- [📊 Design System Auditor](./scripts/audit-design-system.sh) - Comprehensive design system audit

## Assets

- [🎨 Component Templates](./assets/component-templates/) - Pre-built component templates
- [🎯 Theme Configurations](./assets/theme-configs/) - Theme configuration files
- [🛠️ Style Validation Tools](./assets/validation-tools/) - Style validation utilities

## ServerlessBase Design Differentiation

This client (port 48080) shares Shadcn/UI with the main ServerlessBase app (port 38291). To maintain distinct identity:

### Same (Keep Consistent)
- CSS custom properties and color tokens
- Typography scale and fonts
- Border radius and shadow system
- Accessibility patterns

### Different (MUST Differentiate)
- Navigation layout structure (use env var `VITE_NAV_LAYOUT`)
- View modes for lists (use env var `VITE_DEFAULT_VIEW_MODE`)
- Action button patterns (inline buttons, not dropdowns)

### Layout Configuration
Always check `client/src/config/layout.ts` for the configured layout mode:

```typescript
import { layoutConfig } from '@/config/layout';

// Navigation: 'original' | 'top-nav' | 'left-rail' | 'right-sidebar' | 'tabs'
console.log(layoutConfig.navLayout); // 'top-nav' by default

// View mode: 'grid' | 'table' | 'list' | 'compact-cards'
console.log(layoutConfig.defaultViewMode); // 'table' by default
```

### Available Components

**Layouts** (`@/components/layouts`):
- `TopNavLayout` - Horizontal top navigation bar
- `LeftRailLayout` - Minimal vertical rail on left
- `RightSidebarLayout` - Sidebar on right side
- `TabsLayout` - Tab-based navigation
- `LayoutSelector` - Dynamic layout switcher

**Views** (`@/components/views`):
- `TableView` - Table with sortable columns and inline actions
- `ListView` - Vertical list with inline actions
- `CompactCardsView` - Dense card grid with inline actions
- `ViewModeSelector` - Toggle between view modes

## Troubleshooting

**Problem**: Component doesn't respect dark mode
**Solution**:
- Ensure you're using semantic color tokens (`var(--primary)`, `var(--card)`, etc.)
- Avoid hardcoded colors or manual dark mode handling
- Check that CSS custom properties are properly defined in your theme

**Problem**: CSS custom properties not working
**Solution**:
- Verify the CSS custom property exists in your theme configuration
- Check for typos in property names (`var(--space-6)` not `var(--spacing-6)`)
- Ensure the property is used on the correct element (some properties inherit)

**Problem**: Component styling looks inconsistent
**Solution**:
- Use the `cn` utility for class composition
- Follow the component composition patterns from the reference docs
- Validate your implementation with the theme compliance checker

**Problem**: Accessibility issues with interactive elements
**Solution**:
- Ensure proper focus management with `focus:ring-2 focus:ring-ring`
- Add appropriate ARIA labels and roles
- Test with screen readers and keyboard navigation
- Follow the accessibility guidelines in the reference documentation

**Problem**: Responsive design not working properly
**Solution**:
- Use mobile-first approach (start with mobile styles, then enhance)
- Check Tailwind responsive breakpoint usage
- Test on actual devices, not just browser resizing
- Follow responsive design patterns from the reference docs

## Brand Kit Section Components

Brand Kit Pro Max section components (`client/src/components/dashboard/branding/brand-kit-sections/`) MUST follow Uncodixify rules:

- Use `<Card>` with `shadow-sm` only (never `shadow-md`, `shadow-lg`)
- Border radius: `rounded-lg` max for cards, `rounded-md` for buttons
- No `hover:-translate-y-*`, no `hover:scale-*`, no `animate-bounce`
- See `.claude/rules/uncodixify-ui.md` for the full banned-patterns table.

---

**Remember**: This skill enforces enterprise-grade design system standards. Always validate your implementation before committing changes, and never compromise on CSS custom properties usage or accessibility compliance.