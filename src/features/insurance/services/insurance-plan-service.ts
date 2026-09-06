import { table } from '@devvai/devv-code-backend';
import { InsurancePlan } from '../types';

const TABLE_ID = 'f4f4hkygf56o'; // insurance_plans table ID

export const insurancePlanService = {
  // Get all active insurance plans
  async getAllPlans(): Promise<InsurancePlan[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          isActive: 'active'
        }
      });
      
      // Parse JSON fields
      return result.items.map((plan: any) => ({
        ...plan,
        coverage: plan.coverage ? JSON.parse(plan.coverage) : [],
        benefits: plan.benefits ? JSON.parse(plan.benefits) : []
      }));
    } catch (error) {
      console.error('Error fetching insurance plans:', error);
      return [];
    }
  },

  // Get plans by type
  async getPlansByType(planType: string): Promise<InsurancePlan[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          planType,
          isActive: 'active'
        }
      });
      
      return result.items.map((plan: any) => ({
        ...plan,
        coverage: plan.coverage ? JSON.parse(plan.coverage) : [],
        benefits: plan.benefits ? JSON.parse(plan.benefits) : []
      }));
    } catch (error) {
      console.error('Error fetching plans by type:', error);
      return [];
    }
  },

  // Get plan by ID
  async getPlanById(planId: string): Promise<InsurancePlan | null> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          _id: planId
        }
      });
      
      if (result.items.length === 0) return null;
      
      const plan: any = result.items[0];
      return {
        ...plan,
        coverage: plan.coverage ? JSON.parse(plan.coverage) : [],
        benefits: plan.benefits ? JSON.parse(plan.benefits) : []
      } as InsurancePlan;
    } catch (error) {
      console.error('Error fetching plan by ID:', error);
      return null;
    }
  },

  // Create insurance plan (Admin/Agent only)
  async createPlan(planData: Partial<InsurancePlan>): Promise<void> {
    try {
      const newPlan = {
        ...planData,
        coverage: JSON.stringify(planData.coverage || []),
        benefits: JSON.stringify(planData.benefits || []),
        isActive: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await table.addItem(TABLE_ID, newPlan);
    } catch (error) {
      console.error('Error creating insurance plan:', error);
      throw error;
    }
  },

  // Update insurance plan
  async updatePlan(plan: InsurancePlan): Promise<void> {
    try {
      const updatedPlan = {
        ...plan,
        coverage: JSON.stringify(plan.coverage),
        benefits: JSON.stringify(plan.benefits),
        updatedAt: new Date().toISOString()
      };
      
      await table.updateItem(TABLE_ID, updatedPlan);
    } catch (error) {
      console.error('Error updating insurance plan:', error);
      throw error;
    }
  },

  // Delete insurance plan (soft delete - set to inactive)
  async deletePlan(planId: string, uid: string): Promise<void> {
    try {
      const plan = await this.getPlanById(planId);
      if (!plan) throw new Error('Plan not found');
      
      await table.updateItem(TABLE_ID, {
        ...plan,
        _uid: uid,
        isActive: 'inactive',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting insurance plan:', error);
      throw error;
    }
  },

  // Seed initial insurance plans
  async seedPlans(): Promise<void> {
    try {
      const existingPlans = await this.getAllPlans();
      if (existingPlans.length > 0) {
        console.log('Insurance plans already seeded');
        return;
      }

      const plans = [
        {
          planName: 'Assurance Santé Basic',
          planType: 'basic',
          coverage: [
            { type: 'Consultation', limit: 50000, description: 'Jusqu\'à 50,000 XOF par an' },
            { type: 'Médicaments', limit: 100000, description: 'Jusqu\'à 100,000 XOF par an' },
            { type: 'Urgence', limit: 500000, description: 'Jusqu\'à 500,000 XOF par an' }
          ],
          monthlyPremium: 5000,
          annualPremium: 55000,
          deductible: 10000,
          maxCoverage: 650000,
          dependentsCovered: 0,
          description: 'Couverture essentielle pour les soins de santé de base',
          benefits: [
            'Consultations médicales générales',
            'Médicaments sur ordonnance',
            'Soins d\'urgence',
            'Analyses de laboratoire basiques'
          ],
          restrictions: 'Soins dentaires et optiques non couverts. Franchise annuelle de 10,000 XOF.'
        },
        {
          planName: 'Assurance Santé Standard',
          planType: 'standard',
          coverage: [
            { type: 'Consultation', limit: 100000, description: 'Jusqu\'à 100,000 XOF par an' },
            { type: 'Hospitalisation', limit: 1000000, description: 'Jusqu\'à 1,000,000 XOF par an' },
            { type: 'Médicaments', limit: 200000, description: 'Jusqu\'à 200,000 XOF par an' },
            { type: 'Urgence', limit: 1500000, description: 'Jusqu\'à 1,500,000 XOF par an' },
            { type: 'Dentaire', limit: 50000, description: 'Jusqu\'à 50,000 XOF par an' }
          ],
          monthlyPremium: 12000,
          annualPremium: 130000,
          deductible: 20000,
          maxCoverage: 2850000,
          dependentsCovered: 1,
          description: 'Couverture complète avec hospitalisation et soins spécialisés',
          benefits: [
            'Toutes les prestations du plan Basic',
            'Hospitalisation et chirurgie',
            'Soins dentaires de base',
            'Un dépendant couvert',
            'Consultations spécialisées'
          ],
          restrictions: 'Soins optiques non couverts. Franchise annuelle de 20,000 XOF.'
        },
        {
          planName: 'Assurance Santé Premium',
          planType: 'premium',
          coverage: [
            { type: 'Consultation', limit: 200000, description: 'Jusqu\'à 200,000 XOF par an' },
            { type: 'Hospitalisation', limit: 3000000, description: 'Jusqu\'à 3,000,000 XOF par an' },
            { type: 'Médicaments', limit: 500000, description: 'Jusqu\'à 500,000 XOF par an' },
            { type: 'Urgence', limit: 5000000, description: 'Jusqu\'à 5,000,000 XOF par an' },
            { type: 'Dentaire', limit: 150000, description: 'Jusqu\'à 150,000 XOF par an' },
            { type: 'Optique', limit: 100000, description: 'Jusqu\'à 100,000 XOF par an' }
          ],
          monthlyPremium: 25000,
          annualPremium: 275000,
          deductible: 0,
          maxCoverage: 8950000,
          dependentsCovered: 3,
          description: 'Couverture maximale avec soins premium et sans franchise',
          benefits: [
            'Toutes les prestations du plan Standard',
            'Couverture maximale',
            'Soins optiques inclus',
            'Jusqu\'à 3 dépendants couverts',
            'Sans franchise',
            'Accès prioritaire aux spécialistes',
            'Assistance médicale 24/7'
          ],
          restrictions: 'Aucune restriction majeure. Certaines procédures cosmétiques non couvertes.'
        },
        {
          planName: 'Assurance Santé Famille',
          planType: 'family',
          coverage: [
            { type: 'Consultation', limit: 300000, description: 'Jusqu\'à 300,000 XOF par an' },
            { type: 'Hospitalisation', limit: 5000000, description: 'Jusqu\'à 5,000,000 XOF par an' },
            { type: 'Médicaments', limit: 750000, description: 'Jusqu\'à 750,000 XOF par an' },
            { type: 'Urgence', limit: 7000000, description: 'Jusqu\'à 7,000,000 XOF par an' },
            { type: 'Dentaire', limit: 250000, description: 'Jusqu\'à 250,000 XOF par an' },
            { type: 'Optique', limit: 200000, description: 'Jusqu\'à 200,000 XOF par an' }
          ],
          monthlyPremium: 40000,
          annualPremium: 440000,
          deductible: 0,
          maxCoverage: 13500000,
          dependentsCovered: 5,
          description: 'Couverture familiale complète pour le chauffeur et jusqu\'à 5 dépendants',
          benefits: [
            'Toutes les prestations du plan Premium',
            'Couverture familiale complète',
            'Jusqu\'à 5 dépendants couverts',
            'Soins pédiatriques inclus',
            'Vaccination et soins préventifs',
            'Maternité couverte',
            'Assistance médicale 24/7 pour toute la famille'
          ],
          restrictions: 'Aucune restriction majeure. Certaines procédures cosmétiques non couvertes.'
        }
      ];

      for (const plan of plans) {
        await this.createPlan(plan);
      }

      console.log('Insurance plans seeded successfully');
    } catch (error) {
      console.error('Error seeding insurance plans:', error);
      throw error;
    }
  }
};
