class Field {
    constructor() {
        this.game = null
        this.canvas = document.getElementById('gameField')
        this.ctx = this.canvas.getContext('2d')
        this.cursorX = 0
        this.cursorY = 0
        this.clickX = -1
        this.clickY = -1
        this.aimX = -1
        this.aimY = -1

        this.setup()
    }
    setup() {
        let canvas = this.canvas

        canvas.width = 480
        canvas.height = canvas.offsetHeight

        this.aimX = this.canvas.width / 2
        this.aimY = this.canvas.height

        canvas.addEventListener('mousemove', (event) => {
            const cursorXY = this.#getCursor(event.layerX, event.layerY)
            this.cursorX = cursorXY.x
            this.cursorY = cursorXY.y
        })

        canvas.addEventListener('click', (event) => {
            const cursorXY = this.#getCursor(event.layerX, event.layerY)
            this.clickX = cursorXY.x
            this.clickY = cursorXY.y
        })
    }

    #getCursor(layerX, layerY) {
        return {
            x: (this.canvas.width / this.canvas.offsetWidth) * layerX,
            y: (this.canvas.height / this.canvas.offsetHeight) * layerY
        }
    }

    render() {
        // console.log('render game objects')
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
    constructor(field) {
        this.field = field
        field.game = this
        this.interval = null
        this.maxFps = 60
        this.currentEvent = new GameEvent(this)
        this.grid = new GameObject.Grid(this)
        this.objects = []
        this.objects.push(this.grid)
        this.objects.push(new GameObject.AimingLine(this))
    }
    start() {
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

            const field = this.game.field
            const wasClick = field.clickX > -1 || field.clickY > -1
            if (!wasClick) {
                return
            }
            // prepare ball
            let ball = new GameObject.Ball()
            let moveVector = new Vector(
                field.aimX,
                field.aimY,
                field.clickX,
                field.clickY
            )
            moveVector.len = ball.speed
            ball.moveVector = moveVector

            this.game.objects.push(ball)
            // this.game.currentBall = ball

            field.clickX = -1
            field.clickY = -1

            // change event
            let nextEvent = new GameEvent.CheckCollision(this.game)
            nextEvent.ball = ball
            this.game.currentEvent = nextEvent
        }
    }

    static CheckCollision = class extends GameEvent {
        constructor(game) {
            super(game)
            this.ball = null
        }
        do() {
            super.do()
            // move the ball
            let ball = this.ball
            let moveVector = ball.moveVector
            moveVector.xStart = moveVector._xEnd
            moveVector.yStart = moveVector._yEnd
            ball.x = moveVector._xEnd
            ball.y = moveVector._yEnd

            // check collisions
            const outLeft = ball.x - ball.radius <= 0
            const outRight =
                ball.x + ball.radius >= this.game.field.canvas.width
            const outTop = ball.y - ball.radius <= 0
            const nearestCells = this.game.grid.cells
                .slice()
                .sort(function (a, b) {
                    const ball = a.game.currentEvent.ball
                    function getRange(ball, cell) {
                        return new Vector(ball.x, ball.y, cell.x, cell.y)._len
                    }
                    return getRange(ball, a) - getRange(ball, b)
                })
                .slice(0, 6)
            const nearestFullCells = []
            const nearestEmptyCells = []
            nearestCells.forEach((cell) => {
                const isEmptyCell = cell.ball === null
                if (isEmptyCell) {
                    nearestEmptyCells.push(cell)
                } else {
                    nearestFullCells.push(cell)
                }
            })
            const theNearestFullCell =
                nearestFullCells.length > 0 ? nearestFullCells[0] : null
            const theNearestEmptyCell =
                nearestEmptyCells.length > 0 ? nearestEmptyCells[0] : null

            let cellForBall = null
            if (outLeft || outRight) {
                this.ball.moveVector.reflectByX()
                return
            } else if (outTop) {
                cellForBall = theNearestEmptyCell
            } else if (nearestFullCells.length > 0) {
                // BAD! need to use the circle equation
                // get the nearest empty cell between ball and the nearest full cell
                const v = new Vector(
                    theNearestFullCell.x,
                    theNearestFullCell.y,
                    ball.x,
                    ball.y
                )
                v.len = v.len / 2
                cellForBall = nearestEmptyCells.sort((a, b) => {
                    return (
                        new Vector(v.x, v.y, a.x, a.y)._len -
                        new Vector(v.x, v.y, b.x, b.y)._len
                    )
                })[0]
            } else {
                return
            }

            this.ball.x = cellForBall.x
            this.ball.y = cellForBall.y
            this.ball.moveVector.length = 0
            cellForBall.ball = ball

            // change event
            let nextEvent = new GameEvent.Aiming(this.game)
            // nextEvent.ball = ball
            this.game.currentEvent = nextEvent

            // function sortArrayByDistance(array){
            //     return array().sort((a, b){
            //         const ball = a.game.currentEvent.ball
            //     })
            // }

            // const theNearestCell = null

            // if (outLeft || outRight) {
            //     this.ball.moveVector.reflectByX()
            // } else if (outTop) {
            //     // get the nearest empty cell
            //     const nearestEmptyCell = this.game.grid.cells
            //         .slice()
            //         .sort(function (a, b) {
            //             const ball = a.game.currentEvent.ball
            //             function getRange(ball, cell) {
            //                 const isCellEmpty = cell.ball === null
            //                 const range = isCellEmpty
            //                     ? new Vector(ball.x, ball.y, cell.x, cell.y)
            //                           ._len
            //                     : 1000 //(ball.radius * 2 + 1)
            //                 return range
            //             }
            //             return getRange(ball, a) - getRange(ball, b)
            //         })[0]
            //     this.ball.x = nearestEmptyCell.x
            //     this.ball.y = nearestEmptyCell.y
            //     this.ball.moveVector.len = 0
            //     nearestEmptyCell.ball = ball

            //     // change event
            //     let nextEvent = new GameEvent.Aiming(this.game)
            //     // nextEvent.ball = ball
            //     this.game.currentEvent = nextEvent
            // }
        }
    }
}

class GameObject {
    constructor(game) {
        this.game = game
        this.field = game.field
        this.isRender = true

        // console.log('created a new obj')
    }
    draw() {
        // console.log('draw an obj')
    }

    static AimingLine = class extends GameObject {
        constructor(game) {
            super(game)
            this.aimLength = 100
        }
        draw() {
            super.draw()

            const ctx = this.field.ctx
            // const canvas = this.field.canvas
            const cursorX = this.field.cursorX
            const cursorY = this.field.cursorY

            const aimX = this.field.aimX
            const aimY = this.field.aimY

            const aimVector = new Vector(aimX, aimY, cursorX, cursorY)

            // dev aim
            aimVector.len = 1000
            ctx.strokeStyle = 'red'
            ctx.beginPath()
            ctx.moveTo(aimX, aimY)
            ctx.lineTo(aimVector._xEnd, aimVector._yEnd)
            ctx.stroke()

            aimVector.len = this.aimLength

            ctx.strokeStyle = 'white'
            ctx.beginPath()
            ctx.moveTo(aimX, aimY)
            ctx.lineTo(aimVector._xEnd, aimVector._yEnd)
            ctx.stroke()
        }
    }

    static Ball = class extends GameObject {
        static radius = 12
        constructor() {
            super(game)
            this.x = game.field.aimX
            this.y = game.field.aimY
            this.radius = 12
            this.moveVector = null
            this.speed = 5
        }
        draw() {
            super.draw()
            const ctx = this.field.ctx

            ctx.fillStyle = 'green'
            ctx.beginPath()
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
            ctx.fill()
        }
    }

    static Grid = class extends GameObject {
        constructor(game) {
            super(game)
            this.cells = []
            const distance = GameObject.Ball.radius * 2
            let yShift = distance / 2
            for (let row = 0; row < 20; row++) {
                const xShift = (distance / 2) * ((row + 1) % 2)
                for (let col = 0; col < 20; col++) {
                    if (col * distance + xShift === 0) {
                        continue
                    }

                    const cell = new GameObject.Cell(
                        game, // game
                        this, // grid
                        col * distance + xShift, // x
                        row * distance + yShift, // y
                        row, // row
                        col // column
                    )
                    this.cells.push(cell)
                }
            }
        }
        draw() {
            super.draw()
            const ctx = this.game.field.ctx

            this.cells.forEach((point) => {
                ctx.fillStyle = 'yellow'
                ctx.beginPath()
                ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI)
                ctx.fill()
            })
        }
    }

    static Cell = class extends GameObject {
        constructor(game, grid, x, y, row, column) {
            super(game)
            this.grid = grid
            this.x = x
            this.y = y
            this.row = row
            this.col = column
            this.ball = null
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
        this._xStart = xNewStart
        this._xEnd = this._xStart + this._x
    }
    set yStart(yNewStart) {
        this._yStart = yNewStart
        this._yEnd = this._yStart + this._y
    }
    reflectByX() {
        this._x = -this._x
        this._xEnd = this._xEnd + 2 * this._x
    }
}

game = new Game(new Field())
game.start()

// drawCells()

// // radius

// function drawCells() {
//     const cells = []
//     const distance = 12 * 2
//     let yShift = distance / 2
//     for (let row = 0; row < 20; row++) {
//         const xShift = (distance / 2) * ((row + 1) % 2)
//         for (let col = 0; col < 20; col++) {
//             if (col * distance + xShift === 0) {
//                 continue
//             }
//             const point = {
//                 x: col * distance + xShift,
//                 y: row * distance + yShift,
//                 row: row,
//                 col: col
//             }
//             cells.push(point)
//         }
//     }
//     //draw
//     const field = new Field()
//     const ctx = field.ctx

//     cells.forEach((point) => {
//         ctx.fillStyle = 'yellow'
//         ctx.beginPath()
//         ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI)
//         ctx.fill()
//     })

//     console.trace(cells)
// }

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
