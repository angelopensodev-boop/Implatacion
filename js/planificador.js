document.addEventListener("DOMContentLoaded", () => {
  let estrategiaActual = "urgencia";
  let presupuestoSimulado = 0;

  const inputPresupuesto = document.getElementById("plan-presupuesto-input");

  const formatearUSD = (n) =>
    `$${Number(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatearBs = (n) =>
    `${Number(n).toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Bs`;

  const descripciones = {
    urgencia:
      "Ordena primero los compromisos vencidos o con fecha más cercana para evitar atrasos y recargos.",
    nieve:
      "Método Bola de Nieve: enfoca tu dinero en liquidar la deuda más pequeña primero para liberar cuota rápido.",
    avalancha:
      "Método Avalancha: prioriza la deuda con mayor porcentaje de interés para pagar menos dinero en total.",
  };

  function calcularDisponible() {
    const usuario = DB.obtenerUsuario();
    const ingreso = Number(usuario.ingreso_mensual) || 0;
    const subsActivas = DB.obtenerSuscripciones().filter(
      (s) => s.estado === "activa"
    );
    const gastosFijos = subsActivas.reduce(
      (acc, s) => acc + DB.montoMensualSuscripcionUsd(s),
      0
    );
    return {
      ingreso,
      gastosFijos,
      diferencia: ingreso - gastosFijos,
      disponible: Math.max(0, ingreso - gastosFijos),
    };
  }

  function renderizarResumen() {
    const { ingreso, gastosFijos, diferencia, disponible } =
      calcularDisponible();
    const deudas = DB.obtenerDeudas().filter((d) => d.estado !== "pagada");
    const deudaTotalUsd = deudas.reduce(
      (acc, d) => acc + DB.aDolares(DB.totalDeuda(d), d.moneda_base),
      0
    );

    document.getElementById("plan-ingreso").textContent = formatearUSD(ingreso);
    document.getElementById("plan-gastos-fijos").textContent =
      formatearUSD(gastosFijos);
    document.getElementById("plan-disponible").textContent =
      formatearUSD(disponible);
    document.getElementById("plan-saldo-deudas").textContent =
      formatearUSD(deudaTotalUsd);

    const notaDisp = document.getElementById("plan-disponible-nota");
    if (ingreso === 0) {
      notaDisp.textContent = "Registra tu ingreso para calcular tu margen";
      notaDisp.className = "text-xs text-slate-400";
    } else if (diferencia < 0) {
      notaDisp.textContent = `Déficit de ${formatearUSD(
        Math.abs(diferencia)
      )} frente a fijos`;
      notaDisp.className = "text-xs font-bold text-brand-coral";
    } else {
      notaDisp.textContent = "Libre tras cubrir tus gastos fijos";
      notaDisp.className = "text-xs font-semibold text-emerald-600";
    }

    const mesesEl = document.getElementById("plan-meses-estimados");
    if (deudaTotalUsd === 0) {
      mesesEl.textContent = "No tienes deudas pendientes";
    } else if (presupuestoSimulado > 0) {
      const meses = Math.ceil(deudaTotalUsd / presupuestoSimulado);
      mesesEl.textContent = `A este ritmo: ~${meses} ${
        meses === 1 ? "mes" : "meses"
      } para liquidar`;
    } else {
      mesesEl.textContent = "Indica un monto mensual para estimar plazo";
    }
  }

  function renderizarPlanAccion() {
    const deudas = DB.obtenerDeudas().filter((d) => d.estado !== "pagada");
    const contenedor = document.getElementById("lista-plan-accion");

    document.getElementById("estrategia-descripcion").textContent =
      descripciones[estrategiaActual];

    if (deudas.length === 0) {
      contenedor.innerHTML = `
        <div class="text-center py-8 px-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-2.5">
          <p class="text-sm font-bold text-brand-charcoal">No tienes deudas activas para planificar</p>
          <p class="text-xs text-slate-500">Cuando registres tus compromisos en "Mis Deudas", aquí verás el orden recomendado de pago.</p>
          <a href="deudas.html?nueva=1" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-petrol text-white text-xs font-bold hover:bg-brand-petrolDark transition">
            <i class="fa-solid fa-plus"></i> Agregar deuda
          </a>
        </div>
      `;
      return;
    }

    // Ordenar según la estrategia seleccionada
    const ordenadas = [...deudas].sort((a, b) => {
      const saldoA = DB.aDolares(DB.totalDeuda(a), a.moneda_base);
      const saldoB = DB.aDolares(DB.totalDeuda(b), b.moneda_base);

      if (estrategiaActual === "nieve") {
        return saldoA - saldoB;
      }
      if (estrategiaActual === "avalancha") {
        return (b.tasa_interes || 0) - (a.tasa_interes || 0) || saldoA - saldoB;
      }
      // Por urgencia (fecha más próxima)
      return new Date(a.proxima_fecha_pago) - new Date(b.proxima_fecha_pago);
    });

    // Distribuir presupuesto simulado en orden de prioridad
    let dineroRestante = Math.max(0, presupuestoSimulado);

    contenedor.innerHTML = ordenadas
      .map((d, index) => {
        const totalBase = DB.totalDeuda(d);
        const totalUsd = DB.aDolares(totalBase, d.moneda_base);
        const totalBs = DB.aBolivares(totalBase, d.moneda_base);
        const dias = DB.diasRestantes(d.proxima_fecha_pago);

        let asignadoUsd = 0;
        let estadoCobertura =
          '<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">Para próximo mes</span>';

        if (presupuestoSimulado > 0 && dineroRestante > 0) {
          asignadoUsd = Math.min(dineroRestante, totalUsd);
          dineroRestante = Math.max(0, dineroRestante - asignadoUsd);

          if (asignadoUsd >= totalUsd - 0.01) {
            estadoCobertura = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">Cubierta 100% (${formatearUSD(
              asignadoUsd
            )})</span>`;
          } else {
            estadoCobertura = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-cyan/15 text-brand-petrol">Abonar ${formatearUSD(
              asignadoUsd
            )}</span>`;
          }
        }

        // Motivo de prioridad
        let motivo =
          dias <= 0
            ? dias === 0
              ? "Vence hoy"
              : `Vencida hace ${Math.abs(dias)} días`
            : `Vence en ${dias} días`;
        if (estrategiaActual === "nieve") {
          motivo = `Saldo total: ${formatearUSD(totalUsd)}`;
        } else if (estrategiaActual === "avalancha") {
          motivo = `Tasa ${d.tipo_tasa} (${d.tasa_interes}%)`;
        }

        return `
          <div class="plan-step-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-brand-petrol text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                #${index + 1}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-sm font-extrabold text-brand-charcoal truncate">${DB.escaparHTML(
                    d.acreedor
                  )} — ${DB.escaparHTML(d.concepto)}</h4>
                  <span class="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold uppercase text-slate-500">${DB.escaparHTML(
                    d.categoria
                  )}</span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">${DB.escaparHTML(
                  motivo
                )} · Total: <strong>${formatearUSD(
          totalUsd
        )}</strong> <span class="text-slate-400">(${formatearBs(
          totalBs
        )})</span></p>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
              ${estadoCobertura}
              <a
                href="deudas.html"
                class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-petrol hover:text-white text-brand-charcoal text-xs font-bold transition"
              >
                Ir a pagar
              </a>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderizarAgenda30Dias() {
    const deudas = DB.obtenerDeudas()
      .filter((d) => d.estado !== "pagada")
      .map((d) => ({
        titulo: `${d.acreedor} — ${d.concepto}`,
        tipo: "Deuda",
        montoUsd: DB.aDolares(DB.totalDeuda(d), d.moneda_base),
        dias: DB.diasRestantes(d.proxima_fecha_pago),
        url: "deudas.html",
      }));

    const subs = DB.obtenerSuscripciones()
      .filter((s) => s.estado === "activa")
      .map((s) => ({
        titulo: s.nombre,
        tipo: "Gasto Fijo",
        montoUsd: DB.aDolares(s.monto, s.moneda),
        dias: DB.diasRestantes(s.proxima_fecha_pago),
        url: "suscripciones.html",
      }));

    const todos = [...deudas, ...subs].sort((a, b) => a.dias - b.dias);

    const vencidos = todos.filter((x) => x.dias <= 0);
    const proximos15 = todos.filter((x) => x.dias > 0 && x.dias <= 15);
    const restoMes = todos.filter((x) => x.dias > 15 && x.dias <= 30);

    const pintarGrupo = (lista, idContenedor, idTotal, colorEtiqueta) => {
      const suma = lista.reduce((acc, item) => acc + item.montoUsd, 0);
      document.getElementById(idTotal).textContent = formatearUSD(suma);

      const el = document.getElementById(idContenedor);
      if (lista.length === 0) {
        el.innerHTML = `<p class="text-xs text-slate-400 italic py-1">Sin compromisos en este rango.</p>`;
        return;
      }

      el.innerHTML = lista
        .map((item) => {
          const textoDias =
            item.dias < 0
              ? `Hace ${Math.abs(item.dias)}d`
              : item.dias === 0
              ? "Hoy"
              : `En ${item.dias}d`;
          return `
            <a href="${item.url}" class="block p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition">
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-bold text-brand-charcoal truncate">${DB.escaparHTML(
                  item.titulo
                )}</p>
                <strong class="text-xs font-extrabold text-brand-petrol shrink-0">${formatearUSD(
                  item.montoUsd
                )}</strong>
              </div>
              <div class="flex items-center justify-between mt-1 text-[11px]">
                <span class="text-slate-400">${item.tipo}</span>
                <span class="font-bold ${colorEtiqueta}">${textoDias}</span>
              </div>
            </a>
          `;
        })
        .join("");
    };

    pintarGrupo(
      vencidos,
      "agenda-vencidos",
      "total-agenda-vencidos",
      "text-rose-600"
    );
    pintarGrupo(
      proximos15,
      "agenda-15dias",
      "total-agenda-15dias",
      "text-amber-600"
    );
    pintarGrupo(
      restoMes,
      "agenda-mes",
      "total-agenda-mes",
      "text-emerald-600"
    );
  }

  function renderizarTodo() {
    renderizarResumen();
    renderizarPlanAccion();
    renderizarAgenda30Dias();
  }

  // Inicializar presupuesto con el disponible actual
  const { disponible } = calcularDisponible();
  presupuestoSimulado = Number(disponible.toFixed(2));
  inputPresupuesto.value = presupuestoSimulado > 0 ? presupuestoSimulado : "";

  // Eventos del simulador
  inputPresupuesto.addEventListener("input", (e) => {
    presupuestoSimulado = Math.max(0, Number(e.target.value) || 0);
    renderizarResumen();
    renderizarPlanAccion();
  });

  document
    .getElementById("btn-usar-disponible")
    .addEventListener("click", () => {
      const { disponible: disp } = calcularDisponible();
      presupuestoSimulado = Number(disp.toFixed(2));
      inputPresupuesto.value = presupuestoSimulado;
      renderizarResumen();
      renderizarPlanAccion();
    });

  // Cambio de estrategia
  document.querySelectorAll(".strategy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".strategy-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      estrategiaActual = btn.dataset.estrategia;
      renderizarPlanAccion();
    });
  });

  // Editar ingreso mensual desde aquí
  document
    .getElementById("btn-plan-editar-ingreso")
    .addEventListener("click", () => {
      const actual = DB.obtenerUsuario().ingreso_mensual || 0;
      Swal.fire({
        title: "Ingreso Mensual",
        text: "Ingresa tu ingreso mensual estimado en USD ($):",
        input: "number",
        inputValue: actual > 0 ? actual : "",
        inputPlaceholder: "Ej. 600",
        inputAttributes: { min: 1, step: "0.01" },
        showCancelButton: true,
        confirmButtonText: "Guardar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#02425B",
        inputValidator: (val) => {
          if (!val || Number(val) <= 0) return "Ingresa un monto mayor a 0";
        },
      }).then((res) => {
        if (res.isConfirmed) {
          DB.guardarIngresoMensual(res.value);
          const { disponible: nuevoDisp } = calcularDisponible();
          presupuestoSimulado = Number(nuevoDisp.toFixed(2));
          inputPresupuesto.value = presupuestoSimulado;
          renderizarTodo();
          Swal.fire({
            icon: "success",
            title: "Ingreso actualizado",
            timer: 1200,
            showConfirmButton: false,
          });
        }
      });
    });

  renderizarTodo();
});