# Unit Tests Documentation

This document describes the unit tests created for the beneficiarios module.

## Test Coverage

The following test cases have been implemented:

### 1. EditarBeneficiarioPage - Authentication Tests
**Location:** `app/protected/beneficiarios/editar/[id]/__tests__/page.test.tsx`

- ✅ Redirects to login if user claims error occurs
- ✅ Redirects to login if claims are missing
- ✅ Redirects to login if claims data is null

### 2. EditarBeneficiarioPage - Error Handling Tests
**Location:** `app/protected/beneficiarios/editar/[id]/__tests__/page.test.tsx`

- ✅ Displays error message when beneficiary is not found
- ✅ Displays error message when database query fails
- ✅ Displays error message when data is null without error

### 3. BeneficiariosPage - Data Fetching Tests
**Location:** `app/protected/beneficiarios/__tests__/page.test.tsx`

- ✅ Fetches and displays beneficiaries when data is available
- ✅ Displays empty list when no beneficiaries exist
- ✅ Orders beneficiarios by apellido ascending

### 4. BeneficiariosTable - Name Filter Tests
**Location:** `components/beneficiarios/__tests__/BeneficiariosTable.test.tsx`

- ✅ Filters beneficiaries by nombre
- ✅ Filters beneficiaries by nombre case-insensitively
- ✅ Filters beneficiaries by apellido
- ✅ Filters by partial name match
- ✅ Shows "Sin resultados" when no matches found
- ✅ Combines multiple filters (nombre and ciudad)

### 5. BeneficiariosTable - Active Status Filter Tests
**Location:** `components/beneficiarios/__tests__/BeneficiariosTable.test.tsx`

- ✅ Shows all beneficiaries when filter is "todos"
- ✅ Filters to show only active beneficiaries
- ✅ Filters to show only inactive beneficiaries
- ✅ Displays correct active status text in table
- ✅ Combines active status filter with name filter
- ✅ Resets to all beneficiaries when changing filter back to "todos"

## Setup

### Install Dependencies

First, install the necessary testing dependencies:

```bash
npm install
```

The following testing libraries have been added:
- `jest` - Testing framework
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom Jest matchers for DOM
- `@testing-library/user-event` - User interaction simulation
- `jest-environment-jsdom` - DOM environment for Jest

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- BeneficiariosTable.test.tsx
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="filter"
```

## Test Structure

All tests follow the Arrange-Act-Assert pattern:

1. **Arrange**: Set up test data and mock dependencies
2. **Act**: Execute the component or function being tested
3. **Assert**: Verify the expected behavior

## Mocking Strategy

### Server Components (EditarBeneficiarioPage, BeneficiariosPage)
- Mock `next/navigation` for redirect functionality
- Mock `@/lib/supabase/server` for database operations
- Mock child components to isolate test scope

### Client Components (BeneficiariosTable)
- Use React Testing Library to render components
- Mock UI components from `@/components/ui`
- Use `fireEvent` to simulate user interactions

## Notes

- All tests are isolated and don't depend on external services
- Supabase client and authentication are fully mocked
- Tests verify both happy paths and error scenarios
- Filter functionality is thoroughly tested with multiple combinations
