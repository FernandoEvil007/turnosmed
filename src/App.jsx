import { useEffect, useMemo, useRef, useState } from "react";

/* ============================================================================
   CONFIG
============================================================================ */
const API_URL = "http://localhost:3001";

const PANTALLAS = {
  SELECTOR: "selector",
  MEDICO: "medico",
  COORD: "coord",
  REGISTRO: "registro",
};

const VIEWS_COORD = {
  HOY: "hoy",
  CALENDARIO: "calendario",
  MEDICOS: "medicos",
  HORARIOS: "horarios",
};

const ESTADOS = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
};

const COLORES = [
  "#4f8ef7",
  "#f7794f",
  "#4fcf8e",
  "#c44ff7",
  "#f7cf4f",
  "#4ff0f7",
  "#f74f9e",
  "#9ef74f",
  "#f7a44f",
  "#7b4ff7",
];

const ESPECIALIDADES = [
  "Medicina Interna",
  "Cirugía General",
  "Pediatría",
  "Urgencias",
  "Ginecología",
  "Ortopedia",
  "Cardiología",
  "Neurología",
  "Anestesiología",
  "Radiología",
];

const TIPOS_TURNO = {
  DIA: { label: "Día", horas: 8, color: "#3b82f6", bg: "#1e3a5f", emoji: "☀️" },
  CENIZO: { label: "Cenizo", horas: 3, color: "#f59e0b", bg: "#3d2c00", emoji: "🌥️" },
  FDS: { label: "Fin Sem.", horas: 6, color: "#8b5cf6", bg: "#2e1b5e", emoji: "📅" },
};

const TODAY = new Date();
const HOY_ISO = isoDate(TODAY);
const IY = TODAY.getFullYear();
const IM = TODAY.getMonth();

const FORM0 = {
  nombre: "",
  apellido: "",
  documento: "",
  tipo_doc: "CC",
  especialidad: "",
  registro_medico: "",
  telefono: "",
  email: "",
  fecha_ingreso: "",
  cargo: "Médico Hospitalario",
};

const CAMBIO_TURNO_FORM0 = {
  medico_destino_id: "",
  fecha_solicitante: "",
  fecha_destino: "",
  turno_solicitante: "",
  turno_destino: "",
  nota: "",
};

const CESION_TURNO_FORM0 = {
  medico_destino_id: "",
  fecha_turno: "",
  turno: "",
  nota: "",
};

const EXTRA_FORM0 = {
  medico_id: "",
  fecha: "",
  horas: "",
  motivo: "",
};

/* ============================================================================
   HELPERS
============================================================================ */
function getDias(y, m) {
  const days = [];
  const d = new Date(y, m, 1);
  while (d.getMonth() === m) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isWE(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

function mesLabel(y, m) {
  return new Date(y, m, 1).toLocaleString("es-CO", {
    month: "long",
    year: "numeric",
  });
}

function diaLabel(d) {
  return d.toLocaleString("es-CO", {
    weekday: "short",
    day: "numeric",
  });
}

function colorIdx(i) {
  return COLORES[i % COLORES.length];
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function inputStyle(hasErr = false) {
  return {
    background: "#1a2744",
    border: `1px solid ${hasErr ? "#ef4444" : "#253350"}`,
    borderRadius: 8,
    color: "#f1f5f9",
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };
}

function safeJsonParse(v, fallback = null) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function capFirst(text = "") {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatCOP(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));
}

function mapearTurnos(data) {
  return (data || []).reduce((acc, t) => {
    const key = `${t.medico_id}_${t.fecha}`;
    if (!acc[key]) acc[key] = [];
    if (!acc[key].includes(t.tipo_turno)) acc[key].push(t.tipo_turno);
    return acc;
  }, {});
}

function mapearHorasAdicionales(data) {
  return (data || []).reduce((acc, item) => {
    const key = `${item.medico_id}_${item.fecha}`;
    acc[key] = {
      horas: Number(item.horas || 0),
      motivo: item.motivo || "",
    };
    return acc;
  }, {});
}

function getEstadoColor(estado) {
  if (estado === ESTADOS.APROBADO) return "#22c55e";
  if (estado === ESTADOS.RECHAZADO) return "#ef4444";
  return "#f59e0b";
}

function getEstadoBg(estado) {
  if (estado === ESTADOS.APROBADO) return "#14532d";
  if (estado === ESTADOS.RECHAZADO) return "#450a0a";
  return "#3d2c00";
}

function horasPorTipo(tipo) {
  return TIPOS_TURNO[tipo]?.horas || 0;
}

function formatTurnosDia(tipos = []) {
  if (!tipos || tipos.length === 0) return "Libre";
  return tipos.map((t) => TIPOS_TURNO[t]?.label || t).join(" + ");
}

function turnosDiaOrdenados(tipos = []) {
  const orden = { DIA: 1, CENIZO: 2, FDS: 3 };
  return [...tipos].sort((a, b) => (orden[a] || 99) - (orden[b] || 99));
}

function puedeAgregarTurno(tiposActuales = [], tipoNuevo) {
  const tipos = turnosDiaOrdenados(tiposActuales);

  if (tipos.includes(tipoNuevo)) {
    return { ok: false, msg: "Ese turno ya está cargado en ese día" };
  }

  if (tipos.length >= 2) {
    return { ok: false, msg: "No se pueden cargar más de 2 turnos por día" };
  }

  if (tipoNuevo === "FDS" && tipos.length > 0) {
    return { ok: false, msg: "FDS no puede combinarse con otros turnos" };
  }

  if (tipos.includes("FDS")) {
    return { ok: false, msg: "Si ya existe FDS, no puedes agregar otro turno" };
  }

  return { ok: true };
}

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || "Ocurrió un error con el servidor");
  }

  return data;
}

/* ============================================================================
   COMPONENTE PRINCIPAL
============================================================================ */
export default function App() {
  const [pantalla, setPantalla] = useState(PANTALLAS.SELECTOR);

  const [medicos, setMedicos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [turnos, setTurnos] = useState({});
  const [horasAdicionales, setHorasAdicionales] = useState({});
  const [solicHorario, setSolicHorario] = useState([]);
  const [solicitudesCambioTurno, setSolicitudesCambioTurno] = useState([]);
  const [solicitudesCesionTurno, setSolicitudesCesionTurno] = useState([]);

  const [tarifaHora, setTarifaHora] = useState(119800);
  const [tarifaHoraInput, setTarifaHoraInput] = useState("119800");

  const [view, setView] = useState(VIEWS_COORD.HOY);
  const [year, setYear] = useState(IY);
  const [month, setMonth] = useState(IM);

  const [form, setForm] = useState(FORM0);
  const [errores, setErrores] = useState({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const [medicoActivo, setMedicoActivo] = useState(null);
  const [usuarioSesion, setUsuarioSesion] = useState(null);

  const [propMes, setPropMes] = useState(IM);
  const [propYear, setPropYear] = useState(IY);
  const [propNota, setPropNota] = useState("");

  const [loginDoc, setLoginDoc] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");

  const [cambioTurnoForm, setCambioTurnoForm] = useState(CAMBIO_TURNO_FORM0);
  const [cesionTurnoForm, setCesionTurnoForm] = useState(CESION_TURNO_FORM0);
  const [extraForm, setExtraForm] = useState(EXTRA_FORM0);

  const [userForm, setUserForm] = useState({
    medico_id: "",
    username: "",
    password: "",
  });

  const [resetPassForm, setResetPassForm] = useState({
    usuario_id: "",
    nuevaPassword: "",
  });

  const [editCell, setEditCell] = useState(null);
  const [showDetalle, setShowDetalle] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const diasCoord = useMemo(() => getDias(year, month), [year, month]);
  const diasProp = useMemo(() => getDias(propYear, propMes), [propYear, propMes]);

  const pendientesHorario = useMemo(
    () => solicHorario.filter((s) => s.estado === ESTADOS.PENDIENTE).length,
    [solicHorario]
  );

  /* ==========================================================================
     TOAST
  ========================================================================== */
  function showToast(msg, tipo = "ok") {
    setToast({ msg, tipo });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  /* ==========================================================================
     CARGAS
  ========================================================================== */
  async function cargarMedicos() {
    const data = await api("/medicos");
    setMedicos(Array.isArray(data) ? data : []);
  }

  async function cargarUsuarios() {
    const data = await api("/usuarios");
    setUsuarios(Array.isArray(data) ? data : []);
  }

  async function cargarTurnos() {
    const data = await api("/turnos");
    setTurnos(mapearTurnos(Array.isArray(data) ? data : []));
  }

  async function cargarHorasAdicionales() {
    const data = await api("/horas-adicionales");
    setHorasAdicionales(mapearHorasAdicionales(Array.isArray(data) ? data : []));
  }

  async function cargarSolicitudesCambio() {
    const data = await api("/solicitudes-cambio-turno");
    setSolicitudesCambioTurno(Array.isArray(data) ? data : []);
  }

  async function cargarSolicitudesCesion() {
    const data = await api("/solicitudes-cesion-turno");
    setSolicitudesCesionTurno(Array.isArray(data) ? data : []);
  }

  async function cargarTarifaHora() {
    const data = await api("/configuracion/tarifa-hora");
    const valor = Number(data?.tarifaHora) || 119800;
    setTarifaHora(valor);
    setTarifaHoraInput(String(valor));
  }

  async function cargarTodoInicial() {
    try {
      await Promise.all([
        cargarMedicos(),
        cargarUsuarios(),
        cargarTurnos(),
        cargarHorasAdicionales(),
        cargarSolicitudesCambio(),
        cargarSolicitudesCesion(),
        cargarTarifaHora(),
      ]);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error cargando datos iniciales", "err");
    }
  }

  useEffect(() => {
    cargarTodoInicial();
  }, []);

  /* ==========================================================================
     RESTAURAR SESIÓN
  ========================================================================== */
  useEffect(() => {
    const usuarioGuardado = safeJsonParse(localStorage.getItem("usuarioSesion"));
    const medicoGuardado = safeJsonParse(localStorage.getItem("medicoActivo"));
    const pantallaGuardada = localStorage.getItem("pantalla");

    if (usuarioGuardado) setUsuarioSesion(usuarioGuardado);
    if (medicoGuardado) setMedicoActivo(medicoGuardado);

    if (pantallaGuardada && Object.values(PANTALLAS).includes(pantallaGuardada)) {
      setPantalla(pantallaGuardada);
    } else {
      setPantalla(PANTALLAS.SELECTOR);
    }
  }, []);

  /* ==========================================================================
     UTILS INTERNOS
  ========================================================================== */
  function navMes(dir, setY, setM, y, m) {
    let nm = m + dir;
    let ny = y;

    if (nm < 0) {
      nm = 11;
      ny--;
    }
    if (nm > 11) {
      nm = 0;
      ny++;
    }

    setM(nm);
    setY(ny);
  }

  function getTurnosDia(id, f) {
    return turnos[`${id}_${f}`] || [];
  }

  function getHorasExtraDia(id, f) {
    return Number(horasAdicionales[`${id}_${f}`]?.horas || 0);
  }

  function getMotivoExtraDia(id, f) {
    return horasAdicionales[`${id}_${f}`]?.motivo || "";
  }

  function horasBaseDia(id, f) {
    return getTurnosDia(id, f).reduce((acc, tipo) => acc + horasPorTipo(tipo), 0);
  }

  function horasDiaTotal(id, f) {
    return horasBaseDia(id, f) + getHorasExtraDia(id, f);
  }

  function horasMes(id, y, m) {
    return getDias(y, m).reduce((acc, d) => acc + horasDiaTotal(id, isoDate(d)), 0);
  }

  function salarioMes(id, y, m) {
    return horasMes(id, y, m) * tarifaHora;
  }

  function getUsuarioMedico(medicoId) {
    return usuarios.find(
      (u) => u.rol === "medico" && Number(u.medico_id) === Number(medicoId)
    );
  }

  async function guardarTarifaHora() {
    const valor = Number(tarifaHoraInput);

    if (!valor || valor <= 0) {
      showToast("Ingresa una tarifa válida por hora", "err");
      return;
    }

    try {
      const data = await api("/configuracion/tarifa-hora", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarifaHora: valor }),
      });

      const nuevaTarifa = Number(data?.tarifaHora) || valor;
      setTarifaHora(nuevaTarifa);
      setTarifaHoraInput(String(nuevaTarifa));
      showToast("Tarifa por hora actualizada para todos los usuarios ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo guardar la tarifa", "err");
    }
  }

  function logout() {
    setMedicoActivo(null);
    setUsuarioSesion(null);
    setLoginDoc("");
    setLoginPass("");
    setLoginErr("");
    localStorage.removeItem("usuarioSesion");
    localStorage.removeItem("medicoActivo");
    localStorage.removeItem("pantalla");
    setPantalla(PANTALLAS.SELECTOR);
  }

  /* ==========================================================================
     USUARIOS / CONTRASEÑAS
  ========================================================================== */
  async function crearUsuarioMedico() {
    const medico_id = Number(userForm.medico_id);
    const username = String(userForm.username || "").trim();
    const password = String(userForm.password || "").trim();

    if (!medico_id || !username || !password) {
      showToast("Completa médico, usuario y contraseña", "err");
      return;
    }

    try {
      await api("/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          rol: "medico",
          medico_id,
        }),
      });

      await cargarUsuarios();
      setUserForm({
        medico_id: "",
        username: "",
        password: "",
      });
      showToast("Usuario médico creado correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo crear el usuario", "err");
    }
  }

  async function resetearPasswordUsuario() {
    const usuario_id = Number(resetPassForm.usuario_id);
    const nuevaPassword = String(resetPassForm.nuevaPassword || "").trim();

    if (!usuario_id || !nuevaPassword) {
      showToast("Selecciona usuario y escribe la nueva contraseña", "err");
      return;
    }

    try {
      await api(`/usuarios/${usuario_id}/reset-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nuevaPassword,
        }),
      });

      setResetPassForm({
        usuario_id: "",
        nuevaPassword: "",
      });
      showToast("Contraseña actualizada correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo cambiar la contraseña", "err");
    }
  }

  /* ==========================================================================
     TURNOS COORDINADORA
  ========================================================================== */
  async function agregarTurnoCoord(medicoId, fecha, tipoTurno) {
    try {
      const actuales = getTurnosDia(medicoId, fecha);
      const validacion = puedeAgregarTurno(actuales, tipoTurno);

      if (!validacion.ok) {
        showToast(validacion.msg, "err");
        return;
      }

      await api("/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_id: medicoId,
          fecha,
          tipo_turno: tipoTurno,
        }),
      });

      setTurnos((prev) => {
        const key = `${medicoId}_${fecha}`;
        const next = { ...prev };
        const lista = next[key] ? [...next[key]] : [];
        if (!lista.includes(tipoTurno)) lista.push(tipoTurno);
        next[key] = turnosDiaOrdenados(lista);
        return next;
      });

      showToast("Turno agregado correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error agregando turno", "err");
    }
  }

  async function eliminarTurnoCoord(medicoId, fecha, tipoTurno) {
    try {
      await api("/turnos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_id: medicoId,
          fecha,
          tipo_turno: tipoTurno,
        }),
      });

      setTurnos((prev) => {
        const key = `${medicoId}_${fecha}`;
        const next = { ...prev };
        const lista = (next[key] || []).filter((t) => t !== tipoTurno);
        if (lista.length === 0) {
          delete next[key];
        } else {
          next[key] = lista;
        }
        return next;
      });

      showToast("Turno eliminado correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error eliminando turno", "err");
    }
  }

  async function guardarHorasAdicionales() {
    const medico_id = Number(extraForm.medico_id);
    const fecha = extraForm.fecha;
    const horas = Number(extraForm.horas || 0);
    const motivo = extraForm.motivo || "";

    if (!medico_id || !fecha) {
      showToast("Selecciona médico y fecha para guardar horas adicionales", "err");
      return;
    }

    if (Number.isNaN(horas) || horas < 0) {
      showToast("Las horas adicionales no son válidas", "err");
      return;
    }

    try {
      await api("/horas-adicionales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_id,
          fecha,
          horas,
          motivo,
        }),
      });

      setHorasAdicionales((prev) => ({
        ...prev,
        [`${medico_id}_${fecha}`]: { horas, motivo },
      }));

      showToast("Horas adicionales guardadas correctamente ✓");
      setExtraForm(EXTRA_FORM0);
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudieron guardar las horas adicionales", "err");
    }
  }

  /* ==========================================================================
     VALIDACIÓN REGISTRO
  ========================================================================== */
  function validar() {
    const e = {};
    const doc = form.documento.trim();
    const email = form.email.trim();
    const tel = form.telefono.trim();

    if (!form.nombre.trim()) e.nombre = "Requerido";
    if (!form.apellido.trim()) e.apellido = "Requerido";

    if (!doc) e.documento = "Requerido";
    else if (medicos.find((m) => String(m.documento) === String(doc) && m.id !== editId)) {
      e.documento = "Documento ya registrado";
    }

    if (!form.especialidad) e.especialidad = "Seleccione especialidad";
    if (!form.registro_medico.trim()) e.registro_medico = "Requerido";
    if (!tel) e.telefono = "Requerido";
    else if (!/^[0-9+\-\s()]{7,20}$/.test(tel)) e.telefono = "Teléfono inválido";

    if (!email) e.email = "Requerido";
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Email inválido";

    if (!form.fecha_ingreso) e.fecha_ingreso = "Requerido";
    if (!form.cargo) e.cargo = "Requerido";

    return e;
  }

  async function guardar() {
    const e = validar();
    if (Object.keys(e).length) {
      setErrores(e);
      return;
    }

    setSaving(true);

    try {
      const medicoPayload = {
        ...form,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        documento: form.documento.trim(),
        registro_medico: form.registro_medico.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        color: editId
          ? medicos.find((m) => m.id === editId)?.color || colorIdx(medicos.length)
          : colorIdx(medicos.length),
      };

      if (editId) {
        await api(`/medicos/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(medicoPayload),
        });
      } else {
        await api("/medicos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(medicoPayload),
        });
      }

      await cargarMedicos();

      setForm(FORM0);
      setErrores({});
      setEditId(null);

      showToast(editId ? "Médico actualizado correctamente ✓" : "Médico registrado en base de datos ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error al guardar", "err");
    } finally {
      setSaving(false);
    }
  }

  function abrirEditar(med) {
    setForm({
      nombre: med.nombre || "",
      apellido: med.apellido || "",
      documento: med.documento || "",
      tipo_doc: med.tipo_doc || "CC",
      especialidad: med.especialidad || "",
      registro_medico: med.registro_medico || "",
      telefono: med.telefono || "",
      email: med.email || "",
      fecha_ingreso: med.fecha_ingreso || "",
      cargo: med.cargo || "Médico Hospitalario",
    });
    setEditId(med.id);
    setErrores({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminar(id) {
    const confirmado = window.confirm("¿Seguro que deseas eliminar este médico?");
    if (!confirmado) return;

    try {
      await api(`/medicos/${id}`, { method: "DELETE" });
      await Promise.all([cargarMedicos(), cargarUsuarios(), cargarTurnos(), cargarHorasAdicionales()]);
      setShowDetalle(null);
      showToast("Médico eliminado correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error eliminando médico", "err");
    }
  }

  /* ==========================================================================
     SOLICITUDES CAMBIO / CESIÓN
  ========================================================================== */
  async function resolverCambioTurno(id, accion) {
    try {
      const endpoint =
        accion === ESTADOS.APROBADO
          ? `/solicitudes-cambio-turno/${id}/aprobar`
          : `/solicitudes-cambio-turno/${id}/rechazar`;

      await api(endpoint, { method: "PUT" });
      await Promise.all([
        cargarSolicitudesCambio(),
        cargarTurnos(),
        cargarHorasAdicionales(),
      ]);

      showToast(
        accion === ESTADOS.APROBADO
          ? "Cambio de turno aprobado y aplicado ✓"
          : "Solicitud rechazada ✓"
      );
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error procesando solicitud", "err");
    }
  }

  async function resolverCesionTurno(id, accion) {
    try {
      const endpoint =
        accion === ESTADOS.APROBADO
          ? `/solicitudes-cesion-turno/${id}/aprobar`
          : `/solicitudes-cesion-turno/${id}/rechazar`;

      await api(endpoint, { method: "PUT" });
      await Promise.all([
        cargarSolicitudesCesion(),
        cargarTurnos(),
        cargarHorasAdicionales(),
      ]);

      showToast(
        accion === ESTADOS.APROBADO
          ? "Cesión de turno aprobada y aplicada ✓"
          : "Cesión rechazada ✓"
      );
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error procesando cesión", "err");
    }
  }

  /* ==========================================================================
     LOGIN
  ========================================================================== */
  async function loginMedico() {
    if (!loginDoc.trim() || !loginPass.trim()) {
      setLoginErr("Debes ingresar usuario y contraseña");
      return;
    }

    try {
      const data = await api("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginDoc.trim(),
          password: loginPass,
        }),
      });

      setUsuarioSesion(data.usuario);
      setLoginErr("");
      localStorage.setItem("usuarioSesion", JSON.stringify(data.usuario));

      if (data.usuario.rol === "coordinador") {
        localStorage.removeItem("medicoActivo");
        localStorage.setItem("pantalla", PANTALLAS.COORD);
        setMedicoActivo(null);
        setPantalla(PANTALLAS.COORD);
        setLoginDoc("");
        setLoginPass("");
        return;
      }

      if (data.usuario.rol === "medico") {
        const med = medicos.find((m) => Number(m.id) === Number(data.usuario.medico_id));

        if (!med) {
          setLoginErr("El usuario médico no está vinculado correctamente");
          return;
        }

        setMedicoActivo(med);
        localStorage.setItem("medicoActivo", JSON.stringify(med));
        localStorage.setItem("pantalla", PANTALLAS.MEDICO);

        setPantalla(PANTALLAS.MEDICO);
        setLoginDoc("");
        setLoginPass("");
        return;
      }

      setLoginErr("Rol de usuario no reconocido");
    } catch (error) {
      console.error(error);
      setLoginErr(error.message || "Error de conexión con el servidor");
    }
  }

  /* ==========================================================================
     PROPUESTA HORARIO MÉDICO
  ========================================================================== */
  function enviarPropuesta() {
    if (!medicoActivo) {
      showToast("No hay médico activo", "err");
      return;
    }

    const dupPend = solicHorario.find(
      (s) =>
        Number(s.medicoId) === Number(medicoActivo.id) &&
        Number(s.mes) === Number(propMes) &&
        Number(s.year) === Number(propYear) &&
        s.estado === ESTADOS.PENDIENTE
    );

    if (dupPend) {
      showToast("Ya tienes una propuesta pendiente para ese mes", "err");
      return;
    }

    const dias = {};
    getDias(propYear, propMes).forEach((d) => {
      const f = isoDate(d);
      dias[f] = {
        turnos: getTurnosDia(medicoActivo.id, f),
        horas_adicionales: getHorasExtraDia(medicoActivo.id, f),
      };
    });

    const nueva = {
      id: Date.now(),
      medicoId: medicoActivo.id,
      mes: propMes,
      year: propYear,
      dias,
      nota: propNota,
      estado: ESTADOS.PENDIENTE,
      fecha_envio: HOY_ISO,
    };

    setSolicHorario((p) => [...p, nueva]);
    setPropNota("");
    showToast("Propuesta enviada al coordinador ✓");
  }

  async function enviarSolicitudCambioTurno() {
    if (!medicoActivo) {
      showToast("No hay médico activo", "err");
      return;
    }

    if (
      !cambioTurnoForm.medico_destino_id ||
      !cambioTurnoForm.fecha_solicitante ||
      !cambioTurnoForm.fecha_destino ||
      !cambioTurnoForm.turno_solicitante ||
      !cambioTurnoForm.turno_destino
    ) {
      showToast("Completa todos los campos del cambio de turno", "err");
      return;
    }

    if (Number(cambioTurnoForm.medico_destino_id) === Number(medicoActivo.id)) {
      showToast("No puedes solicitar cambio contigo mismo", "err");
      return;
    }

    const turnosSolicitante = getTurnosDia(medicoActivo.id, cambioTurnoForm.fecha_solicitante);
    if (!turnosSolicitante.includes(cambioTurnoForm.turno_solicitante)) {
      showToast("No tienes ese turno guardado en la fecha que deseas entregar", "err");
      return;
    }

    const turnosDestino = getTurnosDia(
      Number(cambioTurnoForm.medico_destino_id),
      cambioTurnoForm.fecha_destino
    );
    if (!turnosDestino.includes(cambioTurnoForm.turno_destino)) {
      showToast("El otro médico no tiene ese turno en la fecha que deseas recibir", "err");
      return;
    }

    try {
      await api("/solicitudes-cambio-turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_solicitante_id: medicoActivo.id,
          medico_destino_id: Number(cambioTurnoForm.medico_destino_id),
          fecha_solicitante: cambioTurnoForm.fecha_solicitante,
          fecha_destino: cambioTurnoForm.fecha_destino,
          turno_solicitante: cambioTurnoForm.turno_solicitante,
          turno_destino: cambioTurnoForm.turno_destino,
          nota: cambioTurnoForm.nota,
          fecha_solicitud: HOY_ISO,
        }),
      });

      await cargarSolicitudesCambio();
      setCambioTurnoForm(CAMBIO_TURNO_FORM0);
      showToast("Solicitud de cambio enviada al coordinador ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error enviando solicitud", "err");
    }
  }

  async function enviarSolicitudCesionTurno() {
    if (!medicoActivo) {
      showToast("No hay médico activo", "err");
      return;
    }

    if (!cesionTurnoForm.medico_destino_id || !cesionTurnoForm.fecha_turno || !cesionTurnoForm.turno) {
      showToast("Completa todos los campos de la cesión de turno", "err");
      return;
    }

    if (Number(cesionTurnoForm.medico_destino_id) === Number(medicoActivo.id)) {
      showToast("No puedes cederte un turno a ti mismo", "err");
      return;
    }

    const turnosSolicitante = getTurnosDia(medicoActivo.id, cesionTurnoForm.fecha_turno);
    if (!turnosSolicitante.includes(cesionTurnoForm.turno)) {
      showToast("No tienes ese turno guardado en esa fecha", "err");
      return;
    }

    try {
      await api("/solicitudes-cesion-turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_solicitante_id: medicoActivo.id,
          medico_destino_id: Number(cesionTurnoForm.medico_destino_id),
          fecha_turno: cesionTurnoForm.fecha_turno,
          turno: cesionTurnoForm.turno,
          nota: cesionTurnoForm.nota,
          fecha_solicitud: HOY_ISO,
        }),
      });

      await cargarSolicitudesCesion();
      setCesionTurnoForm(CESION_TURNO_FORM0);
      showToast("Solicitud de cesión enviada al coordinador ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error enviando cesión", "err");
    }
  }

  /* ==========================================================================
     RENDERS
  ========================================================================== */
  if (pantalla === PANTALLAS.SELECTOR) {
    return (
      <div style={S.pageCenter}>
        {toast && (
          <div style={{ ...S.toast, background: toast.tipo === "ok" ? "#22c55e" : "#ef4444" }}>
            {toast.msg}
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏥</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-1px" }}>
            TurnosMed
          </div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
            Sistema de Coordinación Hospitalaria
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => setPantalla(PANTALLAS.MEDICO)}
            style={{ ...S.roleCard, border: "1px solid #14532d" }}
          >
            <span style={{ fontSize: 44 }}>👨‍⚕️</span>
            <div>
              <div style={{ color: "#4ade80", fontWeight: 800, fontSize: 16 }}>Médico</div>
              <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Portal de horarios</div>
            </div>
          </button>

          <button
            onClick={() => setPantalla(PANTALLAS.MEDICO)}
            style={{ ...S.roleCard, border: "1px solid #1e3a5f" }}
          >
            <span style={{ fontSize: 44 }}>👨‍💼</span>
            <div>
              <div style={{ color: "#60a5fa", fontWeight: 800, fontSize: 16 }}>Coordinador</div>
              <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Acceso por login</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (pantalla === PANTALLAS.REGISTRO) {
    if (!usuarioSesion || usuarioSesion.rol !== "coordinador") {
      return (
        <div style={S.pageCenter}>
          <div style={S.cardRestrict}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
              Acceso restringido
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 20 }}>
              El registro de médicos solo puede ser gestionado por la coordinación
              después de iniciar sesión.
            </div>
            <button onClick={() => setPantalla(PANTALLAS.SELECTOR)} style={S.primaryButton}>
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={S.page}>
        {toast && (
          <div style={{ ...S.toast, background: toast.tipo === "ok" ? "#22c55e" : "#ef4444" }}>
            {toast.msg}
          </div>
        )}

        <HeaderSimple
          title="TurnosMed"
          subtitle="Registro de médicos"
          right={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={S.badgeBlue}>
                {medicos.length} médico{medicos.length !== 1 ? "s" : ""}
              </span>
              <button onClick={() => setPantalla(PANTALLAS.COORD)} style={S.primaryButton}>
                Volver al panel
              </button>
            </div>
          }
        />

        <div style={S.mainWrap}>
          <div style={{ flex: "0 0 440px", minWidth: 300 }}>
            <div style={S.card}>
              <div style={S.cardHeaderBetween}>
                <h2 style={S.cardTitle}>{editId ? "✏️ Editar médico" : "➕ Nuevo médico"}</h2>
                {editId && (
                  <button
                    onClick={() => {
                      setForm(FORM0);
                      setEditId(null);
                      setErrores({});
                    }}
                    style={S.smallMutedBtn}
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <SeccionLabel>Datos personales</SeccionLabel>
              <div style={S.fg2}>
                <Campo label="Nombre *" err={errores.nombre}>
                  <input
                    style={inputStyle(!!errores.nombre)}
                    value={form.nombre}
                    placeholder="Ej: Lucía"
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </Campo>
                <Campo label="Apellido *" err={errores.apellido}>
                  <input
                    style={inputStyle(!!errores.apellido)}
                    value={form.apellido}
                    placeholder="Ej: Martínez"
                    onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
                  />
                </Campo>
              </div>

              <div style={S.fg2}>
                <Campo label="Tipo doc *">
                  <select
                    style={inputStyle(false)}
                    value={form.tipo_doc}
                    onChange={(e) => setForm((p) => ({ ...p, tipo_doc: e.target.value }))}
                  >
                    {["CC", "CE", "Pasaporte", "TI"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="N° documento *" err={errores.documento}>
                  <input
                    style={inputStyle(!!errores.documento)}
                    value={form.documento}
                    placeholder="1234567890"
                    onChange={(e) => setForm((p) => ({ ...p, documento: e.target.value }))}
                  />
                </Campo>
              </div>

              <SeccionLabel>Información profesional</SeccionLabel>
              <Campo label="Especialidad *" err={errores.especialidad} full>
                <select
                  style={inputStyle(!!errores.especialidad)}
                  value={form.especialidad}
                  onChange={(e) => setForm((p) => ({ ...p, especialidad: e.target.value }))}
                >
                  <option value="">— Seleccione —</option>
                  {ESPECIALIDADES.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </Campo>

              <div style={{ ...S.fg2, marginTop: 14 }}>
                <Campo label="Registro médico *" err={errores.registro_medico}>
                  <input
                    style={inputStyle(!!errores.registro_medico)}
                    value={form.registro_medico}
                    placeholder="RM-123456"
                    onChange={(e) => setForm((p) => ({ ...p, registro_medico: e.target.value }))}
                  />
                </Campo>
                <Campo label="Cargo">
                  <select
                    style={inputStyle(false)}
                    value={form.cargo}
                    onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))}
                  >
                    {[
                      "Médico Hospitalario",
                      "Médico Residente",
                      "Médico Especialista",
                      "Médico Urgencias",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Campo>
              </div>

              <Campo label="Fecha de ingreso *" err={errores.fecha_ingreso} full>
                <input
                  type="date"
                  style={inputStyle(!!errores.fecha_ingreso)}
                  value={form.fecha_ingreso}
                  onChange={(e) => setForm((p) => ({ ...p, fecha_ingreso: e.target.value }))}
                />
              </Campo>

              <SeccionLabel>Datos de contacto</SeccionLabel>
              <div style={S.fg2}>
                <Campo label="Teléfono *" err={errores.telefono}>
                  <input
                    style={inputStyle(!!errores.telefono)}
                    value={form.telefono}
                    placeholder="3001234567"
                    onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                  />
                </Campo>
                <Campo label="Correo electrónico *" err={errores.email}>
                  <input
                    type="email"
                    style={inputStyle(!!errores.email)}
                    value={form.email}
                    placeholder="medico@clinica.com"
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </Campo>
              </div>

              <button onClick={guardar} disabled={saving} style={S.saveBtn(saving)}>
                {saving ? "Guardando..." : editId ? "💾 Guardar cambios" : "✅ Registrar médico"}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 16, marginBottom: 14 }}>
              Médicos registrados ({medicos.length})
            </div>

            {medicos.length === 0 && (
              <div style={S.emptyCard}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍⚕️</div>
                <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
                  Registre médicos para comenzar.
                  <br />
                  El acceso al sistema se hace con el N° de documento.
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {medicos.map((med) => (
                <div
                  key={med.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    background: "#0b1528",
                    border: "1px solid #1e293b",
                    borderRadius: 12,
                    padding: 14,
                    borderLeft: `3px solid ${med.color}`,
                  }}
                >
                  <Av color={med.color} size={42} fontSize={14}>
                    {med.nombre?.[0]}
                    {med.apellido?.[0]}
                  </Av>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>
                      {med.nombre} {med.apellido}
                    </div>

                    <div style={S.textMetaWrap}>
                      <span>🩺 {med.especialidad}</span>
                      <span>📋 {med.tipo_doc} {med.documento}</span>
                      <span>📝 {med.registro_medico}</span>
                    </div>

                    <div style={S.textMetaWrap}>
                      <span>📧 {med.email}</span>
                      <span>📞 {med.telefono}</span>
                      <span>📅 {med.fecha_ingreso}</span>
                    </div>

                    <div style={{ marginTop: 5 }}>
                      <span style={S.tagBlue}>{med.cargo}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button onClick={() => abrirEditar(med)} style={S.bEdit}>
                      ✏️
                    </button>
                    <button onClick={() => eliminar(med.id)} style={S.bDel}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pantalla === PANTALLAS.MEDICO) {
    if (!medicoActivo && usuarioSesion?.rol !== "coordinador") {
      return (
        <div style={S.pageCenter}>
          {toast && (
            <div style={{ ...S.toast, background: toast.tipo === "ok" ? "#22c55e" : "#ef4444" }}>
              {toast.msg}
            </div>
          )}

          <div style={S.loginCard}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🔐</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>Iniciar sesión</div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
                Ingrese con su usuario y contraseña
              </div>
            </div>

            <label style={S.lbl}>Usuario (cédula)</label>
            <input
              style={{ ...inputStyle(!!loginErr), marginTop: 6, marginBottom: 16 }}
              placeholder="Ingrese su cédula"
              value={loginDoc}
              onChange={(e) => {
                setLoginDoc(e.target.value);
                setLoginErr("");
              }}
              onKeyDown={(e) => e.key === "Enter" && loginMedico()}
            />

            <label style={{ ...S.lbl, marginTop: 10, display: "block" }}>Contraseña</label>
            <input
              type="password"
              style={{ ...inputStyle(!!loginErr), marginTop: 6, marginBottom: loginErr ? 6 : 16 }}
              placeholder="Ingrese su contraseña"
              value={loginPass}
              onChange={(e) => {
                setLoginPass(e.target.value);
                setLoginErr("");
              }}
              onKeyDown={(e) => e.key === "Enter" && loginMedico()}
            />

            {loginErr && (
              <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>
                {loginErr}
              </div>
            )}

            <button onClick={loginMedico} style={S.loginBtn}>
              Ingresar →
            </button>

            <button onClick={() => setPantalla(PANTALLAS.SELECTOR)} style={S.backBtn}>
              ← Volver
            </button>
          </div>
        </div>
      );
    }

    if (usuarioSesion?.rol === "coordinador" && !medicoActivo) {
      setPantalla(PANTALLAS.COORD);
      return null;
    }

    const misProps = solicHorario.filter((s) => s.medicoId === medicoActivo.id);
    const misCambios = solicitudesCambioTurno.filter(
      (s) => Number(s.medico_solicitante_id) === Number(medicoActivo.id)
    );
    const misCesiones = solicitudesCesionTurno.filter(
      (s) => Number(s.medico_solicitante_id) === Number(medicoActivo.id)
    );

    const hMes = horasMes(medicoActivo.id, propYear, propMes);
    const sueldoMes = hMes * tarifaHora;

    return (
      <div style={S.page}>
        {toast && (
          <div style={{ ...S.toast, background: toast.tipo === "ok" ? "#22c55e" : "#ef4444" }}>
            {toast.msg}
          </div>
        )}

        <div style={S.portalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Av color={medicoActivo?.color} size={38} fontSize={14}>
              {medicoActivo?.nombre?.[0]}
              {medicoActivo?.apellido?.[0]}
            </Av>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9" }}>
                {medicoActivo?.nombre} {medicoActivo?.apellido}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {medicoActivo?.especialidad} · {medicoActivo?.cargo}
              </div>
            </div>
          </div>

          <button onClick={logout} style={S.logoutBtn}>
            Cerrar sesión ←
          </button>
        </div>

        <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px" }}>
            📅 Mi horario
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 24px" }}>
            Consulta tus turnos asignados por mes. Esta vista es solo informativa.
          </p>

          <div style={S.monthSelector}>
            <button onClick={() => navMes(-1, setPropYear, setPropMes, propYear, propMes)} style={S.bnav}>
              ‹
            </button>
            <span style={S.monthTitle}>{mesLabel(propYear, propMes)}</span>
            <button onClick={() => navMes(1, setPropYear, setPropMes, propYear, propMes)} style={S.bnav}>
              ›
            </button>
            <span style={S.badgeBlue}>{hMes}h totales</span>
            <span style={{ ...S.badgeBlue, background: "#14532d", color: "#4ade80" }}>
              {formatCOP(sueldoMes)}
            </span>
          </div>

          <div
            style={{
              background: "#0b1528",
              borderRadius: 12,
              border: "1px solid #1e293b",
              padding: "16px 18px",
              marginBottom: 18,
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              alignItems: "center",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: 13 }}>Valor hora actual:</span>
            <span style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 15 }}>
              {formatCOP(tarifaHora)}
            </span>
            <span style={{ color: "#64748b", fontSize: 12 }}>Horas del mes: {hMes}</span>
            <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>
              Sueldo estimado: {formatCOP(sueldoMes)}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {Object.entries(TIPOS_TURNO).map(([k, v]) => (
              <span
                key={k}
                style={{
                  ...S.chip,
                  background: v.bg,
                  color: v.color,
                }}
              >
                {v.emoji} {v.label} {v.horas}h
              </span>
            ))}
            <span style={{ ...S.chip, background: "#1f2937", color: "#f1f5f9" }}>
              ➕ Horas adicionales manuales
            </span>
          </div>

          <div style={S.daysGrid}>
            {diasProp.map((d) => {
              const f = isoDate(d);
              const tipos = turnosDiaOrdenados(getTurnosDia(medicoActivo.id, f));
              const extra = getHorasExtraDia(medicoActivo.id, f);
              const esHoy = f === HOY_ISO;
              const esFin = isWE(d);

              return (
                <div
                  key={f}
                  style={{
                    background: "#0b1528",
                    borderRadius: 10,
                    padding: "10px 8px",
                    border: `1px solid ${esHoy ? "#60a5fa" : esFin ? "#374151" : "#1e293b"}`,
                    opacity: 0.98,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: esHoy ? "#60a5fa" : esFin ? "#9ca3af" : "#6b7280",
                      fontWeight: 600,
                      textTransform: "capitalize",
                      marginBottom: 6,
                    }}
                  >
                    {diaLabel(d)}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {tipos.length === 0 && (
                      <div style={S.turnoReadonlyLibre}>🏖️ Libre</div>
                    )}

                    {tipos.map((tipo) => (
                      <div key={tipo} style={S.turnoReadonly(TIPOS_TURNO[tipo])}>
                        {TIPOS_TURNO[tipo].emoji} {TIPOS_TURNO[tipo].label}
                      </div>
                    ))}

                    {extra > 0 && (
                      <div style={S.extraChip}>
                        ➕ {extra}h extra
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 11 }}>
                    Total día: {horasDiaTotal(medicoActivo.id, f)}h
                  </div>
                </div>
              );
            })}
          </div>

          <div style={S.cardSection}>
            <div style={S.secTitle}>🔄 Solicitar cambio de turno</div>
            <div style={S.grid2}>
              <FieldSelect
                label="Médico con quien desea cambiar"
                value={cambioTurnoForm.medico_destino_id}
                onChange={(e) =>
                  setCambioTurnoForm((p) => ({ ...p, medico_destino_id: e.target.value }))
                }
                options={[
                  { value: "", label: "— Seleccione —" },
                  ...medicos
                    .filter((m) => Number(m.id) !== Number(medicoActivo.id))
                    .map((m) => ({
                      value: m.id,
                      label: `${m.nombre} ${m.apellido} — ${m.especialidad}`,
                    })),
                ]}
              />

              <FieldSelect
                label="Turno que entregas"
                value={cambioTurnoForm.turno_solicitante}
                onChange={(e) =>
                  setCambioTurnoForm((p) => ({ ...p, turno_solicitante: e.target.value }))
                }
                options={[
                  { value: "", label: "— Seleccione —" },
                  ...Object.keys(TIPOS_TURNO).map((k) => ({ value: k, label: TIPOS_TURNO[k].label })),
                ]}
              />

              <FieldDate
                label="Fecha del turno que entregas"
                value={cambioTurnoForm.fecha_solicitante}
                onChange={(e) =>
                  setCambioTurnoForm((p) => ({ ...p, fecha_solicitante: e.target.value }))
                }
              />

              <FieldSelect
                label="Turno que deseas recibir"
                value={cambioTurnoForm.turno_destino}
                onChange={(e) =>
                  setCambioTurnoForm((p) => ({ ...p, turno_destino: e.target.value }))
                }
                options={[
                  { value: "", label: "— Seleccione —" },
                  ...Object.keys(TIPOS_TURNO).map((k) => ({ value: k, label: TIPOS_TURNO[k].label })),
                ]}
              />

              <FieldDate
                label="Fecha del turno que deseas recibir"
                value={cambioTurnoForm.fecha_destino}
                onChange={(e) =>
                  setCambioTurnoForm((p) => ({ ...p, fecha_destino: e.target.value }))
                }
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                <label style={S.lbl}>Nota</label>
                <textarea
                  style={{ ...inputStyle(false), resize: "vertical", minHeight: 70 }}
                  value={cambioTurnoForm.nota}
                  onChange={(e) => setCambioTurnoForm((p) => ({ ...p, nota: e.target.value }))}
                  placeholder="Ej: Solicito el cambio por compromiso académico o personal"
                />
              </div>
            </div>

            <button onClick={enviarSolicitudCambioTurno} style={S.blueBtn}>
              Enviar solicitud de cambio
            </button>
          </div>

          <div style={S.cardSection}>
            <div style={S.secTitle}>📤 Solicitar cesión de turno</div>
            <div style={S.grid2}>
              <FieldSelect
                label="Médico que recibirá el turno"
                value={cesionTurnoForm.medico_destino_id}
                onChange={(e) =>
                  setCesionTurnoForm((p) => ({ ...p, medico_destino_id: e.target.value }))
                }
                options={[
                  { value: "", label: "— Seleccione —" },
                  ...medicos
                    .filter((m) => Number(m.id) !== Number(medicoActivo.id))
                    .map((m) => ({
                      value: m.id,
                      label: `${m.nombre} ${m.apellido} — ${m.especialidad}`,
                    })),
                ]}
              />

              <FieldSelect
                label="Turno que deseas ceder"
                value={cesionTurnoForm.turno}
                onChange={(e) => setCesionTurnoForm((p) => ({ ...p, turno: e.target.value }))}
                options={[
                  { value: "", label: "— Seleccione —" },
                  ...Object.keys(TIPOS_TURNO).map((k) => ({ value: k, label: TIPOS_TURNO[k].label })),
                ]}
              />

              <FieldDate
                label="Fecha del turno"
                value={cesionTurnoForm.fecha_turno}
                onChange={(e) => setCesionTurnoForm((p) => ({ ...p, fecha_turno: e.target.value }))}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                <label style={S.lbl}>Nota</label>
                <textarea
                  style={{ ...inputStyle(false), resize: "vertical", minHeight: 70 }}
                  value={cesionTurnoForm.nota}
                  onChange={(e) => setCesionTurnoForm((p) => ({ ...p, nota: e.target.value }))}
                  placeholder="Ej: Solicito ceder este turno por motivo personal o académico"
                />
              </div>
            </div>

            <button onClick={enviarSolicitudCesionTurno} style={S.skyBtn}>
              Enviar solicitud de cesión
            </button>
          </div>

          <div style={S.cardSection}>
            <label style={{ ...S.lbl, display: "block", marginBottom: 8 }}>
              Nota para el coordinador (opcional)
            </label>
            <textarea
              value={propNota}
              onChange={(e) => setPropNota(e.target.value)}
              placeholder="Ej: Solicito revisar mi distribución de turnos de este mes..."
              style={{ ...inputStyle(false), resize: "vertical", minHeight: 72, lineHeight: 1.5 }}
            />
            <button onClick={enviarPropuesta} style={S.sendGreenBtn}>
              📤 Enviar propuesta al coordinador
            </button>
          </div>

          {misProps.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={S.listTitle}>Mis propuestas enviadas</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {misProps
                  .slice()
                  .reverse()
                  .map((sol) => {
                    const sc = getEstadoColor(sol.estado);
                    const horasTotales = Object.entries(sol.dias || {}).reduce((acc, [, data]) => {
                      const tipos = data?.turnos || [];
                      const extra = Number(data?.horas_adicionales || 0);
                      return acc + tipos.reduce((a, t) => a + horasPorTipo(t), 0) + extra;
                    }, 0);

                    return (
                      <div
                        key={sol.id}
                        style={{
                          background: "#0b1528",
                          borderRadius: 10,
                          border: "1px solid #1e293b",
                          padding: "14px 18px",
                          borderLeft: `3px solid ${sc}`,
                        }}
                      >
                        <div style={S.rowBetween}>
                          <div>
                            <span style={S.strongText}>{capFirst(mesLabel(sol.year, sol.mes))}</span>
                            <span style={{ color: "#64748b", fontSize: 12, marginLeft: 12 }}>
                              {horasTotales}h · enviada {sol.fecha_envio}
                            </span>
                          </div>
                          <span style={{ ...S.chip, background: getEstadoBg(sol.estado), color: sc }}>
                            {sol.estado === ESTADOS.PENDIENTE
                              ? "⏳ pendiente"
                              : sol.estado === ESTADOS.APROBADO
                              ? "✅ aprobado"
                              : "❌ rechazado"}
                          </span>
                        </div>

                        {sol.nota && (
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>💬 {sol.nota}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <div style={S.listTitle}>Mi historial de solicitudes</div>

            {misCambios.length === 0 && misCesiones.length === 0 && (
              <div style={S.emptyCard}>Aún no has enviado solicitudes de cambio o cesión de turno.</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {misCambios.map((sol) => {
                const medicoDestino = medicos.find((m) => Number(m.id) === Number(sol.medico_destino_id));
                const sc = getEstadoColor(sol.estado);

                return (
                  <div key={`cambio-${sol.id}`} style={S.requestCard(sc)}>
                    <div style={{ ...S.rowBetween, marginBottom: 10 }}>
                      <div>
                        <div style={S.reqTitle}>
                          🔄 Cambio con{" "}
                          {medicoDestino
                            ? `${medicoDestino.nombre} ${medicoDestino.apellido}`
                            : `Médico ${sol.medico_destino_id}`}
                        </div>
                        <div style={S.reqSub}>Solicitud #{sol.id} · enviada {sol.fecha_solicitud}</div>
                      </div>

                      <span style={{ ...S.chip, background: getEstadoBg(sol.estado), color: sc }}>
                        {sol.estado === ESTADOS.PENDIENTE
                          ? "⏳ Pendiente"
                          : sol.estado === ESTADOS.APROBADO
                          ? "✅ Aprobado"
                          : "❌ Rechazado"}
                      </span>
                    </div>

                    <div style={S.grid2}>
                      <InfoMini title="Entregaste" value={`${sol.fecha_solicitante} · ${sol.turno_solicitante}`} />
                      <InfoMini title="Recibes" value={`${sol.fecha_destino} · ${sol.turno_destino}`} />
                    </div>

                    {sol.nota && <div style={S.noteBox}>💬 {sol.nota}</div>}
                  </div>
                );
              })}

              {misCesiones.map((sol) => {
                const medicoDestino = medicos.find((m) => Number(m.id) === Number(sol.medico_destino_id));
                const sc = getEstadoColor(sol.estado);

                return (
                  <div key={`cesion-${sol.id}`} style={S.requestCard(sc)}>
                    <div style={{ ...S.rowBetween, marginBottom: 10 }}>
                      <div>
                        <div style={S.reqTitle}>
                          📤 Cesión a{" "}
                          {medicoDestino
                            ? `${medicoDestino.nombre} ${medicoDestino.apellido}`
                            : `Médico ${sol.medico_destino_id}`}
                        </div>
                        <div style={S.reqSub}>Solicitud #{sol.id} · enviada {sol.fecha_solicitud}</div>
                      </div>

                      <span style={{ ...S.chip, background: getEstadoBg(sol.estado), color: sc }}>
                        {sol.estado === ESTADOS.PENDIENTE
                          ? "⏳ Pendiente"
                          : sol.estado === ESTADOS.APROBADO
                          ? "✅ Aprobado"
                          : "❌ Rechazado"}
                      </span>
                    </div>

                    <div style={S.grid2}>
                      <InfoMini title="Turno cedido" value={`${sol.fecha_turno} · ${sol.turno}`} />
                      <InfoMini
                        title="Lo recibe"
                        value={
                          medicoDestino
                            ? `${medicoDestino.nombre} ${medicoDestino.apellido}`
                            : `Médico ${sol.medico_destino_id}`
                        }
                      />
                    </div>

                    {sol.nota && <div style={S.noteBox}>💬 {sol.nota}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.coordLayout}>
      {toast && (
        <div style={{ ...S.toast, background: toast.tipo === "ok" ? "#22c55e" : "#ef4444" }}>
          {toast.msg}
        </div>
      )}

      <aside style={S.sidebar}>
        <div style={S.sidebarTop}>
          <span style={{ fontSize: 24 }}>🏥</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9" }}>TurnosMed</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Panel Coordinador</div>
          </div>
        </div>

        <nav style={S.sideNav}>
          {[
            { key: VIEWS_COORD.HOY, icon: "📋", label: "Hoy" },
            { key: VIEWS_COORD.CALENDARIO, icon: "📅", label: "Calendario" },
            { key: VIEWS_COORD.MEDICOS, icon: "👨‍⚕️", label: "Médicos" },
            { key: VIEWS_COORD.HORARIOS, icon: "📬", label: "Propuestas", badge: pendientesHorario },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              style={S.sideBtn(view === item.key)}
            >
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && <span style={S.sideBadge}>{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div style={S.sidebarBottom}>
          <button onClick={logout} style={S.sideLogout}>
            ← Cerrar sesión
          </button>

          {usuarioSesion?.rol === "coordinador" && (
            <button onClick={() => setPantalla(PANTALLAS.REGISTRO)} style={S.sideSecondary}>
              ⚙️ Gestionar médicos
            </button>
          )}

          <div style={{ fontSize: 11, color: "#475569", marginTop: 6, paddingLeft: 2 }}>
            {medicos.length} médicos activos
          </div>
        </div>
      </aside>

      <main style={S.coordMain}>
        <div
          style={{
            background: "#0b1528",
            border: "1px solid #1e293b",
            borderRadius: 14,
            padding: 18,
            marginBottom: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 15 }}>
              💰 Configuración de tarifa por hora
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              Esta tarifa la verán tanto la coordinadora como los médicos.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="number"
              min="1"
              value={tarifaHoraInput}
              onChange={(e) => setTarifaHoraInput(e.target.value)}
              style={{ ...inputStyle(false), width: 180 }}
              placeholder="Valor hora"
            />
            <button onClick={guardarTarifaHora} style={S.primaryButton}>
              Guardar tarifa
            </button>
            <span style={{ ...S.badgeBlue, background: "#14532d", color: "#4ade80" }}>
              Actual: {formatCOP(tarifaHora)}
            </span>
          </div>
        </div>

        <div
          style={{
            background: "#0b1528",
            border: "1px solid #1e293b",
            borderRadius: 14,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
            ⏱️ Horas adicionales manuales
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr 1.5fr auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <FieldSelect
              label="Médico"
              value={extraForm.medico_id}
              onChange={(e) => setExtraForm((p) => ({ ...p, medico_id: e.target.value }))}
              options={[
                { value: "", label: "— Seleccione —" },
                ...medicos.map((m) => ({
                  value: m.id,
                  label: `${m.nombre} ${m.apellido}`,
                })),
              ]}
            />

            <FieldDate
              label="Fecha"
              value={extraForm.fecha}
              onChange={(e) => setExtraForm((p) => ({ ...p, fecha: e.target.value }))}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={S.lbl}>Horas extra</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={extraForm.horas}
                onChange={(e) => setExtraForm((p) => ({ ...p, horas: e.target.value }))}
                style={inputStyle(false)}
                placeholder="Ej: 2"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={S.lbl}>Motivo</label>
              <input
                value={extraForm.motivo}
                onChange={(e) => setExtraForm((p) => ({ ...p, motivo: e.target.value }))}
                style={inputStyle(false)}
                placeholder="Ej: horas laboradas adicionales"
              />
            </div>

            <button onClick={guardarHorasAdicionales} style={{ ...S.primaryButton, height: 40 }}>
              Guardar
            </button>
          </div>
        </div>

        <div
          style={{
            background: "#0b1528",
            border: "1px solid #1e293b",
            borderRadius: 14,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 15, marginBottom: 14 }}>
            🔐 Accesos de médicos
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.2fr 1fr auto",
              gap: 12,
              alignItems: "end",
              marginBottom: 18,
            }}
          >
            <FieldSelect
              label="Médico"
              value={userForm.medico_id}
              onChange={(e) => {
                const medico_id = e.target.value;
                const medico = medicos.find((m) => Number(m.id) === Number(medico_id));
                setUserForm((p) => ({
                  ...p,
                  medico_id,
                  username: medico ? String(medico.documento || "") : "",
                }));
              }}
              options={[
                { value: "", label: "— Seleccione —" },
                ...medicos
                  .filter((m) => !getUsuarioMedico(m.id))
                  .map((m) => ({
                    value: m.id,
                    label: `${m.nombre} ${m.apellido}`,
                  })),
              ]}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={S.lbl}>Usuario</label>
              <input
                value={userForm.username}
                onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
                style={inputStyle(false)}
                placeholder="Ej: cédula del médico"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={S.lbl}>Contraseña inicial</label>
              <input
                type="text"
                value={userForm.password}
                onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                style={inputStyle(false)}
                placeholder="Asignar contraseña"
              />
            </div>

            <button onClick={crearUsuarioMedico} style={{ ...S.primaryButton, height: 40 }}>
              Crear acceso
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr auto",
              gap: 12,
              alignItems: "end",
              marginBottom: 18,
            }}
          >
            <FieldSelect
              label="Usuario médico"
              value={resetPassForm.usuario_id}
              onChange={(e) => setResetPassForm((p) => ({ ...p, usuario_id: e.target.value }))}
              options={[
                { value: "", label: "— Seleccione —" },
                ...usuarios
                  .filter((u) => u.rol === "medico")
                  .map((u) => {
                    const medico = medicos.find((m) => Number(m.id) === Number(u.medico_id));
                    return {
                      value: u.id,
                      label: medico
                        ? `${medico.nombre} ${medico.apellido} · ${u.username}`
                        : `Usuario ${u.username}`,
                    };
                  }),
              ]}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={S.lbl}>Nueva contraseña</label>
              <input
                type="text"
                value={resetPassForm.nuevaPassword}
                onChange={(e) =>
                  setResetPassForm((p) => ({ ...p, nuevaPassword: e.target.value }))
                }
                style={inputStyle(false)}
                placeholder="Nueva contraseña"
              />
            </div>

            <button onClick={resetearPasswordUsuario} style={{ ...S.primaryButton, height: 40 }}>
              Cambiar contraseña
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {medicos.map((m) => {
              const usuario = getUsuarioMedico(m.id);

              return (
                <div
                  key={m.id}
                  style={{
                    background: "#111827",
                    border: "1px solid #1f2937",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 13 }}>
                      {m.nombre} {m.apellido}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                      {m.especialidad} · documento: {m.documento}
                    </div>
                  </div>

                  {usuario ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: "#14532d",
                          color: "#4ade80",
                          borderRadius: 20,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Usuario creado
                      </span>
                      <span style={{ color: "#cbd5e1", fontSize: 12 }}>
                        {usuario.username}
                      </span>
                      <button
                        onClick={() =>
                          setResetPassForm({
                            usuario_id: String(usuario.id),
                            nuevaPassword: "",
                          })
                        }
                        style={S.smallMutedBtn}
                      >
                        Resetear clave
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          background: "#3d2c00",
                          color: "#f59e0b",
                          borderRadius: 20,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Sin acceso
                      </span>
                      <button
                        onClick={() =>
                          setUserForm({
                            medico_id: String(m.id),
                            username: String(m.documento || ""),
                            password: "",
                          })
                        }
                        style={S.smallMutedBtn}
                      >
                        Crear acceso
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {view === VIEWS_COORD.HOY && (
          <div style={{ maxWidth: 1150 }}>
            <PageHeader
              title="Turnos de hoy"
              sub={TODAY.toLocaleString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
              {medicos.map((m) => {
                const tiposHoy = turnosDiaOrdenados(getTurnosDia(m.id, HOY_ISO));
                const extraHoy = getHorasExtraDia(m.id, HOY_ISO);

                return (
                  <div key={m.id} style={{ ...S.card, borderLeft: `4px solid ${m.color}` }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Av color={m.color} size={40} fontSize={14}>
                        {m.nombre?.[0]}
                        {m.apellido?.[0]}
                      </Av>
                      <div style={{ flex: 1 }}>
                        <div style={S.strongText}>
                          {m.nombre} {m.apellido}
                        </div>
                        <div style={S.reqSub}>{m.especialidad}</div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {tiposHoy.length === 0 && <span style={S.turnoMiniLibre}>🏖️ Libre</span>}
                          {tiposHoy.map((tipo) => (
                            <span key={tipo} style={S.turnoMini(TIPOS_TURNO[tipo])}>
                              {TIPOS_TURNO[tipo].emoji} {TIPOS_TURNO[tipo].label}
                            </span>
                          ))}
                          {extraHoy > 0 && <span style={S.extraMini}>➕ {extraHoy}h extra</span>}
                        </div>

                        <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 700, marginTop: 8 }}>
                          Hoy: {horasDiaTotal(m.id, HOY_ISO)}h
                        </div>

                        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                          Mes: {horasMes(m.id, year, month)}h · {formatCOP(salarioMes(m.id, year, month))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === VIEWS_COORD.CALENDARIO && (
          <div style={{ maxWidth: 1400 }}>
            <PageHeader title="Calendario general" sub="Cargue hasta 2 turnos por día y horas adicionales manuales" />

            <div style={S.monthSelector}>
              <button onClick={() => navMes(-1, setYear, setMonth, year, month)} style={S.bnav}>
                ‹
              </button>
              <span style={S.monthTitle}>{capFirst(mesLabel(year, month))}</span>
              <button onClick={() => navMes(1, setYear, setMonth, year, month)} style={S.bnav}>
                ›
              </button>
            </div>

            <div style={{ overflow: "auto", borderRadius: 14, border: "1px solid #1e293b" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.thLeft}>Médico</th>
                    {diasCoord.map((d) => (
                      <th key={isoDate(d)} style={S.thDay}>
                        <div>{d.getDate()}</div>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>
                          {d.toLocaleString("es-CO", { weekday: "short" })}
                        </div>
                      </th>
                    ))}
                    <th style={S.thRight}>Horas</th>
                    <th style={S.thRight}>Sueldo</th>
                  </tr>
                </thead>
                <tbody>
                  {medicos.map((m) => (
                    <tr key={m.id}>
                      <td style={S.tdMedico}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <Av color={m.color} size={32} fontSize={12}>
                            {m.nombre?.[0]}
                            {m.apellido?.[0]}
                          </Av>
                          <div>
                            <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 12 }}>
                              {m.nombre} {m.apellido}
                            </div>
                            <div style={{ color: "#64748b", fontSize: 11 }}>{m.especialidad}</div>
                          </div>
                        </div>
                      </td>

                      {diasCoord.map((d) => {
                        const f = isoDate(d);
                        const tipos = turnosDiaOrdenados(getTurnosDia(m.id, f));
                        const extra = getHorasExtraDia(m.id, f);
                        const open = editCell?.medicoId === m.id && editCell?.fecha === f;

                        return (
                          <td key={f} style={S.tdDay}>
                            <div style={{ position: "relative" }}>
                              <button
                                onClick={() =>
                                  setEditCell(open ? null : { medicoId: m.id, fecha: f })
                                }
                                style={S.daySummaryBtn(tipos.length, extra)}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700 }}>
                                  {tipos.length === 0 ? "LIBRE" : formatTurnosDia(tipos)}
                                </div>
                                <div style={{ fontSize: 10, opacity: 0.9 }}>
                                  {horasDiaTotal(m.id, f)}h
                                </div>
                              </button>

                              {open && (
                                <div style={S.popTurnos}>
                                  <div style={S.popTitle}>Turnos del día</div>

                                  {Object.entries(TIPOS_TURNO).map(([k, v]) => {
                                    const activo = tipos.includes(k);

                                    return (
                                      <div key={k} style={{ display: "flex", gap: 6 }}>
                                        {activo ? (
                                          <button
                                            onClick={() => eliminarTurnoCoord(m.id, f, k)}
                                            style={S.popTurnoBtnActivo(v)}
                                          >
                                            ✓ {v.emoji} {v.label}
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => agregarTurnoCoord(m.id, f, k)}
                                            style={S.popTurnoBtn(v)}
                                          >
                                            + {v.emoji} {v.label}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {extra > 0 && (
                                    <div style={S.popExtraInfo}>
                                      ➕ Extra: {extra}h
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td style={S.tdHoras}>{horasMes(m.id, year, month)}h</td>
                      <td style={S.tdHoras}>{formatCOP(salarioMes(m.id, year, month))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === VIEWS_COORD.MEDICOS && (
          <div style={{ maxWidth: 1100 }}>
            <PageHeader title="Médicos" sub="Vista rápida del personal registrado" />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
              {medicos.map((m) => {
                const usuario = getUsuarioMedico(m.id);

                return (
                  <div key={m.id} style={{ ...S.card, borderLeft: `4px solid ${m.color}` }}>
                    <div style={S.rowBetween}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <Av color={m.color} size={42} fontSize={14}>
                          {m.nombre?.[0]}
                          {m.apellido?.[0]}
                        </Av>
                        <div>
                          <div style={S.strongText}>
                            {m.nombre} {m.apellido}
                          </div>
                          <div style={S.reqSub}>{m.especialidad}</div>
                          <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 700, marginTop: 6 }}>
                            {horasMes(m.id, year, month)}h · {formatCOP(salarioMes(m.id, year, month))}
                          </div>
                          <div style={{ color: usuario ? "#4ade80" : "#f59e0b", fontSize: 12, marginTop: 6 }}>
                            {usuario ? `Acceso: ${usuario.username}` : "Sin acceso creado"}
                          </div>
                        </div>
                      </div>

                      <button onClick={() => setShowDetalle(showDetalle === m.id ? null : m.id)} style={S.smallMutedBtn}>
                        {showDetalle === m.id ? "Ocultar" : "Detalle"}
                      </button>
                    </div>

                    {showDetalle === m.id && (
                      <div style={{ marginTop: 14, color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                        <div>📋 {m.tipo_doc} {m.documento}</div>
                        <div>📝 {m.registro_medico}</div>
                        <div>📧 {m.email}</div>
                        <div>📞 {m.telefono}</div>
                        <div>📅 {m.fecha_ingreso}</div>
                        <div>💼 {m.cargo}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === VIEWS_COORD.HORARIOS && (
          <div style={{ maxWidth: 1100 }}>
            <PageHeader title="Propuestas y solicitudes" sub="Revise propuestas, cambios y cesiones" />

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={S.card}>
                <div style={S.listTitle}>📬 Propuestas mensuales</div>

                {solicHorario.length === 0 && <div style={S.emptyInline}>No hay propuestas enviadas aún.</div>}

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {solicHorario
                    .slice()
                    .reverse()
                    .map((sol) => {
                      const med = medicos.find((m) => Number(m.id) === Number(sol.medicoId));
                      const sc = getEstadoColor(sol.estado);

                      const horasTotales = Object.entries(sol.dias || {}).reduce((acc, [, data]) => {
                        const tipos = data?.turnos || [];
                        const extra = Number(data?.horas_adicionales || 0);
                        return acc + tipos.reduce((a, t) => a + horasPorTipo(t), 0) + extra;
                      }, 0);

                      return (
                        <div key={sol.id} style={S.requestCard(sc)}>
                          <div style={S.rowBetween}>
                            <div>
                              <div style={S.reqTitle}>
                                {med ? `${med.nombre} ${med.apellido}` : `Médico ${sol.medicoId}`}
                              </div>
                              <div style={S.reqSub}>
                                {capFirst(mesLabel(sol.year, sol.mes))} · {horasTotales}h · enviada {sol.fecha_envio}
                              </div>
                            </div>
                            <span style={{ ...S.chip, background: getEstadoBg(sol.estado), color: sc }}>
                              {sol.estado}
                            </span>
                          </div>

                          {sol.nota && <div style={S.noteBox}>💬 {sol.nota}</div>}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div style={S.card}>
                <div style={S.listTitle}>🔄 Solicitudes de cambio de turno</div>

                {solicitudesCambioTurno.length === 0 && (
                  <div style={S.emptyInline}>No hay solicitudes de cambio.</div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {solicitudesCambioTurno
                    .slice()
                    .reverse()
                    .map((sol) => {
                      const solicitante = medicos.find(
                        (m) => Number(m.id) === Number(sol.medico_solicitante_id)
                      );
                      const destino = medicos.find(
                        (m) => Number(m.id) === Number(sol.medico_destino_id)
                      );
                      const sc = getEstadoColor(sol.estado);

                      return (
                        <div key={sol.id} style={S.requestCard(sc)}>
                          <div style={S.rowBetween}>
                            <div>
                              <div style={S.reqTitle}>
                                {solicitante
                                  ? `${solicitante.nombre} ${solicitante.apellido}`
                                  : `Médico ${sol.medico_solicitante_id}`}{" "}
                                ↔{" "}
                                {destino
                                  ? `${destino.nombre} ${destino.apellido}`
                                  : `Médico ${sol.medico_destino_id}`}
                              </div>
                              <div style={S.reqSub}>Solicitud #{sol.id} · enviada {sol.fecha_solicitud}</div>
                            </div>

                            <span style={{ ...S.chip, background: getEstadoBg(sol.estado), color: sc }}>
                              {sol.estado}
                            </span>
                          </div>

                          <div style={S.grid2}>
                            <InfoMini title="Entrega" value={`${sol.fecha_solicitante} · ${sol.turno_solicitante}`} />
                            <InfoMini title="Recibe" value={`${sol.fecha_destino} · ${sol.turno_destino}`} />
                          </div>

                          {sol.nota && <div style={S.noteBox}>💬 {sol.nota}</div>}

                          {sol.estado === ESTADOS.PENDIENTE && (
                            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                              <button
                                onClick={() => resolverCambioTurno(sol.id, ESTADOS.APROBADO)}
                                style={S.approveBtn}
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => resolverCambioTurno(sol.id, ESTADOS.RECHAZADO)}
                                style={S.rejectBtn}
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div style={S.card}>
                <div style={S.listTitle}>📤 Solicitudes de cesión de turno</div>

                {solicitudesCesionTurno.length === 0 && (
                  <div style={S.emptyInline}>No hay solicitudes de cesión.</div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {solicitudesCesionTurno
                    .slice()
                    .reverse()
                    .map((sol) => {
                      const solicitante = medicos.find(
                        (m) => Number(m.id) === Number(sol.medico_solicitante_id)
                      );
                      const destino = medicos.find(
                        (m) => Number(m.id) === Number(sol.medico_destino_id)
                      );
                      const sc = getEstadoColor(sol.estado);

                      return (
                        <div key={sol.id} style={S.requestCard(sc)}>
                          <div style={S.rowBetween}>
                            <div>
                              <div style={S.reqTitle}>
                                {solicitante
                                  ? `${solicitante.nombre} ${solicitante.apellido}`
                                  : `Médico ${sol.medico_solicitante_id}`}{" "}
                                →{" "}
                                {destino
                                  ? `${destino.nombre} ${destino.apellido}`
                                  : `Médico ${sol.medico_destino_id}`}
                              </div>
                              <div style={S.reqSub}>Solicitud #{sol.id} · enviada {sol.fecha_solicitud}</div>
                            </div>

                            <span style={{ ...S.chip, background: getEstadoBg(sol.estado), color: sc }}>
                              {sol.estado}
                            </span>
                          </div>

                          <div style={S.grid2}>
                            <InfoMini title="Turno" value={`${sol.fecha_turno} · ${sol.turno}`} />
                            <InfoMini
                              title="Recibe"
                              value={
                                destino
                                  ? `${destino.nombre} ${destino.apellido}`
                                  : `Médico ${sol.medico_destino_id}`
                              }
                            />
                          </div>

                          {sol.nota && <div style={S.noteBox}>💬 {sol.nota}</div>}

                          {sol.estado === ESTADOS.PENDIENTE && (
                            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                              <button
                                onClick={() => resolverCesionTurno(sol.id, ESTADOS.APROBADO)}
                                style={S.approveBtn}
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => resolverCesionTurno(sol.id, ESTADOS.RECHAZADO)}
                                style={S.rejectBtn}
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ============================================================================
   SUBCOMPONENTES INLINE
============================================================================ */
function HeaderSimple({ title, subtitle, right }) {
  return (
    <div style={S.headerSticky}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 28 }}>🏥</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{title}</div>
          <div style={{ fontSize: 10, color: "#64748b" }}>{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

function SeccionLabel({ children }) {
  return (
    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, margin: "18px 0 10px" }}>
      {children}
    </div>
  );
}

function Campo({ label, err, children, full }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: full ? "100%" : "auto" }}>
      <label style={S.lbl}>{label}</label>
      {children}
      {err && <span style={{ color: "#f87171", fontSize: 11 }}>{err}</span>}
    </div>
  );
}

function PageHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9" }}>{title}</div>
      <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Av({ children, color = "#3b82f6", size = 40, fontSize = 14 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={S.lbl}>{label}</label>
      <select style={inputStyle(false)} value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={`${o.value}-${o.label}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldDate({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={S.lbl}>{label}</label>
      <input type="date" style={inputStyle(false)} value={value} onChange={onChange} />
    </div>
  );
}

function InfoMini({ title, value }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>{title}</div>
      <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/* ============================================================================
   STYLES
============================================================================ */
const S = {
  page: {
    minHeight: "100vh",
    background: "#060d1a",
    fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif",
    color: "#e2e8f0",
  },

  pageCenter: {
    minHeight: "100vh",
    background: "#060d1a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif",
    padding: 24,
  },

  mainWrap: {
    display: "flex",
    gap: 24,
    padding: "28px 32px",
    maxWidth: 1200,
    margin: "0 auto",
    flexWrap: "wrap",
  },

  headerSticky: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 32px",
    background: "#0b1528",
    borderBottom: "1px solid #1e293b",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },

  portalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 28px",
    background: "#0b1528",
    borderBottom: "1px solid #1e293b",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },

  card: {
    background: "#0b1528",
    borderRadius: 14,
    border: "1px solid #1e293b",
    padding: 26,
  },

  cardRestrict: {
    background: "#0b1528",
    borderRadius: 16,
    border: "1px solid #1e293b",
    padding: 32,
    maxWidth: 420,
    width: "100%",
    textAlign: "center",
    color: "#e2e8f0",
  },

  loginCard: {
    background: "#0b1528",
    borderRadius: 16,
    border: "1px solid #1e293b",
    padding: 36,
    maxWidth: 380,
    width: "100%",
  },

  roleCard: {
    background: "#0b1528",
    borderRadius: 16,
    padding: "32px 40px",
    cursor: "pointer",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    minWidth: 200,
  },

  cardHeaderBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: "#f1f5f9",
  },

  fg2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  lbl: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
  },

  primaryButton: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 22px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  saveBtn: (saving) => ({
    width: "100%",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 16,
    opacity: saving ? 0.7 : 1,
  }),

  loginBtn: {
    width: "100%",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  backBtn: {
    width: "100%",
    background: "transparent",
    color: "#475569",
    border: "none",
    padding: "10px",
    fontSize: 12,
    cursor: "pointer",
    marginTop: 8,
  },

  logoutBtn: {
    background: "#1e293b",
    color: "#94a3b8",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 12,
    cursor: "pointer",
  },

  smallMutedBtn: {
    background: "#1e293b",
    color: "#94a3b8",
    border: "none",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    cursor: "pointer",
  },

  badgeBlue: {
    background: "#1e3a5f",
    color: "#60a5fa",
    borderRadius: 20,
    padding: "5px 14px",
    fontSize: 13,
    fontWeight: 700,
  },

  tagBlue: {
    background: "#1e3a5f",
    color: "#60a5fa",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 600,
  },

  emptyCard: {
    textAlign: "center",
    padding: "48px 20px",
    background: "#0b1528",
    borderRadius: 14,
    border: "1px dashed #1e293b",
    color: "#64748b",
  },

  emptyInline: {
    color: "#64748b",
    fontSize: 13,
    padding: "8px 0",
  },

  textMetaWrap: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 3,
    display: "flex",
    flexWrap: "wrap",
    gap: "3px 12px",
  },

  monthSelector: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
    background: "#0b1528",
    borderRadius: 12,
    border: "1px solid #1e293b",
    padding: "14px 18px",
    width: "fit-content",
    flexWrap: "wrap",
  },

  monthTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#f1f5f9",
    textTransform: "capitalize",
    minWidth: 160,
    textAlign: "center",
  },

  bnav: {
    background: "#1e293b",
    color: "#f1f5f9",
    border: "none",
    borderRadius: 8,
    width: 34,
    height: 34,
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 700,
  },

  chip: {
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 700,
  },

  daysGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
    gap: 8,
    marginBottom: 24,
  },

  cardSection: {
    background: "#0b1528",
    borderRadius: 12,
    border: "1px solid #1e293b",
    padding: 20,
    marginBottom: 24,
  },

  secTitle: {
    fontWeight: 700,
    color: "#f1f5f9",
    fontSize: 15,
    marginBottom: 14,
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  sendGreenBtn: {
    marginTop: 14,
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 28px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  blueBtn: {
    marginTop: 16,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 22px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  skyBtn: {
    marginTop: 16,
    background: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 22px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  listTitle: {
    fontWeight: 700,
    color: "#f1f5f9",
    fontSize: 16,
    marginBottom: 14,
  },

  requestCard: (sc) => ({
    background: "#0b1528",
    borderRadius: 12,
    border: "1px solid #1e293b",
    padding: 20,
    borderLeft: `4px solid ${sc}`,
  }),

  reqTitle: {
    color: "#f1f5f9",
    fontWeight: 700,
    fontSize: 15,
  },

  reqSub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  noteBox: {
    background: "#1e293b",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 12,
  },

  strongText: {
    color: "#f1f5f9",
    fontWeight: 700,
    fontSize: 14,
  },

  approveBtn: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },

  rejectBtn: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },

  coordLayout: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif",
    background: "#060d1a",
    color: "#e2e8f0",
  },

  sidebar: {
    width: 224,
    background: "#0b1528",
    borderRight: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    padding: "20px 0",
    position: "sticky",
    top: 0,
    height: "100vh",
    overflow: "auto",
  },

  sidebarTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 18px 20px",
    borderBottom: "1px solid #1e293b",
  },

  sideNav: {
    flex: 1,
    padding: "16px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  sideBtn: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    border: "none",
    background: active ? "#1e3a5f" : "transparent",
    color: active ? "#60a5fa" : "#94a3b8",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  }),

  sideBadge: {
    background: "#f59e0b",
    color: "#000",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 7px",
  },

  sidebarBottom: {
    padding: "14px 14px 0",
    borderTop: "1px solid #1e293b",
  },

  sideLogout: {
    width: "100%",
    background: "#1e293b",
    color: "#94a3b8",
    border: "none",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  },

  sideSecondary: {
    width: "100%",
    background: "transparent",
    color: "#475569",
    border: "none",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 11,
    cursor: "pointer",
    textAlign: "left",
    marginTop: 4,
  },

  coordMain: {
    flex: 1,
    overflow: "auto",
    padding: "26px 22px",
    position: "relative",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#0b1528",
  },

  thLeft: {
    position: "sticky",
    left: 0,
    background: "#0f172a",
    color: "#f1f5f9",
    padding: 12,
    textAlign: "left",
    fontSize: 12,
    borderBottom: "1px solid #1e293b",
    zIndex: 3,
  },

  thDay: {
    background: "#0f172a",
    color: "#f1f5f9",
    padding: 8,
    textAlign: "center",
    fontSize: 12,
    borderBottom: "1px solid #1e293b",
    minWidth: 96,
  },

  thRight: {
    background: "#0f172a",
    color: "#f1f5f9",
    padding: 12,
    textAlign: "center",
    fontSize: 12,
    borderBottom: "1px solid #1e293b",
  },

  tdMedico: {
    position: "sticky",
    left: 0,
    background: "#0b1528",
    padding: 10,
    borderBottom: "1px solid #1e293b",
    zIndex: 2,
    minWidth: 220,
  },

  tdDay: {
    padding: 8,
    textAlign: "center",
    borderBottom: "1px solid #1e293b",
    verticalAlign: "top",
  },

  tdHoras: {
    padding: 8,
    textAlign: "center",
    borderBottom: "1px solid #1e293b",
    color: "#f1f5f9",
    fontWeight: 700,
    minWidth: 100,
  },

  daySummaryBtn: (turnosCount, extra) => ({
    border: "1px solid #253350",
    background: turnosCount === 0 ? "#111827" : "#1e293b",
    color: "#f1f5f9",
    borderRadius: 8,
    padding: "7px 8px",
    cursor: "pointer",
    minWidth: 78,
    width: "100%",
    boxSizing: "border-box",
    boxShadow: extra > 0 ? "inset 0 0 0 1px #4ade80" : "none",
  }),

  popTurnos: {
    position: "absolute",
    top: "110%",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: 8,
    display: "grid",
    gap: 6,
    zIndex: 20,
    minWidth: 170,
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },

  popTitle: {
    color: "#f1f5f9",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 2,
  },

  popTurnoBtn: (v) => ({
    background: v.bg,
    color: v.color,
    border: `1px solid ${v.color}`,
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
    width: "100%",
  }),

  popTurnoBtnActivo: (v) => ({
    background: "#14532d",
    color: "#4ade80",
    border: "1px solid #4ade80",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
    width: "100%",
  }),

  popExtraInfo: {
    marginTop: 4,
    background: "#052e16",
    color: "#4ade80",
    border: "1px solid #166534",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 700,
  },

  turnoReadonly: (info) => ({
    borderRadius: 6,
    padding: "6px 8px",
    background: info.bg,
    color: info.color,
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    border: `1px solid ${info.color}`,
  }),

  turnoReadonlyLibre: {
    borderRadius: 6,
    padding: "6px 8px",
    background: "#1f2937",
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #374151",
  },

  extraChip: {
    borderRadius: 6,
    padding: "6px 8px",
    background: "#052e16",
    color: "#4ade80",
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #166534",
  },

  turnoMini: (info) => ({
    borderRadius: 20,
    padding: "4px 8px",
    background: info.bg,
    color: info.color,
    fontSize: 11,
    fontWeight: 700,
    border: `1px solid ${info.color}`,
  }),

  turnoMiniLibre: {
    borderRadius: 20,
    padding: "4px 8px",
    background: "#1f2937",
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid #374151",
  },

  extraMini: {
    borderRadius: 20,
    padding: "4px 8px",
    background: "#052e16",
    color: "#4ade80",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid #166534",
  },

  toast: {
    position: "fixed",
    top: 18,
    right: 18,
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    zIndex: 9999,
    boxShadow: "0 8px 24px rgba(0,0,0,.25)",
  },

  bEdit: {
    background: "#1e3a5f",
    color: "#60a5fa",
    border: "none",
    borderRadius: 8,
    width: 34,
    height: 34,
    cursor: "pointer",
  },

  bDel: {
    background: "#450a0a",
    color: "#f87171",
    border: "none",
    borderRadius: 8,
    width: 34,
    height: 34,
    cursor: "pointer",
  },
};