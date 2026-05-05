# Shadcn Component Patterns

This document provides comprehensive patterns and best practices for composing components using Shadcn/ui primitives in the iReadYouTube project.

## Core Principles

### 1. Composition Over Inheritance
Build complex components by composing Shadcn primitives rather than creating custom implementations from scratch.

### 2. CSS Custom Properties Only
Never use hardcoded values. Always use CSS custom properties for styling.

### 3. Semantic Color Usage
Use semantic color tokens (`primary`, `secondary`, `muted`, `destructive`) rather than color names.

### 4. Dark Mode First
All components must support dark mode automatically without manual handling.

## Component Structure Patterns

### Base Component Template
```typescript
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ComponentProps {
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}

const Component = forwardRef<HTMLDivElement, ComponentProps>(
  ({ variant = "default", size = "md", className, children, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    };

    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center",
          "font-medium transition-colors duration-200",
          "rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",

          // Variant and size styles
          variants[variant],
          sizes[size],

          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Component.displayName = "Component";

export default Component;
```

## Specific Component Patterns

### 1. Card Components

#### Basic Card
```typescript
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const VideoCard = ({ video, variant = "default", className }: VideoCardProps) => {
  return (
    <Card className={cn(
      "group transition-colors duration-150",
      "hover:bg-muted/50",
      variant === "featured" && "ring-1 ring-primary",
      className
    )}>
      <CardHeader className="pb-4">
        <div className="aspect-video bg-muted rounded-md mb-4" />

        <div className="space-y-2">
          <CardTitle className="line-clamp-2 text-lg">
            {video.title}
          </CardTitle>
          <CardDescription className="line-clamp-3">
            {video.description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatDuration(video.duration)}</span>
          <span>{formatDate(video.createdAt)}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-4">
        <Button variant="outline" className="w-full">
          <Play className="w-4 h-4 me-2" />
          Watch Video
        </Button>
      </CardFooter>
    </Card>
  );
};
```

#### Card Grid Layout
```typescript
const VideoGrid = ({ videos, columns = 3 }: VideoGridProps) => {
  const gridClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn(
      "grid gap-6",
      gridClasses[columns]
    )}>
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
};
```

### 2. Button Components

#### Action Button with Loading State
```typescript
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const ActionButton = ({
  children,
  loading,
  icon,
  variant = "default",
  size = "md",
  ...props
}: ActionButtonProps) => {
  const Icon = icon;

  return (
    <Button
      variant={variant}
      size={size}
      disabled={loading || props.disabled}
      className="relative"
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 me-2 animate-spin" />
          {children}
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 me-2" />}
          {children}
        </>
      )}
    </Button>
  );
};
```

#### Button Group
```typescript
const ButtonGroup = ({
  children,
  orientation = "horizontal",
  className
}: ButtonGroupProps) => {
  const orientationClasses = {
    horizontal: "flex flex-row",
    vertical: "flex flex-col",
  };

  return (
    <div className={cn(
      orientationClasses[orientation],
      "inline-flex",
      // Add separators between buttons
      "[&>*:not(:first-child):not(:last-child)]:rounded-none",
      "[&>*:first-child:not(:only-child)]:rounded-r-none",
      "[&>*:last-child:not(:only-child)]:rounded-l-none",
      "[&>*+*]:-ml-px",
      className
    )}>
      {children}
    </div>
  );
};

// Usage
<ButtonGroup>
  <Button variant="outline">Previous</Button>
  <Button>Next</Button>
</ButtonGroup>
```

### 3. Form Components

#### Form Field with Validation
```typescript
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const FormFieldComponent = ({ control, name, label, description, placeholder, type = "text", required = false }: FormFieldProps) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel className={cn("text-sm font-medium", required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
            {label}
          </FormLabel>

          <FormControl>
            {type === "textarea" ? (
              <Textarea
                placeholder={placeholder}
                className="resize-none"
                {...field}
              />
            ) : (
              <Input
                type={type}
                placeholder={placeholder}
                {...field}
              />
            )}
          </FormControl>

          {description && (
            <FormDescription className="text-xs text-muted-foreground">
              {description}
            </FormDescription>
          )}

          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
};
```

#### Form Layout Pattern
```typescript
const FormLayout = ({ children, title, description, actions }: FormLayoutProps) => {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>

      <form className="space-y-6">
        <CardContent className="space-y-4">
          {children}
        </CardContent>

        {actions && (
          <CardFooter className="flex justify-end gap-3 pt-6">
            {actions}
          </CardFooter>
        )}
      </form>
    </Card>
  );
};

// Usage
<FormLayout
  title="Upload Video"
  description="Add a new video to your library"
  actions={
    <>
      <Button variant="outline" type="button">Cancel</Button>
      <Button type="submit">Upload Video</Button>
    </>
  }
>
  <FormFieldComponent name="title" label="Title" placeholder="Enter video title" required />
  <FormFieldComponent name="description" label="Description" type="textarea" placeholder="Enter video description" />
</FormLayout>
```

### 4. List Components

#### List with Status Badges
```typescript
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const VideoListItem = ({ video, onEdit, onDelete }: VideoListItemProps) => {
  const getStatusConfig = (status: string) => {
    const configs = {
      completed: { label: "Completed", variant: "default" as const },
      processing: { label: "Processing", variant: "secondary" as const },
      failed: { label: "Failed", variant: "destructive" as const },
    };
    return configs[status] || configs.completed;
  };

  const statusConfig = getStatusConfig(video.status);

  return (
    <div className="flex items-center gap-4 p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
      <div className="aspect-video w-24 bg-muted rounded-md flex-shrink-0" />

      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="font-medium truncate">{video.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {video.description}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDuration(video.duration)}</span>
          <span>•</span>
          <span>{formatDate(video.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={statusConfig.variant}>
          {statusConfig.label}
        </Badge>

        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(video)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(video)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
```

#### Virtual List (for large datasets)
```typescript
import { ScrollArea } from "@/components/ui/scroll-area";

const VirtualList = ({ items, renderItem, itemHeight = 80, containerHeight = 400 }: VirtualListProps) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(visibleStart + Math.ceil(containerHeight / itemHeight) + 1, items.length);

  const visibleItems = items.slice(visibleStart, visibleEnd);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;

  return (
    <ScrollArea
      className="h-full"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={visibleStart + index} style={{ height: itemHeight }}>
              {renderItem(item, visibleStart + index)}
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};
```

### 5. Modal/Dialog Components

#### Confirmation Dialog
```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ConfirmDialog = ({
  title,
  description,
  onConfirm,
  trigger,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default"
}: ConfirmDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <DialogClose asChild>
            <Button variant="outline">{cancelText}</Button>
          </DialogClose>

          <Button
            variant={variant}
            onClick={onConfirm}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Usage
<ConfirmDialog
  title="Delete Video"
  description="Are you sure you want to delete this video? This action cannot be undone."
  onConfirm={() => deleteVideo(video.id)}
  confirmText="Delete"
  variant="destructive"
  trigger={
    <Button variant="ghost" size="sm">
      <Trash2 className="w-4 h-4" />
    </Button>
  }
/>
```

### 6. Navigation Components

#### Breadcrumb Navigation
```typescript
import { ChevronRight, Home } from "lucide-react";

const Breadcrumb = ({ items }: BreadcrumbProps) => {
  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      <Button variant="ghost" size="sm" className="h-auto p-1">
        <Home className="w-4 h-4" />
      </Button>

      {items.map((item, index) => (
        <div key={item.href} className="flex items-center space-x-1">
          <ChevronRight className="w-4 h-4" />
          {index === items.length - 1 ? (
            <span className="text-foreground font-medium">{item.label}</span>
          ) : (
            <Button variant="ghost" size="sm" className="h-auto p-1">
              {item.label}
            </Button>
          )}
        </div>
      ))}
    </nav>
  );
};
```

#### Tab Navigation
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TabContainer = ({ tabs, defaultValue }: TabContainerProps) => {
  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
            {tab.icon && <tab.icon className="w-4 h-4" />}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
};

// Usage
const VideoTabs = ({ video }) => {
  const tabs = [
    {
      value: "transcript",
      label: "Transcript",
      icon: FileText,
      content: <TranscriptViewer transcript={video.transcript} />
    },
    {
      value: "details",
      label: "Details",
      icon: Info,
      content: <VideoDetails video={video} />
    },
    {
      value: "settings",
      label: "Settings",
      icon: Settings,
      content: <VideoSettings videoId={video.id} />
    },
  ];

  return <TabContainer tabs={tabs} defaultValue="transcript" />;
};
```

### 7. Status and Feedback Components

#### Status Indicator
```typescript
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

const StatusIndicator = ({ status, size = "sm", showLabel = true }: StatusIndicatorProps) => {
  const getStatusConfig = (status: string) => {
    const configs = {
      success: {
        icon: CheckCircle,
        label: "Success",
        className: "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
        variant: "default" as const,
      },
      error: {
        icon: XCircle,
        label: "Error",
        className: "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
        variant: "destructive" as const,
      },
      warning: {
        icon: AlertCircle,
        label: "Warning",
        className: "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
        variant: "secondary" as const,
      },
      loading: {
        icon: Loader2,
        label: "Loading",
        className: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
        variant: "secondary" as const,
      },
      pending: {
        icon: Clock,
        label: "Pending",
        className: "bg-gray-50 text-gray-900 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800",
        variant: "secondary" as const,
      },
    };

    return configs[status] || configs.pending;
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1.5 font-medium border",
        config.className,
        sizeClasses[size],
      )}
    >
      <Icon className={cn(iconSizes[size], status === "loading" && "animate-spin")} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
};
```

#### Progress Indicator
```typescript
import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";

const ProgressIndicator = ({
  current,
  total,
  showPercentage = true,
  showSteps = false,
  steps
}: ProgressIndicatorProps) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {showSteps && steps ? `Step ${current} of ${total}` : `Progress`}
        </span>
        {showPercentage && (
          <span className="font-medium">{Math.round(percentage)}%</span>
        )}
      </div>

      <Progress value={percentage} className="h-2" />

      {showSteps && steps && (
        <div className="flex justify-between text-xs text-muted-foreground">
          {steps.map((step, index) => (
            <div
              key={step}
              className={cn(
                "flex items-center gap-1",
                index < current && "text-foreground font-medium"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                index < current
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground text-muted-foreground"
              )}>
                {index < current && <Check className="w-2 h-2" />}
              </div>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Accessibility Patterns

### Accessible Form Controls
```typescript
const AccessibleFormField = ({
  label,
  error,
  description,
  required,
  children
}: AccessibleFormFieldProps) => {
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

      {React.cloneElement(children, {
        id: fieldId,
        "aria-describedby": cn(
          description && descriptionId,
          error && errorId
        ),
        "aria-invalid": !!error,
        "aria-required": required,
        className: cn(
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          children.props.className
        )
      })}

      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

### Keyboard Navigation
```typescript
const KeyboardNavigableList = ({ items, onSelect }: KeyboardNavigableListProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(items[selectedIndex]);
        break;
      case "Escape":
        e.preventDefault();
        // Handle escape if needed
        break;
    }
  };

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      selectedItem?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      className="border rounded-md divide-y"
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-activedescendant={`item-${selectedIndex}`}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          id={`item-${index}`}
          role="option"
          aria-selected={index === selectedIndex}
          className={cn(
            "p-3 cursor-pointer transition-colors",
            index === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "hover:bg-muted"
          )}
          onClick={() => onSelect(item)}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};
```

## Utility Patterns

### Conditional Classes
```typescript
const ConditionalClasses = ({
  condition,
  trueClass,
  falseClass = "",
  children
}: ConditionalClassesProps) => {
  return (
    <div className={cn(condition ? trueClass : falseClass)}>
      {children}
    </div>
  );
};

// Usage
<ConditionalClasses
  condition={isLoading}
  trueClass="opacity-50 pointer-events-none"
>
  <Button>Click me</Button>
</ConditionalClasses>
```

### Responsive Visibility
```typescript
const ResponsiveVisibility = ({
  children,
  show = { mobile: true, tablet: true, desktop: true }
}: ResponsiveVisibilityProps) => {
  const visibilityClasses = cn(
    show.mobile || "hidden sm:block",
    show.tablet || "hidden md:block",
    show.desktop || "hidden lg:block"
  );

  return <div className={visibilityClasses}>{children}</div>;
};
```

## Best Practices Checklist

### Component Design
- [ ] Use `forwardRef` for DOM components
- [ ] Implement proper TypeScript interfaces
- [ ] Support variant and size props
- [ ] Provide accessible defaults
- [ ] Include loading and error states

### Styling
- [ ] Use `cn` utility for class composition
- [ ] Only use CSS custom properties
- [ ] Support dark mode automatically
- [ ] Include proper hover and focus states
- [ ] Use semantic color tokens

### Accessibility
- [ ] Implement proper ARIA attributes
- [ ] Support keyboard navigation
- [ ] Include screen reader labels
- [ ] Maintain focus management
- [ ] Provide sufficient color contrast

### Performance
- [ ] Avoid unnecessary re-renders
- [ ] Use memo for expensive operations
- [ ] Implement virtual scrolling for large lists
- [ ] Optimize bundle size
- [ ] Use lazy loading where appropriate

These patterns ensure consistent, accessible, and maintainable components that integrate seamlessly with the Shadcn/ui design system.