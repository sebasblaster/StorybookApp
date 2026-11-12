import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, Library as LibraryIcon, Feather, Cpu, FlaskConical, Network } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const navCls = ({ isActive }) =>
  `px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
    isActive ? "text-amber-200 bg-amber-500/10" : "text-slate-300 hover:text-amber-200 hover:bg-white/5"
  }`;

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/70 border-b border-amber-500/15">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group" data-testid="brand-link">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-md group-hover:bg-amber-400/40 transition" />
            <div className="relative h-10 w-10 rounded-full border border-amber-400/40 flex items-center justify-center bg-slate-900">
              <BookOpen className="h-5 w-5 text-amber-300" />
            </div>
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl text-amber-100 tracking-wide">Storybook</div>
            <div className="text-[11px] font-sans-ui uppercase tracking-[0.2em] text-amber-300/60">Códice Narrativo</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm font-sans-ui">
          {user && (
            <>
              <NavLink to="/create" data-testid="nav-create-link" className={navCls}>
                <Feather className="h-4 w-4" /> Crear Cuento
              </NavLink>
              <NavLink to="/library" data-testid="nav-library-link" className={navCls}>
                <LibraryIcon className="h-4 w-4" /> Mi Biblioteca
              </NavLink>
              <NavLink to="/experiments" data-testid="nav-experiments-link" className={navCls}>
                <FlaskConical className="h-4 w-4" /> Experimentos
              </NavLink>
            </>
          )}
          <NavLink to="/about" data-testid="nav-about-link" className={navCls}>
            <Network className="h-4 w-4" /> Arquitectura
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <span
            data-testid="demo-badge"
            className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-sans-ui uppercase tracking-[0.18em] text-amber-300/90 border border-amber-400/30 rounded-full px-3 py-1 bg-amber-400/5"
          >
            <Cpu className="h-3 w-3" /> 100% local
          </span>
          {user ? (
            <>
              <span data-testid="user-name" className="hidden md:block text-sm font-prose text-amber-200/90 italic">
                {user.name}
              </span>
              <Button
                data-testid="logout-button"
                variant="ghost"
                className="text-slate-300 hover:text-amber-100 hover:bg-white/5"
                onClick={async () => { await logout(); navigate("/"); }}
              >
                <LogOut className="h-4 w-4 mr-1" /> Salir
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button data-testid="header-login-button" variant="ghost" className="text-slate-200 hover:text-amber-100 hover:bg-white/5">
                  Ingresar
                </Button>
              </Link>
              <Link to="/register">
                <Button data-testid="header-register-button" className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-medium">
                  Crear cuenta
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
