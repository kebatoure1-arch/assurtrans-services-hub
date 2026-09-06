import { table } from '@devvai/devv-code-backend';
import { InsuranceClaim, SubmitClaimInput } from '../types';

const TABLE_ID = 'f4f4hkylexvk'; // insurance_claims table ID

export const insuranceClaimService = {
  // Generate unique claim number
  generateClaimNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CLM-${year}${month}${day}-${random}`;
  },

  // Submit insurance claim
  async submitClaim(input: SubmitClaimInput): Promise<void> {
    try {
      const claimNumber = this.generateClaimNumber();
      
      const newClaim = {
        claimNumber,
        ...input,
        status: 'submitted',
        approvedAmount: 0,
        submittedDate: new Date().toISOString(),
        documents: JSON.stringify(input.documents || []),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await table.addItem(TABLE_ID, newClaim);
    } catch (error) {
      console.error('Error submitting claim:', error);
      throw error;
    }
  },

  // Get claims by driver
  async getClaimsByDriver(driverId: string): Promise<InsuranceClaim[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          driverId
        }
      });
      
      return result.items.map((claim: any) => ({
        ...claim,
        documents: claim.documents ? JSON.parse(claim.documents as any) : []
      }));
    } catch (error) {
      console.error('Error fetching driver claims:', error);
      return [];
    }
  },

  // Get claims by policy
  async getClaimsByPolicy(policyId: string): Promise<InsuranceClaim[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          policyId
        }
      });
      
      return result.items.map((claim: any) => ({
        ...claim,
        documents: claim.documents ? JSON.parse(claim.documents as any) : []
      }));
    } catch (error) {
      console.error('Error fetching policy claims:', error);
      return [];
    }
  },

  // Get all claims
  async getAllClaims(): Promise<InsuranceClaim[]> {
    try {
      const result = await table.getItems(TABLE_ID);
      
      return result.items.map((claim: any) => ({
        ...claim,
        documents: claim.documents ? JSON.parse(claim.documents as any) : []
      }));
    } catch (error) {
      console.error('Error fetching all claims:', error);
      return [];
    }
  },

  // Get claim by ID
  async getClaimById(claimId: string): Promise<InsuranceClaim | null> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          _id: claimId
        }
      });
      
      if (result.items.length === 0) return null;
      
      const claim: any = result.items[0];
      return {
        ...claim,
        documents: claim.documents ? JSON.parse(claim.documents) : []
      } as InsuranceClaim;
    } catch (error) {
      console.error('Error fetching claim by ID:', error);
      return null;
    }
  },

  // Update claim status
  async updateClaimStatus(
    claim: InsuranceClaim,
    status: InsuranceClaim['status'],
    reviewedBy?: string,
    approvedAmount?: number,
    rejectionReason?: string
  ): Promise<void> {
    try {
      const updatedClaim: any = {
        ...claim,
        documents: JSON.stringify(claim.documents || []),
        status,
        updatedAt: new Date().toISOString()
      };
      
      if (reviewedBy) {
        updatedClaim.reviewedBy = reviewedBy;
        updatedClaim.reviewedAt = new Date().toISOString();
      }
      
      if (approvedAmount !== undefined) {
        updatedClaim.approvedAmount = approvedAmount;
      }
      
      if (rejectionReason) {
        updatedClaim.rejectionReason = rejectionReason;
      }
      
      await table.updateItem(TABLE_ID, updatedClaim);
    } catch (error) {
      console.error('Error updating claim status:', error);
      throw error;
    }
  },

  // Get pending claims for review
  async getPendingClaims(): Promise<InsuranceClaim[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          status: 'submitted'
        }
      });
      
      return result.items.map((claim: any) => ({
        ...claim,
        documents: claim.documents ? JSON.parse(claim.documents as any) : []
      }));
    } catch (error) {
      console.error('Error fetching pending claims:', error);
      return [];
    }
  },

  // Get claims statistics
  async getClaimsStatistics() {
    try {
      const allClaims = await this.getAllClaims();
      
      const totalClaims = allClaims.length;
      const pendingClaims = allClaims.filter(c => c.status === 'submitted' || c.status === 'under_review').length;
      const approvedClaims = allClaims.filter(c => c.status === 'approved' || c.status === 'paid').length;
      const rejectedClaims = allClaims.filter(c => c.status === 'rejected').length;
      
      const totalClaimedAmount = allClaims.reduce((sum, claim) => sum + claim.claimAmount, 0);
      const totalApprovedAmount = allClaims.reduce((sum, claim) => sum + claim.approvedAmount, 0);
      
      return {
        totalClaims,
        pendingClaims,
        approvedClaims,
        rejectedClaims,
        totalClaimedAmount,
        totalApprovedAmount
      };
    } catch (error) {
      console.error('Error getting claims statistics:', error);
      return {
        totalClaims: 0,
        pendingClaims: 0,
        approvedClaims: 0,
        rejectedClaims: 0,
        totalClaimedAmount: 0,
        totalApprovedAmount: 0
      };
    }
  }
};
