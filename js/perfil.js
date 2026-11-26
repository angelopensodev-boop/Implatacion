document.addEventListener("DOMContentLoaded", () => {
  const inputNombre = document.getElementById("perfil-nombre");
  const inputCorreo = document.getElementById("perfil-correo");
  const inputIngreso = document.getElementById("perfil-ingreso");
  const selectMoneda = document.getElementById("perfil-moneda");
  const inputDias = document.getElementById("perfil-dias-alerta");
  const ingresoBsEl = document.getElementById("perfil-ingreso-bs");

  function obtenerIniciales(nombre) {
    const partes = (nombre || "US").trim().split(/\s+/);
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  function actualizarEquivalenteBs() {
    const tasas = DB.obtenerTasas();
    const monto = Number(inputIngreso.value) || 0;
    const bs = monto * tasas.bcv;
    ingresoBsEl.textContent = `${bs.toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Bs`;
  }

  function cargarPerfil() {
    const usuario = DB.obtenerUsuario();
    const deudasActivas = DB.obtenerDeudas().filter(
      (d) => d.estado !== "pagada"
    ).length;
    const fijosActivos = DB.obtenerSuscripciones().filter(
      (s) => s.estado === "activa"
    ).length;
    const totalAbonos = DB.obtenerAbonos().length;

    document.getElementById("perfil-avatar").textContent = obtenerIniciales(
      usuario.nombre
    );
    document.getElementById("perfil-header-nombre").textContent =
      usuario.nombre;
    document.getElementById("perfil-header-correo").textContent =
      usuario.correo;

    document.getElementById("stat-deudas").textContent = deudasActivas;
    document.getElementById("stat-fijos").textContent = fijosActivos;
    document.getElementById("stat-abonos").textContent = totalAbonos;

    inputNombre.value = usuario.nombre;
    inputCorreo.value = usuario.correo;
    inputIngreso.value =
      usuario.ingreso_mensual > 0 ? usuario.ingreso_mensual : "";
    selectMoneda.value = usuario.moneda_preferida || "USD";
    inputDias.value = usuario.dias_alerta || 15;

    actualizarEquivalenteBs();
  }

  inputIngreso.addEventListener("input", actualizarEquivalenteBs);
  window.addEventListener("tasasActualizadas", actualizarEquivalenteBs);

  // Guardar datos del perfil
  document.getElementById("form-perfil").addEventListener("submit", (e) => {
    e.preventDefault();

    DB.guardarPerfil({
      nombre: inputNombre.value,
      correo: inputCorreo.value,
      ingreso_mensual: inputIngreso.value,
      moneda_preferida: selectMoneda.value,
      dias_alerta: inputDias.value,
    });

    cargarPerfil();
    Swal.fire({
      icon: "success",
      title: "Perfil actualizado",
      text: "Tus datos e ingreso mensual se guardaron correctamente.",
      confirmButtonColor: "#02425B",
    });
  });

  // Mostrar / ocultar contraseñas
  document.querySelectorAll(".btn-toggle-pass").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      const icon = btn.querySelector("i");
      if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  });

  // Cambio de contraseña (simulado mientras conectamos Supabase Auth)
  document.getElementById("form-password").addEventListener("submit", (e) => {
    e.preventDefault();
    const nueva = document.getElementById("pass-nueva").value;
    const confirmar = document.getElementById("pass-confirmar").value;

    if (nueva.length < 6) {
      Swal.fire({
        icon: "warning",
        title: "Contraseña muy corta",
        text: "Debe tener al menos 6 caracteres.",
        confirmButtonColor: "#02425B",
      });
      return;
    }

    if (nueva !== confirmar) {
      Swal.fire({
        icon: "error",
        title: "Las contraseñas no coinciden",
        text: "Verifica ambos campos antes de guardar.",
        confirmButtonColor: "#02425B",
      });
      return;
    }

    e.target.reset();
    Swal.fire({
      icon: "success",
      title: "Contraseña actualizada",
      text: "Tu clave de acceso fue actualizada.",
      confirmButtonColor: "#02425B",
    });
  });

  // Descargar respaldo JSON
  document.getElementById("btn-exportar-json").addEventListener("click", () => {
    const respaldo = DB.exportarRespaldoJSON();
    const blob = new Blob([JSON.stringify(respaldo, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `respaldo-ADD-${DB.fechaHoyISO()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // Limpiar registros financieros
  document.getElementById("btn-limpiar-datos").addEventListener("click", () => {
    Swal.fire({
      title: "¿Reiniciar todos los registros?",
      text: "Se borrarán tus deudas, gastos fijos e historial de pagos. Tu usuario seguirá activo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, reiniciar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#EB2227",
      cancelButtonColor: "#94a3b8",
    }).then((res) => {
      if (res.isConfirmed) {
        DB.limpiarDatosFinancieros();
        cargarPerfil();
        Swal.fire({
          icon: "success",
          title: "Datos reiniciados",
          timer: 1300,
          showConfirmButton: false,
        });
      }
    });
  });

  cargarPerfil();
});