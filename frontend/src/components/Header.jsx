import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, Library as LibraryIcon, Feather, Cpu, FlaskConical, Network, ChevronDown, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const navCls = ({ isActive }) =>
  `px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
    isActive ? "text-amber-200 bg-amber-500/10" : "text-slate-300 hover:text-amber-200 hover:bg-white/5"
  }`;

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navLink = (to, testId, Icon, label) => (
    <NavLink
      to={to}
      data-testid={testId}
      className={navCls}
      onClick={closeMenu}
    >
      <Icon className="h-4 w-4 shrink-0" /> {label}
    </NavLink>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-amber-500/15 bg-slate-950/90">
      <div className="relative z-[60] h-full px-4 sm:px-8 flex items-center justify-start gap-3">
        <button
          type="button"
          data-testid="navigation-menu-toggle"
          aria-label={menuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="h-10 w-10 shrink-0 rounded-lg border border-amber-400/25 text-amber-200 hover:bg-amber-400/10 flex items-center justify-center"
        >
          <ChevronDown className={`h-5 w-5 -rotate-90 transition-transform ${menuOpen ? "rotate-90" : ""}`} />
        </button>
        <Link to="/" onClick={closeMenu} className="flex items-center gap-3 group" data-testid="brand-link">
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
      </div>

      {menuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú de navegación"
          data-testid="navigation-menu-backdrop"
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
        />
      )}
      <nav
        id="primary-navigation"
        aria-label="Navegación principal"
        data-testid="primary-navigation"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        className={`fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[85vw] overflow-y-auto border-r border-amber-400/25 bg-slate-950/95 px-4 pb-6 pt-20 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <span data-testid="demo-badge" className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/5 px-3 py-1 text-[11px] font-sans-ui uppercase tracking-[0.18em] text-amber-300/90">
          <Cpu className="h-3 w-3" /> Inferencia local
        </span>

        {user && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-400/15 bg-white/[0.03] p-3">
            <span data-testid="user-name" className="flex min-w-0 items-center gap-2 text-sm font-prose italic text-amber-200/90">
              <UserRound className="h-4 w-4 shrink-0 not-italic" />
              <span className="truncate">{user.name}</span>
            </span>
            <Button
              data-testid="logout-button"
              variant="ghost"
              className="shrink-0 text-slate-300 hover:text-amber-100 hover:bg-white/5"
              onClick={async () => { closeMenu(); await logout(); navigate("/"); }}
            >
              <LogOut className="h-4 w-4 mr-1" /> Salir
            </Button>
          </div>
        )}

        <div className="mt-6 px-3 py-2 text-xs uppercase tracking-[0.2em] text-amber-300/70 font-sans-ui">
          Navegación
        </div>
        <div className="flex flex-col gap-2 text-sm font-sans-ui">
          {user && (
            <>
              {navLink("/create", "nav-create-link", Feather, "Crear Cuento")}
              {navLink("/library", "nav-library-link", LibraryIcon, "Mi Biblioteca")}
              {navLink("/experiments", "nav-experiments-link", FlaskConical, "Experimentos")}
            </>
          )}
          {navLink("/about", "nav-about-link", Network, "Arquitectura")}
        </div>

        {!user && (
          <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5">
            <Link to="/login" onClick={closeMenu}>
              <Button data-testid="header-login-button" variant="ghost" className="w-full justify-start text-slate-200 hover:text-amber-100 hover:bg-white/5">
                Ingresar
              </Button>
            </Link>
            <Link to="/register" onClick={closeMenu}>
              <Button data-testid="header-register-button" className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300 font-medium">
                Crear cuenta
              </Button>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
