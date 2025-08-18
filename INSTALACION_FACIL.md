# 🚀 INSTALACIÓN FÁCIL - LNB BOT

## 📋 REQUISITOS PREVIOS
1. ✅ MySQL Server 9.4 instalado y funcionando
2. ✅ Node.js instalado
3. ✅ Git instalado

## ⚡ INSTALACIÓN SUPER FÁCIL (SOLO 3 PASOS)

### **PASO 1: Configurar MySQL automáticamente**
1. Abre PowerShell como **Administrador**
2. Navega a la carpeta del proyecto:
   ```powershell
   cd "ruta\donde\clonaste\el\proyecto"
   ```
3. Ejecuta el script de configuración:
   ```powershell
   .\setup_mysql.ps1
   ```
4. Ingresa la contraseña de **root** de MySQL cuando te la pida

### **PASO 2: Instalar dependencias**
```bash
npm install
```

### **PASO 3: Ejecutar el bot**
```bash
npm start
```

## ✅ ¡LISTO! El bot debería funcionar

---

## 🔧 SOLUCIÓN MANUAL (si el automático falla)

### **1. Configurar MySQL manualmente:**
```sql
-- Abrir MySQL Command Line Client como administrador:
mysql -u root -p

-- Ejecutar estos comandos:
CREATE DATABASE IF NOT EXISTS lnb_estadisticas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'lnb_user'@'localhost' IDENTIFIED BY 'lnb_password';
GRANT ALL PRIVILEGES ON lnb_estadisticas.* TO 'lnb_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### **2. Crear archivo .env:**
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=lnb_user
DB_PASSWORD=lnb_password
DB_NAME=lnb_estadisticas
NODE_ENV=development
BOT_PORT=3000
```

### **3. Instalar y ejecutar:**
```bash
npm install
npm start
```

---

## ❓ PROBLEMAS COMUNES

### Error: "Access denied for user 'lnb_user'"
- ➡️ Ejecuta el script `setup_mysql.ps1` de nuevo
- ➡️ O sigue la configuración manual de MySQL

### Error: "Cannot find module"
- ➡️ Ejecuta: `npm install`

### Error: "MySQL connection refused"
- ➡️ Verifica que MySQL esté ejecutándose
- ➡️ Busca "Services" en Windows y verifica "MySQL84" esté iniciado

---

## 📞 SOPORTE
Si tienes problemas, envía captura del error completo.

---

**¡Disfruta del bot LNB!** 🎯
