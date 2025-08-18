# 🔒 LIMITACIONES DE ADMINISTRADORES - SISTEMA ACTUALIZADO

## 📋 **Resumen de Rangos y sus Limitaciones**

### 👑 **OWNER (Nivel Máximo)**
**❌ Limitaciones: NINGUNA**
- ✅ Control total del servidor
- ✅ Puede otorgar y remover CUALQUIER rango (incluido OWNER)
- ✅ Acceso a TODOS los comandos administrativos
- ✅ Puede gestionar sistema VIP completo
- ✅ Comandos especiales: `!vipsetup`, `!vipbackup`, `!vipmigrate`
- ✅ Comandos VIP: `!givevip`, `!giveultravip`, `!removevip`, `!viplist`, `!vipinfo`, `!vipstats`, `!vipcleanup`
- 🏆 Priority: 10 (máxima)

---

### ⭐ **ADMIN FULL (Administrador Limitado)**
**❌ Limitaciones: ALGUNAS**
- ❌ **NO puede otorgar ni remover rangos** (principal restricción)
- ❌ **NO puede gestionar sistema VIP** (no puede dar/quitar VIP)
- ❌ NO puede acceder a comandos especiales de OWNER
- ❌ NO puede usar comandos VIP administrativos
- ❌ NO puede otorgar rango de OWNER/ADMIN/MOD a otros
- ✅ Puede usar comandos administrativos básicos
- ✅ Puede moderar jugadores (kick, ban, etc.)
- ✅ **PUEDE usar comando !unban** (NUEVO)
- ✅ Mensajes con prefijo: `⭐ ADMIN NombreJugador`
- 🏆 Priority: 9

---

### 🔧 **ADMIN_BASICO (Administrador Básico)**
**❌ Limitaciones: MODERADAS**
- ❌ NO puede otorgar ni remover rangos
- ❌ NO puede gestionar sistema VIP
- ❌ NO puede usar comandos VIP administrativos
- ❌ NO puede usar comandos especiales de OWNER/ADMIN
- ✅ Puede usar comandos de moderación básicos
- ✅ Funciones de moderación (kick, mute, advertencias)
- ✅ **PUEDE usar comando !unban** (NUEVO)
- ✅ Mensajes con prefijo: `🔧 ADMIN BÁSICO NombreJugador`
- 🏆 Priority: 8

---

## 🔄 **Cambios Implementados**

### **Antes:**
```javascript
// ADMIN podía gestionar rangos y VIPs
async canUseAdminCommands() {
    return ['OWNER', 'ADMIN'].includes(rank);
}
```

### **Después:**
```javascript
// Solo OWNER puede gestionar rangos y VIPs
async grantRank(grantedBy) {
    if (granterRank !== 'OWNER') {
        return "❌ Solo los OWNERS pueden otorgar rangos.";
    }
}

async handleGiveVIP(playerName, playerAuth) {
    if (!this.isOwner(playerName, playerAuth)) {
        return "❌ Solo los OWNERS pueden usar este comando.";
    }
}
```

---

## 📝 **Comandos Restringidos**

### **Solo OWNER puede usar:**
- `!grantrank <jugador> <rango>`
- `!removerank <jugador>`
- `!givevip <jugador> [días] [razón]`
- `!giveultravip <jugador> [días] [razón]`
- `!removevip <jugador> [razón]`
- `!viplist`
- `!vipinfo <jugador>`
- `!vipstats`
- `!vipcleanup`
- `!vipsetup`
- `!vipbackup`
- `!vipmigrate`

### **ADMIN FULL puede usar:**
- Comandos de moderación básicos
- Comandos de juego estándar
- ❌ **NO puede usar comandos de gestión de privilegios**

### **ADMIN_BASICO puede usar:**
- Comandos de moderación limitados
- Funciones básicas de staff
- ❌ **NO puede usar comandos administrativos avanzados**

---

## 🎯 **Funciones de Verificación Actualizadas**

```javascript
// Verificar si puede usar comandos de admin (básicos)
async canUseAdminCommands(playerName) {
    const rank = await this.getUserRank(playerName);
    return ['OWNER', 'ADMIN'].includes(rank);
}

// Verificar si puede usar comandos de moderador
async canUseModCommands(playerName) {
    const rank = await this.getUserRank(playerName);
    return ['OWNER', 'ADMIN', 'ADMIN_BASICO'].includes(rank);
}

// Nueva verificación: Solo OWNER para gestión de rangos/VIPs
isOwner(playerName) {
    const ownerAuthorities = ['owner', 'tu_nombre_owner'];
    return ownerAuthorities.includes(playerName.toLowerCase());
}
```

---

## ⚠️ **Mensajes de Error Actualizados**

- **Antes:** `"❌ Solo los administradores pueden usar este comando."`
- **Después:** `"❌ Solo los OWNERS pueden usar este comando."`

---

## 🔧 **Configuración Recomendada**

Para mantener la seguridad del servidor:

1. **Lista de OWNERS limitada** (solo 1-2 personas de máxima confianza)
2. **ADMIN FULL para staff de confianza** (pueden moderar pero no cambiar permisos)
3. **ADMIN_BASICO para helpers** (funciones básicas de moderación)

---

## 📋 **Jerarquía Final**

```
👑 OWNER        → Control total (incluye gestión de rangos/VIPs)
    ↓
⭐ ADMIN FULL   → Moderación avanzada (NO gestión de privilegios)
    ↓  
🔧 ADMIN_BASICO → Moderación básica
    ↓
👑 ULTRA VIP    → Beneficios premium
    ↓
💎 VIP          → Beneficios básicos
    ↓
⚽ JUGADOR      → Usuario normal
```

✅ **Sistema actualizado exitosamente** - Solo OWNERS pueden gestionar privilegios y VIPs.
