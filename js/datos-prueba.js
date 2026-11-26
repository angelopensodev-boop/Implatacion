// Almacén local compartido entre todos los módulos (mientras conectamos FastAPI + Supabase)
const DB = {
  fechaHoyISO() {
    return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD en hora local
  },

  inicializar() {
    if (!localStorage.getItem("add_tasas")) {
      localStorage.setItem(
        "add_tasas",
        JSON.stringify({
          bcv: 78.4,
          usdt: 86.15,
          fecha_dia: "",
          fecha_actualizacion: new Date(0).toISOString(),
          fuente: "Inicial",
        })
      );
    }
    if (!localStorage.getItem("add_tasas_historial")) {
      localStorage.setItem("add_tasas_historial", JSON.stringify([]));
    }
    if (!localStorage.getItem("add_deudas")) {
      localStorage.setItem("add_deudas", JSON.stringify([]));
    }
    if (!localStorage.getItem("add_suscripciones")) {
      localStorage.setItem("add_suscripciones", JSON.stringify([]));
    }
    if (!localStorage.getItem("add_abonos")) {
      localStorage.setItem("add_abonos", JSON.stringify([]));
    }
  },

  // --- USUARIO Y PERFIL ---
  obtenerUsuario() {
    const guardado = JSON.parse(localStorage.getItem("usuario_activo")) || {};
    return {
      nombre: guardado.nombre || "Usuario",
      correo: guardado.correo || "demo@correo.com",
      ingreso_mensual: Number(guardado.ingreso_mensual) || 0,
      moneda_preferida: guardado.moneda_preferida || "USD",
      dias_alerta: Number(guardado.dias_alerta) || 15,
    };
  },

  guardarPerfil({
    nombre,
    correo,
    ingreso_mensual,
    moneda_preferida,
    dias_alerta,
  }) {
    const actual = this.obtenerUsuario();
    const actualizado = {
      ...actual,
      nombre: (nombre || actual.nombre).trim(),
      correo: (correo || actual.correo).trim(),
      ingreso_mensual: Number(ingreso_mensual) || 0,
      moneda_preferida: moneda_preferida || actual.moneda_preferida,
      dias_alerta: Math.min(30, Math.max(1, Number(dias_alerta) || 15)),
    };
    localStorage.setItem("usuario_activo", JSON.stringify(actualizado));
    window.dispatchEvent(new CustomEvent("perfilActualizado"));
    return actualizado;
  },

  guardarIngresoMensual(monto) {
    const usuario = this.obtenerUsuario();
    usuario.ingreso_mensual = Number(monto) || 0;
    localStorage.setItem("usuario_activo", JSON.stringify(usuario));
    window.dispatchEvent(new CustomEvent("perfilActualizado"));
  },

  exportarRespaldoJSON() {
    return {
      sistema: "ADD - Control de Deudas y Finanzas",
      fecha_exportacion: new Date().toISOString(),
      usuario: this.obtenerUsuario(),
      tasas: this.obtenerTasas(),
      historial_tasas: this.obtenerHistorialTasas(),
      deudas: this.obtenerDeudas(),
      suscripciones: this.obtenerSuscripciones(),
      abonos: this.obtenerAbonos(),
    };
  },

  limpiarDatosFinancieros() {
    localStorage.setItem("add_deudas", JSON.stringify([]));
    localStorage.setItem("add_suscripciones", JSON.stringify([]));
    localStorage.setItem("add_abonos", JSON.stringify([]));
    window.dispatchEvent(new CustomEvent("perfilActualizado"));
  },

  // --- TASAS BCV / USDT ---
  obtenerTasas() {
    return JSON.parse(localStorage.getItem("add_tasas"));
  },

  obtenerHistorialTasas() {
    return JSON.parse(localStorage.getItem("add_tasas_historial")) || [];
  },

  guardarTasas({ bcv, usdt, fuente = "Manual" }) {
    const hoy = this.fechaHoyISO();
    const ahora = new Date();
    const nuevoRegistro = {
      bcv: Number(Number(bcv).toFixed(2)),
      usdt: Number(Number(usdt).toFixed(2)),
      fecha_dia: hoy,
      fecha_actualizacion: ahora.toISOString(),
      fuente,
    };

    localStorage.setItem("add_tasas", JSON.stringify(nuevoRegistro));

    const historial = this.obtenerHistorialTasas();
    const entrada = {
      fecha_dia: hoy,
      hora: ahora.toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      bcv: nuevoRegistro.bcv,
      usdt: nuevoRegistro.usdt,
      fuente,
    };

    const idxHoy = historial.findIndex((h) => h.fecha_dia === hoy);
    if (idxHoy >= 0) {
      historial[idxHoy] = entrada;
    } else {
      historial.unshift(entrada);
    }

    localStorage.setItem(
      "add_tasas_historial",
      JSON.stringify(historial.slice(0, 30))
    );

    window.dispatchEvent(new CustomEvent("tasasActualizadas"));
    return nuevoRegistro;
  },

  // Consulta DolarApi Venezuela automáticamente cada 1 hora (o al pulsar Actualizar)
  async sincronizarTasasEnVivo(forzar = false) {
    const actual = this.obtenerTasas();
    const ahoraMs = Date.now();
    const ultimaMs = new Date(actual.fecha_actualizacion).getTime() || 0;
    const unaHoraMs = 60 * 60 * 1000;

    if (!forzar && actual.fuente === "API" && ahoraMs - ultimaMs < unaHoraMs) {
      return { ok: true, desdeCache: true, tasas: actual };
    }

    try {
      const resp = await fetch("https://ve.dolarapi.com/v1/dolares");
      if (!resp.ok) throw new Error(`Error HTTP ${resp.status}`);
      const datos = await resp.json();

      const oficial = datos.find(
        (d) => (d.fuente || "").toLowerCase() === "oficial"
      );
      const paralelo = datos.find(
        (d) => (d.fuente || "").toLowerCase() === "paralelo"
      );

      const nuevoBcv = Number(oficial?.promedio) || actual.bcv;
      const nuevoUsdt = Number(paralelo?.promedio) || actual.usdt;

      const guardadas = this.guardarTasas({
        bcv: nuevoBcv,
        usdt: nuevoUsdt,
        fuente: "API",
      });

      return { ok: true, desdeCache: false, tasas: guardadas };
    } catch (error) {
      return { ok: false, error: error.message, tasas: actual };
    }
  },

  // --- DEUDAS ---
  obtenerDeudas() {
    return JSON.parse(localStorage.getItem("add_deudas")) || [];
  },

  guardarDeudas(lista) {
    localStorage.setItem("add_deudas", JSON.stringify(lista));
  },

  totalDeuda(deuda) {
    return Number(
      (
        (Number(deuda.saldo_capital_actual) || 0) +
        (Number(deuda.interes_pendiente) || 0)
      ).toFixed(2)
    );
  },

  agregarDeuda(datos) {
    const deudas = this.obtenerDeudas();
    const montoInicial = Number(datos.monto_inicial);
    const tasa =
      datos.tipo_tasa === "Sin interés" ? 0 : Number(datos.tasa_interes) || 0;
    const interesInicial = Number(((montoInicial * tasa) / 100).toFixed(2));

    const nueva = {
      id: Date.now(),
      acreedor: datos.acreedor,
      concepto: datos.concepto,
      categoria: datos.categoria,
      moneda_base: datos.moneda_base,
      monto_inicial: montoInicial,
      saldo_capital_actual: montoInicial,
      interes_pendiente: interesInicial,
      tipo_tasa: datos.tipo_tasa,
      tasa_interes: tasa,
      frecuencia_pago: datos.frecuencia_pago,
      proxima_fecha_pago: datos.proxima_fecha_pago,
      estado: "activa",
    };

    deudas.push(nueva);
    this.guardarDeudas(deudas);
    return nueva;
  },

  actualizarTasaVariable(idDeuda, nuevaTasa) {
    const deudas = this.obtenerDeudas();
    const deuda = deudas.find((d) => d.id === Number(idDeuda));
    if (!deuda) return;

    const porcentaje = Number(nuevaTasa) || 0;
    deuda.tasa_interes = porcentaje;
    deuda.interes_pendiente = Number(
      ((deuda.saldo_capital_actual * porcentaje) / 100).toFixed(2)
    );
    this.guardarDeudas(deudas);
  },

  eliminarDeuda(idDeuda) {
    const filtradas = this.obtenerDeudas().filter(
      (d) => d.id !== Number(idDeuda)
    );
    this.guardarDeudas(filtradas);
  },

  // --- GASTOS FIJOS Y SUSCRIPCIONES ---
  obtenerSuscripciones() {
    return JSON.parse(localStorage.getItem("add_suscripciones")) || [];
  },

  guardarSuscripciones(lista) {
    localStorage.setItem("add_suscripciones", JSON.stringify(lista));
  },

  agregarSuscripcion(datos) {
    const lista = this.obtenerSuscripciones();
    const nueva = {
      id: Date.now(),
      nombre: datos.nombre,
      categoria: datos.categoria,
      monto: Number(datos.monto),
      moneda: datos.moneda,
      frecuencia: datos.frecuencia,
      proxima_fecha_pago: datos.proxima_fecha_pago,
      estado: "activa",
    };
    lista.push(nueva);
    this.guardarSuscripciones(lista);
    return nueva;
  },

  alternarEstadoSuscripcion(idSub) {
    const lista = this.obtenerSuscripciones();
    const sub = lista.find((s) => s.id === Number(idSub));
    if (!sub) return;
    sub.estado = sub.estado === "activa" ? "pausada" : "activa";
    this.guardarSuscripciones(lista);
  },

  eliminarSuscripcion(idSub) {
    const filtradas = this.obtenerSuscripciones().filter(
      (s) => s.id !== Number(idSub)
    );
    this.guardarSuscripciones(filtradas);
  },

  calcularSiguienteFecha(fechaStr, frecuencia) {
    const fecha = new Date(fechaStr + "T00:00:00");
    if (frecuencia === "Semanal") {
      fecha.setDate(fecha.getDate() + 7);
    } else if (frecuencia === "Quincenal") {
      fecha.setDate(fecha.getDate() + 15);
    } else if (frecuencia === "Anual") {
      fecha.setFullYear(fecha.getFullYear() + 1);
    } else {
      fecha.setMonth(fecha.getMonth() + 1);
    }
    return fecha.toISOString().split("T")[0];
  },

  montoMensualSuscripcionUsd(sub) {
    const baseUsd = this.aDolares(sub.monto, sub.moneda);
    if (sub.frecuencia === "Semanal") return baseUsd * 4;
    if (sub.frecuencia === "Quincenal") return baseUsd * 2;
    if (sub.frecuencia === "Anual") return baseUsd / 12;
    return baseUsd;
  },

  registrarPagoSuscripcion({ subId, monedaPago, tipoTasa, valorTasa }) {
    const lista = this.obtenerSuscripciones();
    const sub = lista.find((s) => s.id === Number(subId));
    if (!sub) return null;

    const montoEnMonedaPago = this.convertirMoneda(
      sub.monto,
      sub.moneda,
      monedaPago,
      valorTasa
    );

    sub.proxima_fecha_pago = this.calcularSiguienteFecha(
      sub.proxima_fecha_pago,
      sub.frecuencia
    );
    this.guardarSuscripciones(lista);

    const tasaEtiqueta =
      monedaPago === sub.moneda
        ? `Misma moneda (${tipoTasa} ${Number(valorTasa).toFixed(2)})`
        : `${tipoTasa} ${Number(valorTasa).toFixed(2)}`;

    const abonos = this.obtenerAbonos();
    const registro = {
      id: Date.now(),
      tipo_movimiento: "Gasto Fijo",
      deuda_id: sub.id,
      deuda_titulo: `${sub.nombre} (${sub.categoria})`,
      fecha_pago: new Date().toLocaleDateString("es-VE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      monto_abonado: Number(montoEnMonedaPago).toFixed(2),
      moneda_pago: monedaPago,
      tasa_cambio_usada: tasaEtiqueta,
      pagado_interes: 0,
      pagado_capital: Number(sub.monto),
      saldo_restante: 0,
    };

    abonos.unshift(registro);
    localStorage.setItem("add_abonos", JSON.stringify(abonos));
    return registro;
  },

  // --- ABONOS Y CONVERSIÓN ---
  obtenerAbonos() {
    return JSON.parse(localStorage.getItem("add_abonos")) || [];
  },

  convertirMoneda(monto, monedaOrigen, monedaDestino, tasaBsPorDivisa) {
    const val = Number(monto) || 0;
    const tasas = this.obtenerTasas();
    if (monedaOrigen === monedaDestino) return val;

    if (
      monedaOrigen === "VES" &&
      (monedaDestino === "USD" || monedaDestino === "USDT")
    ) {
      return val / tasaBsPorDivisa;
    }
    if (
      (monedaOrigen === "USD" || monedaOrigen === "USDT") &&
      monedaDestino === "VES"
    ) {
      return val * tasaBsPorDivisa;
    }
    if (monedaOrigen === "USDT" && monedaDestino === "USD") {
      return (val * tasas.usdt) / tasas.bcv;
    }
    if (monedaOrigen === "USD" && monedaDestino === "USDT") {
      return (val * tasas.bcv) / tasas.usdt;
    }
    return val;
  },

  registrarAbono({
    deudaId,
    montoPago,
    monedaPago,
    tipoTasa,
    valorTasa,
    nuevaFechaPago,
  }) {
    const deudas = this.obtenerDeudas();
    const deuda = deudas.find((d) => d.id === Number(deudaId));
    if (!deuda) return null;

    const equivalente = this.convertirMoneda(
      montoPago,
      monedaPago,
      deuda.moneda_base,
      valorTasa
    );

    const pagadoInteres = Math.min(equivalente, deuda.interes_pendiente);
    const sobrante = Math.max(0, equivalente - pagadoInteres);
    const pagadoCapital = Math.min(sobrante, deuda.saldo_capital_actual);

    deuda.interes_pendiente = Number(
      Math.max(0, deuda.interes_pendiente - pagadoInteres).toFixed(2)
    );
    deuda.saldo_capital_actual = Number(
      Math.max(0, deuda.saldo_capital_actual - pagadoCapital).toFixed(2)
    );

    if (deuda.saldo_capital_actual === 0 && deuda.interes_pendiente === 0) {
      deuda.estado = "pagada";
    } else if (nuevaFechaPago) {
      deuda.proxima_fecha_pago = nuevaFechaPago;
    }

    this.guardarDeudas(deudas);

    const tasaEtiqueta =
      monedaPago === deuda.moneda_base
        ? `Misma moneda (${tipoTasa} ${Number(valorTasa).toFixed(2)})`
        : `${tipoTasa} ${Number(valorTasa).toFixed(2)}`;

    const abonos = this.obtenerAbonos();
    const registro = {
      id: Date.now(),
      tipo_movimiento: "Abono Deuda",
      deuda_id: deuda.id,
      deuda_titulo: `${deuda.acreedor} — ${deuda.concepto}`,
      fecha_pago: new Date().toLocaleDateString("es-VE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      monto_abonado: Number(montoPago).toFixed(2),
      moneda_pago: monedaPago,
      tasa_cambio_usada: tasaEtiqueta,
      pagado_interes: Number(pagadoInteres.toFixed(2)),
      pagado_capital: Number(pagadoCapital.toFixed(2)),
      saldo_restante: this.aDolares(this.totalDeuda(deuda), deuda.moneda_base),
    };

    abonos.unshift(registro);
    localStorage.setItem("add_abonos", JSON.stringify(abonos));
    return registro;
  },

  aDolares(monto, monedaBase) {
    const tasas = this.obtenerTasas();
    if (monedaBase === "VES") return Number(monto) / tasas.bcv;
    return Number(monto);
  },

  aBolivares(monto, monedaBase) {
    const tasas = this.obtenerTasas();
    if (monedaBase === "VES") return Number(monto);
    if (monedaBase === "USDT") return Number(monto) * tasas.usdt;
    return Number(monto) * tasas.bcv;
  },

  diasRestantes(fechaStr) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const objetivo = new Date(fechaStr + "T00:00:00");
    return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
  },

  escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
  },
};

DB.inicializar();