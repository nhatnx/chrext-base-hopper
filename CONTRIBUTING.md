# Contributing to BaseHopper

Thank you for your interest in contributing! This document provides guidelines for contributing to this BaseHopper extension.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Chrome version
- Any error messages

### Suggesting Enhancements

We welcome suggestions for:
- New example features
- Better documentation
- Code improvements
- UI/UX enhancements

Open an issue with:
- Clear description of the enhancement
- Why it would be useful
- Example implementation (if applicable)

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **Make your changes**
   - Follow the existing code style
   - Keep changes focused and minimal
   - Add comments for complex code
   - Update documentation if needed

4. **Test your changes**
   - Load extension in Chrome
   - Test all affected features
   - Verify no console errors

5. **Commit with clear messages**
   ```bash
   git commit -m "Add feature: brief description"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/my-new-feature
   ```

## Code Guidelines

### JavaScript
- Use modern ES6+ syntax
- Use `const` and `let` (not `var`)
- Add comments for non-obvious code
- Follow existing naming conventions
- Handle errors gracefully

### HTML/CSS
- Use semantic HTML5 elements
- Keep styles modular and reusable
- Follow existing design patterns
- Ensure responsive design

### Manifest
- Follow Chrome Extension guidelines
- Request minimal permissions
- Use Manifest V3 features
- Document permission requirements

## File Structure

When adding new features:
- Keep related files together
- Follow existing folder structure
- Update README if adding new directories
- Include examples and documentation

## Documentation

- Update README.md for major changes
- Update QUICKSTART.md if affecting setup
- Add inline comments for complex logic
- Include examples in documentation

## Testing

Before submitting:
- [ ] Load extension in Chrome without errors
- [ ] Test all modified features
- [ ] Check browser console for errors
- [ ] Verify on different websites (if applicable)
- [ ] Test with different settings/configurations

## Questions?

Feel free to open an issue for:
- Clarification on contributing process
- Discussion about potential changes
- General questions about the template

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make this template better! 🎉
