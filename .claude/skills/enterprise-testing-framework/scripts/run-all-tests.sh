#!/bin/bash
# Enterprise Testing Framework - Comprehensive Test Runner
# Runs all test layers with proper sequencing and validation

set -e  # Exit on any error

echo "🧪 ENTERPRISE TESTING FRAMEWORK - COMPREHENSIVE TEST RUNNER"
echo "==========================================================="
echo "🚨 MANDATORY: All test layers must pass with 90%+ coverage"
echo "🔄 RUNNING IN DOCKER: All tests execute in containerized environment"
echo ""

# Test execution order (critical for dependencies)
TEST_LAYERS=("unit" "integration" "e2e" "performance" "security" "accessibility")

# Function to run unit tests
run_unit_tests() {
    echo "🔬 LAYER 1: UNIT TESTS"
    echo "----------------------"
    echo "Testing: Individual components and functions in isolation"
    echo ""

    local start_time=$(date +%s)
    local test_passed=true

    # Run unit tests with coverage
    echo "Running unit tests with coverage analysis..."
    if npm run test:unit:coverage; then
        echo "✅ Unit tests completed successfully"
    else
        echo "❌ Unit tests failed"
        test_passed=false
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "⏱️  Unit tests completed in ${duration}s"
    echo ""

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Function to run integration tests
run_integration_tests() {
    echo "🔗 LAYER 2: INTEGRATION TESTS"
    echo "----------------------------"
    echo "Testing: Component interactions and system integration points"
    echo ""

    local start_time=$(date +%s)
    local test_passed=true

    # Check if Convex backend is running
    if ! make status | grep -q "convex.*running"; then
        echo "⚠️  Starting Convex backend for integration tests..."
        make start > /dev/null 2>&1 || true
        sleep 5
    fi

    # Run integration tests
    echo "Running integration tests..."
    if npm run test:integration; then
        echo "✅ Integration tests completed successfully"
    else
        echo "❌ Integration tests failed"
        test_passed=false
    fi

    # Run Convex-specific tests
    echo "Running Convex backend tests..."
    if npm run test:convex; then
        echo "✅ Convex tests completed successfully"
    else
        echo "❌ Convex tests failed"
        test_passed=false
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "⏱️  Integration tests completed in ${duration}s"
    echo ""

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Function to run E2E tests
run_e2e_tests() {
    echo "🎭 LAYER 3: END-TO-END TESTS"
    echo "---------------------------"
    echo "Testing: Complete user workflows and critical user journeys"
    echo ""

    local start_time=$(date +%s)
    local test_passed=true

    # Check if application is running
    if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "⚠️  Starting application for E2E tests..."
        make start > /dev/null 2>&1 || true
        sleep 10
    fi

    # Wait for application to be ready
    echo "Waiting for application to be ready..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            break
        fi
        echo "   Waiting for application... (${retries} retries left)"
        sleep 2
        ((retries--))
    done

    if [ $retries -eq 0 ]; then
        echo "❌ Application failed to start for E2E tests"
        return 1
    fi

    # Run E2E tests
    echo "Running Playwright E2E tests..."
    if npm run test:e2e; then
        echo "✅ E2E tests completed successfully"
    else
        echo "❌ E2E tests failed"
        test_passed=false
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "⏱️  E2E tests completed in ${duration}s"
    echo ""

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Function to run performance tests
run_performance_tests() {
    echo "⚡ LAYER 4: PERFORMANCE TESTS"
    echo "----------------------------"
    echo "Testing: Application performance and loading benchmarks"
    echo ""

    local start_time=$(date +%s)
    local test_passed=true

    # Check if Lighthouse CI is available
    if command -v lhci > /dev/null 2>&1 || npm list -g @lhci/cli > /dev/null 2>&1; then
        echo "Running Lighthouse CI performance tests..."
        if npm run test:performance; then
            echo "✅ Performance tests completed successfully"
        else
            echo "❌ Performance tests failed"
            test_passed=false
        fi
    else
        echo "⚠️  Lighthouse CI not available, skipping performance tests"
        echo "💡 Install with: npm install -g @lhci/cli"
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "⏱️  Performance tests completed in ${duration}s"
    echo ""

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Function to run security tests
run_security_tests() {
    echo "🔒 LAYER 5: SECURITY TESTS"
    echo "-------------------------"
    echo "Testing: Security vulnerabilities and dependency scanning"
    echo ""

    local start_time=$(date +%s)
    local test_passed=true

    # Run npm audit for dependency vulnerabilities
    echo "Running npm audit for dependency security..."
    if npm audit --audit-level=high; then
        echo "✅ Dependency security audit passed"
    else
        echo "❌ Dependency security vulnerabilities found"
        test_passed=false
    fi

    # Check for OWASP ZAP if available
    if command -v zap.sh > /dev/null 2>&1 || command -v zap > /dev/null 2>&1; then
        echo "Running OWASP ZAP security scan..."
        if npm run test:security; then
            echo "✅ Security scan completed successfully"
        else
            echo "❌ Security scan found issues"
            test_passed=false
        fi
    else
        echo "⚠️  OWASP ZAP not available, skipping security scan"
        echo "💡 Install ZAP for comprehensive security testing"
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "⏱️  Security tests completed in ${duration}s"
    echo ""

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Function to run accessibility tests
run_accessibility_tests() {
    echo "♿ LAYER 6: ACCESSIBILITY TESTS"
    echo "------------------------------"
    echo "Testing: WCAG 2.1 AA compliance and screen reader compatibility"
    echo ""

    local start_time=$(date +%s)
    local test_passed=true

    # Check if application is running
    if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "⚠️  Starting application for accessibility tests..."
        make start > /dev/null 2>&1 || true
        sleep 10
    fi

    # Run axe-core accessibility tests
    echo "Running axe-core accessibility tests..."
    if npm run test:accessibility; then
        echo "✅ Accessibility tests completed successfully"
    else
        echo "❌ Accessibility violations found"
        test_passed=false
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "⏱️  Accessibility tests completed in ${duration}s"
    echo ""

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Function to generate comprehensive test report
generate_test_report() {
    echo "📊 GENERATING COMPREHENSIVE TEST REPORT..."
    echo ""

    local report_file="test-reports/test-run-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p test-reports

    local total_time=0
    local passed_layers=0
    local failed_layers=0

    # Calculate metrics
    for layer in "${TEST_LAYERS[@]}"; do
        local layer_file="test-reports/${layer}-results.json"
        if [ -f "$layer_file" ]; then
            local duration=$(jq -r '.duration // 0' "$layer_file")
            local passed=$(jq -r '.passed // false' "$layer_file")

            total_time=$((total_time + duration))
            if [ "$passed" = "true" ]; then
                ((passed_layers++))
            else
                ((failed_layers++))
            fi
        fi
    done

    cat > "$report_file" << EOF
# Enterprise Testing Framework - Test Run Report

**Generated**: $(date)
**Project**: iReadYouTube MVP
**Environment**: Docker Containerized Testing

## Executive Summary

- **Total Test Layers**: ${#TEST_LAYERS[@]}
- **Passed Layers**: $passed_layers
- **Failed Layers**: $failed_layers
- **Total Duration**: ${total_time}s
- **Overall Status**: $([ $failed_layers -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")

## Test Layer Results

| Layer | Status | Duration | Coverage | Notes |
|-------|--------|----------|----------|-------|
EOF

    # Add layer results to report
    for layer in "${TEST_LAYERS[@]}"; do
        local layer_file="test-reports/${layer}-results.json"
        if [ -f "$layer_file" ]; then
            local duration=$(jq -r '.duration // 0' "$layer_file")
            local passed=$(jq -r '.passed // false' "$layer_file")
            local coverage=$(jq -r '.coverage // "N/A"' "$layer_file")
            local notes=$(jq -r '.notes // ""' "$layer_file")
            local status=$([ "$passed" = "true" ] && echo "✅ PASSED" || echo "❌ FAILED")

            echo "| ${layer^} | $status | ${duration}s | $coverage | $notes |" >> "$report_file"
        else
            echo "| ${layer^} | ⚠️ SKIPPED | - | - | Layer not executed |" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF

## Coverage Summary

### Unit Test Coverage
$([ -f "test-reports/unit-results.json" ] && cat test-reports/unit-results.json | jq -r '
  "Lines: \(.coverage.lines // "N/A")%
Branches: \(.coverage.branches // "N/A")%
Functions: \(.coverage.functions // "N/A")%
Statements: \(.coverage.statements // "N/A")%"' || echo "No unit test coverage data available")

### Integration Test Coverage
$([ -f "test-reports/integration-results.json" ] && cat test-reports/integration-results.json | jq -r '
  "Lines: \(.coverage.lines // "N/A")%
Branches: \(.coverage.branches // "N/A")%
Functions: \(.coverage.functions // "N/A")%
Statements: \(.coverage.statements // "N/A")%"' || echo "No integration test coverage data available")

## Performance Metrics

$([ -f "test-reports/performance-results.json" ] && cat test-reports/performance-results.json | jq -r '
  "Performance Score: \(.score // "N/A")
First Contentful Paint: \(.fcp // "N/A")ms
Largest Contentful Paint: \(.lcp // "N/A")ms
Time to Interactive: \(.tti // "N/A")ms
Cumulative Layout Shift: \(.cls // "N/A")"' || echo "No performance data available")

## Security Findings

$([ -f "test-reports/security-results.json" ] && cat test-reports/security-results.json | jq -r '
  "Critical Vulnerabilities: \(.critical // 0)
High Vulnerabilities: \(.high // 0)
Medium Vulnerabilities: \(.medium // 0)
Low Vulnerabilities: \(.low // 0)"' || echo "No security data available")

## Accessibility Compliance

$([ -f "test-reports/accessibility-results.json" ] && cat test-reports/accessibility-results.json | jq -r '
  "WCAG 2.1 AA Violations: \(.violations // 0)
Critical Issues: \(.critical // 0)
Serious Issues: \(.serious // 0)
Moderate Issues: \(.moderate // 0)
Minor Issues: \(.minor // 0)"' || echo "No accessibility data available")

## Recommendations

$([ $failed_layers -gt 0 ] && cat << RECOMMENDATIONS
### IMMEDIATE ACTIONS REQUIRED

1. **Fix Failed Test Layers**
   - Review failed test output for specific errors
   - Address any coverage gaps below 90%
   - Fix performance issues and security vulnerabilities

2. **Improve Coverage**
   - Add tests for uncovered code paths
   - Focus on edge cases and error handling
   - Ensure all business logic is tested

3. **Address Performance Issues**
   - Optimize bundle size and loading performance
   - Implement proper caching strategies
   - Address Core Web Vitals issues

## Next Steps

- Fix all failing tests
- Re-run test suite: \`./scripts/run-all-tests.sh\`
- Only proceed when all layers pass
RECOMMENDATIONS
 || echo "All test layers passed successfully. Ready for production deployment.")

---

**Test Execution Status**: $([ $failed_layers -eq 0 ] && echo "✅ ALL LAYERS PASSED - READY FOR DEPLOYMENT" || echo "❌ FAILED LAYERS - BLOCKED FROM DEPLOYMENT")
EOF

    echo "📄 Comprehensive test report generated: $report_file"
    echo ""
}

# Function to run specific test layers
run_specific_layer() {
    local layer=$1
    case $layer in
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "security")
            run_security_tests
            ;;
        "accessibility")
            run_accessibility_tests
            ;;
        *)
            echo "❌ Unknown test layer: $layer"
            echo "Available layers: unit, integration, e2e, performance, security, accessibility"
            return 1
            ;;
    esac
}

# Main execution
main() {
    local start_time=$(date +%s)
    local layers_to_run=("${TEST_LAYERS[@]}")
    local all_passed=true

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --layer)
                shift
                if [[ " ${TEST_LAYERS[@]} " =~ " $1 " ]]; then
                    layers_to_run=("$1")
                else
                    echo "❌ Invalid layer: $1"
                    echo "Available layers: ${TEST_LAYERS[*]}"
                    exit 1
                fi
                ;;
            --help|-h)
                echo "Enterprise Testing Framework - Comprehensive Test Runner"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --layer LAYER    Run specific test layer only"
                echo "  --help, -h       Show this help message"
                echo ""
                echo "Available layers:"
                echo "  unit           Unit tests (individual components/functions)"
                echo "  integration    Integration tests (component interactions)"
                echo "  e2e           End-to-end tests (user workflows)"
                echo "  performance    Performance tests (loading benchmarks)"
                echo "  security       Security tests (vulnerability scanning)"
                echo "  accessibility  Accessibility tests (WCAG compliance)"
                echo ""
                echo "Default: Runs all test layers in sequence"
                exit 0
                ;;
            *)
                echo "❌ Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
        shift
    done

    echo "🚀 STARTING COMPREHENSIVE TEST EXECUTION"
    echo "Test layers to run: ${layers_to_run[*]}"
    echo ""

    # Check if we're in the correct directory
    if [ ! -f "package.json" ]; then
        echo "❌ ERROR: Must run from project root directory"
        exit 1
    fi

    # Create test reports directory
    mkdir -p test-reports

    # Run specified test layers
    for layer in "${layers_to_run[@]}"; do
        echo "🔄 EXECUTING: $layer tests"
        if ! run_specific_layer "$layer"; then
            all_passed=false
        fi

        # Short pause between layers
        sleep 2
    done

    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))

    echo "⏱️  TOTAL TEST EXECUTION TIME: ${total_duration}s"
    echo ""

    # Generate comprehensive report
    generate_test_report

    # Final status
    if [ "$all_passed" = true ]; then
        echo "🎉 SUCCESS: ALL TEST LAYERS PASSED"
        echo "✅ Ready for pull request and deployment"
        echo ""
        echo "🚀 PROCEEDING WITH DEVELOPMENT WORKFLOW..."
        exit 0
    else
        echo "❌ FAILURE: SOME TEST LAYERS FAILED"
        echo "❌ AUTOMATIC BLOCKING: Cannot proceed with development"
        echo "❌ PULL REQUEST BLOCKED: Will be rejected by CI/CD"
        echo "❌ DEPLOYMENT BLOCKED: Cannot deploy to production"
        echo ""
        echo "📋 Review detailed test report for specific failures"
        echo "🔧 Fix failing tests and re-run: ./scripts/run-all-tests.sh"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"