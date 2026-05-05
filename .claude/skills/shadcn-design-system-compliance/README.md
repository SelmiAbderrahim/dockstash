# Shadcn Design System Compliance Skill

A comprehensive skill for implementing and validating Shadcn/ui design system compliance with CSS custom properties in the iReadYouTube project.

## Overview

This skill ensures strict adherence to the professional Shadcn/ui design system implemented in the iReadYouTube YouTube Video Transcription MVP. It provides comprehensive guidelines for CSS custom properties usage, component composition patterns, and theme compliance validation.

**Project Context**: iReadYouTube is a YouTube Video Transcription MVP built with React 18 + TypeScript + Convex + AssemblyAI, featuring professional Shadcn theme with Inter and Geist typography.

## Features

### 🎨 Design System Compliance
- **CSS Custom Properties Only**: Enforce `var(--*)` token usage
- **Semantic Color System**: Use primary, secondary, muted, destructive tokens
- **Typography Standards**: ABeeZee and Inter font families with consistent scale
- **Spacing System**: var(--space-*) tokens with consistent scale
- **Border Radius & Shadows**: var(--radius-*) and var(--shadow-*) tokens

### 🌙 Dark Mode Support
- **Automatic Dark Mode**: CSS custom properties ensure seamless dark mode
- **Theme Validation**: Verify dark mode compatibility
- **Color Contrast**: Ensure WCAG 2.1 AA compliance in both themes

### 📱 Responsive Design
- **Mobile-First**: Progressive enhancement approach
- **Breakpoint System**: Consistent responsive patterns
- **Touch Targets**: 44×44px minimum touch targets
- **Adaptive Layouts**: Responsive grid and flexbox patterns

### ♿ Accessibility Compliance
- **WCAG 2.1 AA**: Full accessibility compliance
- **Keyboard Navigation**: Proper focus management and tab order
- **Screen Reader Support**: ARIA labels and semantic markup
- **Color Independence**: Never use color as the only indicator

### 🛠️ Developer Tools
- **Component Generator**: Create compliant components automatically
- **Validation Scripts**: Comprehensive design system auditing
- **Theme Compliance Checker**: Verify Shadcn theme adherence
- **CSS Properties Validator**: Enforce custom properties usage

## Quick Start

### Generate a New Component

```bash
# Generate a basic card component
./scripts/generate-component.sh VideoCard card

# Generate with test and Storybook files
./scripts/generate-component.sh --with-test --with-story UploadForm upload

# Generate in specific directory
./scripts/generate-component.sh --dir src/components/forms LoginForm form
```

### Validate CSS Properties

```bash
# Validate specific component
./scripts/validate-css-properties.sh src/components/VideoCard.tsx

# Validate entire directory
./scripts/validate-css-properties.sh src/components/

# Generate detailed report
./scripts/validate-css-properties.sh --output report.md src/
```

### Check Theme Compliance

```bash
# Check theme compliance for component
./scripts/check-theme-compliance.sh src/components/VideoCard.tsx

# Check specific component type
./scripts/check-theme-compliance.sh --component cards

# Generate JSON report
./scripts/check-theme-compliance.sh --json --output report.json src/
```

### Run Comprehensive Audit

```bash
# Audit entire project
./scripts/audit-design-system.sh

# Audit specific category
./scripts/audit-design-system.sh --category accessibility

# Generate markdown report
./scripts/audit-design-system.sh --format markdown --output audit-report.md
```

## File Structure

```
shadcn-design-system-compliance/
├── SKILL.md                     # Main skill documentation
├── README.md                    # This file
├── scripts/                     # Validation and generation scripts
│   ├── validate-css-properties.sh    # CSS custom properties validator
│   ├── check-theme-compliance.sh     # Theme compliance checker
│   ├── generate-component.sh          # Component generator
│   └── audit-design-system.sh        # Comprehensive auditor
├── references/                  # Documentation and guides
│   ├── css-custom-properties.md       # Complete CSS tokens reference
│   ├── component-patterns.md         # Component composition patterns
│   ├── accessibility.md              # WCAG 2.1 AA compliance guide
│   └── responsive-design.md          # Mobile-first responsive patterns
├── assets/                      # Templates and configurations
│   ├── component-templates/          # Component templates
│   │   └── video-card.tsx.template   # Video card template
│   └── theme-configs/                # Theme configurations
│       └── ireadyoutube-theme.json   # Complete theme definition
└── LICENSE.txt                  # MIT license
```

## Design System Standards

### CSS Custom Properties

**Mandatory**: Always use CSS custom properties, never hardcoded values:

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

/* ❌ WRONG: Hardcoded values */
.bad-component {
  background: #ffffff;
  color: #0a0a0a;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}
```

### Component Composition

Compose from Shadcn/ui primitives using the `cn` utility:

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
```

### Semantic Color Usage

Use semantic color tokens for consistent theming:

```typescript
// ✅ CORRECT: Semantic colors
const StatusBadge = ({ status }) => {
  const variants = {
    success: "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300",
    warning: "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300",
    error: "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300",
  };

  return <Badge className={variants[status]}>{status}</Badge>;
};
```

## Component Templates

### Video Card Component

```typescript
import VideoCard from './VideoCard';

<VideoCard
  video={{
    id: "1",
    title: "How to Use Design Systems",
    description: "A comprehensive guide to implementing design systems",
    thumbnail: "/video-thumbnail.jpg",
    duration: 1200,
    views: 15000,
    uploadDate: "2024-01-15",
    status: "completed",
    transcriptAvailable: true
  }}
  variant="default"
  onClick={() => navigate('/video/1')}
  showTranscriptButton
  interactive
/>
```

### Form Component

```typescript
import UploadForm from './UploadForm';

<UploadForm
  onSubmit={handleSubmit}
  defaultValues={{ title: "", description: "" }}
  loading={false}
  submitText="Upload Video"
  onCancel={handleCancel}
  cancelText="Cancel"
/>
```

## Validation Rules

### Required Compliance

1. **CSS Custom Properties**: Use only `var(--*)` tokens
2. **Semantic Colors**: Use primary, secondary, muted, destructive tokens
3. **Spacing System**: Use var(--space-*) tokens
4. **Border Radius**: Use var(--radius-*) tokens
5. **Shadows**: Use var(--shadow-*) tokens
6. **Typography**: Use standard font scale
7. **Dark Mode**: Automatic support via CSS custom properties
8. **Accessibility**: WCAG 2.1 AA compliance
9. **Responsive**: Mobile-first design
10. **Focus Management**: Proper keyboard navigation

### Forbidden Patterns

- ❌ Hardcoded colors (#ffffff, #000000)
- ❌ Hardcoded spacing (24px, 1rem)
- ❌ Hardcoded border radius (10px)
- ❌ Hardcoded shadows
- ❌ Manual dark mode handling
- ❌ Non-semantic color classes (blue-500, red-400)
- ❌ Missing focus management
- ❌ Insufficient touch targets (< 44px)

## Scripts Reference

### validate-css-properties.sh

Validates CSS custom properties usage in components.

```bash
# Usage
./scripts/validate-css-properties.sh [OPTIONS] [PATH]

# Options
--verbose              Enable verbose output
--fix                  Attempt to fix common issues
--output FILE          Save report to file
--dry-run              Show what would be checked
```

**Validation Rules**:
- No hardcoded colors
- No hardcoded spacing
- No hardcoded border radius
- No hardcoded shadows
- Use semantic color tokens
- Use cn utility for class composition

### check-theme-compliance.sh

Checks Shadcn theme compliance.

```bash
# Usage
./scripts/check-theme-compliance.sh [OPTIONS] [PATH]

# Options
--component TYPE       Check specific component type
--theme PATH          Theme definition file
--json                JSON output format
--output FILE         Save report to file
```

**Compliance Areas**:
- Dark mode support
- Semantic color usage
- Spacing compliance
- Typography compliance
- Border radius usage
- Shadow system usage
- Component-specific patterns

### generate-component.sh

Generates Shadcn/ui compliant components.

```bash
# Usage
./scripts/generate-component.sh [OPTIONS] COMPONENT_NAME [TYPE]

# Options
--dir PATH            Output directory
--with-test          Generate test file
--with-story         Generate Storybook story
--dry-run            Show what would be generated
```

**Component Types**:
- `card` - Card component with header/content/footer
- `form` - Form component with validation
- `button` - Button component with variants
- `default` - Base component template

### audit-design-system.sh

Comprehensive design system audit.

```bash
# Usage
./scripts/audit-design-system.sh [OPTIONS] [PATH]

# Options
--format FORMAT      Output format (text, json, markdown)
--category CAT       Audit specific category
--output FILE        Save report to file
--quiet              Minimal output
--fix-minor          Fix minor issues automatically
```

**Audit Categories**:
- `css-properties` - CSS custom properties usage
- `theme-compliance` - Shadcn theme compliance
- `accessibility` - WCAG 2.1 AA compliance
- `responsive-design` - Mobile-first responsive design
- `all` - All categories (default)

## Integration with iReadYouTube

### Project-Specific Features

1. **YouTube Integration**: YouTube brand colors and patterns
2. **Video Components**: Specialized video player and card components
3. **Transcript Viewer**: Accessible transcript display with search
4. **Upload Forms**: Video upload with progress tracking
5. **Processing Status**: Real-time status indicators

### Custom Theme Extensions

```css
/* Video-specific colors */
--video-background: var(--muted);
--video-controls: var(--card);
--progress-bar: var(--primary);
--thumbnail-overlay: hsl(var(--background) / 0.8);

/* Transcript colors */
--transcript-highlight: hsl(var(--primary) / 0.1);
--transcript-active: hsl(var(--primary) / 0.2);

/* YouTube integration colors */
--youtube-red: 239.4 100% 58.8%;
--youtube-dark-red: 359.4 100% 43.5%;
```

### Usage in Development

1. **Component Development**: Use component generator for consistent components
2. **Code Review**: Run validation scripts before committing
3. **Continuous Integration**: Integrate audit scripts in CI/CD
4. **Design Reviews**: Use theme compliance checker for reviews

## Best Practices

### Development Workflow

1. **Plan**: Understand component requirements and design system implications
2. **Generate**: Use component generator for consistent boilerplate
3. **Implement**: Follow design system patterns and accessibility guidelines
4. **Validate**: Run validation scripts to ensure compliance
5. **Test**: Include accessibility and responsive testing
6. **Review**: Peer review with design system compliance check

### Code Quality

- **TypeScript**: Full type safety with proper interfaces
- **Testing**: Comprehensive unit and integration tests
- **Documentation**: Clear component documentation and examples
- **Performance**: Optimize for performance and bundle size
- **Accessibility**: WCAG 2.1 AA compliance by default

### Design System Governance

- **Consistency**: Follow established patterns strictly
- **Validation**: Use automated tools for compliance checking
- **Evolution**: Propose changes through proper channels
- **Documentation**: Keep documentation updated with changes
- **Training**: Team education on design system usage

## Troubleshooting

### Common Issues

**Problem**: Component doesn't respect dark mode
**Solution**:
- Ensure you're using semantic color tokens (`var(--primary)`, `var(--card)`, etc.)
- Avoid hardcoded colors or manual dark mode handling
- Check that CSS custom properties are properly defined

**Problem**: CSS custom properties not working
**Solution**:
- Verify the CSS custom property exists in your theme configuration
- Check for typos in property names (`var(--space-6)` not `var(--spacing-6)`)
- Ensure the property is used on the correct element

**Problem**: Validation script shows false positives
**Solution**:
- Check if CSS custom properties are used but not detected correctly
- Verify file patterns and extensions match expectations
- Run with `--verbose` flag for detailed output

**Problem**: Component generation fails
**Solution**:
- Check output directory permissions
- Verify component name follows naming conventions
- Ensure required dependencies are installed

### Getting Help

1. **Documentation**: Check `references/` directory for detailed guides
2. **Examples**: Review `assets/component-templates/` for patterns
3. **Validation**: Use script output for specific issue identification
4. **Configuration**: Check `assets/theme-configs/` for theme settings

## Contributing

### Adding New Component Templates

1. Create template in `assets/component-templates/`
2. Follow established patterns and naming conventions
3. Include comprehensive props interfaces
4. Add accessibility and responsive features
5. Update component generator script

### Extending Validation Rules

1. Modify validation scripts in `scripts/`
2. Add new validation patterns and rules
3. Update documentation with new requirements
4. Add test cases for new validation rules
5. Update theme configuration if needed

### Improving Documentation

1. Update `references/` with new patterns
2. Add examples to component templates
3. Update README with new features
4. Include troubleshooting guides
5. Add best practices and guidelines

## License

This skill is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details.

## Version History

- **v1.0.0**: Initial release with comprehensive design system compliance
- Core validation and generation scripts
- Complete documentation and examples
- iReadYouTube-specific integrations

---

**Remember**: This skill enforces enterprise-grade design system standards. Always validate your implementation before committing changes, and never compromise on CSS custom properties usage or accessibility compliance.