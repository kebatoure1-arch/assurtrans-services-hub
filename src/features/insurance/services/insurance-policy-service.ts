import { table } from '@devvai/devv-code-backend';
import { InsurancePolicy, EnrollPolicyInput } from '../types';
import { awardInsurancePaymentPoints } from '../../loyalty/services/loyalty-account-service';

const TABLE_ID = 'f4f4hkyix7up'; // insurance_policies table ID

export const insurancePolicyService = {
  // Generate unique policy number
  generatePolicyNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `POL-${year}${month}${day}-${random}`;
  },

  // Enroll driver in insurance policy
  async enrollPolicy(input: EnrollPolicyInput): Promise<void> {
    try {
      const policyNumber = this.generatePolicyNumber();
      
      const newPolicy = {
        policyNumber,
        ...input,
        status: 'pending',
        totalPaid: 0,
        dependents: input.dependents ? JSON.stringify(input.dependents) : '[]',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await table.addItem(TABLE_ID, newPolicy);
    } catch (error) {
      console.error('Error enrolling policy:', error);
      throw error;
    }
  },

  // Get policies by driver
  async getPoliciesByDriver(driverId: string): Promise<InsurancePolicy[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          driverId
        }
      });
      
      return result.items.map((policy: any) => ({
        ...policy,
        dependents: policy.dependents ? JSON.parse(policy.dependents as any) : []
      }));
    } catch (error) {
      console.error('Error fetching driver policies:', error);
      return [];
    }
  },

  // Get policies by fleet
  async getPoliciesByFleet(fleetId: string): Promise<InsurancePolicy[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          fleetId
        }
      });
      
      return result.items.map((policy: any) => ({
        ...policy,
        dependents: policy.dependents ? JSON.parse(policy.dependents as any) : []
      }));
    } catch (error) {
      console.error('Error fetching fleet policies:', error);
      return [];
    }
  },

  // Get all policies
  async getAllPolicies(): Promise<InsurancePolicy[]> {
    try {
      const result = await table.getItems(TABLE_ID);
      
      return result.items.map((policy: any) => ({
        ...policy,
        dependents: policy.dependents ? JSON.parse(policy.dependents as any) : []
      }));
    } catch (error) {
      console.error('Error fetching all policies:', error);
      return [];
    }
  },

  // Get policy by ID
  async getPolicyById(policyId: string): Promise<InsurancePolicy | null> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          _id: policyId
        }
      });
      
      if (result.items.length === 0) return null;
      
      const policy: any = result.items[0];
      return {
        ...policy,
        dependents: policy.dependents ? JSON.parse(policy.dependents) : []
      } as InsurancePolicy;
    } catch (error) {
      console.error('Error fetching policy by ID:', error);
      return null;
    }
  },

  // Update policy status
  async updatePolicyStatus(policy: InsurancePolicy, status: InsurancePolicy['status']): Promise<void> {
    try {
      await table.updateItem(TABLE_ID, {
        ...policy,
        dependents: JSON.stringify(policy.dependents || []),
        status,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating policy status:', error);
      throw error;
    }
  },

  // Record premium payment
  async recordPayment(policy: InsurancePolicy, amount: number): Promise<void> {
    try {
      const totalPaid = (policy.totalPaid || 0) + amount;
      
      // Calculate next payment due
      let nextPaymentDue = new Date(policy.nextPaymentDue);
      if (policy.paymentFrequency === 'monthly') {
        nextPaymentDue.setMonth(nextPaymentDue.getMonth() + 1);
      } else {
        nextPaymentDue.setFullYear(nextPaymentDue.getFullYear() + 1);
      }
      
      await table.updateItem(TABLE_ID, {
        ...policy,
        dependents: JSON.stringify(policy.dependents || []),
        totalPaid,
        nextPaymentDue: nextPaymentDue.toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Award loyalty points for insurance payment
      try {
        await awardInsurancePaymentPoints(policy.driverId, amount, policy._id);
      } catch (error) {
        console.error('Error awarding loyalty points:', error);
        // Don't fail the payment if points award fails
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  },

  // Get expiring policies (within 30 days)
  async getExpiringPolicies(): Promise<InsurancePolicy[]> {
    try {
      const allPolicies = await this.getAllPolicies();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      return allPolicies.filter(policy => {
        const endDate = new Date(policy.endDate);
        const now = new Date();
        return policy.status === 'active' && endDate > now && endDate <= thirtyDaysFromNow;
      });
    } catch (error) {
      console.error('Error fetching expiring policies:', error);
      return [];
    }
  },

  // Get policies with payment due
  async getPoliciesWithPaymentDue(): Promise<InsurancePolicy[]> {
    try {
      const allPolicies = await this.getAllPolicies();
      const today = new Date();
      
      return allPolicies.filter(policy => {
        const nextPayment = new Date(policy.nextPaymentDue);
        return policy.status === 'active' && nextPayment <= today;
      });
    } catch (error) {
      console.error('Error fetching policies with payment due:', error);
      return [];
    }
  }
};
