import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmptyState from './EmptyState';
import { ShieldCheck } from 'lucide-react';

describe('EmptyState Component', () => {
  it('renders with all props provided', () => {
    const mockAction = <button>Test Action</button>;
    
    render(
      <EmptyState
        icon={ShieldCheck}
        title="Test Title"
        message="Test message"
        action={mockAction}
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test Action' })).toBeInTheDocument();
  });

  it('renders without optional props', () => {
    render(<EmptyState />);
    
    // Component should render even without props
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders with only title and message', () => {
    render(
      <EmptyState
        title="No Data"
        message="No data available"
      />
    );

    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const { container } = render(
      <EmptyState
        icon={ShieldCheck}
        title="Test"
      />
    );

    // Check if icon container exists
    const iconContainer = container.querySelector('.rounded-full.bg-slate-100');
    expect(iconContainer).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const mockAction = <button data-testid="custom-action">Custom Button</button>;
    
    render(
      <EmptyState
        title="Test"
        action={mockAction}
      />
    );

    expect(screen.getByTestId('custom-action')).toBeInTheDocument();
  });

  it('applies correct CSS classes for centered layout', () => {
    const { container } = render(
      <EmptyState title="Test" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
  });
});
