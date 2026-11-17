import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { deleteCustomBenefitAction } from '../actions';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockGetServerSession = jest.mocked(getServerSession);
const mockRevalidatePath = jest.mocked(revalidatePath);
const mockExecuteRaw = prisma.$executeRaw as jest.Mock;
const session: Session = { user: { id: 'user-1' }, expires: '2026-12-31' };
const benefitId = 'clxx1234567890123456789012';

function deleteForm(id = benefitId) {
  const formData = new FormData();
  formData.set('benefitId', id);
  return formData;
}

function executedSql(): string {
  const query = mockExecuteRaw.mock.calls[0][0] as { strings: readonly string[] };
  return query.strings.join('');
}

describe('deleteCustomBenefitAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(session);
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('rejects unauthenticated deletes before validation or persistence', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(deleteCustomBenefitAction(deleteForm())).rejects.toThrow(
      'User not authenticated.'
    );
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('deletes only an owned definition with no standard classification or bridge', async () => {
    await expect(deleteCustomBenefitAction(deleteForm())).resolves.toEqual({ success: true });

    const sql = executedSql();
    expect(sql).toContain('DELETE FROM "Benefit" AS b');
    expect(sql).toContain('b."userId" =');
    expect(sql).toContain('owner_card."userId" =');
    expect(sql).toContain('custom_ledger."classification" = \'CUSTOM\'');
    expect(sql).toContain('bs."predefinedBenefitId" IS NOT NULL');
    expect(sql).toContain('ledger."classification" = \'STANDARD\'');
    expect(sql).toContain('FROM "GlobalBenefitCategoryRepair" repair');
    expect(sql).toContain('repair."phase" = \'APPLIED\'');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits/custom');
  });

  it('rejects an invalid delete ID before persistence', async () => {
    await expect(deleteCustomBenefitAction(deleteForm('not-a-cuid'))).rejects.toThrow(
      'Invalid custom benefit ID.'
    );
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('does not report success or revalidate when persistence fails', async () => {
    mockExecuteRaw.mockRejectedValue(new Error('Database error'));

    await expect(deleteCustomBenefitAction(deleteForm())).rejects.toThrow(
      'Failed to delete custom benefit.'
    );
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
