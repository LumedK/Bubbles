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
        constructor(game) {
            super(game)
            this.ball = new GameObject.Ball(game)
            this.ball.type = 1 // debug
            this.game.objects.push(this.ball)
        }
        do() {
            super.do()

            const field = this.game.field
            const wasClick = field.clickX > -1 || field.clickY > -1
            if (wasClick) {
                // prepare ball
                const ball = this.ball
                const moveVector = new Vector(
                    field.aimX,
                    field.aimY,
                    field.clickX,
                    field.clickY
                )
                moveVector.len = ball.speed
                ball.moveVector = moveVector

                // field changing
                field.clickX = -1
                field.clickY = -1

                // change event
                this.game.currentEvent = new GameEvent.CheckCollision(
                    this.game,
                    ball
                )
            }
        }
    }

    static CheckCollision = class extends GameEvent {
        constructor(game, ball) {
            super(game)
            this.ball = ball
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
            //! NEED TO REWORK FOR MORE PERFORMANCE
            const outLeft = ball.x - ball.radius <= 0
            const outRight =
                ball.x + ball.radius >= this.game.field.canvas.width
            const outTop = ball.y - ball.radius <= 0

            // const nearestCells = this.game.grid.getNearestCells(ball.x, ball.y)
            const grid = this.game.grid
            // const nearestCells = grid.getCellsAround(
            //     grid.getTheNearestCell(ball.x, ball.y)
            // )

            const nearestCells = grid.getCellsAround(
                grid.sortCellByDistance(grid.sells, ball.x, ball.y, 0)
            )

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
            const theNearestEmptyCell =
                nearestEmptyCells.length > 0 ? nearestEmptyCells[0] : null

            let cellForBall = null
            if (outLeft || outRight) {
                this.ball.moveVector.reflectByX()
                return
            } else if (outTop) {
                cellForBall = theNearestEmptyCell
            } else if (nearestFullCells.length > 0) {
                const fullCellsInRange = nearestFullCells.filter(
                    (cell) =>
                        (cell.x - ball.x) ** 2 +
                            (cell.y - ball.y) ** 2 -
                            ball.checkRadius ** 2 <=
                        0
                )
                if (fullCellsInRange.length === 0) {
                    return
                }
                cellForBall = theNearestEmptyCell
            } else {
                return
            }
            this.ball.x = cellForBall.x
            this.ball.y = cellForBall.y
            this.ball.moveVector.length = 0
            cellForBall.ball = ball

            // change event
            this.game.currentEvent = new GameEvent.Popping(this.game, ball)
        }
    }

    static Popping = class extends GameEvent {
        constructor(game, ball) {
            super(game)
            this.ball = ball
        }
        do() {
            super.do()
            const grid = this.game.grid
            const ball = this.ball

            const surroundingCells = grid.getCellsAround(
                grid.sortCellByDistance(grid.sells, ball.x, ball.y, 0)
            )
            const currentType = this.ball.type
            let typeCount = 0
            surroundingCells.forEach((cell) => {
                if (cell.ball && cell.ball.type === currentType) {
                    ++typeCount
                }
            })
            // Wrong! use recursion to get linked cell
            const doPopping = typeCount >= 3
            if (doPopping) {
                console.log('DO POPPING')
            }

            // change event
            this.game.currentEvent = new GameEvent.Aiming(this.game)

            // check 3 of one type
            // pop it
            // check the binding to the ceiling
            // pop it
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
        constructor(game, typeNumber = 0) {
            super(game)
            this.x = game.field.aimX
            this.y = game.field.aimY
            this.radius = GameObject.Ball.radius
            this.moveVector = null
            this.speed = 5
            this.checkRadius = this.radius * 1.65 // should be between radius and 2 * radius
            this.type = GameObject.Ball.getTypeNumber(typeNumber)
        }
        static getTypeNumber(typeNumber) {
            const possibleColor = ['red', 'green', 'blue', 'purple', 'orange']
            let index = typeNumber
            if (0 >= typeNumber < possibleColor.length) {
                const min = 0
                const max = possibleColor.length - 1
                index = Math.floor(Math.random() * (max - min + 1)) + min
            }
            return { type: index, color: possibleColor[index] }
        }
        draw() {
            super.draw()
            const ctx = this.field.ctx

            ctx.fillStyle = this.type.color
            ctx.beginPath()
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
            ctx.fill()
        }
    }

    static Grid = class extends GameObject {
        constructor(game) {
            super(game)
            this.cells = GameObject.Grid.initCells(this)
        }

        static initCells(grid) {
            const cells = []
            const distance = GameObject.Ball.radius * 2
            let yShift = distance / 2
            for (let row = 0; row < 20; row++) {
                const xShift = (distance / 2) * ((row + 1) % 2)
                for (let col = 0; col < 20; col++) {
                    if (col * distance + xShift === 0) {
                        continue
                    }
                    const cell = new GameObject.Cell(
                        grid.game, // game
                        grid, // grid
                        col * distance + xShift, // x
                        row * distance + yShift, // y
                        row, // row
                        col // column
                    )
                    cells.push(cell)
                }
            }
            return cells
        }
        s

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

        sortCellByDistance(array, x, y, len = 0) {
            //! rework. Need to filter(not more than 2R) before sorting
            const point = { x: x, y: y }
            function getRange(cell) {
                return new Vector(point.x, point.y, cell.x, cell.y)._len
            }
            const theNearestCell = this.cells
                .slice() // making copy
                .sort((a, b) => {
                    return getRange(a) - getRange(b)
                })[len]
            return theNearestCell
        }

        getCellByPosition(row, col) {
            return this.cells.find((cell) => {
                return cell.row === row && cell.col === col
            })
        }

        getCellsAround(cell) {
            const cells = cell.grid.cells
            const row = cell.row
            const col = cell.col
            const cellsAround = []
            cellsAround.push(this.getCellByPosition(row, col)) // current cell
            cellsAround.push(this.getCellByPosition(row, col - 1)) // left cell
            cellsAround.push(this.getCellByPosition(row, col + 1)) // right cell
            cellsAround.push(this.getCellByPosition(row + 1, col)) // top cell
            cellsAround.push(this.getCellByPosition(row - 1, col)) // bottom cell
            const shift = row % 2 === 0 ? 1 : -1
            cellsAround.push(this.getCellByPosition(row + 1, col + shift)) // top shift cell
            cellsAround.push(this.getCellByPosition(row - 1, col + shift)) // bottom shift cell
            return cellsAround.filter((c) => {
                return c !== undefined
            }) // delete undefined
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
