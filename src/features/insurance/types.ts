// Insurance module type definitions

export interface InsurancePlan {
  _id: string;
  _uid: string;
  planName: string;
  planType: 'basic' | 'standard' | 'premium' | 'family';
  coverage: CoverageItem[];
  monthlyPremium: number;
  annualPremium: number;
  deductible: number;
  maxCoverage: number;
  dependentsCovered: number;
  description: string;
  benefits: string[];
  restrictions: string;
  isActive: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoverageItem {
  type: string;
  limit: number;
  description: string;
}

export interface InsurancePolicy {
  _id: string;
  _uid: string;
  policyNumber: string;
  driverId: string;
  driverName: string;
  fleetId?: string;
  planId: string;
  planName: string;
  status: 'active' | 'pending' | 'suspended' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  premiumAmount: number;
  paymentFrequency: 'monthly' | 'annual';
  nextPaymentDue: string;
  totalPaid: number;
  dependents?: Dependent[];
  beneficiary: string;
  beneficiaryRelation: string;
  beneficiaryPhone: string;
  enrolledBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dependent {
  name: string;
  relationship: string;
  dateOfBirth: string;
}

export interface InsuranceClaim {
  _id: string;
  _uid: string;
  claimNumber: string;
  policyId: string;
  policyNumber: string;
  driverId: string;
  driverName: string;
  claimType: 'hospitalization' | 'consultation' | 'medication' | 'emergency' | 'dental' | 'optical' | 'other';
  claimAmount: number;
  approvedAmount: number;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  incidentDate: string;
  submittedDate: string;
  providerId?: string;
  providerName: string;
  diagnosis: string;
  treatment: string;
  documents: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthProvider {
  _id: string;
  _uid: string;
  providerName: string;
  providerType: 'hospital' | 'clinic' | 'pharmacy' | 'laboratory' | 'dental' | 'optical';
  specialties: string[];
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  latitude?: string;
  longitude?: string;
  operatingHours: string;
  emergencyServices: 'yes' | 'no';
  status: 'active' | 'inactive';
  networkTier: 'preferred' | 'standard' | 'out_of_network';
  contractNumber: string;
  rating: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollPolicyInput {
  driverId: string;
  driverName: string;
  fleetId?: string;
  planId: string;
  planName: string;
  premiumAmount: number;
  paymentFrequency: 'monthly' | 'annual';
  startDate: string;
  endDate: string;
  nextPaymentDue: string;
  dependents?: Dependent[];
  beneficiary: string;
  beneficiaryRelation: string;
  beneficiaryPhone: string;
}

export interface SubmitClaimInput {
  policyId: string;
  policyNumber: string;
  driverId: string;
  driverName: string;
  claimType: InsuranceClaim['claimType'];
  claimAmount: number;
  incidentDate: string;
  providerId?: string;
  providerName: string;
  diagnosis: string;
  treatment: string;
  documents: string[];
}
