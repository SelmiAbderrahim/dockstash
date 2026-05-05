# ServerlessBase Component Patterns

## RTL-Safe Component Templates

### Status Badge

```typescript
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

type Status = "running" | "stopped" | "error" | "deploying" | "building";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { icon: React.ComponentType; label: string; className: string }> = {
  running: {
    icon: CheckCircle,
    label: "Running",
    className: "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
  },
  stopped: {
    icon: XCircle,
    label: "Stopped",
    className: "bg-muted text-muted-foreground border-border",
  },
  error: {
    icon: XCircle,
    label: "Error",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  deploying: {
    icon: Loader2,
    label: "Deploying",
    className: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  },
  building: {
    icon: Loader2,
    label: "Building",
    className: "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === "deploying" || status === "building";

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 ps-2 pe-3", config.className, className)}
    >
      <Icon className={cn("h-3 w-3", isAnimated && "animate-spin")} />
      {config.label}
    </Badge>
  );
}
```

### Resource Card

```typescript
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LucideIcon } from "lucide-react";

interface ResourceCardProps {
  icon: LucideIcon;
  title: string;
  value: number;
  max: number;
  unit?: string;
  formatValue?: (value: number) => string;
  className?: string;
}

export function ResourceCard({
  icon: Icon,
  title,
  value,
  max,
  unit = "%",
  formatValue,
  className,
}: ResourceCardProps) {
  const percentage = (value / max) * 100;
  const displayValue = formatValue ? formatValue(value) : `${value.toFixed(1)}${unit}`;

  const getColor = (pct: number) => {
    if (pct > 90) return "text-destructive";
    if (pct > 75) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted rounded-md">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn("text-2xl font-bold", getColor(percentage))}>
            {displayValue}
          </p>
        </div>
      </div>
      <Progress value={percentage} className="mt-3 h-1.5" />
    </Card>
  );
}
```

### Action Button Group

```typescript
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Play, Square, RotateCcw, Rocket, Trash2 } from "lucide-react";

interface ActionButtonGroupProps {
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onDeploy?: () => void;
  onDelete?: () => void;
  isStarting?: boolean;
  isStopping?: boolean;
  isRestarting?: boolean;
  isDeploying?: boolean;
  isDeleting?: boolean;
  status?: "running" | "stopped" | "error";
  className?: string;
}

export function ActionButtonGroup({
  onStart,
  onStop,
  onRestart,
  onDeploy,
  onDelete,
  isStarting,
  isStopping,
  isRestarting,
  isDeploying,
  isDeleting,
  status,
  className,
}: ActionButtonGroupProps) {
  const isLoading = isStarting || isStopping || isRestarting || isDeploying || isDeleting;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {onStart && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onStart}
                disabled={isLoading || status === "running"}
                className="h-[44px] min-w-[44px]"
              >
                <Play className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start</TooltipContent>
          </Tooltip>
        )}

        {onStop && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onStop}
                disabled={isLoading || status === "stopped"}
                className="h-[44px] min-w-[44px]"
              >
                <Square className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop</TooltipContent>
          </Tooltip>
        )}

        {onRestart && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRestart}
                disabled={isLoading}
                className="h-[44px] min-w-[44px]"
              >
                <RotateCcw className={cn("h-4 w-4", isRestarting && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restart</TooltipContent>
          </Tooltip>
        )}

        {onDeploy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onDeploy}
                disabled={isLoading}
                className="h-[44px]"
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="h-4 w-4 me-1 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 me-1" />
                    Deploy
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Trigger Deployment</TooltipContent>
          </Tooltip>
        )}

        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={isLoading}
                className="h-[44px] min-w-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
```

### Empty State

```typescript
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12", className)}>
      <div className="flex justify-center mb-4">
        <div className="p-4 bg-muted rounded-full">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
```

### Confirmation Dialog

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  isLoading,
}: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## RTL Compliance Checklist

- [ ] All margin/padding use logical properties (ms-, me-, ps-, pe-)
- [ ] All positioning uses start/end instead of left/right
- [ ] Text alignment uses text-start/text-end
- [ ] Flex spacing uses gap-* instead of space-x-*
- [ ] Border radius is symmetric or uses logical properties
- [ ] Icons with directional meaning are flipped for RTL

## Mobile-First Breakpoints

```typescript
// Base styles apply to mobile (< 640px)
// sm: >= 640px
// md: >= 768px
// lg: >= 1024px
// xl: >= 1280px
// 2xl: >= 1536px

// Example: 1 column on mobile, 2 on tablet, 3 on desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
```

## Touch Target Guidelines

All interactive elements must have minimum 44x44px touch targets:

```typescript
// Button with proper touch target
<Button className="h-[44px] min-w-[44px]">

// Icon button with proper touch target
<Button variant="ghost" size="icon" className="h-[44px] w-[44px]">

// Link with proper touch target
<a className="inline-flex items-center h-[44px] px-4">
```
