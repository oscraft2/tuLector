"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary } from "@zxcvbn-ts/language-common";
import { createClient } from "@/lib/supabase";
import { TuLectorLogo } from "@/components/TuLectorLogo";
import { isNativeApp, nativePlatform, openExternalUrl, googleNativeSignIn, appleNativeSignIn, OAUTH_DEEP_LINK } from "@/lib/native/capacitor";
import { BiometricGate } from "@/components/native/BiometricGate";
import { BiometricToggle } from "@/components/native/BiometricToggle";

const passwordEstimator = new ZxcvbnFactory({
  dictionary,
  graphs: adjacencyGraphs,
});

const PASSWORD_MIN_LENGTH = 12;

type OAuthProvider = "google" | "apple";

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-[#6b7280] text-sm">Cargando...</div>
      </main>
    }>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const searchParams = useSearchParams();
  const initialMode: "login" | "register" = searchParams.get("mode") === "register" ? "register" : "login";
  const initialMessage = (() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const msg = decodeURIComponent(errorParam);
      return msg.length > 200 ? msg.slice(0, 200) + "..." : msg;
    }
    return "";
  })();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [message, setMessage] = useState(initialMessage);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [native, setNative] = useState(false);
  const [bioDone, setBioDone] = useState(false);
  const [oldApk, setOldApk] = useState(false);
  const router = useRouter();
  const client = useMemo(() => createClient(), []);

  const passwordAnalysis = useMemo(() => {
    if (!password) return null;
    return passwordEstimator.check(password, [email]);
  }, [email, password]);

  const passwordScore = passwordAnalysis?.score ?? 0;
  const passwordStrongEnough = password.length >= PASSWORD_MIN_LENGTH && passwordScore >= 2;
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const busy = loading || oauthLoading !== null;

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setNative(isNativeApp() || searchParams.get("app") === "1");
    });
    return () => { active = false; };
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const check = () => {
      if (!active) return;
      const w = window as unknown as { Capacitor?: { getPlatform?: () => string } };
      if (w.Capacitor?.getPlatform?.() === "android" && !/TuLectorApp/i.test(navigator.userAgent)) {
        setOldApk(true);
      }
    };
    check();
    const timer = setTimeout(check, 2000);
    return () => { active = false; clearTimeout(timer); };
  }, []);

  const homeAfterAuth = () => (isNativeApp() ? "/app" : "/dashboard");

  useEffect(() => {
    client.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(homeAfterAuth());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "register") {
        if (!acceptedTerms) {
          setMessage("Debes aceptar los terminos y la politica de privacidad para crear la cuenta.");
          return;
        }
        if (password !== confirmPassword) {
          setMessage("Las contrasenas no coinciden.");
          return;
        }
        if (!passwordStrongEnough) {
          setMessage(`Usa una contrasena de al menos ${PASSWORD_MIN_LENGTH} caracteres y evita secuencias o datos faciles de adivinar.`);
          return;
        }

        const { error } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: authCallbackUrl(),
          },
        });
        if (error) throw error;
        setMessage("Cuenta creada. Revisa tu correo para confirmar el acceso si la verificacion esta activa.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        router.replace(homeAfterAuth());
      }
    } catch (err) {
      const authErr = err as AuthError;
      setMessage(authErr.message || "Error de autenticacion");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    setMessage("");
    try {
      if (isNativeApp() && provider === "google") {
        // APK: login nativo con Credential Manager (bottom-sheet del sistema con
        // las cuentas Google del dispositivo). NO abre navegador. El idToken se
        // canjea directo por sesión de Supabase.
        const idToken = await googleNativeSignIn();
        if (!idToken) {
          setMessage("No se pudo iniciar sesion con Google.");
          setOauthLoading(null);
          return;
        }
        const { error } = await client.auth.signInWithIdToken({ provider: "google", token: idToken });
        if (error) throw error;
        router.replace(homeAfterAuth());
        return;
      }

      if (isNativeApp() && provider === "apple" && nativePlatform() === "ios") {
        // iOS: Sign in with Apple nativo (AuthenticationServices), sin salir
        // de la app. Requiere la capability habilitada en el proyecto Xcode
        // (ios/App/App/App.entitlements) — ver docs/apk-plan.md.
        const idToken = await appleNativeSignIn();
        if (!idToken) {
          setMessage("No se pudo iniciar sesion con Apple.");
          setOauthLoading(null);
          return;
        }
        const { error } = await client.auth.signInWithIdToken({ provider: "apple", token: idToken });
        if (error) throw error;
        router.replace(homeAfterAuth());
        return;
      }

      if (isNativeApp()) {
        // Apple en Android no tiene SDK nativo: sale a Chrome Custom Tabs y
        // Supabase vuelve por deep link; NativeBootstrap canjea el code por sesión.
        const { data, error } = await client.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: OAUTH_DEEP_LINK,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("No se pudo iniciar el flujo de autenticacion.");
        const opened = await openExternalUrl(data.url);
        if (!opened) window.location.assign(data.url);
        setOauthLoading(null);
        return;
      }

      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: authCallbackUrl(),
          queryParams: provider === "google" ? { access_type: "offline", prompt: "consent" } : undefined,
        },
      });
      if (error) throw error;
    } catch (err) {
      const authErr = err as AuthError;
      setMessage(authErr.message || `No se pudo iniciar sesion con ${provider === "google" ? "Google" : "Apple"}`);
      setOauthLoading(null);
    }
  };

  if (native) {
    return (
      <>
        <BiometricGate
          onFallback={() => setBioDone(true)}
          onSuccess={(path) => router.replace(path)}
          homePath={homeAfterAuth()}
        />
        <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#111827] text-white">
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#07305f]/50 blur-3xl" />
        <div className="pointer-events-none absolute left-[-6rem] top-1/3 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="safe-pt flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="cap-anim-pop mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-black text-[#111827] shadow-lg">TL</div>
          <h1 className="cap-anim-up text-3xl font-black tracking-tight">TuLector</h1>
          <p className="cap-anim-up cap-delay-2 mt-2 max-w-xs text-sm text-white/60">Escanea hojas de respuesta al instante, con la misma cuenta que la web.</p>
        </div>

        <div className="cap-anim-sheet safe-pb relative rounded-t-[2rem] bg-white px-6 pt-7 pb-7 text-[#0b1220] shadow-[0_-10px_50px_rgba(0,0,0,0.3)]">
          <h2 className="text-center text-lg font-black">{mode === "login" ? "Inicia sesion" : "Crear cuenta"}</h2>
          <p className="mt-1 mb-5 text-center text-xs text-gray-400">Accede con Google, Apple o tu correo para escanear</p>

          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={busy}
            className="mb-3 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#cfd6df] bg-white px-4 py-3.5 text-sm font-bold text-[#111827] shadow-sm transition-all hover:bg-[#f8faf9] disabled:opacity-50 active:scale-[0.99]"
          >
            <GoogleIcon />
            {oauthLoading === "google" ? "Conectando..." : "Continuar con Google"}
          </button>

          {/* Apple 4.8: si se ofrece un login de terceros (Google), Sign in with
           * Apple debe estar con igual prominencia — visible en iOS y Android
           * (Android sale a Custom Tabs, iOS usa AuthenticationServices nativo). */}
          <button
            type="button"
            onClick={() => handleOAuth("apple")}
            disabled={busy}
            className="mb-4 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#111827] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-black disabled:opacity-50 active:scale-[0.99]"
          >
            <AppleIcon />
            {oauthLoading === "apple" ? "Conectando..." : "Continuar con Apple"}
          </button>

          <div className="mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9aa3af]"><span className="h-px flex-1 bg-[#e5e9ee]" />o con correo<span className="h-px flex-1 bg-[#e5e9ee]" /></div>

          <form onSubmit={handleAuth} className="space-y-3">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#cfd6df] bg-white px-4 py-3.5 text-sm outline-none transition-all placeholder:text-[#9aa3af] focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/10"
              placeholder="tu@colegio.cl" autoComplete="email" required
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#cfd6df] bg-white px-4 py-3.5 text-sm outline-none transition-all placeholder:text-[#9aa3af] focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/10"
              placeholder="Contrasena" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6}
            />
            {mode === "register" && (
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-[#cfd6df] bg-white px-4 py-3.5 text-sm outline-none transition-all placeholder:text-[#9aa3af] focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/10"
                placeholder="Confirmar contrasena" autoComplete="new-password" required minLength={6}
              />
            )}
            {message ? <AuthMessage message={message} /> : null}
            <button
              type="submit" disabled={busy}
              className="w-full rounded-xl bg-[#07305f] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#0b3f78] disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            {mode === "login" ? "No tienes cuenta? " : "Ya tienes cuenta? "}
            <button onClick={() => switchMode(mode === "login" ? "register" : "login")} className="font-bold text-[#07305f]">
              {mode === "login" ? "Crear cuenta" : "Iniciar sesion"}
            </button>
          </p>

          {mode === "login" ? (
            <div className="mt-4 rounded-xl border border-[#e5e9ee] bg-[#f8faf9] p-3 text-[#0b1220]">
              <BiometricToggle />
            </div>
          ) : null}
        </div>
      </main>
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8faf9] px-4 py-4 text-[#0b1220] md:px-5 md:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-32px)] max-w-6xl items-start gap-6 md:min-h-[calc(100vh-80px)] lg:grid-cols-[1fr_460px] lg:items-center">
        <section className="hidden max-w-2xl py-6 lg:block">
          <TuLectorLogo href="/" size="lg" />
          <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#2f6f5e]">Plataforma internacional para equipos educativos</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-[0.98] tracking-tight text-[#111827] md:text-6xl">
            Corrige ensayos, simulacros y pruebas en minutos.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#55615b]">
            Una cuenta para administrar estudiantes, hojas de respuesta, escaneos y resultados desde web y app movil.
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <TrustItem title="Google y Apple" body="Acceso rapido con proveedores confiables." />
            <TrustItem title="America Latina" body="Pensado para colegios y preuniversitarios." />
            <TrustItem title="Web + app movil" body="Gestiona en escritorio y escanea desde el telefono." />
            <TrustItem title="Datos protegidos" body="Autenticacion gestionada con Supabase Auth." />
          </div>
        </section>

        <section className="rounded-xl border border-[#dfe5e2] bg-white p-5 shadow-xl shadow-[#123b5d]/8 md:p-8">
          {oldApk && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <div className="flex-1">
                <p className="font-bold text-amber-800">Actualiza la app</p>
                <p className="mt-1 text-amber-700">Esta version de la app no soporta el acceso con Google. Actualizala desde Google Play.</p>
                <a href="https://play.google.com/store/apps/details?id=cl.tulector.app" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700">Abrir Play Store</a>
              </div>
            </div>
          )}
          <div>
            <div className="mb-5 lg:hidden"><TuLectorLogo href="/" /></div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6f5e]">{mode === "login" ? "Acceso seguro" : "Registro seguro"}</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] md:text-3xl">
              {mode === "login" ? "Entra a tu cuenta" : "Crea tu cuenta en TuLector"}
            </h2>
            <p className="mt-2 hidden text-sm leading-6 text-[#5b6472] sm:block">
              {mode === "login" ? "Usa Google, Apple o tu correo institucional." : "Google y Apple son las opciones recomendadas. Tambien puedes registrarte con correo."}
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#cfd8d4] bg-white px-4 text-sm font-bold text-[#111827] shadow-sm transition hover:border-[#aebbb5] hover:bg-[#f8faf9] disabled:opacity-50 active:scale-[0.99]"
            >
              <GoogleIcon />
              {oauthLoading === "google" ? "Conectando..." : "Continuar con Google"}
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#111827] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-50 active:scale-[0.99]"
            >
              <AppleIcon />
              {oauthLoading === "apple" ? "Conectando..." : "Continuar con Apple"}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-[#9aa3af]"><span className="h-px flex-1 bg-[#e1e7e3]" />o continua con correo<span className="h-px flex-1 bg-[#e1e7e3]" /></div>

          <form onSubmit={handleAuth} className="space-y-4">
            <label className="block text-sm font-bold text-[#111827]">
              Correo electronico
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#cfd8d4] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#9aa3af] focus:border-[#123b5d] focus:ring-2 focus:ring-[#123b5d]/10"
                placeholder="tu@colegio.cl"
                autoComplete="email"
                required
              />
            </label>

            <label className="block text-sm font-bold text-[#111827]">
              Contrasena
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#cfd8d4] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#9aa3af] focus:border-[#123b5d] focus:ring-2 focus:ring-[#123b5d]/10"
                placeholder={mode === "register" ? `Minimo ${PASSWORD_MIN_LENGTH} caracteres` : "Tu contrasena"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "register" ? PASSWORD_MIN_LENGTH : 6}
              />
            </label>

            {mode === "register" && password && (
              <PasswordStrength score={passwordScore} passwordStrongEnough={passwordStrongEnough} feedback={passwordAnalysis?.feedback.warning || passwordAnalysis?.feedback.suggestions?.[0]} />
            )}

            {mode === "register" && (
              <label className="block text-sm font-bold text-[#111827]">
                Confirmar contrasena
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={passwordsMatch
                    ? "mt-2 w-full rounded-lg border border-[#cfd8d4] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#9aa3af] focus:border-[#123b5d] focus:ring-2 focus:ring-[#123b5d]/10"
                    : "mt-2 w-full rounded-lg border border-[#ef4444] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#9aa3af] focus:ring-2 focus:ring-[#ef4444]/10"}
                  placeholder="Repite tu contrasena"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                />
                {!passwordsMatch && <span className="mt-2 block text-xs font-semibold text-[#b91c1c]">Las contrasenas no coinciden.</span>}
              </label>
            )}

            {mode === "register" && (
              <label className="flex items-start gap-3 rounded-lg border border-[#dfe5e2] bg-[#f8faf9] p-3 text-xs leading-5 text-[#5b6472]">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#cfd8d4] accent-[#123b5d]"
                  required
                />
                <span>
                  Acepto los <Link href="/terms" className="font-bold text-[#123b5d] hover:underline">Terminos</Link> y la <Link href="/privacy" className="font-bold text-[#123b5d] hover:underline">Politica de Privacidad</Link>.
                </span>
              </label>
            )}

            {message ? <AuthMessage message={message} /> : null}

            <button
              type="submit"
              disabled={busy || (mode === "register" && (!passwordStrongEnough || !passwordsMatch || !acceptedTerms))}
              className="w-full rounded-lg bg-[#123b5d] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f2f49] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#5b6472]">
            {mode === "login" ? (
              <p>No tienes cuenta? <button onClick={() => switchMode("register")} className="font-bold text-[#123b5d] hover:underline">Crear cuenta</button></p>
            ) : (
              <p>Ya tienes cuenta? <button onClick={() => switchMode("login")} className="font-bold text-[#123b5d] hover:underline">Entrar</button></p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[#dfe5e2] bg-white/70 p-4">
      <p className="text-sm font-bold text-[#111827]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#647067]">{body}</p>
    </div>
  );
}

function PasswordStrength({ score, passwordStrongEnough, feedback }: { score: number; passwordStrongEnough: boolean; feedback?: string }) {
  const labels = ["Muy debil", "Debil", "Aceptable", "Buena", "Fuerte"];
  const fill = Math.max(1, score + 1);

  return (
    <div className="rounded-lg border border-[#dfe5e2] bg-[#f8faf9] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-[#374151]">Seguridad: {labels[score]}</p>
        <p className={passwordStrongEnough ? "text-xs font-bold text-[#1f684f]" : "text-xs font-bold text-[#9a6a16]"}>
          {passwordStrongEnough ? "Lista para usar" : `Minimo ${PASSWORD_MIN_LENGTH} caracteres`}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className={index < fill ? "h-1.5 rounded-full bg-[#123b5d]" : "h-1.5 rounded-full bg-[#d8e0dc]"} />
        ))}
      </div>
      {feedback && <p className="mt-2 text-xs leading-5 text-[#647067]">{feedback}</p>}
    </div>
  );
}

function AuthMessage({ message }: { message: string }) {
  const lower = message.toLowerCase();
  const error = lower.includes("error") || lower.includes("invalid") || lower.includes("no se pudo") || lower.includes("no coinciden") || lower.includes("debes") || lower.includes("usa una");

  return (
    <div className={error
      ? "rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b]"
      : "rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[#166534]"}
    >
      {message}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 1.43c0 1.06-.43 2.09-1.13 2.84-.76.81-2.01 1.43-3.02 1.35-.14-1.02.39-2.11 1.08-2.82.75-.78 2.06-1.38 3.07-1.37Zm3.75 16.54c-.58 1.31-.86 1.9-1.61 3.06-1.04 1.59-2.5 3.56-4.31 3.58-1.61.02-2.03-1.04-4.22-1.03-2.19.01-2.65 1.05-4.26 1.03-1.81-.02-3.19-1.8-4.23-3.39-2.91-4.45-3.21-9.67-1.42-12.44 1.27-1.97 3.28-3.12 5.17-3.12 1.92 0 3.13 1.05 4.72 1.05 1.54 0 2.48-1.05 4.7-1.05 1.68 0 3.46.92 4.72 2.5-4.15 2.27-3.48 8.2.74 9.81Z" />
    </svg>
  );
}

function authCallbackUrl(next?: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const url = new URL("/auth/callback", siteUrl);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}




