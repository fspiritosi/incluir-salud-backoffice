import { render, screen, fireEvent } from '@testing-library/react';
import { BeneficiariosTable } from '../BeneficiariosTable';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

// Mock UI components
jest.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange }: any) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data-testid={`input-${placeholder.toLowerCase().replace(/\s+/g, '-')}`}
    />
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

describe('BeneficiariosTable', () => {
  const mockData = [
    {
      id: '1',
      nombre: 'Juan',
      apellido: 'Pérez',
      documento: '12345678',
      direccion_completa: 'Calle 123',
      ciudad: 'Buenos Aires',
      provincia: 'Buenos Aires',
      activo: true,
    },
    {
      id: '2',
      nombre: 'María',
      apellido: 'González',
      documento: '87654321',
      direccion_completa: 'Avenida 456',
      ciudad: 'Córdoba',
      provincia: 'Córdoba',
      activo: true,
    },
    {
      id: '3',
      nombre: 'Carlos',
      apellido: 'López',
      documento: '11223344',
      direccion_completa: 'Boulevard 789',
      ciudad: 'Rosario',
      provincia: 'Santa Fe',
      activo: false,
    },
    {
      id: '4',
      nombre: 'Ana',
      apellido: 'Martínez',
      documento: '99887766',
      direccion_completa: 'Plaza 321',
      ciudad: 'Mendoza',
      provincia: 'Mendoza',
      activo: false,
    },
  ];

  describe('Test Case 4: Correctly filters the list of beneficiaries by name', () => {
    it('should filter beneficiaries by nombre', () => {
      render(<BeneficiariosTable data={mockData} />);

      // Initially all beneficiaries should be visible
      expect(screen.getByText('Juan')).toBeInTheDocument();
      expect(screen.getByText('María')).toBeInTheDocument();
      expect(screen.getByText('Carlos')).toBeInTheDocument();
      expect(screen.getByText('Ana')).toBeInTheDocument();

      // Filter by name "Juan"
      const nombreInput = screen.getByPlaceholderText('Filtrar nombre');
      fireEvent.change(nombreInput, { target: { value: 'Juan' } });

      // Only Juan should be visible
      expect(screen.getByText('Juan')).toBeInTheDocument();
      expect(screen.queryByText('María')).not.toBeInTheDocument();
      expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });

    it('should filter beneficiaries by nombre case-insensitively', () => {
      render(<BeneficiariosTable data={mockData} />);

      // Filter with lowercase
      const nombreInput = screen.getByPlaceholderText('Filtrar nombre');
      fireEvent.change(nombreInput, { target: { value: 'maria' } });

      expect(screen.getByText('María')).toBeInTheDocument();
      expect(screen.queryByText('Juan')).not.toBeInTheDocument();
      expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
    });

    it('should filter beneficiaries by apellido', () => {
      render(<BeneficiariosTable data={mockData} />);

      // Filter by apellido "López"
      const apellidoInput = screen.getByPlaceholderText('Filtrar apellido');
      fireEvent.change(apellidoInput, { target: { value: 'López' } });

      expect(screen.getByText('Carlos')).toBeInTheDocument();
      expect(screen.queryByText('Juan')).not.toBeInTheDocument();
      expect(screen.queryByText('María')).not.toBeInTheDocument();
    });

    it('should filter by partial name match', () => {
      render(<BeneficiariosTable data={mockData} />);

      const nombreInput = screen.getByPlaceholderText('Filtrar nombre');
      fireEvent.change(nombreInput, { target: { value: 'ar' } });

      // Should match "María" and "Carlos" (contain "ar")
      expect(screen.getByText('María')).toBeInTheDocument();
      expect(screen.getByText('Carlos')).toBeInTheDocument();
      expect(screen.queryByText('Juan')).not.toBeInTheDocument();
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });

    it('should show "Sin resultados" when no matches found', () => {
      render(<BeneficiariosTable data={mockData} />);

      const nombreInput = screen.getByPlaceholderText('Filtrar nombre');
      fireEvent.change(nombreInput, { target: { value: 'NonExistentName' } });

      expect(screen.getByText('Sin resultados')).toBeInTheDocument();
      expect(screen.queryByText('Juan')).not.toBeInTheDocument();
      expect(screen.queryByText('María')).not.toBeInTheDocument();
    });

    it('should combine multiple filters (nombre and ciudad)', () => {
      render(<BeneficiariosTable data={mockData} />);

      const nombreInput = screen.getByPlaceholderText('Filtrar nombre');
      const ciudadInput = screen.getByPlaceholderText('Filtrar ciudad');

      fireEvent.change(nombreInput, { target: { value: 'a' } });
      fireEvent.change(ciudadInput, { target: { value: 'Mendoza' } });

      // Only Ana from Mendoza should match
      expect(screen.getByText('Ana')).toBeInTheDocument();
      expect(screen.queryByText('María')).not.toBeInTheDocument();
      expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
    });
  });

  describe('Test Case 5: Correctly filters the list of beneficiaries by active status', () => {
    it('should show all beneficiaries when filter is "todos"', () => {
      render(<BeneficiariosTable data={mockData} />);

      // All beneficiaries should be visible by default
      expect(screen.getByText('Juan')).toBeInTheDocument();
      expect(screen.getByText('María')).toBeInTheDocument();
      expect(screen.getByText('Carlos')).toBeInTheDocument();
      expect(screen.getByText('Ana')).toBeInTheDocument();
    });

    it('should filter to show only active beneficiaries', () => {
      render(<BeneficiariosTable data={mockData} />);

      const activoSelect = screen.getByDisplayValue('Activo (todos)');
      fireEvent.change(activoSelect, { target: { value: 'si' } });

      // Only active beneficiaries (Juan, María)
      expect(screen.getByText('Juan')).toBeInTheDocument();
      expect(screen.getByText('María')).toBeInTheDocument();
      expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });

    it('should filter to show only inactive beneficiaries', () => {
      render(<BeneficiariosTable data={mockData} />);

      const activoSelect = screen.getByDisplayValue('Activo (todos)');
      fireEvent.change(activoSelect, { target: { value: 'no' } });

      // Only inactive beneficiaries (Carlos, Ana)
      expect(screen.getByText('Carlos')).toBeInTheDocument();
      expect(screen.getByText('Ana')).toBeInTheDocument();
      expect(screen.queryByText('Juan')).not.toBeInTheDocument();
      expect(screen.queryByText('María')).not.toBeInTheDocument();
    });

    it('should display correct active status text in table', () => {
      render(<BeneficiariosTable data={mockData} />);

      // Get all table rows
      const rows = screen.getAllByRole('row');
      
      // Check that active status is displayed correctly
      const juanRow = rows.find((row) => row.textContent?.includes('Juan'));
      expect(juanRow?.textContent).toContain('Sí');

      const carlosRow = rows.find((row) => row.textContent?.includes('Carlos'));
      expect(carlosRow?.textContent).toContain('No');
    });

    it('should combine active status filter with name filter', () => {
      render(<BeneficiariosTable data={mockData} />);

      const nombreInput = screen.getByPlaceholderText('Filtrar nombre');
      const activoSelect = screen.getByDisplayValue('Activo (todos)');

      // Filter for names containing 'a' and only active
      fireEvent.change(nombreInput, { target: { value: 'a' } });
      fireEvent.change(activoSelect, { target: { value: 'si' } });

      // Should only show María (active and contains 'a')
      expect(screen.getByText('María')).toBeInTheDocument();
      expect(screen.queryByText('Juan')).not.toBeInTheDocument();
      expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });

    it('should reset to all beneficiaries when changing filter back to "todos"', () => {
      render(<BeneficiariosTable data={mockData} />);

      const activoSelect = screen.getByDisplayValue('Activo (todos)');

      // First filter to active only
      fireEvent.change(activoSelect, { target: { value: 'si' } });
      expect(screen.queryByText('Carlos')).not.toBeInTheDocument();

      // Then change back to all
      fireEvent.change(activoSelect, { target: { value: 'todos' } });
      expect(screen.getByText('Carlos')).toBeInTheDocument();
      expect(screen.getByText('Juan')).toBeInTheDocument();
      expect(screen.getByText('María')).toBeInTheDocument();
      expect(screen.getByText('Ana')).toBeInTheDocument();
    });
  });

  describe('Additional functionality tests', () => {
    it('should render edit links for each beneficiary', () => {
      render(<BeneficiariosTable data={mockData} />);

      const editLinks = screen.getAllByText('Editar');
      expect(editLinks).toHaveLength(4);

      // Check that links have correct hrefs
      editLinks.forEach((link, index) => {
        const href = link.closest('a')?.getAttribute('href');
        expect(href).toContain('/protected/beneficiarios/editar/');
      });
    });

    it('should render empty state with empty data array', () => {
      render(<BeneficiariosTable data={[]} />);

      expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    });
  });
});
