//alert("Hola que tas haciendo!");

/*
Este es un código
que hace que la pelota 
rebote en el borde
inferior la pantalla
*/
let posY = 160;
let velY = 0;
let posX = 25;
let velX = 1;

function setup() {
    createCanvas(windowWidth, windowHeight);
}
function draw() {
    background(100, 152, 150);
    fill(180, 80, 0);
    noStroke();
    circle(posX, posY, 50);
    posY+= velY;
    velY+= 0.5;
    console.log(posY);
    if (posY > height - 25) {
        velY *= -0.9;
    }
    posX+= velX;
    velX+= 0.1;
    console.log(posX);
    // MOVIMIENTO EN X
    posX += velX;

    // BORDE DERECHO
    if (posX >= width - 25) {
        posX = width - 25;
        velX *= -0.8;
    }

    // BORDE IZQUIERDO
    if (posX <= 25) {
        posX = 25;
        velX *= -0.8;
    }

    // SI LA VELOCIDAD ES MUY PEQUEÑA, SE PARA
    if (abs(velX) < 0.5) {
        velX = 0;
    }
    }

