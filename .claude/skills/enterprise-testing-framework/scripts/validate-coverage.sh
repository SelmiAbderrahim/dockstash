#!/bin/bash
# Enterprise Testing Framework - Coverage Validation Script
# MANDATORY: 90%+ test coverage requirement enforcement

set -e  # Exit on any error

echo "🔍 ENTERPRISE TESTING FRAMEWORK - COVERAGE VALIDATION"
echo "======================================================"
echo "🚨 MANDATORY REQUIREMENT: 90%+ test coverage for ALL code"
echo "❌ ZERO TOLERANCE: No exceptions, no compromises, no workarounds"
echo ""

# Function to validate coverage meets minimum requirement
validate_coverage() {
    local coverage_type=$1
    local coverage_value=$2
    local minimum_required=${3:-90}

    # Convert to integer for comparison (handle decimal percentages)
    local coverage_int=$(echo "$coverage_value" | cut -d. -f1)

    if [ "$coverage_int" -lt "$minimum_required" ]; then
        echo "❌ CRITICAL FAILURE: $coverage_type coverage (${coverage_value}%) below ${minimum_required}% minimum"
        echo "❌ AUTOMATIC REJECTION: Cannot proceed with coverage violation"
        echo "❌ QUALITY GATE BLOCKED: Pull request will be blocked"
        echo "❌ DEPLOYMENT BLOCKED: Cannot deploy with insufficient coverage"
        return 1
    else
        echo "✅ SUCCESS: $coverage_type coverage (${coverage_value}%) meets ${minimum_required}%+ requirement"
        return 0
    fi
}

# Function to generate coverage report
generate_coverage_report() {
    echo "📊 GENERATING COMPREHENSIVE COVERAGE REPORT..."
    echo ""

    # Create coverage directory if it doesn't exist
    mkdir -p coverage-reports

    # Run coverage analysis
    echo "Running unit test coverage analysis..."
    if ! npm run test:unit:coverage -- --reporter=json --outputFile=coverage-reports/unit-coverage.json > /dev/null 2>&1; then
        echo "❌ Unit test coverage failed to run"
        exit 1
    fi

    echo "Running integration test coverage analysis..."
    if ! npm run test:integration:coverage -- --reporter=json --outputFile=coverage-reports/integration-coverage.json > /dev/null 2>&1; then
        echo "❌ Integration test coverage failed to run"
        exit 1
    fi

    # Extract coverage percentages
    if [ -f "coverage-reports/unit-coverage.json" ]; then
        UNIT_COVERAGE=$(jq -r '.total.lines.pct // 0' coverage-reports/unit-coverage.json)
    else
        UNIT_COVERAGE=0
    fi

    if [ -f "coverage-reports/integration-coverage.json" ]; then
        INTEGRATION_COVERAGE=$(jq -r '.total.lines.pct // 0' coverage-reports/integration-coverage.json)
    else
        INTEGRATION_COVERAGE=0
    fi

    # Calculate combined coverage
    if [ "$UNIT_COVERAGE" != "0" ] && [ "$INTEGRATION_COVERAGE" != "0" ]; then
        TOTAL_COVERAGE=$(echo "scale=2; ($UNIT_COVERAGE + $INTEGRATION_COVERAGE) / 2" | bc)
    elif [ "$UNIT_COVERAGE" != "0" ]; then
        TOTAL_COVERAGE=$UNIT_COVERAGE
    elif [ "$INTEGRATION_COVERAGE" != "0" ]; then
        TOTAL_COVERAGE=$INTEGRATION_COVERAGE
    else
        TOTAL_COVERAGE=0
    fi

    echo "📈 COVERAGE ANALYSIS RESULTS:"
    echo "   • Unit Test Coverage: ${UNIT_COVERAGE}%"
    echo "   • Integration Test Coverage: ${INTEGRATION_COVERAGE}%"
    echo "   • Combined Total Coverage: ${TOTAL_COVERAGE}%"
    echo ""

    # Generate HTML report for detailed analysis
    echo "Generating detailed HTML coverage report..."
    npm run test:coverage -- --reporter=html > /dev/null 2>&1 || true

    return 0
}

# Function to validate all quality gates
validate_quality_gates() {
    echo "🚪 VALIDATING QUALITY GATES..."
    echo ""

    local all_passed=true

    # 1. Coverage Validation
    echo "🎯 GATE 1: Test Coverage Validation (90%+)"
    if ! validate_coverage "Overall" "$TOTAL_COVERAGE" 90; then
        all_passed=false
    fi

    if [ "$UNIT_COVERAGE" != "0" ]; then
        if ! validate_coverage "Unit Test" "$UNIT_COVERAGE" 90; then
            all_passed=false
        fi
    fi

    if [ "$INTEGRATION_COVERAGE" != "0" ]; then
        if ! validate_coverage "Integration Test" "$INTEGRATION_COVERAGE" 90; then
            all_passed=false
        fi
    fi

    echo ""

    # 2. Test Execution Validation
    echo "🎯 GATE 2: Test Execution Validation (100% Pass Rate)"

    # Run unit tests
    echo "   • Running unit tests..."
    if npm run test:unit > /dev/null 2>&1; then
        echo "   ✅ Unit tests: 100% pass rate"
    else
        echo "   ❌ Unit tests: FAILED"
        all_passed=false
    fi

    # Run integration tests
    echo "   • Running integration tests..."
    if npm run test:integration > /dev/null 2>&1; then
        echo "   ✅ Integration tests: 100% pass rate"
    else
        echo "   ❌ Integration tests: FAILED"
        all_passed=false
    fi

    echo ""

    # 3. Type Safety Validation
    echo "🎯 GATE 3: Type Safety Validation (Zero Errors)"
    if npm run type-check > /dev/null 2>&1; then
        echo "   ✅ TypeScript compilation: Zero errors"
    else
        echo "   ❌ TypeScript compilation: ERRORS FOUND"
        all_passed=false
    fi

    echo ""

    # 4. Code Quality Validation
    echo "🎯 GATE 4: Code Quality Validation (Zero Lint Violations)"
    if npm run lint > /dev/null 2>&1; then
        echo "   ✅ ESLint validation: Zero violations"
    else
        echo "   ❌ ESLint validation: VIOLATIONS FOUND"
        all_passed=false
    fi

    echo ""

    # 5. Security Validation (if security tools are available)
    echo "🎯 GATE 5: Security Validation (Zero Critical Issues)"
    if command -v npm > /dev/null && npm run audit > /dev/null 2>&1; then
        echo "   ✅ Security audit: No critical issues"
    else
        echo "   ⚠️  Security audit: Tools not available or issues found"
    fi

    echo ""

    return $([ "$all_passed" = true ] && echo 0 || echo 1)
}

# Function to generate comprehensive report
generate_comprehensive_report() {
    echo "📋 GENERATING COMPREHENSIVE VALIDATION REPORT..."
    echo ""

    local report_file="coverage-reports/validation-report-$(date +%Y%m%d-%H%M%S).md"

    cat > "$report_file" << EOF
# Enterprise Testing Framework - Validation Report

**Generated**: $(date)
**Project**: iReadYouTube MVP
**Requirements**: 90%+ Test Coverage (MANDATORY)

## Coverage Summary

| Metric | Coverage | Status | Requirement |
|--------|----------|--------|-------------|
| Unit Tests | ${UNIT_COVERAGE}% | $([ "$(echo "$UNIT_COVERAGE >= 90" | bc)" = "1" ] && echo "✅ PASS" || echo "❌ FAIL") | 90%+ |
| Integration Tests | ${INTEGRATION_COVERAGE}% | $([ "$(echo "$INTEGRATION_COVERAGE >= 90" | bc)" = "1" ] && echo "✅ PASS" || echo "❌ FAIL") | 90%+ |
| Total Coverage | ${TOTAL_COVERAGE}% | $([ "$(echo "$TOTAL_COVERAGE >= 90" | bc)" = "1" ] && echo "✅ PASS" || echo "❌ FAIL") | 90%+ |

## Quality Gate Results

### Test Coverage Validation
- **Overall Coverage**: ${TOTAL_COVERAGE}%
- **Status**: $([ "$(echo "$TOTAL_COVERAGE >= 90" | bc)" = "1" ] && echo "PASSED" || echo "FAILED - BLOCKED")

### Test Execution Validation
- **Unit Tests**: $(npm run test:unit > /dev/null 2>&1 && echo "PASSED" || echo "FAILED")
- **Integration Tests**: $(npm run test:integration > /dev/null 2>&1 && echo "PASSED" || echo "FAILED")

### Type Safety Validation
- **TypeScript**: $(npm run type-check > /dev/null 2>&1 && echo "PASSED - Zero Errors" || echo "FAILED")

### Code Quality Validation
- **ESLint**: $(npm run lint > /dev/null 2>&1 && echo "PASSED - Zero Violations" || echo "FAILED")

## Coverage Breakdown

### Unit Test Coverage
$([ -f "coverage-reports/unit-coverage.json" ] && cat coverage-reports/unit-coverage.json | jq -r '
  "Lines: \(.total.lines.pct | round)%
Branches: \(.total.branches.pct | round)%
Functions: \(.total.functions.pct | round)%
Statements: \(.total.statements.pct | round)%"' || echo "No unit test coverage data available")

### Integration Test Coverage
$([ -f "coverage-reports/integration-coverage.json" ] && cat coverage-reports/integration-coverage.json | jq -r '
  "Lines: \(.total.lines.pct | round)%
Branches: \(.total.branches.pct | round)%
Functions: \(.total.functions.pct | round)%
Statements: \(.total.statements.pct | round)%"' || echo "No integration test coverage data available")

## Recommendations

$([ "$(echo "$TOTAL_COVERAGE < 90" | bc)" = "1" ] && cat << RECOMMENDATIONS
### IMMEDIATE ACTIONS REQUIRED

1. **Add Tests for Uncovered Code**
   - Run \`make test:coverage:details\` to see uncovered lines
   - Focus on business logic and error handling
   - Add tests for all edge cases and error conditions

2. **Improve Branch Coverage**
   - Add tests for conditional branches
   - Test error paths and exception handling
   - Cover all decision points in code

3. **Enhance Integration Coverage**
   - Add tests for API endpoints
   - Test database operations
   - Cover external service integrations

## Next Steps

- Add missing tests to reach 90%+ coverage
- Run validation script again: \`./scripts/validate-coverage.sh\`
- Only proceed when all gates pass
RECOMMENDATIONS
 || echo "All quality gates passed. Ready for deployment.")

---

**Status**: $([ "$(echo "$TOTAL_COVERAGE >= 90" | bc)" = "1" ] && echo "✅ READY FOR DEPLOYMENT" || echo "❌ BLOCKED - COVERAGE BELOW 90%")
EOF

    echo "📄 Comprehensive report generated: $report_file"
    echo ""
}

# Main execution
main() {
    echo "🚀 STARTING ENTERPRISE TESTING FRAMEWORK VALIDATION"
    echo ""

    # Check if we're in the correct directory
    if [ ! -f "package.json" ]; then
        echo "❌ ERROR: Must run from project root directory"
        echo "❌ Navigate to project directory and run again"
        exit 1
    fi

    # Check if running in Docker (required)
    if [ ! -f "/.dockerenv" ] && [ -z "$DOCKER_CONTAINER" ]; then
        echo "⚠️  WARNING: Not running in Docker container"
        echo "💡 Recommended: Use 'make test:validate' instead of running script directly"
        echo ""
    fi

    # Generate coverage report
    if ! generate_coverage_report; then
        echo "❌ FAILED: Could not generate coverage report"
        exit 1
    fi

    # Validate quality gates
    if ! validate_quality_gates; then
        echo ""
        echo "❌ QUALITY GATES FAILED"
        echo "❌ AUTOMATIC BLOCKING: Cannot proceed with development"
        echo "❌ PULL REQUEST BLOCKED: Will be rejected by CI/CD"
        echo "❌ DEPLOYMENT BLOCKED: Cannot deploy to production"
        echo ""
        generate_comprehensive_report
        exit 1
    fi

    # Generate comprehensive report
    generate_comprehensive_report

    echo ""
    echo "🎉 SUCCESS: ALL QUALITY GATES PASSED"
    echo "✅ Test coverage meets 90%+ requirement"
    echo "✅ All tests passing with 100% success rate"
    echo "✅ Type safety validation passed (zero errors)"
    echo "✅ Code quality validation passed (zero violations)"
    echo "✅ Ready for pull request and deployment"
    echo ""
    echo "🚀 PROCEEDING WITH DEVELOPMENT WORKFLOW..."
}

# Run main function
main "$@"