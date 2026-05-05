# Responsive Design Guidelines

This document provides comprehensive responsive design guidelines for the ServerlessBase project using Tailwind CSS with a mobile-first approach.

## Mobile-First Design Philosophy

### Core Principles

1. **Start Mobile**: Design for mobile screens first, then enhance for larger screens
2. **Progressive Enhancement**: Add complexity and features as screen size increases
3. **Content Priority**: Most important content comes first on mobile
4. **Touch-Friendly**: Ensure all interactive elements are easily tappable

### Breakpoint System

```css
/* Tailwind CSS default breakpoints */
sm: 640px   /* Small tablets and large phones */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops */
xl: 1280px  /* Laptops and desktops */
2xl: 1536px /* Large desktops */
```

## Responsive Typography

### Fluid Typography Scale

```typescript
// Responsive typography using Tailwind responsive prefixes
const TypographyPatterns = {
  // Headings that scale with screen size
  h1: "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold",
  h2: "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold",
  h3: "text-lg sm:text-xl md:text-2xl lg:text-3xl font-medium",
  h4: "text-base sm:text-lg md:text-xl lg:text-2xl font-medium",

  // Body text
  bodyLarge: "text-sm sm:text-base md:text-lg",
  body: "text-sm md:text-base",
  bodySmall: "text-xs sm:text-sm",

  // UI elements
  caption: "text-xs sm:text-sm",
  label: "text-sm sm:text-base font-medium",
};

// Usage
const VideoTitle = ({ title }) => (
  <h1 className={TypographyPatterns.h1}>
    {title}
  </h1>
);
```

### Line Height and Spacing

```typescript
// Responsive line heights and spacing
const ResponsiveText = ({ children, variant = "body" }) => {
  const variants = {
    tight: "leading-tight sm:leading-normal md:leading-relaxed",
    normal: "leading-normal sm:leading-relaxed",
    loose: "leading-relaxed sm:leading-loose",
  };

  return (
    <p className={cn(variants[variant], "text-sm sm:text-base")}>
      {children}
    </p>
  );
};
```

## Layout Patterns

### Container Patterns

```typescript
// Responsive containers with consistent padding
const ResponsiveContainer = ({ children, className, size = "default" }) => {
  const sizes = {
    default: "container mx-auto px-4 sm:px-6 lg:px-8",
    narrow: "container mx-auto px-4 sm:px-6 max-w-4xl",
    wide: "container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12",
    full: "w-full px-4 sm:px-6 lg:px-8",
  };

  return (
    <div className={cn(sizes[size], className)}>
      {children}
    </div>
  );
};

// Usage examples
const AppLayout = ({ children }) => (
  <>
    <header>
      <ResponsiveContainer size="full">
        {/* Header content */}
      </ResponsiveContainer>
    </header>

    <main>
      <ResponsiveContainer>
        {children}
      </ResponsiveContainer>
    </main>
  </>
);
```

### Grid Systems

```typescript
// Responsive grid layouts for video galleries
const VideoGrid = ({ videos, columns = "responsive" }) => {
  const gridClasses = {
    responsive: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    compact: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    featured: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8",
  };

  return (
    <div className={cn(gridClasses[columns], "gap-4 sm:gap-6")}>
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
};

// For masonry-style layouts, use standard CSS Grid with auto-rows
// instead of CSS columns, which have limited browser support for gap handling.
// Prefer flat grid layouts over masonry for consistency.
```

### Flexbox Layouts

```typescript
// Responsive flexbox patterns
const FlexLayout = ({ children, direction = "row", align = "start" }) => {
  const directionClasses = {
    row: "flex-col sm:flex-row",
    "row-reverse": "flex-col-reverse sm:flex-row-reverse",
    col: "flex-col",
    "col-reverse": "flex-col-reverse",
  };

  const alignClasses = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
  };

  return (
    <div className={cn(
      "flex gap-4 sm:gap-6",
      directionClasses[direction],
      alignClasses[align]
    )}>
      {children}
    </div>
  );
};

// Usage: Sidebar layout that stacks on mobile
const VideoDetailLayout = ({ video, transcript, related }) => (
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
    <FlexLayout direction="col-reverse">
      <div className="flex-1">
        <TranscriptViewer transcript={transcript} />
      </div>

      <aside className="w-full lg:w-80 space-y-6">
        <VideoPlayer video={video} />
        <RelatedVideos videos={related} />
      </aside>
    </FlexLayout>
  </div>
);
```

## Component Patterns

### Responsive Cards

```typescript
const ResponsiveCard = ({ children, title, actions, className }: ResponsiveCardProps) => {
  return (
    <Card className={cn(
      "p-4 sm:p-6 lg:p-8",
      // Consistent shadow (no escalation)
      "shadow-sm",
      className
    )}>
      {title && (
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl lg:text-2xl">
            {title}
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className="space-y-4 sm:space-y-6">
        {children}
      </CardContent>

      {actions && (
        <CardFooter className="pt-4 sm:pt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
          {actions}
        </CardFooter>
      )}
    </Card>
  );
};
```

### Responsive Navigation

```typescript
const ResponsiveNavigation = ({ items }: ResponsiveNavigationProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-background border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-lg sm:text-xl font-bold">ServerlessBase</h1>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {items.map((item) => (
              <button
                key={item.href}
                className="text-sm lg:text-base text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col space-y-3">
              {items.map((item) => (
                <button
                  key={item.href}
                  className="text-left px-2 py-2 text-base text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
```

### Responsive Forms

```typescript
const ResponsiveForm = ({ children, actions, title }: ResponsiveFormProps) => {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <CardTitle className="text-xl sm:text-2xl lg:text-3xl">
          {title}
        </CardTitle>
      </CardHeader>

      <form className="px-4 sm:px-6 lg:px-8 pb-6 lg:pb-8">
        <div className="space-y-4 sm:space-y-6">
          {children}
        </div>

        {actions && (
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
            {actions}
          </div>
        )}
      </form>
    </Card>
  );
};

// Responsive form fields
const ResponsiveFormField = ({ label, children, description }: ResponsiveFormFieldProps) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm sm:text-base font-medium">
        {label}
      </Label>

      <div className="w-full">
        {React.cloneElement(children, {
          className: cn(
            "w-full px-3 py-2 sm:px-4 sm:py-3",
            "text-sm sm:text-base",
            "min-h-[44px]", // Minimum touch target
            children.props.className
          )
        })}
      </div>

      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
};
```

## Media-Specific Components

### Video Player Responsive Design

```typescript
const ResponsiveVideoPlayer = ({ video }: ResponsiveVideoPlayerProps) => {
  const aspectRatio = video.width && video.height
    ? video.height / video.width
    : 9 / 16; // Default 16:9

  return (
    <div className="w-full space-y-4">
      {/* Video container with responsive aspect ratio */}
      <div
        className="relative w-full bg-muted rounded-lg overflow-hidden shadow-lg"
        style={{ paddingBottom: `${aspectRatio * 100}%` }}
      >
        <video
          className="absolute inset-0 w-full h-full object-contain"
          controls
          preload="metadata"
        >
          <source src={video.url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Video controls and info */}
      <div className="px-2 sm:px-0">
        <h2 className="text-lg sm:text-xl font-semibold line-clamp-2">
          {video.title}
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
          <div className="text-sm text-muted-foreground">
            {formatViews(video.views)} • {formatDate(video.uploadDate)}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <ThumbsUp className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">{formatCount(video.likes)}</span>
            </Button>
            <Button variant="ghost" size="sm">
              <Share className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Transcript Viewer Responsive Design

```typescript
const ResponsiveTranscriptViewer = ({ segments }: ResponsiveTranscriptViewerProps) => {
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border bg-muted/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-semibold text-base sm:text-lg">Transcript</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" size="sm">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search - Mobile only */}
      <div className="px-4 py-3 sm:hidden border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transcript..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Transcript content */}
      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                "p-3 sm:p-4 rounded-lg border border-border/50",
                "hover:bg-muted/50 hover:border-border transition-colors cursor-pointer",
                "text-sm sm:text-base",
                currentTime >= segment.start && currentTime <= segment.end &&
                "bg-primary/5 border-primary/30"
              )}
              onClick={() => setCurrentTime(segment.start)}
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 text-xs sm:text-sm text-muted-foreground font-mono min-w-[50px]">
                  {formatTime(segment.start)}
                </span>
                <p className="flex-1 leading-relaxed">
                  {segment.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
```

## Touch and Interaction Design

### Touch Targets

```typescript
// Minimum 44×44px touch targets
const TouchTargetButton = ({ icon, label, ...props }) => {
  return (
    <button
      className={cn(
        "flex items-center justify-center",
        "min-h-[44px] min-w-[44px]",
        "p-3 rounded-md hover:bg-accent transition-colors",
        "focus-ring",
        props.className
      )}
      {...props}
    >
      {icon && <icon className="w-5 h-5" />}
      {label && <span className="ml-2">{label}</span>}
    </button>
  );
};

// Spaced touch targets to prevent accidental taps
const ButtonGroup = ({ children, spacing = "tight" }: ButtonGroupProps) => {
  const spacingClasses = {
    tight: "gap-1 sm:gap-2",
    normal: "gap-2 sm:gap-3",
    loose: "gap-3 sm:gap-4",
  };

  return (
    <div className={cn(
      "flex items-center",
      spacingClasses[spacing]
    )}>
      {children}
    </div>
  );
};
```

### Gesture Support

```typescript
// For swipeable/gesture interactions, use established libraries
// (e.g., @use-gesture/react) rather than custom touch handlers.
// Keep gesture logic simple and avoid over-engineering custom swipe components.
```

## Performance Optimization

### Responsive Images

```typescript
const ResponsiveImage = ({
  src,
  alt,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  className
}: ResponsiveImageProps) => {
  return (
    <picture>
      <source
        srcSet={`${src}?w=320 320w, ${src}?w=640 640w, ${src}?w=1024 1024w, ${src}?w=1536 1536w`}
        sizes={sizes}
        type="image/webp"
      />
      <img
        src={`${src}?w=1024`}
        srcSet={`${src}?w=320 320w, ${src}?w=640 640w, ${src}?w=1024 1024w, ${src}?w=1536 1536w`}
        sizes={sizes}
        alt={alt}
        loading="lazy"
        className={cn("w-full h-auto object-cover", className)}
      />
    </picture>
  );
};
```

### Responsive Video Thumbnails

```typescript
const ResponsiveVideoThumbnail = ({ video, onClick }: ResponsiveVideoThumbnailProps) => {
  return (
    <div className="relative group cursor-pointer rounded-lg overflow-hidden" onClick={onClick}>
      {/* Responsive image */}
      <div className="aspect-video bg-muted">
        <ResponsiveImage
          src={video.thumbnail}
          alt={video.title}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Play button overlay */}
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-primary/90 text-primary-foreground rounded-full p-3 sm:p-4">
          <Play className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
      </div>

      {/* Duration badge */}
      <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
        {formatDuration(video.duration)}
      </div>
    </div>
  );
};
```

## Testing Responsive Design

### Visual Regression Testing

```typescript
// Storybook responsive stories
const meta: Meta<typeof VideoCard> = {
  title: "Components/VideoCard",
  component: VideoCard,
  parameters: {
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: { width: "375px", height: "667px" },
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1024px", height: "768px" },
        },
      },
    },
  },
};

export const Default = {
  args: {
    video: mockVideo,
  },
};
```

### Accessibility Testing

```typescript
// Responsive accessibility tests
describe("ResponsiveVideoCard", () => {
  // Test mobile touch targets
  test("should have minimum 44px touch targets on mobile", () => {
    render(<VideoCard video={mockVideo} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach(button => {
      const styles = window.getComputedStyle(button);
      const height = parseInt(styles.height);
      const width = parseInt(styles.width);

      expect(height).toBeGreaterThanOrEqual(44);
      expect(width).toBeGreaterThanOrEqual(44);
    });
  });

  // Test responsive text resizing
  test("should maintain readability at 200% zoom", async () => {
    render(<VideoCard video={mockVideo} />);

    // Simulate 200% zoom
    document.documentElement.style.fontSize = "200%";

    const title = screen.getByText(mockVideo.title);
    const titleStyles = window.getComputedStyle(title);
    const titleHeight = parseInt(titleStyles.height);

    // Title should still be readable at 200% zoom
    expect(titleHeight).toBeGreaterThan(16); // Minimum readable height
  });
});
```

## Best Practices Checklist

### Mobile-First Development
- [ ] Design for mobile screens first
- [ ] Use progressive enhancement
- [ ] Prioritize content for mobile users
- [ ] Ensure touch targets are at least 44×44px

### Responsive Typography
- [ ] Use relative units (rem, em) for font sizes
- [ ] Scale typography appropriately across breakpoints
- [ ] Maintain adequate line heights for readability
- [ ] Test text resizing to 200%

### Layout and Spacing
- [ ] Use flexible grid systems
- [ ] Implement proper spacing that scales
- [ ] Consider content reflow on different screens
- [ ] Avoid horizontal scrolling on mobile

### Performance
- [ ] Optimize images for different screen sizes
- [ ] Use lazy loading for below-the-fold content
- [ ] Minimize JavaScript for mobile devices
- [ ] Test on actual devices, not just resized browsers

### Accessibility
- [ ] Ensure keyboard navigation works on all screen sizes
- [ ] Maintain sufficient contrast ratios
- [ ] Test with screen readers on mobile devices
- [ ] Consider touch and motor accessibility

### Testing
- [ ] Test on actual mobile devices
- [ ] Use browser dev tools for responsive testing
- [ ] Perform visual regression testing
- [ ] Test with different network conditions

By following these responsive design guidelines, you'll create interfaces that work seamlessly across all devices while maintaining accessibility and performance standards.