import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RoleCard from './RoleCard';

describe('RoleCard Component', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnClick = vi.fn();

  const defaultRole = {
    id: 'role-1',
    name: 'Admin',
    isDefault: true,
    moduleCount: 9,
  };

  const customRole = {
    id: 'role-2',
    name: 'Project Manager',
    isDefault: false,
    moduleCount: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display', () => {
    it('renders role name correctly', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Project Manager')).toBeInTheDocument();
    });

    it('displays module count with correct pluralization', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('3 modules')).toBeInTheDocument();
    });

    it('displays singular "module" for count of 1', () => {
      const roleWithOneModule = { ...customRole, moduleCount: 1 };
      render(
        <RoleCard
          role={roleWithOneModule}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('1 module')).toBeInTheDocument();
    });

    it('displays "No modules" when count is 0', () => {
      const roleWithNoModules = { ...customRole, moduleCount: 0 };
      render(
        <RoleCard
          role={roleWithNoModules}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('No modules')).toBeInTheDocument();
    });

    it('displays "Default" badge for default roles', () => {
      render(
        <RoleCard
          role={defaultRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('does not display "Default" badge for custom roles', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      expect(screen.queryByText('Default')).not.toBeInTheDocument();
    });

    it('renders ShieldCheck icon', () => {
      const { container } = render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      // Check if SVG icon exists
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onClick when card is clicked', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const card = screen.getByText('Project Manager').closest('div').parentElement;
      fireEvent.click(card);

      expect(mockOnClick).toHaveBeenCalledWith(customRole);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('calls onEdit when edit button is clicked', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const editButton = screen.getByLabelText(`Edit ${customRole.name} role`);
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(customRole);
      expect(mockOnEdit).toHaveBeenCalledTimes(1);
      expect(mockOnClick).not.toHaveBeenCalled(); // Card click should not fire
    });

    it('calls onDelete when delete button is clicked for custom roles', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const deleteButton = screen.getByLabelText(`Delete ${customRole.name} role`);
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(customRole);
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
      expect(mockOnClick).not.toHaveBeenCalled(); // Card click should not fire
    });

    it('does not call onDelete when delete button is clicked for default roles', () => {
      render(
        <RoleCard
          role={defaultRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const deleteButton = screen.getByLabelText(`Delete ${defaultRole.name} role`);
      fireEvent.click(deleteButton);

      expect(mockOnDelete).not.toHaveBeenCalled();
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Delete Button State', () => {
    it('disables delete button for default roles', () => {
      render(
        <RoleCard
          role={defaultRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const deleteButton = screen.getByLabelText(`Delete ${defaultRole.name} role`);
      expect(deleteButton).toBeDisabled();
    });

    it('enables delete button for custom roles', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const deleteButton = screen.getByLabelText(`Delete ${customRole.name} role`);
      expect(deleteButton).not.toBeDisabled();
    });

    it('shows tooltip for disabled delete button', () => {
      render(
        <RoleCard
          role={defaultRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const deleteButton = screen.getByLabelText(`Delete ${defaultRole.name} role`);
      expect(deleteButton).toHaveAttribute('title', 'Cannot delete default roles');
    });
  });

  describe('Styling', () => {
    it('applies card-shadow class', () => {
      const { container } = render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const card = container.querySelector('.card-shadow');
      expect(card).toBeInTheDocument();
    });

    it('applies rounded-2xl class for rounded corners', () => {
      const { container } = render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const card = container.querySelector('.rounded-2xl');
      expect(card).toBeInTheDocument();
    });

    it('applies cursor-pointer class', () => {
      const { container } = render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      const card = container.querySelector('.cursor-pointer');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides aria-label for edit button', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByLabelText(`Edit ${customRole.name} role`)).toBeInTheDocument();
    });

    it('provides aria-label for delete button', () => {
      render(
        <RoleCard
          role={customRole}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByLabelText(`Delete ${customRole.name} role`)).toBeInTheDocument();
    });
  });
});
