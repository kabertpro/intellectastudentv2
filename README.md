# ⭐ IntellectaQuiz

**Plataforma profesional de evaluaciones online en tiempo real**

Desarrollado por **Kabert Studio - LMKE**

---

## 🚀 Características principales

- 📡 **Tiempo real** — Firebase Firestore con sincronización instantánea
- 👥 **40+ estudiantes simultáneos** — Escalable y sin límite de concurrencia
- 📝 **Importador TXT inteligente** — Parser automático de preguntas con detección de respuestas
- 🔒 **Modo Examen Bloqueado** — Fullscreen, sin navegación lateral durante el examen
- 📊 **Dashboard en vivo** — Administrador ve el progreso de cada estudiante en tiempo real
- 💾 **Anti-pérdida** — Respuestas guardadas automáticamente, restauración tras desconexión
- 📄 **PDF profesional** — Cada estudiante descarga su reporte académico
- 🛡️ **Anti-trampa** — Detección de cambios de pestaña con registro en Firebase
- 📱 **Mobile First** — Diseño responsive para celulares, tablets y computadoras

---

## 📁 Estructura del proyecto

```
intellectaquiz/
├── index.html          ← SPA principal
├── css/
│   └── style.css       ← Sistema de diseño completo
├── js/
│   └── app.js          ← Lógica principal + Firebase
├── firestore.rules     ← Reglas de seguridad Firebase
└── README.md
```

---

## ⚙️ Configuración inicial

### 1. Firebase Console

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Selecciona el proyecto **intellectaquiz**
3. En **Authentication** → habilita **Email/Password**
4. En **Firestore Database** → crea la base de datos en modo producción
5. Copia el contenido de `firestore.rules` en las reglas de Firestore

### 2. Crear cuenta administrador

En Firebase Console → Authentication, crea manualmente el usuario admin.
Luego en Firestore → colección `users` → crea un documento con el UID del admin:

```json
{
  "name": "Administrador",
  "email": "admin@tuinstitucion.edu.bo",
  "role": "admin",
  "nivel": "admin",
  "curso": "admin"
}
```

### 3. GitHub Pages

1. Sube los archivos al repositorio: `https://github.com/kabertpro/IntellectaQuiz`
2. Ve a Settings → Pages → Source: `main` branch, carpeta `/root`
3. ¡Listo! La plataforma estará en `https://kabertpro.github.io/IntellectaQuiz`

---

## 🔧 Ocultar Panel Administrador

Para desplegar la versión **solo estudiante** sin acceso al panel admin:

### Opción A (recomendada) — `js/app.js` línea 12:
```javascript
const ENABLE_ADMIN_PANEL = false;  // Cambiar true → false
```

### Opción B — `index.html`:
Eliminar el elemento con `id="admin-nav-link"` (marcado con comentario `[ADMIN]`)

---

## 📋 Formato de preguntas TXT

```
1. ¿Cuál es la capital de Bolivia?
A. Santa Cruz
B. Cochabamba
C. Sucre R
D. La Paz

2. ¿Cuántas notas musicales existen?
A. 7 R
B. 5
C. 8
D. 12
```

> La letra **R** al final de una opción indica la **respuesta correcta**.

---

## 🛡️ Seguridad

- Autenticación real con Firebase Authentication
- Reglas de Firestore que validan permisos por rol
- El acceso admin requiere que el campo `role: "admin"` esté en Firestore
- Las respuestas se validan en el servidor, no en el cliente

---

## 📱 Compatibilidad

| Dispositivo | Soporte |
|-------------|---------|
| Chrome / Edge | ✅ Completo |
| Firefox | ✅ Completo |
| Safari iOS | ✅ Completo |
| Android Chrome | ✅ Completo |
| GitHub Pages | ✅ Nativo |

---

## 👨‍💻 Autor

**Kabert Studio - LMKE**
Repositorio: [github.com/kabertpro/IntellectaQuiz](https://github.com/kabertpro/IntellectaQuiz)
