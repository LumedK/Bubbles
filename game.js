// init setting
const canvas = document.getElementById('gameField')
const ctx = canvas.getContext('2d')
let cursorX = 0
let cursorY = 0
let newClick = false
let clickX = 0
let clickY = 0

function init() {
    canvas.width = 504
    canvas.height = canvas.offsetHeight

    canvas.addEventListener('mousemove', (event) => {
        cursorX = event.layerX
        cursorY = event.layerY
    })

    canvas.addEventListener('click', (event) => {
        clickX = event.layerX
        clickY = event.layerY
        newClick = true
    })
}

class Ball {
    constructor() {
        this.x = 0
        this.y = 0
        this.radius = 12
        this.color = 'green'
    }
    draw() {
        ctx.fillStyle = 'green'
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
        ctx.fill()
        // ctx.stroke()
    }
}

const GameEvents = {
    aiming: 'aiming',
    flight: 'flight',
    popping: 'popping',
    gameOver: 'gameOver'
}

let game = {
    interval: null,
    currentEvent: GameEvents.aiming,
    items: [],

    drawAimingLine() {
        const x1 = canvas.height / 2
        const y1 = canvas.width
        const x2 = cursorX
        const y2 = cursorY

        dx = (y1 / (y1 - y2)) * (x2 - x1)
        toX = x1 + dx
        toY = 0

        ctx.strokeStyle = 'red'
        ctx.beginPath()
        ctx.moveTo(cursorX, cursorY)
        ctx.lineTo(toX, toY)
        ctx.stroke()

        ctx.strokeStyle = 'white'
        ctx.beginPath()
        ctx.moveTo(canvas.width / 2, canvas.height)
        ctx.lineTo(cursorX, cursorY)
        ctx.stroke()
    },

    gameLoop() {
        console.trace(this)
        this.gameLogic()
        this.render()
    },

    gameLogic() {
        if (this.currentEvent === GameEvents.aiming && newClick) {
            currentBall = new Ball()
            this.items.push(currentBall)
        }
    },

    render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        this.drawAimingLine()
        this.items.forEach((item) => {
            item.draw()
        })
    }
}

init()
// game.gameLoop.bind(game)
game.interval = setInterval(game.gameLoop.bind(game), 1000 / 60)

// class Item {
//     constructor() {
//         this.x = 0 // horizontal
//         this.y = 0 // vertical
//         this.wight = 25
//         this.height = 25
//         this.color = 'green'
//     }
//     move(changeX = 0, changeY = 0) {
//         this.x += changeX
//         this.y += changeY
//     }
//     moveTo(x, y) {
//         this.x = x
//         this.y = y
//     }
//     draw() {
//         ctx.fillStyle = this.color
//         ctx.fillRect(this.x, this.y, this.wight, this.wight)
//     }
// }

// // let box = new Item()

// drawAimingLine()

// // draw line
// function drawAimingLine() {
//     ctx.strokeStyle = 'white'
//     ctx.beginPath()
//     ctx.moveTo(canvas.width / 2, canvas.height)
//     ctx.lineTo(0, 0)
//     ctx.stroke()
// }

// const showLonInterval = setInterval(animate, 1000 / 25, box)

// pos = 200
// function animate(box) {
//     ctx.clearRect(0, 0, canvas.width, canvas.height)
//     pos += 1

//     if (pos >= 200) {
//         pos = 0
//         box.moveTo(0, 50)
//     }

//     box.draw()
//     box.move(1, 0)
// }

// (x-x1)/(x2-x1) = (y- y1)/(y2-y1)
// (x-x1)/a = (y-y1)/b
// x-x1 = a/b (y-y1)
// x = y*a/b – y1*a/b + x1

// (y-y1)/b = (x-x1)/a
// y – y1 = (x-x1)*b/a
// y = x*b/a – x1*b/a + y1
