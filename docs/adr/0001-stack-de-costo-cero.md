# ADR-0001 — Stack de costo cero para la demo

**Fecha:** 2026-10-26 · **Estado:** aceptado

## Contexto

Fructus lo desarrolla una sola persona en 2 semanas, para una demo universitaria que debe funcionar con datos reales de un puesto mayorista
de La Hermelinda. El presupuesto es cero, y el usuario principal opera desde un celular, con la voz y las manos ocupadas.

## Decisión

- **App:** Next.js 16, React 19, TypeScript estricto y Tailwind 4, como PWA, publicada en Vercel Hobby.
- **Datos y sesión:** Supabase (Postgres 17 + Auth + RLS), con RPC para las operaciones de varias tablas.
- **Voz:** Groq `whisper-large-v3-turbo` para pasar el audio a texto. Un LLM de Groq con tool calling interpreta la frase, y Gemini Flash es el respaldo.
- **Comprobantes:** sandbox de Lucode, con el servicio BETA de SUNAT (MODDATOS) como plan B.
- **Calidad:** Vitest, Playwright, pgTAP, ESLint y Knip, en GitHub Actions.

## Alternativas descartadas

- **API de WhatsApp como canal de voz:** cobra por los mensajes que inicia la empresa y obliga a usar plantillas aprobadas. La PWA con botón de voz es gratis y permite la tarjeta de confirmación.
- **Web Speech API para reconocer la voz:** es gratis y no necesita servidor, pero no acepta vocabulario propio (apodos, variedades de fruta) y su comportamiento cambia entre navegadores. Sí se usa para *hablar* (speechSynthesis).
- **Emitir directo a SUNAT (SEE del Contribuyente):** exige certificado digital y homologación. No cabe en 2 semanas ni hace falta para una demo.

## Consecuencias

- **Vercel Hobby y los niveles gratuitos de Gemini y Groq** no permiten uso comercial o pueden usar los datos para entrenar. Antes de producción hay que cambiarlos (ver «Antes de producción» en `CLAUDE.md`).
- **Supabase gratis pausa el proyecto** tras 7 días sin actividad. `.github/workflows/mantener-despierta.yml` lo evita.
