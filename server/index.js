const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ADMIN_CEDULA = process.env.ADMIN_CEDULA || "6662672";

const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (error, row) {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (error, rows) {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

async function inicializarBaseDatos() {
  await run(`
    CREATE TABLE IF NOT EXISTS medicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      documento TEXT UNIQUE NOT NULL,
      tipo_doc TEXT DEFAULT 'CC',
      especialidad TEXT,
      registro_medico TEXT,
      telefono TEXT,
      email TEXT,
      fecha_ingreso TEXT,
      cargo TEXT,
      color TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT,
      rol TEXT NOT NULL,
      medico_id INTEGER,
      cedula TEXT,
      activo INTEGER DEFAULT 1,
      FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      tipo_turno TEXT NOT NULL,
      UNIQUE(medico_id, fecha, tipo_turno),
      FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS horas_adicionales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      horas REAL DEFAULT 0,
      motivo TEXT,
      UNIQUE(medico_id, fecha),
      FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS solicitudes_cambio_turno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_solicitante_id INTEGER NOT NULL,
      medico_destino_id INTEGER NOT NULL,
      fecha_solicitante TEXT NOT NULL,
      fecha_destino TEXT NOT NULL,
      turno_solicitante TEXT NOT NULL,
      turno_destino TEXT NOT NULL,
      nota TEXT,
      fecha_solicitud TEXT,
      estado TEXT DEFAULT 'pendiente'
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS solicitudes_cesion_turno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_solicitante_id INTEGER NOT NULL,
      medico_destino_id INTEGER NOT NULL,
      fecha_turno TEXT NOT NULL,
      turno TEXT NOT NULL,
      nota TEXT,
      fecha_solicitud TEXT,
      estado TEXT DEFAULT 'pendiente'
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS solicitudes_horario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      year INTEGER NOT NULL,
      nota TEXT,
      estado TEXT DEFAULT 'pendiente',
      fecha_envio TEXT,
      datos_json TEXT
    )
  `);

  const admin = await get(
    "SELECT * FROM usuarios WHERE rol IN ('coordinador', 'administrador') LIMIT 1"
  );

  if (!admin) {
    await run(
      `
      INSERT INTO usuarios 
      (username, password, rol, medico_id, cedula, activo)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      ["admin", "", "coordinador", null, ADMIN_CEDULA, 1]
    );

    console.log("Administrador creado con cédula:", ADMIN_CEDULA);
  } else if (!admin.cedula) {
    await run(
      "UPDATE usuarios SET cedula = ? WHERE id = ?",
      [ADMIN_CEDULA, admin.id]
    );

    console.log("Cédula agregada al administrador existente:", ADMIN_CEDULA);
  }

  const tarifa = await get(
    "SELECT * FROM configuracion WHERE clave = 'tarifaHora'"
  );

  if (!tarifa) {
    await run(
      "INSERT INTO configuracion (clave, valor) VALUES (?, ?)",
      ["tarifaHora", "119800"]
    );
  }
}

/* ============================================================================
   RUTA BASE
============================================================================ */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    mensaje: "API TurnosMed funcionando",
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "online",
  });
});

/* ============================================================================
   LOGIN
============================================================================ */

app.post("/login-admin-cedula", async (req, res) => {
  try {
    const { cedula } = req.body;

    if (!cedula || !String(cedula).trim()) {
      return res.status(400).json({
        error: "Debe ingresar la cédula del administrador",
      });
    }

    const usuario = await get(
      `
      SELECT id, username, rol, medico_id, cedula, activo
      FROM usuarios
      WHERE cedula = ?
      AND rol IN ('coordinador', 'administrador')
      AND activo = 1
      LIMIT 1
      `,
      [String(cedula).trim()]
    );

    if (!usuario) {
      return res.status(401).json({
        error: "Cédula de administrador incorrecta o usuario inactivo",
      });
    }

    res.json({
      usuario: {
        ...usuario,
        rol: "coordinador",
      },
    });
  } catch (error) {
    console.error("Error en /login-admin-cedula:", error);
    res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Debe ingresar usuario y contraseña",
      });
    }

    const usuario = await get(
      `
      SELECT id, username, rol, medico_id, cedula, activo
      FROM usuarios
      WHERE username = ?
      AND password = ?
      AND activo = 1
      LIMIT 1
      `,
      [String(username).trim(), String(password)]
    );

    if (!usuario) {
      return res.status(401).json({
        error: "Usuario o contraseña incorrectos",
      });
    }

    if (usuario.rol === "coordinador" || usuario.rol === "administrador") {
      return res.status(403).json({
        error: "El administrador debe ingresar solo con cédula",
      });
    }

    res.json({
      usuario,
    });
  } catch (error) {
    console.error("Error en /login:", error);
    res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

/* ============================================================================
   MÉDICOS
============================================================================ */

app.get("/medicos", async (req, res) => {
  try {
    const medicos = await all(
      `
      SELECT *
      FROM medicos
      ORDER BY nombre ASC, apellido ASC
      `
    );

    res.json(medicos);
  } catch (error) {
    console.error("Error obteniendo médicos:", error);
    res.status(500).json({
      error: "Error obteniendo médicos",
    });
  }
});

app.post("/medicos", async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      documento,
      tipo_doc,
      especialidad,
      registro_medico,
      telefono,
      email,
      fecha_ingreso,
      cargo,
      color,
    } = req.body;

    if (!nombre || !apellido || !documento) {
      return res.status(400).json({
        error: "Nombre, apellido y documento son obligatorios",
      });
    }

    const existe = await get(
      "SELECT id FROM medicos WHERE documento = ?",
      [String(documento).trim()]
    );

    if (existe) {
      return res.status(409).json({
        error: "Ya existe un médico con ese documento",
      });
    }

    const result = await run(
      `
      INSERT INTO medicos
      (
        nombre,
        apellido,
        documento,
        tipo_doc,
        especialidad,
        registro_medico,
        telefono,
        email,
        fecha_ingreso,
        cargo,
        color
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(nombre).trim(),
        String(apellido).trim(),
        String(documento).trim(),
        tipo_doc || "CC",
        especialidad || "",
        registro_medico || "",
        telefono || "",
        email || "",
        fecha_ingreso || "",
        cargo || "Médico Hospitalario",
        color || "#4f8ef7",
      ]
    );

    const nuevo = await get("SELECT * FROM medicos WHERE id = ?", [
      result.lastID,
    ]);

    res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error creando médico:", error);
    res.status(500).json({
      error: "Error creando médico",
    });
  }
});

app.put("/medicos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre,
      apellido,
      documento,
      tipo_doc,
      especialidad,
      registro_medico,
      telefono,
      email,
      fecha_ingreso,
      cargo,
      color,
    } = req.body;

    const medico = await get("SELECT * FROM medicos WHERE id = ?", [id]);

    if (!medico) {
      return res.status(404).json({
        error: "Médico no encontrado",
      });
    }

    const docRepetido = await get(
      "SELECT id FROM medicos WHERE documento = ? AND id != ?",
      [String(documento).trim(), id]
    );

    if (docRepetido) {
      return res.status(409).json({
        error: "Ya existe otro médico con ese documento",
      });
    }

    await run(
      `
      UPDATE medicos
      SET
        nombre = ?,
        apellido = ?,
        documento = ?,
        tipo_doc = ?,
        especialidad = ?,
        registro_medico = ?,
        telefono = ?,
        email = ?,
        fecha_ingreso = ?,
        cargo = ?,
        color = ?
      WHERE id = ?
      `,
      [
        String(nombre || "").trim(),
        String(apellido || "").trim(),
        String(documento || "").trim(),
        tipo_doc || "CC",
        especialidad || "",
        registro_medico || "",
        telefono || "",
        email || "",
        fecha_ingreso || "",
        cargo || "Médico Hospitalario",
        color || medico.color || "#4f8ef7",
        id,
      ]
    );

    const actualizado = await get("SELECT * FROM medicos WHERE id = ?", [id]);

    res.json(actualizado);
  } catch (error) {
    console.error("Error actualizando médico:", error);
    res.status(500).json({
      error: "Error actualizando médico",
    });
  }
});

app.delete("/medicos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const medico = await get("SELECT * FROM medicos WHERE id = ?", [id]);

    if (!medico) {
      return res.status(404).json({
        error: "Médico no encontrado",
      });
    }

    await run("DELETE FROM usuarios WHERE medico_id = ?", [id]);
    await run("DELETE FROM turnos WHERE medico_id = ?", [id]);
    await run("DELETE FROM horas_adicionales WHERE medico_id = ?", [id]);
    await run("DELETE FROM medicos WHERE id = ?", [id]);

    res.json({
      ok: true,
      mensaje: "Médico eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando médico:", error);
    res.status(500).json({
      error: "Error eliminando médico",
    });
  }
});

/* ============================================================================
   USUARIOS
============================================================================ */

app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await all(
      `
      SELECT 
        id,
        username,
        rol,
        medico_id,
        cedula,
        activo
      FROM usuarios
      ORDER BY id ASC
      `
    );

    res.json(usuarios);
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    res.status(500).json({
      error: "Error obteniendo usuarios",
    });
  }
});

app.post("/usuarios", async (req, res) => {
  try {
    const { username, password, rol, medico_id, cedula } = req.body;

    if (!username || !rol) {
      return res.status(400).json({
        error: "Usuario y rol son obligatorios",
      });
    }

    if (rol !== "coordinador" && rol !== "administrador" && !password) {
      return res.status(400).json({
        error: "La contraseña es obligatoria para usuarios médicos",
      });
    }

    const existe = await get(
      "SELECT id FROM usuarios WHERE username = ?",
      [String(username).trim()]
    );

    if (existe) {
      return res.status(409).json({
        error: "Ya existe un usuario con ese nombre",
      });
    }

    if (rol === "medico") {
      if (!medico_id) {
        return res.status(400).json({
          error: "Debe seleccionar el médico vinculado",
        });
      }

      const medico = await get("SELECT * FROM medicos WHERE id = ?", [
        medico_id,
      ]);

      if (!medico) {
        return res.status(404).json({
          error: "El médico vinculado no existe",
        });
      }

      const usuarioMedicoExiste = await get(
        "SELECT id FROM usuarios WHERE medico_id = ? AND rol = 'medico'",
        [medico_id]
      );

      if (usuarioMedicoExiste) {
        return res.status(409).json({
          error: "Este médico ya tiene usuario creado",
        });
      }
    }

    const result = await run(
      `
      INSERT INTO usuarios
      (
        username,
        password,
        rol,
        medico_id,
        cedula,
        activo
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        String(username).trim(),
        password ? String(password) : "",
        rol,
        medico_id || null,
        cedula || null,
        1,
      ]
    );

    const nuevo = await get(
      `
      SELECT id, username, rol, medico_id, cedula, activo
      FROM usuarios
      WHERE id = ?
      `,
      [result.lastID]
    );

    res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error creando usuario:", error);
    res.status(500).json({
      error: "Error creando usuario",
    });
  }
});

app.put("/usuarios/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevaPassword } = req.body;

    if (!nuevaPassword || !String(nuevaPassword).trim()) {
      return res.status(400).json({
        error: "La nueva contraseña es obligatoria",
      });
    }

    const usuario = await get("SELECT * FROM usuarios WHERE id = ?", [id]);

    if (!usuario) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    if (usuario.rol === "coordinador" || usuario.rol === "administrador") {
      return res.status(403).json({
        error: "El administrador no usa contraseña",
      });
    }

    await run(
      "UPDATE usuarios SET password = ? WHERE id = ?",
      [String(nuevaPassword).trim(), id]
    );

    res.json({
      ok: true,
      mensaje: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("Error reseteando contraseña:", error);
    res.status(500).json({
      error: "Error reseteando contraseña",
    });
  }
});

/* ============================================================================
   TURNOS
============================================================================ */

app.get("/turnos", async (req, res) => {
  try {
    const turnos = await all(
      `
      SELECT *
      FROM turnos
      ORDER BY fecha ASC, medico_id ASC
      `
    );

    res.json(turnos);
  } catch (error) {
    console.error("Error obteniendo turnos:", error);
    res.status(500).json({
      error: "Error obteniendo turnos",
    });
  }
});

app.post("/turnos", async (req, res) => {
  try {
    const { medico_id, fecha, tipo_turno } = req.body;

    if (!medico_id || !fecha || !tipo_turno) {
      return res.status(400).json({
        error: "Médico, fecha y tipo de turno son obligatorios",
      });
    }

    const medico = await get("SELECT * FROM medicos WHERE id = ?", [
      medico_id,
    ]);

    if (!medico) {
      return res.status(404).json({
        error: "Médico no encontrado",
      });
    }

    const turnosDia = await all(
      "SELECT tipo_turno FROM turnos WHERE medico_id = ? AND fecha = ?",
      [medico_id, fecha]
    );

    const tiposActuales = turnosDia.map((t) => t.tipo_turno);

    if (tiposActuales.includes(tipo_turno)) {
      return res.status(409).json({
        error: "Ese turno ya existe para ese médico en esa fecha",
      });
    }

    if (tiposActuales.length >= 2) {
      return res.status(400).json({
        error: "No se pueden cargar más de 2 turnos por día",
      });
    }

    if (tipo_turno === "FDS" && tiposActuales.length > 0) {
      return res.status(400).json({
        error: "FDS no puede combinarse con otros turnos",
      });
    }

    if (tiposActuales.includes("FDS")) {
      return res.status(400).json({
        error: "Si ya existe FDS, no puedes agregar otro turno",
      });
    }

    const result = await run(
      `
      INSERT INTO turnos
      (
        medico_id,
        fecha,
        tipo_turno
      )
      VALUES (?, ?, ?)
      `,
      [medico_id, fecha, tipo_turno]
    );

    const nuevo = await get("SELECT * FROM turnos WHERE id = ?", [
      result.lastID,
    ]);

    res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error creando turno:", error);
    res.status(500).json({
      error: "Error creando turno",
    });
  }
});

app.delete("/turnos", async (req, res) => {
  try {
    const { medico_id, fecha, tipo_turno } = req.body;

    if (!medico_id || !fecha || !tipo_turno) {
      return res.status(400).json({
        error: "Médico, fecha y tipo de turno son obligatorios",
      });
    }

    await run(
      `
      DELETE FROM turnos
      WHERE medico_id = ?
      AND fecha = ?
      AND tipo_turno = ?
      `,
      [medico_id, fecha, tipo_turno]
    );

    res.json({
      ok: true,
      mensaje: "Turno eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando turno:", error);
    res.status(500).json({
      error: "Error eliminando turno",
    });
  }
});

/* ============================================================================
   HORAS ADICIONALES
============================================================================ */

app.get("/horas-adicionales", async (req, res) => {
  try {
    const horas = await all(
      `
      SELECT *
      FROM horas_adicionales
      ORDER BY fecha ASC, medico_id ASC
      `
    );

    res.json(horas);
  } catch (error) {
    console.error("Error obteniendo horas adicionales:", error);
    res.status(500).json({
      error: "Error obteniendo horas adicionales",
    });
  }
});

app.post("/horas-adicionales", async (req, res) => {
  try {
    const { medico_id, fecha, horas, motivo } = req.body;

    if (!medico_id || !fecha) {
      return res.status(400).json({
        error: "Médico y fecha son obligatorios",
      });
    }

    const horasNumero = Number(horas || 0);

    if (Number.isNaN(horasNumero) || horasNumero < 0) {
      return res.status(400).json({
        error: "Las horas no son válidas",
      });
    }

    await run(
      `
      INSERT INTO horas_adicionales
      (
        medico_id,
        fecha,
        horas,
        motivo
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(medico_id, fecha)
      DO UPDATE SET
        horas = excluded.horas,
        motivo = excluded.motivo
      `,
      [medico_id, fecha, horasNumero, motivo || ""]
    );

    const registro = await get(
      `
      SELECT *
      FROM horas_adicionales
      WHERE medico_id = ?
      AND fecha = ?
      `,
      [medico_id, fecha]
    );

    res.status(201).json(registro);
  } catch (error) {
    console.error("Error guardando horas adicionales:", error);
    res.status(500).json({
      error: "Error guardando horas adicionales",
    });
  }
});

/* ============================================================================
   CONFIGURACIÓN
============================================================================ */

app.get("/configuracion/tarifa-hora", async (req, res) => {
  try {
    const row = await get(
      "SELECT valor FROM configuracion WHERE clave = 'tarifaHora'"
    );

    res.json({
      tarifaHora: Number(row?.valor || 119800),
    });
  } catch (error) {
    console.error("Error obteniendo tarifa:", error);
    res.status(500).json({
      error: "Error obteniendo tarifa por hora",
    });
  }
});

app.put("/configuracion/tarifa-hora", async (req, res) => {
  try {
    const { tarifaHora } = req.body;
    const valor = Number(tarifaHora);

    if (!valor || valor <= 0) {
      return res.status(400).json({
        error: "Tarifa inválida",
      });
    }

    await run(
      `
      INSERT INTO configuracion (clave, valor)
      VALUES ('tarifaHora', ?)
      ON CONFLICT(clave)
      DO UPDATE SET valor = excluded.valor
      `,
      [String(valor)]
    );

    res.json({
      tarifaHora: valor,
    });
  } catch (error) {
    console.error("Error actualizando tarifa:", error);
    res.status(500).json({
      error: "Error actualizando tarifa",
    });
  }
});

/* ============================================================================
   SOLICITUDES DE CAMBIO DE TURNO
============================================================================ */

app.get("/solicitudes-cambio-turno", async (req, res) => {
  try {
    const data = await all(
      `
      SELECT *
      FROM solicitudes_cambio_turno
      ORDER BY id DESC
      `
    );

    res.json(data);
  } catch (error) {
    console.error("Error obteniendo solicitudes de cambio:", error);
    res.status(500).json({
      error: "Error obteniendo solicitudes de cambio",
    });
  }
});

app.post("/solicitudes-cambio-turno", async (req, res) => {
  try {
    const {
      medico_solicitante_id,
      medico_destino_id,
      fecha_solicitante,
      fecha_destino,
      turno_solicitante,
      turno_destino,
      nota,
      fecha_solicitud,
    } = req.body;

    if (
      !medico_solicitante_id ||
      !medico_destino_id ||
      !fecha_solicitante ||
      !fecha_destino ||
      !turno_solicitante ||
      !turno_destino
    ) {
      return res.status(400).json({
        error: "Faltan datos para la solicitud de cambio",
      });
    }

    const result = await run(
      `
      INSERT INTO solicitudes_cambio_turno
      (
        medico_solicitante_id,
        medico_destino_id,
        fecha_solicitante,
        fecha_destino,
        turno_solicitante,
        turno_destino,
        nota,
        fecha_solicitud,
        estado
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
      `,
      [
        medico_solicitante_id,
        medico_destino_id,
        fecha_solicitante,
        fecha_destino,
        turno_solicitante,
        turno_destino,
        nota || "",
        fecha_solicitud || new Date().toISOString().slice(0, 10),
      ]
    );

    const nuevo = await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [result.lastID]
    );

    res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error creando solicitud de cambio:", error);
    res.status(500).json({
      error: "Error creando solicitud de cambio",
    });
  }
});

app.put("/solicitudes-cambio-turno/:id/aprobar", async (req, res) => {
  try {
    const { id } = req.params;

    const solicitud = await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [id]
    );

    if (!solicitud) {
      return res.status(404).json({
        error: "Solicitud no encontrada",
      });
    }

    if (solicitud.estado !== "pendiente") {
      return res.status(400).json({
        error: "La solicitud ya fue procesada",
      });
    }

    await run(
      `
      DELETE FROM turnos
      WHERE medico_id = ?
      AND fecha = ?
      AND tipo_turno = ?
      `,
      [
        solicitud.medico_solicitante_id,
        solicitud.fecha_solicitante,
        solicitud.turno_solicitante,
      ]
    );

    await run(
      `
      DELETE FROM turnos
      WHERE medico_id = ?
      AND fecha = ?
      AND tipo_turno = ?
      `,
      [
        solicitud.medico_destino_id,
        solicitud.fecha_destino,
        solicitud.turno_destino,
      ]
    );

    await run(
      `
      INSERT OR IGNORE INTO turnos
      (
        medico_id,
        fecha,
        tipo_turno
      )
      VALUES (?, ?, ?)
      `,
      [
        solicitud.medico_solicitante_id,
        solicitud.fecha_destino,
        solicitud.turno_destino,
      ]
    );

    await run(
      `
      INSERT OR IGNORE INTO turnos
      (
        medico_id,
        fecha,
        tipo_turno
      )
      VALUES (?, ?, ?)
      `,
      [
        solicitud.medico_destino_id,
        solicitud.fecha_solicitante,
        solicitud.turno_solicitante,
      ]
    );

    await run(
      "UPDATE solicitudes_cambio_turno SET estado = 'aprobado' WHERE id = ?",
      [id]
    );

    res.json({
      ok: true,
      mensaje: "Cambio de turno aprobado y aplicado",
    });
  } catch (error) {
    console.error("Error aprobando cambio:", error);
    res.status(500).json({
      error: "Error aprobando cambio de turno",
    });
  }
});

app.put("/solicitudes-cambio-turno/:id/rechazar", async (req, res) => {
  try {
    const { id } = req.params;

    await run(
      "UPDATE solicitudes_cambio_turno SET estado = 'rechazado' WHERE id = ?",
      [id]
    );

    res.json({
      ok: true,
      mensaje: "Solicitud rechazada",
    });
  } catch (error) {
    console.error("Error rechazando cambio:", error);
    res.status(500).json({
      error: "Error rechazando solicitud",
    });
  }
});

/* ============================================================================
   SOLICITUDES DE CESIÓN DE TURNO
============================================================================ */

app.get("/solicitudes-cesion-turno", async (req, res) => {
  try {
    const data = await all(
      `
      SELECT *
      FROM solicitudes_cesion_turno
      ORDER BY id DESC
      `
    );

    res.json(data);
  } catch (error) {
    console.error("Error obteniendo solicitudes de cesión:", error);
    res.status(500).json({
      error: "Error obteniendo solicitudes de cesión",
    });
  }
});

app.post("/solicitudes-cesion-turno", async (req, res) => {
  try {
    const {
      medico_solicitante_id,
      medico_destino_id,
      fecha_turno,
      turno,
      nota,
      fecha_solicitud,
    } = req.body;

    if (!medico_solicitante_id || !medico_destino_id || !fecha_turno || !turno) {
      return res.status(400).json({
        error: "Faltan datos para la solicitud de cesión",
      });
    }

    const result = await run(
      `
      INSERT INTO solicitudes_cesion_turno
      (
        medico_solicitante_id,
        medico_destino_id,
        fecha_turno,
        turno,
        nota,
        fecha_solicitud,
        estado
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pendiente')
      `,
      [
        medico_solicitante_id,
        medico_destino_id,
        fecha_turno,
        turno,
        nota || "",
        fecha_solicitud || new Date().toISOString().slice(0, 10),
      ]
    );

    const nuevo = await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [result.lastID]
    );

    res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error creando solicitud de cesión:", error);
    res.status(500).json({
      error: "Error creando solicitud de cesión",
    });
  }
});

app.put("/solicitudes-cesion-turno/:id/aprobar", async (req, res) => {
  try {
    const { id } = req.params;

    const solicitud = await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [id]
    );

    if (!solicitud) {
      return res.status(404).json({
        error: "Solicitud no encontrada",
      });
    }

    if (solicitud.estado !== "pendiente") {
      return res.status(400).json({
        error: "La solicitud ya fue procesada",
      });
    }

    await run(
      `
      DELETE FROM turnos
      WHERE medico_id = ?
      AND fecha = ?
      AND tipo_turno = ?
      `,
      [
        solicitud.medico_solicitante_id,
        solicitud.fecha_turno,
        solicitud.turno,
      ]
    );

    await run(
      `
      INSERT OR IGNORE INTO turnos
      (
        medico_id,
        fecha,
        tipo_turno
      )
      VALUES (?, ?, ?)
      `,
      [
        solicitud.medico_destino_id,
        solicitud.fecha_turno,
        solicitud.turno,
      ]
    );

    await run(
      "UPDATE solicitudes_cesion_turno SET estado = 'aprobado' WHERE id = ?",
      [id]
    );

    res.json({
      ok: true,
      mensaje: "Cesión de turno aprobada y aplicada",
    });
  } catch (error) {
    console.error("Error aprobando cesión:", error);
    res.status(500).json({
      error: "Error aprobando cesión",
    });
  }
});

app.put("/solicitudes-cesion-turno/:id/rechazar", async (req, res) => {
  try {
    const { id } = req.params;

    await run(
      "UPDATE solicitudes_cesion_turno SET estado = 'rechazado' WHERE id = ?",
      [id]
    );

    res.json({
      ok: true,
      mensaje: "Cesión rechazada",
    });
  } catch (error) {
    console.error("Error rechazando cesión:", error);
    res.status(500).json({
      error: "Error rechazando cesión",
    });
  }
});

/* ============================================================================
   SOLICITUDES DE HORARIO
============================================================================ */

app.get("/solicitudes-horario", async (req, res) => {
  try {
    const data = await all(
      `
      SELECT *
      FROM solicitudes_horario
      ORDER BY id DESC
      `
    );

    const normalizadas = data.map((item) => ({
      ...item,
      medicoId: item.medico_id,
      datos: item.datos_json ? JSON.parse(item.datos_json) : null,
    }));

    res.json(normalizadas);
  } catch (error) {
    console.error("Error obteniendo solicitudes de horario:", error);
    res.status(500).json({
      error: "Error obteniendo solicitudes de horario",
    });
  }
});

app.post("/solicitudes-horario", async (req, res) => {
  try {
    const { medico_id, medicoId, mes, year, nota, fecha_envio, datos } = req.body;

    const medicoFinal = medico_id || medicoId;

    if (!medicoFinal || mes === undefined || !year) {
      return res.status(400).json({
        error: "Faltan datos para la solicitud de horario",
      });
    }

    const result = await run(
      `
      INSERT INTO solicitudes_horario
      (
        medico_id,
        mes,
        year,
        nota,
        estado,
        fecha_envio,
        datos_json
      )
      VALUES (?, ?, ?, ?, 'pendiente', ?, ?)
      `,
      [
        medicoFinal,
        mes,
        year,
        nota || "",
        fecha_envio || new Date().toISOString().slice(0, 10),
        JSON.stringify(datos || {}),
      ]
    );

    const nuevo = await get("SELECT * FROM solicitudes_horario WHERE id = ?", [
      result.lastID,
    ]);

    res.status(201).json({
      ...nuevo,
      medicoId: nuevo.medico_id,
      datos: nuevo.datos_json ? JSON.parse(nuevo.datos_json) : null,
    });
  } catch (error) {
    console.error("Error creando solicitud de horario:", error);
    res.status(500).json({
      error: "Error creando solicitud de horario",
    });
  }
});

app.put("/solicitudes-horario/:id/aprobar", async (req, res) => {
  try {
    const { id } = req.params;

    await run(
      "UPDATE solicitudes_horario SET estado = 'aprobado' WHERE id = ?",
      [id]
    );

    res.json({
      ok: true,
      mensaje: "Solicitud de horario aprobada",
    });
  } catch (error) {
    console.error("Error aprobando horario:", error);
    res.status(500).json({
      error: "Error aprobando solicitud de horario",
    });
  }
});

app.put("/solicitudes-horario/:id/rechazar", async (req, res) => {
  try {
    const { id } = req.params;

    await run(
      "UPDATE solicitudes_horario SET estado = 'rechazado' WHERE id = ?",
      [id]
    );

    res.json({
      ok: true,
      mensaje: "Solicitud de horario rechazada",
    });
  } catch (error) {
    console.error("Error rechazando horario:", error);
    res.status(500).json({
      error: "Error rechazando solicitud de horario",
    });
  }
});

/* ============================================================================
   ARRANQUE
============================================================================ */

inicializarBaseDatos()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      console.log(`Base de datos: ${dbPath}`);
    });
  })
  .catch((error) => {
    console.error("Error inicializando base de datos:", error);
    process.exit(1);
  });