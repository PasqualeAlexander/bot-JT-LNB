# Bot LNB Puppeteer 🤖⚽

Bot para Liga Nacional de Haxball desarrollado con Node.js, Puppeteer y SQLite.

## 📋 Descripción

Este bot está diseñado para gestionar y automatizar funcionalidades en salas de Haxball, incluyendo:

- Sistema de estadísticas completo con base de datos SQLite
- Control de jugadores y partidos
- Sistema de niveles y experiencia (XP)
- Records y achievements
- Funcionalidades VIP
- Automatización con Puppeteer

## 🛠️ Requisitos del Sistema

- **Node.js** (versión 16 o superior)
- **npm** (incluido con Node.js)
- **Git** (para clonar el repositorio)

### Dependencias Adicionales para Windows
- Visual Studio Build Tools o Visual Studio Community
- Python (para compilación de SQLite3)

## 📦 Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/PasqualeAlexander/bot-JT-LNB.git
   cd bot-JT-LNB
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Ejecutar el bot:**
   ```bash
   npm start
   ```

   **Para desarrollo (con recarga automática):**
   ```bash
   npm run dev
   ```

## 📄 Dependencias del Proyecto

### Producción
- `puppeteer` ^22.8.2 - Control del navegador
- `sqlite3` ^5.1.6 - Base de datos
- `node-fetch` ^2.6.7 - Peticiones HTTP
- `form-data` ^4.0.0 - Manejo de formularios

### Desarrollo
- `nodemon` ^3.0.2 - Recarga automática en desarrollo

## 🗂️ Estructura del Proyecto

```
bot-JT-LNB/
├── bot.js                    # Archivo principal del bot
├── check_db.js              # Utilidad para verificar la base de datos
├── consultar_db.js          # Utilidad para consultar la base de datos
├── debug_cargar_stats.js    # Depuración de estadísticas
├── lnb_estadisticas.db      # Base de datos SQLite (se genera automáticamente)
├── message (4).js           # Archivo de mensajes
├── package.json             # Configuración del proyecto
├── package-lock.json        # Lock de dependencias
└── README.md               # Este archivo
```

## 🚀 Scripts Disponibles

- `npm start` - Ejecutar el bot en producción
- `npm run dev` - Ejecutar el bot en modo desarrollo

## 📊 Características del Bot

### Sistema de Estadísticas
- Tracking de goles, asistencias, victorias, derrotas
- Sistema de promedios y rachas
- Hat-tricks y vallas invictas
- Tiempo de juego total

### Sistema de Niveles
- Sistema XP basado en rendimiento
- Niveles progresivos
- Códigos de recuperación

### Base de Datos
- SQLite para persistencia de datos
- Tablas para jugadores, partidos y records
- Respaldos automáticos

## 🔧 Solución de Problemas

### Error al instalar SQLite3
Si encuentras errores al instalar `sqlite3`, necesitas herramientas de compilación:

**Windows:**
```bash
npm install --global windows-build-tools
```

**Linux/macOS:**
```bash
sudo apt-get install build-essential  # Ubuntu/Debian
# o
xcode-select --install  # macOS
```

### Error de Puppeteer
Si Puppeteer no puede descargar Chromium:
```bash
npm config set puppeteer_skip_chromium_download true
```

## 👤 Autor

**ИФT** - Desarrollador principal

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Si tienes problemas o preguntas, por favor abre un issue en este repositorio.

---

⚽ **¡Disfruta jugando Haxball con el bot LNB!** ⚽
