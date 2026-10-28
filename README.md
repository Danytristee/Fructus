# Fructus

> *Fructus* (latín): fruto, y también ganancia.

ERP por voz para mayoristas de fruta. El dueño dice **«Vendí 10 cajas de mango a don Lucho a 45, lo debe»** y Fructus lo convierte en
una venta: descuenta las cajas del stock y suma la deuda al cuaderno de don Lucho. Antes de guardar, pide un solo toque de confirmación.

- Registra **ventas**, **abonos**, **compras**, **mermas** y **gastos** por voz.
- Responde: *«¿Quién me debe?»*, *«¿Cuánto vendí hoy?»*, *«¿Cuántas cajas de papaya me quedan?»*
- Emite **boletas y facturas electrónicas** (por ahora en ambiente de prueba).
- Muestra el **cierre del día** y exporta el mes a Excel para el contador.

🚧 Demo en construcción para un proyecto universitario. El caso real es un puesto mayorista de La Hermelinda, en Trujillo, Perú.

## Para desarrollar

1. **Lee [`CLAUDE.md`](CLAUDE.md):** son las reglas del proyecto (stack, estructura, diseño, flujo de trabajo y skills).
2. **Para arrancar con Claude Code:** pídele que lea y ejecute [`docs/PROMPT-INICIAL.md`](docs/PROMPT-INICIAL.md).
3. **Entorno local:** Node 24, pnpm 10 y Docker. Levanta la base con `npx supabase start`, copia `.env.example` a `.env.local` y corre `pnpm dev`, cuando la app exista.

## Estructura

```
CLAUDE.md                 reglas del proyecto
.claude/skills/           las 7 skills del proyecto y 21 de terceros (ver docs/terceros/)
supabase/
  migrations/             esquema (tablas, vistas, funciones, RLS)
  seed.sql                datos de demo
  tests/                  pruebas pgTAP
scripts/invariantes.sql   lo que nunca debe pasar en la base
tests/interprete/         casos del intérprete de voz
docs/
  adr/                    decisiones de arquitectura
  bitacora/               una entrada por sesión
  interprete-voz.md       cómo una frase se vuelve una operación
  PROMPT-INICIAL.md       el encargo completo para Claude Code
```
