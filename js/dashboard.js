document.addEventListener("DOMContentLoaded", () => {
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

  function renderizarDashboard() {
    const usuario = DB.obtenerUsuario();
    const deudas = DB.obtenerDeudas().filter((d) => d.estado !== "pagada");
    const suscripciones = DB.obtenerSuscripciones().filter(
      (s) => s.estado === "activa"
    );
    const abonos = DB.obtenerAbonos();

    // 1. Cálculos para los 3 KPIs (incluyendo capital + interés pendiente)
    const deudaTotalUsd = deudas.reduce(
      (acc, d) => acc + DB.aDolares(DB.totalDeuda(d), d.moneda_base),
      0
    );
    const deudaTotalBs = deudas.reduce(
      (acc, d) => acc + DB.aBolivares(DB.totalDeuda(d), d.moneda_base),
      0
    );

    const cuotasMesUsd = deudas
      .filter((d) => DB.diasRestantes(d.proxima_fecha_pago) <= 30)
      .reduce(
        (acc, d) => acc + DB.aDolares(DB.totalDeuda(d), d.moneda_base),
        0
      );

    const fijosMesUsd = suscripciones.reduce(
      (acc, s) =>
        acc +
        (typeof DB.montoMensualSuscripcionUsd === "function"
          ? DB.montoMensualSuscripcionUsd(s)
          : DB.aDolares(s.monto, s.moneda)),
      0
    );
    const compromisosMesUsd = cuotasMesUsd + fijosMesUsd;

    // Pintar KPI 1 y 2
    document.getElementById("kpi-deuda-total").textContent =
      formatearUSD(deudaTotalUsd);
    document.getElementById("kpi-deuda-bs").textContent = `≈ ${formatearBs(
      deudaTotalBs
    )} (según moneda)`;
    document.getElementById("kpi-compromisos-mes").textContent =
      formatearUSD(compromisosMesUsd);
    document.getElementById(
      "kpi-desglose-mes"
    ).textContent = `Cuotas: ${formatearUSD(cuotasMesUsd)} · Fijos: ${formatearUSD(
      fijosMesUsd
    )}`;

    // Pintar KPI 3 (Ingreso mensual y capacidad)
    const ingreso = Number(usuario.ingreso_mensual) || 0;
    document.getElementById("kpi-ingreso").textContent = formatearUSD(ingreso);
    const pct =
      ingreso > 0
        ? Math.min(100, Math.round((compromisosMesUsd / ingreso) * 100))
        : 0;
    document.getElementById(
      "kpi-porcentaje-texto"
    ).textContent = `${pct}% comprometido`;

    const barra = document.getElementById("kpi-barra-progreso");
    const badge = document.getElementById("kpi-estado-badge");
    barra.style.width = `${pct}%`;

    if (ingreso === 0) {
      barra.className =
        "h-full bg-slate-300 rounded-full transition-all duration-500";
      badge.className =
        "px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500";
      badge.textContent = "Sin definir";
    } else if (pct > 70) {
      barra.className =
        "h-full bg-brand-coral rounded-full transition-all duration-500";
      badge.className =
        "px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700";
      badge.textContent = "Alto";
    } else if (pct > 45) {
      barra.className =
        "h-full bg-brand-amber rounded-full transition-all duration-500";
      badge.className =
        "px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800";
      badge.textContent = "Moderado";
    } else {
      barra.className =
        "h-full bg-emerald-500 rounded-full transition-all duration-500";
      badge.className =
        "px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700";
      badge.textContent = "Saludable";
    }

    // 2. Próximos compromisos
    const listaProximos = document.getElementById("lista-proximos");
    if (deudas.length === 0) {
      listaProximos.innerHTML = `
        <div class="text-center py-10 px-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mx-auto">
            <i class="fa-solid fa-folder-open text-lg"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-brand-charcoal">Aún no tienes deudas registradas</p>
            <p class="text-xs text-slate-500 mt-0.5">
              Cuando cargues tus deudas en el módulo "Mis Deudas", verás aquí tus próximos pagos y avisos.
            </p>
          </div>
          <a href="deudas.html?nueva=1" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-petrol hover:bg-brand-petrolDark text-white text-xs font-bold transition">
            <i class="fa-solid fa-plus"></i> Registrar primera deuda
          </a>
        </div>
      `;
    } else {
      const ordenadas = [...deudas]
        .sort(
          (a, b) =>
            new Date(a.proxima_fecha_pago) - new Date(b.proxima_fecha_pago)
        )
        .slice(0, 5);

      listaProximos.innerHTML = ordenadas
        .map((d) => {
          const dias = DB.diasRestantes(d.proxima_fecha_pago);
          const total = DB.totalDeuda(d);
          const usd = DB.aDolares(total, d.moneda_base);
          const bs = DB.aBolivares(total, d.moneda_base);

          let pill = "bg-emerald-100 text-emerald-700";
          let textoDias = `Faltan ${dias} días`;
          if (dias <= 0) {
            pill = "bg-rose-100 text-rose-700";
            textoDias =
              dias === 0 ? "Vence hoy" : `Vencida (${Math.abs(dias)}d)`;
          } else if (dias <= 15) {
            pill = "bg-amber-100 text-amber-800";
          }

          return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-bold text-brand-charcoal truncate">${DB.escaparHTML(
                    d.acreedor
                  )} — ${DB.escaparHTML(d.concepto)}</p>
                  <span class="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold uppercase text-slate-500">${DB.escaparHTML(
                    d.categoria
                  )}</span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">Frecuencia: ${DB.escaparHTML(
                  d.frecuencia_pago
                )} · Tasa ${DB.escaparHTML(d.tipo_tasa)} (${
            d.tasa_interes
          }%)</p>
              </div>
              <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div class="text-left sm:text-right">
                  <p class="text-sm font-extrabold text-brand-petrol">${formatearUSD(
                    usd
                  )}</p>
                  <p class="text-[11px] text-slate-400">${formatearBs(bs)}</p>
                </div>
                <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${pill}">${textoDias}</span>
              </div>
            </div>
          `;
        })
        .join("");
    }

    // 3. Dónde gastas más y recomendación
    const categorias = {
      Crédito: 0,
      Personal: 0,
      Familiar: 0,
      Suscripciones: fijosMesUsd,
    };
    deudas.forEach((d) => {
      const cat = d.categoria || "Personal";
      if (categorias[cat] === undefined) categorias[cat] = 0;
      categorias[cat] += DB.aDolares(DB.totalDeuda(d), d.moneda_base);
    });

    const totalCat = Object.values(categorias).reduce((a, b) => a + b, 0);
    const colores = {
      Crédito: "bg-brand-petrol",
      Personal: "bg-brand-cyan",
      Familiar: "bg-brand-amber",
      Suscripciones: "bg-brand-royal",
    };

    const listaCategorias = document.getElementById("lista-categorias");
    listaCategorias.innerHTML = Object.entries(categorias)
      .map(([nombre, monto]) => {
        const p = totalCat > 0 ? Math.round((monto / totalCat) * 100) : 0;
        return `
          <div class="space-y-1">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-slate-600">${nombre}</span>
              <span class="text-brand-charcoal">${formatearUSD(
                monto
              )} (${p}%)</span>
            </div>
            <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full ${
                colores[nombre] || "bg-brand-cyan"
              } rounded-full transition-all duration-500" style="width: ${p}%"></div>
            </div>
          </div>
        `;
      })
      .join("");

    const cajaRec = document.getElementById("caja-recomendacion");
    if (totalCat > 0) {
      const [mayorCat, mayorMonto] = Object.entries(categorias).sort(
        (a, b) => b[1] - a[1]
      )[0];
      const mayorPct = Math.round((mayorMonto / totalCat) * 100);
      cajaRec.innerHTML = `
        <i class="fa-solid fa-lightbulb text-brand-amber mt-0.5"></i>
        <p class="text-xs text-slate-700 leading-relaxed">
          Tu mayor concentración está en <strong>${mayorCat} (${mayorPct}%)</strong>.
          Conviene priorizar esos compromisos para liberar capacidad de pago mensual.
        </p>
      `;
    } else {
      cajaRec.innerHTML = `
        <i class="fa-solid fa-lightbulb text-brand-amber mt-0.5"></i>
        <p class="text-xs text-slate-700 leading-relaxed">
          Registra tus deudas y tu ingreso mensual para recibir recomendaciones automáticas.
        </p>
      `;
    }

    // 4. Últimos abonos registrados
    const tablaAbonos = document.getElementById("tabla-abonos");
    if (abonos.length === 0) {
      tablaAbonos.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-xs text-slate-400">
            Todavía no hay abonos registrados. Cuando registres pagos aparecerán aquí con la tasa del día.
          </td>
        </tr>
      `;
    } else {
      tablaAbonos.innerHTML = abonos
        .slice(0, 4)
        .map(
          (a) => `
          <tr class="hover:bg-slate-50/70 transition">
            <td class="py-3 pr-4 text-xs text-slate-500">${DB.escaparHTML(
              a.fecha_pago
            )}</td>
            <td class="py-3 px-4 font-semibold text-brand-charcoal">${DB.escaparHTML(
              a.deuda_titulo
            )}</td>
            <td class="py-3 px-4 font-bold text-emerald-600">${DB.escaparHTML(
              a.monto_abonado
            )} ${DB.escaparHTML(a.moneda_pago)}</td>
            <td class="py-3 px-4 text-xs font-semibold text-brand-petrol">${DB.escaparHTML(
              a.tasa_cambio_usada
            )}</td>
            <td class="py-3 pl-4 text-right font-bold text-brand-charcoal">${formatearUSD(
              a.saldo_restante
            )}</td>
          </tr>
        `
        )
        .join("");
    }
  }

  // Botón rápido de editar ingreso mensual
  const btnEditarIngreso = document.getElementById("btn-editar-ingreso");
  if (btnEditarIngreso) {
    btnEditarIngreso.addEventListener("click", () => {
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
          renderizarDashboard();
          Swal.fire({
            icon: "success",
            title: "Ingreso actualizado",
            timer: 1200,
            showConfirmButton: false,
          });
        }
      });
    });
  }

  window.addEventListener("tasasActualizadas", renderizarDashboard);
  renderizarDashboard();
});