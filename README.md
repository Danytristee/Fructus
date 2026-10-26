# Fructus

> *Fructus* (latín): fruto, y también ganancia.

ERP por voz para mayoristas de fruta. El dueño dice **"Vendí 10 jabas de mango a don Lucho a 45, lo debe"** y Fructus lo convierte en una venta, descuenta las jabas del stock y suma la deuda al cuaderno de don Lucho. Antes de guardar, pide un solo toque de confirmación.

Lo que hace:

- Registra **ventas**, **abonos**, **compras**, **mermas** y **gastos** por voz.
- Responde preguntas: *"¿Quién me debe?"*, *"¿Cuánto vendí hoy?"*, *"¿Cuántas jabas de papaya me quedan?"*
- Emite **boletas y facturas electrónicas** (por ahora en ambiente de prueba).
- Muestra el **cierre del día** y exporta el mes a Excel para el contador.

## Estado

🚧 Demo en construcción para un proyecto universitario. El caso real es un puesto mayorista de La Hermelinda, en Trujillo, Perú.

## Estructura

```
supabase/
  migrations/   esquema de base de datos (tablas, vistas, funciones, seguridad)
  seed.sql      datos de demo
docs/
  interprete-voz.md   cómo se convierte una frase en una operación
CLAUDE.md       contexto y decisiones del proyecto
```

## Puesta en marcha

1. Crear un proyecto en [Supabase](https://supabase.com) y aplicar `supabase/migrations/` y luego `supabase/seed.sql`.
2. Copiar `.env.example` a `.env.local` y completar las claves.
3. La app Next.js se agrega en el siguiente paso.
