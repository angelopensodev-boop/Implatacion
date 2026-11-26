document.addEventListener("DOMContentLoaded", () => {
  let filtroTipo = "todos";
  let filtroMoneda = "todas";
  let textoBusqueda = "";

  const tbody = document.getElementById("tabla-historial-completo");

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

  function obtenerListaFiltrada() {
    const abonos = DB.obtenerAbonos();
    return abonos.filter((a) => {
      const tipo = a.tipo_movimiento || "Abono Deuda";
      if (filtroTipo !== "todos" && tipo !== filtroTipo) return false;
      if (filtroMoneda !== "todas" && a.moneda_pago !== filtroMoneda)
        return false;

      if (textoBusqueda.trim()) {
        const texto = `${a.deuda_titulo} ${a.fecha_pago} ${a.tasa_cambio_usada} ${tipo}`.toLowerCase();
        if (!texto.includes(textoBusqueda.trim().toLowerCase())) return false;
      }
      return true;
    });
  }

  function renderizarResumen() {
    const todos = DB.obtenerAbonos();
    const tasas = DB.obtenerTasas();

    const cantDeudas = todos.filter(
      (a) => (a.tipo_movimiento || "Abono Deuda") === "Abono Deuda"
    ).length;
    const cantFijos = todos.filter(
      (a) => a.tipo_movimiento === "Gasto Fijo"
    ).length;

    const totalUsd = todos.reduce(
      (acc, a) => acc + DB.aDolares(Number(a.monto_abonado), a.moneda_pago),
      0
    );

    const totalInteres = todos.reduce(
      (acc, a) => acc + (Number(a.pagado_interes) || 0),
      0
    );

    document.getElementById("hist-total-conteo").textContent = todos.length;
    document.getElementById(
      "hist-desglose-tipo"
    ).textContent = `${cantDeudas} deudas · ${cantFijos} gastos fijos`;
    document.getElementById("hist-total-usd").textContent =
      formatearUSD(totalUsd);
    document.getElementById("hist-total-bs").textContent = `≈ ${formatearBs(
      totalUsd * tasas.bcv
    )} (BCV)`;
    document.getElementById("hist-total-interes").textContent =
      formatearUSD(totalInteres);
  }

  function renderizarTabla() {
    const lista = obtenerListaFiltrada();
    const contador = document.getElementById("hist-contador-vista");
    contador.textContent = `${lista.length} ${
      lista.length === 1 ? "registro" : "registros"
    }`;

    if (lista.length === 0) {
      const hayDatos = DB.obtenerAbonos().length > 0;
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-12 text-center space-y-2">
            <div class="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <p class="text-sm font-bold text-brand-charcoal">
              ${
                hayDatos
                  ? "Ningún pago coincide con tus filtros"
                  : "Aún no tienes pagos registrados"
              }
            </p>
            <p class="text-xs text-slate-400">
              ${
                hayDatos
                  ? "Prueba limpiando el buscador o cambiando el tipo de movimiento."
                  : "Cuando registres abonos en Mis Deudas o pagues un Gasto Fijo, aparecerán aquí automáticamente."
              }
            </p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lista
      .map((a) => {
        const tipo = a.tipo_movimiento || "Abono Deuda";
        const esFijo = tipo === "Gasto Fijo";
        const badgeTipo = esFijo
          ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-cyan/15 text-brand-petrol whitespace-nowrap">Gasto Fijo</span>`
          : `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-petrol/10 text-brand-petrol whitespace-nowrap">Abono Deuda</span>`;

        const interes = Number(a.pagado_interes) || 0;
        const capital = Number(a.pagado_capital) || 0;
        const desglose = esFijo
          ? `<span class="text-xs text-slate-400">Pago recurrente</span>`
          : `<div class="text-xs">
              <span class="text-amber-600 font-semibold">Int: ${interes.toFixed(2)}</span>
              <span class="text-slate-300 mx-1">·</span>
              <span class="text-emerald-600 font-semibold">Cap: ${capital.toFixed(2)}</span>
            </div>`;

        return `
          <tr class="history-row">
            <td class="py-3.5 pr-4 text-xs text-slate-500 whitespace-nowrap">${DB.escaparHTML(
              a.fecha_pago
            )}</td>
            <td class="py-3.5 px-4 font-bold text-brand-charcoal">${DB.escaparHTML(
              a.deuda_titulo
            )}</td>
            <td class="py-3.5 px-4">${badgeTipo}</td>
            <td class="py-3.5 px-4 font-extrabold text-emerald-600 whitespace-nowrap">
              ${DB.escaparHTML(a.monto_abonado)} ${DB.escaparHTML(
          a.moneda_pago
        )}
            </td>
            <td class="py-3.5 px-4 whitespace-nowrap">${desglose}</td>
            <td class="py-3.5 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap">${DB.escaparHTML(
              a.tasa_cambio_usada
            )}</td>
            <td class="py-3.5 px-4 text-right font-bold text-brand-charcoal whitespace-nowrap">
              ${formatearUSD(a.saldo_restante)}
            </td>
            <td class="no-print py-3.5 pl-4 text-center">
              <button
                type="button"
                data-recibo-id="${a.id}"
                title="Ver comprobante"
                class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-brand-petrol hover:text-white text-slate-600 transition inline-flex items-center justify-center cursor-pointer"
              >
                <i class="fa-regular fa-eye text-xs"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Modal de comprobante al hacer clic en el ojo
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-recibo-id]");
    if (!btn) return;

    const id = Number(btn.dataset.reciboId);
    const mov = DB.obtenerAbonos().find((a) => a.id === id);
    if (!mov) return;

    const tipo = mov.tipo_movimiento || "Abono Deuda";
    const interes = Number(mov.pagado_interes) || 0;
    const capital = Number(mov.pagado_capital) || 0;

    Swal.fire({
      title: "Comprobante de Pago",
      html: `
        <div class="text-left text-xs space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div class="flex justify-between pb-2 border-b border-slate-200">
            <span class="text-slate-500">Referencia #</span>
            <strong class="text-brand-charcoal">${mov.id}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Fecha:</span>
            <strong class="text-brand-charcoal">${DB.escaparHTML(
              mov.fecha_pago
            )}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Tipo:</span>
            <strong class="text-brand-petrol">${DB.escaparHTML(tipo)}</strong>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-slate-500 shrink-0">Concepto:</span>
            <strong class="text-brand-charcoal text-right">${DB.escaparHTML(
              mov.deuda_titulo
            )}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Monto abonado:</span>
            <strong class="text-emerald-600 text-sm">${DB.escaparHTML(
              mov.monto_abonado
            )} ${DB.escaparHTML(mov.moneda_pago)}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Tasa del día:</span>
            <strong class="text-brand-charcoal">${DB.escaparHTML(
              mov.tasa_cambio_usada
            )}</strong>
          </div>
          ${
            tipo === "Abono Deuda"
              ? `
            <div class="flex justify-between pt-2 border-t border-slate-200">
              <span class="text-slate-500">Aplicado a Interés:</span>
              <strong class="text-amber-600">${interes.toFixed(2)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Aplicado a Capital:</span>
              <strong class="text-emerald-600">${capital.toFixed(2)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Saldo restante (USD ref):</span>
              <strong class="text-brand-charcoal">${formatearUSD(
                mov.saldo_restante
              )}</strong>
            </div>
          `
              : ""
          }
        </div>
      `,
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#02425B",
    });
  });

  // Filtros
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-pill")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filtroTipo = btn.dataset.tipo;
      renderizarTabla();
    });
  });

  document
    .getElementById("filtro-moneda-hist")
    .addEventListener("change", (e) => {
      filtroMoneda = e.target.value;
      renderizarTabla();
    });

  document
    .getElementById("input-buscar-hist")
    .addEventListener("input", (e) => {
      textoBusqueda = e.target.value;
      renderizarTabla();
    });

  // Exportar CSV compatible con Excel
  document
    .getElementById("btn-exportar-csv")
    .addEventListener("click", () => {
      const lista = obtenerListaFiltrada();
      if (lista.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Nada para exportar",
          text: "No hay movimientos visibles en la tabla actual.",
          confirmButtonColor: "#02425B",
        });
        return;
      }

      const encabezados = [
        "Fecha",
        "Concepto / Acreedor",
        "Tipo",
        "Monto",
        "Moneda",
        "Interes Cubierto",
        "Capital Cubierto",
        "Tasa Aplicada",
        "Saldo Restante (USD)",
      ];

      const filas = lista.map((a) => [
        `"${a.fecha_pago}"`,
        `"${(a.deuda_titulo || "").replace(/"/g, '""')}"`,
        `"${a.tipo_movimiento || "Abono Deuda"}"`,
        a.monto_abonado,
        a.moneda_pago,
        Number(a.pagado_interes || 0).toFixed(2),
        Number(a.pagado_capital || 0).toFixed(2),
        `"${a.tasa_cambio_usada}"`,
        Number(a.saldo_restante || 0).toFixed(2),
      ]);

      const csv =
        "\uFEFF" +
        [encabezados.join(","), ...filas.map((f) => f.join(","))].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `historial-pagos-ADD.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });

  // Imprimir
  document
    .getElementById("btn-imprimir-hist")
    .addEventListener("click", () => window.print());

  renderizarResumen();
  renderizarTabla();
});