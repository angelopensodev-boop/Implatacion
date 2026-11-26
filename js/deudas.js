document.addEventListener("DOMContentLoaded", () => {
  let filtroActual = "todas";
  let textoBusqueda = "";
  let deudaSeleccionada = null;

  const contenedor = document.getElementById("contenedor-deudas");
  const modalDeuda = document.getElementById("modal-nueva-deuda");
  const modalAbono = document.getElementById("modal-abono");

  const formatearMoneda = (monto, moneda) => {
    const num = Number(monto).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (moneda === "VES") return `${num} Bs`;
    if (moneda === "USDT") return `${num} USDT`;
    return `$${num}`;
  };

  function refrescarTodo() {
    renderizarDeudas();
    if (typeof window.actualizarAlertasTopbar === "function") {
      window.actualizarAlertasTopbar();
    }
  }

  // 1. Pintar tarjetas de deudas y resumen superior
  function renderizarDeudas() {
    const todas = DB.obtenerDeudas();
    const activas = todas.filter((d) => d.estado !== "pagada");

    const capitalUsd = activas.reduce(
      (acc, d) => acc + DB.aDolares(d.saldo_capital_actual, d.moneda_base),
      0
    );
    const interesUsd = activas.reduce(
      (acc, d) => acc + DB.aDolares(d.interes_pendiente, d.moneda_base),
      0
    );

    document.getElementById("resumen-activas").textContent = activas.length;
    document.getElementById("resumen-capital").textContent = formatearMoneda(
      capitalUsd,
      "USD"
    );
    document.getElementById("resumen-interes").textContent = formatearMoneda(
      interesUsd,
      "USD"
    );

    const filtradas = todas.filter((d) => {
      const coincideTexto = `${d.acreedor} ${d.concepto}`
        .toLowerCase()
        .includes(textoBusqueda.toLowerCase());
      if (!coincideTexto) return false;

      if (filtroActual === "todas") return d.estado !== "pagada";
      if (filtroActual === "pagada") return d.estado === "pagada";
      return d.estado !== "pagada" && d.categoria === filtroActual;
    });

    if (filtradas.length === 0) {
      contenedor.innerHTML = `
        <div class="md:col-span-2 panel-card p-10 text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mx-auto">
            <i class="fa-solid fa-wallet text-lg"></i>
          </div>
          <p class="text-sm font-bold text-brand-charcoal">No hay deudas para mostrar en esta vista</p>
          <p class="text-xs text-slate-500">Haz clic en "Nueva Deuda" para registrar tu primer compromiso.</p>
        </div>
      `;
      return;
    }

    contenedor.innerHTML = filtradas
      .map((d) => {
        const totalActual = DB.totalDeuda(d);
        const pagadoPct =
          d.monto_inicial > 0
            ? Math.min(
                100,
                Math.max(
                  0,
                  Math.round(
                    ((d.monto_inicial - d.saldo_capital_actual) /
                      d.monto_inicial) *
                      100
                  )
                )
              )
            : 100;

        const dias = DB.diasRestantes(d.proxima_fecha_pago);
        let badgeFecha = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">Faltan ${dias} días</span>`;
        if (d.estado === "pagada") {
          badgeFecha = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">Pagada</span>`;
        } else if (dias <= 0) {
          badgeFecha = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">${
            dias === 0 ? "Vence hoy" : `Vencida (${Math.abs(dias)}d)`
          }</span>`;
        } else if (dias <= 15) {
          badgeFecha = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Faltan ${dias} días</span>`;
        }

        const etiquetaTasaBs = d.moneda_base === "USDT" ? "USDT" : "BCV";
        const equivBs =
          d.moneda_base === "VES"
            ? ""
            : `≈ ${DB.aBolivares(totalActual, d.moneda_base).toLocaleString(
                "es-VE",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )} Bs (${etiquetaTasaBs})`;

        return `
          <article class="debt-card p-5 flex flex-col justify-between gap-4">
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-base font-extrabold text-brand-charcoal truncate">${DB.escaparHTML(
                      d.acreedor
                    )}</h3>
                    <span class="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold uppercase text-slate-600">${DB.escaparHTML(
                      d.categoria
                    )}</span>
                    <span class="px-2 py-0.5 rounded-md bg-brand-cyan/10 text-[10px] font-bold uppercase text-brand-petrol">${DB.escaparHTML(
                      d.moneda_base
                    )}</span>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">${DB.escaparHTML(
                    d.concepto
                  )} · Pago ${DB.escaparHTML(d.frecuencia_pago)}</p>
                </div>
                ${badgeFecha}
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 grid grid-cols-2 gap-3">
                <div>
                  <span class="text-[11px] text-slate-400 block">Saldo total pendiente</span>
                  <strong class="text-lg font-extrabold text-brand-petrol">${formatearMoneda(
                    totalActual,
                    d.moneda_base
                  )}</strong>
                  ${
                    equivBs
                      ? `<span class="text-[11px] text-slate-400 block">${equivBs}</span>`
                      : ""
                  }
                </div>
                <div class="text-right">
                  <span class="text-[11px] text-slate-400 block">Desglose</span>
                  <span class="text-xs font-semibold text-slate-600 block">Capital: ${formatearMoneda(
                    d.saldo_capital_actual,
                    d.moneda_base
                  )}</span>
                  <span class="text-xs font-semibold ${
                    d.interes_pendiente > 0
                      ? "text-amber-600"
                      : "text-slate-400"
                  } block">
                    Interés: ${formatearMoneda(
                      d.interes_pendiente,
                      d.moneda_base
                    )}
                  </span>
                </div>
              </div>

              <div class="space-y-1">
                <div class="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Capital pagado: ${pagadoPct}%</span>
                  <span>Tasa ${DB.escaparHTML(d.tipo_tasa)} (${
          d.tasa_interes
        }%)</span>
                </div>
                <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full bg-brand-cyan rounded-full transition-all duration-300" style="width: ${pagadoPct}%"></div>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                ${
                  d.tipo_tasa === "Variable" && d.estado !== "pagada"
                    ? `<button type="button" data-action="tasa" data-id="${d.id}" class="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition cursor-pointer">
                        <i class="fa-solid fa-percent mr-1"></i>Ajustar tasa
                      </button>`
                    : `<span class="text-[11px] text-slate-400">Vence: ${DB.escaparHTML(
                        d.proxima_fecha_pago
                      )}</span>`
                }
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-action="eliminar"
                  data-id="${d.id}"
                  title="Eliminar deuda"
                  class="w-8 h-8 rounded-lg text-slate-400 hover:text-brand-coral hover:bg-rose-50 transition flex items-center justify-center cursor-pointer"
                >
                  <i class="fa-regular fa-trash-can text-xs"></i>
                </button>
                ${
                  d.estado !== "pagada"
                    ? `<button type="button" data-action="abonar" data-id="${d.id}" class="px-4 py-1.5 rounded-xl bg-brand-petrol hover:bg-brand-petrolDark text-white text-xs font-bold shadow-sm transition cursor-pointer">
                        Abonar
                      </button>`
                    : ""
                }
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // 2. Filtros y búsqueda
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-pill")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filtroActual = btn.dataset.cat;
      renderizarDeudas();
    });
  });

  document
    .getElementById("input-buscar-deuda")
    .addEventListener("input", (e) => {
      textoBusqueda = e.target.value;
      renderizarDeudas();
    });

  // 3. Modal Nueva Deuda
  const tipoTasaSelect = document.getElementById("deuda-tipo-tasa");
  const tasaInput = document.getElementById("deuda-tasa");

  function abrirModalNuevaDeuda() {
    document.getElementById("form-nueva-deuda").reset();
    tasaInput.value = 0;
    tasaInput.disabled = true;
    tasaInput.classList.add("bg-slate-100", "text-slate-400");
    modalDeuda.classList.remove("hidden");
  }

  tipoTasaSelect.addEventListener("change", () => {
    if (tipoTasaSelect.value === "Sin interés") {
      tasaInput.value = 0;
      tasaInput.disabled = true;
      tasaInput.classList.add("bg-slate-100", "text-slate-400");
    } else {
      tasaInput.disabled = false;
      tasaInput.classList.remove("bg-slate-100", "text-slate-400");
      if (Number(tasaInput.value) === 0) tasaInput.value = 5;
    }
  });

  document
    .getElementById("btn-abrir-modal-deuda")
    .addEventListener("click", abrirModalNuevaDeuda);

  ["btn-cerrar-modal-deuda", "btn-cancelar-deuda"].forEach((id) => {
    document
      .getElementById(id)
      .addEventListener("click", () => modalDeuda.classList.add("hidden"));
  });

  document
    .getElementById("form-nueva-deuda")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      DB.agregarDeuda({
        acreedor: document.getElementById("deuda-acreedor").value.trim(),
        concepto: document.getElementById("deuda-concepto").value.trim(),
        categoria: document.getElementById("deuda-categoria").value,
        moneda_base: document.getElementById("deuda-moneda").value,
        monto_inicial: document.getElementById("deuda-monto").value,
        tipo_tasa: tipoTasaSelect.value,
        tasa_interes: tasaInput.value,
        frecuencia_pago: document.getElementById("deuda-frecuencia").value,
        proxima_fecha_pago: document.getElementById("deuda-fecha").value,
      });

      modalDeuda.classList.add("hidden");
      refrescarTodo();
      Swal.fire({
        icon: "success",
        title: "Deuda registrada",
        timer: 1300,
        showConfirmButton: false,
      });
    });

  // 4. Acciones en tarjetas (Abonar, Ajustar Tasa Variable, Eliminar)
  function obtenerCalculoAbono() {
    const tasas = DB.obtenerTasas();
    const monedaPago = document.getElementById("abono-moneda-pago").value;
    const montoPago = Number(document.getElementById("abono-monto").value) || 0;
    const tipoTasa = document.getElementById("abono-tasa-tipo").value;
    const valorTasa = tipoTasa === "USDT" ? tasas.usdt : tasas.bcv;

    const eq = DB.convertirMoneda(
      montoPago,
      monedaPago,
      deudaSeleccionada.moneda_base,
      valorTasa
    );
    const totalPendiente = DB.totalDeuda(deudaSeleccionada);
    const aInteres = Math.min(eq, deudaSeleccionada.interes_pendiente);
    const sobrante = Math.max(0, eq - aInteres);
    const aCapital = Math.min(sobrante, deudaSeleccionada.saldo_capital_actual);
    const restante = Math.max(0, totalPendiente - (aInteres + aCapital));

    return {
      monedaPago,
      montoPago,
      tipoTasa,
      valorTasa,
      eq,
      totalPendiente,
      aInteres,
      aCapital,
      restante,
    };
  }

  function actualizarVistaPreviaAbono() {
    if (!deudaSeleccionada) return;
    const { eq, aInteres, aCapital, restante } = obtenerCalculoAbono();
    const m = deudaSeleccionada.moneda_base;

    document.getElementById("preview-equivalente").textContent =
      formatearMoneda(eq, m);
    document.getElementById("preview-interes").textContent = formatearMoneda(
      aInteres,
      m
    );
    document.getElementById("preview-capital").textContent = formatearMoneda(
      aCapital,
      m
    );
    document.getElementById("preview-restante").textContent = formatearMoneda(
      restante,
      m
    );
  }

  contenedor.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    const deuda = DB.obtenerDeudas().find((d) => d.id === id);
    if (!deuda) return;

    if (action === "abonar") {
      deudaSeleccionada = deuda;
      const tasas = DB.obtenerTasas();
      const totalActual = DB.totalDeuda(deuda);

      document.getElementById("abono-deuda-id").value = deuda.id;
      document.getElementById(
        "abono-subtitulo"
      ).textContent = `${deuda.acreedor} — ${deuda.concepto}`;
      document.getElementById("abono-capital-actual").textContent =
        formatearMoneda(deuda.saldo_capital_actual, deuda.moneda_base);
      document.getElementById("abono-interes-actual").textContent =
        formatearMoneda(deuda.interes_pendiente, deuda.moneda_base);
      document.getElementById("abono-total-actual").textContent =
        formatearMoneda(totalActual, deuda.moneda_base);

      document.getElementById("abono-moneda-pago").value = deuda.moneda_base;
      document.getElementById("abono-monto").value = "";
      document.getElementById("abono-nueva-fecha").value = "";

      document.getElementById("abono-tasa-tipo").innerHTML = `
        <option value="BCV">Tasa Oficial BCV (${tasas.bcv.toFixed(2)} Bs)</option>
        <option value="USDT">Tasa USDT (${tasas.usdt.toFixed(2)} Bs)</option>
      `;
      if (deuda.moneda_base === "USDT") {
        document.getElementById("abono-tasa-tipo").value = "USDT";
      }

      actualizarVistaPreviaAbono();
      modalAbono.classList.remove("hidden");
    }

    if (action === "tasa") {
      Swal.fire({
        title: "Actualizar Tasa Variable",
        text: `El nuevo porcentaje se aplicará únicamente sobre el capital pendiente (${formatearMoneda(
          deuda.saldo_capital_actual,
          deuda.moneda_base
        )}):`,
        input: "number",
        inputValue: deuda.tasa_interes,
        inputAttributes: { min: 0, step: "0.1" },
        showCancelButton: true,
        confirmButtonText: "Aplicar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#02425B",
      }).then((res) => {
        if (res.isConfirmed) {
          DB.actualizarTasaVariable(deuda.id, res.value);
          refrescarTodo();
          Swal.fire({
            icon: "success",
            title: "Tasa actualizada",
            timer: 1200,
            showConfirmButton: false,
          });
        }
      });
    }

    if (action === "eliminar") {
      Swal.fire({
        title: "¿Eliminar esta deuda?",
        text: "Esta acción quitará el registro de la lista.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#EB2227",
      }).then((res) => {
        if (res.isConfirmed) {
          DB.eliminarDeuda(deuda.id);
          refrescarTodo();
        }
      });
    }
  });

  // Botón rápido "Pagar saldo completo"
  document.getElementById("btn-pagar-total").addEventListener("click", () => {
    if (!deudaSeleccionada) return;
    const tasas = DB.obtenerTasas();
    const monedaPago = document.getElementById("abono-moneda-pago").value;
    const tipoTasa = document.getElementById("abono-tasa-tipo").value;
    const valorTasa = tipoTasa === "USDT" ? tasas.usdt : tasas.bcv;
    const total = DB.totalDeuda(deudaSeleccionada);

    const necesario = DB.convertirMoneda(
      total,
      deudaSeleccionada.moneda_base,
      monedaPago,
      valorTasa
    );
    const redondeado = Math.ceil(necesario * 100) / 100;
    document.getElementById("abono-monto").value = redondeado.toFixed(2);
    actualizarVistaPreviaAbono();
  });

  document
    .getElementById("abono-monto")
    .addEventListener("input", actualizarVistaPreviaAbono);
  document
    .getElementById("abono-moneda-pago")
    .addEventListener("change", actualizarVistaPreviaAbono);
  document
    .getElementById("abono-tasa-tipo")
    .addEventListener("change", actualizarVistaPreviaAbono);

  ["btn-cerrar-modal-abono", "btn-cancelar-abono"].forEach((id) => {
    document
      .getElementById(id)
      .addEventListener("click", () => modalAbono.classList.add("hidden"));
  });

  // Cerrar modales al hacer clic fuera o presionar Escape
  [modalDeuda, modalAbono].forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      modalDeuda.classList.add("hidden");
      modalAbono.classList.add("hidden");
    }
  });

  document.getElementById("form-abono").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!deudaSeleccionada) return;

    const { monedaPago, montoPago, tipoTasa, valorTasa, eq, totalPendiente } =
      obtenerCalculoAbono();

    if (eq > totalPendiente + 0.05) {
      Swal.fire({
        icon: "warning",
        title: "El monto supera el saldo pendiente",
        text: `El equivalente (${formatearMoneda(
          eq,
          deudaSeleccionada.moneda_base
        )}) es mayor al total pendiente (${formatearMoneda(
          totalPendiente,
          deudaSeleccionada.moneda_base
        )}). Usa "Pagar saldo completo" para el monto exacto.`,
        confirmButtonColor: "#02425B",
      });
      return;
    }

    DB.registrarAbono({
      deudaId: document.getElementById("abono-deuda-id").value,
      montoPago,
      monedaPago,
      tipoTasa,
      valorTasa,
      nuevaFechaPago: document.getElementById("abono-nueva-fecha").value,
    });

    modalAbono.classList.add("hidden");
    refrescarTodo();
    Swal.fire({
      icon: "success",
      title: "Abono aplicado",
      text: "El saldo se actualizó y el movimiento quedó guardado en el historial.",
      confirmButtonColor: "#02425B",
    });
  });

  // Abrir modal automáticamente si viene desde "+ Nueva Deuda" en el Dashboard
  const params = new URLSearchParams(window.location.search);
  if (params.get("nueva") === "1") {
    abrirModalNuevaDeuda();
    window.history.replaceState({}, "", "deudas.html");
  }

  renderizarDeudas();
});