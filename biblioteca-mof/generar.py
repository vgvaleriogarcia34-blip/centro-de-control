"""Generador de la biblioteca de ejercicios MOF (temario inferido, UM 1.º ADE).

Cada ejercicio se genera con parámetros aleatorios reproducibles (semilla fija),
se resuelve con la fórmula cerrada y se comprueba con un método independiente
(suma flujo a flujo, ida y vuelta, o búsqueda numérica). Si la comprobación
falla, el ejercicio se descarta.
"""
import json, random, math, hashlib

R = random.Random(20261004)
OUT = []

def f(x, d=2):
    s = f"{abs(x):,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if x < 0 else "") + s
def pct(x, d=2): return f(x * 100, d) + " %"
def close(a, b, tol=1e-6): return abs(a - b) <= tol * max(1, abs(a), abs(b))

ACT = ["una empresa de distribución", "una cooperativa agrícola", "un taller de carpintería", "una clínica dental",
       "una tienda de electrodomésticos", "una empresa de transporte", "un estudio de arquitectura", "una conservera",
       "una bodega", "una empresa de software", "un hotel rural", "una imprenta", "una gestoría", "un vivero",
       "una academia de idiomas", "una empresa de reformas", "una farmacia", "una panadería industrial"]
def act(): return R.choice(ACT)
def cap(s): return s[0].upper() + s[1:]

MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
DM = [31,28,31,30,31,30,31,31,30,31,30,31]
def fecha(doy):  # día del año (1..365) -> "d de mes"
    m = 0
    while doy > DM[m]: doy -= DM[m]; m += 1
    return f"{doy} de {MESES[m]}"

def add(tema, familia, nivel, enun, pregunta, sol, unidad, plan, pasos, patron, error, partes, criterio=None, tipo="calculo", extra=None):
    OUT.append(dict(tema=tema, familia=familia, nivel=nivel, tipo=tipo, enunciado=enun, pregunta=pregunta,
                    solucion=sol, unidad=unidad, planteamiento=plan, pasos=pasos, patron=patron,
                    error_tipico=error, partes=partes, criterio=criterio, **(extra or {})))

T1 = "T01 Conceptos básicos"; T2 = "T02 Leyes financieras"; T3 = "T03 Unificación de capitales"
T4 = "T04 Operaciones activas a corto plazo"; T5 = "T05 Operaciones pasivas a corto plazo"
T6 = "T07 Rentas discretas constantes"; T7 = T6; T8 = "T08 Rentas en progresión aritmética"; T9 = "T09 Rentas en progresión geométrica"
T6I = "T06 Introducción a las rentas"; T11 = "T10-11 Amortización: cuotas constantes y francés"; T12 = "T12 Amortización: carencia, variable, anticipada, tantos efectivos"
TP = T11

# ---------------- T2 ----------------
def cs_montante():
    C = R.randrange(2000, 60000, 500); i = R.choice([.02,.025,.03,.035,.04,.045,.05,.06]); d = R.choice([45,60,75,90,120,150,180,210,240,270,300])
    a = act(); I = C*i*d/360; Cn = C + I
    assert close(Cn, C*(1+i*d/360)) and close(Cn/(1+i*d/360), C)
    add(T2,"Capitalización simple: montante",1,
        f"{cap(a)} coloca {f(C)} € en una imposición a plazo durante {d} días al {pct(i)} simple anual. Año comercial (360 días).",
        "¿Qué montante retirará al vencimiento y cuántos intereses habrá cobrado?", round(Cn,2),"€",
        "Cₙ = C₀ · (1 + i · d/360)", [f"I = {f(C)} · {f(i,4)} · {d}/360 = {f(I)} €", f"Cₙ = {f(C)} + {f(I)} = {f(Cn)} €"],
        "En capitalización simple los intereses son proporcionales al tiempo y no generan intereses.",
        "Usar 365 días cuando el enunciado fija año comercial, o elevar a potencia (ley compuesta).",
        {"acreedor": cap(a), "deudor": "el banco"})

def cs_despeje():
    C = R.randrange(3000, 40000, 250); i = R.choice([.03,.04,.05,.06,.07]); d = R.choice([60,90,120,180,240,270])
    Cn = round(C*(1+i*d/360), 2); a = act()
    if R.random() < .5:
        ii = (Cn/C - 1)*360/d; assert abs(ii - i) < 1e-4
        add(T2,"Capitalización simple: despejar el tipo",2,
            f"{cap(a)} invirtió {f(C)} € y, al cabo de {d} días, recuperó {f(Cn)} €. La operación se pactó en capitalización simple con año comercial.",
            "¿Qué tipo de interés simple anual se aplicó?", round(ii*100,4),"%",
            "i = (Cₙ/C₀ − 1) · 360/d", [f"Cₙ/C₀ − 1 = {f(Cn/C-1,6)}", f"i = {f(Cn/C-1,6)} · 360/{d} = {pct(ii,4)}"],
            "Despejar el tipo exige expresar el tiempo en la misma unidad que el tipo (años).",
            "Olvidar multiplicar por 360/d y dar el tipo del periodo como si fuera anual.",
            {"acreedor": cap(a), "deudor": "la entidad"})
    else:
        dd = (Cn/C - 1)/i*360; assert abs(dd - d) < .05
        add(T2,"Capitalización simple: despejar el tiempo",2,
            f"{cap(a)} deposita {f(C)} € al {pct(i)} simple anual (año comercial) y quiere retirar {f(Cn)} €.",
            "¿Cuántos días debe mantener el depósito?", round(dd),"días",
            "d = (Cₙ/C₀ − 1) / i · 360", [f"Cₙ/C₀ − 1 = {f(Cn/C-1,6)}", f"d = {f(Cn/C-1,6)} / {f(i,4)} · 360 ≈ {round(dd)} días"],
            "El tiempo se despeja de la misma ley; el resultado sale en la unidad del tipo y se pasa a días.",
            "Dar el resultado en años sin convertir.", {"acreedor": cap(a), "deudor": "la entidad"})

def descuento_com():
    N = R.randrange(1000, 50000, 100); d = R.choice([30,45,60,75,90,105,120]); dc = R.choice([.04,.05,.06,.07,.08]); a = act()
    D = N*dc*d/360; E = N - D; Dr = N - N/(1+dc*d/360)
    assert close(E, N*(1-dc*d/360)) and Dr < D
    add(T2,"Descuento comercial frente a racional",2,
        f"{cap(a)} quiere anticipar hoy el cobro de un capital de {f(N)} € que vence dentro de {d} días. Se aplica un tanto de descuento del {pct(dc)} anual (año comercial).",
        "Calcula el efectivo con descuento comercial y compáralo con el que daría el descuento racional al mismo tanto. ¿Cuál favorece a quien anticipa el dinero?", round(E,2),"€",
        "E = N · (1 − d · t/360); racional: E = N / (1 + i · t/360)",
        [f"Descuento comercial: D = {f(N)} · {f(dc,4)} · {d}/360 = {f(D)} €; E = {f(E)} €",
         f"Racional: E = {f(N)} / (1 + {f(dc,4)} · {d}/360) = {f(N-Dr)} €",
         f"El comercial descuenta {f(D-Dr)} € más: favorece a quien anticipa el dinero (el que cobra el descuento)."],
        "El descuento comercial se calcula sobre el nominal, el racional sobre el efectivo: con el mismo tanto, el comercial siempre descuenta más.",
        "Pensar que ambos dan lo mismo porque el tanto es igual.",
        {"cede_el_cobro": cap(a), "anticipa_dinero": "la entidad que descuenta"})

def cc_montante():
    C = R.randrange(5000, 100000, 1000); i = R.choice([.015,.02,.025,.03,.035,.04,.05]); n = R.choice([2,3,4,5,6,7,8,10]); m = R.choice([0,3,6,9]); a = act()
    t = n + m/12; Cn = C*(1+i)**t
    acc = C
    for _ in range(n): acc *= 1+i
    acc *= (1+i)**(m/12); assert close(acc, Cn)
    add(T2,"Capitalización compuesta: montante",1,
        f"{cap(a)} invierte {f(C)} € al {pct(i)} efectivo anual en capitalización compuesta durante {n} años" + (f" y {m} meses." if m else "."),
        "¿Qué capital tendrá al final?", round(Cn,2),"€", "Cₙ = C₀ · (1 + i)^t",
        [f"t = {f(t,4)} años", f"Cₙ = {f(C)} · {f(1+i,4)}^{f(t,4)} = {f(Cn)} €"],
        "En compuesta los intereses de cada periodo generan intereses; el tiempo fraccionario se trata con el mismo exponente.",
        "Calcular los meses sueltos con interés simple sin que el enunciado lo diga.", {"acreedor": cap(a), "deudor": "la entidad"})

def cc_actual():
    Cn = R.randrange(5000, 120000, 500); i = R.choice([.02,.03,.04,.045,.05,.06]); n = R.choice([1.5,2,3,4,5,6,8]); a = act()
    C0 = Cn*(1+i)**-n; assert close(C0*(1+i)**n, Cn)
    add(T2,"Descuento compuesto: valor actual",1,
        f"{cap(a)} necesitará {f(Cn)} € dentro de {f(n,1)} años para renovar maquinaria. Puede invertir hoy al {pct(i)} efectivo anual compuesto.",
        "¿Cuánto debe invertir hoy?", round(C0,2),"€", "C₀ = Cₙ · (1 + i)^−n",
        [f"C₀ = {f(Cn)} · {f(1+i,4)}^−{f(n,1)} = {f(C0)} €"],
        "Valor actual: cuánto vale hoy un capital futuro a un tipo dado.",
        "Restar los intereses calculados sobre el capital final (eso sería otra ley).", {"acreedor": cap(a), "deudor": "la entidad"})

def tantos_eq():
    j = R.choice([.024,.03,.036,.042,.048,.06,.072,.09,.12]); m = R.choice([2,3,4,12]); m2 = R.choice([x for x in [1,2,4,12] if x != m])
    ie = (1+j/m)**m - 1; j2 = ((1+ie)**(1/m2) - 1)*m2
    assert close((1+j2/m2)**m2 - 1, ie)
    nm = {1:"anual",2:"semestral",3:"cuatrimestral",4:"trimestral",12:"mensual"}
    add(T2,"Tantos equivalentes: nominal y efectivo",2,
        f"Un banco ofrece un depósito al {pct(j)} nominal anual con capitalización {nm[m]}. La competencia expresa sus ofertas con capitalización {nm[m2]}.",
        f"Calcula el tanto efectivo anual y el nominal anual con capitalización {nm[m2]} equivalente.", round(ie*100,4),"%",
        "i = (1 + j(m)/m)^m − 1; j(k) = k · [(1 + i)^(1/k) − 1]",
        [f"i_{m} = {pct(j/m,4)}", f"i = (1 + {f(j/m,6)})^{m} − 1 = {pct(ie,4)}",
         f"j({m2}) = {m2} · [(1 + {f(ie,6)})^(1/{m2}) − 1] = {pct(j2,4)}" if m2 != 1 else f"Con capitalización anual, nominal = efectivo = {pct(ie,4)}"],
        "Dos tantos son equivalentes si producen el mismo montante en el mismo plazo; solo el efectivo anual permite comparar.",
        "Dividir o multiplicar el nominal por m y llamarlo efectivo.", {"acreedor": "el depositante", "deudor": "el banco"})

def simple_vs_compuesta():
    C = R.randrange(10000, 80000, 1000); i = R.choice([.03,.04,.05,.06]); d = R.choice([90,120,180,240,270]); y = R.choice([2,3])
    s1 = C*(1+i*d/365); c1 = C*(1+i)**(d/365); s2 = C*(1+i*y); c2 = C*(1+i)**y
    assert s1 > c1 and c2 > s2
    add(T2,"Criterio: ¿qué ley favorece al acreedor?",3,
        f"Un inversor duda entre pactar {f(C)} € al {pct(i)} anual en capitalización simple o compuesta (año civil, 365 días). Valora dos plazos: {d} días y {y} años.",
        "¿Qué ley le conviene en cada plazo? Justifica con los montantes.", round(s1-c1,2),"€ (ventaja de la simple a corto plazo)",
        "Comparar C(1 + i·t) con C(1 + i)^t para t < 1 y t > 1",
        [f"{d} días: simple {f(s1)} € frente a compuesta {f(c1)} € → simple",
         f"{y} años: simple {f(s2)} € frente a compuesta {f(c2)} € → compuesta"],
        "Para t < 1 la simple da más montante; para t > 1, la compuesta. La conclusión depende del plazo.",
        "Afirmar que la compuesta siempre da más.", {"acreedor": "el inversor", "deudor": "la contraparte"},
        criterio="Comparar montantes en la misma fecha; el plazo decide.", tipo="criterio")

# ---------------- T3 ----------------
def capital_comun():
    k = R.choice([2,3,4]); caps = [(R.randrange(2000,30000,500), R.choice([1,2,3,4,5,6])) for _ in range(k)]
    caps = sorted({t:(c,t) for c,t in caps}.values(), key=lambda x:x[1]); i = R.choice([.03,.04,.05,.06]); T = R.choice([0, max(t for _,t in caps), 3])
    X = sum(c*(1+i)**(T-t) for c,t in caps)
    X0 = sum(c*(1+i)**-t for c,t in caps); assert close(X, X0*(1+i)**T)
    a = act(); lista = "; ".join(f"{f(c)} € dentro de {t} año{'s' if t>1 else ''}" for c,t in caps)
    add(T3,"Capital único equivalente",2,
        f"{cap(a)} debe pagar a un proveedor: {lista}. Propone sustituirlos por un único pago {'hoy' if T==0 else f'dentro de {T} años'}, valorando al {pct(i)} efectivo anual compuesto.",
        "¿Qué importe debe tener ese pago único?", round(X,2),"€", "X = Σ Cₛ · (1 + i)^(T − tₛ)",
        [f"{f(c)} · {f(1+i,4)}^{T-t} = {f(c*(1+i)**(T-t))} €" for c,t in caps] + [f"X = {f(X)} €"],
        "Sustituir capitales exige llevarlos todos a la misma fecha con la ley pactada.",
        "Sumar los nominales sin valorar o llevar unos a una fecha y otros a otra.", {"deudor": cap(a), "acreedor": "el proveedor"})

def venc_comun():
    k = R.choice([2,3]); caps = [(R.randrange(3000,25000,500), t) for t in sorted(R.sample([1,2,3,4,5,6],k))]
    i = R.choice([.03,.04,.05,.06]); X = round(sum(c for c,_ in caps)*R.choice([1.02,1.05,1.08,1.1]), 2)
    V0 = sum(c*(1+i)**-t for c,t in caps); T = math.log(X/V0)/math.log(1+i)
    assert close(X*(1+i)**-T, V0)
    a = act(); lista = "; ".join(f"{f(c)} € a {t} años" for c,t in caps)
    add(T3,"Vencimiento común",3,
        f"{cap(a)} tiene estas deudas con su banco: {lista}. Acuerdan sustituirlas por un pago único de {f(X)} €, al {pct(i)} efectivo anual compuesto.",
        "¿En qué momento debe realizarse el pago único?", round(T,4),"años",
        "X · (1 + i)^−T = Σ Cₛ · (1 + i)^−tₛ  →  T = ln(X/V₀) / ln(1 + i)",
        [f"V₀ = {f(V0)} €", f"T = ln({f(X)}/{f(V0)}) / ln({f(1+i,4)}) = {f(T,4)} años"],
        "Si el pago único es mayor que la suma de valores actuales, su vencimiento tiene que ser posterior.",
        "Usar la media ponderada de los plazos (eso es el vencimiento medio en simple).", {"deudor": cap(a), "acreedor": "el banco"})

def venc_medio():
    k = R.choice([3,4]); caps = [(R.randrange(1000,20000,100), d) for d in sorted(R.sample(range(20,181,5),k))]
    S = sum(c for c,_ in caps); t = sum(c*d for c,d in caps)/S; dc = R.choice([.05,.06,.08])
    assert close(sum(c*(1-dc*d/360) for c,d in caps), S*(1-dc*t/360))
    a = act(); lista = "; ".join(f"{f(c)} € a {d} días" for c,d in caps)
    add(T3,"Vencimiento medio (descuento comercial)",2,
        f"{cap(a)} tiene varios efectos a pagar: {lista}. Acuerda con su acreedor sustituirlos por uno solo cuyo nominal sea la suma de los nominales, con descuento comercial al {pct(dc)} (año comercial).",
        "¿A cuántos días debe vencer el efecto único?", round(t,2),"días", "t = Σ Cₛ · tₛ / Σ Cₛ",
        [f"Σ Cₛ = {f(S)} €", f"Σ Cₛ·tₛ = {f(sum(c*d for c,d in caps))}", f"t = {f(t)} días"],
        "En descuento comercial el vencimiento medio no depende del tanto: es la media de los plazos ponderada por nominales.",
        "Ponderar por días en lugar de por nominales.", {"deudor": cap(a), "acreedor": "el acreedor comercial"})

def elegir_planes():
    i = R.choice([.03,.04,.05,.06,.07]); A = R.randrange(20000,60000,1000)
    p1, t1 = round(A*R.uniform(.45,.6),-2), R.choice([1,2]); p2 = round(A*R.uniform(.55,.75),-2); t2 = R.choice([3,4])
    VB = p1*(1+i)**-t1 + p2*(1+i)**-t2; rol = R.choice(["comprador","vendedor"])
    best = ("A" if A < VB else "B") if rol=="comprador" else ("A" if A > VB else "B")
    add(T3,"Elegir entre dos formas de pago según la parte",3,
        f"Una nave se vende con dos modalidades: (A) {f(A)} € al contado; (B) {f(p1)} € dentro de {t1} año{'s' if t1>1 else ''} y {f(p2)} € dentro de {t2} años. Se valora al {pct(i)} efectivo anual compuesto.",
        f"Desde el punto de vista del {rol}, ¿qué modalidad conviene? ¿Cambiaría la respuesta para la otra parte?", round(VB,2),"€ (valor actual de B)",
        "Comparar A con V₀(B) = Σ Cₛ (1 + i)^−tₛ",
        [f"V₀(B) = {f(p1)}·{f(1+i,4)}^−{t1} + {f(p2)}·{f(1+i,4)}^−{t2} = {f(VB)} €", f"Contado: {f(A)} €",
         f"Al {rol} le conviene {best}: {'paga menos en valor actual' if rol=='comprador' else 'cobra más en valor actual'}. La otra parte prefiere la contraria."],
        "La misma comparación da conclusiones opuestas según quién paga y quién cobra.",
        "Comparar la suma nominal de B con el contado.", {"paga": "el comprador", "cobra": "el vendedor"},
        criterio="Fecha común + perspectiva de la parte que pregunta.", tipo="criterio")

# ---------------- T4 ----------------
def efecto():
    N = R.randrange(800, 30000, 50); d = R.choice([30,45,60,75,90,120]); dc = R.choice([.05,.055,.06,.065,.07,.08])
    com = R.choice([.003,.004,.005,.006]); cmin = R.choice([3,5,6,9]); corr = R.choice([0,1.5,2,3])
    D = N*dc*d/360; C = max(N*com, cmin); E = N - D - C - corr
    TAE = (N/E)**(365/d) - 1
    assert close(E*(1+TAE)**(d/365), N)
    a = act()
    add(T4,"Negociación de un efecto y coste efectivo",3,
        f"{cap(a)} descuenta en su banco un efecto de {f(N)} € que vence dentro de {d} días. Condiciones: tanto de descuento {pct(dc)} anual (año comercial), comisión de cobranza {pct(com,2)} del nominal con mínimo de {f(cmin)} €{'' if not corr else f' y {f(corr)} € de correo'}.",
        "Calcula el efectivo líquido y el coste efectivo anual de la operación (compuesto, año de 365 días).", round(E,2),"€",
        "E = N − N·d·t/360 − comisión − gastos;  N = E · (1 + i)^(t/365)",
        [f"Descuento: {f(D)} €", f"Comisión: max({f(N*com)}, {f(cmin)}) = {f(C)} €"] + ([f"Correo: {f(corr)} €"] if corr else []) +
        [f"Efectivo: {f(E)} €", f"Coste efectivo: (N/E)^(365/{d}) − 1 = {pct(TAE,3)}"],
        "Las comisiones con mínimo pesan más en efectos pequeños y cortos: el coste efectivo sube mucho por encima del tanto de descuento.",
        "Tomar el tanto de descuento como coste de la operación.", {"cede_el_cobro": cap(a), "anticipa_dinero": "el banco"},
        extra={"coste_efectivo_pct": round(TAE*100,3)})

def remesa():
    k = R.choice([3,4]); ef = [(R.randrange(500,12000,50), R.choice([15,20,30,40,45,60,75,90])) for _ in range(k)]
    dc = R.choice([.05,.06,.07]); com = R.choice([.004,.005]); cmin = R.choice([3,4,5]); dmin = R.choice([0,15])
    rows=[]; tot=0
    for N,d in ef:
        dd = max(d, dmin); D = N*dc*dd/360; C = max(N*com,cmin); tot += N-D-C; rows.append(f"{f(N)} € a {d} d: descuento {f(D)} € ({dd} d), comisión {f(C)} €")
    a = act(); lista = "; ".join(f"{f(N)} € a {d} días" for N,d in ef)
    add(T4,"Remesa de efectos",2,
        f"{cap(a)} presenta al descuento una remesa: {lista}. Tanto de descuento {pct(dc)} (año comercial); comisión {pct(com,2)} con mínimo {f(cmin)} € por efecto" + (f"; se descuentan como mínimo {dmin} días." if dmin else "."),
        "¿Qué efectivo líquido abona el banco por la remesa?", round(tot,2),"€",
        "Efectivo = Σ [N − N·d·max(t, t_min)/360 − max(N·c, mínimo)]", rows + [f"Total líquido: {f(tot)} €"],
        "Los mínimos (de días y de comisión) se aplican efecto a efecto, no a la remesa.",
        "Aplicar el mínimo de comisión a la remesa entera.", {"cede_el_cobro": cap(a), "anticipa_dinero": "el banco"})

# ---------------- T5 ----------------
def cuenta_corriente():
    base = R.choice([360,365]); i = R.choice([.01,.02,.03]); y = R.choice([0,0,.06])  # interés acreedor; deudor si hay
    days = sorted(R.sample(range(2, 90), 4)); fin = 91
    movs = [(1, R.randrange(2000,8000,100), "Saldo inicial a favor del cliente")]
    for d in days:
        sg = R.choice([1,-1]); movs.append((d, sg*R.randrange(500,6000,100), "Ingreso" if sg>0 else "Pago domiciliado"))
    s = 0; num_a = num_d = 0; lines=[]
    for k,(d,imp,c) in enumerate(movs):
        s += imp; nxt = movs[k+1][0] if k+1 < len(movs) else fin; n = nxt - d
        if s >= 0: num_a += s*n
        else: num_d += -s*n
        lines.append(f"Día {d}: {c} {f(imp)} € → saldo {f(s)} € durante {n} días")
    ia = num_a*i/base; idd = num_d*(y if y else i)/base; final = s + ia - idd
    # comprobación día a día
    s2=0; na=nd=0; mv = dict(); [mv.__setitem__(d, mv.get(d,0)+imp) for d,imp,_ in movs]
    for day in range(1, fin):
        s2 += mv.get(day,0)
        if s2>=0: na+=s2
        else: nd+=-s2
    assert close(na,num_a) and close(nd,num_d)
    a = act()
    add(T5,"Liquidación de cuenta corriente (método hamburgués)",3,
        f"{cap(a)} tiene una cuenta corriente que se liquida trimestralmente (91 días; día 1 a día 91). Movimientos: " + "; ".join(f"día {d}: {c.lower()} {f(abs(imp))} €" for d,imp,c in movs) +
        f". Interés acreedor {pct(i)}" + (f", interés deudor {pct(y)}" if y else " recíproco") + f" anual; base {base}.",
        "Calcula los números acreedores y deudores, los intereses y el saldo tras la liquidación.", round(final,2),"€",
        "Números = saldo · días; intereses = Σ números · i / base", lines +
        [f"Números acreedores: {f(num_a,0)}; deudores: {f(num_d,0)}", f"Intereses a favor: {f(ia)} €; en contra: {f(idd)} €", f"Saldo liquidado: {f(final)} €"],
        "Cuando el saldo cambia de signo, también cambia quién es acreedor: la cuenta cruza los papeles dentro del periodo.",
        "Aplicar el tipo acreedor a saldos deudores cuando los intereses no son recíprocos.", {"acreedor/deudor": "cambia con el signo del saldo"})

def cuenta_credito():
    L = R.randrange(20000, 100000, 5000); disp = round(L*R.uniform(.3,.9),-2); dias = R.choice([90,91,180,182]); i = R.choice([.05,.06,.07,.08])
    cnd = R.choice([.001,.0015,.002]); cap_ = R.choice([.0025,.005])
    Id = disp*i*dias/365; Cnd = (L-disp)*cnd; Ca = L*cap_; tot = Id + Cnd + Ca
    a = act()
    add(T5,"Cuenta de crédito: coste del periodo y TAE",2,
        f"{cap(a)} tiene una póliza de crédito con límite de {f(L)} €. Durante {dias} días ha dispuesto en promedio {f(disp)} €. Interés deudor {pct(i)} anual (base 365); comisión sobre saldo medio no dispuesto {pct(cnd,2)} trimestral sobre el periodo; comisión de apertura {pct(cap_,2)} del límite cargada en este periodo.",
        "¿Cuánto paga en el periodo? ¿Qué parte se debe a no usar todo el crédito?", round(tot,2),"€",
        "Intereses = dispuesto · i · d/365; comisión no dispuesto = (L − dispuesto) · c",
        [f"Intereses: {f(Id)} €", f"No dispuesto: {f(L-disp)} € · {f(cnd,4)} = {f(Cnd)} €", f"Apertura: {f(Ca)} €", f"Total: {f(tot)} €",
         f"TAE (convención simplificada sobre el dispuesto medio): (1 + {f(tot)}/{f(disp)})^(365/{dias}) − 1 = {pct((1+tot/disp)**(365/dias)-1,3)}"],
        "En una póliza también se paga por la disponibilidad: el crédito no usado tiene coste.",
        "Calcular intereses sobre el límite en lugar de sobre lo dispuesto.", {"deudor": cap(a), "acreedor": "el banco"})

# ---------------- T6-T7 rentas ----------------
def a_n(i,n): return (1-(1+i)**-n)/i
def s_n(i,n): return ((1+i)**n-1)/i
def brute_va(c,i,flows): return sum(c*(1+i)**-t for t in flows)

def renta_basica():
    c = R.randrange(500, 15000, 100); i = R.choice([.02,.03,.035,.04,.05,.06]); n = R.choice([4,5,6,8,10,12,15])
    tipo = R.choice(["pos","pre"]); qual = R.choice(["VA","VF"]); a = act()
    va = c*a_n(i,n)*(1+i if tipo=="pre" else 1); vf = va*(1+i)**n
    flows = range(0,n) if tipo=="pre" else range(1,n+1); assert close(va, brute_va(c,i,flows))
    sol = va if qual=="VA" else vf
    add(T6,f"Renta constante {'prepagable' if tipo=='pre' else 'pospagable'}: valor {'actual' if qual=='VA' else 'final'}",1,
        f"{cap(a)} {'aporta' if qual=='VF' else 'recibirá'} {f(c)} € al {'principio' if tipo=='pre' else 'final'} de cada año durante {n} años. Tipo de valoración: {pct(i)} efectivo anual.",
        f"Calcula el valor {'actual' if qual=='VA' else 'final'} de la renta.", round(sol,2),"€",
        ("V₀ = c · a_n|i" if qual=="VA" else "Vₙ = c · s_n|i") + (" · (1 + i)" if tipo=="pre" else ""),
        [f"a_{n}|{f(i*100,1)}% = {f(a_n(i,n),6)}", f"V₀ = {f(va)} €"] + ([f"Vₙ = V₀ · (1 + i)^{n} = {f(vf)} €"] if qual=="VF" else []),
        "Prepagable = pospagable · (1 + i): cada término se valora un periodo antes (o después, en el final).",
        "Olvidar el factor (1 + i) en la prepagable o usar n − 1 términos.", {"perspectiva": cap(a)})

def renta_diferida():
    c = R.randrange(1000, 20000, 500); i = R.choice([.03,.04,.05,.06]); n = R.choice([5,6,8,10]); k = R.choice([2,3,4,5]); a = act()
    va = c*a_n(i,n)*(1+i)**-k; assert close(va, brute_va(c,i,range(k+1,k+n+1)))
    add(T6,"Renta diferida",2,
        f"{cap(a)} firma un contrato por el que recibirá {f(c)} € al final de cada año durante {n} años, pero el primer cobro se produce al final del año {k+1}. Tipo: {pct(i)} efectivo anual.",
        "¿Cuál es el valor actual del contrato?", round(va,2),"€", "V₀ = c · a_n|i · (1 + i)^−k",
        [f"Diferimiento k = {k}", f"c · a_{n}|i = {f(c*a_n(i,n))} € (en t = {k})", f"V₀ = {f(va)} €"],
        "Diferir una renta es valorar como si empezara hoy y descontar el diferimiento.",
        "Contar k + 1 periodos de diferimiento al confundir el primer cobro con el fin del diferimiento.", {"acreedor": cap(a), "deudor": "la contraparte"})

def renta_perpetua():
    c = R.randrange(300, 9000, 100); i = R.choice([.02,.025,.03,.04,.05]); tipo = R.choice(["pos","pre"]); 
    va = c/i*(1+i if tipo=="pre" else 1); assert close(va, brute_va(c,i,range(0 if tipo=="pre" else 1, 5000 if tipo=="pre" else 5001)), 1e-4)
    add(T7,"Renta perpetua",1,
        f"Un local genera un alquiler de {f(c)} € anuales que se cobran al {'principio' if tipo=='pre' else 'final'} de cada año, de forma indefinida. Tipo de valoración: {pct(i)}.",
        "¿Qué valor actual tienen esos cobros?", round(va,2),"€", "V₀ = c / i" + (" · (1 + i)" if tipo=="pre" else ""),
        [f"V₀ = {f(c)} / {f(i,4)}" + (f" · {f(1+i,4)}" if tipo=="pre" else "") + f" = {f(va)} €"],
        "Una perpetuidad tiene valor actual finito porque los términos lejanos casi no valen hoy.",
        "Intentar calcular un valor final (no existe).", {"acreedor": "el propietario", "deudor": "el inquilino"})

def renta_termino():
    V = R.randrange(10000, 150000, 1000); i = R.choice([.03,.04,.05,.06]); n = R.choice([5,6,8,10,12]); tipo = R.choice(["pos","pre"])
    c = V/(a_n(i,n)*(1+i if tipo=="pre" else 1)); assert close(brute_va(c,i,range(0 if tipo=="pre" else 1, n if tipo=="pre" else n+1)), V)
    a = act()
    add(T6,"Despejar el término de una renta",2,
        f"{cap(a)} compra una máquina valorada en {f(V)} € y la paga mediante {n} pagos anuales iguales {'al principio' if tipo=='pre' else 'al final'} de cada año, al {pct(i)} efectivo anual.",
        "¿Qué importe tiene cada pago?", round(c,2),"€", "c = V₀ / [a_n|i" + (" · (1 + i)]" if tipo=="pre" else "]"),
        [f"a_{n}|i = {f(a_n(i,n),6)}", f"c = {f(c)} €"],
        "El término se despeja igualando lo recibido hoy con el valor actual de lo que se paga.",
        "Dividir V₀ entre n.", {"deudor": cap(a), "acreedor": "el vendedor o financiador"})

def renta_fraccionada():
    c = R.randrange(100, 2000, 25); i = R.choice([.03,.04,.05,.06]); n = R.choice([3,4,5,8,10]); m = R.choice([2,4,12])
    im = (1+i)**(1/m)-1; va = c*a_n(im, n*m); assert close(va, brute_va(c, im, range(1, n*m+1)))
    nm = {2:"semestrales",4:"trimestrales",12:"mensuales"}; a = act()
    add(T7,"Renta fraccionada con tipo efectivo anual",2,
        f"{cap(a)} pagará {f(c)} € {nm[m]} vencidos durante {n} años. El tipo de valoración es el {pct(i)} efectivo anual.",
        "¿Qué valor actual tiene la serie de pagos?", round(va,2),"€", f"i_{m} = (1 + i)^(1/{m}) − 1; V₀ = c · a_(n·m)|i_{m}",
        [f"i_{m} = {pct(im,5)}", f"n·m = {n*m} términos", f"V₀ = {f(va)} €"],
        "El tipo debe estar en la misma unidad que la periodicidad de los términos.",
        f"Usar i/{m} cuando el dato es un efectivo anual.", {"deudor": cap(a)})

def renta_n():
    c = R.randrange(500, 6000, 100); i = R.choice([.03,.04,.05,.06]); V = R.randrange(8000, 60000, 1000)
    if V*i >= c: return
    n = -math.log(1 - V*i/c)/math.log(1+i); assert close(c*a_n(i,n), V)
    a = act()
    add(T6,"Número de términos de una renta",3,
        f"{cap(a)} debe {f(V)} € y puede destinar {f(c)} € al final de cada año a pagarlos, al {pct(i)} efectivo anual.",
        "¿Cuántos pagos necesita? Interpreta el resultado si no es entero.", round(n,4),"términos",
        "n = −ln(1 − V₀·i/c) / ln(1 + i)", [f"V₀·i/c = {f(V*i/c,6)}", f"n = {f(n,4)} → {math.ceil(n)} pagos (el último menor) o {math.floor(n)} pagos y un ajuste"],
        "Si n no es entero, el enunciado o el profesor fijan cómo se ajusta: último pago menor, mayor o pago adicional.",
        "Redondear n sin explicar cómo se cierra la deuda.", {"deudor": cap(a)}, criterio="Declarar la convención de ajuste.")

def renta_vs_unico():
    i = R.choice([.03,.04,.05,.06,.07]); c = R.randrange(2000,12000,500); n = R.choice([5,8,10]); U = round(c*a_n(i,n)*R.uniform(.9,1.1),-2)
    va = c*a_n(i,n); th_lo, th_hi = 1e-6, 1
    for _ in range(200):
        m=(th_lo+th_hi)/2
        if c*a_n(m,n) > U: th_lo=m
        else: th_hi=m
    a = act(); best = "la renta" if va > U else "el pago único"
    add(T6,"Criterio: premio en un pago o en renta",3,
        f"{cap(a)} gana un litigio y puede cobrar {f(U)} € hoy o {f(c)} € al final de cada año durante {n} años. Su tipo de valoración es {pct(i)}.",
        "¿Qué opción conviene según ese tipo? ¿A partir de qué tipo cambia la preferencia?", round(va,2),"€ (valor actual de la renta)",
        "Comparar U con c · a_n|i; umbral: i* tal que c · a_n|i* = U",
        [f"V₀(renta) = {f(va)} € frente a {f(U)} €: conviene {best}", f"Umbral: i* = {pct((th_lo+th_hi)/2,3)}"],
        "La preferencia entre cobrar ya o en el tiempo depende del tipo de valoración; el umbral la hace explícita.",
        "Comparar U con c · n.", {"acreedor": cap(a), "deudor": "la parte condenada"}, criterio="Fecha común + umbral.", tipo="criterio")

# ---------------- T8 ----------------
def renta_geom():
    c = R.randrange(1000, 10000, 500); q = R.choice([1.02,1.03,1.04,1.05,.97,.98]); i = R.choice([.03,.04,.05,.06]); n = R.choice([5,6,8,10])
    if abs(q-(1+i))<1e-9: return
    va = c*(1-(q/(1+i))**n)/(1+i-q); assert close(va, sum(c*q**(t-1)*(1+i)**-t for t in range(1,n+1)))
    a = act()
    add(T9,"Renta en progresión geométrica temporal",2,
        f"{cap(a)} prevé unos ingresos de {f(c)} € el primer año (al final), que {'crecerán' if q>1 else 'disminuirán'} un {pct(abs(q-1),0)} anual acumulativo durante {n} años. Tipo de valoración: {pct(i)}.",
        "¿Qué valor actual tienen esos ingresos?", round(va,2),"€", "V₀ = c · [1 − (q/(1 + i))^n] / (1 + i − q)",
        [f"q = {f(q,2)}", f"V₀ = {f(va)} €"],
        "Si los términos crecen, el crecimiento compite con el descuento: lo que importa es q/(1 + i).",
        "Usar la fórmula con q = 1 + i (no es válida; entonces V₀ = n·c/(1 + i)).", {"acreedor": cap(a)})

def renta_arit():
    c = R.randrange(1000, 8000, 250); h = R.choice([100,150,200,250,300,500,-100,-200]); i = R.choice([.03,.04,.05,.06]); n = R.choice([5,6,8,10])
    if c + h*(n-1) <= 0: return
    va = (c + h/i + n*h)*a_n(i,n) - n*h/i; assert close(va, sum((c+h*(t-1))*(1+i)**-t for t in range(1,n+1)))
    a = act()
    add(T8,"Renta en progresión aritmética temporal",2,
        f"{cap(a)} pagará un alquiler de {f(c)} € al final del primer año, que {'aumentará' if h>0 else 'bajará'} {f(abs(h))} € cada año durante {n} años. Tipo: {pct(i)}.",
        "¿Cuál es el valor actual de los pagos?", round(va,2),"€", "V₀ = (c + h/i + n·h) · a_n|i − n·h/i",
        [f"a_{n}|i = {f(a_n(i,n),6)}", f"V₀ = {f(va)} €"],
        "La variación aritmética suma una cantidad fija; su efecto relativo se diluye si los términos son grandes.",
        "Aplicar la fórmula geométrica.", {"deudor": cap(a), "acreedor": "el arrendador"})

# ---------------- Préstamos (ampliación) ----------------
def prestamo_frances():
    C = R.randrange(10000, 200000, 5000); i = R.choice([.03,.04,.05,.06]); n = R.choice([4,5,8,10,15]); a = act()
    cu = C*i/(1-(1+i)**-n); I1 = C*i; A1 = cu - I1; S1 = C - A1
    assert close(brute_va(cu,i,range(1,n+1)), C)
    add(T11,"Préstamo francés anual: cuota y primera fila",2,
        f"{cap(a)} obtiene un préstamo de {f(C)} € al {pct(i)} efectivo anual, amortizable en {n} cuotas anuales constantes vencidas.",
        "Calcula la cuota y la primera fila del cuadro de amortización.", round(cu,2),"€",
        "a = C · i / (1 − (1 + i)^−n); I₁ = C·i; A₁ = a − I₁",
        [f"a = {f(cu)} €", f"I₁ = {f(I1)} €; A₁ = {f(A1)} €; saldo = {f(S1)} €"],
        "En el francés la cuota es constante, los intereses bajan y la amortización sube.",
        "Confundir cuota con amortización de capital.", {"deudor": cap(a), "acreedor": "el banco"})


# ======== Familias añadidas tras leer la guía docente 2022/23 ========
def simple_tantos_eq():
    i = R.choice([.04,.05,.06,.08]); m = R.choice([2,4,12]); C = R.randrange(2000,40000,500); k = R.choice([3,5,7,9]) if m==12 else R.choice([1,2,3])
    im = i/m; Cn = C*(1+im*k); assert close(Cn, C*(1+i*k/m))
    nm={2:"semestres",4:"trimestres",12:"meses"}
    add(T2,"Capitalización simple: tantos de distinta frecuencia",1,
        f"Un depósito de {f(C)} € se remunera al {pct(i)} simple anual. El banco liquida con el tanto equivalente por {nm[m][:-1] if m!=12 else 'mes'}.",
        f"¿Cuál es el tanto equivalente y qué montante se obtiene a los {k} {nm[m]}?", round(Cn,2),"€",
        "En simple, i_m = i / m (tantos proporcionales)", [f"i_{m} = {pct(im,4)}", f"Cₙ = {f(C)} · (1 + {f(im,6)} · {k}) = {f(Cn)} €"],
        "En capitalización simple los tantos equivalentes son proporcionales; en compuesta no.",
        "Usar (1 + i)^(1/m) − 1, que es la equivalencia en compuesta.", {"acreedor":"el depositante","deudor":"el banco"})

def prorroga():
    N = R.randrange(2000,30000,100); t1 = R.choice([30,45,60]); t2 = t1 + R.choice([30,60,90]); d = R.choice([.05,.06,.07,.08])
    N2 = N*(1-d*t1/360)/(1-d*t2/360); assert close(N2*(1-d*t2/360), N*(1-d*t1/360))
    a = act()
    add(T3,"Prórroga de vencimientos",2,
        f"{cap(a)} debe pagar {f(N)} € dentro de {t1} días, pero pide a su acreedor aplazar el pago hasta dentro de {t2} días. Se acuerda la equivalencia con descuento comercial al {pct(d)} (año comercial).",
        "¿Qué nominal debe tener el nuevo pago?", round(N2,2),"€", "N₂ · (1 − d·t₂/360) = N · (1 − d·t₁/360)",
        [f"Valor hoy de la deuda original: {f(N*(1-d*t1/360))} €", f"N₂ = {f(N*(1-d*t1/360))} / (1 − {f(d,4)}·{t2}/360) = {f(N2)} €"],
        "Prorrogar no es gratis: el nuevo nominal es mayor porque el acreedor espera más.",
        "Sumar al nominal el interés de los días de prórroga calculado sobre el nominal (no coincide en descuento comercial).",
        {"deudor":cap(a),"acreedor":"el acreedor"})

def persiana():
    N = R.randrange(500,5000,50); n = R.choice([4,5,6,8,10,12]); p = R.choice([30]); d = R.choice([.05,.06,.07]); com = R.choice([.004,.005]); cmin = R.choice([2,3,4])
    E = sum(N - N*d*(k*p)/360 - max(N*com,cmin) for k in range(1,n+1))
    Ef = n*N - N*d*p*n*(n+1)/2/360 - n*max(N*com,cmin); assert close(E, Ef)
    a = act()
    add(T4,"Descuento de letras persiana",2,
        f"{cap(a)} ha vendido a plazos y recibe {n} letras de {f(N)} € cada una, con vencimientos mensuales (cada 30 días, la primera dentro de 30). Las descuenta hoy: tanto {pct(d)} (año comercial), comisión {pct(com,2)} con mínimo {f(cmin)} € por letra.",
        "¿Qué efectivo obtiene?", round(E,2),"€", "E = n·N − N·d·p·(1 + 2 + … + n)/360 − n·comisión",
        [f"Σ días = 30 · {n}·{n+1}/2 = {30*n*(n+1)//2}", f"Descuento total: {f(N*d*p*n*(n+1)/2/360)} €", f"Comisiones: {n} · {f(max(N*com,cmin))} € = {f(n*max(N*com,cmin))} €", f"E = {f(E)} €"],
        "En una persiana los plazos forman una progresión aritmética: el descuento total se calcula con la suma de la progresión.",
        "Descontar todas las letras al plazo de la última o de la primera.", {"cede_el_cobro":cap(a),"anticipa_dinero":"el banco"})

def resaca():
    N = R.randrange(1000,20000,100); cd = R.choice([.005,.01]); g = R.choice([6,9,12,15]); t = R.choice([15,20,30]); d = R.choice([.06,.07,.08]); c = R.choice([.004,.005])
    cargo = N + N*cd + g; Nr = cargo/(1 - d*t/360 - c)
    assert close(Nr - Nr*d*t/360 - Nr*c, cargo)
    a = act()
    add(T4,"Efecto impagado y letra de resaca",3,
        f"Un efecto de {f(N)} € descontado por {a} resulta impagado. El banco le carga el nominal, una comisión de devolución del {pct(cd,1)} y {f(g)} € de gastos. El librador gira una letra de resaca a {t} días sobre el cliente, que el banco descuenta al {pct(d)} (año comercial) con comisión del {pct(c,1)}.",
        "¿Qué nominal debe tener la letra de resaca para que su efectivo cubra exactamente el cargo?", round(Nr,2),"€",
        "Nᵣ · (1 − d·t/360 − c) = cargo", [f"Cargo = {f(N)} + {f(N*cd)} + {f(g)} = {f(cargo)} €", f"Nᵣ = {f(cargo)} / (1 − {f(d*t/360,6)} − {f(c,4)}) = {f(Nr)} €"],
        "El impago se traslada al deudor original con todos sus costes: la resaca se calcula 'hacia atrás' desde el efectivo que hay que cubrir.",
        "Tomar como nominal el cargo sin descontar los costes de la nueva letra.", {"acreedor":cap(a),"deudor":"el cliente que no pagó"})

def remunerada():
    S = R.randrange(5000,80000,1000); dias = R.choice([90,91,180,182,365]); i = R.choice([.005,.01,.015,.02]); ret = .19; K = R.choice([0,6,12,18])
    I = S*i*dias/365; neto = I*(1-ret) - K; r = (1+neto/S)**(365/dias)-1
    assert close(S*(1+r)**(dias/365), S+neto)
    a = act()
    add(T5,"Cuenta remunerada: rentabilidad efectiva",2,
        f"{cap(a)} mantiene un saldo constante de {f(S)} € durante {dias} días en una cuenta remunerada al {pct(i)} anual (base 365). Se practica una retención del 19 % sobre los intereses" + (f" y el banco cobra {f(K)} € de comisión de mantenimiento." if K else "."),
        "¿Qué rentabilidad efectiva anual obtiene?", round(r*100,4),"%",
        "r = (1 + rendimiento neto / saldo)^(365/d) − 1", [f"Intereses brutos: {f(I)} €", f"Neto: {f(I)}·0,81" + (f" − {f(K)}" if K else "") + f" = {f(neto)} €", f"r = {pct(r,4)}"],
        "La rentabilidad de quien deposita se mide con lo que realmente cobra: retenciones y comisiones la reducen.",
        "Dar el tipo nominal de la cuenta como rentabilidad.", {"acreedor":cap(a),"deudor":"el banco"})

def renta_general():
    k = R.choice([3,4,5]); terms = [(R.randrange(500,8000,100), t) for t in sorted(R.sample(range(1,9),k))]; i = R.choice([.03,.04,.05]); T = R.choice([0, max(t for _,t in terms)])
    V = sum(c*(1+i)**(T-t) for c,t in terms); assert close(V*(1+i)**-T, sum(c*(1+i)**-t for c,t in terms))
    lista = "; ".join(f"{f(c)} € en t = {t}" for c,t in terms)
    add(T6I,"Valor capital de una renta de términos distintos",1,
        f"Una inversión genera estos cobros (años): {lista}. Tipo de valoración {pct(i)} efectivo anual compuesto.",
        f"Calcula el valor capital de la renta en t = {T}.", round(V,2),"€", "V_T = Σ cₛ · (1 + i)^(T − tₛ)",
        [f"{f(c)} · {f(1+i,4)}^{T-t} = {f(c*(1+i)**(T-t))}" for c,t in terms] + [f"V_{T} = {f(V)} €"],
        "Una renta es un conjunto de capitales; su valor es la suma de todos valorados en el mismo punto.",
        "Valorar cada término en un punto distinto.", {"acreedor":"el inversor"})

def renta_anticipada():
    c = R.randrange(500,8000,100); i = R.choice([.03,.04,.05]); n = R.choice([5,6,8,10]); p = R.choice([2,3,4])
    V = c*s_n(i,n)*(1+i)**p; assert close(V, sum(c*(1+i)**(n+p-t) for t in range(1,n+1)))
    a = act()
    add(T7,"Renta anticipada p periodos",2,
        f"{cap(a)} ingresa {f(c)} € al final de cada año durante {n} años en un fondo al {pct(i)}. Deja el saldo invertido {p} años más tras el último ingreso.",
        f"¿Qué capital tendrá {p} años después del último ingreso?", round(V,2),"€", "V = c · s_n|i · (1 + i)^p",
        [f"c · s_{n}|i = {f(c*s_n(i,n))} €", f"V = {f(V)} €"],
        "Anticipar la renta p periodos es valorarla p periodos después de su final.",
        "Confundir renta anticipada con prepagable.", {"acreedor":cap(a),"deudor":"el fondo"})

def renta_tanto_var():
    c = R.randrange(1000,9000,250); n = R.choice([6,8,10]); k = R.choice([2,3,4]); i1, i2 = R.sample([.02,.03,.04,.05,.06],2)
    V = c*a_n(i1,k) + c*a_n(i2,n-k)*(1+i1)**-k
    brute = sum(c*((1+i1)**-t if t<=k else (1+i1)**-k*(1+i2)**-(t-k)) for t in range(1,n+1)); assert close(V, brute)
    add(T7,"Renta constante con tanto de valoración variable",3,
        f"Una renta de {n} términos anuales vencidos de {f(c)} € se valora al {pct(i1)} durante los {k} primeros años y al {pct(i2)} los restantes.",
        "¿Cuál es su valor actual?", round(V,2),"€", "V₀ = c · a_k|i₁ + c · a_(n−k)|i₂ · (1 + i₁)^−k",
        [f"Tramo 1: {f(c*a_n(i1,k))} €", f"Tramo 2 en t = {k}: {f(c*a_n(i2,n-k))} €, descontado: {f(c*a_n(i2,n-k)*(1+i1)**-k)} €", f"V₀ = {f(V)} €"],
        "Cuando el tipo cambia, cada tramo se descuenta con el tipo de su periodo hasta la fecha de valoración.",
        "Descontar el segundo tramo con i₂ hasta el origen.", {})

def arit_perpetua():
    c = R.randrange(1000,6000,250); h = R.choice([50,100,150,200]); i = R.choice([.04,.05,.06])
    V = c/i + h/i**2; brute = sum((c+h*(t-1))*(1+i)**-t for t in range(1,6000)); assert close(V, brute, 1e-5)
    add(T8,"Renta en progresión aritmética perpetua",2,
        f"Un inmueble genera un alquiler de {f(c)} € al final del primer año, que aumenta {f(h)} € cada año indefinidamente. Tipo de valoración {pct(i)}.",
        "¿Qué valor actual tiene el alquiler?", round(V,2),"€", "V₀ = c/i + h/i²",
        [f"c/i = {f(c/i)} €", f"h/i² = {f(h/i**2)} €", f"V₀ = {f(V)} €"],
        "Una perpetuidad creciente aritméticamente sigue teniendo valor finito porque el descuento es geométrico.",
        "Olvidar el término h/i².", {"acreedor":"el propietario","deudor":"el inquilino"})

def arit_fracc():
    Cm = R.randrange(200,1500,50); d = R.choice([10,20,25,50]); m = R.choice([4,12]); n = R.choice([3,4,5]); i = R.choice([.03,.04,.05])
    im = (1+i)**(1/m)-1; brute = sum((Cm+d*(y))*(1+im)**-(y*m+j) for y in range(n) for j in range(1,m+1))
    S = s_n(im,m); c, h = Cm*S, d*S; V = (c + h/i + n*h)*a_n(i,n) - n*h/i; assert close(V, brute)
    nm={4:"trimestrales",12:"mensuales"}
    add(T8,"Aritmética con cuantía fraccionada (Cm, d)",3,
        f"Se pagarán cuotas {nm[m]} vencidas de {f(Cm)} € durante el primer año; cada año siguiente la cuota {nm[m][:-1]} aumenta {f(d)} €. Duración {n} años; tipo {pct(i)} efectivo anual.",
        "¿Cuál es el valor actual?", round(V,2),"€", f"Término anual equivalente: Cₖ · s_{m}|i_{m}; luego renta aritmética anual con c = Cm·s, h = d·s",
        [f"i_{m} = {pct(im,5)}; s_{m}|i_{m} = {f(S,6)}", f"c = {f(c)} €; h = {f(h)} €", f"V₀ = {f(V)} €"],
        "Primero se convierte cada año en un término anual equivalente; después se aplica la progresión anual.",
        "Aplicar la razón d a cada término fraccionado dentro del mismo año.", {})

def geom_perpetua():
    c = R.randrange(1000,8000,250); g = R.choice([.01,.015,.02,.025]); i = R.choice([.04,.05,.06]); q = 1+g
    V = c/(1+i-q); brute = sum(c*q**(t-1)*(1+i)**-t for t in range(1,8000)); assert close(V, brute, 1e-5)
    add(T9,"Renta en progresión geométrica perpetua",2,
        f"Un dividendo de {f(c)} € al final del primer año crecerá un {pct(g,1)} anual acumulativo indefinidamente. Tipo de valoración {pct(i)}.",
        "¿Qué valor actual tiene?", round(V,2),"€", "V₀ = c / (1 + i − q), válida si q < 1 + i",
        [f"q = {f(q,3)}", f"V₀ = {f(c)} / {f(1+i-q,4)} = {f(V)} €"],
        "La perpetuidad geométrica solo tiene valor finito si el crecimiento es menor que el tipo.",
        "Aplicarla con q ≥ 1 + i.", {"acreedor":"el accionista"})

def geom_fracc():
    Cm = R.randrange(200,1500,50); q = R.choice([1.02,1.03,1.05]); m = R.choice([4,12]); n = R.choice([3,4,5]); i = R.choice([.03,.04,.05])
    if abs(q-1-i) < 1e-9: return
    im = (1+i)**(1/m)-1; brute = sum(Cm*q**y*(1+im)**-(y*m+j) for y in range(n) for j in range(1,m+1))
    S = s_n(im,m); c = Cm*S; V = c*(1-(q/(1+i))**n)/(1+i-q); assert close(V, brute)
    nm={4:"trimestrales",12:"mensuales"}
    add(T9,"Geométrica con cuantía fraccionada (Cm, q)",3,
        f"Una empresa pagará cuotas {nm[m]} vencidas de {f(Cm)} € el primer año; cada año las cuotas crecen un {pct(q-1,0)}. Duración {n} años; tipo {pct(i)} efectivo anual.",
        "¿Cuál es el valor actual?", round(V,2),"€", "c = Cm · s_m|i_m; V₀ = c · [1 − (q/(1+i))^n] / (1 + i − q)",
        [f"i_{m} = {pct(im,5)}; c = {f(c)} €", f"V₀ = {f(V)} €"],
        "El crecimiento es anual: dentro de cada año los términos fraccionados son iguales.",
        "Hacer crecer cada término fraccionado.", {})

def schedule(C, rates, cuotas):
    s = C; rows=[]
    for k,(i,a) in enumerate(zip(rates,cuotas),1):
        I = s*i; A = a - I; s -= A; rows.append((k,a,I,A,s))
    return rows

def amort_constante():
    C = R.randrange(12000,150000,6000); n = R.choice([4,5,6,8,10]); i = R.choice([.04,.05,.06]); k = R.randint(2,n)
    A = C/n; ak = A + (C-(k-1)*A)*i; Ck = C - k*A; It = sum((C-(t-1)*A)*i for t in range(1,n+1))
    rows = schedule(C,[i]*n,[A+(C-(t-1)*A)*i for t in range(1,n+1)]); assert close(rows[k-1][1], ak) and close(rows[k-1][4], Ck) and abs(rows[-1][4])<1e-6
    a = act()
    add(T11,"Préstamo con cuotas de amortización constantes",2,
        f"{cap(a)} recibe {f(C)} € al {pct(i)} anual, a devolver en {n} años con cuotas de amortización constantes (método lineal).",
        f"Calcula el término amortizativo del año {k}, el capital pendiente tras pagarlo y el total de intereses.", round(ak,2),"€",
        "A = C/n; aₖ = A + Cₖ₋₁ · i; Cₖ = C − k·A", [f"A = {f(A)} €", f"C_{k-1} = {f(C-(k-1)*A)} €; I_{k} = {f((C-(k-1)*A)*i)} €", f"a_{k} = {f(ak)} €; C_{k} = {f(Ck)} €", f"Intereses totales: {f(It)} €"],
        "En el método lineal los términos decrecen: la amortización es fija y los intereses bajan.",
        "Confundir cuota de amortización (A) con término amortizativo (a).", {"deudor":cap(a),"acreedor":"el banco"})

def frances_mensual():
    C = R.randrange(20000,200000,5000); y = R.choice([5,6,8,10,12,15]); j = R.choice([.024,.03,.036,.042,.048,.06]); i = j/12; n = 12*y
    a = C/a_n(i,n); k = R.randint(13, n-12); Ckm1 = a*a_n(i,n-k+1); Ik = Ckm1*i; Ak = a-Ik
    ys = R.randint(2,y-1); Cys = a*a_n(i,n-12*(ys-1)); tm = R.randint(12, n-6); A1 = a - C*i; mt = A1*s_n(i,tm)
    rows = schedule(C,[i]*n,[a]*n); assert close(rows[k-1][2], Ik) and close(rows[12*(ys-1)-1][4], Cys) and close(C-rows[tm-1][4], mt)
    a_ = act()
    add(T11,"Préstamo francés mensual: cuota, descomposición, pendiente y amortizado",3,
        f"Una entidad concede a {a_} un préstamo de {f(C)} € a {y} años, al {pct(j,1)} nominal anual, con términos amortizativos mensuales constantes.",
        f"Calcula: 1) la mensualidad; 2) la descomposición de la mensualidad {k}; 3) el capital pendiente al principio del año {ys}; 4) el capital amortizado tras {tm} meses.", round(a,2),"€ (mensualidad)",
        "i₁₂ = j/12; a = C / a_n|i₁₂; Cₖ₋₁ = a · a_(n−k+1)|i₁₂; Iₖ = Cₖ₋₁·i₁₂; mₜ = A₁ · s_t|i₁₂",
        [f"n = {n}; i₁₂ = {pct(i,4)}", f"a = {f(a)} €", f"C_{k-1} = {f(Ckm1)} €; I_{k} = {f(Ik)} €; A_{k} = {f(Ak)} €",
         f"C_{12*(ys-1)} = a · a_{n-12*(ys-1)}|i₁₂ = {f(Cys)} €", f"A₁ = {f(A1)} €; m_{tm} = {f(mt)} €"],
        "El pendiente es el valor actual de los términos que faltan; lo amortizado crece como una renta de las cuotas de amortización (A₁ · s_t).",
        "Contar mal los términos pendientes (n − k frente a n − k + 1) o usar el efectivo anual en lugar de j/12.",
        {"deudor":cap(a_),"acreedor":"la entidad financiera"},
        extra={"respuestas":{"mensualidad":round(a,2),"I_k":round(Ik,2),"A_k":round(Ak,2),"pendiente_inicio_año":round(Cys,2),"amortizado":round(mt,2)}})

def carencia_prest():
    C = R.randrange(20000,150000,5000); n = R.choice([5,6,8,10]); k = R.choice([1,2]); i = R.choice([.04,.05,.06]); tipo = R.choice(["parcial","total"])
    base = C if tipo=="parcial" else C*(1+i)**k; a = base/a_n(i,n-k)
    cu = ([C*i]*k if tipo=="parcial" else [0]*k) + [a]*(n-k)
    s=C
    for t in range(n): s = s*(1+i) - cu[t]
    assert abs(s) < 1e-6
    a_ = act()
    add(T12,f"Amortización con carencia {tipo}",2,
        f"{cap(a_)} obtiene {f(C)} € al {pct(i)} anual a {n} años, con {k} año{'s' if k>1 else ''} de carencia {tipo} y después método francés anual.",
        "Calcula los pagos durante la carencia y el término amortizativo posterior.", round(a,2),"€",
        ("Carencia parcial: se pagan C·i; a = C / a_(n−k)|i" if tipo=="parcial" else "Carencia total: C·(1+i)^k; a = C(1+i)^k / a_(n−k)|i"),
        [f"Durante la carencia: {f(C*i) if tipo=='parcial' else '0'} € al año", f"Capital a amortizar: {f(base)} €", f"a = {f(a)} €"],
        "La carencia aplaza pagos, no los elimina; en la total los intereses se capitalizan.",
        "Amortizar en n términos en lugar de n − k.", {"deudor":cap(a_),"acreedor":"el banco"})

def interes_variable():
    C = R.randrange(30000,200000,5000); n = R.choice([8,10,15]); k = R.choice([2,3,4]); i1 = R.choice([.03,.035,.04]); i2 = i1 + R.choice([-.01,-.005,.005,.01,.015])
    a1 = C/a_n(i1,n); Ck = a1*a_n(i1,n-k); a2 = Ck/a_n(i2,n-k)
    rows = schedule(C,[i1]*k+[i2]*(n-k),[a1]*k+[a2]*(n-k)); assert abs(rows[-1][4])<1e-6
    a_ = act()
    add(T12,"Préstamo a interés variable: revisión del término",3,
        f"{cap(a_)} firma un préstamo de {f(C)} € a {n} años, francés anual, al {pct(i1,2)} los {k} primeros años. En la revisión, el tipo pasa al {pct(i2,2)}.",
        "¿Cuál es el nuevo término amortizativo?", round(a2,2),"€", "a₁ = C / a_n|i₁; C_k = a₁ · a_(n−k)|i₁; a₂ = C_k / a_(n−k)|i₂",
        [f"a₁ = {f(a1)} €", f"C_{k} = {f(Ck)} €", f"a₂ = {f(a2)} €"],
        "En la revisión se recalcula el término sobre el capital pendiente y el plazo que queda.",
        "Recalcular sobre el capital inicial o el plazo total.", {"deudor":cap(a_),"acreedor":"el banco"},
        criterio="El riesgo de tipo lo asume el deudor en el variable.")

def anticipada():
    C = R.randrange(40000,200000,5000); n = R.choice([10,12,15]); i = R.choice([.03,.04,.05]); k = R.choice([3,4,5]); X = round(C*R.uniform(.1,.25),-3); fc = R.choice([0,.005,.01])
    a = C/a_n(i,n); Ck = a*a_n(i,n-k); N = Ck - X; modo = R.choice(["cuota","plazo"])
    if modo=="cuota":
        sol = N/a_n(i,n-k); rows = schedule(N,[i]*(n-k),[sol]*(n-k)); assert abs(rows[-1][4])<1e-6
        txt = f"Nuevo término: a' = {f(N)} / a_{n-k}|i = {f(sol)} €"; unidad="€"
    else:
        sol = -math.log(1-N*i/a)/math.log(1+i); assert close(a*a_n(i,sol), N); txt = f"n' = −ln(1 − {f(N)}·{f(i,4)}/{f(a)}) / ln({f(1+i,4)}) = {f(sol,4)} años"; unidad="años"
    a_ = act()
    add(T12,"Amortización anticipada parcial y compensación",3,
        f"{cap(a_)} tiene un préstamo de {f(C)} € a {n} años, francés anual al {pct(i)}. Tras pagar el término del año {k} amortiza anticipadamente {f(X)} €" + (f", con una compensación del {pct(fc,1)} sobre lo amortizado" if fc else ", sin compensación") + f", y decide {'reducir el término manteniendo el plazo' if modo=='cuota' else 'mantener el término y reducir el plazo'}.",
        f"Calcula el capital pendiente, la compensación y {'el nuevo término' if modo=='cuota' else 'el nuevo plazo'}.", round(sol, 2 if modo=='cuota' else 4), unidad,
        "C_k = a · a_(n−k)|i; nuevo pendiente = C_k − X; compensación = f · X",
        [f"a = {f(a)} €", f"C_{k} = {f(Ck)} €", f"Compensación: {f(fc*X)} €", f"Nuevo pendiente: {f(N)} €", txt],
        "Reducir término alivia la caja; reducir plazo ahorra más intereses. La compensación es el precio de cancelar antes.",
        "Restar X del capital inicial en lugar del pendiente.", {"deudor":cap(a_),"acreedor":"el banco"},
        criterio="Elegir entre cuota y plazo depende del objetivo: liquidez o coste.")

def tantos_efectivos_prest():
    C = R.randrange(20000,150000,5000); n = R.choice([5,8,10]); i = R.choice([.03,.04,.05]); com = R.choice([.005,.01,.015]); G = R.choice([300,500,800,1200])
    a = C/a_n(i,n)
    def irr(net):
        lo,hi=1e-7,1
        for _ in range(200):
            m=(lo+hi)/2
            if a*a_n(m,n) > net: lo=m
            else: hi=m
        return (lo+hi)/2
    rp = irr(C - C*com - G); rl = irr(C - C*com); assert rp > rl > i - 1e-9
    a_ = act()
    add(T12,"Tantos efectivos: prestatario y prestamista",3,
        f"{cap(a_)} recibe un préstamo de {f(C)} € a {n} años, francés anual al {pct(i)}. Paga al banco una comisión de apertura del {pct(com,1)} y {f(G)} € de notaría y registro (que cobran terceros).",
        "Calcula el coste efectivo para el prestatario y la rentabilidad efectiva para el prestamista. ¿Por qué difieren?", round(rp*100,4),"% (coste prestatario)",
        "Prestatario: C − comisión − gastos = a · a_n|r; prestamista: C − comisión = a · a_n|r'",
        [f"a = {f(a)} €", f"Coste prestatario: {pct(rp,4)}", f"Rentabilidad prestamista: {pct(rl,4)}", "Los gastos pagados a terceros solo afectan al prestatario."],
        "Coste del deudor y rentabilidad del acreedor solo coinciden si todos los gastos pasan de una parte a la otra.",
        "Usar la misma tasa para las dos partes.", {"deudor":cap(a_),"acreedor":"el banco","terceros":"notaría y registro"},
        criterio="Cambiar de perspectiva: mismos flujos entre partes, distintos gastos propios.", tipo="criterio",
        extra={"rentabilidad_prestamista_pct":round(rl*100,4)})

CRIT_EXTRA = [
 ("¿Ley de capitalización o de descuento?", "Te piden 'el capital que hay que entregar hoy para disponer de X dentro de un año'.", "Es una operación de descuento (valor actual), aunque se resuelva con la ley de capitalización inversa si el enunciado lo indica.", "Identificar el sentido de la operación antes de la fórmula."),
 ("¿Comparación de capitales?", "Dos capitales (5.000 €, año 1) y (5.200 €, año 2) y una ley de capitalización compuesta al 3 %.", "Al 3 % el segundo vale más en cualquier fecha común: 5.200/1,03 = 5.048,54 > 5.000.", "Preferencia financiera = comparar en la misma fecha con una ley."),
 ("¿Qué parte del examen?", "Guía 2026/27: hay que sacar un 40 % en teoría y un 40 % en cada ejercicio práctico; la teoría se corrige primero.", "Un ejercicio práctico flojo o una teoría por debajo del 40 % suspende aunque la media sea alta: hay que entrenar teoría y todos los tipos de ejercicio.", "Repartir el entrenamiento por partes del examen, no por gusto."),
]


# ======== Teoría y demostraciones (la guía corrige primero la teoría: mínimo 40 %) ========
TEORIA = [
 (T1,"Define capital financiero y explica por qué (C₁, t₁) y (C₂, t₂) no se comparan solo por la cuantía.","Un capital financiero es un par (C, t): cuantía y momento de disponibilidad. Dos capitales se comparan con una ley financiera que los lleva a una misma fecha; a igual cuantía se prefiere el más próximo (principio de subestimación de capitales futuros).","Cuantía y tiempo son inseparables."),
 (T1,"¿Qué es una ley financiera y qué propiedades debe cumplir una ley de capitalización?","Una función que asigna a cada capital su equivalente en otra fecha. Una ley de capitalización L(t, p) debe ser positiva, valer 1 cuando t = p y ser creciente con el tiempo de capitalización.","Conocer las propiedades sirve para reconocer leyes válidas."),
 (T1,"Elementos de una operación financiera: prestación, contraprestación y equilibrio financiero.","Prestación: capitales que entrega una parte; contraprestación: los que entrega la otra. La operación está en equilibrio cuando ambas tienen el mismo valor en cualquier fecha con la ley pactada.","Toda operación se plantea como igualdad prestación = contraprestación."),
 (T2,"Demuestra que en capitalización simple los tantos equivalentes son proporcionales: i_m = i/m.","Equivalencia: C(1 + i·1) = C(1 + i_m·m) ⇒ i = m·i_m ⇒ i_m = i/m.","Equivalencia = mismo montante en el mismo plazo."),
 (T2,"Demuestra la relación entre tantos equivalentes en capitalización compuesta.","C(1 + i) = C(1 + i_m)^m ⇒ i_m = (1 + i)^(1/m) − 1; con nominal j(m) = m·i_m.","En compuesta los tantos equivalentes no son proporcionales."),
 (T2,"Compara gráficamente la capitalización simple y la compuesta. ¿Cuándo da más montante cada una?","Para 0 < t < 1, (1 + i·t) > (1 + i)^t; en t = 1 coinciden; para t > 1 la compuesta es mayor. La simple es lineal; la compuesta, exponencial.","El plazo decide qué ley favorece al acreedor."),
 (T2,"Deduce el descuento comercial y explica el tanto de interés equivalente al tanto de descuento.","D = N·d·t; E = N(1 − d·t). Equivalente: N(1 − d·t)(1 + i·t) = N ⇒ i = d/(1 − d·t), mayor que d.","El descuento comercial se calcula sobre el nominal."),
 (T3,"Demuestra que en descuento comercial el vencimiento medio no depende del tanto.","Σ N_s(1 − d·t_s) = (Σ N_s)(1 − d·t) ⇒ Σ N_s·t_s = t·Σ N_s ⇒ t = Σ N_s t_s / Σ N_s, sin d.","Vencimiento medio = media ponderada por nominales."),
 (T3,"Diferencia entre vencimiento común, vencimiento medio y sustitución de capitales.","Común: se busca la fecha de un capital dado que sustituye a varios. Medio: caso particular en que el capital único es la suma de nominales. Sustitución: se fija la fecha y se busca la cuantía.","Saber qué incógnita pide cada caso."),
 (T4,"¿Qué es el tanto efectivo (TAE) de una operación de descuento y qué gastos incluye?","Es el tanto anual compuesto que iguala el efectivo líquido recibido con el nominal pagado al vencimiento: E(1 + TAE)^(t/365) = N. Incluye descuento, comisiones y gastos que cobra el banco; según la normativa, excluye los pagados a terceros.","El coste real no es el tanto de descuento."),
 (T4,"Explica qué es una letra de resaca y por qué su nominal es mayor que el del efecto impagado.","Es la letra que gira el librador al deudor para recuperar el impagado y todos los gastos. Su nominal debe cubrir el cargo y los costes de descontarla: Nᵣ(1 − d·t − c) = cargo.","Se calcula hacia atrás desde el efectivo necesario."),
 (T5,"Describe el método hamburgués de liquidación de cuentas corrientes.","Se ordenan los movimientos por fecha valor, se calcula el saldo tras cada uno y los días que se mantiene; números = saldo × días; intereses = Σ números · i / base, separando acreedores y deudores.","Cada saldo genera intereses solo mientras se mantiene."),
 (T5,"Clasifica las cuentas corrientes según el tipo de interés.","Interés recíproco (mismo tipo para saldos acreedores y deudores), no recíproco (tipos distintos) y variable (el tipo cambia en el periodo).","El signo del saldo decide qué tipo aplicar si no hay reciprocidad."),
 (T6I,"Define renta y valor capital; clasifica las rentas.","Renta: sucesión de capitales con vencimientos periódicos. Valor capital en t: suma de todos los términos valorados en t. Clasificación: constantes/variables, temporales/perpetuas, pospagables/prepagables, inmediatas/diferidas/anticipadas, enteras/fraccionadas.","Clasificar la renta elige la fórmula."),
 (T7,"Demuestra el valor actual de una renta constante, temporal, pospagable e inmediata.","V₀ = c[(1+i)^−1 + … + (1+i)^−n], progresión geométrica de razón (1+i)^−1: V₀ = c · (1 − (1+i)^−n)/i = c · a_n¬i.","Suma de una progresión geométrica."),
 (T7,"Demuestra que ä_n¬i = (1 + i) · a_n¬i y que s_n¬i = a_n¬i · (1 + i)^n.","Cada término prepagable vence un periodo antes que el pospagable: se valora (1+i) veces más. El valor final es el actual capitalizado n periodos.","Relaciones entre valores, no fórmulas nuevas."),
 (T7,"Deduce el valor de una renta perpetua pospagable.","V₀ = lim n→∞ c·(1 − (1+i)^−n)/i = c/i, porque (1+i)^−n → 0 si i > 0.","Límite de la temporal."),
 (T7,"Diferencia entre renta diferida y renta anticipada.","Diferida h periodos: empieza tras h periodos; se valora h·a_n¬i·(1+i)^−h. Anticipada p periodos: se valora p periodos después de su final: s_n¬i·(1+i)^p.","Diferir mueve el inicio; anticipar mueve el punto de valoración."),
 (T8,"Deduce el valor actual de una renta en progresión aritmética pospagable.","Con términos c, c+d, …: V₀ = (c + d/i + n·d) · a_n¬i − n·d/i.","Descomponer en renta constante más rentas escalonadas."),
 (T9,"Deduce el valor actual de una renta en progresión geométrica pospagable y su condición en perpetuidad.","V₀ = c[1 − qⁿ(1+i)^−n]/(1 + i − q) si q ≠ 1 + i; si q = 1 + i, V₀ = n·c/(1+i). Perpetua: c/(1 + i − q), solo si q < 1 + i.","El cociente q/(1+i) gobierna la convergencia."),
 (T11,"Planteamiento general de una operación de amortización: relación de recurrencia.","C_k = C_{k−1}(1 + i) − a_k; a_k = I_k + A_k; I_k = C_{k−1}·i; Σ A_k = C₀; C₀ = Σ a_k (1+i)^−k.","Cuatro igualdades que valen para cualquier método."),
 (T11,"Capital pendiente por el método prospectivo y retrospectivo.","Prospectivo: C_k = valor en k de los términos que faltan. Retrospectivo: C_k = C₀(1+i)^k − valor en k de los términos pagados. Ambos coinciden por el equilibrio financiero.","Dos caminos, mismo resultado: sirve para comprobar."),
 (T11,"Método lineal: demuestra que los términos amortizativos decrecen en progresión aritmética de razón −A·i.","A_k = C₀/n constante; I_k = C_{k−1}i y C_k = C_{k−1} − A ⇒ a_{k+1} − a_k = (C_k − C_{k−1})i = −A·i.","Amortización fija, intereses decrecientes."),
 (T11,"Método francés: demuestra que las cuotas de amortización crecen en progresión geométrica de razón (1 + i).","a constante: A_{k+1} + C_k i = A_k + C_{k−1} i ⇒ A_{k+1} = A_k + A_k i = A_k(1 + i). Por tanto m_k = A₁·s_k¬i.","De aquí sale el total amortizado."),
 (T12,"Carencia parcial frente a total: efecto sobre el capital y los términos.","Parcial: se pagan intereses y el capital no cambia; total: no se paga nada y C₀ se capitaliza (1+i)^h. Después se amortiza con n − h términos.","La carencia mueve pagos, no los elimina."),
 (T12,"Amortización anticipada: opciones y compensación.","Tras pagar el término k, se entrega X: el pendiente pasa a C_k − X. Se puede mantener el plazo (baja el término) o el término (baja el plazo). La compensación es un porcentaje de X que cobra el prestamista.","Elegir según liquidez o ahorro de intereses."),
 (T12,"Tantos efectivos de un préstamo: prestatario, prestamista y TAE.","Prestatario: iguala lo recibido neto de todos sus gastos con los términos. Prestamista: lo entregado menos lo que cobra (comisiones) con los términos. TAE: según normativa, incluye los gastos que percibe la entidad.","Cada parte tiene su propio tanto efectivo."),
]
def teoria_items():
    for tema, q, a, pat in TEORIA:
        add(tema, "Teoría y demostraciones", 2, q, "Responde y, si procede, demuestra.", None, "", "Respuesta teórica", [a], pat,
            "Recitar la fórmula sin justificarla: la guía exige un 40 % en teoría antes de corregir la práctica.", {}, tipo="teoria")

# ---------------- Criterio sin cálculo ----------------
CRIT = [
 ("¿Quién es el acreedor?", "Una empresa compra letras del Tesoro a 12 meses.", "La empresa es acreedora del Estado: entrega dinero hoy y cobra al vencimiento.", "Situar las partes no depende del tipo de entidad."),
 ("¿Quién es el acreedor?", "Un banco recibe un depósito a plazo de una cooperativa.", "La cooperativa es acreedora; el banco es deudor del depósito.", "El banco no es siempre acreedor."),
 ("¿Faltan datos?", "Te piden comparar 4.000 € hoy con 4.300 € dentro de dos años.", "Falta el tipo de valoración (o la ley). Sin él solo cabe dar la decisión en función de un umbral: 3,68 % compuesto.", "Sin tipo no hay fecha común."),
 ("¿Faltan datos?", "Te piden la TAE de un préstamo del que conoces el tipo nominal y la periodicidad, pero el enunciado menciona una comisión de estudio sin importe.", "Falta el importe de la comisión; sin ella se puede dar el efectivo sin gastos, declarándolo.", "Distinguir dato ausente de dato irrelevante."),
 ("¿Qué criterio?", "Dos préstamos con distinto plazo y misma cuota mensual.", "La cuota no compara coste: hay que comparar tipos efectivos (o valores actuales al mismo tipo).", "Menor o igual cuota no implica igual coste."),
 ("¿Qué ley?", "Un enunciado dice 'descuento comercial al 6 %, año comercial' y te piden el efectivo a 90 días.", "Ley de descuento comercial simple, base 360: E = N(1 − 0,06·90/360).", "La ley la fija el enunciado, no la intuición."),
 ("¿Prepagable o pospagable?", "Un alquiler se paga 'por meses anticipados'.", "Prepagable: el primer término se paga en t = 0.", "'Anticipado' = prepagable; 'vencido' = pospagable."),
 ("¿Tipo equivalente?", "Te dan 6 % nominal capitalizable trimestralmente y los pagos son mensuales.", "Pasar a efectivo anual (6,1364 %) y de ahí a mensual (0,4975 %), no dividir 6 % entre 12.", "La periodicidad del tipo debe igualar la de los términos."),
 ("¿Cambio de perspectiva?", "Has calculado el efectivo de un descuento desde la empresa. Ahora te preguntan el rendimiento para el banco.", "Mismas fechas y cuantías: el banco entrega E y cobra N. Su rendimiento coincide con el coste de la empresa si no hay gastos que solo afecten a una parte.", "Gastos de una sola parte rompen la simetría."),
 ("¿Concluir o condicionar?", "Una oferta tiene menor TAE y otra menor cuota; no se dice el objetivo de la empresa.", "No hay alternativa universalmente mejor: por coste, la de menor TAE; por liquidez, la de menor cuota.", "No forzar una decisión única."),
]
def criterio_items():
    for q, sit, sol, pat in CRIT + CRIT_EXTRA:
        add(T1, "Criterio: leer el enunciado sin calcular", 1, sit, q, None, "", "Sin cálculo", [sol], pat,
            "Responder calculando sin haber situado la pregunta.", {}, criterio=pat, tipo="criterio")

FAMS = [(cs_montante,26),(cs_despeje,26),(descuento_com,26),(cc_montante,26),(cc_actual,22),(tantos_eq,26),(simple_vs_compuesta,20),
        (capital_comun,26),(venc_comun,22),(venc_medio,22),(elegir_planes,22),(efecto,30),(remesa,22),(cuenta_corriente,26),(cuenta_credito,20),
        (renta_basica,30),(renta_diferida,22),(renta_perpetua,20),(renta_termino,24),(renta_fraccionada,24),(renta_n,22),(renta_vs_unico,22),
        (renta_geom,22),(renta_arit,22),(prestamo_frances,18),(simple_tantos_eq,18),(prorroga,20),(persiana,20),(resaca,20),(remunerada,20),(renta_general,18),(renta_anticipada,18),(renta_tanto_var,18),(arit_perpetua,16),(arit_fracc,18),(geom_perpetua,16),(geom_fracc,18),(amort_constante,22),(frances_mensual,26),(carencia_prest,22),(interes_variable,20),(anticipada,22),(tantos_efectivos_prest,20)]
for fn, k in FAMS:
    start, tries = len(OUT), 0
    while len(OUT) - start < k and tries < k*4:
        fn(); tries += 1
criterio_items()
teoria_items()


# ======== Metadatos de criterio por familia (para la práctica de criterio) ========
M_VF, M_VA, M_TIPO, M_TIEMPO, M_EFECT, M_TAE, M_CAP, M_FECHA, M_SALDO, M_TERM, M_N, M_DEC, M_COSTE = (
 "Montante o valor final", "Valor actual", "Un tipo de interés o tanto equivalente", "Un tiempo o plazo", "El efectivo líquido de un descuento",
 "Un coste o una rentabilidad efectiva", "La cuantía de un capital que sustituye a otros", "Una fecha de vencimiento", "El saldo y los intereses de una cuenta",
 "El término (cuota) de una renta o de un préstamo", "Un número de términos", "Una decisión entre alternativas", "El coste de un periodo (intereses y comisiones)")
L_SIM, L_COM, L_DCO, L_REN, L_AMO, L_HAM, L_TIR, L_CMP = (
 "Capitalización simple: el interés es proporcional al tiempo", "Capitalización compuesta: los intereses generan intereses",
 "Descuento comercial: el descuento se calcula sobre el nominal", "Valor de una renta: suma de términos valorados en compuesta",
 "Equivalencia del préstamo: capital = valor actual de los términos", "Método hamburgués: números = saldo × días",
 "Tanto efectivo: el tipo que iguala lo recibido con lo pagado", "Comparar las alternativas en una fecha común con la ley dada")
FAMMETA = {
 "Capitalización simple: montante": (M_VF, L_SIM), "Capitalización simple: despejar el tiempo": (M_TIEMPO, L_SIM),
 "Capitalización simple: despejar el tipo": (M_TIPO, L_SIM), "Capitalización simple: tantos de distinta frecuencia": (M_TIPO, L_SIM),
 "Capitalización compuesta: montante": (M_VF, L_COM), "Descuento compuesto: valor actual": (M_VA, L_COM),
 "Descuento comercial frente a racional": (M_EFECT, L_DCO), "Tantos equivalentes: nominal y efectivo": (M_TIPO, L_COM),
 "Criterio: ¿qué ley favorece al acreedor?": (M_DEC, L_CMP), "Capital único equivalente": (M_CAP, L_COM),
 "Elegir entre dos formas de pago según la parte": (M_DEC, L_CMP), "Prórroga de vencimientos": (M_CAP, L_DCO),
 "Vencimiento común": (M_FECHA, L_COM), "Vencimiento medio (descuento comercial)": (M_FECHA, L_DCO),
 "Descuento de letras persiana": (M_EFECT, L_DCO), "Efecto impagado y letra de resaca": (M_CAP, L_DCO),
 "Negociación de un efecto y coste efectivo": (M_EFECT, L_DCO), "Remesa de efectos": (M_EFECT, L_DCO),
 "Cuenta de crédito: coste del periodo y TAE": (M_COSTE, L_SIM), "Cuenta remunerada: rentabilidad efectiva": (M_TAE, L_TIR),
 "Liquidación de cuenta corriente (método hamburgués)": (M_SALDO, L_HAM), "Valor capital de una renta de términos distintos": (M_VA, L_COM),
 "Criterio: premio en un pago o en renta": (M_DEC, L_REN), "Despejar el término de una renta": (M_TERM, L_REN),
 "Número de términos de una renta": (M_N, L_REN), "Renta anticipada p periodos": (M_VF, L_REN),
 "Renta constante con tanto de valoración variable": (M_VA, L_REN), "Renta constante pospagable: valor actual": (M_VA, L_REN),
 "Renta constante pospagable: valor final": (M_VF, L_REN), "Renta constante prepagable: valor actual": (M_VA, L_REN),
 "Renta constante prepagable: valor final": (M_VF, L_REN), "Renta diferida": (M_VA, L_REN),
 "Renta fraccionada con tipo efectivo anual": (M_VA, L_REN), "Renta perpetua": (M_VA, L_REN),
 "Aritmética con cuantía fraccionada (Cm, d)": (M_VA, L_REN), "Renta en progresión aritmética perpetua": (M_VA, L_REN),
 "Renta en progresión aritmética temporal": (M_VA, L_REN), "Geométrica con cuantía fraccionada (Cm, q)": (M_VA, L_REN),
 "Renta en progresión geométrica perpetua": (M_VA, L_REN), "Renta en progresión geométrica temporal": (M_VA, L_REN),
 "Préstamo con cuotas de amortización constantes": (M_TERM, L_AMO), "Préstamo francés anual: cuota y primera fila": (M_TERM, L_AMO),
 "Préstamo francés mensual: cuota, descomposición, pendiente y amortizado": (M_TERM, L_AMO),
 "Amortización anticipada parcial y compensación": (M_TERM, L_AMO), "Amortización con carencia parcial": (M_TERM, L_AMO),
 "Amortización con carencia total": (M_TERM, L_AMO), "Préstamo a interés variable: revisión del término": (M_TERM, L_AMO),
 "Tantos efectivos: prestatario y prestamista": (M_TAE, L_TIR),
}

# deduplicar por enunciado y numerar
seen=set(); final=[]
for o in OUT:
    h = hashlib.md5(o["enunciado"].encode()).hexdigest()
    if h in seen: continue
    seen.add(h); final.append(o)
for n,o in enumerate(final,1):
    o["id"] = f"MOF-{n:03d}"
    if o["familia"] in FAMMETA: o["mag"], o["ley"] = FAMMETA[o["familia"]]
    elif o["tipo"] in ("calculo","criterio") and o["solucion"] is not None: raise SystemExit("Sin metadatos: " + o["familia"])
meta = {"titulo":"Biblioteca de ejercicios MOF — temario de la guía docente UM 2026/27 (asignatura 2346, 1.º ADE)",
        "estado":"Ejercicios originales verificados, organizados por los 12 temas de la guía 2026/27. Convenciones pendientes de confirmar con la guía vigente y los materiales del Aula Virtual.",
        "convenciones":"Cada enunciado declara su base (360 o 365) y su ley. Redondeo a 2 decimales al presentar; cálculo interno sin redondear.",
        "total":len(final), "magnitudes":[M_VF,M_VA,M_TIPO,M_TIEMPO,M_EFECT,M_TAE,M_CAP,M_FECHA,M_SALDO,M_TERM,M_N,M_DEC,M_COSTE], "leyes":[L_SIM,L_COM,L_DCO,L_REN,L_AMO,L_HAM,L_TIR,L_CMP]}
json.dump({"meta":meta,"ejercicios":final}, open("ejercicios.json","w"), ensure_ascii=False, indent=1)
from collections import Counter
print(len(final)); print(Counter(o["tema"] for o in final))
