const botonesComprar = document.querySelectorAll(".comprar");
const cartel = document.getElementById("cartel");
const btnAceptar = document.getElementById("aceptar");
const btnCancelar = document.getElementById("cancelar");
let planSeleccionado = {};

botonesComprar.forEach((boton) => {
  boton.addEventListener("click", () => {
    const contenedor = boton.closest(".precio-col");
    const precioTexto = contenedor.querySelector("h3").textContent; // Ej: "$10.000/mes"
    const descripcion = contenedor.querySelector("p").textContent; // Ej: "para principiantes"

    const precioConSimbolo = precioTexto.split("/")[0]; // Ej: "$10.000"

    planSeleccionado = {
      plan: descripcion,
      precio: precioConSimbolo,
    };

    cartel.style.display = "block";
  });
});

btnAceptar.addEventListener("click", () => {
  const planFinal = {
    ...planSeleccionado,
    aceptado: true,
  };

  localStorage.setItem("planSeleccionado", JSON.stringify(planFinal));
  cartel.querySelector("h1").textContent =
    "¡Plan adquirido! Nos vemos en el gym 🏋️";
});

btnCancelar.addEventListener("click", () => {
  const planFinal = {
    ...planSeleccionado,
    aceptado: false,
  };

  localStorage.setItem("planSeleccionado", JSON.stringify(planFinal));
  cartel.querySelector("h1").textContent =
    "Compra cancelada. Podés volver cuando quieras.";
});
