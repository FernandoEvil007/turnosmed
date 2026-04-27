import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/* ============================================================================
   CONFIG
============================================================================ */
const API_URL =
  import.meta.env.VITE_API_URL || "https://turnosmed-backend.onrender.com";

const PANTALLAS = {
  SELECTOR: "selector",
  MEDICO: "medico",
  COORD: "coord",
  REGISTRO: "registro",
};

const VIEWS_COORD = {
  DASHBOARD: "dashboard",
  HOY: "hoy",
  CALENDARIO: "calendario",
  MEDICOS: "medicos",
  HORARIOS: "horarios",
  BACKUP: "backup",
};

const VIEWS_MEDICO = {
  HORARIO: "horario",
  SOLICITUDES: "solicitudes",
  PACIENTES: "pacientes",
  NOTIFICACIONES: "notificaciones",
  GLOBAL: "global",
  PERFIL: "perfil",
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

const TORRES_PISOS = {
  "Torre 2": ["t2p6", "t2p8", "t2p9", "t2p10", "t2p11"],
  "Torre 3": ["t3p4", "t3p5", "t3p6", "t3p7", "t3p8", "t3p9"],
  "Torre 4": ["t4p7"],
};

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
  DIA: {
    label: "Día",
    horas: 8,
    color: "#60a5fa",
    bg: "#1e3a5f",
    emoji: "☀️",
  },
  CENIZO: {
    label: "Cenizo",
    horas: 3,
    color: "#fbbf24",
    bg: "#3d2c00",
    emoji: "🌥️",
  },
  FDS: {
    label: "Fin Sem.",
    horas: 6,
    color: "#c4b5fd",
    bg: "#2e1b5e",
    emoji: "📅",
  },
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
  torre_asignada: "",
  piso_asignado: "",
  pisos_asignados: [],
};

const EXTRA_FORM0 = {
  medico_id: "",
  fecha: "",
  horas: "",
  motivo: "",
};

const MEDICO_EXTRA_FORM0 = {
  fecha: "",
  horas: "",
  motivo: "",
};

const PACIENTE_FORM0 = {
  piso_key: "",
  cama: "",
  nombre_paciente: "",
  diagnostico: "",
  pendientes: "",
  estado_paciente: "activo",
};

const ESTADOS_PACIENTE = {
  activo: { label: "Activo", color: "#86efac", bg: "#14532d" },
  egresado: { label: "Egresado", color: "#bfdbfe", bg: "#1e3a5f" },
  critico: { label: "Paciente crítico", color: "#fecaca", bg: "#450a0a" },
  respuesta_rapida: { label: "Respuesta rápida", color: "#fde68a", bg: "#3d2c00" },
  esperando_uci: { label: "Esperando UCI", color: "#ddd6fe", bg: "#2e1b5e" },
};

const USER_FORM0 = {
  medico_id: "",
  username: "",
  password: "",
};

const ADMIN_FORM0 = {
  medico_id: "",
  nombre: "",
  cedula: "",
  username: "",
  password: "",
};

const RESET_PASS_FORM0 = {
  usuario_id: "",
  nuevaPassword: "",
};

const CAMBIO_PASS_FORM0 = {
  actualPassword: "",
  nuevaPassword: "",
  confirmarPassword: "",
};

const DATOS_REGISTRO_FORM0 = {
  registro_medico: "",
  telefono: "",
  email: "",
  especialidad: "",
  fecha_ingreso: "",
  cargo: "",
};

const SOL_CAMBIO0 = {
  turno_origen: "",
  medico_destino_id: "",
  turno_destino: "",
  mensaje: "",
};

const SOL_CESION0 = {
  turno_origen: "",
  medico_receptor_id: "",
  mensaje: "",
};

const SOL_HORARIO0 = {
  mensaje: "",
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

function lunesPrimeroOffset(d) {
  return d ? (d.getDay() + 6) % 7 : 0;
}

function esFechaFinSemana(fecha) {
  if (!fecha) return false;

  const d = fecha instanceof Date ? fecha : new Date(`${fecha}T12:00:00`);

  if (Number.isNaN(d.getTime())) return false;

  return isWE(d);
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

function diaNumero(d) {
  return d.getDate();
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function colorIdx(i) {
  return COLORES[i % COLORES.length];
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
  const n = Number(valor);

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function mapearTurnos(data) {
  return (data || []).reduce((acc, t) => {
    if (!TIPOS_TURNO[t?.tipo_turno]) return acc;

    const key = `${t.medico_id}_${t.fecha}`;

    if (!acc[key]) acc[key] = [];
    if (!acc[key].includes(t.tipo_turno)) acc[key].push(t.tipo_turno);

    return acc;
  }, {});
}

function mapearHorasAdicionales(data) {
  return (data || []).reduce((acc, item) => {
    const key = `${item.medico_id}_${item.fecha}`;
    const horas = Number(item?.horas || 0);

    acc[key] = {
      horas: Number.isFinite(horas) ? horas : 0,
      motivo: item?.motivo || "",
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

function turnosDiaOrdenados(tipos = []) {
  const orden = { DIA: 1, CENIZO: 2, FDS: 3 };

  return [...tipos]
    .filter((t) => TIPOS_TURNO[t])
    .sort((a, b) => (orden[a] || 99) - (orden[b] || 99));
}

function horaSalidaTurnos(tipos = []) {
  const salidaPorTurno = {
    DIA: "17:00",
    CENIZO: "21:00",
    FDS: "14:00",
  };
  const ordenados = turnosDiaOrdenados(tipos);
  const ultimoTurno = ordenados[ordenados.length - 1];

  return salidaPorTurno[ultimoTurno] || "Sin turno";
}

function pisoMedicoLabel(medico) {
  const pisos = pisosAsignadosMedico(medico);

  if (pisos.length > 1) {
    return pisos
      .map((item) => `${item.torre} / ${String(item.piso).toUpperCase()}`)
      .join(", ");
  }

  const torre = pisos[0]?.torre || medico?.torre_asignada || "Sin torre";
  const piso = pisos[0]?.piso || medico?.piso_asignado;

  return `${torre} / ${piso ? String(piso).toUpperCase() : "Sin piso"}`;
}

function pisoKey(torre, piso) {
  return `${torre}|${piso}`;
}

function parsePisoKey(value) {
  const [torre, piso] = String(value || "").split("|");
  return { torre, piso };
}

function pisosAsignadosMedico(medico) {
  if (Array.isArray(medico?.pisos_asignados) && medico.pisos_asignados.length) {
    return medico.pisos_asignados
      .map((item) => ({
        torre: item?.torre || item?.torre_asignada,
        piso: item?.piso || item?.piso_asignado,
      }))
      .filter((item) => item.torre && item.piso);
  }

  if (medico?.torre_asignada && medico?.piso_asignado) {
    return [{ torre: medico.torre_asignada, piso: medico.piso_asignado }];
  }

  return [];
}

function pisoAsignadoExiste(pisos, torre, piso) {
  return (pisos || []).some((item) => item.torre === torre && item.piso === piso);
}

function togglePisoAsignado(pisos, torre, piso) {
  if (pisoAsignadoExiste(pisos, torre, piso)) {
    return (pisos || []).filter((item) => !(item.torre === torre && item.piso === piso));
  }

  return [...(pisos || []), { torre, piso }];
}

function puedeAgregarTurno(tiposActuales = [], tipoNuevo, fecha = "") {
  const tipos = turnosDiaOrdenados(tiposActuales);

  if (fecha && esFechaFinSemana(fecha) && tipoNuevo !== "FDS") {
    return {
      ok: false,
      msg: "Los sábados y domingos solo se programan como fin de semana",
    };
  }

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

function tiposTurnoPermitidosFecha(fecha) {
  return esFechaFinSemana(fecha) ? ["FDS"] : Object.keys(TIPOS_TURNO);
}

function estadoPacienteInfo(estado) {
  return ESTADOS_PACIENTE[estado] || ESTADOS_PACIENTE.activo;
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

function textareaStyle() {
  return {
    ...inputStyle(false),
    minHeight: 92,
    resize: "vertical",
    lineHeight: 1.5,
  };
}

function parseTurnoValue(value) {
  const [fecha, tipo] = String(value || "").split("|");
  return { fecha, tipo };
}

function buildTurnoValue(fecha, tipo) {
  return `${fecha}|${tipo}`;
}

function getNextMonthInfo() {
  const y = TODAY.getFullYear();
  const m = TODAY.getMonth();
  const next = new Date(y, m + 1, 1);

  return {
    year: next.getFullYear(),
    month: next.getMonth(),
    monthNumber: next.getMonth() + 1,
    label: capFirst(mesLabel(next.getFullYear(), next.getMonth())),
  };
}

function estaEnUltimos7DiasDelMes(date = TODAY) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const ultimoDia = new Date(y, m + 1, 0).getDate();
  const diaActual = date.getDate();

  return diaActual >= ultimoDia - 6;
}

function fechaBonita(fecha) {
  if (!fecha) return "Sin fecha";
  try {
    const d = new Date(`${fecha}T12:00:00`);
    return d.toLocaleDateString("es-CO", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return fecha;
  }
}

async function api(path, options = {}) {
  if (!API_URL) {
    throw new Error("Falta configurar VITE_API_URL en el frontend");
  }

  const token = localStorage.getItem("authToken");
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res = null;

  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    try {
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error(
        "No se pudo conectar con el servidor. Actualiza la pagina e intenta nuevamente."
      );
    }
  }

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
   APP
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
  const [solicitudesHorasExtra, setSolicitudesHorasExtra] = useState([]);
  const [solicitudesCuentaCobro, setSolicitudesCuentaCobro] = useState([]);

  const [tarifaHora, setTarifaHora] = useState(119800);
  const [tarifaHoraInput, setTarifaHoraInput] = useState("119800");

  const [view, setView] = useState(VIEWS_COORD.DASHBOARD);
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
  const [medicoView, setMedicoView] = useState(VIEWS_MEDICO.HORARIO);

  const [adminCedula, setAdminCedula] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginMode, setLoginMode] = useState("admin");

  const [extraForm, setExtraForm] = useState(EXTRA_FORM0);
  const [medicoExtraForm, setMedicoExtraForm] = useState(MEDICO_EXTRA_FORM0);
  const [pacienteForm, setPacienteForm] = useState(PACIENTE_FORM0);
  const [pacientesCargo, setPacientesCargo] = useState([]);
  const [pacientesTodos, setPacientesTodos] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [userForm, setUserForm] = useState(USER_FORM0);
  const [adminForm, setAdminForm] = useState(ADMIN_FORM0);
  const [resetPassForm, setResetPassForm] = useState(RESET_PASS_FORM0);
  const [cambioPassForm, setCambioPassForm] = useState(CAMBIO_PASS_FORM0);
  const [datosRegistroForm, setDatosRegistroForm] = useState(DATOS_REGISTRO_FORM0);
  const [guardandoDatosRegistro, setGuardandoDatosRegistro] = useState(false);

  const [solCambioForm, setSolCambioForm] = useState(SOL_CAMBIO0);
  const [solCesionForm, setSolCesionForm] = useState(SOL_CESION0);
  const [solHorarioForm, setSolHorarioForm] = useState(SOL_HORARIO0);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const backupInputRef = useRef(null);

  const diasCoord = useMemo(() => getDias(year, month), [year, month]);
  const diasProp = useMemo(() => getDias(propYear, propMes), [propYear, propMes]);

  const pendientesHorario = useMemo(() => {
    const h = solicHorario.filter((s) => s.estado === ESTADOS.PENDIENTE).length;
    const c = solicitudesCambioTurno.filter((s) => s.estado === ESTADOS.PENDIENTE).length;
    const ce = solicitudesCesionTurno.filter((s) => s.estado === ESTADOS.PENDIENTE).length;
    const he = solicitudesHorasExtra.filter((s) => s.estado === ESTADOS.PENDIENTE).length;
    const cc = solicitudesCuentaCobro.filter((s) => s.estado === ESTADOS.PENDIENTE).length;

    return h + c + ce + he + cc;
  }, [
    solicHorario,
    solicitudesCambioTurno,
    solicitudesCesionTurno,
    solicitudesHorasExtra,
    solicitudesCuentaCobro,
  ]);

  function showToast(msg, tipo = "ok") {
    setToast({ msg, tipo });

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    toastTimerRef.current = setTimeout(() => setToast(null), 3400);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  async function cargarMedicos() {
    const data = await api("/medicos");
    setMedicos(Array.isArray(data) ? data : []);
  }

  async function cargarUsuarios() {
    if (!localStorage.getItem("authToken")) {
      setUsuarios([]);
      return;
    }

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

  async function cargarPacientesCargo(medicoId = medicoActivo?.id) {
    if (!medicoId || !localStorage.getItem("authToken")) {
      setPacientesCargo([]);
      return;
    }

    try {
      const [propios, todos] = await Promise.all([
        api(`/pacientes-cargo?medico_id=${medicoId}`),
        api("/pacientes-cargo?todos=1"),
      ]);
      setPacientesCargo(Array.isArray(propios) ? propios : []);
      setPacientesTodos(Array.isArray(todos) ? todos : []);
    } catch {
      setPacientesCargo([]);
      setPacientesTodos([]);
    }
  }

  async function cargarNotificaciones(medicoId = medicoActivo?.id) {
    if (!medicoId || !localStorage.getItem("authToken")) {
      setNotificaciones([]);
      return;
    }

    try {
      const data = await api(`/notificaciones?medico_id=${medicoId}`);
      setNotificaciones(Array.isArray(data) ? data : []);
    } catch {
      setNotificaciones([]);
    }
  }

  async function cargarSolicitudesCambio() {
    try {
      const data = await api("/solicitudes-cambio-turno");
      setSolicitudesCambioTurno(Array.isArray(data) ? data : []);
    } catch {
      setSolicitudesCambioTurno([]);
    }
  }

  async function cargarSolicitudesCesion() {
    try {
      const data = await api("/solicitudes-cesion-turno");
      setSolicitudesCesionTurno(Array.isArray(data) ? data : []);
    } catch {
      setSolicitudesCesionTurno([]);
    }
  }

  async function cargarSolicitudesHorario() {
    try {
      const data = await api("/solicitudes-horario");
      setSolicHorario(Array.isArray(data) ? data : []);
    } catch {
      setSolicHorario([]);
    }
  }

  async function cargarSolicitudesHorasExtra() {
    try {
      const data = await api("/solicitudes-horas-extra");
      setSolicitudesHorasExtra(Array.isArray(data) ? data : []);
    } catch {
      setSolicitudesHorasExtra([]);
    }
  }

  async function cargarSolicitudesCuentaCobro() {
    try {
      const data = await api("/solicitudes-cuenta-cobro");
      setSolicitudesCuentaCobro(Array.isArray(data) ? data : []);
    } catch {
      setSolicitudesCuentaCobro([]);
    }
  }

  async function cargarTarifaHora() {
    try {
      const data = await api("/configuracion/tarifa-hora");
      const valor = Number(data?.tarifaHora) || 119800;

      setTarifaHora(valor);
      setTarifaHoraInput(String(valor));
    } catch {
      setTarifaHora(119800);
      setTarifaHoraInput("119800");
    }
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
        cargarSolicitudesHorario(),
        cargarSolicitudesHorasExtra(),
        cargarSolicitudesCuentaCobro(),
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

  useEffect(() => {
    const usuarioGuardado = safeJsonParse(localStorage.getItem("usuarioSesion"));
    const medicoGuardado = safeJsonParse(localStorage.getItem("medicoActivo"));
    const pantallaGuardada = localStorage.getItem("pantalla");
    const tokenGuardado = localStorage.getItem("authToken");

    if (!tokenGuardado) {
      localStorage.removeItem("usuarioSesion");
      localStorage.removeItem("medicoActivo");
      localStorage.removeItem("pantalla");
      setPantalla(PANTALLAS.SELECTOR);
      return;
    }

    if (usuarioGuardado) setUsuarioSesion(usuarioGuardado);
    if (medicoGuardado) setMedicoActivo(medicoGuardado);

    if (pantallaGuardada && Object.values(PANTALLAS).includes(pantallaGuardada)) {
      setPantalla(pantallaGuardada);
    } else {
      setPantalla(PANTALLAS.SELECTOR);
    }
  }, []);

  useEffect(() => {
    if (medicoActivo?.id && usuarioSesion) {
      cargarPacientesCargo(medicoActivo.id);
      cargarNotificaciones(medicoActivo.id);
    }
  }, [medicoActivo?.id, usuarioSesion?.id]);

  useEffect(() => {
    if (!medicoActivo?.id) return;

    const actualizado = medicos.find((m) => Number(m.id) === Number(medicoActivo.id));
    if (!actualizado) return;

    const serialActual = JSON.stringify(medicoActivo);
    const serialNuevo = JSON.stringify(actualizado);

    if (serialActual !== serialNuevo) {
      setMedicoActivo(actualizado);
      localStorage.setItem("medicoActivo", JSON.stringify(actualizado));
    }
  }, [medicos, medicoActivo?.id]);

  useEffect(() => {
    if (!medicoActivo?.id) return;

    setDatosRegistroForm({
      registro_medico: medicoActivo.registro_medico || "",
      telefono: medicoActivo.telefono || "",
      email: medicoActivo.email || "",
      especialidad: medicoActivo.especialidad || "",
      fecha_ingreso: medicoActivo.fecha_ingreso || "",
      cargo: medicoActivo.cargo || "Médico Hospitalario",
    });
  }, [
    medicoActivo?.id,
    medicoActivo?.registro_medico,
    medicoActivo?.telefono,
    medicoActivo?.email,
    medicoActivo?.especialidad,
    medicoActivo?.fecha_ingreso,
    medicoActivo?.cargo,
  ]);

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
    const valor = turnos?.[`${id}_${f}`];

    if (!Array.isArray(valor)) return [];

    return valor.filter((t) => TIPOS_TURNO[t]);
  }

  function getHorasExtraDia(id, f) {
    const valor = horasAdicionales?.[`${id}_${f}`]?.horas;
    const n = Number(valor);

    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function horasBaseDia(id, f) {
    return getTurnosDia(id, f).reduce(
      (acc, tipo) => acc + (TIPOS_TURNO[tipo]?.horas || 0),
      0
    );
  }

  function horasDiaTotal(id, f) {
    return horasBaseDia(id, f) + getHorasExtraDia(id, f);
  }

  function horasMes(id, y, m) {
    return getDias(y, m).reduce((acc, d) => {
      const fecha = isoDate(d);
      return acc + horasDiaTotal(id, fecha);
    }, 0);
  }

  function salarioMes(id, y, m) {
    return horasMes(id, y, m) * tarifaHora;
  }

  function resumenTurnosMes(id, y, m) {
    return getDias(y, m).reduce(
      (acc, d) => {
        const fecha = isoDate(d);
        const tipos = getTurnosDia(id, fecha);

        tipos.forEach((tipo) => {
          if (!acc[tipo]) return;
          acc[tipo].cantidad += 1;
          acc[tipo].horas += TIPOS_TURNO[tipo]?.horas || 0;
        });

        acc.HORAS_EXTRA.horas += getHorasExtraDia(id, fecha);

        return acc;
      },
      {
        DIA: { cantidad: 0, horas: 0 },
        CENIZO: { cantidad: 0, horas: 0 },
        FDS: { cantidad: 0, horas: 0 },
        HORAS_EXTRA: { cantidad: 0, horas: 0 },
      }
    );
  }

  function getUsuarioMedico(medicoId) {
    return (
      usuarios.find(
        (u) => u?.rol === "medico" && Number(u?.medico_id) === Number(medicoId)
      ) || null
    );
  }

  function usuarioDisponible(base, suffix = "admin") {
    const limpio = String(base || "").trim();
    if (!limpio) return "";

    if (!usuarios.some((u) => String(u.username) === limpio)) {
      return limpio;
    }

    let i = 1;
    let candidato = `${limpio}-${suffix}`;

    while (usuarios.some((u) => String(u.username) === candidato)) {
      i += 1;
      candidato = `${limpio}-${suffix}-${i}`;
    }

    return candidato;
  }

  function getMedicoNombre(id) {
    const med = medicos.find((m) => Number(m.id) === Number(id));

    if (!med) return "No identificado";

    return `${med.nombre || ""} ${med.apellido || ""}`.trim();
  }

  function limpiarLogin() {
    setAdminCedula("");
    setAdminPassword("");
    setLoginUser("");
    setLoginPass("");
    setLoginErr("");
  }

  function logout() {
    setMedicoActivo(null);
    setUsuarioSesion(null);
    setPacientesCargo([]);
    setPacientesTodos([]);
    setPacienteForm(PACIENTE_FORM0);
    limpiarLogin();
    localStorage.removeItem("authToken");
    localStorage.removeItem("usuarioSesion");
    localStorage.removeItem("medicoActivo");
    localStorage.removeItem("pantalla");
    setPantalla(PANTALLAS.SELECTOR);
  }

  async function loginAdministradorCredenciales() {
    const cedulaDigitada = String(adminCedula || "").trim();
    const passwordDigitado = String(adminPassword || "").trim();

    if (!cedulaDigitada || !passwordDigitado) {
      setLoginErr("Debes ingresar cédula y contraseña del administrador");
      return;
    }

    try {
      const data = await api("/login-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cedula: cedulaDigitada,
          password: passwordDigitado,
        }),
      });

      if (!data?.usuario) {
        setLoginErr("Respuesta inválida del servidor");
        return;
      }

      if (!data?.token) {
        setLoginErr("El servidor no devolviÃ³ una sesiÃ³n vÃ¡lida");
        return;
      }

      if (data.usuario.rol !== "coordinador" && data.usuario.rol !== "administrador") {
        setLoginErr("Este usuario no tiene permisos de administrador");
        return;
      }

      const medicoAdmin =
        data.medico ||
        medicos.find((m) => String(m.documento) === String(data.usuario.cedula)) ||
        null;

      const usuarioNormalizado = {
        ...data.usuario,
        rol: "coordinador",
        medico_id: data.usuario.medico_id || medicoAdmin?.id || null,
        es_admin: true,
        es_medico: !!medicoAdmin,
      };

      setUsuarioSesion(usuarioNormalizado);
      setMedicoActivo(medicoAdmin);

      localStorage.setItem("authToken", data.token || "");
      localStorage.setItem("usuarioSesion", JSON.stringify(usuarioNormalizado));
      if (medicoAdmin) localStorage.setItem("medicoActivo", JSON.stringify(medicoAdmin));
      else localStorage.removeItem("medicoActivo");
      localStorage.setItem("pantalla", PANTALLAS.COORD);

      limpiarLogin();
      setMedicoView(VIEWS_MEDICO.HORARIO);
      setPantalla(PANTALLAS.COORD);
    } catch (error) {
      console.error(error);
      setLoginErr(error.message || "Administrador no válido");
    }
  }

  async function loginUsuarioNormal() {
    if (!loginUser.trim() || !loginPass.trim()) {
      setLoginErr("Debes ingresar usuario y contraseña");
      return;
    }

    try {
      const data = await api("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUser.trim(),
          password: loginPass,
        }),
      });

      if (!data?.usuario) {
        setLoginErr("Respuesta inválida del servidor");
        return;
      }

      if (!data?.token) {
        setLoginErr("El servidor no devolviÃ³ una sesiÃ³n vÃ¡lida");
        return;
      }

      if (data.usuario.rol === "coordinador" || data.usuario.rol === "administrador") {
        setLoginErr("El administrador debe ingresar por la pestaña Administrador");
        return;
      }

      if (data.usuario.rol !== "medico") {
        setLoginErr("Rol de usuario no reconocido");
        return;
      }

      const med = medicos.find((m) => Number(m.id) === Number(data.usuario.medico_id));

      if (!med) {
        setLoginErr("El usuario médico no está vinculado correctamente");
        return;
      }

      setUsuarioSesion(data.usuario);
      setMedicoActivo(med);

      localStorage.setItem("authToken", data.token || "");
      localStorage.setItem("usuarioSesion", JSON.stringify(data.usuario));
      localStorage.setItem("medicoActivo", JSON.stringify(med));
      localStorage.setItem("pantalla", PANTALLAS.MEDICO);

      limpiarLogin();
      setPantalla(PANTALLAS.MEDICO);
    } catch (error) {
      console.error(error);
      setLoginErr(error.message || "Error de conexión con el servidor");
    }
  }

  function validar() {
    const e = {};
    const doc = form.documento.trim();
    const email = form.email.trim();
    const tel = form.telefono.trim();

    if (!form.nombre.trim()) e.nombre = "Requerido";
    if (!form.apellido.trim()) e.apellido = "Requerido";
    if (!pisosAsignadosMedico(form).length) e.pisos_asignados = "Selecciona al menos un piso";

    if (!doc) {
      e.documento = "Requerido";
    } else if (
      medicos.find((m) => String(m.documento) === String(doc) && m.id !== editId)
    ) {
      e.documento = "Documento ya registrado";
    }

    if (!form.especialidad) e.especialidad = "Seleccione especialidad";
    if (!form.registro_medico.trim()) e.registro_medico = "Requerido";

    if (!tel) {
      e.telefono = "Requerido";
    } else if (!/^[0-9+\-\s()]{7,20}$/.test(tel)) {
      e.telefono = "Teléfono inválido";
    }

    if (!email) {
      e.email = "Requerido";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      e.email = "Email inválido";
    }

    if (!form.fecha_ingreso) e.fecha_ingreso = "Requerido";
    if (!form.cargo) e.cargo = "Requerido";

    return e;
  }

  async function guardarMedico() {
    const e = validar();

    if (Object.keys(e).length) {
      setErrores(e);
      return;
    }

    setSaving(true);

    try {
      const pisosAsignados = pisosAsignadosMedico(form);
      const pisoPrincipal = pisosAsignados[0] || {};
      const medicoPayload = {
        ...form,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        documento: form.documento.trim(),
        registro_medico: form.registro_medico.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        torre_asignada: pisoPrincipal.torre || "",
        piso_asignado: pisoPrincipal.piso || "",
        pisos_asignados: pisosAsignados,
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

      showToast(
        editId ? "Médico actualizado correctamente ✓" : "Médico registrado correctamente ✓"
      );
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
      torre_asignada: med.torre_asignada || "",
      piso_asignado: med.piso_asignado || "",
      pisos_asignados: pisosAsignadosMedico(med),
    });

    setEditId(med.id);
    setErrores({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarMedico(id) {
    const confirmado = window.confirm("¿Seguro que deseas eliminar este médico?");
    if (!confirmado) return;

    try {
      await api(`/medicos/${id}`, { method: "DELETE" });

      await Promise.all([
        cargarMedicos(),
        cargarUsuarios(),
        cargarTurnos(),
        cargarHorasAdicionales(),
      ]);

      showToast("Médico eliminado correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error eliminando médico", "err");
    }
  }

  async function crearUsuarioMedico() {
    const medico_id = Number(userForm.medico_id);
    const username = usuarioDisponible(String(userForm.username || "").trim(), "medico");
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
      setUserForm(USER_FORM0);
      showToast("Usuario médico creado correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo crear el usuario", "err");
    }
  }

  async function crearAdministrador() {
    const medico_id = Number(adminForm.medico_id);
    const medico = medicos.find((m) => Number(m.id) === medico_id);
    const nombre = medico
      ? `${medico.nombre || ""} ${medico.apellido || ""}`.trim()
      : String(adminForm.nombre || "").trim();
    const cedula = medico
      ? String(medico.documento || "").trim()
      : String(adminForm.cedula || "").trim();
    const username = usuarioDisponible(String(adminForm.username || "").trim() || cedula);
    const password = String(adminForm.password || "").trim();

    if (!medico_id || !medico || !password) {
      showToast("Selecciona un medico registrado y asigna una contrasena", "err");
      return;
    }


    try {
      await api("/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          rol: "coordinador",
          medico_id,
          cedula,
          nombre,
        }),
      });

      await cargarUsuarios();
      setAdminForm(ADMIN_FORM0);
      showToast("Administrador creado correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo crear el administrador", "err");
    }
  }

  async function eliminarAdministrador(id) {

    const confirmado = window.confirm("¿Seguro que deseas eliminar este administrador?");
    if (!confirmado) return;

    try {
      await api(`/administradores/${id}`, { method: "DELETE" });
      await cargarUsuarios();
      showToast("Administrador eliminado correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo eliminar el administrador", "err");
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
        body: JSON.stringify({ nuevaPassword }),
      });

      setResetPassForm(RESET_PASS_FORM0);
      showToast("Contraseña actualizada correctamente ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo cambiar la contraseña", "err");
    }
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
      showToast("Tarifa por hora actualizada ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo guardar la tarifa", "err");
    }
  }

  async function guardarHorasAdicionales() {
    const medico_id = Number(extraForm.medico_id);
    const fecha = extraForm.fecha;
    const horas = Number(extraForm.horas || 0);
    const motivo = extraForm.motivo || "";

    if (!medico_id || !fecha) {
      showToast("Selecciona médico y fecha", "err");
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
        body: JSON.stringify({ medico_id, fecha, horas, motivo }),
      });

      setHorasAdicionales((prev) => ({
        ...prev,
        [`${medico_id}_${fecha}`]: { horas, motivo },
      }));

      setExtraForm(EXTRA_FORM0);
      showToast("Horas adicionales guardadas ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudieron guardar las horas", "err");
    }
  }

  async function guardarHorasExtraMedico() {
    if (!medicoActivo?.id) {
      showToast("Sesión médica no válida", "err");
      return;
    }

    const fecha = medicoExtraForm.fecha;
    const horas = Number(medicoExtraForm.horas || 0);
    const motivo = String(medicoExtraForm.motivo || "").trim();

    if (!fecha) {
      showToast("Selecciona la fecha del fin de semana", "err");
      return;
    }

    if (!esFechaFinSemana(fecha)) {
      showToast("Las horas extra desde el perfil médico solo se registran para sábados o domingos", "err");
      return;
    }

    if (!horas || Number.isNaN(horas) || horas <= 0) {
      showToast("Ingresa un número válido de horas extra", "err");
      return;
    }

    try {
      await api("/solicitudes-horas-extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_id: medicoActivo.id,
          fecha,
          horas,
          motivo: motivo || "Horas extra reportadas por el médico durante fin de semana",
        }),
      });

      setMedicoExtraForm(MEDICO_EXTRA_FORM0);
      await Promise.all([cargarHorasAdicionales(), cargarSolicitudesHorasExtra()]);
      showToast("Solicitud de horas extra enviada a coordinación");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudieron enviar las horas extra", "err");
    }
  }

  async function crearPacienteCargo() {
    if (!medicoActivo?.id) {
      showToast("SesiÃ³n mÃ©dica no vÃ¡lida", "err");
      return;
    }

    const cama = String(pacienteForm.cama || "").trim();
    const nombre_paciente = String(pacienteForm.nombre_paciente || "").trim();
    const diagnostico = String(pacienteForm.diagnostico || "").trim();
    const pendientes = String(pacienteForm.pendientes || "").trim();
    const pisosAsignados = pisosAsignadosMedico(medicoActivo);
    const pisoSeleccionado = parsePisoKey(
      pacienteForm.piso_key || (pisosAsignados[0] && pisoKey(pisosAsignados[0].torre, pisosAsignados[0].piso))
    );

    if (!cama || !nombre_paciente) {
      showToast("Cama y nombre del paciente son obligatorios", "err");
      return;
    }

    if (!pisoSeleccionado.torre || !pisoSeleccionado.piso) {
      showToast("Selecciona el piso del paciente", "err");
      return;
    }

    try {
      await api("/pacientes-cargo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_id: medicoActivo.id,
          torre: pisoSeleccionado.torre,
          piso: pisoSeleccionado.piso,
          cama,
          nombre_paciente,
          diagnostico,
          pendientes,
          estado_paciente: pacienteForm.estado_paciente || "activo",
        }),
      });

      setPacienteForm(PACIENTE_FORM0);
      await cargarPacientesCargo(medicoActivo.id);
      showToast("Paciente agregado correctamente");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo agregar el paciente", "err");
    }
  }

  async function actualizarEstadoPacienteCargo(id, estado_paciente) {
    try {
      const row = await api(`/pacientes-cargo/${id}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_paciente }),
      });

      setPacientesCargo((prev) => prev.map((p) => (Number(p.id) === Number(id) ? row : p)));
      setPacientesTodos((prev) => prev.map((p) => (Number(p.id) === Number(id) ? { ...p, ...row } : p)));
      showToast("Estado del paciente actualizado");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo actualizar el estado", "err");
    }
  }

  async function cambiarPasswordMedico() {
    const actualPassword = String(cambioPassForm.actualPassword || "").trim();
    const nuevaPassword = String(cambioPassForm.nuevaPassword || "").trim();
    const confirmarPassword = String(cambioPassForm.confirmarPassword || "").trim();

    if (!actualPassword || !nuevaPassword || !confirmarPassword) {
      showToast("Completa la contraseña actual y la nueva contraseña", "err");
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      showToast("La confirmación no coincide con la nueva contraseña", "err");
      return;
    }

    try {
      await api("/usuarios/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualPassword, nuevaPassword }),
      });

      setCambioPassForm(CAMBIO_PASS_FORM0);
      showToast("Contraseña actualizada correctamente");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo cambiar la contraseña", "err");
    }
  }

  async function guardarDatosRegistroMedico() {
    if (!medicoActivo?.id) {
      showToast("Sesión médica no válida", "err");
      return;
    }

    const payload = {
      registro_medico: String(datosRegistroForm.registro_medico || "").trim(),
      telefono: String(datosRegistroForm.telefono || "").trim(),
      email: String(datosRegistroForm.email || "").trim(),
      especialidad: String(datosRegistroForm.especialidad || "").trim(),
      fecha_ingreso: String(datosRegistroForm.fecha_ingreso || "").trim(),
      cargo: String(datosRegistroForm.cargo || "").trim(),
    };

    if (Object.values(payload).some((v) => !v)) {
      showToast("Completa todos los datos del registro médico", "err");
      return;
    }

    setGuardandoDatosRegistro(true);

    try {
      const medicoActualizado = await api(`/medicos/${medicoActivo.id}/datos-registro`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMedicoActivo(medicoActualizado);
      localStorage.setItem("medicoActivo", JSON.stringify(medicoActualizado));
      await cargarMedicos();
      showToast("Datos del registro médico actualizados");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudieron guardar los datos", "err");
    } finally {
      setGuardandoDatosRegistro(false);
    }
  }

  async function descargarCuentaCobroMedico() {
    if (!medicoActivo?.id) {
      showToast("Sesión médica no válida", "err");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(
        `${API_URL}/medicos/${medicoActivo.id}/cuenta-cobro?year=${propYear}&mes=${propMes + 1}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        throw new Error(data?.error || "No se pudo generar el Excel");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] || `cuenta_cobro_${medicoActivo.documento || medicoActivo.id}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("Excel generado correctamente");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo generar el Excel", "err");
    }
  }

  async function enviarCuentaCobroCoordinacion() {
    if (!medicoActivo?.id) {
      showToast("Sesión médica no válida", "err");
      return;
    }

    try {
      await api("/solicitudes-cuenta-cobro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_id: medicoActivo.id,
          year: propYear,
          mes: propMes + 1,
          total_horas: horasMes(medicoActivo.id, propYear, propMes),
        }),
      });

      await cargarSolicitudesCuentaCobro();
      showToast("Cuenta de cobro enviada a coordinación");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo enviar la cuenta de cobro", "err");
    }
  }

  async function descargarCuentaCobroAdmin(medicoId, year, mes) {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API_URL}/medicos/${medicoId}/cuenta-cobro?year=${year}&mes=${mes}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        throw new Error(data?.error || "No se pudo descargar el Excel");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "cuenta_cobro.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo descargar el Excel", "err");
    }
  }

  async function eliminarPacienteCargo(id) {
    try {
      await api(`/pacientes-cargo/${id}`, { method: "DELETE" });
      setPacientesCargo((prev) => prev.filter((p) => Number(p.id) !== Number(id)));
      showToast("Paciente eliminado correctamente");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo eliminar el paciente", "err");
    }
  }

  async function agregarTurnoCoord(medicoId, fecha, tipoTurno) {
    try {
      const actuales = getTurnosDia(medicoId, fecha);
      const validacion = puedeAgregarTurno(actuales, tipoTurno, fecha);

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

      showToast("Turno agregado ✓");
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

        if (lista.length === 0) delete next[key];
        else next[key] = lista;

        return next;
      });

      showToast("Turno eliminado ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error eliminando turno", "err");
    }
  }

  async function descargarBackup() {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API_URL}/backup`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        throw new Error(data?.error || "No se pudo generar el backup");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `turnosmed-backup-${HOY_ISO}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("Backup descargado correctamente");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo descargar el backup", "err");
    }
  }

  async function restaurarBackupDesdeArchivo(file) {
    if (!file) return;

    const confirmar = window.confirm(
      "Restaurar un backup reemplazará los datos actuales por los del archivo seleccionado. ¿Continuar?"
    );

    if (!confirmar) return;

    try {
      const texto = await file.text();
      const backup = JSON.parse(texto);

      await api("/backup/restaurar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup),
      });

      await cargarTodoInicial();
      showToast("Backup restaurado correctamente");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo restaurar el backup", "err");
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  async function descargarCalendarioExcel({ y, m, medicoId = null }) {
    try {
      const token = localStorage.getItem("authToken");
      const params = new URLSearchParams({
        year: String(y),
        mes: String(m + 1),
      });

      if (medicoId) params.set("medico_id", String(medicoId));

      const res = await fetch(`${API_URL}/calendario/export/excel?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        throw new Error(data?.error || "No se pudo exportar el calendario");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `calendario-turnos-${y}-${String(m + 1).padStart(2, "0")}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("Calendario exportado a Excel");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo exportar el Excel", "err");
    }
  }

  function exportarCalendarioPdf({ y, m, dias, medicoId = null, titulo = "Calendario de turnos" }) {
    const medicosExport = medicoId
      ? medicos.filter((med) => Number(med.id) === Number(medicoId))
      : medicos;
    const filas = medicosExport
      .map((med) => {
        const celdas = dias
          .map((d) => {
            const fecha = isoDate(d);
            const tipos = turnosDiaOrdenados(getTurnosDia(med.id, fecha));
            return `<td>${tipos.length ? tipos.map((tipo) => TIPOS_TURNO[tipo]?.label || tipo).join("<br>") : "Libre"}</td>`;
          })
          .join("");

        return `<tr><th>${med.nombre || ""} ${med.apellido || ""}<br><small>${med.especialidad || ""}</small></th>${celdas}</tr>`;
      })
      .join("");
    const encabezados = dias
      .map((d) => `<th>${diaLabel(d)}<br>${isoDate(d).slice(8)}</th>`)
      .join("");
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>${titulo}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
            h1 { margin: 0 0 4px; font-size: 20px; }
            p { margin: 0 0 16px; color: #475569; }
            table { border-collapse: collapse; width: 100%; font-size: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: top; text-align: center; }
            th { background: #dbeafe; color: #0f172a; font-weight: 700; }
            tr th:first-child { text-align: left; min-width: 150px; background: #eff6ff; }
            small { color: #64748b; font-weight: 400; }
            @media print { body { margin: 10mm; } }
          </style>
        </head>
        <body>
          <h1>${titulo}</h1>
          <p>${capFirst(mesLabel(y, m))}</p>
          <table>
            <thead><tr><th>Médico</th>${encabezados}</tr></thead>
            <tbody>${filas}</tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");

    if (!win) {
      showToast("El navegador bloqueó la ventana de impresión", "err");
      return;
    }

    win.document.write(html);
    win.document.close();
  }

  async function enviarSolicitudCambioTurno() {
    if (!medicoActivo?.id) {
      showToast("Sesión médica no válida", "err");
      return;
    }

    const origen = parseTurnoValue(solCambioForm.turno_origen);
    const destino = parseTurnoValue(solCambioForm.turno_destino);
    const medicoDestinoId = Number(solCambioForm.medico_destino_id);

    if (!origen.fecha || !origen.tipo || !medicoDestinoId || !destino.fecha || !destino.tipo) {
      showToast("Completa turno propio, médico destino y turno a cambiar", "err");
      return;
    }

    try {
      await api("/solicitudes-cambio-turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_solicitante_id: medicoActivo.id,
          medico_destino_id: medicoDestinoId,
          fecha_origen: origen.fecha,
          tipo_turno_origen: origen.tipo,
          fecha_destino: destino.fecha,
          tipo_turno_destino: destino.tipo,
          mensaje: solCambioForm.mensaje || "",
          estado: ESTADOS.PENDIENTE,
        }),
      });

      setSolCambioForm(SOL_CAMBIO0);
      await cargarSolicitudesCambio();
      showToast("Solicitud de cambio enviada a coordinación ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo enviar la solicitud de cambio", "err");
    }
  }

  async function enviarSolicitudCesionTurno() {
    if (!medicoActivo?.id) {
      showToast("Sesión médica no válida", "err");
      return;
    }

    const origen = parseTurnoValue(solCesionForm.turno_origen);
    const medicoReceptorId = Number(solCesionForm.medico_receptor_id);

    if (!origen.fecha || !origen.tipo || !medicoReceptorId) {
      showToast("Completa turno propio y médico receptor", "err");
      return;
    }

    try {
      await api("/solicitudes-cesion-turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_solicitante_id: medicoActivo.id,
          medico_receptor_id: medicoReceptorId,
          fecha: origen.fecha,
          tipo_turno: origen.tipo,
          mensaje: solCesionForm.mensaje || "",
          estado: ESTADOS.PENDIENTE,
        }),
      });

      setSolCesionForm(SOL_CESION0);
      await cargarSolicitudesCesion();
      showToast("Solicitud de cesión enviada a coordinación ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo enviar la solicitud de cesión", "err");
    }
  }

  async function enviarSolicitudHorario() {
    if (!medicoActivo?.id) {
      showToast("Sesión médica no válida", "err");
      return;
    }

    if (!estaEnUltimos7DiasDelMes()) {
      showToast("La solicitud de horario solo se habilita los últimos 7 días del mes", "err");
      return;
    }

    const mensaje = String(solHorarioForm.mensaje || "").trim();

    if (!mensaje) {
      showToast("Escribe el mensaje para coordinación", "err");
      return;
    }

    const next = getNextMonthInfo();

    try {
      await api("/solicitudes-horario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_id: medicoActivo.id,
          medico_solicitante_id: medicoActivo.id,
          year: next.year,
          mes: next.monthNumber,
          mes_programacion: next.monthNumber,
          mensaje,
          estado: ESTADOS.PENDIENTE,
        }),
      });

      setSolHorarioForm(SOL_HORARIO0);
      await cargarSolicitudesHorario();
      showToast("Solicitud de horario enviada a coordinación ✓");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo enviar la solicitud de horario", "err");
    }
  }

  async function cambiarEstadoSolicitud(tipo, id, accion) {
    const endpoints = {
      cambio: `/solicitudes-cambio-turno/${id}/${accion}`,
      cesion: `/solicitudes-cesion-turno/${id}/${accion}`,
      horario: `/solicitudes-horario/${id}/${accion}`,
      horas_extra: `/solicitudes-horas-extra/${id}/${accion}`,
      cuenta_cobro: `/solicitudes-cuenta-cobro/${id}/${accion}`,
    };

    if (!endpoints[tipo]) return;

    let comentario = "";

    if (accion === "rechazar") {
      const respuesta = window.prompt("Comentario para el médico al rechazar la solicitud:", "");
      if (respuesta === null) return;
      comentario = respuesta;
    }

    try {
      await api(endpoints[tipo], {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario_coordinador: comentario }),
      });

      await Promise.all([
        cargarSolicitudesCambio(),
        cargarSolicitudesCesion(),
        cargarSolicitudesHorario(),
        cargarSolicitudesHorasExtra(),
        cargarSolicitudesCuentaCobro(),
        cargarTurnos(),
        cargarHorasAdicionales(),
        medicoActivo?.id ? cargarNotificaciones(medicoActivo.id) : Promise.resolve(),
      ]);

      showToast(
        accion === "aprobar"
          ? "Solicitud aprobada correctamente ✓"
          : "Solicitud rechazada correctamente ✓"
      );
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo actualizar la solicitud", "err");
    }
  }

  async function marcarNotificacionLeida(id) {
    try {
      await api(`/notificaciones/${id}/leida`, { method: "PUT" });
      await cargarNotificaciones(medicoActivo?.id);
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo actualizar la notificación", "err");
    }
  }

  async function marcarTodasNotificacionesLeidas() {
    if (!medicoActivo?.id) return;

    try {
      await api("/notificaciones/marcar-todas/leidas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medico_id: medicoActivo.id }),
      });
      await cargarNotificaciones(medicoActivo.id);
      showToast("Notificaciones marcadas como leídas");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudieron actualizar las notificaciones", "err");
    }
  }

  if (pantalla === PANTALLAS.SELECTOR) {
    return (
      <div className="tm-page-center" style={S.pageCenter}>
        <ResponsiveStyles />
        <CreditBadge />
        <Toast toast={toast} />

        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏥</div>
          <div style={S.appTitle}>TurnosMed</div>
          <div style={S.appSub}>Sistema de Coordinación Hospitalaria</div>
        </div>

        <div className="tm-login-card" style={S.loginCard}>
          <div style={S.loginTabs}>
            <button
              type="button"
              onClick={() => {
                setLoginMode("admin");
                setLoginErr("");
              }}
              style={S.loginTab(loginMode === "admin")}
            >
              Administrador
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginMode("usuario");
                setLoginErr("");
              }}
              style={S.loginTab(loginMode === "usuario")}
            >
              Usuario
            </button>
          </div>

          {loginMode === "admin" ? (
            <>
              <div style={S.loginIcon}>🛡️</div>
              <div style={S.loginTitle}>Ingreso administrador</div>
              <div style={S.loginSub}>Ingrese cédula y contraseña de administrador</div>

              <label style={S.lbl}>Cédula del administrador</label>
              <input
                style={{ ...inputStyle(!!loginErr), marginTop: 6, marginBottom: 12 }}
                value={adminCedula}
                onChange={(e) => {
                  setAdminCedula(e.target.value);
                  setLoginErr("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loginAdministradorCredenciales();
                }}
                placeholder="Cédula"
              />

              <label style={S.lbl}>Contraseña del administrador</label>
              <input
                type="password"
                style={{ ...inputStyle(!!loginErr), marginTop: 6, marginBottom: 12 }}
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  setLoginErr("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loginAdministradorCredenciales();
                }}
                placeholder="Contraseña"
              />

              {loginErr && <div style={S.errText}>{loginErr}</div>}

              <button
                type="button"
                onClick={loginAdministradorCredenciales}
                style={S.loginBtn}
              >
                Entrar como administrador →
              </button>
            </>
          ) : (
            <>
              <div style={S.loginIcon}>🔐</div>
              <div style={S.loginTitle}>Ingreso usuarios</div>
              <div style={S.loginSub}>Médicos y usuarios entran con usuario y contraseña</div>

              <label style={S.lbl}>Usuario</label>
              <input
                style={{ ...inputStyle(!!loginErr), marginTop: 6, marginBottom: 12 }}
                value={loginUser}
                onChange={(e) => {
                  setLoginUser(e.target.value);
                  setLoginErr("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loginUsuarioNormal();
                }}
                placeholder="Usuario"
              />

              <label style={S.lbl}>Contraseña</label>
              <input
                type="password"
                style={{ ...inputStyle(!!loginErr), marginTop: 6, marginBottom: 12 }}
                value={loginPass}
                onChange={(e) => {
                  setLoginPass(e.target.value);
                  setLoginErr("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loginUsuarioNormal();
                }}
                placeholder="Contraseña"
              />

              {loginErr && <div style={S.errText}>{loginErr}</div>}

              <button type="button" onClick={loginUsuarioNormal} style={S.loginBtn}>
                Ingresar →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (pantalla === PANTALLAS.MEDICO) {
    const puedeVerComoMedico =
      !!medicoActivo &&
      (usuarioSesion?.rol === "medico" ||
        usuarioSesion?.rol === "coordinador" ||
        usuarioSesion?.es_medico);
    const puedeVolverAdmin = usuarioSesion?.rol === "coordinador" || usuarioSesion?.es_admin;

    if (!puedeVerComoMedico) {
      return (
        <div className="tm-page-center" style={S.pageCenter}>
          <ResponsiveStyles />
          <Toast toast={toast} />

          <div className="tm-card" style={S.cardRestrict}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
            <div style={S.restrictTitle}>Sesión médica no válida</div>
            <div style={S.restrictText}>
              Vuelva a ingresar con usuario médico o con un administrador vinculado a médico.
            </div>

            <button type="button" onClick={logout} style={S.primaryButton}>
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }

    const hMes = horasMes(medicoActivo.id, propYear, propMes);
    const sueldoMes = salarioMes(medicoActivo.id, propYear, propMes);
    const requiereActualizarRegistro = Number(medicoActivo?.datos_registro_actualizados || 0) !== 1;
    const notificacionesNoLeidas = notificaciones.filter((n) => Number(n.leida || 0) !== 1).length;

    return (
      <div style={S.page}>
        <ResponsiveStyles />
        <Toast toast={toast} />

        <div className="tm-portal-header" style={S.portalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Av color={medicoActivo?.color} size={38} fontSize={14}>
              {medicoActivo?.nombre?.[0]}
              {medicoActivo?.apellido?.[0]}
            </Av>

            <div>
              <div style={S.headerName}>
                {medicoActivo?.nombre} {medicoActivo?.apellido}
              </div>

              <div style={S.headerSub}>
                {medicoActivo?.especialidad} · {medicoActivo?.cargo}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {puedeVolverAdmin && (
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("pantalla", PANTALLAS.COORD);
                  setPantalla(PANTALLAS.COORD);
                }}
                style={S.primaryButton}
              >
                Panel administrador
              </button>
            )}

            <button type="button" onClick={logout} style={S.logoutBtn}>
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="tm-medico-wrap" style={S.medicoWrap}>
          {requiereActualizarRegistro && (
            <DatosRegistroObligatorio
              datosRegistroForm={datosRegistroForm}
              setDatosRegistroForm={setDatosRegistroForm}
              guardarDatosRegistroMedico={guardarDatosRegistroMedico}
              guardandoDatosRegistro={guardandoDatosRegistro}
            />
          )}

          <div style={{ ...S.medicoTopTabs, display: requiereActualizarRegistro ? "none" : "flex" }}>
            <button
              type="button"
              onClick={() => setMedicoView(VIEWS_MEDICO.HORARIO)}
              style={S.medicoTab(medicoView === VIEWS_MEDICO.HORARIO)}
            >
              📅 Mi horario
            </button>

            <button
              type="button"
              onClick={() => setMedicoView(VIEWS_MEDICO.SOLICITUDES)}
              style={S.medicoTab(medicoView === VIEWS_MEDICO.SOLICITUDES)}
            >
              📬 Solicitudes
            </button>

            <button
              type="button"
              onClick={() => setMedicoView(VIEWS_MEDICO.PACIENTES)}
              style={S.medicoTab(medicoView === VIEWS_MEDICO.PACIENTES)}
            >
              Pacientes a cargo
            </button>

            <button
              type="button"
              onClick={() => setMedicoView(VIEWS_MEDICO.NOTIFICACIONES)}
              style={S.medicoTab(medicoView === VIEWS_MEDICO.NOTIFICACIONES)}
            >
              Notificaciones{notificacionesNoLeidas > 0 ? ` (${notificacionesNoLeidas})` : ""}
            </button>

            <button
              type="button"
              onClick={() => setMedicoView(VIEWS_MEDICO.GLOBAL)}
              style={S.medicoTab(medicoView === VIEWS_MEDICO.GLOBAL)}
            >
              Calendario global
            </button>

            <button
              type="button"
              onClick={() => setMedicoView(VIEWS_MEDICO.PERFIL)}
              style={S.medicoTab(medicoView === VIEWS_MEDICO.PERFIL)}
            >
              Mi perfil
            </button>
          </div>

          {!requiereActualizarRegistro && medicoView === VIEWS_MEDICO.HORARIO && (
            <>
              <h1 className="tm-page-title" style={S.pageTitle}>
                📅 Mi horario
              </h1>

              <p style={S.pageSubtitle}>
                Consulta tus turnos asignados por mes y reporta horas extra realizadas en fines de semana.
              </p>

              <div className="tm-month-selector" style={S.monthSelector}>
                <button
                  type="button"
                  onClick={() => navMes(-1, setPropYear, setPropMes, propYear, propMes)}
                  style={S.bnav}
                >
                  ‹
                </button>

                <span className="tm-month-title" style={S.monthTitle}>
                  {capFirst(mesLabel(propYear, propMes))}
                </span>

                <button
                  type="button"
                  onClick={() => navMes(1, setPropYear, setPropMes, propYear, propMes)}
                  style={S.bnav}
                >
                  ›
                </button>

                <span style={S.badgeBlue}>{hMes}h totales</span>
                <span style={S.badgeGreen}>{formatCOP(sueldoMes)}</span>
                <button
                  type="button"
                  onClick={() => descargarCalendarioExcel({ y: propYear, m: propMes, medicoId: medicoActivo.id })}
                  style={S.secondaryButton}
                >
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportarCalendarioPdf({
                      y: propYear,
                      m: propMes,
                      dias: diasProp,
                      medicoId: medicoActivo.id,
                      titulo: `Calendario de ${medicoActivo.nombre} ${medicoActivo.apellido}`,
                    })
                  }
                  style={S.secondaryButton}
                >
                  PDF
                </button>
              </div>

              <div style={S.legend}>
                {Object.entries(TIPOS_TURNO).map(([k, v]) => (
                  <span key={k} style={{ ...S.chip, background: v.bg, color: v.color }}>
                    {v.emoji} {v.label} {v.horas}h
                  </span>
                ))}

                <span style={{ ...S.chip, background: "#1f2937", color: "#f1f5f9" }}>
                  ➕ Horas adicionales
                </span>
              </div>

              <MedicoCalendarioCompacto
                diasProp={diasProp}
                medicoActivo={medicoActivo}
                getTurnosDia={getTurnosDia}
                getHorasExtraDia={getHorasExtraDia}
                horasDiaTotal={horasDiaTotal}
              />

              <ResumenTurnosMedico
                resumen={resumenTurnosMes(medicoActivo.id, propYear, propMes)}
                descargarCuentaCobroMedico={descargarCuentaCobroMedico}
                enviarCuentaCobroCoordinacion={enviarCuentaCobroCoordinacion}
              />

              <HorasExtraMedico
                medicoExtraForm={medicoExtraForm}
                setMedicoExtraForm={setMedicoExtraForm}
                guardarHorasExtraMedico={guardarHorasExtraMedico}
              />
            </>
          )}

          {!requiereActualizarRegistro && medicoView === VIEWS_MEDICO.SOLICITUDES && (
            <SolicitudesMedico
              medicoActivo={medicoActivo}
              medicos={medicos}
              diasProp={diasProp}
              getTurnosDia={getTurnosDia}
              solCambioForm={solCambioForm}
              setSolCambioForm={setSolCambioForm}
              solCesionForm={solCesionForm}
              setSolCesionForm={setSolCesionForm}
              solHorarioForm={solHorarioForm}
              setSolHorarioForm={setSolHorarioForm}
              enviarSolicitudCambioTurno={enviarSolicitudCambioTurno}
              enviarSolicitudCesionTurno={enviarSolicitudCesionTurno}
              enviarSolicitudHorario={enviarSolicitudHorario}
              solicitudesCambioTurno={solicitudesCambioTurno}
              solicitudesCesionTurno={solicitudesCesionTurno}
              solicitudesHorasExtra={solicitudesHorasExtra}
              solicitudesCuentaCobro={solicitudesCuentaCobro}
              solicHorario={solicHorario}
              getMedicoNombre={getMedicoNombre}
            />
          )}

          {!requiereActualizarRegistro && medicoView === VIEWS_MEDICO.PACIENTES && (
            <PacientesCargoMedico
              medicoActivo={medicoActivo}
              pacienteForm={pacienteForm}
              setPacienteForm={setPacienteForm}
              pacientesCargo={pacientesCargo}
              pacientesTodos={pacientesTodos}
              crearPacienteCargo={crearPacienteCargo}
              eliminarPacienteCargo={eliminarPacienteCargo}
              actualizarEstadoPacienteCargo={actualizarEstadoPacienteCargo}
            />
          )}

          {!requiereActualizarRegistro && medicoView === VIEWS_MEDICO.NOTIFICACIONES && (
            <NotificacionesMedico
              notificaciones={notificaciones}
              marcarNotificacionLeida={marcarNotificacionLeida}
              marcarTodasNotificacionesLeidas={marcarTodasNotificacionesLeidas}
            />
          )}

          {!requiereActualizarRegistro && medicoView === VIEWS_MEDICO.GLOBAL && (
            <CalendarioGlobalMedicos
              medicos={medicos}
              diasProp={diasProp}
              propYear={propYear}
              propMes={propMes}
              setPropYear={setPropYear}
              setPropMes={setPropMes}
              navMes={navMes}
              getTurnosDia={getTurnosDia}
            />
          )}

          {!requiereActualizarRegistro && medicoView === VIEWS_MEDICO.PERFIL && (
            <PerfilMedico
              medicoActivo={medicoActivo}
              cambioPassForm={cambioPassForm}
              setCambioPassForm={setCambioPassForm}
              cambiarPasswordMedico={cambiarPasswordMedico}
              datosRegistroForm={datosRegistroForm}
              setDatosRegistroForm={setDatosRegistroForm}
              guardarDatosRegistroMedico={guardarDatosRegistroMedico}
              guardandoDatosRegistro={guardandoDatosRegistro}
            />
          )}
        </div>
      </div>
    );
  }

  if (pantalla === PANTALLAS.REGISTRO) {
    if (!usuarioSesion || usuarioSesion.rol !== "coordinador") {
      return (
        <div className="tm-page-center" style={S.pageCenter}>
          <ResponsiveStyles />

          <div className="tm-card" style={S.cardRestrict}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
            <div style={S.restrictTitle}>Acceso restringido</div>
            <div style={S.restrictText}>
              El registro de médicos solo puede ser gestionado por el administrador.
            </div>

            <button
              type="button"
              onClick={() => setPantalla(PANTALLAS.SELECTOR)}
              style={S.primaryButton}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={S.page}>
        <ResponsiveStyles />
        <Toast toast={toast} />

        <HeaderSimple
          title="TurnosMed"
          subtitle="Registro de médicos"
          right={
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={S.badgeBlue}>
                {medicos.length} médico{medicos.length !== 1 ? "s" : ""}
              </span>

              <button
                type="button"
                onClick={() => setPantalla(PANTALLAS.COORD)}
                style={S.primaryButton}
              >
                Volver al panel
              </button>
            </div>
          }
        />

        <RegistroMedicos
          medicos={medicos}
          form={form}
          setForm={setForm}
          errores={errores}
          editId={editId}
          setEditId={setEditId}
          setErrores={setErrores}
          setForm0={() => setForm(FORM0)}
          saving={saving}
          guardarMedico={guardarMedico}
          abrirEditar={abrirEditar}
          eliminarMedico={eliminarMedico}
        />
      </div>
    );
  }

  if (!usuarioSesion || usuarioSesion.rol !== "coordinador") {
    return (
      <div className="tm-page-center" style={S.pageCenter}>
        <ResponsiveStyles />
        <Toast toast={toast} />

        <div className="tm-card" style={S.cardRestrict}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
          <div style={S.restrictTitle}>Acceso restringido</div>
          <div style={S.restrictText}>Debe ingresar como administrador.</div>

          <button type="button" onClick={logout} style={S.primaryButton}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tm-coord-layout" style={S.coordLayout}>
      <ResponsiveStyles />
      <Toast toast={toast} />

      <aside className="tm-sidebar" style={S.sidebar}>
        <div className="tm-sidebar-top" style={S.sidebarTop}>
          <span style={{ fontSize: 24 }}>🏥</span>

          <div>
            <div style={S.sidebarTitle}>TurnosMed</div>
            <div style={S.sidebarSub}>Panel Administrador</div>
          </div>
        </div>

        <nav className="tm-side-nav" style={S.sideNav}>
          {[
            { key: VIEWS_COORD.DASHBOARD, icon: "📊", label: "Dashboard" },
            { key: VIEWS_COORD.HOY, icon: "📋", label: "Hoy" },
            { key: VIEWS_COORD.CALENDARIO, icon: "📅", label: "Calendario" },
            { key: VIEWS_COORD.MEDICOS, icon: "👨‍⚕️", label: "Médicos y usuarios" },
            {
              key: VIEWS_COORD.HORARIOS,
              icon: "📬",
              label: "Solicitudes",
              badge: pendientesHorario,
            },
            { key: VIEWS_COORD.BACKUP, icon: "💾", label: "Backup" },
          ].map((item) => (
            <button
              type="button"
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

        <div className="tm-sidebar-bottom" style={S.sidebarBottom}>
          {medicoActivo && (usuarioSesion?.es_medico || usuarioSesion?.rol === "coordinador") && (
            <button
              type="button"
              onClick={() => {
                setMedicoView(VIEWS_MEDICO.HORARIO);
                localStorage.setItem("pantalla", PANTALLAS.MEDICO);
                setPantalla(PANTALLAS.MEDICO);
              }}
              style={S.sideSecondary}
            >
              🩺 Ir a mi vista médica
            </button>
          )}

          <button type="button" onClick={logout} style={S.sideLogout}>
            ← Cerrar sesión
          </button>

          <button
            type="button"
            onClick={() => setPantalla(PANTALLAS.REGISTRO)}
            style={S.sideSecondary}
          >
            ⚙️ Gestionar médicos
          </button>

          <div style={S.sidebarCount}>
            {medicos.length} médico{medicos.length !== 1 ? "s" : ""} registrado
            {medicos.length !== 1 ? "s" : ""}
          </div>
        </div>
      </aside>

      <main className="tm-coord-main" style={S.coordMain}>
        <div className="tm-config-card" style={S.configCard}>
          <div>
            <div style={S.configTitle}>💰 Configuración de tarifa por hora</div>
            <div style={S.configSub}>
              Esta tarifa la verán tanto el administrador como los médicos.
            </div>
          </div>

          <div className="tm-config-actions" style={S.configActions}>
            <input
              type="number"
              min="1"
              value={tarifaHoraInput}
              onChange={(e) => setTarifaHoraInput(e.target.value)}
              style={{ ...inputStyle(false), width: 180 }}
            />

            <button type="button" onClick={guardarTarifaHora} style={S.primaryButton}>
              Guardar tarifa
            </button>
          </div>
        </div>

        {view === VIEWS_COORD.DASHBOARD && (
          <VistaDashboardCoordinador
            medicos={medicos}
            fecha={HOY_ISO}
            tarifaHora={tarifaHora}
            turnos={turnos}
            solicitudesCambioTurno={solicitudesCambioTurno}
            solicitudesCesionTurno={solicitudesCesionTurno}
            solicitudesHorasExtra={solicitudesHorasExtra}
            solicitudesCuentaCobro={solicitudesCuentaCobro}
            solicHorario={solicHorario}
            getTurnosDia={getTurnosDia}
            getHorasExtraDia={getHorasExtraDia}
            horasDiaTotal={horasDiaTotal}
            setView={setView}
          />
        )}

        {view === VIEWS_COORD.HOY && (
          <VistaHoy
            medicos={medicos}
            fecha={HOY_ISO}
            tarifaHora={tarifaHora}
            getTurnosDia={getTurnosDia}
            getHorasExtraDia={getHorasExtraDia}
            horasDiaTotal={horasDiaTotal}
          />
        )}

        {view === VIEWS_COORD.CALENDARIO && (
          <VistaCalendario
            medicos={medicos}
            diasCoord={diasCoord}
            year={year}
            month={month}
            setYear={setYear}
            setMonth={setMonth}
            navMes={navMes}
            getTurnosDia={getTurnosDia}
            getHorasExtraDia={getHorasExtraDia}
            horasDiaTotal={horasDiaTotal}
            agregarTurnoCoord={agregarTurnoCoord}
            eliminarTurnoCoord={eliminarTurnoCoord}
            descargarCalendarioExcel={descargarCalendarioExcel}
            exportarCalendarioPdf={exportarCalendarioPdf}
          />
        )}

        {view === VIEWS_COORD.MEDICOS && (
          <VistaMedicos
            medicos={medicos}
            usuarios={usuarios}
            userForm={userForm}
            setUserForm={setUserForm}
            adminForm={adminForm}
            setAdminForm={setAdminForm}
            resetPassForm={resetPassForm}
            setResetPassForm={setResetPassForm}
            crearUsuarioMedico={crearUsuarioMedico}
            crearAdministrador={crearAdministrador}
            resetearPasswordUsuario={resetearPasswordUsuario}
            eliminarAdministrador={eliminarAdministrador}
            getUsuarioMedico={getUsuarioMedico}
            usuarioDisponible={usuarioDisponible}
            usuarioSesion={usuarioSesion}
            horasMes={horasMes}
            salarioMes={salarioMes}
            year={year}
            month={month}
            setPantalla={setPantalla}
            extraForm={extraForm}
            setExtraForm={setExtraForm}
            guardarHorasAdicionales={guardarHorasAdicionales}
          />
        )}

        {view === VIEWS_COORD.HORARIOS && (
          <VistaSolicitudes
            solicHorario={solicHorario}
            solicitudesCambioTurno={solicitudesCambioTurno}
            solicitudesCesionTurno={solicitudesCesionTurno}
            solicitudesHorasExtra={solicitudesHorasExtra}
            solicitudesCuentaCobro={solicitudesCuentaCobro}
            medicos={medicos}
            getMedicoNombre={getMedicoNombre}
            cambiarEstadoSolicitud={cambiarEstadoSolicitud}
            descargarCuentaCobroAdmin={descargarCuentaCobroAdmin}
          />
        )}

        {view === VIEWS_COORD.BACKUP && (
          <VistaBackup
            descargarBackup={descargarBackup}
            restaurarBackupDesdeArchivo={restaurarBackupDesdeArchivo}
            backupInputRef={backupInputRef}
          />
        )}
      </main>
    </div>
  );
}

/* ============================================================================
   COMPONENTES
============================================================================ */
function ResponsiveStyles() {
  return (
    <style>
      {`
        @media (min-width: 769px) {
          .tm-medico-week-row {
            display: grid !important;
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
            gap: 10px !important;
            margin-bottom: 8px !important;
          }

          .tm-medico-week-label {
            text-align: center !important;
            color: #94a3b8 !important;
            font-size: 11px !important;
            font-weight: 900 !important;
          }
        }

        @media (max-width: 768px) {
          .tm-medico-calendar-wrap {
            background: #0b1528 !important;
            border: 1px solid #1e293b !important;
            border-radius: 16px !important;
            padding: 10px !important;
            box-shadow: 0 18px 45px rgba(0,0,0,0.22) !important;
          }

          .tm-medico-week-row {
            display: grid !important;
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
            gap: 3px !important;
            margin-bottom: 5px !important;
          }

          .tm-medico-week-label {
            text-align: center !important;
            color: #94a3b8 !important;
            font-size: 10px !important;
            font-weight: 900 !important;
          }

          .tm-medico-calendar-grid {
            display: grid !important;
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
            gap: 3px !important;
          }

          .tm-global-calendar-grid {
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
            gap: 3px !important;
          }

          .tm-medico-day-card {
            min-height: 76px !important;
            padding: 4px !important;
            border-radius: 7px !important;
          }

          .tm-medico-day-head {
            display: flex !important;
            justify-content: flex-end !important;
            align-items: center !important;
            margin-bottom: 2px !important;
          }

          .tm-medico-day-name {
            display: none !important;
          }

          .tm-medico-day-number {
            font-size: 13px !important;
            font-weight: 900 !important;
          }

          .tm-medico-shift-list {
            gap: 2px !important;
          }

          .tm-medico-shift-chip {
            font-size: 8.5px !important;
            line-height: 1.05 !important;
            padding: 2px 3px !important;
            border-radius: 5px !important;
            gap: 2px !important;
            justify-content: center !important;
          }

          .tm-medico-shift-chip span:first-child {
            font-size: 9px !important;
          }

          .tm-medico-free-chip {
            font-size: 8px !important;
            padding: 2px 3px !important;
            border-radius: 5px !important;
            justify-content: center !important;
          }

          .tm-medico-day-total {
            font-size: 8px !important;
            margin-top: 2px !important;
            padding-top: 2px !important;
          }

          .tm-solicitudes-grid {
            grid-template-columns: 1fr !important;
          }

          .tm-solicitud-card {
            padding: 14px !important;
          }

          .tm-solicitud-row {
            grid-template-columns: 1fr !important;
          }

          .tm-coord-layout {
            display: block !important;
          }

          .tm-sidebar {
            position: static !important;
            width: auto !important;
            min-height: auto !important;
            padding: 12px !important;
          }

          .tm-sidebar-top {
            margin-bottom: 10px !important;
          }

          .tm-side-nav {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .tm-sidebar-bottom {
            margin-top: 10px !important;
            gap: 8px !important;
          }

          .tm-coord-main {
            padding: 12px !important;
          }

          .tm-config-card {
            padding: 12px !important;
            margin-bottom: 12px !important;
          }

          .tm-config-actions {
            width: 100% !important;
          }

          .tm-config-actions input,
          .tm-config-actions button {
            width: 100% !important;
          }

          .tm-dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .tm-dashboard-metric {
            padding: 10px !important;
          }

          .tm-dashboard-columns {
            grid-template-columns: 1fr !important;
          }

          .tm-card {
            padding: 12px !important;
            border-radius: 10px !important;
            margin-bottom: 10px !important;
          }

          .tm-cards-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }

        @media (max-width: 380px) {
          .tm-medico-day-card {
            min-height: 70px !important;
            padding: 3px !important;
          }

          .tm-medico-day-number {
            font-size: 12px !important;
          }

          .tm-medico-shift-chip {
            font-size: 8px !important;
          }

          .tm-medico-free-chip {
            font-size: 7.5px !important;
          }
        }
      `}
    </style>
  );
}

function CreditBadge() {
  return (
    <div style={S.creditBadge}>
      Programado por Fernando Rodriguez Bayona / Fundacion Valle de Lili / Cali, Colombia
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div
      className="tm-toast"
      style={{ ...S.toast, background: toast.tipo === "ok" ? "#22c55e" : "#ef4444" }}
    >
      {toast.msg}
    </div>
  );
}

function Av({ color = "#4f8ef7", size = 38, fontSize = 14, children }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function HeaderSimple({ title, subtitle, right }) {
  return (
    <header className="tm-simple-header" style={S.simpleHeader}>
      <div>
        <div style={S.simpleTitle}>{title}</div>
        <div style={S.simpleSub}>{subtitle}</div>
      </div>

      {right}
    </header>
  );
}

function Campo({ label, err, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={S.lbl}>{label}</label>
      {children}
      {err && <span style={S.fieldErr}>{err}</span>}
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={S.lbl}>{label}</label>

      <select value={value} onChange={onChange} style={inputStyle(false)}>
        {options.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
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

      <input type="date" value={value} onChange={onChange} style={inputStyle(false)} />
    </div>
  );
}

function MedicoCalendarioCompacto({
  diasProp,
  medicoActivo,
  getTurnosDia,
  getHorasExtraDia,
  horasDiaTotal,
}) {
  const celdasVacias = Array.from({ length: lunesPrimeroOffset(diasProp[0]) });

  return (
    <div className="tm-medico-calendar-wrap" style={S.medicoCalendarWrap}>
      <div className="tm-medico-week-row">
        {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((d) => (
          <div key={d} className="tm-medico-week-label">
            {d}
          </div>
        ))}
      </div>

      <div className="tm-medico-calendar-grid" style={S.medicoCalendarGrid}>
        {celdasVacias.map((_, index) => (
          <div key={`empty-${index}`} style={S.medicoEmptyDay} />
        ))}

        {diasProp.map((d) => {
          const f = isoDate(d);
          const tipos = turnosDiaOrdenados(getTurnosDia(medicoActivo.id, f));
          const extra = getHorasExtraDia(medicoActivo.id, f);
          const esHoy = f === HOY_ISO;
          const esFin = isWE(d);
          const total = horasDiaTotal(medicoActivo.id, f);

          return (
            <div
              key={f}
              className="tm-medico-day-card"
              style={{
                ...S.medicoDayCard,
                border: `1px solid ${esHoy ? "#60a5fa" : esFin ? "#374151" : "#1e293b"}`,
                boxShadow: esHoy ? "0 0 0 1px rgba(96,165,250,0.45)" : "none",
              }}
            >
              <div className="tm-medico-day-head" style={S.medicoDayHead}>
                <span className="tm-medico-day-name" style={S.medicoDayName}>
                  {diaLabel(d)}
                </span>

                <span
                  className="tm-medico-day-number"
                  style={{
                    ...S.medicoDayNumber,
                    color: esHoy ? "#60a5fa" : esFin ? "#c4b5fd" : "#e5e7eb",
                  }}
                >
                  {diaNumero(d)}
                </span>
              </div>

              <div className="tm-medico-shift-list" style={S.medicoShiftList}>
                {tipos.length === 0 && (
                  <div className="tm-medico-free-chip" style={S.medicoFreeChip}>
                    🏖️ Libre
                  </div>
                )}

                {tipos.map((tipo) => (
                  <div
                    key={tipo}
                    className="tm-medico-shift-chip"
                    style={S.medicoShiftChip(TIPOS_TURNO[tipo])}
                  >
                    <span>{TIPOS_TURNO[tipo].emoji}</span>
                    <span>{TIPOS_TURNO[tipo].label}</span>
                  </div>
                ))}

                {extra > 0 && (
                  <div className="tm-medico-shift-chip" style={S.medicoExtraChip}>
                    <span>➕</span>
                    <span>{extra}h</span>
                  </div>
                )}
              </div>

              <div className="tm-medico-day-total" style={S.medicoDayTotal}>
                ⏱️ {total}h
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HorasExtraMedico({ medicoExtraForm, setMedicoExtraForm, guardarHorasExtraMedico }) {
  return (
    <div className="tm-card" style={{ ...S.card, marginTop: 18 }}>
      <div style={S.cardHeaderBetween}>
        <div>
          <div style={S.secTitle}>➕ Solicitud de horas extra de fin de semana</div>
          <div style={S.solicitudSub}>
            Reporta las horas adicionales realizadas únicamente en sábado o domingo.
          </div>
        </div>
      </div>

      <div className="tm-grid3" style={S.grid3}>
        <FieldDate
          label="Fecha sábado/domingo"
          value={medicoExtraForm.fecha}
          onChange={(e) =>
            setMedicoExtraForm((p) => ({ ...p, fecha: e.target.value }))
          }
        />

        <Campo label="Horas adicionales">
          <input
            type="number"
            min="0"
            step="0.5"
            value={medicoExtraForm.horas}
            onChange={(e) =>
              setMedicoExtraForm((p) => ({ ...p, horas: e.target.value }))
            }
            style={inputStyle(false)}
            placeholder="Ejemplo: 2"
          />
        </Campo>

        <Campo label="Motivo / observación">
          <input
            value={medicoExtraForm.motivo}
            onChange={(e) =>
              setMedicoExtraForm((p) => ({ ...p, motivo: e.target.value }))
            }
            style={inputStyle(false)}
            placeholder="Ejemplo: apoyo adicional en ronda"
          />
        </Campo>
      </div>

      <button
        type="button"
        onClick={guardarHorasExtraMedico}
        style={{ ...S.primaryButton, marginTop: 12 }}
      >
        Enviar horas extra
      </button>
    </div>
  );
}

function PacientesCargoMedico({
  medicoActivo,
  pacienteForm,
  setPacienteForm,
  pacientesCargo,
  pacientesTodos,
  crearPacienteCargo,
  eliminarPacienteCargo,
  actualizarEstadoPacienteCargo,
}) {
  const pisosAsignados = pisosAsignadosMedico(medicoActivo);
  const piso = pisoMedicoLabel(medicoActivo);
  const pisoSeleccionado = pacienteForm.piso_key || (
    pisosAsignados[0] ? pisoKey(pisosAsignados[0].torre, pisosAsignados[0].piso) : ""
  );
  const pacientesPorPiso = (pacientesTodos || []).reduce((acc, paciente) => {
    const key = `${paciente.torre || "Sin torre"} / ${
      paciente.piso ? String(paciente.piso).toUpperCase() : "Sin piso"
    }`;

    if (!acc[key]) acc[key] = [];
    acc[key].push(paciente);
    return acc;
  }, {});

  return (
    <section style={S.solicitudesMedicoSection}>
      <div style={S.sectionHeader}>
        <div>
          <h2 style={S.sectionTitle}>Pacientes a cargo</h2>
          <p style={S.sectionSub}>
            Lista independiente para tus pisos asignados. Cada medico gestiona su propia lista.
          </p>
        </div>
      </div>

      <div className="tm-card" style={S.card}>
        <div style={S.secTitle}>Agregar paciente</div>

        <div className="tm-grid4" style={S.grid4}>
          <Campo label="Piso del paciente">
            <select
              value={pisoSeleccionado}
              onChange={(e) => setPacienteForm((p) => ({ ...p, piso_key: e.target.value }))}
              style={inputStyle(false)}
            >
              {pisosAsignados.length === 0 && <option value="">Sin pisos asignados</option>}
              {pisosAsignados.map((item) => (
                <option key={pisoKey(item.torre, item.piso)} value={pisoKey(item.torre, item.piso)}>
                  {item.torre} / {String(item.piso).toUpperCase()}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Cama">
            <input
              value={pacienteForm.cama}
              onChange={(e) => setPacienteForm((p) => ({ ...p, cama: e.target.value }))}
              style={inputStyle(false)}
              placeholder="Ej: 701A"
            />
          </Campo>

          <Campo label="Nombre del paciente">
            <input
              value={pacienteForm.nombre_paciente}
              onChange={(e) =>
                setPacienteForm((p) => ({ ...p, nombre_paciente: e.target.value }))
              }
              style={inputStyle(false)}
              placeholder="Nombre completo"
            />
          </Campo>

          <Campo label="Diagnostico">
            <input
              value={pacienteForm.diagnostico}
              onChange={(e) =>
                setPacienteForm((p) => ({ ...p, diagnostico: e.target.value }))
              }
              style={inputStyle(false)}
              placeholder="Diagnostico principal"
            />
          </Campo>

          <Campo label="Pendientes">
            <input
              value={pacienteForm.pendientes}
              onChange={(e) =>
                setPacienteForm((p) => ({ ...p, pendientes: e.target.value }))
              }
              style={inputStyle(false)}
              placeholder="Labs, imagenes, interconsultas..."
            />
          </Campo>

          <Campo label="Estado">
            <select
              value={pacienteForm.estado_paciente}
              onChange={(e) =>
                setPacienteForm((p) => ({ ...p, estado_paciente: e.target.value }))
              }
              style={inputStyle(false)}
            >
              {Object.entries(ESTADOS_PACIENTE).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <button
          type="button"
          onClick={crearPacienteCargo}
          style={{ ...S.primaryButton, marginTop: 12 }}
        >
          Agregar paciente
        </button>
      </div>

      <div className="tm-card" style={S.card}>
        <div style={S.cardHeaderBetween}>
          <div>
            <div style={S.secTitle}>Lista del piso</div>
            <div style={S.metaText}>{piso}</div>
          </div>

          <span style={S.badgeBlue}>
            {pacientesCargo.length} paciente{pacientesCargo.length !== 1 ? "s" : ""}
          </span>
        </div>

        {pacientesCargo.length === 0 && (
          <div style={S.emptyCard}>No hay pacientes registrados en tu lista.</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {pacientesCargo.map((paciente) => (
            <div key={paciente.id} style={S.patientCard}>
              <span style={S.estadoPacienteChip(paciente.estado_paciente)}>
                {estadoPacienteInfo(paciente.estado_paciente).label}
              </span>

              <div style={S.rowBetween}>
                <div>
                  <div style={S.patientBed}>Cama {paciente.cama}</div>
                  <div style={S.patientName}>{paciente.nombre_paciente}</div>
                  <div style={S.metaText}>
                    {paciente.torre || "Sin torre"} /{" "}
                    {paciente.piso ? String(paciente.piso).toUpperCase() : "Sin piso"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => eliminarPacienteCargo(paciente.id)}
                  style={S.adminDeleteBtn}
                >
                  Borrar
                </button>
              </div>

              <div style={S.infoRows}>
                <span>
                  <b>Diagnostico:</b> {paciente.diagnostico || "Sin diagnostico"}
                </span>
                <span>
                  <b>Pendientes:</b> {paciente.pendientes || "Sin pendientes"}
                </span>
              </div>

              <div style={S.patientQuickStates}>
                {Object.entries(ESTADOS_PACIENTE).map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => actualizarEstadoPacienteCargo(paciente.id, key)}
                    style={S.patientStateBtn(key === (paciente.estado_paciente || "activo"), value)}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tm-card" style={S.card}>
        <div style={S.cardHeaderBetween}>
          <div>
            <div style={S.secTitle}>Pacientes de otros pisos</div>
            <div style={S.metaText}>Consulta general por piso y medico responsable</div>
          </div>

          <span style={S.badgeBlue}>
            {(pacientesTodos || []).length} paciente{(pacientesTodos || []).length !== 1 ? "s" : ""}
          </span>
        </div>

        {(pacientesTodos || []).length === 0 && (
          <div style={S.emptyCard}>No hay pacientes registrados por otros medicos.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.entries(pacientesPorPiso).map(([pisoNombre, pacientes]) => (
            <div key={pisoNombre} style={S.patientFloorGroup}>
              <div style={S.patientFloorTitle}>{pisoNombre}</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {pacientes.map((paciente) => {
                  const esPropio = Number(paciente.medico_id) === Number(medicoActivo.id);

                  return (
                    <div key={`todos-${paciente.id}`} style={S.patientCard}>
                      <span style={S.estadoPacienteChip(paciente.estado_paciente)}>
                        {estadoPacienteInfo(paciente.estado_paciente).label}
                      </span>
                      <div style={S.patientBed}>Cama {paciente.cama}</div>
                      <div style={S.patientName}>{paciente.nombre_paciente}</div>
                      <div style={S.metaText}>
                        Dr(a). {paciente.medico_nombre || ""} {paciente.medico_apellido || ""}
                        {esPropio ? " · Mi lista" : ""}
                      </div>

                      <div style={S.infoRows}>
                        <span>
                          <b>Diagnostico:</b> {paciente.diagnostico || "Sin diagnostico"}
                        </span>
                        <span>
                          <b>Pendientes:</b> {paciente.pendientes || "Sin pendientes"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NotificacionesMedico({
  notificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
}) {
  const noLeidas = notificaciones.filter((n) => Number(n.leida || 0) !== 1).length;

  return (
    <section style={S.solicitudesMedicoSection}>
      <div style={S.sectionHeader}>
        <div>
          <h2 style={S.sectionTitle}>Notificaciones</h2>
          <p style={S.sectionSub}>Avisos internos de coordinación y cambios de estado.</p>
        </div>

        <button
          type="button"
          onClick={marcarTodasNotificacionesLeidas}
          disabled={!noLeidas}
          style={{ ...S.secondaryButton, opacity: noLeidas ? 1 : 0.55 }}
        >
          Marcar leídas
        </button>
      </div>

      <div className="tm-card" style={S.card}>
        {notificaciones.length === 0 && (
          <div style={S.emptyCard}>No tienes notificaciones por ahora.</div>
        )}

        <div style={S.notificationList}>
          {notificaciones.map((n) => {
            const leida = Number(n.leida || 0) === 1;

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => marcarNotificacionLeida(n.id)}
                style={S.notificationItem(leida)}
              >
                <div style={S.notificationTitle}>{n.titulo}</div>
                <div style={S.notificationText}>{n.mensaje || "Sin detalle adicional"}</div>
                <div style={S.notificationMeta}>
                  {n.created_at || "Sin fecha"} · {leida ? "Leída" : "Nueva"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ResumenTurnosMedico({
  resumen,
  descargarCuentaCobroMedico,
  enviarCuentaCobroCoordinacion,
}) {
  const filas = [
    { tipo: "DIA", nombre: "Turnos de 8 horas" },
    { tipo: "CENIZO", nombre: "Cenizos de 3 horas" },
    { tipo: "FDS", nombre: "Fines de semana" },
  ];
  const totalBase = filas.reduce((acc, fila) => acc + Number(resumen?.[fila.tipo]?.horas || 0), 0);
  const horasExtra = Number(resumen?.HORAS_EXTRA?.horas || 0);
  const total = totalBase + horasExtra;

  return (
    <div className="tm-card" style={S.card}>
      <div style={S.secTitle}>Resumen de turnos del mes</div>

      <div style={S.summaryTable}>
        <div style={S.summaryHead}>Tipo</div>
        <div style={S.summaryHead}>Cantidad</div>
        <div style={S.summaryHead}>Horas base</div>

        {filas.map((fila) => {
          const tipo = TIPOS_TURNO[fila.tipo];
          const data = resumen?.[fila.tipo] || { cantidad: 0, horas: 0 };

          return (
            <Fragment key={fila.tipo}>
              <div style={S.summaryCell}>
                <span style={S.turnoChip(tipo)}>
                  {tipo.emoji} {fila.nombre}
                </span>
              </div>
              <div style={S.summaryCell}>{data.cantidad}</div>
              <div style={S.summaryCell}>{data.horas}h</div>
            </Fragment>
          );
        })}

        <div style={S.summaryCell}>
          <span style={S.extraChip}>+ Horas adicionales aprobadas</span>
        </div>
        <div style={S.summaryCell}>-</div>
        <div style={S.summaryCell}>{horasExtra}h</div>

        <div style={{ ...S.summaryCell, ...S.summaryTotalCell }}>Total</div>
        <div style={{ ...S.summaryCell, ...S.summaryTotalCell }}>-</div>
        <div style={{ ...S.summaryCell, ...S.summaryTotalCell }}>{total}h</div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button type="button" onClick={descargarCuentaCobroMedico} style={S.primaryButton}>
          Generar cuenta de cobro Excel
        </button>

        <button type="button" onClick={enviarCuentaCobroCoordinacion} style={S.secondaryButton}>
          Enviar cuenta revisada a coordinación
        </button>
      </div>
    </div>
  );
}

function DatosRegistroForm({
  datosRegistroForm,
  setDatosRegistroForm,
  guardarDatosRegistroMedico,
  guardandoDatosRegistro,
  obligatorio = false,
}) {
  return (
    <div className="tm-card" style={S.card}>
      <div style={S.secTitle}>
        {obligatorio ? "Actualiza tus datos de registro médico" : "Datos del registro médico"}
      </div>
      <p style={S.pageSubtitle}>
        {obligatorio
          ? "Esta actualización se solicita una sola vez al primer ingreso."
          : "Mantén tus datos profesionales al día."}
      </p>

      <div className="tm-grid3" style={S.grid3}>
        <Campo label="Registro médico">
          <input
            value={datosRegistroForm.registro_medico}
            onChange={(e) =>
              setDatosRegistroForm((p) => ({ ...p, registro_medico: e.target.value }))
            }
            style={inputStyle(false)}
          />
        </Campo>

        <Campo label="Especialidad">
          <select
            value={datosRegistroForm.especialidad}
            onChange={(e) =>
              setDatosRegistroForm((p) => ({ ...p, especialidad: e.target.value }))
            }
            style={inputStyle(false)}
          >
            <option value="">Seleccione</option>
            {ESPECIALIDADES.map((especialidad) => (
              <option key={especialidad} value={especialidad}>
                {especialidad}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Cargo">
          <select
            value={datosRegistroForm.cargo}
            onChange={(e) => setDatosRegistroForm((p) => ({ ...p, cargo: e.target.value }))}
            style={inputStyle(false)}
          >
            {[
              "Médico Hospitalario",
              "Médico Residente",
              "Médico Especialista",
              "Médico Urgencias",
            ].map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="tm-grid3" style={S.grid3}>
        <Campo label="Teléfono">
          <input
            value={datosRegistroForm.telefono}
            onChange={(e) => setDatosRegistroForm((p) => ({ ...p, telefono: e.target.value }))}
            style={inputStyle(false)}
          />
        </Campo>

        <Campo label="Correo electrónico">
          <input
            type="email"
            value={datosRegistroForm.email}
            onChange={(e) => setDatosRegistroForm((p) => ({ ...p, email: e.target.value }))}
            style={inputStyle(false)}
          />
        </Campo>

        <Campo label="Fecha de ingreso">
          <input
            type="date"
            value={datosRegistroForm.fecha_ingreso}
            onChange={(e) =>
              setDatosRegistroForm((p) => ({ ...p, fecha_ingreso: e.target.value }))
            }
            style={inputStyle(false)}
          />
        </Campo>
      </div>

      <button
        type="button"
        onClick={guardarDatosRegistroMedico}
        disabled={guardandoDatosRegistro}
        style={{ ...S.primaryButton, marginTop: 14, opacity: guardandoDatosRegistro ? 0.65 : 1 }}
      >
        {guardandoDatosRegistro ? "Guardando..." : "Guardar datos"}
      </button>
    </div>
  );
}

function DatosRegistroObligatorio(props) {
  return (
    <section style={S.solicitudesMedicoSection}>
      <PageHeader
        title="Verificación de datos"
        sub="Antes de continuar, confirma tus datos profesionales."
      />
      <DatosRegistroForm {...props} obligatorio />
    </section>
  );
}

function PerfilMedico({
  medicoActivo,
  cambioPassForm,
  setCambioPassForm,
  cambiarPasswordMedico,
  datosRegistroForm,
  setDatosRegistroForm,
  guardarDatosRegistroMedico,
  guardandoDatosRegistro,
}) {
  return (
    <section style={S.solicitudesMedicoSection}>
      <PageHeader title="Mi perfil" sub={`${medicoActivo?.nombre || ""} ${medicoActivo?.apellido || ""}`} />

      <DatosRegistroForm
        datosRegistroForm={datosRegistroForm}
        setDatosRegistroForm={setDatosRegistroForm}
        guardarDatosRegistroMedico={guardarDatosRegistroMedico}
        guardandoDatosRegistro={guardandoDatosRegistro}
      />

      <div className="tm-card" style={S.card}>
        <div style={S.secTitle}>Cambiar contraseña</div>

        <div className="tm-grid3" style={S.grid3}>
          <Campo label="Contraseña actual">
            <input
              type="password"
              value={cambioPassForm.actualPassword}
              onChange={(e) =>
                setCambioPassForm((p) => ({ ...p, actualPassword: e.target.value }))
              }
              style={inputStyle(false)}
            />
          </Campo>

          <Campo label="Nueva contraseña">
            <input
              type="password"
              value={cambioPassForm.nuevaPassword}
              onChange={(e) =>
                setCambioPassForm((p) => ({ ...p, nuevaPassword: e.target.value }))
              }
              style={inputStyle(false)}
            />
          </Campo>

          <Campo label="Confirmar contraseña">
            <input
              type="password"
              value={cambioPassForm.confirmarPassword}
              onChange={(e) =>
                setCambioPassForm((p) => ({ ...p, confirmarPassword: e.target.value }))
              }
              style={inputStyle(false)}
            />
          </Campo>
        </div>

        <button
          type="button"
          onClick={cambiarPasswordMedico}
          style={{ ...S.primaryButton, marginTop: 14 }}
        >
          Actualizar contraseña
        </button>
      </div>
    </section>
  );
}

function CalendarioGlobalMedicos({
  medicos,
  diasProp,
  propYear,
  propMes,
  setPropYear,
  setPropMes,
  navMes,
  getTurnosDia,
}) {
  const offset = lunesPrimeroOffset(diasProp[0]);
  const celdasVacias = Array.from({ length: offset });
  const [detalleDia, setDetalleDia] = useState(null);
  const maxVisibles = 4;

  return (
    <section style={S.solicitudesMedicoSection}>
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.pageTitle}>Calendario global</h1>
          <p style={S.pageSubtitle}>Resumen mensual de todos los médicos de turno.</p>
        </div>
      </div>

      <div style={S.globalMonthBar}>
        <button
          type="button"
          onClick={() => navMes(-1, setPropYear, setPropMes, propYear, propMes)}
          style={S.bnav}
          title="Mes anterior"
        >
          ‹
        </button>
        <div style={S.globalMonthTitle}>
          {capFirst(mesLabel(propYear, propMes))}
        </div>
        <button
          type="button"
          onClick={() => navMes(1, setPropYear, setPropMes, propYear, propMes)}
          style={S.bnav}
          title="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="tm-medico-calendar-wrap" style={S.medicoCalendarWrap}>
        <div style={S.globalCalendarViewport}>
          <div style={S.globalCalendarInner}>
            <div style={S.globalWeekGrid}>
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dia) => (
                <div key={dia} style={S.globalWeekLabel}>
                  {dia}
                </div>
              ))}
            </div>

            <div className="tm-global-calendar-grid" style={S.globalCalendarGrid}>
              {celdasVacias.map((_, index) => (
                <div key={`empty-${index}`} style={S.globalEmptyDay} />
              ))}

              {diasProp.map((d) => {
                const fecha = isoDate(d);
                const esHoy = fecha === HOY_ISO;
                const asignados = medicos
                  .map((med) => ({
                    med,
                    tipos: turnosDiaOrdenados(getTurnosDia(med.id, fecha)),
                  }))
                  .filter((item) => item.tipos.length > 0);
                const visibles = asignados.slice(0, maxVisibles);
                const ocultos = asignados.length - visibles.length;

                return (
                  <div
                    key={fecha}
                    className="tm-medico-day-card"
                    style={{ ...S.globalDayCard, ...(esHoy ? S.globalTodayCard : {}) }}
                  >
                    <div style={S.globalDayHead}>
                      <span style={S.medicoDayName}>{diaLabel(d)}</span>
                      <span style={S.globalDayNumber(esHoy)}>{diaNumero(d)}</span>
                    </div>

                    <div style={S.globalDoctorList}>
                      {asignados.length === 0 && <span style={S.medicoFreeChip}>Libre</span>}
                      {visibles.map(({ med, tipos }) => {
                        const nombre = `${med.nombre || ""} ${med.apellido || ""}`.trim();
                        const detalle = `${nombre} · ${med.especialidad || "Sin especialidad"} · ${tipos
                          .map((tipo) => TIPOS_TURNO[tipo]?.label)
                          .filter(Boolean)
                          .join(" + ")}`;

                        return (
                          <button
                            key={med.id}
                            type="button"
                            title={detalle}
                            onClick={() => setDetalleDia({ fecha, asignados })}
                            style={S.globalDoctorChip}
                          >
                            <Av color={med.color} size={24} fontSize={9}>
                              {med.nombre?.[0]}
                              {med.apellido?.[0]}
                            </Av>
                            <div style={{ minWidth: 0 }}>
                              <div style={S.globalDoctorInitials}>
                                {med.nombre?.[0]}
                                {med.apellido?.[0]}
                              </div>
                              <div style={S.globalDoctorTurns}>
                                {tipos.map((tipo) => TIPOS_TURNO[tipo]?.label).join(" + ")}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {ocultos > 0 && (
                        <button
                          type="button"
                          onClick={() => setDetalleDia({ fecha, asignados })}
                          style={S.globalMoreButton}
                        >
                          +{ocultos} más
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {detalleDia && (
        <div style={S.modalBackdrop} onClick={() => setDetalleDia(null)}>
          <div style={S.globalDetailModal} onClick={(e) => e.stopPropagation()}>
            <div style={S.cardHeaderBetween}>
              <div>
                <div style={S.secTitle}>{fechaBonita(detalleDia.fecha)}</div>
                <div style={S.metaText}>
                  {detalleDia.asignados.length} médico{detalleDia.asignados.length !== 1 ? "s" : ""} de turno
                </div>
              </div>
              <button type="button" onClick={() => setDetalleDia(null)} style={S.smallMutedBtn}>
                Cerrar
              </button>
            </div>

            <div style={S.globalModalList}>
              {detalleDia.asignados.map(({ med, tipos }) => (
                <div key={`modal-${med.id}`} style={S.globalModalRow}>
                  <Av color={med.color} size={34} fontSize={12}>
                    {med.nombre?.[0]}
                    {med.apellido?.[0]}
                  </Av>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.medName}>
                      {med.nombre} {med.apellido}
                    </div>
                    <div style={S.metaText}>{med.especialidad || "Sin especialidad"}</div>
                  </div>
                  <div style={S.globalModalTurns}>
                    {tipos.map((tipo) => (
                      <span key={tipo} style={S.turnoChip(TIPOS_TURNO[tipo])}>
                        {TIPOS_TURNO[tipo].emoji} {TIPOS_TURNO[tipo].label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SolicitudesMedico({
  medicoActivo,
  medicos,
  diasProp,
  getTurnosDia,
  solCambioForm,
  setSolCambioForm,
  solCesionForm,
  setSolCesionForm,
  solHorarioForm,
  setSolHorarioForm,
  enviarSolicitudCambioTurno,
  enviarSolicitudCesionTurno,
  enviarSolicitudHorario,
  solicitudesCambioTurno,
  solicitudesCesionTurno,
  solicitudesHorasExtra,
  solicitudesCuentaCobro,
  solicHorario,
  getMedicoNombre,
}) {
  const misTurnos = useMemo(() => {
    if (!medicoActivo?.id) return [];

    const arr = [];

    diasProp.forEach((d) => {
      const fecha = isoDate(d);
      const tipos = turnosDiaOrdenados(getTurnosDia(medicoActivo.id, fecha));

      tipos.forEach((tipo) => {
        arr.push({
          value: buildTurnoValue(fecha, tipo),
          label: `${fechaBonita(fecha)} · ${TIPOS_TURNO[tipo].emoji} ${TIPOS_TURNO[tipo].label}`,
          fecha,
          tipo,
        });
      });
    });

    return arr;
  }, [diasProp, medicoActivo, getTurnosDia]);

  const medicosDestino = medicos.filter((m) => Number(m.id) !== Number(medicoActivo.id));
  const origenCambio = parseTurnoValue(solCambioForm.turno_origen);
  const origenCesion = parseTurnoValue(solCesionForm.turno_origen);
  const medicoTieneTurno = (medicoId, fecha, tipo) =>
    !!fecha && !!tipo && getTurnosDia(medicoId, fecha).includes(tipo);

  const turnosMedicoDestino = useMemo(() => {
    const medicoId = Number(solCambioForm.medico_destino_id);

    if (!medicoId || !origenCambio.fecha || !origenCambio.tipo) return [];

    const arr = [];

    diasProp.forEach((d) => {
      const fecha = isoDate(d);
      const tipos = turnosDiaOrdenados(getTurnosDia(medicoId, fecha));

      tipos.forEach((tipo) => {
        const mismoTipo = tipo === origenCambio.tipo;
        const solicitantePuedeRecibir = !medicoTieneTurno(medicoActivo.id, fecha, tipo);
        const destinoPuedeRecibir = !medicoTieneTurno(
          medicoId,
          origenCambio.fecha,
          origenCambio.tipo
        );

        if (!mismoTipo || !solicitantePuedeRecibir || !destinoPuedeRecibir) return;

        arr.push({
          value: buildTurnoValue(fecha, tipo),
          label: `${fechaBonita(fecha)} · ${TIPOS_TURNO[tipo].emoji} ${TIPOS_TURNO[tipo].label}`,
        });
      });
    });

    return arr;
  }, [
    solCambioForm.medico_destino_id,
    origenCambio.fecha,
    origenCambio.tipo,
    diasProp,
    getTurnosDia,
    medicoActivo.id,
  ]);

  const medicosReceptoresCompatibles = medicosDestino.filter((m) => {
    if (!origenCesion.fecha || !origenCesion.tipo) return false;
    return !medicoTieneTurno(m.id, origenCesion.fecha, origenCesion.tipo);
  });

  const next = getNextMonthInfo();
  const disponibleHorario = estaEnUltimos7DiasDelMes();
  const cambioListo =
    !!solCambioForm.turno_origen &&
    !!solCambioForm.medico_destino_id &&
    !!solCambioForm.turno_destino;
  const cesionListo = !!solCesionForm.turno_origen && !!solCesionForm.medico_receptor_id;
  const horarioListo = disponibleHorario && !!String(solHorarioForm.mensaje || "").trim();

  const misCambios = solicitudesCambioTurno
    .filter((s) => Number(s.medico_solicitante_id || s.medico_id) === Number(medicoActivo.id))
    .slice(-4)
    .reverse();

  const misCesiones = solicitudesCesionTurno
    .filter((s) => Number(s.medico_solicitante_id || s.medico_id) === Number(medicoActivo.id))
    .slice(-4)
    .reverse();

  const misHorarios = solicHorario
    .filter((s) => Number(s.medico_id || s.medico_solicitante_id) === Number(medicoActivo.id))
    .slice(-4)
    .reverse();

  const misHorasExtra = solicitudesHorasExtra
    .filter((s) => Number(s.medico_id) === Number(medicoActivo.id))
    .slice(-4)
    .reverse();

  const misCuentasCobro = solicitudesCuentaCobro
    .filter((s) => Number(s.medico_id) === Number(medicoActivo.id))
    .slice(-4)
    .reverse();

  return (
    <section style={S.solicitudesMedicoSection}>
      <div style={S.sectionHeader}>
        <div>
          <h2 style={S.sectionTitle}>📬 Solicitudes</h2>
          <p style={S.sectionSub}>
            Envía cambios, cesiones o mensajes de programación a coordinación.
          </p>
        </div>
      </div>

      <div className="tm-solicitudes-grid" style={S.solicitudesGrid}>
        <div className="tm-solicitud-card" style={S.solicitudCard}>
          <div style={S.solicitudTitle}>🔁 Cambio de turno</div>
          <div style={S.solicitudSub}>Propón intercambiar un turno con otro médico.</div>

          <div className="tm-solicitud-row" style={S.solicitudRow}>
            <FieldSelect
              label="Mi turno"
              value={solCambioForm.turno_origen}
              onChange={(e) =>
                setSolCambioForm((p) => ({
                  ...p,
                  turno_origen: e.target.value,
                  turno_destino: "",
                }))
              }
              options={[
                {
                  value: "",
                  label: misTurnos.length ? "— Seleccione —" : "No tienes turnos este mes",
                },
                ...misTurnos.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />

            <FieldSelect
              label="Médico con quien cambia"
              value={solCambioForm.medico_destino_id}
              onChange={(e) =>
                setSolCambioForm((p) => ({
                  ...p,
                  medico_destino_id: e.target.value,
                  turno_destino: "",
                }))
              }
              options={[
                { value: "", label: "— Seleccione —" },
                ...medicosDestino.map((m) => ({
                  value: m.id,
                  label: `${m.nombre} ${m.apellido}`,
                })),
              ]}
            />
          </div>

          <FieldSelect
            label="Turno del otro médico"
            value={solCambioForm.turno_destino}
            onChange={(e) =>
              setSolCambioForm((p) => ({ ...p, turno_destino: e.target.value }))
            }
            options={[
              {
                value: "",
                label: solCambioForm.medico_destino_id
                  ? !solCambioForm.turno_origen
                    ? "Seleccione primero su turno"
                    : turnosMedicoDestino.length
                    ? "— Seleccione turno —"
                    : "No hay turnos compatibles"
                  : "Seleccione primero un médico",
              },
              ...turnosMedicoDestino,
            ]}
          />

          <div style={{ marginTop: 10 }}>
            <Campo label="Mensaje opcional">
              <textarea
                value={solCambioForm.mensaje}
                onChange={(e) =>
                  setSolCambioForm((p) => ({ ...p, mensaje: e.target.value }))
                }
                style={textareaStyle()}
                placeholder="Explique brevemente el motivo del cambio..."
              />
            </Campo>
          </div>

          <button
            type="button"
            onClick={enviarSolicitudCambioTurno}
            disabled={!cambioListo}
            style={{
              ...S.primaryButton,
              marginTop: 12,
              width: "100%",
              opacity: cambioListo ? 1 : 0.55,
              cursor: cambioListo ? "pointer" : "not-allowed",
            }}
          >
            Enviar solicitud de cambio
          </button>
        </div>

        <div className="tm-solicitud-card" style={S.solicitudCard}>
          <div style={S.solicitudTitle}>🤝 Cesión de turno</div>
          <div style={S.solicitudSub}>Solicita ceder uno de tus turnos a otro médico.</div>

          <div className="tm-solicitud-row" style={S.solicitudRow}>
            <FieldSelect
              label="Turno que deseo ceder"
              value={solCesionForm.turno_origen}
              onChange={(e) =>
                setSolCesionForm((p) => ({
                  ...p,
                  turno_origen: e.target.value,
                  medico_receptor_id: "",
                }))
              }
              options={[
                {
                  value: "",
                  label: misTurnos.length ? "— Seleccione —" : "No tienes turnos este mes",
                },
                ...misTurnos.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />

            <FieldSelect
              label="Médico receptor"
              value={solCesionForm.medico_receptor_id}
              onChange={(e) =>
                setSolCesionForm((p) => ({ ...p, medico_receptor_id: e.target.value }))
              }
              options={[
                {
                  value: "",
                  label: solCesionForm.turno_origen
                    ? medicosReceptoresCompatibles.length
                      ? "— Seleccione —"
                      : "No hay receptores compatibles"
                    : "Seleccione primero el turno",
                },
                ...medicosReceptoresCompatibles.map((m) => ({
                  value: m.id,
                  label: `${m.nombre} ${m.apellido}`,
                })),
              ]}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <Campo label="Mensaje opcional">
              <textarea
                value={solCesionForm.mensaje}
                onChange={(e) =>
                  setSolCesionForm((p) => ({ ...p, mensaje: e.target.value }))
                }
                style={textareaStyle()}
                placeholder="Explique brevemente el motivo de la cesión..."
              />
            </Campo>
          </div>

          <button
            type="button"
            onClick={enviarSolicitudCesionTurno}
            disabled={!cesionListo}
            style={{
              ...S.primaryButton,
              marginTop: 12,
              width: "100%",
              opacity: cesionListo ? 1 : 0.55,
              cursor: cesionListo ? "pointer" : "not-allowed",
            }}
          >
            Enviar solicitud de cesión
          </button>
        </div>

        <div className="tm-solicitud-card" style={S.solicitudCard}>
          <div style={S.solicitudTitle}>📝 Solicitud de horario</div>

          <div style={S.solicitudSub}>
            Para programación de <b>{next.label}</b>. Disponible solo durante los últimos 7 días del mes.
          </div>

          <div
            style={{
              ...S.windowBadge,
              background: disponibleHorario ? "#14532d" : "#3d2c00",
              color: disponibleHorario ? "#86efac" : "#facc15",
            }}
          >
            {disponibleHorario
              ? "🟢 Ventana abierta: puedes enviar tu solicitud"
              : "🔒 Se habilita durante los últimos 7 días del mes"}
          </div>

          <Campo label="Mensaje para coordinación">
            <textarea
              value={solHorarioForm.mensaje}
              onChange={(e) =>
                setSolHorarioForm((p) => ({ ...p, mensaje: e.target.value }))
              }
              style={textareaStyle()}
              placeholder="Ejemplo: para el próximo mes solicito evitar los días 10, 11 y 12. Puedo apoyar fines de semana si se requiere..."
              disabled={!disponibleHorario}
            />
          </Campo>

          <button
            type="button"
            onClick={enviarSolicitudHorario}
            style={{
              ...S.primaryButton,
              marginTop: 12,
              width: "100%",
              opacity: horarioListo ? 1 : 0.55,
              cursor: horarioListo ? "pointer" : "not-allowed",
            }}
            disabled={!horarioListo}
          >
            Enviar solicitud de horario
          </button>
        </div>
      </div>

      <div style={S.historialSolicitudes}>
        <div style={S.solicitudTitle}>📌 Mis últimas solicitudes</div>

        {[
          ...misCambios,
          ...misCesiones,
          ...misHorarios,
          ...misHorasExtra,
          ...misCuentasCobro,
        ].length === 0 && (
          <div style={S.emptyCard}>Aún no tienes solicitudes registradas.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {misCambios.map((s) => (
            <MiniSolicitud
              key={`cambio-${s.id}`}
              icon="🔁"
              title="Cambio de turno"
              estado={s.estado}
              comentario={s.comentario_coordinador}
              text={`${fechaBonita(s.fecha_origen)} ${s.tipo_turno_origen || ""} con ${getMedicoNombre(
                s.medico_destino_id
              )}`}
            />
          ))}

          {misCesiones.map((s) => (
            <MiniSolicitud
              key={`cesion-${s.id}`}
              icon="🤝"
              title="Cesión de turno"
              estado={s.estado}
              comentario={s.comentario_coordinador}
              text={`${fechaBonita(s.fecha)} ${s.tipo_turno || ""} hacia ${getMedicoNombre(
                s.medico_receptor_id
              )}`}
            />
          ))}

          {misHorarios.map((s) => (
            <MiniSolicitud
              key={`horario-${s.id}`}
              icon="📝"
              title="Solicitud de horario"
              estado={s.estado}
              comentario={s.comentario_coordinador}
              text={`Programación mes ${s.mes || s.mes_programacion || ""}`}
            />
          ))}

          {misHorasExtra.map((s) => (
            <MiniSolicitud
              key={`horas-extra-${s.id}`}
              icon="+"
              title="Horas extra"
              estado={s.estado}
              comentario={s.comentario_coordinador}
              text={`${fechaBonita(s.fecha)} · ${Number(s.horas || 0)}h`}
            />
          ))}

          {misCuentasCobro.map((s) => (
            <MiniSolicitud
              key={`cuenta-cobro-${s.id}`}
              icon="$"
              title="Cuenta de cobro"
              estado={s.estado}
              comentario={s.comentario_coordinador}
              text={`Mes ${s.mes}/${s.year} · ${Number(s.total_horas || 0)}h`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniSolicitud({ icon, title, text, estado, comentario }) {
  return (
    <div style={S.miniSolicitud}>
      <div style={{ fontSize: 20 }}>{icon}</div>

      <div style={{ flex: 1 }}>
        <div style={S.miniSolicitudTitle}>{title}</div>
        <div style={S.miniSolicitudSub}>{text}</div>
        <ComentarioCoordinador comentario={comentario} />
      </div>

      <span
        style={{
          ...S.chip,
          background: getEstadoBg(estado),
          color: getEstadoColor(estado),
        }}
      >
        {estado || "pendiente"}
      </span>
    </div>
  );
}

function RegistroMedicos({
  medicos,
  form,
  setForm,
  errores,
  editId,
  setEditId,
  setErrores,
  setForm0,
  saving,
  guardarMedico,
  abrirEditar,
  eliminarMedico,
}) {
  return (
    <div className="tm-main-wrap" style={S.mainWrap}>
      <div style={{ flex: "0 0 440px", minWidth: 300 }}>
        <div className="tm-card" style={S.card}>
          <div style={S.cardHeaderBetween}>
            <h2 style={S.cardTitle}>{editId ? "✏️ Editar médico" : "➕ Nuevo médico"}</h2>

            {editId && (
              <button
                type="button"
                onClick={() => {
                  setForm0();
                  setEditId(null);
                  setErrores({});
                }}
                style={S.smallMutedBtn}
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="tm-fg2" style={S.fg2}>
            <Campo label="Nombre *" err={errores.nombre}>
              <input
                style={inputStyle(!!errores.nombre)}
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              />
            </Campo>

            <Campo label="Apellido *" err={errores.apellido}>
              <input
                style={inputStyle(!!errores.apellido)}
                value={form.apellido}
                onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
              />
            </Campo>
          </div>

          <div className="tm-fg2" style={S.fg2}>
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
                onChange={(e) => setForm((p) => ({ ...p, documento: e.target.value }))}
              />
            </Campo>
          </div>

          <Campo label="Especialidad *" err={errores.especialidad}>
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

          <div className="tm-fg2" style={S.fg2}>
            <Campo label="Registro médico *" err={errores.registro_medico}>
              <input
                style={inputStyle(!!errores.registro_medico)}
                value={form.registro_medico}
                onChange={(e) =>
                  setForm((p) => ({ ...p, registro_medico: e.target.value }))
                }
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

          <Campo label="Pisos a cargo *" err={errores.pisos_asignados}>
            <div style={S.floorCheckGrid}>
              {Object.entries(TORRES_PISOS).map(([torre, pisos]) => (
                <div key={torre} style={S.floorCheckGroup}>
                  <div style={S.floorCheckTitle}>{torre}</div>

                  <div style={S.floorCheckItems}>
                    {pisos.map((piso) => {
                      const checked = pisoAsignadoExiste(form.pisos_asignados, torre, piso);

                      return (
                        <label
                          key={pisoKey(torre, piso)}
                          style={{
                            ...S.floorCheckItem,
                            borderColor: checked ? "#2563eb" : "#253350",
                            background: checked ? "#1d4ed822" : "#0f172a",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setForm((prev) => {
                                const pisosAsignados = togglePisoAsignado(
                                  prev.pisos_asignados,
                                  torre,
                                  piso
                                );
                                const principal = pisosAsignados[0] || {};

                                return {
                                  ...prev,
                                  pisos_asignados: pisosAsignados,
                                  torre_asignada: principal.torre || "",
                                  piso_asignado: principal.piso || "",
                                };
                              })
                            }
                          />
                          <span>{piso.toUpperCase()}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Campo>

          <Campo label="Fecha de ingreso *" err={errores.fecha_ingreso}>
            <input
              type="date"
              style={inputStyle(!!errores.fecha_ingreso)}
              value={form.fecha_ingreso}
              onChange={(e) => setForm((p) => ({ ...p, fecha_ingreso: e.target.value }))}
            />
          </Campo>

          <div className="tm-fg2" style={S.fg2}>
            <Campo label="Teléfono *" err={errores.telefono}>
              <input
                style={inputStyle(!!errores.telefono)}
                value={form.telefono}
                onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
              />
            </Campo>

            <Campo label="Correo electrónico *" err={errores.email}>
              <input
                type="email"
                style={inputStyle(!!errores.email)}
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </Campo>
          </div>

          <button type="button" onClick={guardarMedico} disabled={saving} style={S.saveBtn(saving)}>
            {saving ? "Guardando..." : editId ? "💾 Guardar cambios" : "✅ Registrar médico"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={S.listTitle}>Médicos registrados ({medicos.length})</div>

        {medicos.length === 0 && (
          <div className="tm-card" style={S.emptyCard}>Registre médicos para comenzar.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {medicos.map((med) => (
            <div
              key={med.id}
              className="tm-med-card"
              style={{ ...S.medCard, borderLeft: `3px solid ${med.color}` }}
            >
              <Av color={med.color} size={42} fontSize={14}>
                {med.nombre?.[0]}
                {med.apellido?.[0]}
              </Av>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.medName}>
                  {med.nombre} {med.apellido}
                </div>

                <div style={S.textMetaWrap}>
                  <span>🩺 {med.especialidad}</span>
                  <span>
                    📋 {med.tipo_doc} {med.documento}
                  </span>
                  <span>📝 {med.registro_medico}</span>
                </div>

                <div style={S.textMetaWrap}>
                  <span>📧 {med.email}</span>
                  <span>📞 {med.telefono}</span>
                  <span>📅 {med.fecha_ingreso}</span>
                </div>

                <div style={{ marginTop: 5 }}>
                  <span style={S.tagBlue}>{med.cargo}</span>
                  {pisosAsignadosMedico(med).length > 0 && (
                    <span style={{ ...S.tagBlue, marginLeft: 6 }}>
                      {pisoMedicoLabel(med)}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button type="button" onClick={() => abrirEditar(med)} style={S.bEdit}>
                  ✏️
                </button>

                <button type="button" onClick={() => eliminarMedico(med.id)} style={S.bDel}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VistaDashboardCoordinador({
  medicos,
  fecha,
  tarifaHora,
  turnos,
  solicitudesCambioTurno,
  solicitudesCesionTurno,
  solicitudesHorasExtra,
  solicitudesCuentaCobro,
  solicHorario,
  getTurnosDia,
  getHorasExtraDia,
  horasDiaTotal,
  setView,
}) {
  const pendientes = [
    ...solicitudesCambioTurno,
    ...solicitudesCesionTurno,
    ...solicitudesHorasExtra,
    ...solicitudesCuentaCobro,
    ...solicHorario,
  ].filter((s) => s.estado === ESTADOS.PENDIENTE);
  const medicosTurnoHoy = medicos.filter((med) => getTurnosDia(med.id, fecha).length > 0);
  const horasHoy = medicos.reduce((acc, med) => acc + horasDiaTotal(med.id, fecha), 0);
  const extrasPendientes = solicitudesHorasExtra
    .filter((s) => s.estado === ESTADOS.PENDIENTE)
    .reduce((acc, s) => acc + Number(s.horas || 0), 0);
  const cuentasPendientes = solicitudesCuentaCobro.filter((s) => s.estado === ESTADOS.PENDIENTE).length;
  const turnosMes = Object.values(turnos || {}).reduce(
    (acc, lista) => acc + (Array.isArray(lista) ? lista.length : 0),
    0
  );

  return (
    <section>
      <PageHeader
        title="Dashboard"
        sub={`Resumen operativo de coordinación para ${fecha}`}
      />

      <div className="tm-dashboard-grid" style={S.dashboardGrid}>
        <DashboardMetric title="Médicos activos" value={medicos.length} sub="Registrados" />
        <DashboardMetric title="De turno hoy" value={medicosTurnoHoy.length} sub={`${horasHoy}h programadas`} />
        <DashboardMetric title="Solicitudes pendientes" value={pendientes.length} sub="Por revisar" tone="warn" />
        <DashboardMetric title="Horas extra pendientes" value={`${extrasPendientes}h`} sub="Sin aprobar" tone="warn" />
        <DashboardMetric title="Cuentas pendientes" value={cuentasPendientes} sub="Para revisión" />
        <DashboardMetric title="Turnos cargados" value={turnosMes} sub="En la agenda actual" />
      </div>

      <div className="tm-dashboard-columns" style={S.dashboardColumns}>
        <div className="tm-card" style={S.card}>
          <div style={S.cardHeaderBetween}>
            <div>
              <div style={S.secTitle}>Hoy</div>
              <div style={S.metaText}>Médicos programados y valor estimado</div>
            </div>
            <button type="button" onClick={() => setView(VIEWS_COORD.HOY)} style={S.smallMutedBtn}>
              Ver hoy
            </button>
          </div>

          <div style={S.dashboardList}>
            {medicosTurnoHoy.length === 0 && <div style={S.emptyCard}>No hay turnos cargados para hoy.</div>}
            {medicosTurnoHoy.slice(0, 5).map((med) => {
              const tipos = turnosDiaOrdenados(getTurnosDia(med.id, fecha));
              const total = horasDiaTotal(med.id, fecha);

              return (
                <div key={med.id} style={S.dashboardRow}>
                  <Av color={med.color} size={32} fontSize={12}>
                    {med.nombre?.[0]}
                    {med.apellido?.[0]}
                  </Av>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.medName}>
                      {med.nombre} {med.apellido}
                    </div>
                    <div style={S.metaText}>
                      {tipos.map((tipo) => TIPOS_TURNO[tipo]?.label).join(" + ")} · {total}h
                    </div>
                  </div>
                  <span style={S.badgeGreen}>{formatCOP(total * Number(tarifaHora || 0))}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tm-card" style={S.card}>
          <div style={S.cardHeaderBetween}>
            <div>
              <div style={S.secTitle}>Pendientes</div>
              <div style={S.metaText}>Trabajo que necesita decisión</div>
            </div>
            <button type="button" onClick={() => setView(VIEWS_COORD.HORARIOS)} style={S.smallMutedBtn}>
              Revisar
            </button>
          </div>

          <div style={S.dashboardList}>
            <DashboardPending label="Cambios" count={solicitudesCambioTurno.filter((s) => s.estado === ESTADOS.PENDIENTE).length} />
            <DashboardPending label="Cesiones" count={solicitudesCesionTurno.filter((s) => s.estado === ESTADOS.PENDIENTE).length} />
            <DashboardPending label="Horarios" count={solicHorario.filter((s) => s.estado === ESTADOS.PENDIENTE).length} />
            <DashboardPending label="Horas extra" count={solicitudesHorasExtra.filter((s) => s.estado === ESTADOS.PENDIENTE).length} />
            <DashboardPending label="Cuentas de cobro" count={cuentasPendientes} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ComentarioCoordinador({ comentario }) {
  if (!String(comentario || "").trim()) return null;

  return (
    <div style={S.coordinadorComment}>
      <b>Comentario coordinación:</b> {comentario}
    </div>
  );
}

function DashboardMetric({ title, value, sub, tone = "normal" }) {
  return (
    <div className="tm-dashboard-metric" style={S.dashboardMetric(tone)}>
      <div style={S.metricTitle}>{title}</div>
      <div style={S.metricValue}>{value}</div>
      <div style={S.metaText}>{sub}</div>
    </div>
  );
}

function DashboardPending({ label, count }) {
  return (
    <div style={S.dashboardPendingRow}>
      <span>{label}</span>
      <span style={{ ...S.chip, background: count ? "#3d2c00" : "#14532d", color: count ? "#facc15" : "#86efac" }}>
        {count}
      </span>
    </div>
  );
}

function VistaBackup({ descargarBackup, restaurarBackupDesdeArchivo, backupInputRef }) {
  return (
    <section>
      <PageHeader
        title="Backup y recuperación"
        sub="Descarga una copia de seguridad o restaura la información desde un archivo previo."
      />

      <div className="tm-card" style={S.card}>
        <div style={S.backupActions}>
          <button type="button" onClick={descargarBackup} style={S.primaryButton}>
            Descargar backup
          </button>

          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            style={S.secondaryButton}
          >
            Restaurar backup
          </button>

          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => restaurarBackupDesdeArchivo(e.target.files?.[0])}
            style={{ display: "none" }}
          />
        </div>

        <div style={S.warningBox}>
          La restauración reemplaza los datos actuales por los del archivo. Antes de restaurar,
          el servidor guarda una copia local de emergencia de la base de datos.
        </div>
      </div>
    </section>
  );
}

function VistaHoy({ medicos, fecha, tarifaHora, getTurnosDia, getHorasExtraDia, horasDiaTotal }) {
  return (
    <section>
      <PageHeader title="Hoy" sub={`Resumen de turnos para ${fecha}`} />

      <div className="tm-cards-grid" style={S.cardsGrid}>
        {medicos.map((med) => {
          const tipos = turnosDiaOrdenados(getTurnosDia(med.id, fecha));
          const extra = getHorasExtraDia(med.id, fecha);
          const total = horasDiaTotal(med.id, fecha);
          const valorFacturado = total * Number(tarifaHora || 0);

          return (
            <div key={med.id} className="tm-card" style={S.card}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Av color={med.color}>
                  {med.nombre?.[0]}
                  {med.apellido?.[0]}
                </Av>

                <div>
                  <div style={S.medName}>
                    {med.nombre} {med.apellido}
                  </div>
                  <div style={S.metaText}>{med.especialidad}</div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {tipos.length === 0 && <span style={S.turnoLibre}>Libre</span>}

                {tipos.map((tipo) => (
                  <span key={tipo} style={S.turnoChip(TIPOS_TURNO[tipo])}>
                    {TIPOS_TURNO[tipo].emoji} {TIPOS_TURNO[tipo].label}
                  </span>
                ))}

                {extra > 0 && <span style={S.extraChip}>➕ {extra}h extra</span>}
              </div>

              <div style={S.infoRows}>
                <span>Piso asignado: {pisoMedicoLabel(med)}</span>
                <span>Hora de salida: {horaSalidaTurnos(tipos)}</span>
                <span>Horas facturadas hoy: {total}h</span>
                <span>Valor facturado hoy: {formatCOP(valorFacturado)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VistaCalendario({
  medicos,
  diasCoord,
  year,
  month,
  setYear,
  setMonth,
  navMes,
  getTurnosDia,
  getHorasExtraDia,
  horasDiaTotal,
  agregarTurnoCoord,
  eliminarTurnoCoord,
}) {
  const [medicoCalendarioId, setMedicoCalendarioId] = useState("");
  const medicoSeleccionado =
    medicos.find((m) => Number(m.id) === Number(medicoCalendarioId)) || medicos[0] || null;

  useEffect(() => {
    if (!medicos.length) {
      setMedicoCalendarioId("");
      return;
    }

    if (!medicos.some((m) => Number(m.id) === Number(medicoCalendarioId))) {
      setMedicoCalendarioId(String(medicos[0].id));
    }
  }, [medicos, medicoCalendarioId]);

  return (
    <section>
      <div className="tm-page-header" style={S.pageHeader}>
        <div>
          <h1 className="tm-page-title" style={S.pageTitle}>
            📅 Calendario de turnos
          </h1>
          <p style={S.pageSubtitle}>
            Gestión mensual de turnos médicos por profesional y fecha.
          </p>
        </div>
      </div>

      <div style={S.calendarShell}>
        <div style={S.calendarTop}>
          <button
            type="button"
            onClick={() => navMes(-1, setYear, setMonth, year, month)}
            style={S.bnav}
            title="Mes anterior"
          >
            ‹
          </button>

          <div>
            <div className="tm-month-title" style={S.calendarMonthTitle}>
              {capFirst(mesLabel(year, month))}
            </div>
            <div style={S.calendarMonthSub}>🗓️ Vista mensual de programación</div>
          </div>

          <button
            type="button"
            onClick={() => navMes(1, setYear, setMonth, year, month)}
            style={S.bnav}
            title="Mes siguiente"
          >
            ›
          </button>
        </div>

        <div style={S.exportActions}>
          <button
            type="button"
            onClick={() => descargarCalendarioExcel({ y: year, m: month })}
            style={S.secondaryButton}
          >
            Exportar Excel general
          </button>
          <button
            type="button"
            onClick={() =>
              exportarCalendarioPdf({
                y: year,
                m: month,
                dias: diasCoord,
                titulo: "Calendario general de turnos",
              })
            }
            style={S.secondaryButton}
          >
            Exportar PDF general
          </button>
          {medicoSeleccionado && (
            <>
              <button
                type="button"
                onClick={() =>
                  descargarCalendarioExcel({
                    y: year,
                    m: month,
                    medicoId: medicoSeleccionado.id,
                  })
                }
                style={S.secondaryButton}
              >
                Excel médico
              </button>
              <button
                type="button"
                onClick={() =>
                  exportarCalendarioPdf({
                    y: year,
                    m: month,
                    dias: diasCoord,
                    medicoId: medicoSeleccionado.id,
                    titulo: `Calendario de ${medicoSeleccionado.nombre} ${medicoSeleccionado.apellido}`,
                  })
                }
                style={S.secondaryButton}
              >
                PDF médico
              </button>
            </>
          )}
        </div>

        <div style={S.calendarLegend}>
          <span style={{ ...S.legendPill, background: "#1e3a5f", color: "#60a5fa" }}>
            ☀️ Día · 8h
          </span>
          <span style={{ ...S.legendPill, background: "#3d2c00", color: "#fbbf24" }}>
            🌥️ Cenizo · 3h
          </span>
          <span style={{ ...S.legendPill, background: "#2e1b5e", color: "#c4b5fd" }}>
            📅 Fin de semana · 6h
          </span>
          <span style={{ ...S.legendPill, background: "#1f2937", color: "#e5e7eb" }}>
            ➕ Horas extra
          </span>
          <span style={{ ...S.legendPill, background: "#0f172a", color: "#94a3b8" }}>
            🏖️ Libre
          </span>
        </div>

        <div style={S.coordMedicoPanel}>
          <div style={S.coordMedicoTop}>
            <div>
              <div style={S.configTitle}>Programar por medico</div>
              <div style={S.configSub}>
                Elige un medico y asigna sus turnos viendo el mes completo.
              </div>
            </div>

            <select
              value={medicoSeleccionado?.id || ""}
              onChange={(e) => setMedicoCalendarioId(e.target.value)}
              style={{ ...inputStyle(false), minWidth: 240 }}
            >
              {medicos.map((med) => (
                <option key={med.id} value={med.id}>
                  {med.nombre} {med.apellido}
                </option>
              ))}
            </select>
          </div>

          <div style={S.medicoPickerStrip}>
            {medicos.map((med) => {
              const active = Number(med.id) === Number(medicoSeleccionado?.id);

              return (
                <button
                  type="button"
                  key={med.id}
                  onClick={() => setMedicoCalendarioId(String(med.id))}
                  style={S.medicoPickerButton(active)}
                >
                  <Av color={med.color} size={28} fontSize={10}>
                    {med.nombre?.[0]}
                    {med.apellido?.[0]}
                  </Av>
                  <span>
                    {med.nombre} {med.apellido}
                  </span>
                </button>
              );
            })}
          </div>

          {medicoSeleccionado && (
            <CalendarioMedicoCoordinador
              medico={medicoSeleccionado}
              diasCoord={diasCoord}
              getTurnosDia={getTurnosDia}
              getHorasExtraDia={getHorasExtraDia}
              horasDiaTotal={horasDiaTotal}
              agregarTurnoCoord={agregarTurnoCoord}
              eliminarTurnoCoord={eliminarTurnoCoord}
            />
          )}
        </div>

        <div className="tm-calendar-scroll" style={S.calendarScroll}>
          <table className="tm-calendar-table" style={S.calendarTable}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thMedico }}>👨‍⚕️ Médico</th>

                {diasCoord.map((d) => {
                  const f = isoDate(d);
                  const esHoy = f === HOY_ISO;
                  const esFin = isWE(d);

                  return (
                    <th
                      key={f}
                      style={{
                        ...S.th,
                        ...(esHoy ? S.thHoy : {}),
                        ...(esFin ? S.thFinSemana : {}),
                      }}
                    >
                      <div style={S.calendarDayHeader}>
                        <span>{esHoy ? "⭐" : esFin ? "🌙" : "📍"}</span>
                        <span>{diaLabel(d)}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {medicos.map((med) => (
                <tr key={med.id}>
                  <td style={S.tdSticky}>
                    <div style={S.medicoCalendarCell}>
                      <Av color={med.color} size={34} fontSize={12}>
                        {med.nombre?.[0]}
                        {med.apellido?.[0]}
                      </Av>

                      <div style={{ minWidth: 0 }}>
                        <div style={S.medNameSmall}>
                          {med.nombre} {med.apellido}
                        </div>
                        <div style={S.metaTiny}>🩺 {med.especialidad}</div>
                      </div>
                    </div>
                  </td>

                  {diasCoord.map((d) => {
                    const f = isoDate(d);
                    const tipos = turnosDiaOrdenados(getTurnosDia(med.id, f));
                    const extra = getHorasExtraDia(med.id, f);
                    const total = horasDiaTotal(med.id, f);
                    const esHoy = f === HOY_ISO;
                    const esFin = isWE(d);

                    return (
                      <td
                        key={f}
                        style={{
                          ...S.td,
                          ...(esHoy ? S.tdHoy : {}),
                          ...(esFin ? S.tdFinSemana : {}),
                        }}
                      >
                        <div style={S.calendarCellInner}>
                          {tipos.length === 0 && (
                            <div style={S.emptyShift}>
                              <span>🏖️</span>
                              <span>Libre</span>
                            </div>
                          )}

                          {tipos.map((tipo) => (
                            <button
                              type="button"
                              key={tipo}
                              onClick={() => eliminarTurnoCoord(med.id, f, tipo)}
                              style={S.turnoPill(TIPOS_TURNO[tipo])}
                              title="Clic para eliminar turno"
                            >
                              <span>{TIPOS_TURNO[tipo].emoji}</span>
                              <span>{TIPOS_TURNO[tipo].label}</span>
                            </button>
                          ))}

                          {extra > 0 && (
                            <div style={S.extraPill}>
                              <span>➕</span>
                              <span>{extra}h extra</span>
                            </div>
                          )}

                          <div style={S.addSelectWrap}>
                            <span style={S.addSelectLabel}>Agregar</span>

                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  agregarTurnoCoord(med.id, f, e.target.value);
                                }
                              }}
                              style={S.miniSelect}
                            >
                              <option value="">＋</option>

                              {tiposTurnoPermitidosFecha(f)
                                .map((k) => (
                                  <option key={k} value={k}>
                                    {TIPOS_TURNO[k].emoji} {TIPOS_TURNO[k].label}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div style={S.totalPill}>⏱️ {total}h</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CalendarioMedicoCoordinador({
  medico,
  diasCoord,
  getTurnosDia,
  getHorasExtraDia,
  horasDiaTotal,
  agregarTurnoCoord,
  eliminarTurnoCoord,
  descargarCalendarioExcel,
  exportarCalendarioPdf,
}) {
  const celdasVacias = Array.from({ length: lunesPrimeroOffset(diasCoord[0]) });

  return (
    <div className="tm-medico-calendar-wrap" style={{ ...S.medicoCalendarWrap, marginBottom: 0 }}>
      <div className="tm-medico-week-row">
        {["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"].map((d) => (
          <div key={d} className="tm-medico-week-label">
            {d}
          </div>
        ))}
      </div>

      <div className="tm-medico-calendar-grid" style={S.medicoCalendarGrid}>
        {celdasVacias.map((_, index) => (
          <div key={`empty-${index}`} style={S.medicoEmptyDay} />
        ))}

        {diasCoord.map((d) => {
          const f = isoDate(d);
          const tipos = turnosDiaOrdenados(getTurnosDia(medico.id, f));
          const extra = getHorasExtraDia(medico.id, f);
          const total = horasDiaTotal(medico.id, f);
          const esHoy = f === HOY_ISO;
          const esFin = isWE(d);

          return (
            <div
              key={f}
              className="tm-medico-day-card"
              style={{
                ...S.medicoDayCard,
                border: `1px solid ${esHoy ? "#60a5fa" : esFin ? "#374151" : "#1e293b"}`,
                boxShadow: esHoy ? "0 0 0 1px rgba(96,165,250,0.45)" : "none",
              }}
            >
              <div className="tm-medico-day-head" style={S.medicoDayHead}>
                <span className="tm-medico-day-name" style={S.medicoDayName}>
                  {diaLabel(d)}
                </span>

                <span
                  className="tm-medico-day-number"
                  style={{
                    ...S.medicoDayNumber,
                    color: esHoy ? "#60a5fa" : esFin ? "#c4b5fd" : "#e5e7eb",
                  }}
                >
                  {diaNumero(d)}
                </span>
              </div>

              <div className="tm-medico-shift-list" style={S.medicoShiftList}>
                {tipos.length === 0 && (
                  <div className="tm-medico-free-chip" style={S.medicoFreeChip}>
                    Libre
                  </div>
                )}

                {tipos.map((tipo) => (
                  <button
                    type="button"
                    key={tipo}
                    onClick={() => eliminarTurnoCoord(medico.id, f, tipo)}
                    className="tm-medico-shift-chip"
                    style={{ ...S.medicoShiftChip(TIPOS_TURNO[tipo]), cursor: "pointer" }}
                    title="Clic para quitar este turno"
                  >
                    <span>{TIPOS_TURNO[tipo].emoji}</span>
                    <span>{TIPOS_TURNO[tipo].label}</span>
                  </button>
                ))}

                {extra > 0 && (
                  <div className="tm-medico-shift-chip" style={S.medicoExtraChip}>
                    <span>+</span>
                    <span>{extra}h</span>
                  </div>
                )}
              </div>

              <div style={S.coordDayActions}>
                {tiposTurnoPermitidosFecha(f)
                  .map((tipo) => {
                    const disabled = tipos.includes(tipo);

                    return (
                      <button
                        type="button"
                        key={tipo}
                        onClick={() => agregarTurnoCoord(medico.id, f, tipo)}
                        disabled={disabled}
                        style={S.quickShiftButton(TIPOS_TURNO[tipo], disabled)}
                        title={disabled ? "Turno ya asignado" : `Agregar ${TIPOS_TURNO[tipo].label}`}
                      >
                        {TIPOS_TURNO[tipo].emoji}
                      </button>
                    );
                  })}
              </div>

              <div className="tm-medico-day-total" style={S.medicoDayTotal}>
                {total}h
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VistaMedicos({
  medicos,
  usuarios,
  userForm,
  setUserForm,
  adminForm,
  setAdminForm,
  resetPassForm,
  setResetPassForm,
  crearUsuarioMedico,
  crearAdministrador,
  resetearPasswordUsuario,
  eliminarAdministrador,
  getUsuarioMedico,
  usuarioDisponible,
  usuarioSesion,
  horasMes,
  salarioMes,
  year,
  month,
  setPantalla,
  extraForm,
  setExtraForm,
  guardarHorasAdicionales,
}) {
  const administradores = usuarios.filter(
    (u) => u.rol === "coordinador" || u.rol === "administrador"
  );
  const puedeCrearAdministrador = administradores.length < 2;
  const medicoTieneAdmin = (medico) =>
    administradores.some(
      (u) =>
        Number(u.medico_id) === Number(medico.id) ||
        String(u.cedula || "") === String(medico.documento || "")
    );
  const medicosSinAdmin = medicos.filter((m) => !medicoTieneAdmin(m));

  return (
    <section>
      <PageHeader
        title="Médicos y usuarios"
        sub="Usuarios, accesos, administradores, horas adicionales y resumen mensual"
        action={
          <button type="button" onClick={() => setPantalla(PANTALLAS.REGISTRO)} style={S.primaryButton}>
            Gestionar médicos
          </button>
        }
      />

      <div className="tm-card" style={S.card}>
        <div style={S.secTitle}>Crear otro administrador</div>

        <div className="tm-grid4" style={S.grid4}>
          <Campo label="Medico registrado">
            <select
              value={adminForm.medico_id}
              onChange={(e) => {
                const medico_id = e.target.value;
                const medico = medicos.find((m) => Number(m.id) === Number(medico_id));

                setAdminForm((p) => ({
                  ...p,
                  medico_id,
                  nombre: medico ? `${medico.nombre || ""} ${medico.apellido || ""}`.trim() : "",
                  cedula: medico ? String(medico.documento || "") : "",
                  username: medico ? usuarioDisponible(medico.documento || "", "admin") : "",
                }));
              }}
              style={inputStyle(false)}
            >
              <option value="">-- Seleccione --</option>
              {medicosSinAdmin.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} {m.apellido} - {m.documento}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Usuario">
            <input
              value={adminForm.username}
              onChange={(e) => setAdminForm((p) => ({ ...p, username: e.target.value }))}
              style={inputStyle(false)}
              placeholder="Puede ser la misma cédula"
            />
          </Campo>

          <Campo label="Contraseña">
            <input
              type="text"
              value={adminForm.password}
              onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))}
              style={inputStyle(false)}
              placeholder="Contraseña"
            />
          </Campo>
        </div>

        <button
          type="button"
          onClick={crearAdministrador}
          disabled={!puedeCrearAdministrador}
          style={{
            ...S.primaryButton,
            marginTop: 12,
            opacity: puedeCrearAdministrador ? 1 : 0.45,
            cursor: puedeCrearAdministrador ? "pointer" : "not-allowed",
          }}
        >
          Crear administrador
        </button>

        <div style={{ marginTop: 18 }}>
          <div style={S.miniTitle}>Administradores registrados</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {administradores.map((u) => (
              <div key={u.id} className="tm-admin-row" style={S.adminRow}>
                <span>{u.nombre || u.username}</span>
                <span>Cédula {u.cedula || "sin cédula"}</span>
                <span>{u.rol}</span>
                <button
                  type="button"
                  onClick={() => eliminarAdministrador(u.id)}
                  disabled={administradores.length <= 1}
                  style={{
                    ...S.adminDeleteBtn,
                    opacity: administradores.length <= 1 ? 0.45 : 1,
                    cursor: administradores.length <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tm-card" style={S.card}>
        <div style={S.secTitle}>Crear acceso para médico</div>

        <div className="tm-grid3" style={S.grid3}>
          <FieldSelect
            label="Médico"
            value={userForm.medico_id}
            onChange={(e) => {
              const medico_id = e.target.value;
              const medico = medicos.find((m) => Number(m.id) === Number(medico_id));

              setUserForm((p) => ({
                ...p,
                medico_id,
                username: medico ? usuarioDisponible(medico.documento || "", "medico") : "",
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

          <Campo label="Usuario">
            <input
              value={userForm.username}
              onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
              style={inputStyle(false)}
            />
          </Campo>

          <Campo label="Contraseña inicial">
            <input
              type="text"
              value={userForm.password}
              onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
              style={inputStyle(false)}
            />
          </Campo>
        </div>

        <button type="button" onClick={crearUsuarioMedico} style={{ ...S.primaryButton, marginTop: 12 }}>
          Crear acceso
        </button>
      </div>

      <div className="tm-card" style={S.card}>
        <div style={S.secTitle}>Resetear contraseña</div>

        <div className="tm-grid3" style={S.grid3}>
          <FieldSelect
            label="Usuario médico"
            value={resetPassForm.usuario_id}
            onChange={(e) =>
              setResetPassForm((p) => ({ ...p, usuario_id: e.target.value }))
            }
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

          <Campo label="Nueva contraseña">
            <input
              type="text"
              value={resetPassForm.nuevaPassword}
              onChange={(e) =>
                setResetPassForm((p) => ({ ...p, nuevaPassword: e.target.value }))
              }
              style={inputStyle(false)}
            />
          </Campo>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" onClick={resetearPasswordUsuario} style={S.primaryButton}>
              Cambiar contraseña
            </button>
          </div>
        </div>
      </div>

      <div className="tm-card" style={S.card}>
        <div style={S.secTitle}>Horas adicionales</div>

        <div className="tm-grid4" style={S.grid4}>
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

          <Campo label="Horas">
            <input
              type="number"
              min="0"
              value={extraForm.horas}
              onChange={(e) => setExtraForm((p) => ({ ...p, horas: e.target.value }))}
              style={inputStyle(false)}
            />
          </Campo>

          <Campo label="Motivo">
            <input
              value={extraForm.motivo}
              onChange={(e) => setExtraForm((p) => ({ ...p, motivo: e.target.value }))}
              style={inputStyle(false)}
            />
          </Campo>
        </div>

        <button
          type="button"
          onClick={guardarHorasAdicionales}
          style={{ ...S.primaryButton, marginTop: 12 }}
        >
          Guardar horas
        </button>
      </div>

      <div className="tm-cards-grid" style={S.cardsGrid}>
        {medicos.map((med) => {
          const usuario = getUsuarioMedico(med.id);
          const horas = horasMes(med.id, year, month);
          const salario = salarioMes(med.id, year, month);

          return (
            <div key={med.id} className="tm-card" style={S.card}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Av color={med.color}>
                  {med.nombre?.[0]}
                  {med.apellido?.[0]}
                </Av>

                <div>
                  <div style={S.medName}>
                    {med.nombre} {med.apellido}
                  </div>

                  <div style={S.metaText}>{med.especialidad}</div>
                </div>
              </div>

              <div style={S.infoRows}>
                <div>Usuario: {usuario ? usuario.username : "Sin acceso creado"}</div>
                <div>Horas mes: {horas}h</div>
                <div>Estimado: {formatCOP(salario)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VistaSolicitudes({
  solicHorario,
  solicitudesCambioTurno,
  solicitudesCesionTurno,
  solicitudesHorasExtra,
  solicitudesCuentaCobro,
  medicos,
  getMedicoNombre,
  cambiarEstadoSolicitud,
  descargarCuentaCobroAdmin,
}) {
  const pendientesCambio = solicitudesCambioTurno.filter((s) => s.estado === ESTADOS.PENDIENTE);
  const pendientesCesion = solicitudesCesionTurno.filter((s) => s.estado === ESTADOS.PENDIENTE);
  const pendientesHorario = solicHorario.filter((s) => s.estado === ESTADOS.PENDIENTE);
  const pendientesHorasExtra = solicitudesHorasExtra.filter((s) => s.estado === ESTADOS.PENDIENTE);
  const pendientesCuentaCobro = solicitudesCuentaCobro.filter((s) => s.estado === ESTADOS.PENDIENTE);

  return (
    <section>
      <PageHeader
        title="Solicitudes médicas"
        sub="Solicitudes de cambio, cesión y programación enviadas por los médicos"
      />

      <div className="tm-cards-grid" style={S.cardsGrid}>
        <SolicitudBox title="Cambios pendientes" count={pendientesCambio.length} icon="🔁" />
        <SolicitudBox title="Cesiones pendientes" count={pendientesCesion.length} icon="🤝" />
        <SolicitudBox title="Horarios pendientes" count={pendientesHorario.length} icon="📝" />
        <SolicitudBox title="Horas extra pendientes" count={pendientesHorasExtra.length} icon="+" />
        <SolicitudBox title="Cuentas pendientes" count={pendientesCuentaCobro.length} icon="$" />
      </div>

      <SolicitudAdminGrupo
        titulo="Cuentas de cobro enviadas"
        vacio="No hay cuentas de cobro enviadas."
        solicitudes={solicitudesCuentaCobro}
        tipo="cuenta_cobro"
        getMedicoNombre={getMedicoNombre}
        cambiarEstadoSolicitud={cambiarEstadoSolicitud}
        renderDetalle={(s) => (
          <>
            <div>
              <b>Médico:</b> {getMedicoNombre(s.medico_id)}
            </div>
            <div>
              <b>Periodo:</b> {s.mes}/{s.year}
            </div>
            <div>
              <b>Total reportado:</b> {Number(s.total_horas || 0)}h
            </div>
            <button
              type="button"
              onClick={() => descargarCuentaCobroAdmin(s.medico_id, s.year, s.mes)}
              style={{ ...S.secondaryButton, marginTop: 8 }}
            >
              Descargar Excel
            </button>
          </>
        )}
      />

      <SolicitudAdminGrupo
        titulo="Solicitudes de horas extra"
        vacio="No hay solicitudes de horas extra registradas."
        solicitudes={solicitudesHorasExtra}
        tipo="horas_extra"
        getMedicoNombre={getMedicoNombre}
        cambiarEstadoSolicitud={cambiarEstadoSolicitud}
        renderDetalle={(s) => (
          <>
            <div>
              <b>Médico:</b> {getMedicoNombre(s.medico_id)}
            </div>
            <div>
              <b>Fecha:</b> {fechaBonita(s.fecha)}
            </div>
            <div>
              <b>Horas solicitadas:</b> {Number(s.horas || 0)}h
            </div>
            {s.motivo && (
              <div>
                <b>Motivo:</b> {s.motivo}
              </div>
            )}
          </>
        )}
      />

      <SolicitudAdminGrupo
        titulo="🔁 Solicitudes de cambio de turno"
        vacio="No hay solicitudes de cambio registradas."
        solicitudes={solicitudesCambioTurno}
        tipo="cambio"
        getMedicoNombre={getMedicoNombre}
        cambiarEstadoSolicitud={cambiarEstadoSolicitud}
        renderDetalle={(s) => (
          <>
            <div>
              <b>Solicitante:</b> {getMedicoNombre(s.medico_solicitante_id || s.medico_id)}
            </div>
            <div>
              <b>Turno origen:</b> {fechaBonita(s.fecha_origen)} · {s.tipo_turno_origen}
            </div>
            <div>
              <b>Cambia con:</b> {getMedicoNombre(s.medico_destino_id)}
            </div>
            <div>
              <b>Turno destino:</b> {fechaBonita(s.fecha_destino)} · {s.tipo_turno_destino}
            </div>
            {s.mensaje && (
              <div>
                <b>Mensaje:</b> {s.mensaje}
              </div>
            )}
          </>
        )}
      />

      <SolicitudAdminGrupo
        titulo="🤝 Solicitudes de cesión de turno"
        vacio="No hay solicitudes de cesión registradas."
        solicitudes={solicitudesCesionTurno}
        tipo="cesion"
        getMedicoNombre={getMedicoNombre}
        cambiarEstadoSolicitud={cambiarEstadoSolicitud}
        renderDetalle={(s) => (
          <>
            <div>
              <b>Solicitante:</b> {getMedicoNombre(s.medico_solicitante_id || s.medico_id)}
            </div>
            <div>
              <b>Turno a ceder:</b> {fechaBonita(s.fecha)} · {s.tipo_turno}
            </div>
            <div>
              <b>Receptor:</b> {getMedicoNombre(s.medico_receptor_id)}
            </div>
            {s.mensaje && (
              <div>
                <b>Mensaje:</b> {s.mensaje}
              </div>
            )}
          </>
        )}
      />

      <SolicitudAdminGrupo
        titulo="📝 Solicitudes de horario del próximo mes"
        vacio="No hay solicitudes de horario registradas."
        solicitudes={solicHorario}
        tipo="horario"
        getMedicoNombre={getMedicoNombre}
        cambiarEstadoSolicitud={cambiarEstadoSolicitud}
        renderDetalle={(s) => (
          <>
            <div>
              <b>Médico:</b> {getMedicoNombre(s.medico_id || s.medico_solicitante_id)}
            </div>
            <div>
              <b>Mes solicitado:</b> {s.mes || s.mes_programacion || "No especificado"}{" "}
              {s.year || ""}
            </div>
            {s.mensaje && (
              <div>
                <b>Mensaje:</b> {s.mensaje}
              </div>
            )}
          </>
        )}
      />
    </section>
  );
}

function SolicitudAdminGrupo({
  titulo,
  vacio,
  solicitudes,
  tipo,
  cambiarEstadoSolicitud,
  renderDetalle,
}) {
  return (
    <div className="tm-card" style={S.card}>
      <div style={S.secTitle}>{titulo}</div>

      {solicitudes.length === 0 && <div style={S.emptyCard}>{vacio}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {solicitudes.map((s) => {
          const estado = s.estado || ESTADOS.PENDIENTE;
          const pendiente = estado === ESTADOS.PENDIENTE;

          return (
            <div key={`${tipo}-${s.id}`} style={S.requestCard(getEstadoColor(estado))}>
              <div style={S.rowBetween}>
                <div style={{ flex: 1 }}>
                  <div style={S.reqTitle}>Solicitud #{s.id}</div>

                  <div style={S.reqSub}>
                    Estado: {estado} · Fecha solicitud:{" "}
                    {s.fecha_solicitud || s.created_at || "N/A"}
                  </div>

                  <div style={S.reqDetails}>
                    {renderDetalle(s)}
                    <ComentarioCoordinador comentario={s.comentario_coordinador} />
                  </div>
                </div>

                <span
                  style={{
                    ...S.chip,
                    background: getEstadoBg(estado),
                    color: getEstadoColor(estado),
                  }}
                >
                  {estado}
                </span>
              </div>

              {pendiente && (
                <div style={S.requestActions}>
                  <button
                    type="button"
                    onClick={() => cambiarEstadoSolicitud(tipo, s.id, "aprobar")}
                    style={S.approveBtn}
                  >
                    ✅ Aprobar
                  </button>

                  <button
                    type="button"
                    onClick={() => cambiarEstadoSolicitud(tipo, s.id, "rechazar")}
                    style={S.rejectBtn}
                  >
                    ❌ Rechazar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SolicitudBox({ title, count, icon }) {
  return (
    <div className="tm-card" style={S.card}>
      <div style={S.configTitle}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "#f1f5f9", marginTop: 10 }}>
        {count}
      </div>
    </div>
  );
}

function PageHeader({ title, sub, action }) {
  return (
    <div className="tm-page-header" style={S.pageHeader}>
      <div>
        <h1 className="tm-page-title" style={S.pageTitle}>
          {title}
        </h1>
        <p style={S.pageSubtitle}>{sub}</p>
      </div>

      {action}
    </div>
  );
}

/* ============================================================================
   ESTILOS
============================================================================ */
const S = {
  pageCenter: {
    minHeight: "100vh",
    background: "#020617",
    color: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    padding: "24px 24px 64px",
    boxSizing: "border-box",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  page: {
    minHeight: "100vh",
    background: "#020617",
    color: "#f1f5f9",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  creditBadge: {
    position: "fixed",
    bottom: 12,
    left: 12,
    zIndex: 20,
    maxWidth: "calc(100vw - 24px)",
    background: "rgba(15, 23, 42, 0.86)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 999,
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.4,
    padding: "7px 11px",
    backdropFilter: "blur(8px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.24)",
  },

  appTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: "#f1f5f9",
    letterSpacing: "-1px",
  },

  appSub: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 6,
  },

  loginCard: {
    width: "100%",
    maxWidth: 420,
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 20px 70px rgba(0,0,0,0.35)",
    boxSizing: "border-box",
  },

  loginTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 24,
    background: "#020617",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 5,
  },

  loginTab: (active) => ({
    border: "none",
    borderRadius: 8,
    padding: "10px 12px",
    background: active ? "#2563eb" : "transparent",
    color: active ? "#fff" : "#94a3b8",
    fontWeight: 800,
    cursor: "pointer",
  }),

  loginIcon: {
    textAlign: "center",
    fontSize: 44,
    marginBottom: 10,
  },

  loginTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: 900,
    color: "#f1f5f9",
  },

  loginSub: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 24,
  },

  lbl: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },

  errText: {
    color: "#f87171",
    fontSize: 12,
    marginBottom: 12,
  },

  loginBtn: {
    width: "100%",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 4,
  },

  primaryButton: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    background: "#111827",
    color: "#bfdbfe",
    border: "1px solid #2563eb",
    borderRadius: 9,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },

  backupActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  exportActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
  },

  warningBox: {
    marginTop: 14,
    background: "#3d2c00",
    border: "1px solid #854d0e",
    color: "#fde68a",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 800,
  },

  approveBtn: {
    background: "#14532d",
    color: "#86efac",
    border: "1px solid #166534",
    borderRadius: 9,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  rejectBtn: {
    background: "#450a0a",
    color: "#fecaca",
    border: "1px solid #7f1d1d",
    borderRadius: 9,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  toast: {
    position: "fixed",
    top: 18,
    right: 18,
    color: "white",
    borderRadius: 10,
    padding: "12px 16px",
    zIndex: 9999,
    fontSize: 13,
    fontWeight: 800,
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
  },

  cardRestrict: {
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 28,
    maxWidth: 420,
    textAlign: "center",
  },

  restrictTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#f1f5f9",
    marginBottom: 8,
  },

  restrictText: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
    marginBottom: 20,
  },

  portalHeader: {
    height: 68,
    borderBottom: "1px solid #1e293b",
    background: "#0b1528",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
  },

  headerName: {
    fontSize: 14,
    fontWeight: 900,
    color: "#f1f5f9",
  },

  headerSub: {
    fontSize: 11,
    color: "#64748b",
  },

  logoutBtn: {
    background: "#111827",
    border: "1px solid #374151",
    color: "#f1f5f9",
    borderRadius: 9,
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 800,
  },

  medicoWrap: {
    maxWidth: 1080,
    margin: "0 auto",
    padding: "28px 24px",
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#f1f5f9",
    margin: 0,
  },

  pageSubtitle: {
    color: "#64748b",
    fontSize: 13,
    margin: "6px 0 20px",
  },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
  },

  monthSelector: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  medicoTopTabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: 6,
    marginBottom: 22,
  },

  medicoTab: (active) => ({
    background: active ? "#2563eb" : "#111827",
    color: active ? "#fff" : "#94a3b8",
    border: `1px solid ${active ? "#3b82f6" : "#1f2937"}`,
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  }),

  bnav: {
    background: "#0b1528",
    border: "1px solid #1e293b",
    color: "#f1f5f9",
    borderRadius: 9,
    width: 38,
    height: 36,
    fontSize: 22,
    cursor: "pointer",
  },

  monthTitle: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: 900,
    minWidth: 180,
    textTransform: "capitalize",
  },

  badgeBlue: {
    background: "#1e3a5f",
    color: "#60a5fa",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },

  badgeGreen: {
    background: "#14532d",
    color: "#4ade80",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },

  legend: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  chip: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
  },

  summaryTable: {
    display: "grid",
    gridTemplateColumns: "minmax(160px, 1fr) 110px 120px",
    gap: 1,
    background: "#1e293b",
    border: "1px solid #1e293b",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 10,
  },

  summaryHead: {
    background: "#0b1528",
    color: "#bfdbfe",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 900,
  },

  summaryCell: {
    background: "#111827",
    color: "#e5e7eb",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
  },

  summaryTotalCell: {
    background: "#0b1528",
    color: "#f8fafc",
    fontWeight: 950,
  },

  floorCheckGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 10,
  },

  floorCheckGroup: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 8,
    padding: 10,
  },

  floorCheckTitle: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 8,
  },

  floorCheckItems: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },

  floorCheckItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid #253350",
    borderRadius: 8,
    padding: "7px 9px",
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  medicoCalendarWrap: {
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: 14,
    marginBottom: 22,
  },

  medicoCalendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 10,
  },

  medicoEmptyDay: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    minHeight: 118,
    opacity: 0.2,
  },

  globalMonthBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  globalMonthTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: 950,
    minWidth: 180,
    textAlign: "center",
    textTransform: "capitalize",
  },

  globalCalendarViewport: {
    overflowX: "auto",
    paddingBottom: 4,
  },

  globalCalendarInner: {
    minWidth: 860,
  },

  globalWeekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 8,
  },

  globalCalendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
  },

  globalWeekLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: 900,
    textAlign: "center",
  },

  globalEmptyDay: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 10,
    minHeight: 132,
    opacity: 0.25,
  },

  globalDayCard: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 8,
    minHeight: 132,
    overflow: "hidden",
  },

  globalTodayCard: {
    border: "1px solid #60a5fa",
    boxShadow: "0 0 0 1px rgba(96, 165, 250, 0.45), 0 0 24px rgba(59, 130, 246, 0.28)",
  },

  globalDayHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  globalDayNumber: (active) => ({
    color: active ? "#020617" : "#e5e7eb",
    background: active ? "#60a5fa" : "transparent",
    borderRadius: 999,
    minWidth: 26,
    height: 26,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 950,
  }),

  globalDoctorList: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  globalDoctorChip: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 9,
    color: "#e5e7eb",
    padding: "5px 6px",
    minWidth: 0,
    width: "100%",
    minHeight: 36,
    textAlign: "left",
    cursor: "pointer",
  },

  globalDoctorInitials: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: 900,
  },

  globalDoctorTurns: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  globalMoreButton: {
    background: "#12315a",
    color: "#bfdbfe",
    border: "1px solid #2563eb",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    width: "100%",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.72)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  globalDetailModal: {
    width: "min(640px, 100%)",
    maxHeight: "82vh",
    overflowY: "auto",
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
  },

  globalModalList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 14,
  },

  globalModalRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 10,
  },

  globalModalTurns: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  medicoDayCard: {
    background: "#111827",
    borderRadius: 12,
    padding: 10,
    minHeight: 118,
    minWidth: 0,
    overflow: "hidden",
  },

  medicoDayHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  medicoDayName: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "capitalize",
  },

  medicoDayNumber: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: 900,
  },

  medicoShiftList: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 0,
  },

  medicoFreeChip: {
    background: "#020617",
    color: "#94a3b8",
    border: "1px dashed #334155",
    borderRadius: 8,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 800,
    display: "flex",
    gap: 4,
    minWidth: 0,
    overflow: "hidden",
  },

  medicoShiftChip: (tipo) => ({
    background: tipo.bg,
    color: tipo.color,
    borderRadius: 8,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 4,
    border: `1px solid ${tipo.color}33`,
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    justifyContent: "center",
  }),

  medicoExtraChip: {
    background: "#1f2937",
    color: "#e5e7eb",
    borderRadius: 8,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 4,
    border: "1px solid #374151",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    justifyContent: "center",
  },

  medicoDayTotal: {
    marginTop: 8,
    paddingTop: 6,
    borderTop: "1px solid #1f2937",
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 900,
  },

  coordMedicoPanel: {
    background: "#081120",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  coordMedicoTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },

  medicoPickerStrip: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 8,
    marginBottom: 12,
  },

  medicoPickerButton: (active) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
    border: `1px solid ${active ? "#3b82f6" : "#1f2937"}`,
    background: active ? "#1e3a5f" : "#111827",
    color: active ? "#bfdbfe" : "#cbd5e1",
    borderRadius: 10,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  }),

  coordDayActions: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 4,
    marginTop: 8,
    width: "100%",
    minWidth: 0,
  },

  quickShiftButton: (tipo, disabled) => ({
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    background: disabled ? "#111827" : tipo.bg,
    color: disabled ? "#475569" : tipo.color,
    border: `1px solid ${disabled ? "#1f2937" : `${tipo.color}55`}`,
    borderRadius: 7,
    minHeight: 28,
    padding: 0,
    fontSize: 12,
    lineHeight: 1,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  }),

  turnoLibre: {
    background: "#111827",
    color: "#94a3b8",
    borderRadius: 7,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 800,
  },

  turnoChip: (tipo) => ({
    background: tipo.bg,
    color: tipo.color,
    borderRadius: 7,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  }),

  extraChip: {
    background: "#1f2937",
    color: "#f1f5f9",
    borderRadius: 7,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 900,
  },

  coordLayout: {
    minHeight: "100vh",
    background: "#020617",
    color: "#f1f5f9",
    display: "flex",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  sidebar: {
    width: 245,
    background: "#0b1528",
    borderRight: "1px solid #1e293b",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },

  sidebarTop: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginBottom: 24,
  },

  sidebarTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#f1f5f9",
  },

  sidebarSub: {
    fontSize: 10,
    color: "#64748b",
  },

  sideNav: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  sideBtn: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    background: active ? "#1e3a5f" : "transparent",
    border: `1px solid ${active ? "#2563eb" : "transparent"}`,
    color: active ? "#bfdbfe" : "#94a3b8",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 800,
    textAlign: "left",
  }),

  sideBadge: {
    background: "#ef4444",
    color: "#fff",
    borderRadius: 999,
    padding: "2px 7px",
    fontSize: 11,
    fontWeight: 900,
  },

  sidebarBottom: {
    marginTop: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  sideLogout: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    color: "#fecaca",
    borderRadius: 9,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 800,
  },

  sideSecondary: {
    background: "#111827",
    border: "1px solid #374151",
    color: "#f1f5f9",
    borderRadius: 9,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 800,
  },

  sidebarCount: {
    fontSize: 11,
    color: "#475569",
    marginTop: 6,
    paddingLeft: 2,
  },

  coordMain: {
    flex: 1,
    padding: 24,
    overflow: "auto",
  },

  configCard: {
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
  },

  configTitle: {
    color: "#f1f5f9",
    fontWeight: 900,
    fontSize: 15,
  },

  configSub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },

  configActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  card: {
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },

  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },

  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },

  dashboardMetric: (tone) => ({
    background: tone === "warn" ? "#1f1a0b" : "#0b1528",
    border: `1px solid ${tone === "warn" ? "#854d0e" : "#1e293b"}`,
    borderRadius: 12,
    padding: 14,
  }),

  metricTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
  },

  metricValue: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: 950,
    marginTop: 6,
    lineHeight: 1.1,
  },

  dashboardColumns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
    gap: 14,
  },

  dashboardList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  dashboardRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 10,
  },

  dashboardPendingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: "10px 12px",
    color: "#e5e7eb",
    fontWeight: 900,
  },

  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },

  grid4: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  fg2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 14,
  },

  secTitle: {
    color: "#f1f5f9",
    fontSize: 15,
    fontWeight: 900,
    marginBottom: 14,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },

  sectionTitle: {
    margin: 0,
    color: "#f1f5f9",
    fontSize: 20,
    fontWeight: 900,
  },

  sectionSub: {
    color: "#64748b",
    fontSize: 13,
    margin: "5px 0 0",
  },

  solicitudesMedicoSection: {
    marginTop: 26,
  },

  solicitudesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },

  solicitudCard: {
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 16,
  },

  solicitudTitle: {
    color: "#f1f5f9",
    fontSize: 15,
    fontWeight: 900,
    marginBottom: 5,
  },

  solicitudSub: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 12,
  },

  solicitudRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 10,
  },

  windowBadge: {
    borderRadius: 10,
    padding: "9px 10px",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 12,
  },

  historialSolicitudes: {
    marginTop: 16,
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 16,
  },

  miniSolicitud: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  miniSolicitudTitle: {
    color: "#f1f5f9",
    fontWeight: 900,
    fontSize: 12,
  },

  miniSolicitudSub: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },

  coordinadorComment: {
    marginTop: 6,
    color: "#fecaca",
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 11,
    lineHeight: 1.4,
  },

  miniTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 8,
  },

  adminRow: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: "9px 11px",
    color: "#cbd5e1",
    fontSize: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  adminDeleteBtn: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    color: "#fecaca",
    borderRadius: 8,
    padding: "6px 9px",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 900,
  },

  patientCard: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 14,
  },

  patientBed: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 4,
  },

  patientName: {
    color: "#f1f5f9",
    fontSize: 15,
    fontWeight: 900,
  },

  estadoPacienteChip: (estado) => {
    const info = estadoPacienteInfo(estado);
    return {
      display: "inline-flex",
      alignItems: "center",
      width: "fit-content",
      marginTop: 8,
      marginBottom: 8,
      borderRadius: 999,
      padding: "5px 9px",
      background: info.bg,
      color: info.color,
      border: "1px solid rgba(255,255,255,0.08)",
      fontSize: 11,
      fontWeight: 900,
    };
  },

  patientQuickStates: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 12,
  },

  patientStateBtn: (active, info) => ({
    borderRadius: 999,
    padding: "6px 9px",
    border: active ? `1px solid ${info.color}` : "1px solid #1f2937",
    background: active ? info.bg : "#0f172a",
    color: active ? info.color : "#94a3b8",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 900,
  }),

  patientFloorGroup: {
    background: "#081120",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 12,
  },

  patientFloorTitle: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 10,
  },

  notificationList: {
    display: "grid",
    gap: 10,
  },

  notificationItem: (leida) => ({
    width: "100%",
    textAlign: "left",
    background: leida ? "#0f172a" : "#112044",
    border: leida ? "1px solid #1f2937" : "1px solid #2563eb",
    borderRadius: 12,
    padding: 14,
    cursor: leida ? "default" : "pointer",
    opacity: leida ? 0.78 : 1,
  }),

  notificationTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: 900,
    marginBottom: 4,
  },

  notificationText: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
    marginBottom: 8,
  },

  notificationMeta: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },

  infoRows: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  mainWrap: {
    display: "flex",
    gap: 22,
    padding: 24,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  simpleHeader: {
    height: 72,
    background: "#0b1528",
    borderBottom: "1px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
  },

  simpleTitle: {
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: 900,
  },

  simpleSub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },

  cardHeaderBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: "#f1f5f9",
  },

  smallMutedBtn: {
    background: "#111827",
    color: "#94a3b8",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "7px 10px",
    cursor: "pointer",
  },

  fieldErr: {
    color: "#f87171",
    fontSize: 11,
  },

  saveBtn: (saving) => ({
    width: "100%",
    background: saving ? "#334155" : "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: saving ? "not-allowed" : "pointer",
    marginTop: 8,
  }),

  listTitle: {
    fontWeight: 900,
    color: "#f1f5f9",
    fontSize: 16,
    marginBottom: 14,
  },

  emptyCard: {
    background: "#0b1528",
    border: "1px dashed #334155",
    borderRadius: 12,
    padding: 18,
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
  },

  medCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 14,
  },

  medName: {
    color: "#f1f5f9",
    fontWeight: 900,
    fontSize: 14,
  },

  medNameSmall: {
    color: "#f1f5f9",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
  },

  metaText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },

  metaTiny: {
    color: "#64748b",
    fontSize: 10,
  },

  textMetaWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: 11,
    marginTop: 6,
  },

  tagBlue: {
    background: "#1e3a5f",
    color: "#60a5fa",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 10,
    fontWeight: 900,
  },

  bEdit: {
    background: "#1e3a5f",
    border: "1px solid #2563eb",
    borderRadius: 8,
    padding: "7px 9px",
    cursor: "pointer",
  },

  bDel: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "7px 9px",
    cursor: "pointer",
  },

  totalLine: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 14,
  },

  calendarScroll: {
    overflow: "auto",
    border: "1px solid #1e293b",
    borderRadius: 14,
  },

  calendarTable: {
    borderCollapse: "collapse",
    minWidth: 1100,
    width: "100%",
    background: "#0b1528",
  },

  th: {
    background: "#111827",
    color: "#94a3b8",
    fontSize: 11,
    padding: 8,
    borderBottom: "1px solid #1e293b",
    whiteSpace: "nowrap",
  },

  td: {
    borderBottom: "1px solid #1e293b",
    borderRight: "1px solid #1e293b",
    padding: 6,
    verticalAlign: "top",
    minWidth: 90,
  },

  tdSticky: {
    position: "sticky",
    left: 0,
    background: "#0b1528",
    borderBottom: "1px solid #1e293b",
    borderRight: "1px solid #1e293b",
    padding: 8,
    minWidth: 230,
    zIndex: 2,
  },

  miniSelect: {
    background: "#111827",
    color: "#f1f5f9",
    border: "1px solid #374151",
    borderRadius: 6,
    padding: 4,
    fontSize: 10,
  },

  calendarShell: {
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
  },

  calendarTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },

  calendarMonthTitle: {
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: 900,
    textTransform: "capitalize",
    letterSpacing: "-0.3px",
  },

  calendarMonthSub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },

  calendarLegend: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 14,
  },

  legendPill: {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.06)",
  },

  thMedico: {
    position: "sticky",
    left: 0,
    zIndex: 4,
    minWidth: 230,
  },

  thHoy: {
    background: "#102a4c",
    color: "#bfdbfe",
  },

  thFinSemana: {
    background: "#111827",
    color: "#c4b5fd",
  },

  calendarDayHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 70,
    textTransform: "capitalize",
  },

  medicoCalendarCell: {
    display: "flex",
    gap: 9,
    alignItems: "center",
  },

  calendarCellInner: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minHeight: 116,
  },

  tdHoy: {
    background: "rgba(37, 99, 235, 0.08)",
  },

  tdFinSemana: {
    background: "rgba(124, 58, 237, 0.06)",
  },

  emptyShift: {
    background: "#111827",
    color: "#94a3b8",
    borderRadius: 9,
    padding: "6px 7px",
    fontSize: 11,
    fontWeight: 800,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    border: "1px dashed #334155",
  },

  turnoPill: (tipo) => ({
    background: tipo.bg,
    color: tipo.color,
    border: `1px solid ${tipo.color}33`,
    borderRadius: 9,
    padding: "6px 7px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    boxShadow: "0 8px 20px rgba(0,0,0,0.14)",
  }),

  extraPill: {
    background: "#1f2937",
    color: "#e5e7eb",
    border: "1px solid #374151",
    borderRadius: 9,
    padding: "5px 7px",
    fontSize: 10,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  addSelectWrap: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 5,
    alignItems: "center",
    marginTop: "auto",
  },

  addSelectLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
  },

  totalPill: {
    background: "#020617",
    color: "#cbd5e1",
    border: "1px solid #1e293b",
    borderRadius: 999,
    padding: "4px 7px",
    fontSize: 10,
    fontWeight: 900,
    textAlign: "center",
  },

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  requestCard: (color) => ({
    background: "#0b1528",
    border: "1px solid #1e293b",
    borderLeft: `4px solid ${color}`,
    borderRadius: 12,
    padding: 14,
  }),

  reqTitle: {
    color: "#f1f5f9",
    fontWeight: 900,
    fontSize: 13,
  },

  reqSub: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
  },

  reqDetails: {
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 1.7,
    marginTop: 10,
  },

  requestActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
};
