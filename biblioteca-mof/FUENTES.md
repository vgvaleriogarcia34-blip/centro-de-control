# Biblioteca MOF · fuentes, temario y convenciones

## Guía docente vigente: curso 2026/27 (descargada de api.um.es)
https://api.um.es/aulavirtual/guiasdocentes-api/public/v1/guias/2346/G/2026/E/pdf/redirect
- 6 grupos. Equipo docente: M.ª del Rosario Hernández Carreño (coordinación), Carmen María Hernández Nicolás y M.ª Victoria Tonda García.
- Temario: igual que 2022/23 (12 temas, 4 bloques).
- **Evaluación (cambia respecto a 2022/23):**
  - 1.ª prueba intermedia, bloques 1 y 2: 30 %. Con un 50 % se elimina esa materia; si no, se recupera junto al examen final (en las tres convocatorias).
  - 2.ª prueba intermedia, bloque 3: 15 %. Recuperable a petición en las convocatorias II y III.
  - Examen final, bloques 3 y 4: 55 %.
  - En todas: mínimo del 40 % en la parte teórica y del 40 % **en cada ejercicio práctico**. Si no se supera la teoría, la práctica no se corrige.
  - Calculadora no financiera; asistencia obligatoria a prácticas.

## Catálogo público de Wuolah (comunidad UM, 1.º ADE)
Solo se ha podido leer el listado; los documentos piden iniciar sesión y no se han descargado. Títulos que orientan la biblioteca:
- Temas 1–5 del curso 2026/27; «Ejercicios leyes financieras 2026/27»; «Ejercicios extra capitalización simple».
- Relaciones por tema (PROB-TEMA-2/3/4 2024/25, soluciones del tema 5), «Problemas descuento bancario relación 25».
- Rentas: «Ejercicios rentas 2025/26», «Prácticas rentas», «Rentas constantes».
- Amortización: ejercicios 13 a 23 resueltos de la relación, «Prácticas amortizaciones», «Amortizaciones examen».
- Teoría: «Demostraciones que salen», «Demostraciones rentas», «Demostraciones amortización», «Teoría bloques 1 y 2 que sale en el examen», «1.º parcial MOF 2022».
→ La teoría con demostraciones tiene peso propio en el examen; por eso la biblioteca incluye 27 preguntas de teoría y demostraciones.
- Los exámenes «Examen C2 2025-26» y «Solución C2 MOF 2025-26» del listado general son de la Universidad de Alicante, no de la UM.


## Guía docente 2022/23 (aportada por el usuario)
Asignatura **2346 · Matemática de las Operaciones Financieras**, 1.º Grado en ADE, Universidad de Murcia. Formación básica, 6 ECTS, primer cuatrimestre, 7 grupos.
Equipo docente 2022/23: M.ª Rosario Hernández Carreño (coordinación), M.ª Victoria Tonda García y Joaquín Fuentes Rocamora. **Confirmar el equipo del curso actual.**

### Temario oficial (4 bloques, 12 temas) y cobertura de la biblioteca
| Bloque | Tema | Familias |
|---|---|---|
| 1 Conceptos y leyes | T1 Conceptos básicos (capital financiero, comparación, ley y operación financiera) | criterio |
| | T2 Leyes financieras: simple, compuesta, descuento comercial; tantos de distinta frecuencia | 8 |
| | T3 Unificación de capitales: vencimiento común y medio, sustitución, prórroga | 5 |
| 2 Corto plazo | T4 Activas: descuento bancario, remesas, TAE en descuento, letras persiana, impagados y resaca | 4 |
| | T5 Pasivas: cuentas corrientes (hamburgués), remuneradas (rentabilidad), crédito (TAE) | 3 |
| 3 Rentas | T6 Introducción (valor capital, clasificación) | 1 + criterio |
| | T7 Constantes: pos/prepagable, perpetua, diferida h, anticipada p, tanto variable | 9 |
| | T8 Progresión aritmética: temporal, perpetua, fraccionada (Cm, d) | 3 |
| | T9 Progresión geométrica: temporal, perpetua, fraccionada (Cm, q) | 3 |
| 4 Amortización | T10–11 Planteamiento, cuotas de amortización constantes, francés | 3 |
| | T12 Carencia, interés variable, amortización anticipada y compensación, tantos efectivos | 4 |
Préstamos indiciados (12.3) aún no tiene familia propia.

### Evaluación (guía 2022/23)
- Examen final teórico-práctico: 70 %. Pruebas intermedias obligatorias: 2 × 15 %, no recuperables.
- Mínimo del 40 % en teoría y en práctica, y en **cada uno de los cuatro bloques**. Se corrige primero la teoría; si no se supera, no se corrige la práctica.
- Calculadora **no financiera**. Bibliografía básica: materiales de los profesores en el Aula Virtual («Temas teóricos y relaciones de ejercicios de MOF»).

## Convenciones observadas en el ejercicio de préstamo que aportó el usuario (curso 2022/23)
- Tipo nominal anual con términos mensuales: **i₁₂ = j/12** (3 % → 0,0025).
- Notación: a_n¬i, S_n¬i, Cₖ (pendiente), Aₖ (cuota de amortización), Iₖ, mₖ (total amortizado), a₁₂ (mensualidad).
- «Capital pendiente al principio del sexto año» = C₆₀; «amortizado a los cinco años y medio» = m₆₆ = A₁ · S₆₆¬i.
- Redondeo: la solución usa la mensualidad redondeada (879,72) en un apartado (C₄₉ = 38.964,24) y la exacta en otro (C₆₀ = 30.250,39). El comprobador de la biblioteca acepta diferencias de redondeo de ese orden.

## Acceso
- api.um.es y wuolah.com: accesibles (guía y listado público).
- www.studocu.com: responde 403 a accesos automáticos; no se ha leído.
- Documentos de Wuolah y Aula Virtual: requieren la sesión del estudiante. Para incorporarlos, descargarlos y subirlos al chat.

## Verificación
`generar.py` (semilla fija) resuelve cada ejercicio y lo comprueba por una vía independiente: suma flujo a flujo, cuadro de amortización completo, cálculo día a día o búsqueda numérica. Si no coincide, el ejercicio se descarta.
