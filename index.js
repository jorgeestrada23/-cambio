// ---------- CLASES ----------

// Cada moneda que ofrece la casa de cambio
class Moneda {
    constructor(id, codigo, nombre, cotizacion, stock) {
        this.id = id;
        this.codigo = codigo;
        this.nombre = nombre;
        this.cotizacion = cotizacion; // pesos (ARS) por unidad
        this.stock = stock;           // unidades disponibles para vender
    }

    // convierte un monto en pesos a unidades de esta moneda
    convertir(montoARS) {
        return montoARS / this.cotizacion;
    }

    // informa si hay stock suficiente para vender esa cantidad
    hayStock(cantidad) {
        return this.stock >= cantidad;
    }

    // modifica el estado: descuenta lo vendido del stock
    descontarStock(cantidad) {
        this.stock -= cantidad;
    }
}

// Cada operacion de cambio realizada
class Operacion {
    constructor(id, monto, codigo, cotizacion, dineroRecibido) {
        this.id = id;
        this.monto = monto;
        this.codigo = codigo;
        this.cotizacion = cotizacion;
        this.dineroRecibido = dineroRecibido;
    }

    informar() {
        const { id, monto, codigo, cotizacion, dineroRecibido } = this;

        return (
            `Operacion ${id}: ${formatearARS(monto)} -> ` +
            `${dineroRecibido.toFixed(2)} ${codigo} ` +
            `(cotizacion: ${formatearARS(cotizacion)})`
        );
    }
}

// array (valores iniciales)
const crearMonedasIniciales = () => [
    new Moneda(1, "USD", "Dolar estadounidense", 1500, 5000),
    new Moneda(2, "EUR", "Euro", 1750, 3000),
    new Moneda(3, "BRL", "Real brasileno", 280, 20000),
    new Moneda(4, "CLP", "Peso chileno", 1.6, 500000),
    new Moneda(5, "UYU", "Peso uruguayo", 37, 80000)
];

// ---------- LOCALSTORAGE ----------

// recuperar: lee y convierte el JSON a objeto (null si no hay nada o esta danado)
function leerStorage(clave) {
    try {
        return JSON.parse(localStorage.getItem(clave));
    } catch {
        return null;
    }
}

// recuperar: los objetos guardados vuelven a ser instancias de las clases
// (destructuring en los parametros y ternario si no hay nada guardado)
function cargarMonedas() {
    const guardadas = leerStorage("monedas");

    return Array.isArray(guardadas)
        ? guardadas.map(({ id, codigo, nombre, cotizacion, stock }) => new Moneda(id, codigo, nombre, cotizacion, stock))
        : crearMonedasIniciales();
}

function cargarHistorial() {
    const guardado = leerStorage("historial");

    return Array.isArray(guardado)
        ? guardado.map(({ id, monto, codigo, cotizacion, dineroRecibido }) => new Operacion(id, monto, codigo, cotizacion, dineroRecibido))
        : [];
}

// almacenar / modificar: setItem pisa el valor anterior con el estado actual
function guardarDatos() {
    localStorage.setItem("monedas", JSON.stringify(monedas));
    localStorage.setItem("historial", JSON.stringify(historial));
}

let monedas = cargarMonedas();
let historial = cargarHistorial();

let filtro = localStorage.getItem("filtro") ?? "";

// doom
const formCambio = document.getElementById("form-cambio");
const selectMoneda = document.getElementById("select-moneda");
const inputMonto = document.getElementById("monto");
const resultado = document.getElementById("resultado");
const buscador = document.getElementById("buscador");
const listaMonedas = document.getElementById("lista-monedas");
const listaTop = document.getElementById("lista-top");
const listaOperaciones = document.getElementById("lista-operaciones");
const totalOperaciones = document.getElementById("total-operaciones");
const btnBorrarHistorial = document.getElementById("btn-borrar-historial");
const btnRestablecer = document.getElementById("btn-restablecer");
const btnActualizar = document.getElementById("btn-actualizar");
const estadoCarga = document.getElementById("estado-carga");

// funciones auxiliares

const buscarMoneda = (lista, codigo) => lista.find((moneda) => moneda.codigo === codigo);

const formatearARS = (valor) => `$${valor.toLocaleString("es-AR")} ARS`;

// crea un elemento con texto
function crearElemento(etiqueta, texto) {
    const elemento = document.createElement(etiqueta);
    elemento.textContent = texto;
    return elemento;
}

// Toastify: muestra el mensaje como aviso flotante (rojo si es un error, verde si no)
function mostrarMensaje(texto) {
    const esError = texto.startsWith("Error");

    Toastify({
        text: texto,
        duration: 4000,
        close: true,
        gravity: "top",
        position: "right",
        style: { background: esError ? "#b3261e" : "#137333" }
    }).showToast();
}

// filter
function renderMonedas() {
    const visibles = monedas.filter(
        ({ codigo, nombre }) =>
            codigo.toLowerCase().includes(filtro) ||
            nombre.toLowerCase().includes(filtro)
    );

    listaMonedas.replaceChildren();

    if (visibles.length === 0) {
        const texto = filtro === ""
            ? "No hay monedas cargadas."
            : `No hay monedas que coincidan con "${filtro}".`;
        listaMonedas.appendChild(crearElemento("li", texto));
        return;
    }

    visibles.forEach(({ id, codigo, nombre, cotizacion, stock }) => {
        const item = document.createElement("li");

        item.appendChild(crearElemento("strong", codigo));
        item.appendChild(
            document.createTextNode(
                ` - ${nombre} | Cotizacion: ${formatearARS(cotizacion)} | Stock: ${stock.toFixed(2)} `
            )
        );

        const botonEliminar = crearElemento("button", "Eliminar");
        botonEliminar.type = "button";
        botonEliminar.dataset.id = id;
        item.appendChild(botonEliminar);

        listaMonedas.appendChild(item);
    });
}

// las opciones del select a partir del array
function renderSelect() {
    const seleccionada = selectMoneda.value || localStorage.getItem("monedaSeleccionada");

    const opciones = monedas.map((moneda) => {
        const opcion = crearElemento(
            "option",
            `${moneda.codigo} - ${moneda.nombre} (${formatearARS(moneda.cotizacion)})`
        );
        opcion.value = moneda.codigo;
        return opcion;
    });

    selectMoneda.replaceChildren(...opciones);

    // ternario: si la moneda guardada ya no existe, se elige la primera de la lista
    const existe = buscarMoneda(monedas, seleccionada) !== undefined;
    selectMoneda.value = existe ? seleccionada : monedas[0]?.codigo ?? "";
}

// las 3 monedas de mayor cotizacion (se ordena una copia para no alterar la lista)
function renderTop3() {
    const top = [...monedas].sort((a, b) => b.cotizacion - a.cotizacion).slice(0, 3);

    listaTop.replaceChildren(
        ...top.map(({ codigo, cotizacion }) => crearElemento("li", `${codigo}: ${formatearARS(cotizacion)}`))
    );
}


function renderHistorial() {
    listaOperaciones.replaceChildren(
        ...historial.map((operacion) => crearElemento("li", operacion.informar()))
    );

    const totalARS = historial.reduce((acumulado, operacion) => acumulado + operacion.monto, 0);

    totalOperaciones.textContent = historial.length === 0
        ? "Todavia no realizaste operaciones."
        : `Total cambiado: ${formatearARS(totalARS)} en ${historial.length} operacion(es).`;
}

function renderTodo() {
    renderMonedas();
    renderSelect();
    renderTop3();
    renderHistorial();
}

// ---------- ASINCRONIA ----------

// archivo local con las cotizaciones (se puede cambiar por la URL de una API con el mismo formato)
const URL_COTIZACIONES = "cotizaciones.json";

// fetch: pide el archivo JSON y devuelve los datos ya convertidos a objeto
async function obtenerCotizaciones() {
    const respuesta = await fetch(URL_COTIZACIONES, { cache: "no-store" });

    if (!respuesta.ok) {
        throw new Error(`no se pudo leer ${URL_COTIZACIONES} (codigo ${respuesta.status}).`);
    }

    const datos = await respuesta.json().catch(() => null);

    if (datos === null || !Array.isArray(datos.cotizaciones)) {
        throw new Error("el archivo de cotizaciones no tiene el formato esperado.");
    }

    return datos;
}

// Cambiar dinero 
formCambio.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const moneda = buscarMoneda(monedas, selectMoneda.value);
    const monto = Number(inputMonto.value);

    if (moneda === undefined) {
        mostrarMensaje("Error: no hay monedas disponibles para operar.");
        return;
    }

    if (inputMonto.value.trim() === "" || !Number.isFinite(monto) || monto <= 0) {
        mostrarMensaje("Error: el monto debe ser mayor que cero.");
        return;
    }

    const cantidad = moneda.convertir(monto);

    if (!moneda.hayStock(cantidad)) {
        mostrarMensaje(
            `Error: no hay stock suficiente de ${moneda.codigo}. Disponible: ${moneda.stock.toFixed(2)}`
        );
        return;
    }

    moneda.descontarStock(cantidad);

    const { codigo, cotizacion } = moneda;
    const operacion = new Operacion(historial.length + 1, monto, codigo, cotizacion, cantidad);
    historial.push(operacion);
    guardarDatos();

    resultado.textContent = `Con ${formatearARS(monto)} recibis ${cantidad.toFixed(2)} ${codigo}.`;
    inputMonto.value = "";

    mostrarMensaje("Cambio realizado con exito.");
    renderTodo();
});

// Eliminar una moneda
listaMonedas.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-id]");

    if (boton === null) {
        return;
    }

    const indice = monedas.findIndex((moneda) => moneda.id === Number(boton.dataset.id));

    if (indice === -1) {
        return;
    }

    const [eliminada] = monedas.splice(indice, 1);
    guardarDatos();

    mostrarMensaje(`Se elimino ${eliminada.codigo} de la lista.`);
    renderTodo();
});


buscador.addEventListener("keyup", () => {
    filtro = buscador.value.trim().toLowerCase();
    localStorage.setItem("filtro", filtro);
    renderMonedas();
});

// Recordar la moneda elegida
selectMoneda.addEventListener("change", () => {
    localStorage.setItem("monedaSeleccionada", selectMoneda.value);
});

// Borrar: removeItem elimina solo el historial guardado
btnBorrarHistorial.addEventListener("click", () => {
    localStorage.removeItem("historial");
    historial = [];
    resultado.textContent = "";

    renderHistorial();
    mostrarMensaje("Historial borrado.");
});

// Vaciar: clear elimina todo lo guardado y vuelve a los valores iniciales
btnRestablecer.addEventListener("click", () => {
    localStorage.clear();
    monedas = crearMonedasIniciales();
    historial = [];
    filtro = "";
    buscador.value = "";
    resultado.textContent = "";
    selectMoneda.replaceChildren();

    renderTodo();
    mostrarMensaje("Simulador restablecido a sus valores iniciales.");
    actualizarCotizaciones();
});

// Actualizar cotizaciones: await dentro de try/catch/finally (al cargar la pagina y con el boton)
async function actualizarCotizaciones() {
    btnActualizar.disabled = true;
    estadoCarga.textContent = "Cargando cotizaciones...";

    try {
        const { actualizadoEn, cotizaciones } = await obtenerCotizaciones();

        cotizaciones.forEach(({ codigo, cotizacion }) => {
            const moneda = buscarMoneda(monedas, codigo);

            if (moneda !== undefined && Number.isFinite(cotizacion) && cotizacion > 0) {
                moneda.cotizacion = cotizacion;
            }
        });

        guardarDatos();
        renderTodo();
        estadoCarga.textContent = `Cotizaciones actualizadas el ${actualizadoEn ?? "dia de hoy"}.`;
        mostrarMensaje("Cotizaciones actualizadas.");
    } catch (error) {
        // TypeError = fallo de red (o index.html abierto con doble clic, donde el navegador bloquea fetch)
        const detalle = error instanceof TypeError
            ? "no hay conexion o no se pudo abrir el archivo (si abriste index.html con doble clic, usa Live Server)."
            : error.message;

        estadoCarga.textContent = "No se pudieron cargar las cotizaciones. Se muestran los ultimos valores guardados.";
        mostrarMensaje(`Error: ${detalle}`);
    } finally {
        btnActualizar.disabled = false;
    }
}

btnActualizar.addEventListener("click", actualizarCotizaciones);

buscador.value = filtro;
renderTodo();
actualizarCotizaciones();

// setTimeout: 3 segundos despues de entrar muestra un consejo con datos del simulador
setTimeout(() => {
    const [masAlta] = [...monedas].sort((a, b) => b.cotizacion - a.cotizacion);

    mostrarMensaje(
        masAlta !== undefined
            ? `Consejo: la moneda de mayor valor es ${masAlta.codigo} (${formatearARS(masAlta.cotizacion)}). Podes actualizar las cotizaciones con el boton.`
            : "Consejo: no quedan monedas cargadas. Usa Restablecer simulador para volver a empezar."
    );
}, 3000);