document.addEventListener("DOMContentLoaded", async () => {
  // Si ya tiene sesión abierta en Supabase, entra directo al dashboard
  const { data: sesionActual } = await window.sb.auth.getSession();
  if (sesionActual?.session) {
    window.location.href = "dashboard.html";
    return;
  }

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const formLogin = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");

  function cambiarTab(modo) {
    const esLogin = modo === "login";
    formLogin.classList.toggle("hidden", !esLogin);
    formRegister.classList.toggle("hidden", esLogin);

    tabLogin.className = esLogin
      ? "w-1/2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 bg-white text-brand-petrol shadow-sm cursor-pointer"
      : "w-1/2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-slate-500 hover:text-brand-petrol cursor-pointer";

    tabRegister.className = !esLogin
      ? "w-1/2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 bg-white text-brand-petrol shadow-sm cursor-pointer"
      : "w-1/2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-slate-500 hover:text-brand-petrol cursor-pointer";
  }

  tabLogin.addEventListener("click", () => cambiarTab("login"));
  tabRegister.addEventListener("click", () => cambiarTab("register"));

  // Mostrar / ocultar contraseña
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

  // Medidor de fuerza de contraseña
  const regPass = document.getElementById("reg-password");
  const boxFuerza = document.getElementById("pass-strength-box");
  const txtFuerza = document.getElementById("strength-text");
  const barras = [
    document.getElementById("strength-bar-1"),
    document.getElementById("strength-bar-2"),
    document.getElementById("strength-bar-3"),
  ];

  regPass.addEventListener("input", () => {
    const val = regPass.value;
    if (!val) {
      boxFuerza.classList.add("hidden");
      return;
    }
    boxFuerza.classList.remove("hidden");

    let nivel = 1;
    if (val.length >= 6 && /[0-9]/.test(val)) nivel = 2;
    if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val)) nivel = 3;

    const colores = ["bg-rose-500", "bg-amber-400", "bg-emerald-500"];
    const textos = ["Contraseña débil", "Seguridad media", "Contraseña segura"];

    barras.forEach((b, i) => {
      b.className = `h-1.5 rounded-full transition-colors duration-300 ${
        i < nivel ? colores[nivel - 1] : "bg-slate-200"
      }`;
    });
    txtFuerza.textContent = textos[nivel - 1];
  });

  // Efecto de brillo en la tarjeta ADD
  const card = document.getElementById("credit-card");
  const glare = document.getElementById("card-glare");
  if (card && glare) {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glare.style.opacity = "1";
      glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.22), transparent 60%)`;
    });
    card.addEventListener("mouseleave", () => {
      glare.style.opacity = "0";
    });
  }

  // Traducir errores frecuentes de Supabase Auth
  function traducirError(msg = "") {
    const t = msg.toLowerCase();
    if (t.includes("invalid login credentials")) {
      return "Correo o contraseña incorrectos.";
    }
    if (t.includes("user already registered")) {
      return "Este correo ya tiene una cuenta registrada.";
    }
    if (t.includes("email not confirmed")) {
      return "Debes confirmar tu correo electrónico antes de entrar.";
    }
    if (t.includes("password should be at least")) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    return msg || "Ocurrió un error al conectar con el servidor.";
  }

  // 1. INICIAR SESIÓN CON CORREO Y CONTRASEÑA
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Escribe tu correo y contraseña.",
        confirmButtonColor: "#02425B",
      });
      return;
    }

    const btnSubmit = formLogin.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;

    const { error } = await window.sb.auth.signInWithPassword({
      email,
      password,
    });

    btnSubmit.disabled = false;

    if (error) {
      Swal.fire({
        icon: "error",
        title: "No se pudo iniciar sesión",
        text: traducirError(error.message),
        confirmButtonColor: "#02425B",
      });
      return;
    }

    window.location.href = "dashboard.html";
  });

  // 2. CREAR CUENTA NUEVA (dispara automáticamente la fila en tabla 'perfiles')
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirmar = document.getElementById("reg-confirm-password").value;

    if (!nombre || !email || password.length < 6) {
      Swal.fire({
        icon: "warning",
        title: "Revisa tus datos",
        text: "Completa todos los campos y usa una contraseña de mínimo 6 caracteres.",
        confirmButtonColor: "#02425B",
      });
      return;
    }

    if (password !== confirmar) {
      Swal.fire({
        icon: "error",
        title: "Las contraseñas no coinciden",
        confirmButtonColor: "#02425B",
      });
      return;
    }

    const btnSubmit = formRegister.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;

    const { data, error } = await window.sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: nombre,
        },
      },
    });

    btnSubmit.disabled = false;

    if (error) {
      Swal.fire({
        icon: "error",
        title: "Error al crear la cuenta",
        text: traducirError(error.message),
        confirmButtonColor: "#02425B",
      });
      return;
    }

    if (data.session) {
      Swal.fire({
        icon: "success",
        title: "Cuenta creada",
        text: `Bienvenido, ${nombre}`,
        timer: 1200,
        showConfirmButton: false,
      }).then(() => {
        window.location.href = "dashboard.html";
      });
    } else {
      Swal.fire({
        icon: "info",
        title: "Revisa tu correo",
        text: "Te enviamos un enlace para confirmar tu cuenta antes de iniciar sesión.",
        confirmButtonColor: "#02425B",
      });
    }
  });

  // 3. RECUPERAR CONTRASEÑA
  document.getElementById("link-forgot-pass").addEventListener("click", () => {
    Swal.fire({
      title: "Recuperar contraseña",
      text: "Ingresa tu correo registrado:",
      input: "email",
      inputPlaceholder: "tu@correo.com",
      showCancelButton: true,
      confirmButtonText: "Enviar enlace",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#02425B",
    }).then(async (res) => {
      if (!res.isConfirmed || !res.value) return;
      const { error } = await window.sb.auth.resetPasswordForEmail(res.value);
      if (error) {
        Swal.fire({
          icon: "error",
          title: "No se pudo enviar",
          text: traducirError(error.message),
          confirmButtonColor: "#02425B",
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Correo enviado",
          text: "Revisa tu bandeja de entrada para restablecer tu contraseña.",
          confirmButtonColor: "#02425B",
        });
      }
    });
  });

  // 4. CONTINUAR CON GOOGLE (OAuth)
  document.getElementById("btn-google").addEventListener("click", async () => {
    if (window.location.protocol === "file:") {
      Swal.fire({
        icon: "warning",
        title: "Abre el proyecto con servidor local",
        text: "Google no permite iniciar sesión desde file://. Ábrelo con Live Server en VS Code o con el Preview de Prepros.",
        confirmButtonColor: "#02425B",
      });
      return;
    }

    const urlDestino = new URL("dashboard.html", window.location.href).href;
    const { error } = await window.sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: urlDestino,
      },
    });

    if (error) {
      Swal.fire({
        icon: "error",
        title: "Error con Google",
        text: traducirError(error.message),
        confirmButtonColor: "#02425B",
      });
    }
  });
});