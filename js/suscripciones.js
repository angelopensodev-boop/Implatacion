document.addEventListener("DOMContentLoaded", () => {
  let filtroActual = "todas";
  let textoBusqueda = "";
  let subSeleccionada = null;

  const contenedor = document.getElementById("contenedor-subs");
  const modalSub = document.getElementById("modal-nueva-sub");
  const modalPago = document.getElementById("modal-pagar-sub");

  const iconosPorCategoria = {
    Servicios: "fa-solid fa-wifi",
    Vivienda: "fa-solid fa-house-chimney",
    Suscripciones: "fa-solid fa-tv",
    Otros: "fa-solid fa-receipt",
  };

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
    renderizarSuscripciones();
    if (typeof window.actualizarAlertasTopbar === "function") {
      window.actualizarAlertasTopbar();
    }
  }

  function renderizarSuscripciones() {
    const todas = DB.obtenerSuscripciones();
    const activas = todas.filter((s) => s.estado === "activa");
    const pausadas = todas.filter((s) => s.estado === "pausada");
    const tasas = DB.obtenerTasas();

    // Resumen superior
    const totalMensualUsd = activas.reduce(
      (acc, s) => acc + DB.montoMensualSuscripcionUsd(s),
      0
    );
    const proximos15 = activas.filter(
      (s) => DB.diasRestantes(s.proxima_fecha_pago) <= 15
    ).length;

    document.getElementById("sub-total-mensual").textContent = formatearMoneda(
      totalMensualUsd,
      "USD"
    );
    document.getElementById("sub-total-bs").textContent = `≈ ${(
      totalMensualUsd * tasas.bcv
    ).toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Bs (BCV)`;
    document.getElementById(
      "sub-conteo"
    ).textContent = `${activas.length} / ${pausadas.length}`;
    document.getElementById("sub-proximos").textContent = proximos15;

    // Filtrar
    const filtradas = todas.filter((s) => {
      const coincide = `${s.nombre} ${s.categoria}`
        .toLowerCase()
        .includes(textoBusqueda.toLowerCase());
      if (!coincide) return false;

      if (filtroActual === "todas") return s.estado === "activa";
      if (filtroActual === "pausada") return s.estado === "pausada";
      return s.estado === "activa" && s.categoria === filtroActual;
    });

    if (filtradas.length === 0) {
      contenedor.innerHTML = `
        <div class="md:col-span-2 lg:col-span-3 panel-card p-10 text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mx-auto">
            <i class="fa-solid fa-rotate text-lg"></i>
          </div>
          <p class="text-sm font-bold text-brand-charcoal">No hay gastos fijos en esta vista</p>
          <p class="text-xs text-slate-500">Agrega servicios como internet, alquiler o suscripciones para llevar su control mensual.</p>
        </div>
      `;
      return;
    }

    contenedor.innerHTML = filtradas
      .map((s) => {
        const pausada = s.estado === "pausada";
        const dias = DB.diasRestantes(s.proxima_fecha_pago);

        let badgeFecha = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">En ${dias} días</span>`;
        if (pausada) {
          badgeFecha = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-600">Pausado</span>`;
        } else if (dias <= 0) {
          badgeFecha = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">${
            dias === 0 ? "Corte hoy" : `Atrasado (${Math.abs(dias)}d)`
          }</span>`;
        } else if (dias <= 15) {
          badgeFecha = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">En ${dias} días</span>`;
        }

        const etiquetaTasa = s.moneda === "USDT" ? "USDT" : "BCV";
        const equivBs =
          s.moneda === "VES"
            ? ""
            : `≈ ${DB.aBolivares(s.monto, s.moneda).toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} Bs (${etiquetaTasa})`;

        const icono = iconosPorCategoria[s.categoria] || "fa-solid fa-receipt";

        return `
          <article class="sub-card ${
            pausada ? "is-paused" : ""
          } p-5 flex flex-col justify-between gap-4">
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl bg-brand-petrol/10 text-brand-petrol flex items-center justify-center shrink-0">
                    <i class="${icono} text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <h3 class="text-sm font-extrabold text-brand-charcoal truncate">${DB.escaparHTML(
                      s.nombre
                    )}</h3>
                    <p class="text-[11px] text-slate-500">${DB.escaparHTML(
                      s.categoria
                    )} · ${DB.escaparHTML(s.frecuencia)}</p>
                  </div>
                </div>
                ${badgeFecha}
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 flex items-center justify-between">
                <div>
                  <span class="text-[11px] text-slate-400 block">Monto</span>
                  <strong class="text-lg font-extrabold text-brand-petrol">${formatearMoneda(
                    s.monto,
                    s.moneda
                  )}</strong>
                  ${
                    equivBs
                      ? `<span class="text-[11px] text-slate-400 block">${equivBs}</span>`
                      : ""
                  }
                </div>
                <div class="text-right">
                  <span class="text-[11px] text-slate-400 block">Próximo corte</span>
                  <span class="text-xs font-bold text-slate-700">${DB.escaparHTML(
                    s.proxima_fecha_pago
                  )}</span>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  data-action="pausar"
                  data-id="${s.id}"
                  title="${pausada ? "Reactivar" : "Pausar"}"
                  class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition cursor-pointer"
                >
                  <i class="fa-solid ${
                    pausada ? "fa-play" : "fa-pause"
                  } text-[10px] mr-1"></i>${pausada ? "Activar" : "Pausar"}
                </button>
                <button
                  type="button"
                  data-action="eliminar"
                  data-id="${s.id}"
                  title="Eliminar"
                  class="w-8 h-8 rounded-lg text-slate-400 hover:text-brand-coral hover:bg-rose-50 transition flex items-center justify-center cursor-pointer"
                >
                  <i class="fa-regular fa-trash-can text-xs"></i>
                </button>
              </div>

              ${
                !pausada
                  ? `<button type="button" data-action="pagar" data-id="${s.id}" class="px-3.5 py-1.5 rounded-xl bg-brand-petrol hover:bg-brand-petrolDark text-white text-xs font-bold shadow-sm transition cursor-pointer">
                      Registrar pago
                    </button>`
                  : ""
              }
            </div>
          </article>
        `;
      })
      .join("");
  }

  // Filtros y búsqueda
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-pill")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filtroActual = btn.dataset.cat;
      renderizarSuscripciones();
    });
  });

  document.getElementById("input-buscar-sub").addEventListener("input", (e) => {
    textoBusqueda = e.target.value;
    renderizarSuscripciones();
  });

  // Modal Nuevo Gasto Fijo
  document.getElementById("btn-abrir-modal-sub").addEventListener("click", () => {
    document.getElementById("form-nueva-sub").reset();
    modalSub.classList.remove("hidden");
  });

  ["btn-cerrar-modal-sub", "btn-cancelar-sub"].forEach((id) => {
    document
      .getElementById(id)
      .addEventListener("click", () => modalSub.classList.add("hidden"));
  });

  document.getElementById("form-nueva-sub").addEventListener("submit", (e) => {
    e.preventDefault();
    DB.agregarSuscripcion({
      nombre: document.getElementById("sub-nombre").value.trim(),
      categoria: document.getElementById("sub-categoria").value,
      frecuencia: document.getElementById("sub-frecuencia").value,
      moneda: document.getElementById("sub-moneda").value,
      monto: document.getElementById("sub-monto").value,
      proxima_fecha_pago: document.getElementById("sub-fecha").value,
    });

    modalSub.classList.add("hidden");
    refrescarTodo();
    Swal.fire({
      icon: "success",
      title: "Gasto fijo guardado",
      timer: 1200,
      showConfirmButton: false,
    });
  });

  // Vista previa del modal de pago
  function actualizarPreviewPagoSub() {
    if (!subSeleccionada) return;
    const tasas = DB.obtenerTasas();
    const monedaPago = document.getElementById("pago-sub-moneda").value;
    const tipoTasa = document.getElementById("pago-sub-tasa").value;
    const valorTasa = tipoTasa === "USDT" ? tasas.usdt : tasas.bcv;

    const total = DB.convertirMoneda(
      subSeleccionada.monto,
      subSeleccionada.moneda,
      monedaPago,
      valorTasa
    );
    const siguiente = DB.calcularSiguienteFecha(
      subSeleccionada.proxima_fecha_pago,
      subSeleccionada.frecuencia
    );

    document.getElementById("pago-sub-total").textContent = formatearMoneda(
      total,
      monedaPago
    );
    document.getElementById("pago-sub-nueva-fecha").textContent = siguiente;
  }

  // Acciones en tarjetas
  contenedor.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    const sub = DB.obtenerSuscripciones().find((s) => s.id === id);
    if (!sub) return;

    if (action === "pausar") {
      DB.alternarEstadoSuscripcion(id);
      refrescarTodo();
    }

    if (action === "eliminar") {
      Swal.fire({
        title: "¿Eliminar este gasto fijo?",
        text: "Se quitará de tu lista de compromisos recurrentes.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#EB2227",
      }).then((res) => {
        if (res.isConfirmed) {
          DB.eliminarSuscripcion(id);
          refrescarTodo();
        }
      });
    }

    if (action === "pagar") {
      subSeleccionada = sub;
      const tasas = DB.obtenerTasas();
      document.getElementById("pago-sub-id").value = sub.id;
      document.getElementById(
        "pago-sub-nombre"
      ).textContent = `${sub.nombre} (${sub.frecuencia})`;
      document.getElementById("pago-sub-moneda").value = sub.moneda;
      document.getElementById("pago-sub-tasa").innerHTML = `
        <option value="BCV">BCV (${tasas.bcv.toFixed(2)} Bs)</option>
        <option value="USDT">USDT (${tasas.usdt.toFixed(2)} Bs)</option>
      `;
      if (sub.moneda === "USDT") {
        document.getElementById("pago-sub-tasa").value = "USDT";
      }
      actualizarPreviewPagoSub();
      modalPago.classList.remove("hidden");
    }
  });

  document
    .getElementById("pago-sub-moneda")
    .addEventListener("change", actualizarPreviewPagoSub);
  document
    .getElementById("pago-sub-tasa")
    .addEventListener("change", actualizarPreviewPagoSub);

  ["btn-cerrar-modal-pago-sub", "btn-cancelar-pago-sub"].forEach((id) => {
    document
      .getElementById(id)
      .addEventListener("click", () => modalPago.classList.add("hidden"));
  });

  [modalSub, modalPago].forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      modalSub.classList.add("hidden");
      modalPago.classList.add("hidden");
    }
  });

  document.getElementById("form-pagar-sub").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!subSeleccionada) return;

    const tasas = DB.obtenerTasas();
    const tipoTasa = document.getElementById("pago-sub-tasa").value;
    const valorTasa = tipoTasa === "USDT" ? tasas.usdt : tasas.bcv;

    DB.registrarPagoSuscripcion({
      subId: document.getElementById("pago-sub-id").value,
      monedaPago: document.getElementById("pago-sub-moneda").value,
      tipoTasa,
      valorTasa,
    });

    modalPago.classList.add("hidden");
    refrescarTodo();
    Swal.fire({
      icon: "success",
      title: "Pago registrado",
      text: "Se guardó en el historial y avanzó la próxima fecha de corte.",
      confirmButtonColor: "#02425B",
    });
  });

  renderizarSuscripciones();
});