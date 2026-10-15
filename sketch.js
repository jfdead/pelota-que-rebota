/*
PELOTA QUE REBOTA
- Rebota en los 4 bordes de la pantalla (incluidos los laterales).
- Varios tipos de rebote: suave, medio o fuerte (al azar).
- En cada rebote emite un sonido Y cambia de color.
- Con el cursor encima se comporta como un SLIME: se deforma conservando
  el área (estirado al colgar, con efecto gelatina) y acumula impulso.
- Si se estira demasiado, la pelota se DIVIDE en dos (conservando el área).
  Cuando dos divisiones chocan entre sí, se vuelven a UNIR. Máximo 4 pelotas.
- Sale un sistema de partículas desde el cursor; viven 10 s, rebotan en los
  bordes (no los traspasan) y al final cambian de color hasta desvanecerse.
  No se emiten mientras detienes una pelota con el cursor.
*/

const RADIO_INICIAL = 25;
const GRAVEDAD = 0.5;
const MAX_PELOTAS = 4;         // "hasta 4 veces": como máximo 4 pelotas
const UMBRAL_DIVISION = 1.7;   // estiramiento que dispara la división
const ESPERA_UNION = 700;      // ms de gracia tras dividirse (para separarse)
const RADIO_MINIMO = 8;        // no dividir si el trozo quedaría muy pequeño

// Sonido del rebote (se activa con un clic, lo exige el navegador)
let osc, env;
let audioListo = false;
let ultimoSonido = 0;

// Sistema de partículas desde el cursor
const VIDA_PARTICULA = 10000;   // 10 segundos de vida
const MAX_PARTICULAS = 300;
const INTERVALO_SPAWN = 90;     // ms entre emisiones
let particulas = [];
let ultimoSpawn = 0;
let ratonActivo = false;

// Pelotas (empieza con una)
let pelotas = [];

function setup() {
    createCanvas(windowWidth, windowHeight);
    pelotas = [
        new Pelota(width / 2, height / 2, RADIO_INICIAL, color(180, 80, 0), random(-5, 5), random(-3, 1))
    ];

    // Un oscilador con una envolvente corta produce el "blip" del rebote
    osc = new p5.Oscillator("sine");
    env = new p5.Envelope(0.001, 0.1, 0.1, 0.1);
    osc.disconnect();
    osc.connect(env);
    osc.start();
}

function draw() {
    background(100, 152, 150);

    actualizarPelotas();

    manejarParticulas();
    dibujarParticulas();

    for (const p of pelotas) {
        dibujarPelota(p);
    }

    dibujarAyuda();
}

// --- Pelotas -----------------------------------------------------------

class Pelota {
    constructor(x, y, radio, col, vx, vy) {
        this.x = x;
        this.y = y;
        this.radio = radio;
        this.vx = vx;
        this.vy = vy;
        this.color = col;
        this.pausada = false;       // ¿la sujeta el cursor?
        this.tiempoCarga = 0;       // ms detenida bajo el cursor
        this.deformacion = 1;       // estiramiento vertical (>1 = colgando)
        this.velDeformacion = 0;    // velocidad del muelle (gelatina)
        this.esperaUnion = 0;       // ms de gracia para no reunirse al instante
    }
}

function actualizarPelotas() {
    // ¿Qué pelota sujeta el cursor? La más cercana que lo contenga.
    let elegida = null;
    let mejor = Infinity;
    for (const p of pelotas) {
        const d = dist(mouseX, mouseY, p.x, p.y);
        if (d <= p.radio && d < mejor) {
            mejor = d;
            elegida = p;
        }
    }

    for (const p of pelotas) {
        if (p.esperaUnion > 0) {
            p.esperaUnion = max(0, p.esperaUnion - deltaTime);
        }

        const sobrePelota = (p === elegida);
        if (sobrePelota) {
            if (!p.pausada) p.tiempoCarga = 0; // el cursor acaba de posarse
            p.tiempoCarga += deltaTime;        // acumula el tiempo detenida
            p.pausada = true;
        } else {
            if (p.pausada) soltarPelota(p);    // el cursor acaba de irse: dispara
            p.pausada = false;
            moverPelota(p);
        }

        actualizarDeformacion(p);

        // Si se estira demasiado, se divide en dos
        if (p.pausada && p.deformacion >= UMBRAL_DIVISION &&
            pelotas.length < MAX_PELOTAS && p.radio > RADIO_MINIMO) {
            dividirPelota(p);
            return; // el arreglo cambió, se retoma el siguiente frame
        }
    }

    unirPelotas();
}

function moverPelota(p) {
    p.vy += GRAVEDAD;
    p.x += p.vx;
    p.y += p.vy;

    // BORDE INFERIOR: rebote suave, medio o fuerte al azar
    if (p.y > height - p.radio) {
        p.y = height - p.radio;
        p.vy = -impulsoVertical();
        p.vx += random(-2, 2);
        alRebotar(p, abs(p.vy));
    }

    // BORDE SUPERIOR
    if (p.y < p.radio) {
        p.y = p.radio;
        p.vy = impulsoVertical() * 0.7;
        p.vx += random(-2, 2);
        alRebotar(p, abs(p.vy));
    }

    // BORDE DERECHO
    if (p.x > width - p.radio) {
        p.x = width - p.radio;
        p.vx = -impulsoLateral();
        p.vy += random(-2, 2);
        alRebotar(p, abs(p.vx));
    }

    // BORDE IZQUIERDO
    if (p.x < p.radio) {
        p.x = p.radio;
        p.vx = impulsoLateral();
        p.vy += random(-2, 2);
        alRebotar(p, abs(p.vx));
    }

    // Evita que se acelere sin control con tantos empujones aleatorios
    p.vx = constrain(p.vx, -18, 18);
    p.vy = constrain(p.vy, -20, 20);
}

// Varios tipos de rebote vertical: suave, medio o fuerte (al azar)
function impulsoVertical() {
    const r = random();
    if (r < 0.4) return random(2.5, 5);   // suave
    if (r < 0.75) return random(5, 9);    // medio
    return random(9, 14);                 // fuerte
}

// Varios tipos de rebote lateral: suave, medio o fuerte (al azar)
function impulsoLateral() {
    const r = random();
    if (r < 0.4) return random(3, 5);     // suave
    if (r < 0.75) return random(5, 8);    // medio
    return random(8, 12);                 // fuerte
}

// Comportamiento de slime: deformación con conservación de área.
// deformacion es el factor vertical; el horizontal es su inverso, así
// rx * ry = radio^2 (el "volumen" no cambia, como un material blando).
function actualizarDeformacion(p) {
    const carga = constrain(p.tiempoCarga / 1200, 0, 1);  // 0..1 en ~1.2 s
    const objetivo = p.pausada ? 1 + 0.9 * carga : 1;     // colgando = más estirada

    // Muelle amortiguado -> efecto gelatina al estirarse y al soltarse
    p.velDeformacion += (objetivo - p.deformacion) * 0.2;
    p.velDeformacion *= 0.82;
    p.deformacion += p.velDeformacion;
    p.deformacion = constrain(p.deformacion, 0.5, 2.2);
}

function dibujarPelota(p) {
    noStroke();
    fill(p.pausada ? lerpColor(p.color, color(255), 0.35) : p.color);

    const ry = p.radio * p.deformacion;
    const rx = p.radio / p.deformacion;    // área constante: rx * ry = radio^2
    const centroY = p.y + (ry - p.radio);  // la parte de arriba queda sujeta

    ellipse(p.x, centroY, rx * 2, ry * 2);
}

// Al quitar el cursor se convierte en impulso: cuanto más tiempo estuvo
// detenida, más fuerte sale disparada.
function soltarPelota(p) {
    const carga = constrain(p.tiempoCarga / 1200, 0, 1);
    const impulso = map(carga, 0, 1, 4, 16);

    p.vy = -random(impulso * 0.6, impulso);
    p.vx = random(-1, 1) * impulso * 0.7;
    p.tiempoCarga = 0;
}

// --- División y unión --------------------------------------------------

// Parte la pelota en dos mitades de igual área (radio / sqrt(2) cada una).
function dividirPelota(p) {
    const i = pelotas.indexOf(p);
    if (i < 0) return;
    if (pelotas.length >= MAX_PELOTAS) return; // nunca pasar del máximo

    const rHijo = p.radio / Math.SQRT2;    // π·r² + π·r² = π·radio²
    const sep = rHijo * 0.9;

    const a = new Pelota(p.x - sep, p.y, rHijo, p.color, -random(3, 6), -random(1, 4));
    const b = new Pelota(p.x + sep, p.y, rHijo, p.color, random(3, 6), -random(1, 4));
    a.esperaUnion = ESPERA_UNION;
    b.esperaUnion = ESPERA_UNION;

    pelotas.splice(i, 1, a, b); // reemplaza la original por las dos mitades
}

// Une las pelotas que choquen entre sí (salvo durante la espera tras dividirse).
function unirPelotas() {
    for (let i = 0; i < pelotas.length; i++) {
        for (let j = i + 1; j < pelotas.length; j++) {
            const a = pelotas[i];
            const b = pelotas[j];
            if (a.esperaUnion > 0 || b.esperaUnion > 0) continue;

            if (dist(a.x, a.y, b.x, b.y) <= (a.radio + b.radio) * 0.85) {
                const unida = fundirPelotas(a, b);
                pelotas.splice(j, 1);       // quita b
                pelotas.splice(i, 1, unida); // reemplaza a por la unión
                return; // el arreglo cambió, se retoma el siguiente frame
            }
        }
    }
}

// Conserva el área (radio = sqrt(r1² + r2²)) y el momento (masa ~ área).
function fundirPelotas(a, b) {
    const areaA = a.radio * a.radio;
    const areaB = b.radio * b.radio;
    const area = areaA + areaB;

    const x = (a.x * areaA + b.x * areaB) / area;
    const y = (a.y * areaA + b.y * areaB) / area;
    const vx = (a.vx * areaA + b.vx * areaB) / area;
    const vy = (a.vy * areaA + b.vy * areaB) / area;

    return new Pelota(x, y, sqrt(area), lerpColor(a.color, b.color, 0.5), vx, vy);
}

function alRebotar(p, fuerza) {
    // Cada rebote cambia el color de la pelota (canales >= 80 para contrastar)
    p.color = color(random(80, 255), random(80, 255), random(80, 255));
    sonarRebote(fuerza);
}

function sonarRebote(fuerza) {
    if (!audioListo) return;
    if (millis() - ultimoSonido < 60) return; // no saturar de sonidos

    ultimoSonido = millis();

    // Cuanto más fuerte el golpe, más agudo el tono
    let frecuencia = map(constrain(fuerza, 0, 12), 0, 12, 160, 900);
    osc.freq(frecuencia * random(0.95, 1.05));
    env.play();
}

// --- Sistema de partículas ---------------------------------------------

class Particula {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        const angulo = random(TWO_PI);
        const rapidez = random(0.5, 3);
        this.vx = cos(angulo) * rapidez;
        this.vy = sin(angulo) * rapidez - random(0.5, 1.5); // sesgo hacia arriba
        this.tamano = random(3, 9);
        this.color = color(random(80, 255), random(80, 255), random(80, 255));
        this.colorFin = lerpColor(this.color, color(255), 0.75);
        this.nacimiento = millis();
    }

    get edad() {
        return millis() - this.nacimiento;
    }

    actualizar() {
        this.vy += 0.03;   // gravedad suave
        this.vx *= 0.99;   // rozamiento
        this.vy *= 0.99;
        this.x += this.vx;
        this.y += this.vy;

        // Rebote en los bordes: las partículas nunca los traspasan
        const r = this.tamano / 2;
        if (this.x < r) { this.x = r; this.vx = abs(this.vx); }
        if (this.x > width - r) { this.x = width - r; this.vx = -abs(this.vx); }
        if (this.y < r) { this.y = r; this.vy = abs(this.vy); }
        if (this.y > height - r) { this.y = height - r; this.vy = -abs(this.vy); }
    }

    dibujar() {
        const t = constrain(this.edad / VIDA_PARTICULA, 0, 1);
        // Cambia de color hacia el aclarado y se desvanece hasta desaparecer
        const c = lerpColor(this.color, this.colorFin, t);
        noStroke();
        fill(red(c), green(c), blue(c), 255 * (1 - t));
        circle(this.x, this.y, this.tamano * (1 - t) + 1);
    }
}

function manejarParticulas() {
    const ahora = millis();
    const deteniendo = pelotas.some((p) => p.pausada);

    // Emite partículas desde el cursor (no mientras detienes una pelota)
    if (ratonActivo && !deteniendo && particulas.length < MAX_PARTICULAS &&
        ahora - ultimoSpawn >= INTERVALO_SPAWN) {
        ultimoSpawn = ahora;
        const n = floor(random(1, 4));
        for (let i = 0; i < n; i++) {
            particulas.push(new Particula(mouseX, mouseY));
        }
    }

    // Actualiza y elimina las que ya cumplieron su tiempo de vida
    for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.actualizar();
        if (p.edad >= VIDA_PARTICULA) {
            particulas.splice(i, 1);
        }
    }
}

function dibujarParticulas() {
    for (const p of particulas) {
        p.dibujar();
    }
}

function dibujarAyuda() {
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    if (!audioListo) {
        text("Haz clic para activar el sonido", width / 2, height - 30);
    } else {
        text("Mantén el cursor sobre una pelota para estirarla y dividirla", width / 2, height - 30);
    }
}

function mouseMoved() {
    ratonActivo = true; // ya hay una posición de cursor válida
}

function mousePressed() {
    // Los navegadores exigen un gesto del usuario para reproducir audio
    userStartAudio();
    audioListo = true;
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    for (const p of pelotas) {
        p.x = constrain(p.x, p.radio, width - p.radio);
        p.y = constrain(p.y, p.radio, height - p.radio);
    }
}
