#!/bin/bash

# Theme Compliance Checker Script
# Checks Shadcn theme compliance for React components
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

print_info() {
    echo -e "${CYAN}[NOTE]${NC} $1"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [PATH]

Shadcn Theme Compliance Checker for Design System Validation

OPTIONS:
    -h, --help          Show this help message
    -v, --verbose       Enable verbose output
    -c, --component     Check specific component name
    -t, --theme PATH    Path to theme definition file (default: STYLES.md)
    -o, --output FILE   Save report to file
    --json              Output results in JSON format
    --dry-run           Show what would be checked without running validation

COMPONENT CATEGORIES:
    cards              Check card component compliance
    forms              Check form component compliance
    buttons            Check button component compliance
    navigation         Check navigation component compliance
    video              Check video-specific component compliance
    transcript         Check transcript viewer compliance
    all                Check all components (default)

EXAMPLES:
    $0 src/components/VideoCard.tsx
    $0 --component cards
    $0 --verbose src/components/
    $0 --json --output report.json src/
    $0 --dry-run

THEME COMPLIANCE RULES:
    1. Dark mode support (automatic CSS custom properties)
    2. Semantic color usage (primary, secondary, muted, destructive)
    3. Consistent spacing with var(--space-*) tokens
    4. Proper border radius with var(--radius-*) tokens
    5. Consistent shadows with var(--shadow-*) tokens
    6. Typography compliance (ABeeZee and Abhaya Libre fonts)
    7. Component variant patterns
    8. Focus management and accessibility
    9. Mobile-first responsive design
    10. Animation and transition consistency

EOF
}

# Parse command line arguments
VERBOSE=false
COMPONENT_NAME=""
THEME_FILE="$PROJECT_ROOT/STYLES.md"
OUTPUT_FILE=""
JSON_OUTPUT=false
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
        -c|--component)
            COMPONENT_NAME="$2"
            shift 2
            ;;
        -t|--theme)
            THEME_FILE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --json)
            JSON_OUTPUT=true
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
            TARGET_PATH="$1"
            shift
            ;;
    esac
done

# JSON output initialization
init_json_output() {
    if [[ "$JSON_OUTPUT" == true ]]; then
        cat > "$OUTPUT_FILE" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "target": "$TARGET_PATH",
  "themeFile": "$THEME_FILE",
  "results": {
    "filesChecked": 0,
    "issuesFound": 0,
    "categories": {}
  }
}
EOF
    fi
}

# Update JSON output
update_json_output() {
    local file="$1"
    local category="$2"
    local issues="$3"
    local warnings="$4"

    if [[ "$JSON_OUTPUT" == true ]]; then
        # Create temporary file for JSON manipulation
        local temp_json=$(mktemp)

        # Use jq to update JSON (if jq is available)
        if command -v jq >/dev/null 2>&1; then
            jq --arg file "$file" \
               --arg category "$category" \
               --argjson issues "$issues" \
               --argjson warnings "$warnings" \
               '.results.filesChecked += 1 |
                .results.issuesFound += ($issues + $warnings) |
                .results.categories[$category] += [
                  {
                    "file": $file,
                    "issues": $issues,
                    "warnings": $warnings
                  }
                ]' "$OUTPUT_FILE" > "$temp_json"

            mv "$temp_json" "$OUTPUT_FILE"
        fi
    fi
}

# Output function
output() {
    if [[ -n "$OUTPUT_FILE" && "$JSON_OUTPUT" != true ]]; then
        echo "$1" >> "$OUTPUT_FILE"
    fi

    if [[ "$JSON_OUTPUT" != true ]]; then
        echo "$1"
    fi
}

# Check if theme file exists
check_theme_file() {
    if [[ ! -f "$THEME_FILE" ]]; then
        print_warning "Theme file not found: $THEME_FILE"
        print_info "Using default theme compliance rules"
        return 1
    fi
    return 0
}

# Check dark mode compliance
check_dark_mode() {
    local file="$1"
    local filename=$(basename "$file")
    local dark_mode_issues=0

    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking dark mode compliance for: $filename"
    fi

    # Check for CSS custom properties usage (indicates dark mode support)
    if ! grep -q "var(--" "$file" 2>/dev/null; then
        if grep -q "className\|style" "$file" 2>/dev/null; then
            print_error "No CSS custom properties found - may not support dark mode in $filename"
            output "ISSUE: Missing CSS custom properties for dark mode support"
            ((dark_mode_issues++))
        fi
    fi

    # Check for hardcoded background colors
    if grep -q "background.*#[0-9a-fA-F]" "$file" 2>/dev/null; then
        print_error "Hardcoded background colors found - dark mode issue in $filename"
        output "ISSUE: Hardcoded background colors prevent dark mode support"
        ((dark_mode_issues++))
    fi

    # Check for hardcoded text colors
    if grep -q "color.*#[0-9a-fA-F]" "$file" 2>/dev/null; then
        print_error "Hardcoded text colors found - dark mode issue in $filename"
        output "ISSUE: Hardcoded text colors prevent dark mode support"
        ((dark_mode_issues++))
    fi

    # Check for manual dark mode handling (should use automatic CSS custom properties)
    if grep -q "dark:" "$file" 2>/dev/null; then
        if ! grep -q "var(--" "$file" 2>/dev/null; then
            print_warning "Manual dark mode handling detected in $filename"
            output "WARNING: Consider using CSS custom properties for automatic dark mode"
        fi
    fi

    return $dark_mode_issues
}

# Check semantic color compliance
check_semantic_colors() {
    local file="$1"
    local filename=$(basename "$file")
    local color_issues=0

    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking semantic color compliance for: $filename"
    fi

    # Check for non-semantic color classes
    local non_semantic_patterns=(
        "bg-red-"
        "bg-blue-"
        "bg-green-"
        "bg-yellow-"
        "bg-purple-"
        "bg-pink-"
        "bg-indigo-"
        "bg-gray-"
        "bg-slate-"
        "bg-zinc-"
        "bg-neutral-"
        "bg-stone-"
        "text-red-"
        "text-blue-"
        "text-green-"
        "text-yellow-"
        "text-purple-"
        "text-pink-"
        "text-indigo-"
        "text-gray-"
        "text-slate-"
        "text-zinc-"
        "text-neutral-"
        "text-stone-"
        "border-red-"
        "border-blue-"
        "border-green-"
        "border-yellow-"
        "border-gray-"
        "border-slate-"
        "border-zinc-"
        "border-neutral-"
        "border-stone-"
    )

    for pattern in "${non_semantic_patterns[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            local matches=$(grep -n "$pattern" "$file" 2>/dev/null)
            print_error "Non-semantic color usage found in $filename: $pattern"
            output "ISSUE: Non-semantic color '$pattern' - use semantic tokens instead"
            if [[ "$VERBOSE" == true ]]; then
                output "$matches"
            fi
            ((color_issues++))
        fi
    done

    # Check for semantic color usage (good patterns)
    local semantic_patterns=(
        "bg-primary"
        "bg-secondary"
        "bg-muted"
        "bg-accent"
        "bg-destructive"
        "bg-card"
        "bg-background"
        "text-primary"
        "text-secondary"
        "text-muted"
        "text-accent"
        "text-destructive"
        "text-card-foreground"
        "text-foreground"
        "border-primary"
        "border-secondary"
        "border-border"
        "border-destructive"
        "ring-primary"
    )

    local semantic_found=false
    for pattern in "${semantic_patterns[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            semantic_found=true
            break
        fi
    done

    if [[ "$semantic_found" == false ]] && grep -q "className\|style" "$file" 2>/dev/null; then
        print_warning "No semantic color tokens found in $filename"
        output "WARNING: Consider using semantic color tokens (primary, secondary, muted, etc.)"
    fi

    return $color_issues
}

# Check spacing compliance
check_spacing() {
    local file="$1"
    local filename=$(basename "$file")
    local spacing_issues=0

    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking spacing compliance for: $filename"
    fi

    # Check for hardcoded spacing values
    local hardcoded_patterns=(
        "p-[0-9]"
        "px-[0-9]"
        "py-[0-9]"
        "pt-[0-9]"
        "pb-[0-9]"
        "pl-[0-9]"
        "pr-[0-9]"
        "m-[0-9]"
        "mx-[0-9]"
        "my-[0-9]"
        "mt-[0-9]"
        "mb-[0-9]"
        "ml-[0-9]"
        "mr-[0-9]"
        "gap-[0-9]"
    )

    for pattern in "${hardcoded_patterns[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            local matches=$(grep -n "$pattern" "$file" 2>/dev/null)
            print_error "Hardcoded spacing found in $filename: $pattern"
            output "ISSUE: Use var(--space-*) tokens instead of hardcoded spacing"
            if [[ "$VERBOSE" == true ]]; then
                output "$matches"
            fi
            ((spacing_issues++))
        fi
    done

    # Check for correct spacing token usage
    local spacing_tokens=(
        "space-0"
        "space-1"
        "space-2"
        "space-3"
        "space-4"
        "space-5"
        "space-6"
        "space-8"
        "space-10"
        "space-12"
        "space-16"
        "space-20"
        "space-24"
        "p-0"
        "p-1"
        "p-2"
        "p-3"
        "p-4"
        "p-5"
        "p-6"
        "p-8"
        "p-10"
        "p-12"
        "p-16"
        "p-20"
        "p-24"
        "m-0"
        "m-1"
        "m-2"
        "m-3"
        "m-4"
        "m-5"
        "m-6"
        "m-8"
        "m-10"
        "m-12"
        "m-16"
        "m-20"
        "m-24"
    )

    local spacing_tokens_found=false
    for token in "${spacing_tokens[@]}"; do
        if grep -q "$token" "$file" 2>/dev/null; then
            spacing_tokens_found=true
            break
        fi
    done

    if [[ "$spacing_tokens_found" == false ]] && grep -q "className\|style" "$file" 2>/dev/null; then
        print_warning "No standard spacing tokens found in $filename"
        output "WARNING: Consider using standard spacing tokens (space-*, p-*, m-*)"
    fi

    return $spacing_issues
}

# Check typography compliance
check_typography() {
    local file="$1"
    local filename=$(basename "$file")
    local typography_issues=0

    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking typography compliance for: $filename"
    fi

    # Check for non-standard font sizes
    local non_standard_fonts=(
        "text-xs"
        "text-sm"
        "text-base"
        "text-lg"
        "text-xl"
        "text-2xl"
        "text-3xl"
        "text-4xl"
        "text-5xl"
        "text-6xl"
    )

    local standard_font_found=false
    for font in "${non_standard_fonts[@]}"; do
        if grep -q "$font" "$file" 2>/dev/null; then
            standard_font_found=true
            break
        fi
    done

    if [[ "$standard_font_found" == false ]] && grep -q "className" "$file" 2>/dev/null; then
        print_warning "No standard font sizes found in $filename"
        output "WARNING: Consider using standard font sizes (text-xs through text-6xl)"
    fi

    # Check for font weight usage
    local font_weights=(
        "font-thin"
        "font-light"
        "font-normal"
        "font-medium"
        "font-semibold"
        "font-bold"
        "font-extrabold"
        "font-black"
    )

    local font_weight_found=false
    for weight in "${font_weights[@]}"; do
        if grep -q "$weight" "$file" 2>/dev/null; then
            font_weight_found=true
            break
        fi
    done

    # Check for line height usage
    local line_heights=(
        "leading-none"
        "leading-tight"
        "leading-snug"
        "leading-normal"
        "leading-relaxed"
        "leading-loose"
    )

    local line_height_found=false
    for height in "${line_heights[@]}"; do
        if grep -q "$height" "$file" 2>/dev/null; then
            line_height_found=true
            break
        fi
    done

    return $typography_issues
}

# Check border radius compliance
check_border_radius() {
    local file="$1"
    local filename=$(basename "$file")
    local radius_issues=0

    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking border radius compliance for: $filename"
    fi

    # Check for hardcoded border radius
    if grep -q "rounded-\[" "$file" 2>/dev/null; then
        local matches=$(grep -n "rounded-\[" "$file" 2>/dev/null)
        print_error "Hardcoded border radius found in $filename"
        output "ISSUE: Use standard radius tokens instead of arbitrary values"
        if [[ "$VERBOSE" == true ]]; then
            output "$matches"
        fi
        ((radius_issues++))
    fi

    # Check for standard radius tokens usage
    local radius_tokens=(
        "rounded-none"
        "rounded-sm"
        "rounded"
        "rounded-md"
        "rounded-lg"
        "rounded-xl"
        "rounded-2xl"
        "rounded-3xl"
        "rounded-full"
    )

    local radius_token_found=false
    for token in "${radius_tokens[@]}"; do
        if grep -q "$token" "$file" 2>/dev/null; then
            radius_token_found=true
            break
        fi
    done

    return $radius_issues
}

# Check shadow compliance
check_shadows() {
    local file="$1"
    local filename=$(basename "$file")
    local shadow_issues=0

    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking shadow compliance for: $filename"
    fi

    # Check for standard shadow tokens usage
    local shadow_tokens=(
        "shadow-none"
        "shadow-sm"
        "shadow"
        "shadow-md"
        "shadow-lg"
        "shadow-xl"
        "shadow-2xl"
        "shadow-inner"
    )

    local shadow_token_found=false
    for token in "${shadow_tokens[@]}"; do
        if grep -q "$token" "$file" 2>/dev/null; then
            shadow_token_found=true
            break
        fi
    done

    # Check for custom shadows (should use shadow tokens)
    if grep -q "drop-shadow\|shadow-\[" "$file" 2>/dev/null; then
        print_warning "Custom shadow usage found in $filename"
        output "WARNING: Consider using standard shadow tokens (shadow, shadow-md, shadow-lg, etc.)"
    fi

    return $shadow_issues
}

# Check component specific compliance
check_component_specific() {
    local file="$1"
    local filename=$(basename "$file")
    local component_issues=0

    if [[ "$VERBOSE" == true ]]; then
        print_status "Checking component-specific compliance for: $filename"
    fi

    # Video component checks
    if [[ "$filename" =~ [Vv]ideo ]]; then
        # Check for aspect ratio handling
        if ! grep -q "aspect-" "$file" 2>/dev/null && ! grep -q "aspectRatio\|aspect-ratio" "$file" 2>/dev/null; then
            print_warning "Video component missing aspect ratio handling in $filename"
            output "WARNING: Consider adding aspect ratio for video components"
        fi

        # Check for responsive video sizing
        if ! grep -q "w-full\|max-w-" "$file" 2>/dev/null; then
            print_warning "Video component may not be responsive in $filename"
            output "WARNING: Ensure video components are responsive"
        fi
    fi

    # Form component checks
    if [[ "$filename" =~ [Ff]orm|[Ii]nput|[Bb]utton|[Ss]elect|[Tt]extarea ]]; then
        # Check for focus management
        if ! grep -q "focus:" "$file" 2>/dev/null; then
            print_warning "Form component missing focus styles in $filename"
            output "WARNING: Add focus styles for form components"
        fi

        # Check for accessible labels
        if ! grep -q "aria-\|htmlFor\|htmlfor\|label" "$file" 2>/dev/null; then
            print_warning "Form component may be missing accessibility labels in $filename"
            output "WARNING: Ensure form components have proper labels"
        fi
    fi

    # Card component checks
    if [[ "$filename" =~ [Cc]ard ]]; then
        # Check for proper card structure
        if ! grep -q "Card\|card" "$file" 2>/dev/null; then
            print_warning "Card component may not follow standard structure in $filename"
            output "WARNING: Consider using standard Card components"
        fi

        # Check for hover states
        if ! grep -q "hover:" "$file" 2>/dev/null; then
            print_warning "Card component missing hover states in $filename"
            output "WARNING: Add hover states for better UX"
        fi
    fi

    # Navigation component checks
    if [[ "$filename" =~ [Nn]av|[Hh]eader|[Mm]enu ]]; then
        # Check for responsive navigation
        if ! grep -q "md:\|sm:\|lg:" "$file" 2>/dev/null; then
            print_warning "Navigation may not be responsive in $filename"
            output "WARNING: Ensure navigation is responsive"
        fi

        # Check for keyboard navigation
        if ! grep -q "onKeyDown\|keyDown\|tabIndex\|tabindex" "$file" 2>/dev/null; then
            print_warning "Navigation may not support keyboard navigation in $filename"
            output "WARNING: Add keyboard navigation support"
        fi
    fi

    return $component_issues
}

# Validate component theme compliance
validate_component() {
    local file="$1"
    local filename=$(basename "$file")
    local total_issues=0

    print_status "Validating theme compliance: $filename"

    # Run all compliance checks
    check_dark_mode "$file"
    ((total_issues += $?))

    check_semantic_colors "$file"
    ((total_issues += $?))

    check_spacing "$file"
    ((total_issues += $?))

    check_typography "$file"
    ((total_issues += $?))

    check_border_radius "$file"
    ((total_issues += $?))

    check_shadows "$file"
    ((total_issues += $?))

    check_component_specific "$file"
    ((total_issues += $?))

    # Update JSON output
    update_json_output "$filename" "theme_compliance" "$total_issues" "0"

    # Report results
    if [[ $total_issues -eq 0 ]]; then
        print_success "Theme compliance check passed for $filename"
        output "PASS: $filename"
    else
        print_error "$total_issues theme compliance issues found in $filename"
        output "FAIL: $filename ($total_issues issues)"
    fi

    return $total_issues
}

# Main validation function
run_validation() {
    local target="$1"
    local files_processed=0
    local files_with_issues=0

    output "Shadcn Theme Compliance Report"
    output "==============================="
    output "Target: $target"
    output "Theme file: $THEME_FILE"
    output "Date: $(date)"
    output ""

    # Check theme file
    if check_theme_file; then
        print_status "Using theme file: $THEME_FILE"
    fi

    if [[ -d "$target" ]]; then
        # Process directory
        print_status "Scanning directory: $target"

        # Find all React components
        while IFS= read -r -d '' file; do
            if [[ "$file" =~ \.(tsx|jsx|ts|js)$ ]] && [[ ! "$file" =~ \.test\. ]] && [[ ! "$file" =~ \.stories\. ]]; then
                ((files_processed++))

                validate_component "$file"
                if [[ $? -gt 0 ]]; then
                    ((files_with_issues++))
                fi
            fi
        done < <(find "$target" -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) -print0)

    elif [[ -f "$target" ]]; then
        # Process single file
        if [[ "$target" =~ \.(tsx|jsx|ts|js)$ ]]; then
            ((files_processed++))

            validate_component "$target"
            if [[ $? -gt 0 ]]; then
                ((files_with_issues++))
            fi
        else
            print_error "Not a valid component file: $target"
            exit 1
        fi
    else
        print_error "Target not found: $target"
        exit 1
    fi

    # Generate summary
    output ""
    output "Theme Compliance Summary"
    output "========================"
    output "Files processed: $files_processed"
    output "Files with issues: $files_with_issues"
    output "Total issues found: $ISSUES_FOUND"

    if [[ $ISSUES_FOUND -eq 0 ]]; then
        output ""
        print_success "All theme compliance checks passed! ✓"
        output "Result: PASS"
        return 0
    else
        output ""
        print_error "Theme compliance check failed with $ISSUES_FOUND issues ✗"
        output "Result: FAIL"
        output ""
        output "Recommendations:"
        output "1. Use CSS custom properties for dark mode support"
        output "2. Use semantic color tokens (primary, secondary, muted, etc.)"
        output "3. Use standard spacing tokens (space-*, p-*, m-*)"
        output "4. Use standard border radius tokens (rounded-*)"
        output "5. Use standard shadow tokens (shadow-*)"
        output "6. Ensure responsive design with breakpoint prefixes"
        output "7. Add proper focus management and accessibility"
        output "8. Include hover and interaction states"
        output ""
        output "For reference, see: $SCRIPT_DIR/../references/"
        return 1
    fi
}

# Main execution
main() {
    # Check if dry run
    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN: Would check theme compliance for: $TARGET_PATH"
        exit 0
    fi

    # Initialize JSON output if needed
    if [[ "$JSON_OUTPUT" == true && -n "$OUTPUT_FILE" ]]; then
        init_json_output
    fi

    # Initialize output file if specified
    if [[ -n "$OUTPUT_FILE" && "$JSON_OUTPUT" != true ]]; then
        > "$OUTPUT_FILE" # Clear file
    fi

    # Check if target exists
    if [[ ! -e "$TARGET_PATH" ]]; then
        print_error "Target not found: $TARGET_PATH"
        show_usage
        exit 1
    fi

    # Run validation
    print_status "Starting theme compliance check..."
    run_validation "$TARGET_PATH"
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        print_success "Theme compliance check completed successfully"
    else
        print_error "Theme compliance check failed"
    fi

    if [[ -n "$OUTPUT_FILE" ]]; then
        print_status "Report saved to: $OUTPUT_FILE"
    fi

    exit $exit_code
}

# Run main function
main "$@"