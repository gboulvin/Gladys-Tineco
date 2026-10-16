# Tineco para Gladys Assistant

Conecta a Gladys las fregonas eléctricas de su cuenta Tineco (Floor One S3,
S5, S7, S7 Flashdry, S7 Stretch, iFloor… — todos los modelos que muestra la
app **Tineco**): batería, actividad, depósitos de agua, avisos de voz y luz
del cepillo, además de disparadores y acciones de escena y widgets del panel.

La integración pasa por la **nube de Tineco**, igual que la app: el aparato
debe estar configurado en la app Tineco y conectado al Wi-Fi.

## Configuración

1. En Gladys, instale la integración **Tineco** y abra su pestaña
   **Configuración**.
2. Introduzca el **correo** y la **contraseña** de su cuenta Tineco, y el
   **país** elegido al crear la cuenta. Guarde.
3. En la primera conexión, Tineco considera Gladys como un teléfono nuevo y
   le **envía un código de verificación por correo**. Introdúzcalo en
   **Código de verificación** y guarde de nuevo. Solo ocurre una vez. ¿Sin
   correo? Use **Enviar un nuevo código** (se envía automáticamente un correo
   cada cuarto de hora como máximo).
4. **Probar la conexión** lista los aparatos encontrados.
5. Abra la pestaña **Descubrimiento** y cree sus aparatos.

| Ajuste                     | Función                                                    |
| -------------------------- | ---------------------------------------------------------- |
| País de la cuenta          | Elige los servidores Tineco de su cuenta.                  |
| Idioma de los nombres      | Idioma de los nombres de aparatos y funciones al crearlos. |
| Intervalo de actualización | Segundos entre dos lecturas de cada aparato (mínimo 30).   |

## Qué obtiene

| Función                 | Valores                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| Estado                  | Estado estándar de aspirador: parado, en marcha, cargando, en la base            |
| Actividad               | Limpiando, autolimpieza, secado, cargando, actualizando, en espera, sin conexión |
| Batería                 | 0–100 %                                                                          |
| Cargando                | Sí / no                                                                          |
| Depósito de agua limpia | Normal / bajo (vacío)                                                            |
| Depósito de agua sucia  | Normal / alto (lleno)                                                            |
| Volumen de voz          | 1 (bajo) a 3 (alto), controlable                                                 |
| Avisos de voz           | Activados / desactivados, controlable                                            |
| Luz del cepillo         | Encendida / apagada, controlable — solo en los modelos que la tienen             |

Cuando un aparato no responde (apagado, fuera del alcance del Wi-Fi — un
modelo de mano solo se conecta mientras se usa), su distintivo pasa a
**inaccesible**, su actividad a **sin conexión**, y se conservan los últimos
valores.

## Escenas

**Disparadores**

- **Limpieza iniciada** — variable: batería.
- **Limpieza terminada** — variables: duración (minutos), batería.
- **Autolimpieza terminada** — el momento de vaciar el depósito de agua sucia.
- **Alerta de depósito** — depósito de agua sucia lleno o de agua limpia
  vacío; filtro sobre la alerta, variable: alerta.

Cada disparador puede filtrarse por aparato.

**Acciones**

- **Leer un aparato Tineco** — lo lee ahora; salidas: en línea, actividad,
  batería, depósito de agua sucia lleno, depósito de agua limpia vacío (para
  las condiciones de las acciones siguientes).
- **Ajustar el volumen de voz**, **Activar o desactivar los avisos de voz**,
  **Encender o apagar la luz del cepillo** — salida: orden aceptada.

Un aparato sin conexión nunca hace fallar una escena: las salidas lo indican.

## Widgets del panel

- **Aparato Tineco** — el indicador de batería, la actividad, los depósitos,
  la batería en 24 h y un botón **Actualizar**. Elija el aparato en los
  ajustes del widget (si no, el primero).
- **Resumen Tineco** — una línea por aparato, en naranja cuando un depósito
  requiere atención.

## Limitaciones

- Tineco no publica ninguna API: la integración usa el protocolo de la app,
  que Tineco puede cambiar. No todos los modelos informan de todos los
  valores; la luz del cepillo solo aparece en los modelos que la informan.
- No es posible iniciar una limpieza a distancia: una fregona eléctrica se
  empuja a mano.
- Las cuentas de China continental (inicio de sesión por SMS) no están
  soportadas.

## Solución de problemas

- **«Tineco rechazó el inicio de sesión»**: compruebe el correo, la
  contraseña y sobre todo el **país** de la cuenta.
- **«Tineco rechazó el código de verificación»**: los códigos caducan; use
  **Enviar un nuevo código** e introduzca el nuevo.
- **«Tineco no lista ningún aparato»**: la lista viene de los servidores
  Tineco del país elegido. Elija el país que muestra la app Tineco (Perfil >
  Ajustes), guarde y vuelva a probar. ¿Sigue vacía? Comparta la línea
  «Answer shape» de los registros (no contiene datos personales) en una issue.
- Registros de la integración: Gladys → Integraciones → Tineco → registros.
  Las contraseñas y los tokens nunca se registran.
