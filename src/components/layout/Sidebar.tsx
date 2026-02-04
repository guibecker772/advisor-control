import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Repeat,
  DollarSign,
  ArrowDownUp,
  Package,
  Goal,
  Calendar,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Prospects', href: '/prospects', icon: UserPlus },
  { name: 'Captação', href: '/captacao', icon: ArrowDownUp },
  { name: 'Cross Selling', href: '/cross', icon: Repeat },
  { name: 'Ofertas/Ativos', href: '/ofertas', icon: Package },
  { name: 'Agendas', href: '/agendas', icon: Calendar },
  { name: 'Metas', href: '/metas', icon: Goal },
  { name: 'Salário', href: '/salario', icon: DollarSign },
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-gray-900 min-h-screen">
      <div className="p-6">
        <h1 className="text-white text-xl font-bold">Metas Pro</h1>
        <p className="text-gray-400 text-sm">Advisor Control</p>
      </div>
      
      <nav className="mt-6">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white border-r-4 border-blue-400'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
