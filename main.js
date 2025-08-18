$(".menu-toggle").on("click", function () {
  $(this).siblings("ul").toggleClass("show");
});

$(document).ready(function () {
  const $formulario = $("#miFormulario");
  const $textoConNombre = $("#texto-a-cambiar");
  const $mensajeError = $("#mensaje-error");
  const $botonesComprar = $(".comprar");
  const $cartelPopup = $("#cartel-popup");
  const $cartel = $("#cartel");
  const $btnAceptar = $("#aceptar");
  const $btnCancelar = $("#cancelar");
  const $formPago = $("#form-pago");
  const $pagoForm = $("#pago-form");
  const $mensajePago = $("#mensaje-pago");
  const $btnCerrarPago = $("#cerrar-pago");
  const $bienvenidaUsuario = $("#bienvenida-usuario");
  const $planSeleccionadoDiv = $("#plan-seleccionado");
  const $nombrePlan = $("#nombre-plan");
  let planSeleccionado = {};

  function cargarDatosCuenta() {
    const datosGuardados = JSON.parse(localStorage.getItem("planSeleccionado"));
    const nombreGuardado = localStorage.getItem("nombreUsuario");
    if (nombreGuardado) {
      $bienvenidaUsuario.text("¡Hola " + nombreGuardado + "!");
    }
    if (datosGuardados && datosGuardados.aceptado) {
      $nombrePlan.text(datosGuardados.plan + " - " + datosGuardados.precio);
      $planSeleccionadoDiv.show();
    }
  }

  cargarDatosCuenta();

  $formulario.on("submit", function (e) {
    e.preventDefault();
    const nombreUsuario = $("#nombre").val().trim();
    const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    $mensajeError.text("");
    if (nombreUsuario === "") {
      $mensajeError.text("Por favor, ingresa tu nombre.");
      return;
    }
    if (!soloLetras.test(nombreUsuario)) {
      $mensajeError.text("El nombre solo puede contener letras.");
      return;
    }
    $textoConNombre.text(nombreUsuario).addClass("texto-modificado");
    localStorage.setItem("nombreUsuario", nombreUsuario);
    $bienvenidaUsuario.text("¡Hola " + nombreUsuario + "!");
  });

  $botonesComprar.on("click", function () {
    const $contenedor = $(this).closest(".precio-col");
    const precioTexto = $contenedor.find("h3").text();
    const descripcion = $contenedor.find("p").first().text();
    const precioConSimbolo = precioTexto.split("/")[0];
    planSeleccionado = { plan: descripcion, precio: precioConSimbolo };
    $cartel.find("h1").text("¿Seguro que desea adquirir este plan?");
    $btnAceptar.show();
    $btnCancelar.show().text("Cancelar");
    $cartelPopup.show();
  });

  $btnAceptar.on("click", function () {
    $cartelPopup.hide();
    $formPago.show();
  });

  $btnCancelar.on("click", function () {
    $btnAceptar.hide();
    $btnCancelar
      .text("Cerrar")
      .off("click")
      .on("click", function () {
        $cartelPopup.hide();
        $btnCancelar.text("Cancelar");
        $btnAceptar.show();
      });
    localStorage.setItem(
      "planSeleccionado",
      JSON.stringify({ ...planSeleccionado, aceptado: false })
    );
    $cartel.find("h1").text("Compra cancelada. Podés volver cuando quieras.");
  });

  $pagoForm.on("submit", function (e) {
    e.preventDefault();
    const tarjeta = $("#tarjeta").val().trim().replace(/\s/g, "");
    const nombreTarjeta = $("#nombre-tarjeta").val().trim();
    const vencimiento = $("#vencimiento").val();
    const cvv = $("#cvv").val().trim();
    if (tarjeta.length !== 16 || isNaN(tarjeta)) {
      $mensajePago.text("Número de tarjeta inválido").css("color", "red");
      return;
    }
    if (nombreTarjeta.length < 5) {
      $mensajePago.text("Nombre inválido").css("color", "red");
      return;
    }
    if (cvv.length !== 3 || isNaN(cvv)) {
      $mensajePago.text("CVV inválido").css("color", "red");
      return;
    }
    localStorage.setItem(
      "planSeleccionado",
      JSON.stringify({
        ...planSeleccionado,
        aceptado: true,
        pagoSimulado: true,
      })
    );
    $mensajePago
      .text("✅ Pago realizado con éxito. ¡Nos vemos en el gym!")
      .css("color", "green");
    $pagoForm.trigger("reset");
    $nombrePlan.text(planSeleccionado.plan + " - " + planSeleccionado.precio);
    $planSeleccionadoDiv.show();
    setTimeout(function () {
      $formPago.hide();
    }, 3000);
  });

  $btnCerrarPago.on("click", function () {
    $formPago.hide();
  });

  const $formContacto = $("#contact");
  const $mensajeExito = $(
    '<div id="mensaje-exito" style="text-align:center;color:green;margin-top:15px;font-weight:600;display:none;"></div>'
  );
  $formContacto.append($mensajeExito);

  $formContacto.on("submit", function (e) {
    e.preventDefault();
    $mensajeExito.text("✅ Datos enviados").fadeIn();
    $formContacto.trigger("reset");
    setTimeout(function () {
      $mensajeExito.fadeOut();
    }, 3000);
  });
});
