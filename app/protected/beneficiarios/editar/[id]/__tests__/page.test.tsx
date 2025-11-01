import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EditarBeneficiarioPage from '../page';
import { getBeneficiarioById } from '@/app/protected/beneficiarios/actions';

// Mock dependencies
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/app/protected/beneficiarios/actions', () => ({
  getBeneficiarioById: jest.fn(),
}));

jest.mock('@/components/forms/beneficiario-form', () => ({
  BeneficiarioForm: () => <div data-testid="beneficiario-form">Beneficiario Form</div>,
}));

describe('EditarBeneficiarioPage', () => {
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

  describe('Test Case 1: Redirects to login if user claims are missing', () => {
    it('should redirect to /auth/login when claims error occurs', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({
        data: null,
        error: new Error('Claims error'),
      });

      const params = Promise.resolve({ id: '123' });
      await EditarBeneficiarioPage({ params });

      expect(redirect).toHaveBeenCalledWith('/auth/login');
    });

    it('should redirect to /auth/login when claims are missing', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({
        data: { claims: null },
        error: null,
      });

      const params = Promise.resolve({ id: '123' });
      await EditarBeneficiarioPage({ params });

      expect(redirect).toHaveBeenCalledWith('/auth/login');
    });

    it('should redirect to /auth/login when claims data is null', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({
        data: null,
        error: null,
      });

      const params = Promise.resolve({ id: '123' });
      await EditarBeneficiarioPage({ params });

      expect(redirect).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('Test Case 2: Handles a non-existent beneficiary ID', () => {
    beforeEach(() => {
      mockSupabase.auth.getClaims.mockResolvedValue({
        data: { claims: { sub: 'user-id' } },
        error: null,
      });
    });

    it('should display error message when beneficiary is not found', async () => {
      (getBeneficiarioById as jest.Mock).mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const params = Promise.resolve({ id: 'non-existent-id' });
      const result = await EditarBeneficiarioPage({ params });

      // Check that the error message is rendered
      const resultString = JSON.stringify(result);
      expect(resultString).toContain('No se encontró el beneficiario');
      expect(resultString).toContain('Not found');
    });

    it('should display error message when database query fails', async () => {
      (getBeneficiarioById as jest.Mock).mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const params = Promise.resolve({ id: '123' });
      const result = await EditarBeneficiarioPage({ params });

      const resultString = JSON.stringify(result);
      expect(resultString).toContain('No se encontró el beneficiario');
      expect(resultString).toContain('Database error');
    });

    it('should display error message when data is null without error', async () => {
      (getBeneficiarioById as jest.Mock).mockResolvedValue({ data: null, error: null });

      const params = Promise.resolve({ id: '999' });
      const result = await EditarBeneficiarioPage({ params });

      const resultString = JSON.stringify(result);
      expect(resultString).toContain('No se encontró el beneficiario');
    });
  });
});

