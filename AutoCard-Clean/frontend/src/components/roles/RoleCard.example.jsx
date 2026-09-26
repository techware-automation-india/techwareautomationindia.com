import React from 'react';
import RoleCard from './RoleCard';

/**
 * RoleCard Component Examples
 * 
 * This file demonstrates various usage scenarios of the RoleCard component.
 */

// Example 1: Default Role (Admin)
export const DefaultRoleExample = () => {
  const adminRole = {
    id: 'role-1',
    name: 'Admin',
    isDefault: true,
    moduleCount: 9,
  };

  const handleEdit = (role) => {
    console.log('Edit role:', role);
  };

  const handleDelete = (role) => {
    console.log('Delete role:', role);
  };

  const handleClick = (role) => {
    console.log('Card clicked:', role);
  };

  return (
    <div className="max-w-sm">
      <RoleCard
        role={adminRole}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClick={handleClick}
      />
    </div>
  );
};

// Example 2: Custom Role with Multiple Modules
export const CustomRoleExample = () => {
  const customRole = {
    id: 'role-2',
    name: 'Project Manager',
    isDefault: false,
    moduleCount: 5,
  };

  const handleEdit = (role) => {
    console.log('Edit role:', role);
  };

  const handleDelete = (role) => {
    console.log('Delete role:', role);
  };

  const handleClick = (role) => {
    console.log('Card clicked:', role);
  };

  return (
    <div className="max-w-sm">
      <RoleCard
        role={customRole}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClick={handleClick}
      />
    </div>
  );
};

// Example 3: Role with No Modules
export const EmptyRoleExample = () => {
  const emptyRole = {
    id: 'role-3',
    name: 'New Role',
    isDefault: false,
    moduleCount: 0,
  };

  const handleEdit = (role) => {
    console.log('Edit role:', role);
  };

  const handleDelete = (role) => {
    console.log('Delete role:', role);
  };

  const handleClick = (role) => {
    console.log('Card clicked:', role);
  };

  return (
    <div className="max-w-sm">
      <RoleCard
        role={emptyRole}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClick={handleClick}
      />
    </div>
  );
};

// Example 4: Grid of Multiple Role Cards
export const RoleGridExample = () => {
  const roles = [
    {
      id: 'role-1',
      name: 'Admin',
      isDefault: true,
      moduleCount: 9,
    },
    {
      id: 'role-2',
      name: 'Employee',
      isDefault: true,
      moduleCount: 4,
    },
    {
      id: 'role-3',
      name: 'Customer',
      isDefault: true,
      moduleCount: 1,
    },
    {
      id: 'role-4',
      name: 'Project Manager',
      isDefault: false,
      moduleCount: 5,
    },
    {
      id: 'role-5',
      name: 'Team Lead',
      isDefault: false,
      moduleCount: 6,
    },
  ];

  const handleEdit = (role) => {
    console.log('Edit role:', role);
  };

  const handleDelete = (role) => {
    console.log('Delete role:', role);
  };

  const handleClick = (role) => {
    console.log('Card clicked:', role);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {roles.map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClick={handleClick}
        />
      ))}
    </div>
  );
};

// Example 5: Single Module Role
export const SingleModuleRoleExample = () => {
  const singleModuleRole = {
    id: 'role-6',
    name: 'Viewer',
    isDefault: false,
    moduleCount: 1,
  };

  const handleEdit = (role) => {
    console.log('Edit role:', role);
  };

  const handleDelete = (role) => {
    console.log('Delete role:', role);
  };

  const handleClick = (role) => {
    console.log('Card clicked:', role);
  };

  return (
    <div className="max-w-sm">
      <RoleCard
        role={singleModuleRole}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClick={handleClick}
      />
    </div>
  );
};
