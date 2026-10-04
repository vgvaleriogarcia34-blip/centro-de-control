# Biblioteca MOF · fuentes, temario y convenciones

## Fuente principal: guía docente 2022/23 (aportada por el usuario)
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

## Sin acceso desde este entorno
`um.es`, `studocu.com` y `wuolah.com` están bloqueados por la red del entorno. No se ha leído ningún documento de esas plataformas y no se reproduce su contenido.

## Verificación
`generar.py` (semilla fija) resuelve cada ejercicio y lo comprueba por una vía independiente: suma flujo a flujo, cuadro de amortización completo, cálculo día a día o búsqueda numérica. Si no coincide, el ejercicio se descarta.
