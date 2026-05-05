#!/bin/bash

# Design System Auditor Script
# Comprehensive audit of design system compliance across the project
# Part of Shadcn Design System Compliance skill

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLIENT_DIR="$PROJECT_ROOT/client"

# Audit counters
TOTAL_FILES=0
FILES_WITH_ISSUES=0
TOTAL_ISSUES=0
TOTAL_WARNINGS=0

# Print colored output
print_header() {
    echo -e "${MAGENTA}$1${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((TOTAL_WARNINGS++))
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TOTAL_ISSUES++))
}

print_info() {
    echo -e "${CYAN}[NOTE]${NC} $1"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [PATH]

Comprehensive Design System Audit for Shadcn/ui Implementation

OPTIONS:
    -h, --help              Show this help message
    -v, --verbose           Enable verbose output
    -f, --format FORMAT     Output format (text, json, markdown)
    -o, --output FILE       Save report to file
    -c, --category CAT      Audit specific category
    -q, --quiet             Minimal output (errors only)
    --dry-run               Show what would be audited without running
    --fix-minor             Attempt to fix minor issues automatically

AUDIT CATEGORIES:
    all                     Audit all categories (default)
    css-properties          CSS custom properties usage
    theme-compliance        Shadcn theme compliance
    accessibility           WCAG 2.1 AA compliance
    responsive-design       Mobile-first responsive design
    component-patterns      Component composition patterns
    typography              Typography compliance
    color-system            Color system compliance
    spacing                 Spacing system compliance
    performance             Performance implications

EXAMPLES:
    $0                      # Audit entire project
    $0 src/components/      # Audit specific directory
    $0 --format markdown    # Markdown report
    $0 --category css-properties --verbose
    $0 --output audit-report.md

AUDIT METRICS:
    - CSS custom properties compliance
    - Dark mode support
    - Semantic color usage
    - Responsive design patterns
    - Accessibility compliance
    - Component consistency
    - Typography standards
    - Performance implications
    - Best practices adherence

EOF
}

# Parse command line arguments
VERBOSE=false
FORMAT="text"
OUTPUT_FILE=""
CATEGORY="all"
QUIET=false
DRY_RUN=false
FIX_MINOR=false
TARGET_PATH="$CLIENT_DIR/src"

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
        -f|--format)
            FORMAT="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -c|--category)
            CATEGORY="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --fix-minor)
            FIX_MINOR=true
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

# Convert relative path to absolute
if [[ ! "$TARGET_PATH" = /* ]]; then
    TARGET_PATH="$(pwd)/$TARGET_PATH"
fi

# Initialize report
init_report() {
    local title="Design System Audit Report"
    local date=$(date +"%Y-%m-%d %H:%M:%S")
    local target="$TARGET_PATH"

    case "$FORMAT" in
        "markdown")
            cat << EOF
# $title

**Date:** $date
**Target:** \`$target\`
**Category:** \`$CATEGORY\`

## Executive Summary

EOF
            ;;
        "json")
            cat << EOF
{
  "audit": {
    "title": "$title",
    "date": "$date",
    "target": "$target",
    "category": "$CATEGORY",
    "results": {
      "totalFiles": 0,
      "filesWithIssues": 0,
      "totalIssues": 0,
      "totalWarnings": 0,
      "categories": {}
    }
  }
}
EOF
            ;;
        *)
            cat << EOF
$title
=================
Date: $date
Target: $target
Category: $CATEGORY

Executive Summary
=================

EOF
            ;;
    esac
}

# Output function
output() {
    local content="$1"
    local level="${2:-info}"

    if [[ "$QUIET" == true && "$level" == "info" ]]; then
        return
    fi

    if [[ -n "$OUTPUT_FILE" ]]; then
        echo "$content" >> "$OUTPUT_FILE"
    fi

    if [[ "$FORMAT" != "json" ]]; then
        echo "$content"
    fi
}

# Audit CSS Custom Properties
audit_css_properties() {
    local target="$1"
    local issues=0
    local warnings=0

    print_header "🎨 CSS Custom Properties Audit"
    output "## CSS Custom Properties Audit"

    # Find all React components
    while IFS= read -r -d '' file; do
        if [[ "$file" =~ \.(tsx|jsx|ts|js)$ ]] && [[ ! "$file" =~ \.test\. ]] && [[ ! "$file" =~ \.stories\. ]]; then
            ((TOTAL_FILES++))
            local filename=$(basename "$file")
            local file_issues=0

            if [[ "$VERBOSE" == true ]]; then
                print_status "Auditing: $filename"
            fi

            # Check for hardcoded colors
            if grep -qE "color:\s*#[0-9a-fA-F]|background:\s*#[0-9a-fA-F]|border.*#[0-9a-fA-F]" "$file" 2>/dev/null; then
                print_error "Hardcoded colors in $filename"
                output "### ❌ Hardcoded Colors Found in \`$filename\`" "error"
                output "\`\`\`bash"
                grep -n "color:\s*#[0-9a-fA-F]\|background:\s*#[0-9a-fA-F]\|border.*#[0-9a-fA-F]" "$file" 2>/dev/null | head -5
                output "\`\`\`"
                ((file_issues++))
            fi

            # Check for hardcoded spacing
            if grep -qE "padding:\s*[0-9]+px|margin:\s*[0-9]+px|gap:\s*[0-9]+px" "$file" 2>/dev/null; then
                print_error "Hardcoded spacing in $filename"
                output "### ❌ Hardcoded Spacing Found in \`$filename\`" "error"
                output "\`\`\`bash"
                grep -n "padding:\s*[0-9]+px\|margin:\s*[0-9]+px\|gap:\s*[0-9]+px" "$file" 2>/dev/null | head -5
                output "\`\`\`"
                ((file_issues++))
            fi

            # Check for CSS custom properties usage
            if grep -q "className\|style" "$file" 2>/dev/null && ! grep -q "var(--" "$file" 2>/dev/null; then
                print_warning "No CSS custom properties in $filename"
                output "### ⚠️ No CSS Custom Properties in \`$filename\`" "warning"
                output "Consider using \`var(--primary)\`, \`var(--space-4)\`, etc."
                ((warnings++))
            fi

            # Fix minor issues if requested
            if [[ "$FIX_MINOR" == true && $file_issues -gt 0 ]]; then
                print_status "Attempting to fix minor issues in $filename..."
                # Basic fixes
                sed -i.tmp 's/color: "#000000"/color: var(--foreground)/g' "$file"
                sed -i.tmp 's/color: "#ffffff"/color: var(--background)/g' "$file"
                sed -i.tmp 's/padding: "16px"/padding: var(--space-4)/g' "$file"
                rm -f "$file.tmp"
            fi

            if [[ $file_issues -gt 0 ]]; then
                ((issues += file_issues))
                ((FILES_WITH_ISSUES++))
            fi
        fi
    done < <(find "$target" -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) -print0)

    output ""
    output "**Results:** $issues issues, $warnings warnings found"
    output ""
}

# Audit Theme Compliance
audit_theme_compliance() {
    local target="$1"
    local issues=0
    local warnings=0

    print_header "🎭 Theme Compliance Audit"
    output "## Theme Compliance Audit"

    while IFS= read -r -d '' file; do
        if [[ "$file" =~ \.(tsx|jsx|ts|js)$ ]] && [[ ! "$file" =~ \.test\. ]] && [[ ! "$file" =~ \.stories\. ]]; then
            local filename=$(basename "$file")
            local file_issues=0

            if [[ "$VERBOSE" == true ]]; then
                print_status "Auditing theme compliance: $filename"
            fi

            # Check for semantic color usage
            local semantic_colors=0
            if grep -q "bg-primary\|text-primary\|border-primary" "$file" 2>/dev/null; then
                ((semantic_colors++))
            fi

            if [[ $semantic_colors -eq 0 && -f "$file" ]] && grep -q "className\|style" "$file" 2>/dev/null; then
                print_warning "No semantic colors in $filename"
                output "### ⚠️ No Semantic Color Tokens in \`$filename\`" "warning"
                output "Use semantic tokens: \`primary\`, \`secondary\`, \`muted\`, \`destructive\`"
                ((warnings++))
            fi

            # Check for dark mode support
            if grep -q "className\|style" "$file" 2>/dev/null && ! grep -q "var(--" "$file" 2>/dev/null; then
                print_warning "Potential dark mode issue in $filename"
                output "### ⚠️ Dark Mode Support Issue in \`$filename\`" "warning"
                output "CSS custom properties ensure automatic dark mode support"
                ((warnings++))
            fi

            if [[ $file_issues -gt 0 ]]; then
                ((issues += file_issues))
            fi
        fi
    done < <(find "$target" -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) -print0)

    output ""
    output "**Results:** $issues issues, $warnings warnings found"
    output ""
}

# Audit Accessibility
audit_accessibility() {
    local target="$1"
    local issues=0
    local warnings=0

    print_header "♿ Accessibility Audit"
    output "## Accessibility Audit (WCAG 2.1 AA)"

    while IFS= read -r -d '' file; do
        if [[ "$file" =~ \.(tsx|jsx|ts|js)$ ]] && [[ ! "$file" =~ \.test\. ]] && [[ ! "$file" =~ \.stories\. ]]; then
            local filename=$(basename "$file")
            local file_issues=0

            if [[ "$VERBOSE" == true ]]; then
                print_status "Auditing accessibility: $filename"
            fi

            # Check for ARIA labels
            if grep -q "button\|Button" "$file" 2>/dev/null && ! grep -q "aria-\|alt=" "$file" 2>/dev/null; then
                print_warning "Missing ARIA labels in $filename"
                output "### ⚠️ Missing ARIA Labels in \`$filename\`" "warning"
                output "Add \`aria-label\`, \`aria-describedby\`, or \`alt\` attributes"
                ((warnings++))
            fi

            # Check for focus management
            if grep -q "button\|input\|select\|textarea" "$file" 2>/dev/null && ! grep -q "focus:" "$file" 2>/dev/null; then
                print_warning "Missing focus styles in $filename"
                output "### ⚠️ Missing Focus Styles in \`$filename\`" "warning"
                output "Add \`focus:ring-2 focus:ring-ring\` classes"
                ((warnings++))
            fi

            # Check for keyboard navigation
            if grep -q "onClick\|onKeyDown\|onKeyPress" "$file" 2>/dev/null && ! grep -q "onKeyDown\|onKeyPress\|tabIndex" "$file" 2>/dev/null; then
                print_warning "Potential keyboard navigation issue in $filename"
                output "### ⚠️ Keyboard Navigation Issue in \`$filename\`" "warning"
                output "Ensure keyboard navigation support"
                ((warnings++))
            fi

            if [[ $file_issues -gt 0 ]]; then
                ((issues += file_issues))
            fi
        fi
    done < <(find "$target" -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) -print0)

    output ""
    output "**Results:** $issues issues, $warnings warnings found"
    output ""
}

# Audit Responsive Design
audit_responsive_design() {
    local target="$1"
    local issues=0
    local warnings=0

    print_header "📱 Responsive Design Audit"
    output "## Responsive Design Audit"

    while IFS= read -r -d '' file; do
        if [[ "$file" =~ \.(tsx|jsx|ts|js)$ ]] && [[ ! "$file" =~ \.test\. ]] && [[ ! "$file" =~ \.stories\. ]]; then
            local filename=$(basename "$file")
            local file_issues=0

            if [[ "$VERBOSE" == true ]]; then
                print_status "Auditing responsive design: $filename"
            fi

            # Check for responsive breakpoints
            if grep -q "className" "$file" 2>/dev/null && ! grep -q "sm:\|md:\|lg:\|xl:" "$file" 2>/dev/null; then
                print_warning "No responsive breakpoints in $filename"
                output "### ⚠️ No Responsive Breakpoints in \`$filename\`" "warning"
                output "Consider adding responsive classes: \`sm:\`, \`md:\`, \`lg:\`"
                ((warnings++))
            fi

            # Check for touch targets (44px minimum)
            if grep -q "button\|Button\|onClick" "$file" 2>/dev/null && ! grep -q "min-h-\|h-\|p-\|py-\|px-" "$file" 2>/dev/null; then
                print_warning "Potential touch target issue in $filename"
                output "### ⚠️ Touch Target Size Issue in \`$filename\`" "warning"
                output "Ensure minimum 44×44px touch targets"
                ((warnings++))
            fi

            if [[ $file_issues -gt 0 ]]; then
                ((issues += file_issues))
            fi
        fi
    done < <(find "$target" -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) -print0)

    output ""
    output "**Results:** $issues issues, $warnings warnings found"
    output ""
}

# Generate summary statistics
generate_summary() {
    print_header "📊 Audit Summary"
    output "## Audit Summary"

    local pass_rate=0
    if [[ $TOTAL_FILES -gt 0 ]]; then
        pass_rate=$(( (TOTAL_FILES - FILES_WITH_ISSUES) * 100 / TOTAL_FILES ))
    fi

    local grade="A+"
    if [[ $pass_rate -lt 90 ]]; then
        grade="A"
    elif [[ $pass_rate -lt 80 ]]; then
        grade="B"
    elif [[ $pass_rate -lt 70 ]]; then
        grade="C"
    elif [[ $pass_rate -lt 60 ]]; then
        grade="D"
    else
        grade="F"
    fi

    output "### 📈 Statistics"
    output ""
    output "| Metric | Value |"
    output "|--------|-------|"
    output "| **Total Files Audited** | $TOTAL_FILES |"
    output "| **Files with Issues** | $FILES_WITH_ISSUES |"
    output "| **Total Issues** | $TOTAL_ISSUES |"
    output "| **Total Warnings** | $TOTAL_WARNINGS |"
    output "| **Pass Rate** | $pass_rate% |"
    output "| **Grade** | **$grade** |"

    output ""
    output "### 🎯 Compliance Score"
    output ""

    # Calculate compliance score
    local max_score=$(( TOTAL_FILES * 100 ))
    local current_score=$(( max_score - (TOTAL_ISSUES * 10) - (TOTAL_WARNINGS * 2) ))
    if [[ $current_score -lt 0 ]]; then
        current_score=0
    fi

    if [[ $max_score -gt 0 ]]; then
        local compliance_score=$(( current_score * 100 / max_score ))
        output "**Overall Compliance Score: $compliance_score/100**"

        # Progress bar
        local filled=$(( compliance_score / 2 ))
        local empty=$(( 50 - filled ))
        printf "Progress: [%s%s] %d%%\n" "$(printf "%*s" $filled | tr ' ' '█')" "$(printf "%*s" $empty | tr ' ' '░')" $compliance_score
    fi

    output ""
    output "### 📋 Recommendations"

    if [[ $TOTAL_ISSUES -gt 0 ]]; then
        output "1. **High Priority Issues ($TOTAL_ISSUES)**"
        output "   - Fix hardcoded colors and spacing"
        output "   - Add CSS custom properties"
        output "   - Implement proper dark mode support"
        output ""
    fi

    if [[ $TOTAL_WARNINGS -gt 0 ]]; then
        output "2. **Medium Priority Improvements ($TOTAL_WARNINGS)**"
        output "   - Add responsive breakpoints"
        output "   - Improve accessibility features"
        output "   - Add ARIA labels and focus management"
        output ""
    fi

    output "3. **Best Practices**"
    output "   - Use semantic color tokens"
    output "   - Implement mobile-first responsive design"
    output "   - Follow WCAG 2.1 AA guidelines"
    output "   - Use consistent spacing and typography"
    output ""

    output "### 🛠️ Next Steps"
    output ""
    output "1. Run individual category audits:"
    output "   \`./scripts/validate-css-properties.sh src/\`"
    output "   \`./scripts/check-theme-compliance.sh src/\`"
    output ""
    output "2. Fix issues systematically"
    output "3. Re-run audit to verify improvements"
    output "4. Set up continuous integration checks"
    output ""
}

# Main audit function
run_audit() {
    local target="$1"

    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN: Would audit design system for: $target"
        print_status "Category: $CATEGORY"
        print_status "Format: $FORMAT"
        print_status "Output: $OUTPUT_FILE"
        exit 0
    fi

    print_status "Starting comprehensive design system audit..."
    print_status "Target: $target"
    print_status "Category: $CATEGORY"

    # Initialize report
    if [[ -n "$OUTPUT_FILE" ]]; then
        > "$OUTPUT_FILE"
        init_report
    fi

    # Run audits based on category
    case "$CATEGORY" in
        "all")
            audit_css_properties "$target"
            audit_theme_compliance "$target"
            audit_accessibility "$target"
            audit_responsive_design "$target"
            ;;
        "css-properties")
            audit_css_properties "$target"
            ;;
        "theme-compliance")
            audit_theme_compliance "$target"
            ;;
        "accessibility")
            audit_accessibility "$target"
            ;;
        "responsive-design")
            audit_responsive_design "$target"
            ;;
        *)
            print_error "Unknown category: $CATEGORY"
            show_usage
            exit 1
            ;;
    esac

    # Generate summary
    generate_summary

    # Final report
    local overall_status="PASS"
    if [[ $TOTAL_ISSUES -gt 0 ]]; then
        overall_status="FAIL"
    elif [[ $TOTAL_WARNINGS -gt 0 ]]; then
        overall_status="WARNING"
    fi

    print_header "🏁 Audit Complete"
    output "## Final Result: $overall_status"

    if [[ "$overall_status" == "PASS" ]]; then
        print_success "🎉 Design system audit passed! All components are compliant."
    elif [[ "$overall_status" == "WARNING" ]]; then
        print_warning "⚠️ Design system audit completed with warnings. Review and address warnings."
    else
        print_error "❌ Design system audit failed. Fix critical issues before proceeding."
    fi

    if [[ -n "$OUTPUT_FILE" ]]; then
        print_status "Report saved to: $OUTPUT_FILE"
    fi

    return $([[ "$overall_status" == "PASS" ]] && echo 0 || echo 1)
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    # Check for required tools
    command -v find >/dev/null 2>&1 || missing_deps+=("find")
    command -v grep >/dev/null 2>&1 || missing_deps+=("grep")
    command -v sed >/dev/null 2>&1 || missing_deps+=("sed")

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Main execution
main() {
    print_header "🔍 Shadcn Design System Auditor"
    print_header "=================================="

    # Check dependencies
    check_dependencies

    # Run audit
    run_audit "$TARGET_PATH"
    local exit_code=$?

    exit $exit_code
}

# Run main function
main "$@"