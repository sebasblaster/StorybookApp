import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    setError("");
    const r = await register(name, email, password);
    setLoading(false);
    if (r.ok) {
      toast.success("Tu cuenta quedó encuadernada. Vamos al taller.");
      navigate("/create");
    } else {
      setError(r.error);
    }
  };

  return (
    <main className="min-h-[calc(100vh-72px)] relative flex items-center justify-center px-6 py-12">
      <div className="aurora" />
      <div className="relative w-full max-w-md parchment paper-grain rounded-2xl p-8 sm:p-10 animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full border border-amber-400/40 bg-slate-900 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-amber-100">Abrir el códice</h1>
            <p className="text-sm text-slate-400 font-sans-ui">Crea tu cuenta en segundos</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-amber-200/90">Tu nombre</Label>
            <Input id="name" data-testid="register-name-input" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Por ejemplo: Ana del Bosque" className="mt-1.5 bg-slate-900/70 border-amber-500/20 focus-visible:ring-amber-400/40 text-amber-50" />
          </div>
          <div>
            <Label htmlFor="email" className="text-amber-200/90">Correo</Label>
            <Input id="email" data-testid="register-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com" className="mt-1.5 bg-slate-900/70 border-amber-500/20 focus-visible:ring-amber-400/40 text-amber-50" />
          </div>
          <div>
            <Label htmlFor="password" className="text-amber-200/90">Contraseña</Label>
            <Input id="password" data-testid="register-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Al menos 6 caracteres" className="mt-1.5 bg-slate-900/70 border-amber-500/20 focus-visible:ring-amber-400/40 text-amber-50" />
          </div>
          {error && (
            <div data-testid="register-error" className="text-sm text-red-300 bg-red-950/40 border border-red-500/30 rounded-md px-3 py-2">{error}</div>
          )}
          <Button type="submit" disabled={loading} data-testid="register-submit-button" className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-medium py-5">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear cuenta
          </Button>
        </form>

        <p className="mt-6 text-sm text-slate-400 font-sans-ui text-center">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-amber-300 hover:text-amber-200" data-testid="register-to-login-link">Inicia sesión</Link>
        </p>
      </div>
    </main>
  );
}
