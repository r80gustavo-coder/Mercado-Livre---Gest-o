import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Package, Factory, Truck, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout }) => {
  const menuItems = [
    { view: ViewState.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
    { view: ViewState.PRODUCTS, icon: Package, label: 'Produtos' },
    { view: ViewState.FACTORY, icon: Factory, label: 'Fábrica' },
    { view: ViewState.BATCHES, icon: Truck, label: 'Envios Full' },
    { view: ViewState.SETTINGS, icon: Settings, label: 'Configurações' },
  ];

  return (
    <div className="w-64 bg-white h-screen shadow-lg flex flex-col fixed left-0 top-0 z-20 hidden md:flex">
      <div className="p-6 border-b border-gray-100 flex items-center gap-2">
        <div className="w-8 h-8 bg-ml-yellow rounded-full flex items-center justify-center font-bold text-ml-blue">
          F
        </div>
        <h1 className="text-xl font-bold text-ml-blue">FullStock</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onChangeView(item.view)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === item.view
                ? 'bg-ml-blue text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;