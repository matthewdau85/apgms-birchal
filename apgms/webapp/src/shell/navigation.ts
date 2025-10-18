export type NavItem = {
  name: string;
  to: string;
};

export const navigation: NavItem[] = [
  { name: 'Dashboard', to: '/' },
  { name: 'Bank lines', to: '/bank-lines' }
];
