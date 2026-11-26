window.actualizarSaludoTopbar = function () {
  const usuario = DB.obtenerUsuario();
  const greetingEl = document.getElementById("topbar-greeting");
  if (greetingEl) {
    const primerNombre = usuario.nombre.split(" ")[0];
    greetingEl.textContent = `Hola, ${primerNombre}`;
  }
};

window.actualizarTasasTopbar = function () {
  const tasas = DB.obtenerTasas();
  const setTexto = (id, texto) => {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  };
  setTexto("topbar-bcv", `${tasas.bcv.toFixed(2)} Bs`);
  setTexto("topbar-usdt", `${tasas.usdt.toFixed(2)} Bs`);
  setTexto("topbar-bcv-mobile", `${tasas.bcv.toFixed(2)} Bs`);
  setTexto("topbar-usdt-mobile", `${tasas.usdt.toFixed(2)} Bs`);
};

window.actualizarAlertasTopbar = function () {
  const diasLimite = DB.obtenerUsuario().dias_alerta || 15;
  const deudasActivas = DB.obtenerDeudas().filter((d) => d.estado !== "pagada");
  const subsActivas = DB.obtenerSuscripciones().filter(
    (s) => s.estado === "activa"
  );

  const alertasDeudas = deudasActivas.map((d) => ({
    titulo: `${d.acreedor} — ${d.concepto}`,
    monto: DB.aDolares(DB.totalDeuda(d), d.moneda_base),
    dias: DB.diasRestantes(d.proxima_fecha_pago),
  }));

  const alertasSubs = subsActivas.map((s) => ({
    titulo: `${s.nombre} (Gasto Fijo)`,
    monto: DB.aDolares(s.monto, s.moneda),
    dias: DB.diasRestantes(s.proxima_fecha_pago),
  }));

  const alertas = [...alertasDeudas, ...alertasSubs]
    .filter((a) => a.dias <= diasLimite)
    .sort((a, b) => a.dias - b.dias);

  const badgeAlerts = document.getElementById("badge-alerts");
  const alertsList = document.getElementById("alerts-list");

  if (badgeAlerts) {
    if (alertas.length > 0) {
      badgeAlerts.textContent = alertas.length;
      badgeAlerts.classList.remove("hidden");
    } else {
      badgeAlerts.classList.add("hidden");
    }
  }

  if (alertsList) {
    if (alertas.length === 0) {
      alertsList.innerHTML = `
        <p class="text-xs text-slate-400 text-center py-4">
          No tienes vencimientos en los próximos ${diasLimite} días.
        </p>
      `;
    } else {
      alertsList.innerHTML = alertas
        .map((a) => {
          const vencida = a.dias <= 0;
          const estilo = vencida
            ? "bg-rose-50 border-rose-200 text-rose-800"
            : "bg-amber-50 border-amber-200 text-amber-800";
          const etiqueta =
            a.dias < 0
              ? `Vencida hace ${Math.abs(a.dias)} días`
              : a.dias === 0
              ? "Vence hoy"
              : `Faltan ${a.dias} días`;
          return `
            <div class="p-2.5 rounded-xl border ${estilo} text-xs">
              <p class="font-bold truncate">${DB.escaparHTML(a.titulo)}</p>
              <div class="flex justify-between mt-1 opacity-85">
                <span>${etiqueta}</span>
                <strong>$${a.monto.toFixed(2)}</strong>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }
};

window.addEventListener("tasasActualizadas", () => {
  window.actualizarTasasTopbar();
});

window.addEventListener("perfilActualizado", () => {
  window.actualizarSaludoTopbar();
  window.actualizarAlertasTopbar();
});

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const btnOpen = document.getElementById("btn-open-sidebar");
  const btnClose = document.getElementById("btn-close-sidebar");
  const btnLogout = document.getElementById("btn-logout");
  const btnAlerts = document.getElementById("btn-alerts");
  const alertsPopover = document.getElementById("alerts-popover");

  function toggleSidebar(abrir) {
    if (!sidebar || !backdrop) return;
    sidebar.classList.toggle("-translate-x-full", !abrir);
    backdrop.classList.toggle("hidden", !abrir);
  }

  if (btnOpen) btnOpen.addEventListener("click", () => toggleSidebar(true));
  if (btnClose) btnClose.addEventListener("click", () => toggleSidebar(false));
  if (backdrop) backdrop.addEventListener("click", () => toggleSidebar(false));

  // Saludo inicial
  window.actualizarSaludoTopbar();

  // Tasas actuales + sincronización automática cada hora
  window.actualizarTasasTopbar();
  DB.sincronizarTasasEnVivo(false).then(() => {
    window.actualizarTasasTopbar();
  });

  setInterval(() => {
    DB.sincronizarTasasEnVivo(false).then(() => {
      window.actualizarTasasTopbar();
    });
  }, 60 * 60 * 1000);

  // Alertas en barra superior
  window.actualizarAlertasTopbar();

  if (btnAlerts && alertsPopover) {
    btnAlerts.addEventListener("click", (e) => {
      e.stopPropagation();
      alertsPopover.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!alertsPopover.contains(e.target) && !btnAlerts.contains(e.target)) {
        alertsPopover.classList.add("hidden");
      }
    });
  }

  // Cerrar sesión
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      Swal.fire({
        title: "¿Cerrar sesión?",
        text: "Volverás a la pantalla de acceso.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#02425B",
        cancelButtonColor: "#94a3b8",
      }).then((res) => {
        if (res.isConfirmed) {
          localStorage.removeItem("usuario_activo");
          window.location.href = "index.html";
        }
      });
    });
  }
});