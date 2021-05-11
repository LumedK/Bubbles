class Field {
    constructor() {
        this.game = null
        this.canvas = document.getElementById('gameField')
        this.ctx = this.canvas.getContext('2d')
        this.cursorX = 0
        this.cursorY = 0
        this.clickX = 0
        this.clickY = 0
        this.setup()
    }
    setup() {
        let canvas = this.canvas

        canvas.width = 504
        canvas.height = canvas.offsetHeight

        canvas.addEventListener('mousemove', (event) => {
            this.cursorX = event.layerX
            this.cursorY = event.layerY
        })

        canvas.addEventListener('click', (event) => {
            this.clickX = event.layerX
            this.clickY = event.layerY
        })
    }

    render() {
        console.log('render game objects')
        const canvas = this.canvas
        const ctx = this.ctx

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        this.game.objects.forEach((object) => {
            if (object.isRender) {
                object.draw()
            }
        })
    }
}

class Game {
    constructor() {
        this.field = null
        this.interval = null
        this.maxFps = 60
        this.currentEvent = new GameEvent(this)
        this.objects = []
    }
    start(field) {
        this.field = field
        field.game = this

        this.currentEvent = new GameEvent.Aiming(this)

        this.interval = setInterval(this.main.bind(this), 1000 / this.maxFps)
        console.log('game started')
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval)
            console.log('game stopped')
        }
    }

    main() {
        try {
            this.currentEvent.do()
            this.field.render()
        } catch (error) {
            console.log(error)
            this.stop()
        }
    }
}

class GameEvent {
    constructor(game) {
        this.game = game
    }
    do() {}

    static Aiming = class extends GameEvent {
        do() {
            console.log('game event: aiming')
            const aimingLine = new GameObject.AimingLine(this.game)
            this.game.objects.push(aimingLine)
        }
    }
}

class GameObject {
    constructor(game) {
        this.game = game
        this.field = game.field
        this.isRender = true

        console.log('created a new obj')
    }
    draw() {
        console.log('draw an obj')
    }

    static AimingLine = class extends GameObject {
        constructor(game) {
            super(game)
            this.aimLength = 100
        }
        draw() {
            super.draw()

            const ctx = this.field.ctx
            const canvas = this.field.canvas
            const cursorX = this.field.cursorX
            const cursorY = this.field.cursorY

            const xAimStart = canvas.width / 2
            const yAimStart = canvas.height

            const aimVector = new Vector(xAimStart, yAimStart, cursorX, cursorY)

            // dev aim
            aimVector.len = 1000
            ctx.strokeStyle = 'red'
            ctx.beginPath()
            ctx.moveTo(xAimStart, yAimStart)
            ctx.lineTo(aimVector._xEnd, aimVector._yEnd)
            ctx.stroke()

            aimVector.len = this.aimLength

            ctx.strokeStyle = 'white'
            ctx.beginPath()
            ctx.moveTo(xAimStart, yAimStart)
            ctx.lineTo(aimVector._xEnd, aimVector._yEnd)
            ctx.stroke()

            // const { x: aimX, y: aimY } = Common.getBasicVector(aimLength)

            // const x1 = canvas.height / 2
            // const y1 = canvas.width
            // const x2 = cursorX
            // const y2 = cursorY

            // dx = (y1 / (y1 - y2)) * (x2 - x1)
            // endX = x1 + dx
            // endY = 0

            // ctx.strokeStyle = 'red'
            // ctx.beginPath()
            // ctx.moveTo(aimX, aimY)
            // ctx.lineTo(endX, endY)
            // ctx.stroke()

            // ctx.strokeStyle = 'white'
            // ctx.beginPath()
            // ctx.moveTo(canvas.width / 2, canvas.height)
            // ctx.lineTo(aimX, aimY)
            // ctx.stroke()
        }
    }
}

class Vector {
    constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
        this._xStart = x1
        this._yStart = y1
        this._xEnd = x2
        this._yEnd = y2
        this._x = x2 - x1
        this._y = y2 - y1
        this._len = Math.sqrt(this._x ** 2 + this._y ** 2)
    }
    set len(newLen) {
        let k = newLen / this._len
        k = k = 0 ? 0 : k
        this._x = this._x * k
        this._y = this._y * k
        this._xEnd = this._xStart + this._x
        this._yEnd = this._yStart + this._y
        this._len = newLen
    }
    set xStart(xNewStart) {
        this._xStart = _xNewStart
        this._xEnd = this._xStart + this._x
    }
    set yStart(_yNewStart) {
        this._yStart = _yNewStart
        this._yEnd = this._yStart + this._y
    }
}

game = new Game()
game.start(new Field())

// global
// const canvas = document.getElementById('gameField')
// const ctx = canvas.getContext('2d')
// let cursorX = 0
// let cursorY = 0
// let clickX = 0
// let clickY = 0

// class GameEvent {
//     do() {}
// }

// class EventAiming extends GameEvent {
//     do() {
//         console.log('game event: aiming')
//     }
// }

// let game = {
//     maxFps: 30,
//     interval: null,
//     currentEvent: new EventAiming(),

//     start() {
//         canvas.width = 504
//         canvas.height = canvas.offsetHeight

//         canvas.addEventListener('mousemove', (event) => {
//             cursorX = event.layerX
//             cursorY = event.layerY
//         })

//         canvas.addEventListener('click', (event) => {
//             clickX = event.layerX
//             clickY = event.layerY
//             newClick = true
//         })
//         this.interval = setInterval(this.main.bind(this), 1000 / this.maxFps)
//         console.log('game started')
//     },

//     stop() {
//         if (this.interval) {
//             clearInterval(this.interval)
//             console.log('game stopped')
//         }
//     },

//     main() {
//         try {
//             this.currentEvent.do()
//         } catch (error) {
//             console.log(error)
//             this.stop()
//         }
//     }
// }

// game.start()
// console.trace(Aiming)

// // init setting
// const canvas = document.getElementById('gameField')
// const ctx = canvas.getContext('2d')
// let cursorX = 0
// let cursorY = 0
// let newClick = false
// let clickX = 0
// let clickY = 0s
// const basicSpeedXY = 1
// const aimLength = 100

// function init() {
//     canvas.width = 504
//     canvas.height = canvas.offsetHeight

//     canvas.addEventListener('mousemove', (event) => {
//         cursorX = event.layerX
//         cursorY = event.layerY
//     })

//     canvas.addEventListener('click', (event) => {
//         clickX = event.layerX
//         clickY = event.layerY
//         newClick = true
//     })
// }

// class Common {
//     static getBasicVector(length) {
//         const x0 = canvas.height / 2
//         const y0 = canvas.width
//         const cx = cursorX
//         const cy = cursorY

//         const a = x0 - cx
//         const b = y0 - cy
//         const c = Math.sqrt(a ** 2 + b ** 2)
//         const k = length / c
//         const va = k * a
//         const vb = k * b
//         const x = x0 - va
//         const y = y0 - vb
//         return { x: x, y: y }
//     }
// }

// class Items {
//     constructor(x, y) {
//         this.isRender = true
//         this.x
//         this.y
//     }
//     draw() {}
// }

// class Ball extends Items {
//     constructor() {
//         this.radius = 12
//         // this.x = canvas.width / 2
//         // this.y = canvas.height
//         this.color = 'green'
//         this.moveX = 0
//         this.moveY = 0
//     }
//     draw() {
//         console.log(`x(${this.x}) y(${this.y})`)
//         console.log(`move: x(${this.moveX}) y(${this.moveY})`)
//         // move the ball
//         this.x += this.moveX
//         this.y += this.moveY

//         ctx.fillStyle = 'green'
//         ctx.beginPath()
//         ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
//         ctx.fill()
//     }
//     pull() {
//         const { x, y } = Common.getBasicVector(basicSpeedXY)
//         this.moveX = -1
//         this.moveY = -1
//     }
// }

// const GameEvents = {
//     aiming: 'aiming',
//     flight: 'flight',
//     popping: 'popping',
//     gameOver: 'gameOver'
// }

// let game = {
//     interval: null,
//     currentEvent: GameEvents.aiming,
//     items: [],

//     drawAimingLine() {
//         const { x: aimX, y: aimY } = Common.getBasicVector(aimLength)

//         const x1 = canvas.height / 2
//         const y1 = canvas.width
//         const x2 = cursorX
//         const y2 = cursorY

//         dx = (y1 / (y1 - y2)) * (x2 - x1)
//         endX = x1 + dx
//         endY = 0

//         ctx.strokeStyle = 'red'
//         ctx.beginPath()
//         ctx.moveTo(aimX, aimY)
//         ctx.lineTo(endX, endY)
//         ctx.stroke()

//         ctx.strokeStyle = 'white'
//         ctx.beginPath()
//         ctx.moveTo(canvas.width / 2, canvas.height)
//         ctx.lineTo(aimX, aimY)
//         ctx.stroke()
//     },

//     gameLoop() {
//         this.gameLogic()
//         this.render()
//     },

//     gameLogic() {
//         ctx.clearRect(0, 0, canvas.width, canvas.height)

//         if (this.currentEvent === GameEvents.aiming && newClick) {
//             this.currentEvent = GameEvents.flight
//             const currentBall = new Ball()
//             this.items.push(currentBall)
//             currentBall.pull()
//             // clearInterval(this.interval)
//         }
//     },

//     render() {
//         ctx.clearRect(0, 0, canvas.width, canvas.height)
//         this.drawAimingLine()
//         this.items.forEach((item) => {
//             item.draw()
//         })
//     }
// }

// init()
// game.interval = setInterval(game.gameLoop.bind(game), 1000 / 2)
