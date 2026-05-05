import type { FC, ReactNode, ElementType } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LogOut,
  LayoutDashboard,
  Users,
  FileText,
  History,
  CreditCard,
  Receipt,
  User,
  CalendarCheck,
  Home,
  Search,
  Stethoscope,
  FlaskConical,
  UserCheck,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: ElementType;
  href: string;
}

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getSidebarItems = (): NavItem[] => {
    if (!user) return [];

    if (user.role === 'assistant') {
      return [
        { label: 'Today', icon: Home, href: '/assistant/today' },
        { label: 'Add Payment', icon: CreditCard, href: '/assistant/add-payment' },
        { label: 'Add Expense', icon: Receipt, href: '/assistant/add-expense' },
        { label: 'History', icon: History, href: '/assistant/history' },
        { label: 'Patients', icon: Search, href: '/assistant/patients' },
      ];
    }

    if (user.role === 'doctor') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/doctor/dashboard' },
        { label: 'Patients', icon: Users, href: '/doctor/patients' },
        { label: 'Add Payment', icon: CreditCard, href: '/add-payment' },
        { label: 'Add Expense', icon: Receipt, href: '/add-expense' },
      ];
    }

    if (user.role === 'admin') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
        { label: 'Doctors', icon: Stethoscope, href: '/admin/doctors' },
        { label: 'Users', icon: User, href: '/admin/users' },
        { label: 'Patients', icon: UserCheck, href: '/admin/patients' },
        { label: 'Monthly Closing', icon: CalendarCheck, href: '/admin/monthly-closing' },
        { label: 'Lab Config', icon: FlaskConical, href: '/admin/lab-config' },
      ];
    }

    return [];
  };

  const getBottomNavItems = (): NavItem[] => {
    if (!user) return [];

    if (user.role === 'assistant') {
      return [
        { label: 'Today', icon: Home, href: '/assistant/today' },
        { label: 'Payment', icon: CreditCard, href: '/assistant/add-payment' },
        { label: 'Expense', icon: Receipt, href: '/assistant/add-expense' },
        { label: 'History', icon: History, href: '/assistant/history' },
        { label: 'Patients', icon: Search, href: '/assistant/patients' },
      ];
    }

    if (user.role === 'doctor') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/doctor/dashboard' },
        { label: 'Patients', icon: Users, href: '/doctor/patients' },
        { label: 'Payment', icon: CreditCard, href: '/add-payment' },
        { label: 'Expense', icon: Receipt, href: '/add-expense' },
      ];
    }

    if (user.role === 'admin') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
        { label: 'Patients', icon: UserCheck, href: '/admin/patients' },
        { label: 'Closing', icon: CalendarCheck, href: '/admin/monthly-closing' },
        { label: 'Labs', icon: FlaskConical, href: '/admin/lab-config' },
        { label: 'Users', icon: User, href: '/admin/users' },
      ];
    }

    return [];
  };

  const sidebarItems = getSidebarItems();
  const bottomNavItems = getBottomNavItems();
  const isActive = (href: string) => location.pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ── */}
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4 sm:px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logos/iconic-finance.png"
              alt="Iconic Finance"
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = 'none';
                if (el.nextElementSibling) (el.nextElementSibling as HTMLElement).style.display = 'flex';
              }}
            />
            <div className="w-9 h-9 bg-primary rounded-full items-center justify-center flex-shrink-0 hidden">
              <span className="text-white font-bold text-sm">IF</span>
            </div>
            <span className="font-bold text-base text-primary">Iconic Finance</span>
          </Link>

          {/* User + Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-foreground leading-tight">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-border sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <nav className="flex-1 p-3 space-y-0.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-auto min-h-[calc(100vh-3.5rem)]">
          <div className="p-4 sm:p-6 pb-24 lg:pb-6">{children}</div>
        </main>
      </div>

      {/* ── Bottom Nav — mobile only ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.07)]">
        <div className="flex items-stretch justify-around">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 px-1 relative transition-colors"
              >
                {/* Active top indicator */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />
                )}
                <Icon
                  className={`w-[22px] h-[22px] transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span
                  className={`text-[10px] font-medium leading-tight transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
