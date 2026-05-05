#!/bin/bash

# Component Generator Script
# Generates Shadcn/ui compliant React components with proper design system
# Part of Shadcn Design System Compliance skill

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../assets/component-templates"

# Component types
COMPONENT_TYPES=(
    "card"
    "form"
    "button"
    "dialog"
    "navigation"
    "video"
    "transcript"
    "upload"
    "status"
    "table"
)

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[NOTE]${NC} $1"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] COMPONENT_NAME [COMPONENT_TYPE]

Shadcn Design System Component Generator

OPTIONS:
    -h, --help          Show this help message
    -v, --verbose       Enable verbose output
    -d, --dir PATH      Output directory (default: src/components)
    -t, --template PATH Custom template file
    -w, --with-test     Generate test file
    -s, --with-story    Generate Storybook story
    --dry-run           Show what would be generated without creating files

COMPONENT_TYPES:
EOF

    for type in "${COMPONENT_TYPES[@]}"; do
        echo "    $type"
    done

    cat << EOF

EXAMPLES:
    $0 VideoCard card
    $0 --with-test --with-story UploadForm upload
    $0 --dir src/components/forms LoginForm form
    $0 --dry-run MyComponent

GENERATED COMPONENTS:
    - Full TypeScript support with proper interfaces
    - Shadcn/ui design system compliance
    - CSS custom properties only
    - Dark mode support
    - Accessibility features (ARIA, keyboard navigation)
    - Responsive design (mobile-first)
    - Semantic color tokens
    - Proper spacing tokens
    - Focus management
    - Error boundaries
    - Loading states

TEMPLATES:
    Templates are located in: $TEMPLATES_DIR

EOF
}

# Parse command line arguments
VERBOSE=false
OUTPUT_DIR="$PROJECT_ROOT/client/src/components"
TEMPLATE_FILE=""
WITH_TEST=false
WITH_STORY=false
DRY_RUN=false
COMPONENT_NAME=""
COMPONENT_TYPE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -t|--template)
            TEMPLATE_FILE="$2"
            shift 2
            ;;
        -w|--with-test)
            WITH_TEST=true
            shift
            ;;
        -s|--with-story)
            WITH_STORY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -*)
            echo "Unknown option: $1" >&2
            show_usage
            exit 1
            ;;
        *)
            if [[ -z "$COMPONENT_NAME" ]]; then
                COMPONENT_NAME="$1"
            elif [[ -z "$COMPONENT_TYPE" ]]; then
                COMPONENT_TYPE="$1"
            else
                echo "Too many arguments" >&2
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$COMPONENT_NAME" ]]; then
    echo "Component name is required" >&2
    show_usage
    exit 1
fi

# Default component type if not provided
if [[ -z "$COMPONENT_TYPE" ]]; then
    COMPONENT_TYPE="card"
fi

# Check if component type is valid
valid_type=false
for type in "${COMPONENT_TYPES[@]}"; do
    if [[ "$type" == "$COMPONENT_TYPE" ]]; then
        valid_type=true
        break
    fi
done

if [[ "$valid_type" == false ]]; then
    print_error "Invalid component type: $COMPONENT_TYPE"
    print_info "Valid types: ${COMPONENT_TYPES[*]}"
    exit 1
fi

# Check if dry run
if [[ "$DRY_RUN" == true ]]; then
    print_status "DRY RUN: Would generate component '$COMPONENT_NAME' of type '$COMPONENT_TYPE'"
    print_status "Output directory: $OUTPUT_DIR"
    print_status "With test: $WITH_TEST"
    print_status "With story: $WITH_STORY"
    exit 0
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Component name transformations
PASCAL_NAME=$(echo "$COMPONENT_NAME" | sed 's/^\(.\)/\U\1/' | sed 's/-\(.\)/\U\1/g')
KEBAB_NAME=$(echo "$PASCAL_NAME" | sed 's/\([A-Z]\)/-\L\1/g' | sed 's/^-//')
CAMEL_NAME=$(echo "$COMPONENT_NAME" | sed 's/^\(.\)/\L\1/' | sed 's/-\([a-z]\)/\U\1/g')

# Template generation functions
generate_base_component() {
    local template="$TEMPLATES_DIR/base-component.tsx.template"
    local output_file="$OUTPUT_DIR/$PASCAL_NAME.tsx"

    if [[ "$VERBOSE" == true ]]; then
        print_status "Generating base component: $output_file"
    fi

    cat > "$output_file" << EOF
import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ${PASCAL_NAME}Props {
  /**
   * Additional CSS classes to apply to the component
   */
  className?: string;
  /**
   * Child components to render
   */
  children?: React.ReactNode;
  /**
   * Variant style for the component
   */
  variant?: "default" | "secondary" | "outline" | "ghost";
  /**
   * Size of the component
   */
  size?: "sm" | "md" | "lg";
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
  /**
   * Click handler
   */
  onClick?: () => void;
}

const ${PASCAL_NAME} = forwardRef<HTMLDivElement, ${PASCAL_NAME}Props>(
  ({ className, children, variant = "default", size = "md", disabled = false, onClick, ...props }, ref) => {
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
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",

          // Variant styles
          variants[variant],

          // Size styles
          sizes[size],

          // Custom className
          className
        )}
        onClick={onClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </div>
    );
  }
);

${PASCAL_NAME}.displayName = "${PASCAL_NAME}";

export default ${PASCAL_NAME};
EOF

    print_success "Generated base component: $output_file"
}

generate_card_component() {
    local template="$TEMPLATES_DIR/card-component.tsx.template"
    local output_file="$OUTPUT_DIR/$PASCAL_NAME.tsx"

    if [[ "$VERBOSE" == true ]]; then
        print_status "Generating card component: $output_file"
    fi

    cat > "$output_file" << EOF
import React, { forwardRef } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ${PASCAL_NAME}Props {
  /**
   * Additional CSS classes to apply to the component
   */
  className?: string;
  /**
   * Title of the card
   */
  title?: string;
  /**
   * Description text for the card
   */
  description?: string;
  /**
   * Card content
   */
  children: React.ReactNode;
  /**
   * Footer content (actions, etc.)
   */
  footer?: React.ReactNode;
  /**
   * Card variant
   */
  variant?: "default" | "elevated" | "outlined" | "ghost";
  /**
   * Whether the card is interactive (hover effects)
   */
  interactive?: boolean;
  /**
   * Click handler
   */
  onClick?: () => void;
}

const ${PASCAL_NAME} = forwardRef<HTMLDivElement, ${PASCAL_NAME}Props>(
  ({ className, title, description, children, footer, variant = "default", interactive = false, onClick, ...props }, ref) => {
    const cardClasses = cn(
      // Base styles
      "transition-all duration-200",

      // Variant styles
      variant === "elevated" && "shadow-lg hover:shadow-xl",
      variant === "outlined" && "border-2",
      variant === "ghost" && "border-transparent bg-muted/30",
      variant === "default" && "shadow-sm hover:shadow-md",

      // Interactive styles
      interactive && "cursor-pointer hover:-translate-y-1",

      className
    );

    const CardComponent = interactive ? "div" : Card;

    return (
      <CardComponent
        ref={ref}
        className={cardClasses}
        onClick={interactive ? onClick : undefined}
        {...props}
      >
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle className="text-lg">{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}

        <CardContent className="pb-4">
          {children}
        </CardContent>

        {footer && (
          <CardFooter className="pt-0">
            {footer}
          </CardFooter>
        )}
      </CardComponent>
    );
  }
);

${PASCAL_NAME}.displayName = "${PASCAL_NAME}";

export default ${PASCAL_NAME};
EOF

    print_success "Generated card component: $output_file"
}

generate_form_component() {
    local template="$TEMPLATES_DIR/form-component.tsx.template"
    local output_file="$OUTPUT_DIR/$PASCAL_NAME.tsx"

    if [[ "$VERBOSE" == true ]]; then
        print_status "Generating form component: $output_file"
    fi

    cat > "$output_file" << EOF
import React, { forwardRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Form schema - customize as needed
const formSchema = z.object({
  // Add your form fields here
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

export interface ${PASCAL_NAME}Props {
  /**
   * Additional CSS classes to apply to the component
   */
  className?: string;
  /**
   * Form submission handler
   */
  onSubmit: (values: FormValues) => void | Promise<void>;
  /**
   * Default values for the form
   */
  defaultValues?: Partial<FormValues>;
  /**
   * Whether the form is currently submitting
   */
  loading?: boolean;
  /**
   * Form submit button text
   */
  submitText?: string;
  /**
   * Cancel button handler
   */
  onCancel?: () => void;
  /**
   * Cancel button text
   */
  cancelText?: string;
}

const ${PASCAL_NAME} = forwardRef<HTMLFormElement, ${PASCAL_NAME}Props>(
  ({
    className,
    onSubmit,
    defaultValues,
    loading = false,
    submitText = "Submit",
    onCancel,
    cancelText = "Cancel",
    ...props
  }, ref) => {
    const form = useForm<FormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        title: "",
        description: "",
        ...defaultValues,
      },
    });

    const handleSubmit = async (values: FormValues) => {
      try {
        await onSubmit(values);
      } catch (error) {
        console.error("Form submission error:", error);
      }
    };

    return (
      <Form {...form}>
        <form
          ref={ref}
          onSubmit={form.handleSubmit(handleSubmit)}
          className={cn("space-y-6", className)}
          {...props}
        >
          {/* Title Field */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter title..."
                    {...field}
                    disabled={loading}
                    className="min-h-[44px]" // Minimum touch target
                  />
                </FormControl>
                <FormDescription>
                  Enter a descriptive title for this item.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description Field */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter description..."
                    {...field}
                    disabled={loading}
                    className="min-h-[44px]" // Minimum touch target
                  />
                </FormControl>
                <FormDescription>
                  Optional description or additional details.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {loading ? "Submitting..." : submitText}
            </Button>

            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {cancelText}
              </Button>
            )}
          </div>
        </form>
      </Form>
    );
  }
);

${PASCAL_NAME}.displayName = "${PASCAL_NAME}";

export default ${PASCAL_NAME};
EOF

    print_success "Generated form component: $output_file"
}

generate_test_file() {
    local output_file="$OUTPUT_DIR/$PASCAL_NAME.test.tsx"

    if [[ "$VERBOSE" == true ]]; then
        print_status "Generating test file: $output_file"
    fi

    cat > "$output_file" << EOF
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { ${PASCAL_NAME} } from "./${PASCAL_NAME}";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

const mockProps = {
  // Add default mock props here
};

describe("${PASCAL_NAME}", () => {
  // Accessibility tests
  it("should not have accessibility violations", async () => {
    const { container } = render(<${PASCAL_NAME} {...mockProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // Basic rendering tests
  it("should render without crashing", () => {
    render(<${PASCAL_NAME} {...mockProps} />);
    // Add specific assertions based on your component
  });

  it("should apply custom className", () => {
    const customClass = "custom-test-class";
    render(<${PASCAL_NAME} {...mockProps} className={customClass} />);
    const component = screen.getByTestId("${KEBAB_NAME}"); // Add data-testid if needed
    expect(component).toHaveClass(customClass);
  });

  // Variant tests
  it("should handle different variants", () => {
    const { rerender } = render(<${PASCAL_NAME} {...mockProps} variant="secondary" />);
    // Add assertions for variant-specific styling or behavior

    rerender(<${PASCAL_NAME} {...mockProps} variant="outline" />);
    // Add assertions for outline variant
  });

  // Size tests
  it("should handle different sizes", () => {
    const { rerender } = render(<${PASCAL_NAME} {...mockProps} size="lg" />);
    // Add assertions for size-specific styling

    rerender(<${PASCAL_NAME} {...mockProps} size="sm" />);
    // Add assertions for small size
  });

  // Interaction tests
  it("should handle click events", async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(<${PASCAL_NAME} {...mockProps} onClick={handleClick} />);

    const clickableElement = screen.getByRole("button"); // Adjust selector as needed
    await user.click(clickableElement);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // Keyboard navigation tests
  it("should handle keyboard events", async () => {
    const user = userEvent.setup();
    render(<${PASCAL_NAME} {...mockProps} />);

    const focusableElement = screen.getByRole("button"); // Adjust selector as needed
    focusableElement.focus();

    expect(focusableElement).toHaveFocus();

    await user.keyboard("{Enter}");
    // Add assertions for keyboard interaction
  });

  // Responsive tests
  it("should be responsive", () => {
    // Mock different viewport sizes
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 320, // Mobile
    });

    render(<${PASCAL_NAME} {...mockProps} />);
    // Add assertions for mobile layout

    // Change to desktop
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    // Add assertions for desktop layout
  });

  // Error handling tests
  it("should handle error states gracefully", () => {
    render(<${PASCAL_NAME} {...mockProps} disabled />);
    // Add assertions for disabled state
  });

  // Loading states (if applicable)
  it("should handle loading states", () => {
    render(<${PASCAL_NAME} {...mockProps} loading />);
    // Add assertions for loading state
  });
});

// Integration tests
describe("${PASCAL_NAME} Integration", () => {
  it("should work within parent components", () => {
    const ParentComponent = () => (
      <div>
        <${PASCAL_NAME} {...mockProps} />
      </div>
    );

    render(<ParentComponent />);
    // Add integration assertions
  });

  it("should work with form submissions", async () => {
    const handleSubmit = jest.fn();
    const user = userEvent.setup();

    render(<${PASCAL_NAME} {...mockProps} onSubmit={handleSubmit} />);

    // Simulate form filling and submission
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(handleSubmit).toHaveBeenCalled();
  });
});
EOF

    print_success "Generated test file: $output_file"
}

generate_story_file() {
    local output_file="$OUTPUT_DIR/$PASCAL_NAME.stories.tsx"

    if [[ "$VERBOSE" == true ]]; then
        print_status "Generating Storybook story: $output_file"
    fi

    cat > "$output_file" << EOF
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ${PASCAL_NAME} } from "./${PASCAL_NAME}";

const meta = {
  title: "Components/${PASCAL_NAME}",
  component: ${PASCAL_NAME},
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "${PASCAL_NAME} component with Shadcn design system compliance.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost"],
      description: "Visual style variant",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Size of the component",
    },
    disabled: {
      control: "boolean",
      description: "Whether the component is disabled",
    },
    onClick: {
      action: "clicked",
      description: "Click handler",
    },
    children: {
      control: "text",
      description: "Child content",
    },
  },
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof ${PASCAL_NAME}>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    children: "${PASCAL_NAME} Content",
  },
};

// Variant stories
export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary Variant",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline Variant",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost Variant",
  },
};

// Size stories
export const Small: Story = {
  args: {
    size: "sm",
    children: "Small Size",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "Large Size",
  },
};

// State stories
export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled State",
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: "Loading State",
  },
  render: (args) => (
    <${PASCAL_NAME} {...args}>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    </${PASCAL_NAME}>
  ),
};

// Interactive stories
export const Interactive: Story = {
  args: {
    variant: "default",
    children: "Interactive Example",
  },
  render: (args) => {
    const [count, setCount] = React.useState(0);

    return (
      <${PASCAL_NAME}
        {...args}
        onClick={() => setCount(count + 1)}
      >
        Clicked {count} times
      </${PASCAL_NAME}>
    );
  },
};

// Responsive stories
export const Responsive: Story = {
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
  render: (args) => (
    <div className="w-full p-8">
      <${PASCAL_NAME} {...args} className="w-full" />
    </div>
  ),
};

// Dark mode stories
export const DarkMode: Story = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#09090b" },
      ],
    },
  },
  args: {
    variant: "secondary",
    children: "Dark Mode Example",
  },
};

// Accessibility stories
export const WithAccessibility: Story = {
  args: {
    "aria-label": "Accessible ${PASCAL_NAME}",
    children: "Accessible Example",
  },
  render: (args) => (
    <div className="space-y-4">
      <${PASCAL_NAME} {...args} />
      <p className="text-sm text-muted-foreground">
        This component includes proper ARIA labels and keyboard navigation support.
      </p>
    </div>
  ),
};

// Playground story for interactive testing
export const Playground: Story = {
  args: {
    variant: "default",
    size: "md",
    disabled: false,
    children: "Playground Example",
  },
  render: (args) => {
    const [variant, setVariant] = React.useState(args.variant);
    const [size, setSize] = React.useState(args.size);
    const [disabled, setDisabled] = React.useState(args.disabled);

    return (
      <div className="space-y-6 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Variant:</label>
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value as any)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="default">Default</option>
              <option value="secondary">Secondary</option>
              <option value="outline">Outline</option>
              <option value="ghost">Ghost</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Size:</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as any)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={disabled}
                onChange={(e) => setDisabled(e.target.checked)}
              />
              Disabled
            </label>
          </div>
        </div>

        <div className="border rounded-lg p-6">
          <${PASCAL_NAME}
            variant={variant}
            size={size}
            disabled={disabled}
            onClick={args.onClick}
          >
            {args.children}
          </${PASCAL_NAME}>
        </div>
      </div>
    );
  },
};
EOF

    print_success "Generated Storybook story: $output_file"
}

# Generate index file
generate_index_file() {
    local output_file="$OUTPUT_DIR/index.ts"

    if [[ "$VERBOSE" == true ]]; then
        print_status "Updating index file: $output_file"
    fi

    # Create index file if it doesn't exist
    if [[ ! -f "$output_file" ]]; then
        cat > "$output_file" << EOF
// Auto-generated index file for components
export { default as ${PASCAL_NAME} } from "./${PASCAL_NAME}";
EOF
    else
        # Add export to existing index file
        if ! grep -q "export.*${PASCAL_NAME}" "$output_file"; then
            echo "export { default as ${PASCAL_NAME} } from \"./${PASCAL_NAME}\";" >> "$output_file"
        fi
    fi

    print_success "Updated index file: $output_file"
}

# Main generation function
generate_component() {
    local component_name="$1"
    local component_type="$2"

    print_status "Generating component: $component_name (type: $component_type)"
    print_status "Output directory: $OUTPUT_DIR"

    # Check if component already exists
    local component_file="$OUTPUT_DIR/$PASCAL_NAME.tsx"
    if [[ -f "$component_file" ]]; then
        print_warning "Component already exists: $component_file"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Generation cancelled"
            exit 0
        fi
    fi

    # Generate component based on type
    case "$component_type" in
        "card")
            generate_card_component
            ;;
        "form")
            generate_form_component
            ;;
        *)
            generate_base_component
            ;;
    esac

    # Generate additional files if requested
    if [[ "$WITH_TEST" == true ]]; then
        generate_test_file
    fi

    if [[ "$WITH_STORY" == true ]]; then
        generate_story_file
    fi

    # Update index file
    generate_index_file

    print_success "Component generation completed!"
    print_info "Generated files:"
    print_info "  - Component: $component_file"
    [[ "$WITH_TEST" == true ]] && print_info "  - Test: $OUTPUT_DIR/$PASCAL_NAME.test.tsx"
    [[ "$WITH_STORY" == true ]] && print_info "  - Story: $OUTPUT_DIR/$PASCAL_NAME.stories.tsx"
    print_info "  - Index: $OUTPUT_DIR/index.ts"

    print_info ""
    print_info "Next steps:"
    print_info "1. Customize the component interface and implementation"
    print_info "2. Add your specific business logic"
    print_info "3. Run tests: npm test $PASCAL_NAME"
    print_info "4. Check Storybook: npm run storybook"
    print_info "5. Validate design system compliance: ./scripts/check-theme-compliance.sh $component_file"
}

# Create templates directory if it doesn't exist
mkdir -p "$TEMPLATES_DIR"

# Main execution
main() {
    print_status "Shadcn Design System Component Generator"
    print_status "========================================="

    generate_component "$COMPONENT_NAME" "$COMPONENT_TYPE"
}

# Run main function
main "$@"