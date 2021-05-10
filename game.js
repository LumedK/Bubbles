// init setting
const canvas = document.getElementById('gameField')
const ctx = canvas.getContext('2d')
let cursorX = 0
let cursorY = 0
let newClick = false
let clickX = 0
let clickY = 0
const basicSpeedXY = 1
const aimLength = 100

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

class Common {
    static getBasicVector(length) {
        const x0 = canvas.height / 2
        const y0 = canvas.width
        const cx = cursorX
        const cy = cursorY

        const a = x0 - cx
        const b = y0 - cy
        const c = Math.sqrt(a ** 2 + b ** 2)
        const k = length / c
        const va = k * a
        const vb = k * b
        const x = x0 - va
        const y = y0 - vb
        return { x: x, y: y }
    }
}

class Ball {
    constructor() {
        this.radius = 12
        this.x = canvas.width / 2
        this.y = canvas.height
        this.color = 'green'
        this.moveX = 0
        this.moveY = 0
    }
    draw() {
        console.log(`x(${this.x}) y(${this.y})`)
        console.log(`move: x(${this.moveX}) y(${this.moveY})`)
        // move the ball
        this.x += this.moveX
        this.y += this.moveY

        ctx.fillStyle = 'green'
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
        ctx.fill()
    }
    pull() {
        const { x, y } = Common.getBasicVector(basicSpeedXY)
        this.moveX = -1
        this.moveY = -1
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
        const { x: aimX, y: aimY } = Common.getBasicVector(aimLength)

        const x1 = canvas.height / 2
        const y1 = canvas.width
        const x2 = cursorX
        const y2 = cursorY

        dx = (y1 / (y1 - y2)) * (x2 - x1)
        endX = x1 + dx
        endY = 0

        ctx.strokeStyle = 'red'
        ctx.beginPath()
        ctx.moveTo(aimX, aimY)
        ctx.lineTo(endX, endY)
        ctx.stroke()

        ctx.strokeStyle = 'white'
        ctx.beginPath()
        ctx.moveTo(canvas.width / 2, canvas.height)
        ctx.lineTo(aimX, aimY)
        ctx.stroke()
    },

    gameLoop() {
        this.gameLogic()
        this.render()
    },

    gameLogic() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (this.currentEvent === GameEvents.aiming && newClick) {
            this.currentEvent = GameEvents.flight
            const currentBall = new Ball()
            this.items.push(currentBall)
            currentBall.pull()
            // clearInterval(this.interval)
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
game.interval = setInterval(game.gameLoop.bind(game), 1000 / 2)
