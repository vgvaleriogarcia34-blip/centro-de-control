# Biblioteca MOF · fuentes, temario inferido y límites

## Asignatura
- **Matemática de las Operaciones Financieras**, 1.º del Grado en ADE, Universidad de Murcia (6 ECTS).
- Guía docente 2022/23 (histórico público): coordinación de M.ª Rosario Hernández Carreño, Departamento de Economía Financiera y Contabilidad.
  https://api.um.es/aulavirtual/historico-guias-docente-api/public/2/getpdf/E/63731
- La guía del curso vigente no se ha podido leer: la red de este entorno bloquea `um.es`. **Pendiente de confirmar** profesorado, temario y evaluación actuales.

## Temario inferido (de títulos públicos de apuntes de alumnos en Studocu/Wuolah)
| Tema | Contenido que aparece en los materiales | Familias en la biblioteca |
|---|---|---|
| T1 | Fenómeno financiero, capital financiero, conceptos básicos | (base teórica; cubierto en criterio transversal) |
| T2 | Leyes financieras: simple, descuento comercial y racional, compuesta, tantos equivalentes | 7 familias |
| T3 | Equivalencia y unificación de capitales | 4 familias |
| T4 | Descuento bancario: negociación de efectos, remesas, coste efectivo | 2 familias |
| T5 | Cuentas corrientes: método hamburgués, intereses recíprocos y no recíprocos, cuentas de crédito, TAE | 2 familias |
| T6–T7 | Introducción a las rentas y rentas constantes (pos/prepagables, diferidas, perpetuas, fraccionadas) | 7 familias |
| T8 | Rentas variables (geométricas y aritméticas) | 2 familias |
| ? | Préstamos: no aparece con claridad en los títulos; incluidos como **ampliación** | 1 familia |

Títulos consultados (solo título y fragmento del buscador; contenido no accesible desde aquí):
- «Tema 1 2022-23 MOF – Fenómeno financiero» · «Problemas MOF Tema 2» (2024/25) · «Examen enero 2022» (problemas de rentas)
- «Examen final MOF diciembre 2022» · «Apuntes Tema 4 2021-22» (descuento bancario) · «Tema 5 Cuentas corrientes» (2018-19, 2020-21, 2022-23)
- «Formulario temas 1–7» · «Tema 8 Rentas variables»

## Qué NO hace esta biblioteca
- No copia ejercicios, exámenes ni apuntes de la profesora ni de alumnos: los materiales subidos a plataformas tienen derechos de autor y, además, no son accesibles desde este entorno.
- No construye un perfil de la profesora a partir de foros. Los «patrones» y «criterios» de cada ejercicio son patrones de la materia, no atribuciones a su forma de examinar.
- Las convenciones (base 360/365, redondeo, ajuste de rentas con n no entero) se declaran en cada enunciado para evitar ambigüedad, pero deben alinearse con las del profesor.

## Cómo se garantiza la corrección
`generar.py` (semilla fija) resuelve cada ejercicio con su fórmula cerrada y lo comprueba con un método independiente: suma flujo a flujo, ida y vuelta, cálculo día a día en cuentas corrientes o búsqueda numérica. Si una comprobación falla, el ejercicio no se publica.

## Para afinarla con la asignatura real
Aporta la guía docente vigente, una relación de problemas de clase y un examen resuelto. Con eso: se ajusta el reparto por temas, se fijan las convenciones y se añaden las familias que falten.
