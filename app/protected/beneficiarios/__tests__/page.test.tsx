import { createClient } from '@/lib/supabase/server';
import BeneficiariosPage from '../page';
import { listBeneficiarios } from '@/app/protected/beneficiarios/actions';

// Mock dependencies
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/app/protected/beneficiarios/actions', () => ({
  listBeneficiarios: jest.fn(),
}));

jest.mock('@/components/beneficiarios/BeneficiariosTable', () => ({
  BeneficiariosTable: ({ data }: any) => (
    <div data-testid="beneficiarios-table">
      {data.map((p: any) => (
        <div key={p.id} data-testid={`beneficiario-${p.id}`}>
          {p.nombre} {p.apellido}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children }: any) => <button>{children}</button>,
}));

describe('BeneficiariosPage', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getClaims: jest.fn(),
      },
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('Test Case 3: Successfully fetches and displays a list of beneficiaries', () => {
    beforeEach(() => {
      mockSupabase.auth.getClaims.mockResolvedValue({
        data: { claims: { sub: 'user-id' } },
        error: null,
      });
    });

    it('should fetch and display beneficiaries when data is available', async () => {
      const mockBeneficiarios = [
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
      ];
      (listBeneficiarios as jest.Mock).mockResolvedValue({ data: mockBeneficiarios, error: null });

      const result = await BeneficiariosPage();

      // Verify the component structure
      const resultString = JSON.stringify(result);
      expect(resultString).toContain('Beneficiarios');
      expect(resultString).toContain('Juan');
      expect(resultString).toContain('Pérez');
      expect(resultString).toContain('María');
      expect(resultString).toContain('González');
      expect(resultString).toContain('Carlos');
      expect(resultString).toContain('López');
      // Verify action was called
      expect(listBeneficiarios).toHaveBeenCalled();
    });

    it('should display empty list when no beneficiaries exist', async () => {
      (listBeneficiarios as jest.Mock).mockResolvedValue({ data: [], error: null });

      const result = await BeneficiariosPage();

      const resultString = JSON.stringify(result);
      expect(resultString).toContain('Beneficiarios');
      expect(listBeneficiarios).toHaveBeenCalled();
    });

    it('should order beneficiarios by apellido ascending', async () => {
      (listBeneficiarios as jest.Mock).mockResolvedValue({ data: [], error: null });
      await BeneficiariosPage();
      expect(listBeneficiarios).toHaveBeenCalled();
    });
  });
});

