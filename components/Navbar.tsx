
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TexaUser } from '../services/firebase';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  user: TexaUser | null;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-[100] glass border-b border-white/10 px-4 md:px-6 py-3 md:py-4 smooth-animate">
      <div className="container mx-auto flex justify-between items-center max-w-7xl">
        <Link to="/" className="flex items-center gap-2 md:gap-3 group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(79,70,229,0.5)] group-hover:scale-110 transition-all duration-300 flex items-center justify-center bg-black">
            <img
              src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExaG9teHpqbDg1d2w1cXlldWltOGd4eXp1bGRmenJtMHp4M2F1amV1MyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dXlUFmuOWFRlHYgc9i/giphy.gif"
              alt="TEXA-Ai Logo"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg md:text-xl font-black tracking-tighter text-white">TEXA<span className="text-indigo-400">-Ai</span></span>
            <span className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest hidden xs:block">AI Marketplace</span>
          </div>
        </Link>

        <div className="flex items-center gap-2 md:gap-4">
          <Link to="/" className="text-xs md:text-sm font-semibold text-theme-secondary hover:text-theme-primary transition-colors hidden sm:block">Marketplace</Link>

          {/* Theme Toggle */}
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-3 md:gap-5">
              {user.role === 'ADMIN' && (
                <Link to="/admin" className="hidden lg:block text-[10px] font-black text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full border border-amber-400/20 uppercase tracking-widest">
                  Admin
                </Link>
              )}
              <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
              <Link to="/profile" className="flex items-center gap-2 group">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.name}
                    className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-indigo-500/50 shadow-lg object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold border-2 border-white/10 shadow-lg">
                    {user.name[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden md:flex flex-col">
                  <span className="text-[10px] font-bold leading-none text-theme-primary">{user.name.split(' ')[0]}</span>
                  <span className="text-[8px] text-emerald-400 font-medium">Online</span>
                </div>
              </Link>
              <button
                onClick={() => { onLogout(); navigate('/'); }}
                className="text-[10px] md:text-xs font-bold text-gray-400 hover:text-red-400 transition-colors"
              >
                Keluar
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 md:px-6 py-2 md:py-2.5 rounded-xl premium-gradient text-xs md:text-sm font-black hover:brightness-110 shadow-xl shadow-indigo-600/20 active:scale-95 smooth-animate"
            >
              Mulai
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
