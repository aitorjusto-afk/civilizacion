/* Datos de ejemplo para probar sin gastar la IA (botones «Cargar ejemplo» en Importar). */
'use strict';

const Ejemplo = {
  calendario: `CALENDARIO DE ESTUDIO · NOVIEMBRE 2026
Día | Asignatura | Qué hacer | Tiempo
lun 9-nov | SI | Leer «Qué entra» y el Bloque 1 (unidades y sistemas de numeración) | 45 min
mar 10-nov | SI | Bloque 1: ejercicios 1, 2, 3 y 6 sin mirar la solución; codificación ASCII y puertas lógicas | 2 h
mar 10-nov | PROG | Empezar la tarea de búsqueda e inserción en arrays (vence el jueves 12) | 45 min
mié 11-nov | SI | Bloque 2: Von Neumann, registros, ciclo de instrucción, fórmulas de buses (ejercicios 4 y 5) | 2 h
mié 11-nov | PROG | Terminar la tarea de búsqueda e inserción | 1 h
jue 12-nov | PROG | ENTREGA: tarea de búsqueda e inserción | —
jue 12-nov | SI | Bloque 3 (1ª mitad): microprocesador, placa base, RAM y fuente + vídeos ★ | 2 h
vie 13-nov | SI | Bloque 3 (2ª mitad): almacenamiento, RAID, puertos, red y seguridad + vídeos ★ | 2 h
vie 13-nov | ED | Primera lectura de la UT1 | 30 min
sáb 14-nov | SI | Repaso completo + todos los «Ahora tú» (conversiones y bus de 800 MHz) | 3 h
sáb 14-nov | ED | UT1: fases, requisitos, pruebas y versionado | 1 h 30
dom 15-nov | SI | Simulacro: 10 conversiones cronometradas + fórmulas + tablas de memoria de cada bloque | 2 h
dom 15-nov | ED | UT2: roles, ciclos de vida y Scrum | 2 h
lun 16-nov | SI | EXAMEN Sistemas 12:30 (salón de actos) | —
lun 16-nov | SI+ED | Mañana: repasar tablas y fórmulas de SI. Tarde: ejercicios de Entornos | 1 h 30
mar 17-nov | ED | Repaso total + «Ahora tú» + tablas de cascada, iterativo, espiral y Scrum | 2 h 30
mar 17-nov | DWES | Primera lectura del tema 1 | 30 min
mié 18-nov | ED | EXAMEN Entornos | —
mié 18-nov | DWES | Tema 1: historia, cliente-servidor, tiers y MVC | 1 h 30
jue 19-nov | DWES | Tema 1: URL, ciclo HTTP, métodos, códigos, cookies y HTTPS (ejercicios 1 a 4) | 2 h
jue 19-nov | PROG | UT1: tipos, operadores y casting | 30 min
vie 20-nov | SI | ENTREGA: UT01-E03 Hardware (cierra hoy a las 23:59) | 1 h
vie 20-nov | DWES | Apache, VirtualHost, Nginx y curl/dig | 1 h 30
vie 20-nov | PROG | UT2: hacer las trazas de los bucles | 30 min
sáb 21-nov | DWES | Tema 2 PHP: lectura + ejercicios en XAMPP | 2 h 30
sáb 21-nov | BD | Tema 1 + temas 2 y 3 (cardinalidades con el método de las dos preguntas) | 2 h
sáb 21-nov | PROG | 2 ejercicios de la UT2 con pistas | 30 min
dom 22-nov | DWES | Repaso total y simulacro (códigos de estado, partes de una URL y salida de PHP) | 2 h
dom 22-nov | BD | Tema 4 paso a tablas + el ejercicio completo de la academia | 2 h
dom 22-nov | PROG | UT3: trazas de burbuja, búsqueda e inserción | 30 min
lun 23-nov | DWES | EXAMEN DWES | —
lun 23-nov | BD | Ejercicios del videoclub y la empresa + tarea 22 (casting) | 2 h 30
mar 24-nov | BD | EXAMEN Bases de datos | —
mar 24-nov | PROG | 4 ejercicios (UT2 y UT3) en Eclipse + fallos típicos (nextLine, división entera e índices) | 3 h
mié 25-nov | PROG | Mañana: repasar las trazas y la chuleta de Java | 1 h
mié 25-nov | PROG | EXAMEN Programación | —
sáb 28-nov | LM | Lenguajes de marcas: UT01 + UT02 (primera mitad) | 2 h 30
dom 29-nov | LM | Lenguajes de marcas: UT02 (segunda mitad) + prácticas | 2 h 30`,

  apuntes: {
    SI: `# Qué entra en el examen
Unidades y sistemas de numeración, arquitectura de Von Neumann y componentes del ordenador.

# Bloque 1 · Unidades y sistemas de numeración
- **Bit**: unidad mínima (0 o 1). **Byte** = 8 bits.
- KiB = 1024 B; KB = 1000 B.
- Binario → decimal: suma de potencias de 2. Decimal → binario: divisiones sucesivas entre 2.
- Hexadecimal: cada cifra son 4 bits (F = 1111).

## ASCII y puertas lógicas
- ASCII usa 7 bits (128 caracteres). 'A' = 65.
- AND, OR, NOT, NAND, NOR, XOR: aprende sus tablas de verdad.

# Bloque 2 · Arquitectura de Von Neumann
- CPU (UC + ALU + registros), memoria principal, E/S y buses.
- Registros: PC, IR, MAR, MDR, acumulador.
- Ciclo de instrucción: búsqueda → decodificación → ejecución.
- **Ancho de banda del bus** = frecuencia × ancho (bytes) × transferencias por ciclo.

# Bloque 3 · Componentes
## Microprocesador, placa base, RAM y fuente
Núcleos, hilos, caché L1/L2/L3, socket, chipset, DDR4/DDR5, potencia de la fuente y certificación 80 Plus.
## Almacenamiento, RAID y puertos
HDD vs SSD (SATA, NVMe). RAID 0 (rendimiento), RAID 1 (espejo), RAID 5 (paridad). USB, HDMI, DisplayPort, RJ45.`,

    ED: `# UT1 · Desarrollo de software
## Fases
Análisis de requisitos → diseño → codificación → pruebas → documentación → explotación → mantenimiento.
## Requisitos
Funcionales (qué hace) y no funcionales (cómo: rendimiento, seguridad…).
## Pruebas y versionado
Caja blanca y caja negra. Unitarias, de integración y de sistema. Git: commit, branch, merge.

# UT2 · Metodologías
## Roles
Analista, diseñador, programador, tester, jefe de proyecto.
## Ciclos de vida
- **Cascada**: fases secuenciales.
- **Iterativo**: varias versiones mejoradas.
- **Espiral**: iteraciones con análisis de riesgos.
## Scrum
Product Owner, Scrum Master, equipo. Sprint (2-4 semanas), daily, review y retrospectiva.`,

    DWES: `# Tema 1 · Arquitecturas web
## Historia y modelo cliente-servidor
El cliente pide, el servidor responde. Arquitecturas de 2 y 3 capas (tiers). Patrón MVC: modelo, vista y controlador.
## URL y HTTP
Partes de una URL: protocolo, dominio, puerto, ruta, consulta y fragmento.
Métodos GET, POST, PUT, DELETE. Códigos: 2xx éxito, 3xx redirección, 4xx error del cliente, 5xx error del servidor.
Cookies y HTTPS (TLS).
## Servidores
Apache y VirtualHost, Nginx, comandos curl y dig.

# Tema 2 · PHP
Etiquetas \`<?php ?>\`, variables con \`$\`, \`echo\`, arrays, \`if\`, \`foreach\`, formularios con \`$_GET\` y \`$_POST\`. Pruebas en XAMPP.`,

    BD: `# Tema 1 · Introducción
Datos, información, SGBD y sus ventajas frente a ficheros.

# Temas 2 y 3 · Modelo entidad-relación
Entidades, atributos, relaciones y **cardinalidades**. Método de las dos preguntas: «¿cuántos B tiene un A?» y «¿cuántos A tiene un B?».

# Tema 4 · Paso a tablas
- 1:N → la clave del lado 1 pasa como ajena al lado N.
- N:M → nueva tabla con las dos claves.
- 1:1 → la clave pasa a cualquiera de los lados.`,

    PROG: `# UT1 · Tipos y operadores
int, double, char, boolean, String. Operadores aritméticos y lógicos. Casting: \`(int) 3.7\` = 3.

# UT2 · Bucles
for, while y do-while. Haz trazas en una tabla con una columna por variable.

# UT3 · Arrays
Recorrido, búsqueda lineal, inserción desplazando elementos y ordenación por burbuja.

# Fallos típicos
\`nextLine()\` después de \`nextInt()\`, división entera (\`5/2 = 2\`) e índices fuera de rango.`,

    LM: `# UT01 · Lenguajes de marcas
Qué es un lenguaje de marcas: HTML, XML, Markdown. Etiquetas, atributos y anidamiento correcto.

# UT02 · XML
## Primera mitad
Documento bien formado: un único elemento raíz, etiquetas cerradas y atributos entre comillas.
## Segunda mitad
Validación con DTD y XML Schema. Prácticas con un editor XML.`,
  },
};
