# Testing GET /api/users/by-role/:roleId Endpoint

## Overview
This document describes how to test the newly implemented endpoint that filters users by their assigned role.

## Endpoint Details
- **URL**: `GET /api/users/by-role/:roleId`
- **Authentication**: Required (Admin only)
- **Authorization**: Requires ADMIN role

## Request Parameters
- `roleId` (path parameter): UUID of the role to filter by

## Response Format

### Success (200 OK)
```json
{
  "users": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "EMPLOYEE",
      "roleId": "role-uuid",
      "customRole": {
        "id": "role-uuid",
        "name": "Project Manager",
        "isDefault": false,
        "modules": ["overview", "employee", "requests"]
      }
    }
  ],
  "role": {
    "id": "role-uuid",
    "name": "Project Manager"
  }
}
```

### Error Responses

#### Invalid UUID Format (400 Bad Request)
```json
{
  "message": "Invalid role ID format. Must be a valid UUID."
}
```

#### Role Not Found (404 Not Found)
```json
{
  "message": "Role not found."
}
```

#### Unauthorized (401)
```json
{
  "message": "Authentication required"
}
```

#### Forbidden (403)
```json
{
  "message": "Admin access required"
}
```

## Manual Testing Steps

### Using cURL

1. **First, login as admin to get a token:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'
```

2. **Copy the token from the response**

3. **Get a valid roleId (list all roles):**
```bash
curl -X GET http://localhost:4000/api/roles \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

4. **Test the endpoint with a valid roleId:**
```bash
curl -X GET http://localhost:4000/api/users/by-role/ROLE_UUID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

1. Create a new GET request
2. Set URL to: `http://localhost:4000/api/users/by-role/:roleId`
3. In the "Authorization" tab, select "Bearer Token" and paste your admin token
4. Replace `:roleId` with an actual role UUID
5. Send the request

### Test Cases

#### Test Case 1: Valid Role with Users
- **Input**: Valid roleId that has users assigned
- **Expected**: 200 OK with array of users

#### Test Case 2: Valid Role with No Users
- **Input**: Valid roleId with no assigned users
- **Expected**: 200 OK with empty users array

#### Test Case 3: Invalid UUID Format
- **Input**: `not-a-uuid`
- **Expected**: 400 Bad Request

#### Test Case 4: Non-existent Role
- **Input**: Valid UUID format but role doesn't exist
- **Expected**: 404 Not Found

#### Test Case 5: Non-Admin User
- **Input**: Valid request but token is for non-admin user
- **Expected**: 403 Forbidden

#### Test Case 6: No Authentication
- **Input**: Valid request without Authorization header
- **Expected**: 401 Unauthorized

## Requirements Validated
- **Requirement 8.4**: System allows filtering employees by role
- **Requirement 14.3**: GET endpoint at /api/users/by-role/:roleId for filtering users by role
- **Requirement 14.4**: Admin authentication required for all access assignment endpoints
