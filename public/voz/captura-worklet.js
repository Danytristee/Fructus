// La captura de «Hola Fructus» (actividad 5c). Corre en el hilo de audio del navegador: convierte lo que oye el micrófono en cuadros
// de 80 ms (1280 muestras de 16 bits a 16 kHz) y se los pasa directo al worker que escucha (components/voz/escucha.worker.ts), sin
// pasar por la pantalla: así escuchar no le quita tiempo a los toques.
//
// Si el navegador no pudo abrir el audio a 16 kHz, baja la frecuencia aquí promediando grupos de muestras, para que el detector reciba
// siempre lo mismo. Chrome sí lo abre a 16 kHz, y ese es el camino que se probó.
//
// Es JavaScript suelto, no TypeScript: el navegador lo carga con audioWorklet.addModule("/voz/captura-worklet.js"), sin empaquetar.

const FRECUENCIA = 16000;
const MUESTRAS_POR_CUADRO = 1280;

class CapturaFructus extends AudioWorkletProcessor {
  constructor() {
    super();
    /** El canal al worker. Llega por mensaje: hasta entonces no se junta nada. */
    this.salida = null;
    this.cuadro = new Int16Array(MUESTRAS_POR_CUADRO);
    this.llenas = 0;
    // `sampleRate` es la frecuencia del contexto de audio (global en este hilo).
    this.paso = sampleRate / FRECUENCIA;
    this.suma = 0;
    this.cuantas = 0;
    this.avance = 0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.puerto) this.salida = e.data.puerto;
    };
  }

  process(entradas) {
    const canal = entradas[0] && entradas[0][0];
    if (!canal || !this.salida) return true;
    if (this.paso === 1) {
      for (let i = 0; i < canal.length; i++) this.agregar(canal[i]);
      return true;
    }
    for (let i = 0; i < canal.length; i++) {
      this.suma += canal[i];
      this.cuantas++;
      this.avance++;
      if (this.avance >= this.paso) {
        this.agregar(this.suma / this.cuantas);
        this.suma = 0;
        this.cuantas = 0;
        this.avance -= this.paso;
      }
    }
    return true;
  }

  agregar(v) {
    const x = v < -1 ? -1 : v > 1 ? 1 : v;
    this.cuadro[this.llenas++] = Math.trunc(x * 32767);
    if (this.llenas === MUESTRAS_POR_CUADRO) {
      this.salida.postMessage(this.cuadro, [this.cuadro.buffer]);
      this.cuadro = new Int16Array(MUESTRAS_POR_CUADRO);
      this.llenas = 0;
    }
  }
}

registerProcessor("captura-fructus", CapturaFructus);
