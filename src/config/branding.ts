export interface BrandConfig {
  companyName: string;
  tagline: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  features: {
    title: string;
    description: string;
  }[];
  footerText: string;
  version: string;
}

export const BRAND: BrandConfig = {
  companyName: 'Siddharth & Kunal Enterprise',
  tagline: 'Building Skills. Building Futures.',
  logo: 'logo.png',
  primaryColor: '#0F172A',
  secondaryColor: '#D4AF37',
  features: [
    { title: 'Learning', description: 'Curated training paths for every role' },
    { title: 'Performance', description: 'Track growth with real-time insights' },
    { title: 'Growth', description: 'Unlock career paths and certifications' },
  ],
  footerText: 'Siddharth & Kunal Enterprise',
  version: '1.0.0',
};