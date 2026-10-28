import { crearClienteServidor } from "@/lib/supabase/servidor";

// Página provisional de A0: prueba que la app arranca y llega a la base.
// La reemplaza «Hoy» en A3.
export default async function Inicio() {
  const supabase = await crearClienteServidor();
  // Sin sesión la RLS no devuelve filas, pero la consulta igual llega a Postgres.
  const { error } = await supabase.from("productos").select("id", { head: true, count: "exact" });

  if (error) {
    console.error("inicio: la base no respondió", { codigo: error.code });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-3xl font-bold">Fructus</h1>
      <p>Ventas, deudas y stock del puesto, por voz.</p>
      <p role="status" data-testid="estado-base">
        {error ? "La base no responde. Revisa que Supabase esté prendido." : "La base responde."}
      </p>
    </main>
  );
}
