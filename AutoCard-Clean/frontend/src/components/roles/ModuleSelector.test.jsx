import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ModuleSelector from './ModuleSelector';
import { MODULES } from '../../data/modules';

describe('ModuleSelector Component', () => {
  it('renders all modules from MODULES data', () => {
    const mockOnChange = vi.fn();
    render(<ModuleSelector selectedModules={[]} onChange={mockOnChange} />);

    // Verify all module labels are rendered
    MODULES.forEach(module => {
      expect(screen.getByText(module.label)).toBeInTheDocument();
    });
  });

  it('displays selected modules with active styling', () => {
    const mockOnChange = vi.fn();
    const selectedModules = ['overview', 'employee'];
    
    const { container } = render(
      <ModuleSelector selectedModules={selectedModules} onChange={mockOnChange} />
    );

    // Check that selected modules have the active class
    const overviewModule = screen.getByText('Dashboard').closest('div');
    expect(overviewModule).toHaveClass('bg-primary/10', 'border-primary');

    const employeeModule = screen.getByText('Employee').closest('div');
    expect(employeeModule).toHaveClass('bg-primary/10', 'border-primary');
  });

  it('displays unselected modules with inactive styling', () => {
    const mockOnChange = vi.fn();
    
    render(<ModuleSelector selectedModules={[]} onChange={mockOnChange} />);

    const dashboardModule = screen.getByText('Dashboard').closest('div');
    expect(dashboardModule).toHaveClass('border-border', 'text-muted-foreground');
  });

  it('calls onChange with updated array when module is selected', () => {
    const mockOnChange = vi.fn();
    const selectedModules = ['overview'];
    
    render(<ModuleSelector selectedModules={selectedModules} onChange={mockOnChange} />);

    // Click on Employee module to select it
    const employeeModule = screen.getByText('Employee').closest('div');
    fireEvent.click(employeeModule);

    // Should call onChange with overview + employee
    expect(mockOnChange).toHaveBeenCalledWith(['overview', 'employee']);
  });

  it('calls onChange with module removed when already selected module is clicked', () => {
    const mockOnChange = vi.fn();
    const selectedModules = ['overview', 'employee'];
    
    render(<ModuleSelector selectedModules={selectedModules} onChange={mockOnChange} />);

    // Click on Employee module to deselect it
    const employeeModule = screen.getByText('Employee').closest('div');
    fireEvent.click(employeeModule);

    // Should call onChange with only overview
    expect(mockOnChange).toHaveBeenCalledWith(['overview']);
  });

  it('does not call onChange when disabled', () => {
    const mockOnChange = vi.fn();
    
    render(
      <ModuleSelector 
        selectedModules={[]} 
        onChange={mockOnChange} 
        disabled={true} 
      />
    );

    // Try to click a module
    const dashboardModule = screen.getByText('Dashboard').closest('div');
    fireEvent.click(dashboardModule);

    // Should not call onChange
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('applies disabled styling when disabled prop is true', () => {
    const mockOnChange = vi.fn();
    
    const { container } = render(
      <ModuleSelector 
        selectedModules={[]} 
        onChange={mockOnChange} 
        disabled={true} 
      />
    );

    const dashboardModule = screen.getByText('Dashboard').closest('div');
    expect(dashboardModule).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('renders checkbox indicator for selected modules', () => {
    const mockOnChange = vi.fn();
    const selectedModules = ['overview'];
    
    const { container } = render(
      <ModuleSelector selectedModules={selectedModules} onChange={mockOnChange} />
    );

    // Find the Dashboard module and check for checkmark SVG
    const dashboardModule = screen.getByText('Dashboard').closest('div');
    const checkmark = dashboardModule.querySelector('svg');
    
    expect(checkmark).toBeInTheDocument();
    expect(checkmark).toHaveClass('text-primary-foreground');
  });

  it('renders in 2-column grid on mobile and 3-column on desktop', () => {
    const mockOnChange = vi.fn();
    
    const { container } = render(
      <ModuleSelector selectedModules={[]} onChange={mockOnChange} />
    );

    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-2', 'md:grid-cols-3');
  });

  it('handles empty selectedModules array', () => {
    const mockOnChange = vi.fn();
    
    render(<ModuleSelector selectedModules={[]} onChange={mockOnChange} />);

    // All modules should be unselected
    MODULES.forEach(module => {
      const moduleElement = screen.getByText(module.label).closest('div');
      expect(moduleElement).toHaveClass('border-border', 'text-muted-foreground');
    });
  });

  it('uses default empty array when selectedModules is undefined', () => {
    const mockOnChange = vi.fn();
    
    // Should not throw error
    render(<ModuleSelector onChange={mockOnChange} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
