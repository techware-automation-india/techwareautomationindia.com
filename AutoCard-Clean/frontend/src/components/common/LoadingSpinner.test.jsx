import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Unit tests for LoadingSpinner component
 * 
 * **Validates: Requirements 18.1, 18.4**
 */
describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    
    const loadingText = screen.getByText('Loading...');
    expect(loadingText).toBeInTheDocument();
  });

  it('applies small size class when size="sm"', () => {
    render(<LoadingSpinner size="sm" />);
    
    const spinner = screen.getByLabelText('Loading');
    expect(spinner).toHaveClass('h-4', 'w-4');
  });

  it('applies medium size class when size="md"', () => {
    render(<LoadingSpinner size="md" />);
    
    const spinner = screen.getByLabelText('Loading');
    expect(spinner).toHaveClass('h-8', 'w-8');
  });

  it('applies large size class when size="lg"', () => {
    render(<LoadingSpinner size="lg" />);
    
    const spinner = screen.getByLabelText('Loading');
    expect(spinner).toHaveClass('h-12', 'w-12');
  });

  it('applies extra large size class when size="xl"', () => {
    render(<LoadingSpinner size="xl" />);
    
    const spinner = screen.getByLabelText('Loading');
    expect(spinner).toHaveClass('h-16', 'w-16');
  });

  it('applies custom color class', () => {
    render(<LoadingSpinner color="text-blue-500" />);
    
    const spinner = screen.getByLabelText('Loading');
    expect(spinner).toHaveClass('text-blue-500');
  });

  it('applies default color when no color prop provided', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByLabelText('Loading');
    expect(spinner).toHaveClass('text-slate-600', 'dark:text-slate-400');
  });

  it('includes animate-spin class for animation', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByLabelText('Loading');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('centers spinner in container', () => {
    const { container } = render(<LoadingSpinner />);
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('flex', 'justify-center', 'items-center');
  });

  it('renders with accessibility attributes', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
    
    // Screen reader text should be present but visually hidden
    const srText = screen.getByText('Loading...');
    expect(srText).toHaveClass('sr-only');
  });
});
