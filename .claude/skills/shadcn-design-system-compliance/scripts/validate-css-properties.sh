#!/bin/bash

# CSS Custom Properties Validation Script
# Validates CSS custom properties usage in React components
# Part of Shadcn Design System Compliance skill

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PATTERNS_DIR="$SCRIPT_DIR/../patterns"

# Counter for issues
ISSUES_FOUND=0

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
    ((ISSUES_FOUND++))
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [PATH]

CSS Custom Properties Validation Script for Shadcn Design System

OPTIONS:
    -h, --help          Show this help message
    -v, --verbose       Enable verbose output
    -f, --fix           Attempt to fix common issues (experimental)
    -o, --output FILE   Save report to file
    --dry-run           Show what would be checked without running validation

EXAMPLES:
    $0 src/components/VideoCard.tsx
    $0 --verbose src/components/
    $0 --output report.txt src/
    $0 --dry-run

VALIDATION RULES:
    1. No hardcoded colors (use CSS custom properties)
    2. No hardcoded spacing (use var(--space-*) tokens)
    3. No hardcoded border radius (use var(--radius-*) tokens)
    4. No hardcoded shadows (use var(--shadow-*) tokens)
    5. Use semantic color tokens (primary, secondary, muted, etc.)
    6. Use the 'cn' utility for class composition

EOF
}

# Parse command line arguments
VERBOSE=false
FIX_MODE=false
OUTPUT_FILE=""
DRY_RUN=false
TARGET_PATH=""

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
        -f|--fix)
            FIX_MODE=true
            shift
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
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
            TARGET_PATH="$1"
            shift
            ;;
    esac
done

# Set default path if none provided
if [[ -z "$TARGET_PATH" ]]; then
    TARGET_PATH="$PROJECT_ROOT/client/src"
fi

# Convert relative path to absolute
if [[ ! "$TARGET_PATH" = /* ]]; then
    TARGET_PATH="$(pwd)/$TARGET_PATH"
fi

# Output function
output() {
    if [[ -n "$OUTPUT_FILE" ]]; then
        echo "$1" >> "$OUTPUT_FILE"
    fi
    echo "$1"
}

# Check if file exists
check_file_exists() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        print_error "File not found: $file"
        return 1
    fi
    return 0
}

# Check if file is a React component
is_react_component() {
    local file="$1"
    [[ "$file" =~ \.(tsx|jsx|ts|js)$ ]] && [[ ! "$file" =~ \.test\. ]] && [[ ! "$file" =~ \.stories\. ]]
}

# Validate CSS custom properties usage
validate_css_properties() {
    local file="$1"
    local filename=$(basename "$file")

    print_status "Validating: $filename"

    # Initialize file-specific counters
    local file_issues=0

    # Check for hardcoded colors in various formats
    local color_patterns=(
        -e "color:\s*#[0-9a-fA-F]{3,6}"      # hex colors
        -e "color:\s*rgb\("                  # rgb colors
        -e "color:\s*rgba\("                 # rgba colors
        -e "background:\s*#[0-9a-fA-F]{3,6}" # background hex
        -e "background:\s*rgb\("             # background rgb
        -e "background:\s*rgba\("            # background rgba
        -e "border:\s*#[0-9a-fA-F]{3,6}"     # border colors
        -e "border-color:\s*#[0-9a-fA-F]{3,6}" # border-color
        -e "border:\s*rgb\("                 # border rgb
        -e "backgroundColor:\s*#[0-9a-fA-F]{3,6}" # inline style backgroundColor
        -e "backgroundColor:\s*rgb\("        # inline style backgroundColor rgb
    )

    for pattern in "${color_patterns[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            local matches=$(grep -n "$pattern" "$file" 2>/dev/null)
            print_error "Hardcoded colors found in $filename:"
            output "ISSUE: Hardcoded colors in $filename"
            output "$matches"
            output ""
            ((file_issues++))
        fi
    done

    # Check for hardcoded spacing values
    local spacing_patterns=(
        -e "padding:\s*[0-9]+px"            # padding in px
        -e "margin:\s*[0-9]+px"             # margin in px
        -e "gap:\s*[0-9]+px"                # gap in px
        -e "padding:\s*[0-9]+rem"           # padding in rem without CSS custom property
        -e "margin:\s*[0-9]+rem"            # margin in rem without CSS custom property
        -e "gap:\s*[0-9]+rem"               # gap in rem without CSS custom property
        -e "padding:\s*[0-9]+em"            # padding in em
        -e "margin:\s*[0-9]+em"             # margin in em
    )

    for pattern in "${spacing_patterns[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            local matches=$(grep -n "$pattern" "$file" 2>/dev/null)
            print_error "Hardcoded spacing found in $filename:"
            output "ISSUE: Hardcoded spacing in $filename"
            output "$matches"
            output ""
            ((file_issues++))
        fi
    done

    # Check for hardcoded border radius
    local radius_patterns=(
        -e "borderRadius:\s*[0-9]+px"       # borderRadius in px
        -e "border-radius:\s*[0-9]+px"      # border-radius in px
        -e "borderRadius:\s*[0-9]+rem"      # borderRadius in rem
        -e "border-radius:\s*[0-9]+rem"     # border-radius in rem
    )

    for pattern in "${radius_patterns[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            local matches=$(grep -n "$pattern" "$file" 2>/dev/null)
            print_error "Hardcoded border radius found in $filename:"
            output "ISSUE: Hardcoded border radius in $filename"
            output "$matches"
            output ""
            ((file_issues++))
        fi
    done

    # Check for hardcoded shadows
    local shadow_patterns=(
        -e "boxShadow:\s*rgba?"              # boxShadow with rgba/rgb
        -e "box-shadow:\s*rgba?"            # box-shadow with rgba/rgb
        -e "boxShadow:\s*0\s+[0-9]"         # boxShadow with numeric values
        -e "box-shadow:\s*0\s+[0-9]"        # box-shadow with numeric values
    )

    for pattern in "${shadow_patterns[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            local matches=$(grep -n "$pattern" "$file" 2>/dev/null)
            print_error "Hardcoded shadows found in $filename:"
            output "ISSUE: Hardcoded shadows in $filename"
            output "$matches"
            output ""
            ((file_issues++))
        fi
    done

    # Check for missing 'cn' utility usage (for TypeScript/JSX files)
    if [[ "$file" =~ \.(tsx|jsx)$ ]]; then
        if grep -q "className.*=" "$file" && ! grep -q "import.*cn.*from" "$file"; then
            print_warning "Potential missing 'cn' utility import in $filename"
            output "WARNING: Consider using 'cn' utility for class composition in $filename"
            output "Import: import { cn } from \"@/lib/utils\";"
            output ""
        fi
    fi

    # Check for proper CSS custom property usage
    if ! grep -q "var(--" "$file" 2>/dev/null; then
        if grep -q "className\|style" "$file" 2>/dev/null; then
            print_warning "No CSS custom properties (var(--)) found in $filename"
            output "WARNING: Consider using CSS custom properties in $filename"
            output "Example: var(--primary), var(--space-6), var(--radius-lg)"
            output ""
        fi
    fi

    # Check for semantic color tokens
    local bad_color_tokens=(
        "blue-"
        "red-"
        "green-"
        "yellow-"
        "gray-"
        "slate-"
        "zinc-"
        "neutral-"
        "stone-"
    )

    for token in "${bad_color_tokens[@]}"; do
        if grep -q "$token[0-9]" "$file" 2>/dev/null; then
            local matches=$(grep -n "$token[0-9]" "$file" 2>/dev/null | grep -v "var(--" || true)
            if [[ -n "$matches" ]]; then
                print_warning "Non-semantic color tokens found in $filename:"
                output "WARNING: Non-semantic color tokens in $filename"
                output "$matches"
                output "Consider using semantic tokens: primary, secondary, muted, destructive"
                output ""
            fi
        fi
    done

    # Report results for this file
    if [[ $file_issues -eq 0 ]]; then
        print_success "No CSS custom properties issues found in $filename"
        if [[ "$VERBOSE" == true ]]; then
            output "PASS: No issues found in $filename"
        fi
    else
        print_error "$file_issues CSS custom properties issues found in $filename"
    fi

    return $file_issues
}

# Attempt to fix common issues (experimental)
fix_css_properties() {
    local file="$1"
    local filename=$(basename "$file")

    print_status "Attempting to fix issues in $filename..."

    # Create backup
    cp "$file" "$file.backup"

    # Fix common hardcoded colors (basic replacements)
    sed -i.tmp 's/color: "#000000"/color: var(--foreground)/g' "$file"
    sed -i.tmp 's/color: "#ffffff"/color: var(--background)/g' "$file"
    sed -i.tmp 's/color: "black"/color: var(--foreground)/g' "$file"
    sed -i.tmp 's/color: "white"/color: var(--background)/g' "$file"

    # Fix hardcoded spacing
    sed -i.tmp 's/padding: "16px"/padding: var(--space-4)/g' "$file"
    sed -i.tmp 's/padding: "24px"/padding: var(--space-6)/g' "$file"
    sed -i.tmp 's/padding: "8px"/padding: var(--space-2)/g' "$file"
    sed -i.tmp 's/margin: "16px"/margin: var(--space-4)/g' "$file"
    sed -i.tmp 's/margin: "24px"/margin: var(--space-6)/g' "$file"
    sed -i.tmp 's/margin: "8px"/margin: var(--space-2)/g' "$file"

    # Fix hardcoded border radius
    sed -i.tmp 's/borderRadius: "8px"/borderRadius: var(--radius-md)/g' "$file"
    sed -i.tmp 's/borderRadius: "12px"/borderRadius: var(--radius-lg)/g' "$file"
    sed -i.tmp 's/borderRadius: "4px"/borderRadius: var(--radius)/g' "$file'

    # Remove temporary files
    rm -f "$file.tmp"

    print_status "Fix attempts completed for $filename. Review changes manually."
}

# Main validation function
run_validation() {
    local target="$1"
    local files_processed=0
    local files_with_issues=0

    output "CSS Custom Properties Validation Report"
    output "===================================="
    output "Target: $target"
    output "Date: $(date)"
    output ""

    if [[ -d "$target" ]]; then
        # Process directory recursively
        print_status "Scanning directory: $target"

        # Find all React components
        while IFS= read -r -d '' file; do
            if is_react_component "$file"; then
                ((files_processed++))
                validate_css_properties "$file"
                if [[ $? -gt 0 ]]; then
                    ((files_with_issues++))
                fi

                # Attempt to fix if fix mode is enabled
                if [[ "$FIX_MODE" == true ]]; then
                    fix_css_properties "$file"
                fi
            fi
        done < <(find "$target" -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) -print0)

    elif [[ -f "$target" ]]; then
        # Process single file
        if is_react_component "$target"; then
            ((files_processed++))
            validate_css_properties "$target"
            if [[ $? -gt 0 ]]; then
                ((files_with_issues++))
            fi

            # Attempt to fix if fix mode is enabled
            if [[ "$FIX_MODE" == true ]]; then
                fix_css_properties "$target"
            fi
        else
            print_error "Not a React component: $target"
            exit 1
        fi
    else
        print_error "Target not found: $target"
        exit 1
    fi

    # Generate summary
    output ""
    output "Validation Summary"
    output "=================="
    output "Files processed: $files_processed"
    output "Files with issues: $files_with_issues"
    output "Total issues found: $ISSUES_FOUND"

    if [[ $ISSUES_FOUND -eq 0 ]]; then
        output ""
        print_success "All CSS custom properties validation checks passed! ✓"
        output "Result: PASS"
        return 0
    else
        output ""
        print_error "CSS custom properties validation failed with $ISSUES_FOUND issues ✗"
        output "Result: FAIL"
        output ""
        output "Recommendations:"
        output "1. Use CSS custom properties instead of hardcoded values"
        output "2. Use semantic color tokens (primary, secondary, muted, etc.)"
        output "3. Use spacing tokens (var(--space-*))"
        output "4. Use radius tokens (var(--radius-*))"
        output "5. Use shadow tokens (var(--shadow-*))"
        output "6. Use the 'cn' utility for class composition"
        output ""
        output "For reference, see: $SCRIPT_DIR/../references/css-custom-properties.md"
        return 1
    fi
}

# Main execution
main() {
    # Check if dry run
    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN: Would validate CSS custom properties in: $TARGET_PATH"
        exit 0
    fi

    # Initialize output file if specified
    if [[ -n "$OUTPUT_FILE" ]]; then
        > "$OUTPUT_FILE" # Clear file
    fi

    # Check if target exists
    if [[ ! -e "$TARGET_PATH" ]]; then
        print_error "Target not found: $TARGET_PATH"
        show_usage
        exit 1
    fi

    # Run validation
    print_status "Starting CSS Custom Properties validation..."
    run_validation "$TARGET_PATH"
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        print_success "CSS Custom Properties validation completed successfully"
    else
        print_error "CSS Custom Properties validation failed"
    fi

    if [[ -n "$OUTPUT_FILE" ]]; then
        print_status "Report saved to: $OUTPUT_FILE"
    fi

    exit $exit_code
}

# Run main function
main "$@"