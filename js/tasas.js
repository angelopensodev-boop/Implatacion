document.addEventListener("DOMContentLoaded", () => {
  const inputOrigen = document.getElementById("conv-monto-origen");
  const selectOrigen = document.getElementById("conv-moneda-origen");
  const selectDestino = document.getElementById("conv-moneda-destino");
  const inputDestino = document.getElementById("conv-monto-destino");
  const btnSync = document.getElementById("btn-sincronizar-tasas");
  const iconoSync = document.getElementById("icono-sync");

  const formatoNum = (n) =>
    Number(n).toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  function renderizarTasas() {
    const tasas = DB.obtenerTasas();
    const brecha =
      tasas.bcv > 0 ? ((tasas.usdt - tasas.bcv) / tasas.bcv) * 100 : 0;

    document.getElementById("card-bcv-valor").textContent = `${formatoNum(
      tasas.bcv
    )} Bs`;
    document.getElementById("card-usdt-valor").textContent = `${formatoNum(
      tasas.usdt
    )} Bs`;
    document.getElementById(
      "card-brecha-valor"
    ).textContent = `${brecha.toFixed(1)}%`;

    const fecha = new Date(tasas.fecha_actualizacion);
    const fechaTxt = isNaN(fecha)
      ? "Sin sincronizar"
      : `${fecha.toLocaleDateString("es-VE")} · ${fecha.toLocaleTimeString(
          "es-VE",
          { hour: "2-digit", minute: "2-digit" }
        )}`;
    document.getElementById("card-ultima-sync").textContent = fechaTxt;

    const badge = document.getElementById("card-fuente-badge");
    badge.textContent = tasas.fuente || "Manual";
    if (tasas.fuente === "API") {
      badge.className =
        "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700";
    } else {
      badge.className =
        "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800";
    }

    // Llenar inputs de ajuste manual
    document.getElementById("manual-bcv").value = tasas.bcv.toFixed(2);
    document.getElementById("manual-usdt").value = tasas.usdt.toFixed(2);

    calcularConversion();
    renderizarHistorialTasas();
  }

  function calcularConversion() {
    const tasas = DB.obtenerTasas();
    const monto = Math.max(0, Number(inputOrigen.value) || 0);
    const origen = selectOrigen.value;
    const destino = selectDestino.value;

    // Primero llevamos el monto a Bolívares para tener base exacta en las 3 monedas
    let enBs = monto;
    if (origen === "USD") enBs = monto * tasas.bcv;
    if (origen === "USDT") enBs = monto * tasas.usdt;

    const enUsd = tasas.bcv > 0 ? enBs / tasas.bcv : 0;
    const enUsdt = tasas.usdt > 0 ? enBs / tasas.usdt : 0;

    let resultado = enBs;
    let sufijo = " Bs";
    if (destino === "USD") {
      resultado = enUsd;
      sufijo = " USD";
    } else if (destino === "USDT") {
      resultado = enUsdt;
      sufijo = " USDT";
    }

    inputDestino.value = `${formatoNum(resultado)}${sufijo}`;
    document.getElementById("comp-ves").textContent = `${formatoNum(enBs)} Bs`;
    document.getElementById("comp-usd").textContent = `$${formatoNum(enUsd)}`;
    document.getElementById("comp-usdt").textContent = `${formatoNum(
      enUsdt
    )} USDT`;
  }

  function renderizarHistorialTasas() {
    const historial = DB.obtenerHistorialTasas();
    const tbody = document.getElementById("tabla-historial-tasas");

    if (historial.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-xs text-slate-400">
            Pulsa "Actualizar Hoy" para registrar la tasa real de hoy en tu historial.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = historial
      .map((h) => {
        const brecha = h.bcv > 0 ? ((h.usdt - h.bcv) / h.bcv) * 100 : 0;
        const badge =
          h.fuente === "API"
            ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">Automática (API)</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Manual</span>`;

        return `
          <tr class="hover:bg-slate-50/70 transition">
            <td class="py-3 pr-4 font-bold text-brand-charcoal">${DB.escaparHTML(
              h.fecha_dia
            )}</td>
            <td class="py-3 px-4 text-xs text-slate-500">${DB.escaparHTML(
              h.hora
            )}</td>
            <td class="py-3 px-4 font-bold text-brand-cyan">${formatoNum(
              h.bcv
            )} Bs</td>
            <td class="py-3 px-4 font-bold text-amber-600">${formatoNum(
              h.usdt
            )} Bs</td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-600">${brecha.toFixed(
              1
            )}%</td>
            <td class="py-3 pl-4 text-right">${badge}</td>
          </tr>
        `;
      })
      .join("");
  }

  // Botón Actualizar Hoy (consulta API en vivo)
  btnSync.addEventListener("click", async () => {
    iconoSync.classList.add("fa-spin");
    btnSync.disabled = true;

    const res = await DB.sincronizarTasasEnVivo(true);

    iconoSync.classList.remove("fa-spin");
    btnSync.disabled = false;

    if (res.ok) {
      renderizarTasas();
      Swal.fire({
        icon: "success",
        title: "Tasas actualizadas",
        html: `BCV: <b>${res.tasas.bcv.toFixed(2)} Bs</b> · USDT: <b>${res.tasas.usdt.toFixed(
          2
        )} Bs</b>`,
        confirmButtonColor: "#02425B",
      });
    } else {
      Swal.fire({
        icon: "warning",
        title: "No se pudo conectar con la API",
        text: "Verifica tu conexión a internet o usa el recuadro de Ajuste Manual.",
        confirmButtonColor: "#02425B",
      });
    }
  });

  // Invertir monedas del conversor
  document.getElementById("btn-invertir-conv").addEventListener("click", () => {
    const temp = selectOrigen.value;
    selectOrigen.value = selectDestino.value;
    selectDestino.value = temp;
    calcularConversion();
  });

  inputOrigen.addEventListener("input", calcularConversion);
  selectOrigen.addEventListener("change", calcularConversion);
  selectDestino.addEventListener("change", calcularConversion);

  // Ajuste manual
  document
    .getElementById("form-tasas-manual")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      const bcv = Number(document.getElementById("manual-bcv").value);
      const usdt = Number(document.getElementById("manual-usdt").value);

      if (bcv <= 0 || usdt <= 0) return;

      DB.guardarTasas({ bcv, usdt, fuente: "Manual" });
      renderizarTasas();
      Swal.fire({
        icon: "success",
        title: "Tasas guardadas",
        timer: 1200,
        showConfirmButton: false,
      });
    });

  // Refrescar automáticamente si layout.js terminó la sincronización diaria
  window.addEventListener("tasasActualizadas", renderizarTasas);

  renderizarTasas();
});